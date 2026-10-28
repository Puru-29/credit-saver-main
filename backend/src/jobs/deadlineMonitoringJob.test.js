import assert from "node:assert/strict";
import test from "node:test";
import {
  CRON_EXPRESSION,
  startDeadlineMonitoringJob,
} from "./deadlineMonitoringJob.js";

test("schedules hourly in UTC, prevents overlapping runs, and stops cleanly", async () => {
  let scheduledExpression;
  let scheduledOptions;
  let scheduledCallback;
  let stopped = false;
  let monitorCalls = 0;
  const result = {
    status: "SUCCEEDED",
    counts: { deadlinesScanned: 0 },
    errors: [],
  };

  const job = startDeadlineMonitoringJob({
    schedule(expression, callback, options) {
      scheduledExpression = expression;
      scheduledCallback = callback;
      scheduledOptions = options;
      return { stop() { stopped = true; } };
    },
    async monitor() {
      monitorCalls += 1;
      return result;
    },
  });
  const secondStart = startDeadlineMonitoringJob({
    schedule() {
      assert.fail("the scheduler must only be registered once");
    },
  });

  assert.equal(secondStart, job);
  assert.equal(scheduledExpression, "0 * * * *");
  assert.equal(CRON_EXPRESSION, scheduledExpression);
  assert.deepEqual(scheduledOptions, { timezone: "UTC" });
  assert.equal(await job.runNow(), result);
  assert.equal(monitorCalls, 1);

  scheduledCallback();
  await job.runNow();
  assert.equal(monitorCalls, 2);

  await job.stop();
  assert.equal(stopped, true);
  assert.equal(await job.runNow(), null);
});
