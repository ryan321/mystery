/**
 * Classify LLM/API failures and decide what is safe to retry.
 */

export type FailureClass =
  | "transient" // 429, 5xx, network, timeout — retry with backoff
  | "auth" // 401/403 — do not retry
  | "invalid_request" // 400, bad model — do not retry
  | "parse" // invalid JSON — repair prompt
  | "schema" // valid JSON, wrong shape — repair prompt
  | "soft" // empty/useless output — one retry
  | "unknown";

export type AttemptKind =
  | "initial"
  | "transport_retry"
  | "json_repair"
  | "schema_repair"
  | "soft_retry";

/** Per-request token/cost accounting (OpenRouter usage.include). */
export type TokenUsage = {
  promptTokens?: number;
  completionTokens?: number;
  /** USD, as reported by OpenRouter. */
  costUsd?: number;
  /** Provider that served the request (OpenRouter routing). */
  provider?: string;
};

export type AttemptLog = {
  kind: AttemptKind;
  attempt: number;
  ok: boolean;
  failureClass?: FailureClass;
  message?: string;
  latencyMs: number;
  usage?: TokenUsage;
};

export class ClassifiedError extends Error {
  readonly failureClass: FailureClass;
  readonly status?: number;
  readonly retryable: boolean;
  readonly retryAfterMs?: number;

  constructor(
    message: string,
    opts: {
      failureClass: FailureClass;
      status?: number;
      retryable?: boolean;
      retryAfterMs?: number;
      cause?: unknown;
    }
  ) {
    super(message, opts.cause !== undefined ? { cause: opts.cause } : undefined);
    this.name = "ClassifiedError";
    this.failureClass = opts.failureClass;
    this.status = opts.status;
    this.retryable =
      opts.retryable ??
      (opts.failureClass === "transient" ||
        opts.failureClass === "parse" ||
        opts.failureClass === "schema" ||
        opts.failureClass === "soft");
    this.retryAfterMs = opts.retryAfterMs;
  }
}

function extractStatus(err: unknown): number | undefined {
  if (!err || typeof err !== "object") return undefined;
  const e = err as Record<string, unknown>;
  if (typeof e.status === "number") return e.status;
  if (typeof e.statusCode === "number") return e.statusCode;
  const res = e.response as Record<string, unknown> | undefined;
  if (res && typeof res.status === "number") return res.status;
  // OpenAI SDK: error.status
  return undefined;
}

function extractMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

function extractRetryAfterMs(err: unknown): number | undefined {
  if (!err || typeof err !== "object") return undefined;
  const e = err as Record<string, unknown>;
  const headers = e.headers as Record<string, string> | undefined;
  const raw =
    headers?.["retry-after"] ??
    headers?.["Retry-After"] ??
    (e.error as { headers?: Record<string, string> } | undefined)?.headers?.[
      "retry-after"
    ];
  if (raw == null) return undefined;
  const sec = Number(raw);
  if (!Number.isFinite(sec) || sec < 0) return undefined;
  return Math.min(sec * 1000, 30_000);
}

/** Classify OpenAI SDK / fetch / JSON errors for retry policy. */
export function classifyError(err: unknown): FailureClass {
  if (err instanceof ClassifiedError) return err.failureClass;

  const status = extractStatus(err);
  const msg = extractMessage(err).toLowerCase();

  if (status === 401 || status === 403) return "auth";
  if (status === 400 || status === 404 || status === 422) return "invalid_request";
  if (status === 429) return "transient";
  if (status !== undefined && status >= 500) return "transient";

  // Network / timeout patterns (Node fetch, undici, OpenAI)
  if (
    msg.includes("timeout") ||
    msg.includes("timed out") ||
    msg.includes("econnreset") ||
    msg.includes("econnrefused") ||
    msg.includes("enotfound") ||
    msg.includes("socket hang up") ||
    msg.includes("fetch failed") ||
    msg.includes("network") ||
    msg.includes("aborted")
  ) {
    return "transient";
  }

  if (
    msg.includes("json") ||
    msg.includes("unexpected token") ||
    err instanceof SyntaxError
  ) {
    return "parse";
  }

  // Zod
  if (
    err &&
    typeof err === "object" &&
    (err as { name?: string }).name === "ZodError"
  ) {
    return "schema";
  }

  return "unknown";
}

export function isTransportRetryable(cls: FailureClass): boolean {
  return cls === "transient";
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Exponential backoff with jitter. attempt is 0-based after first failure. */
export function backoffMs(
  attempt: number,
  opts?: { baseMs?: number; maxMs?: number; retryAfterMs?: number }
): number {
  if (opts?.retryAfterMs != null && opts.retryAfterMs > 0) {
    return Math.min(opts.retryAfterMs, opts.maxMs ?? 12_000);
  }
  const base = opts?.baseMs ?? 250;
  const max = opts?.maxMs ?? 8_000;
  const exp = Math.min(max, base * 2 ** attempt);
  const jitter = Math.floor(Math.random() * 0.35 * exp);
  return exp + jitter;
}

export function wrapThrown(err: unknown): ClassifiedError {
  if (err instanceof ClassifiedError) return err;
  const failureClass = classifyError(err);
  const status = extractStatus(err);
  return new ClassifiedError(extractMessage(err), {
    failureClass,
    status,
    retryAfterMs: extractRetryAfterMs(err),
    cause: err,
  });
}

/** Format Zod issues for a repair prompt (short). */
export function formatSchemaIssues(err: unknown): string {
  if (
    err &&
    typeof err === "object" &&
    Array.isArray((err as { issues?: unknown }).issues)
  ) {
    const issues = (
      err as {
        issues: { path: (string | number)[]; message: string }[];
      }
    ).issues;
    return issues
      .slice(0, 8)
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
  }
  return extractMessage(err);
}
