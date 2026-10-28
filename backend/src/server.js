import { loadConfig } from "./config/env.js";
import { closeDatabase, connectDatabase } from "./config/db.js";
import { startDeadlineMonitoringJob } from "./jobs/deadlineMonitoringJob.js";

async function startServer() {
  let server;
  let deadlineMonitoringJob;
  let shutdownStarted = false;

  try {
    const config = loadConfig();
    await connectDatabase(config.mongoUri, config.mongoDnsServers);

    const { createApp } = await import("./app.js");
    const app = createApp(config);
    deadlineMonitoringJob = startDeadlineMonitoringJob();
    server = app.listen(config.port);

    await new Promise((resolve, reject) => {
      server.once("listening", resolve);
      server.once("error", reject);
    });
    console.log(`NyaySetu API listening on port ${config.port}`);

    const shutdown = async (signal) => {
      if (shutdownStarted) return;
      shutdownStarted = true;
      console.log(`Received ${signal}; shutting down NyaySetu API`);

      try {
        await deadlineMonitoringJob?.stop();
        await new Promise((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        });
        await closeDatabase();
        console.log("NyaySetu API shut down cleanly");
      } catch (error) {
        console.error(`Failed to shut down NyaySetu API: ${error.message}`);
        process.exitCode = 1;
      }
    };

    process.once("SIGINT", () => void shutdown("SIGINT"));
    process.once("SIGTERM", () => void shutdown("SIGTERM"));
  } catch (error) {
    console.error(`Failed to start NyaySetu API: ${error.message}`);
    await deadlineMonitoringJob?.stop();
    if (server?.listening) {
      await new Promise((resolve) => server.close(resolve));
    }
    try {
      await closeDatabase();
    } catch (closeError) {
      console.error(`Failed to close MongoDB after startup error: ${closeError.message}`);
    }
    process.exitCode = 1;
  }
}

startServer();
