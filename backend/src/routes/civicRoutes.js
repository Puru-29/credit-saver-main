import { Router } from "express";
import { civicController } from "../controllers/civicController.js";
import { createAuthMiddleware } from "../middleware/authMiddleware.js";

export function createCivicRouter(config) {
  const router = Router();
  router.use(createAuthMiddleware(config));

  router.post("/", civicController.create);
  router.get("/", civicController.list);
  router.get("/duplicates", civicController.listPotentialDuplicates);
  router.get("/authority-suggestion", civicController.getAuthoritySuggestion);
  router.get("/:id", civicController.getById);
  router.patch("/:id", civicController.update);
  router.patch("/:id/authority", civicController.assignAuthority);
  router.patch("/:id/status", civicController.updateStatus);

  return router;
}
