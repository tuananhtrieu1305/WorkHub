const MAX_POLL_QUESTION_LENGTH = 200;
const MAX_POLL_OPTION_LENGTH = 100;
const MIN_POLL_OPTIONS = 2;
const MAX_POLL_OPTIONS = 20;
const pollOptionBaseCollator = new Intl.Collator("vi", {
  sensitivity: "base",
});
const pollOptionExactCollator = new Intl.Collator("vi");

const toComparableId = (value) => {
  if (value == null) return "";
  return String(value._id || value.id || value);
};

const normalizeString = (value, maxLength) => {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ").slice(0, maxLength);
};

const normalizeBoolean = (value, fallback = false) =>
  typeof value === "boolean" ? value : fallback;

const normalizePollExpiry = (value, now = new Date()) => {
  if (!value) return null;

  const expiresAt = new Date(value);
  if (Number.isNaN(expiresAt.getTime())) {
    throw new Error("Poll expiration time is invalid");
  }

  if (expiresAt.getTime() <= now.getTime()) {
    throw new Error("Poll expiration time must be in the future");
  }

  return expiresAt;
};

const getOptionId = (option) => toComparableId(option?._id || option?.id);

const getPollOptionText = (option) => String(option?.text || "");

const getPollOptionVoteCount = (option) => {
  if (typeof option?.voteCount === "number") return option.voteCount;
  return Array.isArray(option?.voters) ? option.voters.length : 0;
};

export const comparePollOptionsByVotesAndText = (
  firstOption,
  secondOption,
  { getVoteCount = getPollOptionVoteCount } = {},
) => {
  const voteDifference =
    (Number(getVoteCount(secondOption)) || 0) -
    (Number(getVoteCount(firstOption)) || 0);
  if (voteDifference !== 0) return voteDifference;

  const firstText = getPollOptionText(firstOption);
  const secondText = getPollOptionText(secondOption);
  return (
    pollOptionBaseCollator.compare(firstText, secondText) ||
    pollOptionExactCollator.compare(firstText, secondText)
  );
};

export const sortPollOptionsByVotesAndText = (
  options = [],
  { getVoteCount } = {},
) =>
  [...options].sort((firstOption, secondOption) =>
    comparePollOptionsByVotesAndText(firstOption, secondOption, {
      getVoteCount,
    }),
  );

export const isPollClosed = (poll, now = new Date()) => {
  if (!poll) return true;
  if (poll.closedAt) return true;
  if (!poll.expiresAt) return false;

  const expiresAt = new Date(poll.expiresAt);
  return !Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() <= now.getTime();
};

export const normalizePollPayload = (
  payload = {},
  { creatorId, now = new Date() } = {},
) => {
  const settingsPayload = payload.settings || {};
  const question = normalizeString(
    payload.question,
    MAX_POLL_QUESTION_LENGTH,
  );

  if (!question) {
    throw new Error("Poll question is required");
  }

  const rawOptions = Array.isArray(payload.options) ? payload.options : [];
  if (rawOptions.length > MAX_POLL_OPTIONS) {
    throw new Error(`Poll can have at most ${MAX_POLL_OPTIONS} options`);
  }

  const options = rawOptions
    .map((option) =>
      normalizeString(
        typeof option === "string" ? option : option?.text,
        MAX_POLL_OPTION_LENGTH,
      ),
    )
    .filter(Boolean);

  if (options.length < MIN_POLL_OPTIONS) {
    throw new Error(`Poll requires at least ${MIN_POLL_OPTIONS} options`);
  }

  const dedupeKeys = new Set();
  const hasDuplicate = options.some((option) => {
    const key = option.toLowerCase();
    if (dedupeKeys.has(key)) return true;
    dedupeKeys.add(key);
    return false;
  });

  if (hasDuplicate) {
    throw new Error("Poll options must be unique");
  }

  const poll = {
    question,
    options: options.map((text) => ({
      text,
      createdBy: creatorId,
      createdAt: now,
      voters: [],
    })),
    settings: {
      multiple: normalizeBoolean(
        settingsPayload.multiple,
        normalizeBoolean(payload.multiple, false),
      ),
      allowOptions: normalizeBoolean(
        settingsPayload.allowOptions,
        normalizeBoolean(payload.allowOptions, false),
      ),
      hideResultsUntilVoted: normalizeBoolean(
        settingsPayload.hideResultsUntilVoted,
        normalizeBoolean(payload.hideResultsUntilVoted, false),
      ),
      hideVoters: normalizeBoolean(
        settingsPayload.hideVoters,
        normalizeBoolean(payload.hideVoters, false),
      ),
    },
    expiresAt: normalizePollExpiry(payload.expiresAt, now),
    closedAt: null,
  };

  return {
    poll,
    pinOnCreate: normalizeBoolean(
      payload.pinOnCreate,
      normalizeBoolean(settingsPayload.pinOnCreate, false),
    ),
  };
};

