import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { createAuthController } from "../controllers/authController.js";
import { createAuthMiddleware } from "../middleware/authMiddleware.js";

export function createAuthRouter(config) {
  const router = Router();
  const controller = createAuthController(config);
  const requireAuth = createAuthMiddleware(config);
  const authRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { message: "Too many authentication attempts. Please try again later." },
  });

  router.post("/register", authRateLimit, controller.register);
  router.post("/login", authRateLimit, controller.login);
  router.get("/me", requireAuth, controller.getCurrentUser);

  return router;
}
