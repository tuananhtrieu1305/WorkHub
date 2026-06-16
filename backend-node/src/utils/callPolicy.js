export const DEFAULT_CALL_HEARTBEAT_STALE_MS = 40 * 1000;

export const getCallHeartbeatStaleMs = () => {
  const configured = Number.parseInt(process.env.CALL_HEARTBEAT_STALE_MS || "", 10);
  return Number.isFinite(configured) && configured > 0
    ? configured
    : DEFAULT_CALL_HEARTBEAT_STALE_MS;
};

export const isCallHeartbeatStale = (
  lastHeartbeatAt,
  now = new Date(),
  staleMs = getCallHeartbeatStaleMs(),
) => {
  if (!lastHeartbeatAt) return false;
  return now.getTime() - new Date(lastHeartbeatAt).getTime() > staleMs;
};

const toComparableId = (value) => {
  if (value == null) return "";
  return String(value._id || value.id || value);
};

export const applyCallHeartbeat = (
  participants = [],
  userId,
  now = new Date(),
) => {
  const targetUserId = toComparableId(userId);
  let updated = false;
  const nextParticipants = participants.map((participant) => {
    const data =
      participant && typeof participant.toObject === "function"
        ? participant.toObject()
        : participant;

    if (toComparableId(data?.userId) !== targetUserId) {
      return data;
    }

    updated = true;
    return {
      ...data,
      lastHeartbeatAt: now,
      disconnectedAt: null,
    };
  });

  return {
    updated,
    participants: nextParticipants,
  };
};
