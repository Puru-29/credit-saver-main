import { Router } from "express";
import { documentController } from "../controllers/documentController.js";
import { createAuthMiddleware } from "../middleware/authMiddleware.js";

export function createDocumentRouter(config) {
  const router = Router();
  router.use(createAuthMiddleware(config));

  router.post("/generate", documentController.generate);
  router.get("/", documentController.list);
  router.get("/:id", documentController.getById);
  router.patch("/:id", documentController.update);

  return router;
}
