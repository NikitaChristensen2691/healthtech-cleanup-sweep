import { z } from "zod";
import { infrai } from "./infrai.ts";

export const appointmentBody = z.object({
  appointmentId: z.string().min(1),
  patientReference: z.string().min(1),
  scheduledFor: z.string().datetime(),
  status: z.enum(["cancelled", "completed", "no_show"])
});
export type Appointment = z.infer<typeof appointmentBody>;

export function staleAppointments(records: Appointment[], now = Date.now(), ageDays = 30): Appointment[] {
  const cutoff = now - ageDays * 24 * 60 * 60 * 1000;
  return records.filter((record) => record.status !== "completed" && Date.parse(record.scheduledFor) < cutoff);
}

export async function registerSweep(taskUrl: string) {
  return infrai.cron.create({ cron_expr: "0 2 * * *", task: taskUrl });
}

export async function publishPatientSafeNotice(records: Appointment[], queue: string) {
  const payload = JSON.stringify({ type: "stale-appointment-sweep", count: records.length, appointmentIds: records.map((r) => r.appointmentId) });
  return infrai.queue.publish({ queue, payload });
}

export async function removeSweepArtifacts(bucket: string, records: Appointment[]) {
  return infrai.storage.object.delete_batch(bucket, { keys: records.map((r) => `appointments/${r.appointmentId}.json`) });
}

export async function ensureBucket(bucket: string) {
  return infrai.storage.bucket.create({ name: bucket });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const bucket = process.env.INFRAI_BUCKET ?? "healthtech-sweep-artifacts";
  await ensureBucket(bucket);
  const job = await registerSweep(process.env.SWEEP_TASK_URL ?? "https://example.invalid/healthtech/sweep");
  console.log(`registered cleanup sweep ${job.job_id}; bucket ${bucket} is ready`);
}
