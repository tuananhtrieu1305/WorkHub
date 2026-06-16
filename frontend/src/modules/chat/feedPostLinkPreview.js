const FEED_POST_LINK_PATTERN =
  /(?:https?:\/\/[^\s<>"']+|\/feed#[^\s<>"']+|feed#[^\s<>"']+)/gi;
const TRAILING_PUNCTUATION_PATTERN = /[),.;!?]+$/;
const FALLBACK_ORIGIN = "http://localhost";
const POST_HASH_PREFIX = "#post-";

const getSafeOrigin = (origin) => {
  if (origin) return origin;
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return FALLBACK_ORIGIN;
};

const normalizeFeedPostLinkCandidate = (candidate = "") =>
  String(candidate).trim().replace(TRAILING_PUNCTUATION_PATTERN, "");

export const parseFeedPostLink = (candidate, origin) => {
  const normalizedCandidate = normalizeFeedPostLinkCandidate(candidate);
  if (!normalizedCandidate) return null;

  try {
    const url = new URL(
      normalizedCandidate.startsWith("http") ||
        normalizedCandidate.startsWith("/")
        ? normalizedCandidate
        : `/${normalizedCandidate}`,
      getSafeOrigin(origin),
    );

    if (url.pathname !== "/feed" || !url.hash.startsWith(POST_HASH_PREFIX)) {
      return null;
    }

    const postId = decodeURIComponent(
      url.hash.slice(POST_HASH_PREFIX.length),
    ).trim();
    if (!postId) return null;

    return {
      raw: candidate,
      postId,
      href: `/feed${POST_HASH_PREFIX}${encodeURIComponent(postId)}`,
    };
  } catch {
    return null;
  }
};

export const getFirstFeedPostLink = (content = "", origin) => {
  const text = String(content || "");
  const matches = text.matchAll(FEED_POST_LINK_PATTERN);

  for (const match of matches) {
    const parsedLink = parseFeedPostLink(match[0], origin);
    if (parsedLink) return parsedLink;
  }

  return null;
};

export const removeFeedPostLinks = (content = "", origin) =>
  String(content || "")
    .replace(FEED_POST_LINK_PATTERN, (match) =>
      parseFeedPostLink(match, origin) ? "" : match,
    )
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
