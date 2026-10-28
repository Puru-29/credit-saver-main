import { Router } from "express";
import { caseController } from "../controllers/caseController.js";
import { createAuthMiddleware } from "../middleware/authMiddleware.js";

export function createCaseRouter(config) {
  const router = Router();
  const requireAuth = createAuthMiddleware(config);

  router.use(requireAuth);
  router.post("/", caseController.create);
  router.get("/", caseController.list);
  router.get("/:id", caseController.getById);
  router.patch("/:id/status", caseController.updateStatus);
  router.patch("/:id", caseController.update);

  return router;
}
