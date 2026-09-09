export type DomTrimWindow = {
  hiddenCount: number;
  visibleCount: number;
  hasOlderMessages: boolean;
};

export const getDomTrimWindow = (
  total: number,
  messageLimit: number,
  extraMessages: number
): DomTrimWindow => {
  const safeTotal = Math.max(0, Math.floor(total));
  const keepBudget = Math.max(1, Math.floor(messageLimit) + Math.max(0, Math.floor(extraMessages)));
  const visibleCount = Math.min(safeTotal, keepBudget);
  const hiddenCount = safeTotal - visibleCount;

  return {
    hiddenCount,
    visibleCount,
    hasOlderMessages: hiddenCount > 0
  };
};
