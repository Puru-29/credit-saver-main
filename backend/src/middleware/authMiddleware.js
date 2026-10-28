import jwt from "jsonwebtoken";

export function createAuthMiddleware(config) {
  return function authMiddleware(req, res, next) {
    const authorization = req.get("authorization");
    const token = authorization?.match(/^Bearer\s+(\S+)$/i)?.[1];

    if (!token) {
      return res.status(401).json({ message: "Authentication token required" });
    }

    try {
      const payload = jwt.verify(token, config.jwtSecret, {
        algorithms: ["HS256"],
      });
      if (typeof payload !== "object" || typeof payload.sub !== "string") {
        return res.status(401).json({ message: "Invalid or expired token" });
      }

      req.auth = { userId: payload.sub };
      return next();
    } catch {
      return res.status(401).json({ message: "Invalid or expired token" });
    }
  };
}
