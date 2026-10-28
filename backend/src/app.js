import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { errorHandler } from "./middleware/error-handler.js";
import { notFoundHandler } from "./middleware/not-found.js";
import { createAuthRouter } from "./routes/authRoutes.js";
import { createCaseRouter } from "./routes/caseRoutes.js";
import { createRtiRouter } from "./routes/rtiRoutes.js";
import { createRightsRouter } from "./routes/rightsRoutes.js";
import { createCivicRouter } from "./routes/civicRoutes.js";
import { createDeadlineRouter } from "./routes/deadlineRoutes.js";
import { createDocumentRouter } from "./routes/documentRoutes.js";
import healthRouter from "./routes/health.routes.js";

export function createApp(config) {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        callback(null, !origin || origin === config.clientOrigin);
      },
    }),
  );
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(morgan(config.nodeEnv === "production" ? "combined" : "dev"));

  app.use("/api", healthRouter);
  app.use("/api/auth", createAuthRouter(config));
  app.use("/api/cases", createCaseRouter(config));
  app.use("/api/rti", createRtiRouter(config));
  app.use("/api/rights", createRightsRouter(config));
  app.use("/api/civic", createCivicRouter(config));
  app.use("/api/deadlines", createDeadlineRouter(config));
  app.use("/api/documents", createDocumentRouter(config));
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
