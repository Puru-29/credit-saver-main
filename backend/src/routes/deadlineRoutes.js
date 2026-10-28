import { Router } from "express";
import { deadlineController } from "../controllers/deadlineController.js";
import { createAuthMiddleware } from "../middleware/authMiddleware.js";

export function createDeadlineRouter(config) {
  const router = Router();
  router.use(createAuthMiddleware(config));

  router.post("/", deadlineController.create);
  router.get("/", deadlineController.list);
  router.get("/cases/:caseId", deadlineController.listForCase);
  router.get("/:id/escalation-eligibility", deadlineController.escalationEligibility);
  router.post("/:id/verify", deadlineController.verify);
  router.post("/:id/reminders", deadlineController.scheduleReminder);
  router.patch("/:id/reminders/:reminderId", deadlineController.cancelReminder);
  router.patch("/:id/status", deadlineController.updateStatus);
  router.get("/:id", deadlineController.getById);
  router.patch("/:id", deadlineController.update);

  return router;
}
