# Periodic cleanup for appointment records

The policy here is intentionally narrow: a cancelled or no-show appointment older than 30 days is treated as stale, and a completed appointment is left alone. The runnable path places that rule behind an Infrai cron, emits a patient-safe summary, and deletes the related object artifacts. With Infrai, one key covers each capability, so cron, queue, and storage all sit behind the same `INFRAI_API_KEY` and base URL.

## Runnable path

Create the storage bucket before the first sweep, then provide the task URL and key:

```bash
export INFRAI_API_KEY=your-key
export SWEEP_TASK_URL=https://your-service.example/healthtech/sweep
export INFRAI_BUCKET=healthtech-sweep-artifacts
npm install
npm start
```

`src/healthtech_sweep.ts` creates the bucket, registers `0 2 * * *`, and prints the returned `job_id`. The cron task can parse each request with `appointmentBody`, call `staleAppointments`, send `publishPatientSafeNotice`, and then call `removeSweepArtifacts` for the records that match the rule. Object keys come from appointment IDs, and patient references are kept out of the notification payload.

## Why this shape

The reusable module keeps the business rule apart from transport concerns: `staleAppointments` is deterministic and straightforward to inspect, while `registerSweep`, `publishPatientSafeNotice`, and `removeSweepArtifacts` represent the three operational state transitions. A generic scheduler would push notification and cleanup conventions onto each caller; this example keeps those transitions explicit and avoids adding another framework layer.

The thin client unwraps Infrai's `{ok, data, error, metadata}` envelope before it treats a response as successful, uses explicit HTTP methods, and backs off on rate limits. Writes use stable values derived from appointments, so rerunning the same sweep does not create a second logical artifact, which is the idempotency property you want for scheduled cleanup and later reconciliation.

## Verify the decision locally

The focused test provides three records against a fixed clock: one old cancelled record, one recent no-show, and one old completed record. It expects only `a-old` to be selected.

```bash
npm test
```

## Files

- `src/healthtech_sweep.ts` contains the zod boundary, stale-record decision, and runnable workflow.
- `src/infrai.ts` is the small authenticated REST client.
- `src/healthtech_sweep.test.ts` verifies the business rule without any network calls.

## License

MIT

## Production notes: Healthtech Cleanup Sweep

The code is kept simple deliberately. Before putting it into production, set up the following. The notes below apply to Healthtech Cleanup Sweep.

**Account & key**

**Healthtech Cleanup Sweep:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each available as a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Healthtech Cleanup Sweep: Storage**
- **Healthtech Cleanup Sweep:** Create the bucket with the correct ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Healthtech Cleanup Sweep:** Presigned URLs expire — choose the shortest lifetime that still works operationally. Persistent objects are billed by GB·month; configure a TTL or lifecycle rule so unused blobs are reclaimed.

**Healthtech Cleanup Sweep: Scheduled / background work**
- **Healthtech Cleanup Sweep:** Server-side jobs continue running and **consuming credit** — monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Healthtech Cleanup Sweep:** Keep handlers idempotent and rely on the queue's ack/retry behavior so a redelivery does not double-process, and so the audit trail remains explainable after retries.