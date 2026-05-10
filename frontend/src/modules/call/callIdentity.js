const browserDeviceStorageKey = "workhub_call_browser_device_id";
const tabInstanceStorageKey = "workhub_call_tab_instance_id";
const identityChannelName = "workhub_call_identity";

const createId = (prefix) => {
  const random =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${random}`;
};

export const getBrowserDeviceId = () => {
  const existing = localStorage.getItem(browserDeviceStorageKey);
  if (existing) return existing;

  const nextId = createId("browser");
  localStorage.setItem(browserDeviceStorageKey, nextId);
  return nextId;
};

export const getTabInstanceId = () => {
  const existing = sessionStorage.getItem(tabInstanceStorageKey);
  if (existing) return existing;

  const nextId = createId("tab");
  sessionStorage.setItem(tabInstanceStorageKey, nextId);
  return nextId;
};

export const regenerateTabInstanceId = () => {
  const nextId = createId("tab");
  sessionStorage.setItem(tabInstanceStorageKey, nextId);
  return nextId;
};

export const getCallIdentity = () => ({
  browserDeviceId: getBrowserDeviceId(),
  tabInstanceId: getTabInstanceId(),
});

export const createCallBroadcastChannel = () => {
  if (typeof BroadcastChannel === "undefined") return null;
  return new BroadcastChannel(identityChannelName);
};

export const ensureDistinctTabIdentity = () => {
  const channel = createCallBroadcastChannel();
  if (!channel) return getCallIdentity();

  let identity = getCallIdentity();
  const handleMessage = (event) => {
    if (event.data?.type !== "call_identity_announce") return;
    if (event.data.tabInstanceId !== identity.tabInstanceId) return;
    identity = {
      ...identity,
      tabInstanceId: regenerateTabInstanceId(),
    };
    channel.postMessage({
      type: "call_identity_announce",
      tabInstanceId: identity.tabInstanceId,
    });
  };

  channel.addEventListener("message", handleMessage);
  channel.postMessage({
    type: "call_identity_announce",
    tabInstanceId: identity.tabInstanceId,
  });

  return {
    ...identity,
    close: () => {
      channel.removeEventListener("message", handleMessage);
      channel.close();
    },
  };
};
