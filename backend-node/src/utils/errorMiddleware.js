import ApiError from "./apiError.js";

const errorMiddleware = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({ message: err.message });
  }

  if (err?.name === "ValidationError") {
    return res.status(400).json({ message: err.message });
  }

  if (err?.code === 11000) {
    return res.status(409).json({ message: "Duplicate resource" });
  }

  if (err?.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ message: "File is too large" });
  }

  console.error("Unhandled API error:", err);
  return res.status(500).json({ message: "Server error, please try again" });
};

export default errorMiddleware;
