import assert from "node:assert/strict";
import { publishPatientSafeNotice, staleAppointments } from "./healthtech_sweep.ts";

const now = Date.parse("2026-01-31T00:00:00.000Z");
const records = [
  { appointmentId: "a-old", patientReference: "p-1", scheduledFor: "2025-12-01T09:00:00.000Z", status: "cancelled" as const },
  { appointmentId: "a-new", patientReference: "p-2", scheduledFor: "2026-01-20T09:00:00.000Z", status: "no_show" as const },
  { appointmentId: "a-done", patientReference: "p-3", scheduledFor: "2025-10-01T09:00:00.000Z", status: "completed" as const }
];
assert.deepEqual(staleAppointments(records, now, 30).map((record) => record.appointmentId), ["a-old"]);
console.log("stale appointment decision: passed");

const originalFetch = globalThis.fetch;
const originalKey = process.env.INFRAI_API_KEY;
process.env.INFRAI_API_KEY = "local-test-key";
globalThis.fetch = async (_input, init) => {
  const body = JSON.parse(init?.body as string);
  assert.equal(body.queue, "sweep-notices");
  assert.deepEqual(JSON.parse(body.payload), {
    type: "stale-appointment-sweep", count: 1, appointmentIds: ["a-old"]
  });
  return new Response(JSON.stringify({ ok: true, data: { message_id: "test-message" } }));
};
try {
  await publishPatientSafeNotice([records[0]], "sweep-notices");
} finally {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.INFRAI_API_KEY;
  else process.env.INFRAI_API_KEY = originalKey;
}
console.log("queue notice request: passed");
