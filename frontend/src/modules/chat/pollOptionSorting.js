const pollOptionBaseCollator = new Intl.Collator("vi", {
  sensitivity: "base",
});
const pollOptionExactCollator = new Intl.Collator("vi");

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
