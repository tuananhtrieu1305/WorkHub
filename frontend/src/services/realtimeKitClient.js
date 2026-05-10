import RealtimeKitClient from "@cloudflare/realtimekit";

let initQueue = Promise.resolve();

export const initRealtimeKitClient = (options) => {
  const runInit = () => RealtimeKitClient.init(options);
  const initPromise = initQueue.then(runInit, runInit);
  initQueue = initPromise.catch(() => {});
  return initPromise;
};
