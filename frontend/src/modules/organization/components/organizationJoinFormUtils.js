export const getInitialJoinFormAnswer = (question) =>
  question.type === "rules" ? false : "";

export const getJoinFormAnswerIsMissing = (question, answers) => {
  if (!question.required) return false;
  const value = answers?.[question.id];
  if (question.type === "rules") return value !== true;
  return !String(value || "").trim();
};
