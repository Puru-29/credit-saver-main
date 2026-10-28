import { Router } from "express";
import { rtiController } from "../controllers/rtiController.js";
import { createAuthMiddleware } from "../middleware/authMiddleware.js";

export function createRtiRouter(config) {
  const router = Router();
  router.use(createAuthMiddleware(config));

  router.post("/drafts", rtiController.createDraft);
  router.post("/drafts/:id/first-appeal", rtiController.createFirstAppealDraft);
  router.post("/cases/:id/action-taken-request", rtiController.createActionTakenDraft);
  router.get("/drafts", rtiController.listDrafts);
  router.get("/drafts/:id", rtiController.getDraft);
  router.patch("/drafts/:id", rtiController.updateDraft);

  return router;
}
