import dotenv from "dotenv";

dotenv.config();

export function loadConfig() {
  const nodeEnv = process.env.NODE_ENV?.trim() || "development";
  const port = Number(process.env.PORT || 3000);
  const mongoUri = process.env.MONGODB_URI?.trim() || "";
  const jwtSecret = process.env.JWT_SECRET || "";
  const jwtExpiresIn = process.env.JWT_EXPIRES_IN?.trim() || "1h";
  const clientOrigin =
    process.env.CLIENT_ORIGIN?.trim() ||
    (nodeEnv === "production" ? "" : "http://localhost:8080");

  if (!["development", "test", "production"].includes(nodeEnv)) {
    throw new Error("NODE_ENV must be development, test, or production");
  }

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }

  if (!mongoUri) {
    throw new Error("MONGODB_URI is required. Set it in backend/.env or the environment.");
  }

  if (jwtSecret.length < 32) {
    throw new Error("JWT_SECRET must be set to a secret of at least 32 characters.");
  }

  if (!/^\d+(s|m|h|d|w|y)?$/.test(jwtExpiresIn)) {
    throw new Error("JWT_EXPIRES_IN must be a duration such as 900, 15m, 1h, or 7d.");
  }

  if (!clientOrigin || clientOrigin === "*") {
    throw new Error("CLIENT_ORIGIN must be set to a specific frontend origin");
  }

  let parsedOrigin;
  try {
    parsedOrigin = new URL(clientOrigin);
  } catch {
    throw new Error("CLIENT_ORIGIN must be a valid origin URL");
  }

  if (
    !["http:", "https:"].includes(parsedOrigin.protocol) ||
    parsedOrigin.origin !== clientOrigin
  ) {
    throw new Error("CLIENT_ORIGIN must contain only an HTTP or HTTPS origin");
  }

  return { nodeEnv, port, clientOrigin, mongoUri, jwtSecret, jwtExpiresIn };
}
