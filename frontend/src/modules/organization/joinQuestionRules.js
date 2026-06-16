export const defaultServerRules = [
  "Tôn trọng tất cả mọi người. Tuyệt đối không được có hành vi quấy rối, tấn công tập thể, phân biệt giới tính, phân biệt chủng tộc hoặc phát ngôn gây thù hận. Tất cả những hành vi đó sẽ bị trừng trị nghiêm khắc.",
  "Nếu bạn phát hiện có bất kỳ hành động nào trái với các quy định hoặc khiến bạn cảm thấy không an tâm, hãy thông báo ngay cho quản trị viên. Chúng tôi sẽ không để cho những hành động đó ảnh hưởng đến sự lành mạnh của tổ chức này.",
];

export const getRuleLines = (description = "") =>
  String(description || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

export const getEditableRuleLines = (description = "") => {
  const lines = getRuleLines(description);
  return lines.length ? lines : defaultServerRules;
};

export const buildRulesDescription = (rules = []) =>
  rules
    .map((rule) => String(rule || "").trim())
    .filter(Boolean)
    .join("\n");
