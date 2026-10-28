export function errorHandler(error, _req, res, next) {
  const status =
    Number.isInteger(error.statusCode) && error.statusCode >= 400 && error.statusCode <= 599
      ? error.statusCode
      : Number.isInteger(error.status) && error.status >= 400 && error.status <= 599
        ? error.status
        : 500;

  if (res.headersSent) {
    next(error);
    return;
  }

  if (res.app.get("env") === "production") {
    console.error(`Request failed with status ${status}`);
    res.status(status).json({
      error: status >= 500 ? "Internal Server Error" : "Request failed",
    });
    return;
  }

  console.error(error);
  res.status(status).json({
    error: error.message || "Internal Server Error",
    ...(error.stack ? { stack: error.stack } : {}),
  });
}
