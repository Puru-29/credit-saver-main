import { Router } from "express";

const router = Router();

router.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", message: "NyaySetu API is running" });
});

export default router;