export const getCurrentUserPollOptionIds = (poll, userId) => {
  const currentUserId = toComparableId(userId);
  if (!poll || !currentUserId) return [];

  return (poll.options || [])
    .filter((option) =>
      (option.voters || []).some(
        (vote) => toComparableId(vote.userId) === currentUserId,
      ),
    )
    .map(getOptionId)
    .filter(Boolean);
};

export const userHasPollVote = (poll, userId) =>
  getCurrentUserPollOptionIds(poll, userId).length > 0;

export const applyPollVote = (
  poll,
  optionIds,
  { userId, now = new Date() } = {},
) => {
  if (!poll) {
    throw new Error("Poll not found");
  }

  if (isPollClosed(poll, now)) {
    throw new Error("Poll is closed");
  }

  const currentUserId = toComparableId(userId);
  if (!currentUserId) {
    throw new Error("User is required");
  }

  const selectedIds = [...new Set((optionIds || []).map(toComparableId))]
    .filter(Boolean);

  if (!poll.settings?.multiple && selectedIds.length > 1) {
    throw new Error("Poll allows only one option");
  }

  const options = poll.options || [];
  const validOptionIds = new Set(options.map(getOptionId).filter(Boolean));
  const hasInvalidOption = selectedIds.some((optionId) => !validOptionIds.has(optionId));

  if (hasInvalidOption) {
    throw new Error("Poll option is invalid");
  }

  options.forEach((option) => {
    option.voters = (option.voters || []).filter(
      (vote) => toComparableId(vote.userId) !== currentUserId,
    );
  });

  selectedIds.forEach((optionId) => {
    const option = options.find((item) => getOptionId(item) === optionId);
    if (!option) return;
    option.voters = option.voters || [];
    option.voters.push({
      userId,
      votedAt: now,
    });
  });

  return poll;
};

export const addPollOption = (
  poll,
  text,
  { userId, now = new Date() } = {},
) => {
  if (!poll) {
    throw new Error("Poll not found");
  }

  if (isPollClosed(poll, now)) {
    throw new Error("Poll is closed");
  }

  if (!poll.settings?.allowOptions) {
    throw new Error("Poll does not allow adding options");
  }

  const normalizedText = normalizeString(text, MAX_POLL_OPTION_LENGTH);
  if (!normalizedText) {
    throw new Error("Poll option text is required");
  }

  const options = poll.options || [];
  if (options.length >= MAX_POLL_OPTIONS) {
    throw new Error(`Poll can have at most ${MAX_POLL_OPTIONS} options`);
  }

  const hasDuplicate = options.some(
    (option) => normalizeString(option.text, MAX_POLL_OPTION_LENGTH).toLowerCase() ===
      normalizedText.toLowerCase(),
  );

  if (hasDuplicate) {
    throw new Error("Poll options must be unique");
  }

  options.push({
    text: normalizedText,
    createdBy: userId,
    createdAt: now,
    voters: [],
  });
  poll.options = options;

  return poll;
};
