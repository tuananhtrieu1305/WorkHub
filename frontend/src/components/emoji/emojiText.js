export const getNativeEmoji = (emoji) => {
  if (!emoji) return "";
  return emoji.skins?.[0]?.native || emoji.native || "";
};

export const appendEmojiToText = (value, emojiNative) => {
  if (!emojiNative) return value;
  const trimmedValue = value ?? "";
  const spacer = trimmedValue && !trimmedValue.endsWith(" ") ? " " : "";
  return `${trimmedValue}${spacer}${emojiNative}`;
};
