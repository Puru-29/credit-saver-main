import cron from "node-cron";
import { runDeadlineMonitoring } from "../services/deadlineMonitoringService.js";

const CRON_EXPRESSION = "0 * * * *";
let activeJob;

function safeErrorCode(error) {
  if (Number.isInteger(error?.code)) return `DB_${error.code}`;
  if (typeof error?.name === "string" && /^[A-Za-z]{1,60}$/.test(error.name)) {
    return error.name.toUpperCase();
  }
  return "UNKNOWN";
}

export function startDeadlineMonitoringJob({
  schedule = cron.schedule,
  monitor = runDeadlineMonitoring,
} = {}) {
  if (activeJob) return activeJob;

  let stopped = false;
  let inFlight;

  const runOnce = () => {
    if (stopped) return Promise.resolve(null);
    if (inFlight) return inFlight;

    inFlight = Promise.resolve()
      .then(() => monitor())
      .then((result) => {
        const log = {
          job: "DEADLINE_MONITORING",
          status: result?.status || "UNKNOWN",
          counts: result?.counts || {},
          errorCount: result?.errors?.length || 0,
        };
        const write = result?.status === "FAILED" ? console.error : console.info;
        write(JSON.stringify(log));
        return result;
      })
      .catch((error) => {
        console.error(
          JSON.stringify({
            job: "DEADLINE_MONITORING",
            status: "FAILED",
            error: safeErrorCode(error),
          }),
        );
        return null;
      })
      .finally(() => {
        inFlight = undefined;
      });

    return inFlight;
  };

  const task = schedule(
    CRON_EXPRESSION,
    () => {
      void runOnce();
    },
    { timezone: "UTC" },
  );
  activeJob = {
    runNow: runOnce,
    async stop() {
      if (stopped) return;
      stopped = true;
      task.stop();
      await inFlight;
      activeJob = undefined;
    },
  };

  void runOnce();
  return activeJob;
}

export { CRON_EXPRESSION };
