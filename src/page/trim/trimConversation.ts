import type { TrimStats } from "../../shared/schema";

export type MappingNode = {
  id: string;
  parent: string | null;
  children: string[];
  message?: {
    id?: string;
    author?: { role?: string };
    content?: { parts?: unknown[] };
  } | null;
};

export type ConversationPayload = {
  conversation_id?: string;
  current_node?: string | null;
  mapping?: Record<string, MappingNode>;
};

const isMeaningfulNode = (node: MappingNode | undefined): boolean => {
  if (!node?.message) {
    return false;
  }
  const role = node.message.author?.role;
  const parts = node.message.content?.parts;
  const hasContent = Array.isArray(parts) && parts.some((part) => (
    typeof part === "string" ? part.trim().length > 0 : part !== null && typeof part !== "undefined"
  ));
  if (role === "system") {
    return true;
  }
  return hasContent;
};

const getLineage = (mapping: Record<string, MappingNode>, currentNode: string | null | undefined): string[] => {
  if (!currentNode || !mapping[currentNode]) {
    return [];
  }

  const ids: string[] = [];
  let cursor: string | null = currentNode;
  let guard = 0;

  while (cursor && mapping[cursor] && guard < 20000) {
    ids.push(cursor);
    cursor = mapping[cursor].parent;
    guard += 1;
  }

  return ids.reverse();
};

export const trimConversation = (
  payload: ConversationPayload,
  messageLimit: number,
  extraMessages: number
): { payload: ConversationPayload; stats: TrimStats } => {
  const mapping = payload.mapping ?? {};
  const lineage = getLineage(mapping, payload.current_node ?? null);
  const meaningful = lineage.filter((id) => isMeaningfulNode(mapping[id]));

  const keepBudget = Math.max(1, messageLimit + extraMessages);
  const keepSet = new Set<string>(meaningful.slice(-keepBudget));

  if (payload.current_node && mapping[payload.current_node]) {
    keepSet.add(payload.current_node);
  }

  for (const id of lineage) {
    const node = mapping[id];
    if (node?.message?.author?.role === "system") {
      keepSet.add(id);
      break;
    }
  }

  const keptLineage = lineage.filter((id) => keepSet.has(id));

  const nextMapping: Record<string, MappingNode> = {};
  for (let index = 0; index < keptLineage.length; index += 1) {
    const id = keptLineage[index];
    const node = mapping[id];
    if (!node) {
      continue;
    }

    const prevId = index > 0 ? keptLineage[index - 1] : null;
    const nextId = index + 1 < keptLineage.length ? keptLineage[index + 1] : null;

    nextMapping[id] = {
      ...node,
      parent: prevId,
      children: nextId ? [nextId] : []
    };
  }

  const trimmedPayload: ConversationPayload = {
    ...payload,
    mapping: nextMapping,
    current_node: keptLineage.length > 0 ? keptLineage[keptLineage.length - 1] : payload.current_node ?? null
  };

  return {
    payload: trimmedPayload,
    stats: {
      conversationId: payload.conversation_id ?? null,
      visibleTotal: meaningful.length,
      visibleKept: keptLineage.filter((id) => isMeaningfulNode(mapping[id])).length,
      absoluteMessageCount: Object.keys(mapping).length,
      hasOlderMessages: meaningful.length > keepBudget,
      extraMessages,
      timestamp: Date.now()
    }
  };
};
