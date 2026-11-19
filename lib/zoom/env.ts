import "server-only";
import { z } from "zod";

/**
 * Zoom environment variables, validated by name only. Values are never
 * logged or included in error messages.
 */
export const ZOOM_API_ENV_NAMES = [
  "ZOOM_ACCOUNT_ID",
  "ZOOM_CLIENT_ID",
  "ZOOM_CLIENT_SECRET",
  "ZOOM_DEFAULT_HOST_USER_ID",
] as const;
export const ZOOM_WEBHOOK_ENV_NAMES = ["ZOOM_WEBHOOK_SECRET_TOKEN"] as const;
export const ZOOM_ENV_NAMES = [...ZOOM_API_ENV_NAMES, ...ZOOM_WEBHOOK_ENV_NAMES] as const;

type ZoomEnvName = (typeof ZOOM_ENV_NAMES)[number];

const nonEmpty = z.string().trim().min(1);

const apiSchema = z.object({
  ZOOM_ACCOUNT_ID: nonEmpty,
  ZOOM_CLIENT_ID: nonEmpty,
  ZOOM_CLIENT_SECRET: nonEmpty,
  ZOOM_DEFAULT_HOST_USER_ID: nonEmpty,
});
const webhookSchema = z.object({ ZOOM_WEBHOOK_SECRET_TOKEN: nonEmpty });

export type ZoomApiEnv = z.infer<typeof apiSchema>;
export type ZoomWebhookEnv = z.infer<typeof webhookSchema>;

export class ZoomConfigError extends Error {
  constructor(readonly missing: ZoomEnvName[]) {
    super(`Zoom is not configured: missing or empty ${missing.join(", ")}.`);
    this.name = "ZoomConfigError";
  }
}

function pick<T extends readonly ZoomEnvName[]>(names: T, env: NodeJS.ProcessEnv) {
  return Object.fromEntries(names.map((name) => [name, env[name]]));
}

function parse<S extends z.ZodTypeAny>(schema: S, names: readonly ZoomEnvName[], env: NodeJS.ProcessEnv): z.infer<S> {
  const result = schema.safeParse(pick(names, env));
  if (result.success) return result.data;
  const missing = [...new Set(result.error.issues.map((issue) => String(issue.path[0])))] as ZoomEnvName[];
  throw new ZoomConfigError(missing);
}

/** Credentials for the Server-to-Server OAuth app. Throws ZoomConfigError naming what is missing. */
export function zoomApiEnv(env: NodeJS.ProcessEnv = process.env): ZoomApiEnv {
  return parse(apiSchema, ZOOM_API_ENV_NAMES, env);
}

/** Secret token used to sign webhook deliveries. Throws ZoomConfigError if missing. */
export function zoomWebhookEnv(env: NodeJS.ProcessEnv = process.env): ZoomWebhookEnv {
  return parse(webhookSchema, ZOOM_WEBHOOK_ENV_NAMES, env);
}

/** Names of Zoom variables that are unset or empty (names only, never values). */
export function missingZoomEnv(env: NodeJS.ProcessEnv = process.env): ZoomEnvName[] {
  return ZOOM_ENV_NAMES.filter((name) => !env[name]?.trim());
}
