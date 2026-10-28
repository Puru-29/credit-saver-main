import { Router } from "express";
import { rightsController } from "../controllers/rightsController.js";
import { createAuthMiddleware } from "../middleware/authMiddleware.js";

export function createRightsRouter(config) {
  const router = Router();
  router.use(createAuthMiddleware(config));

  router.post("/cases", rightsController.createCase);
  router.post("/guidance", rightsController.generateGuidance);
  router.post("/letters", rightsController.generateLetter);
  router.get("/checklist", rightsController.getChecklist);
  router.post("/drafts", rightsController.saveDraft);
  router.get("/drafts", rightsController.listDrafts);
  router.get("/drafts/:id", rightsController.getDraft);

  return router;
}
