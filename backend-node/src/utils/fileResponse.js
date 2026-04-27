export const contentDisposition = (type, filename) => {
  const fallback = "document";
  const safeFallback = (filename || fallback).replace(/["\\\r\n]/g, "_");
  const encoded = encodeURIComponent(filename || fallback).replace(/['()]/g, escape);

  return `${type}; filename="${safeFallback}"; filename*=UTF-8''${encoded}`;
};

export const setFileHeaders = (res, file, dispositionType) => {
  res.setHeader("Content-Type", file.contentType || "application/octet-stream");
  if (file.contentLength !== undefined) {
    res.setHeader("Content-Length", file.contentLength);
  }
  res.setHeader(
    "Content-Disposition",
    contentDisposition(dispositionType, file.originalName),
  );
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "private, no-store");
};
