import { DEFAULT_SETTINGS, MESSAGE_TYPES } from "../shared/constants";
import type { ExtSettingsV1 } from "../shared/schema";
import { installFetchProxy } from "./fetchProxy";

let didReceiveSettings = false;

window.addEventListener("message", (event) => {
  const message = event.data;
  if (!message || message.type !== MESSAGE_TYPES.pageSettings || !message.payload) {
    return;
  }
  didReceiveSettings = true;
  installFetchProxy(message.payload as ExtSettingsV1);
});

window.postMessage({ type: MESSAGE_TYPES.pageSettingsRequest }, "*");

setTimeout(() => {
  if (!didReceiveSettings) {
    installFetchProxy(DEFAULT_SETTINGS);
  }
}, 250);
