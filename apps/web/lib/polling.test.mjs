import test from "node:test";
import assert from "node:assert/strict";
import { startPolling } from "./polling.mjs";
const tick = () => new Promise((resolve) => setImmediate(resolve));
test("polling applies only the latest response and stops after unmount", async () => {
  const requests = [],
    values = [],
    scheduled = [];
  const controller = startPolling({
    load: () => new Promise((resolve) => requests.push(resolve)),
    onValue: (v) => values.push(v),
    onError: () => {},
    schedule: (fn) => {
      scheduled.push(fn);
      return scheduled.length;
    },
    cancel: () => {},
  });
  const newer = controller.refresh();
  requests[1]("confirmed");
  await newer;
  requests[0]("placed");
  await tick();
  assert.deepEqual(values, ["confirmed"]);
  assert.equal(scheduled.length, 1);
  const stopped = controller.refresh();
  controller.stop();
  requests[2]("delivered");
  await stopped;
  assert.deepEqual(values, ["confirmed"]);
});
test("hidden views do not fetch and transient failures schedule another attempt", async () => {
  let visible = false,
    calls = 0;
  const jobs = [],
    errors = [];
  const controller = startPolling({
    load: async () => {
      calls++;
      throw Error("offline");
    },
    onValue: () => {},
    onError: (e) => errors.push(e.message),
    shouldPoll: () => visible,
    schedule: (fn) => {
      jobs.push(fn);
      return jobs.length;
    },
    cancel: () => {},
  });
  assert.equal(calls, 0);
  visible = true;
  await jobs[0]();
  assert.equal(calls, 1);
  assert.deepEqual(errors, ["offline"]);
  assert.equal(jobs.length, 2);
  controller.stop();
});
