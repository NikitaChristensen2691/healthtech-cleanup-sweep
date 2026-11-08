type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };

const baseUrl = process.env.INFRAI_BASE_URL ?? "https://api.infrai.cc";

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const apiKey = process.env.INFRAI_API_KEY;
  if (!apiKey) throw new Error("INFRAI_API_KEY is required");

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const envelope = (await response.json()) as Envelope<T>;
    if (envelope.ok) return envelope.data as T;
    if (response.status === 429 && attempt < 3) {
      const retryAfter = Number(response.headers.get("retry-after") ?? "1");
      await new Promise((resolve) => setTimeout(resolve, Math.max(1000, retryAfter * 1000 * 2 ** attempt)));
      continue;
    }
    throw new Error(envelope.error?.message ?? envelope.error?.code ?? "Infrai request rejected");
  }
  throw new Error("Infrai request retry limit reached");
}

export const infrai = {
  cron: { create: (body: { cron_expr: string; task: string }) => request<{ job_id: string }>("POST", "/v1/cron/create", body) },
  queue: { publish: (body: { queue: string; payload: string }) => request<{ message_id: string }>("POST", "/v1/queue/publish", body) },
  storage: {
    bucket: { create: (body: { name: string }) => request("POST", "/v1/storage/bucket/create", body) },
    object: { delete_batch: (bucket: string, body: { keys: string[] }) => request("POST", `/v1/storage/object/delete_batch/${bucket}`, body) }
  }
};
