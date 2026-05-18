import { ensureInitializedStorage } from "../shared/storage";

chrome.runtime.onInstalled.addListener(async () => {
  await ensureInitializedStorage();
});

chrome.runtime.onStartup.addListener(async () => {
  await ensureInitializedStorage();
});
