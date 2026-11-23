import "server-only";
import { zoomFetch } from "./token";

/**
 * Typed, server-only wrapper over the Zoom REST endpoints the LMS uses.
 *
 * Every method lists the scopes it needs (granular name, then the classic
 * equivalent). When Zoom rejects a call for a missing scope, the thrown
 * ZoomApiError names the scope to add to the Server-to-Server OAuth app.
 *
 * start_url is a host credential that expires; it is never cached or stored.
 * Fetch it with getMeeting() right before the host starts the session.
 */

type ScopeSpec = { granular: string; classic: string };

export const ZOOM_SCOPES = {
  createMeeting: { granular: "meeting:write:meeting:admin", classic: "meeting:write:admin" },
  getMeeting: { granular: "meeting:read:meeting:admin", classic: "meeting:read:admin" },
  updateMeeting: { granular: "meeting:update:meeting:admin", classic: "meeting:write:admin" },
  deleteMeeting: { granular: "meeting:delete:meeting:admin", classic: "meeting:write:admin" },
  listRecordings: { granular: "cloud_recording:read:list_recording_files:admin", classic: "recording:read:admin" },
  listUserRecordings: { granular: "cloud_recording:read:list_user_recordings:admin", classic: "recording:read:admin" },
  downloadRecording: { granular: "cloud_recording:read:recording:admin", classic: "recording:read:admin" },
  getPastMeetingParticipants: { granular: "meeting:read:list_past_participants:admin", classic: "meeting:read:admin" },
  getUser: { granular: "user:read:user:admin", classic: "user:read:admin" },
} satisfies Record<string, ScopeSpec>;

export type ZoomOperation = keyof typeof ZOOM_SCOPES;

export class ZoomApiError extends Error {
  constructor(
    message: string,
    readonly operation: ZoomOperation,
    readonly status: number,
    readonly zoomCode?: number,
    readonly missingScopes: string[] = [],
  ) {
    super(message);
    this.name = "ZoomApiError";
  }
  get isNotFound() {
    return this.status === 404;
  }
  get isRateLimited() {
    return this.status === 429;
  }
}

// ── Types ──────────────────────────────────────────────────────────────────

export type ZoomMeetingSettings = {
  host_video?: boolean;
  participant_video?: boolean;
  join_before_host?: boolean;
  mute_upon_entry?: boolean;
  waiting_room?: boolean;
  approval_type?: 0 | 1 | 2;
  auto_recording?: "local" | "cloud" | "none";
  meeting_authentication?: boolean;
  [key: string]: unknown;
};

export type ZoomRecurrence = {
  type: 1 | 2 | 3;
  repeat_interval?: number;
  weekly_days?: string;
  end_times?: number;
  end_date_time?: string;
};

export type ZoomOccurrence = {
  occurrence_id: string;
  start_time: string;
  duration: number;
  status: "available" | "deleted";
};

export type ZoomMeeting = {
  id: number;
  uuid: string;
  host_id: string;
  topic: string;
  type: number;
  start_time?: string;
  duration?: number;
  timezone?: string;
  agenda?: string;
  join_url: string;
  start_url: string;
  password?: string;
  status?: "waiting" | "started";
  occurrences?: ZoomOccurrence[];
  settings?: ZoomMeetingSettings;
};

export type CreateMeetingInput = {
  topic: string;
  /** Interpreted as UTC. */
  startsAt: Date;
  durationMin: number;
  agenda?: string;
  password?: string;
  recurrence?: ZoomRecurrence;
  settings?: ZoomMeetingSettings;
};

export type UpdateMeetingInput = Partial<Omit<CreateMeetingInput, "recurrence">> & {
  recurrence?: ZoomRecurrence;
};

export type ZoomRecordingFile = {
  id: string;
  meeting_id: string;
  recording_start: string;
  recording_end: string;
  file_type: string;
  file_extension?: string;
  file_size?: number;
  play_url?: string;
  download_url?: string;
  status: string;
  recording_type?: string;
};

export type ZoomMeetingRecordings = {
  uuid: string;
  id: number;
  host_id: string;
  topic: string;
  start_time: string;
  duration: number;
  total_size?: number;
  recording_count?: number;
  share_url?: string;
  recording_files: ZoomRecordingFile[];
};

export type ZoomPastParticipant = {
  id?: string;
  user_id?: string;
  participant_user_id?: string;
  name: string;
  user_email?: string;
  join_time: string;
  leave_time: string;
  duration: number;
  status?: string;
};

/** Zoom user plan type: 1 Basic, 2 Licensed, 4 Unassigned without Meetings Basic, 99 None. */
export type ZoomUser = {
  id: string;
  email: string;
  type: number;
  status?: "active" | "inactive" | "pending";
  first_name?: string;
  last_name?: string;
};

export const ZOOM_LICENSED_USER_TYPE = 2;

// ── Internals ──────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: ZoomMeetingSettings = {
  join_before_host: false,
  waiting_room: true,
  mute_upon_entry: true,
  approval_type: 2,
};

/** Zoom wants yyyy-MM-ddTHH:mm:ssZ (no milliseconds) for UTC start times. */
export function zoomUtcTime(date: Date): string {
  if (Number.isNaN(date.getTime())) throw new TypeError("Invalid meeting start time.");
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

/**
 * Meeting UUIDs that start with "/" or contain "//" must be double-encoded
 * in URL paths; meeting IDs and other UUIDs are encoded once.
 */
export function encodeMeetingIdOrUuid(value: string | number): string {
  const text = String(value);
  return text.startsWith("/") || text.includes("//") ? encodeURIComponent(encodeURIComponent(text)) : encodeURIComponent(text);
}

function parseMissingScopes(message: string): string[] {
  const match = /scopes?\s*:?\s*\[([^\]]*)\]/i.exec(message);
  return match ? match[1].split(/[\s,]+/).filter(Boolean) : [];
}

async function fail(operation: ZoomOperation, response: Response): Promise<never> {
  let code: number | undefined;
  let zoomMessage = "";
  try {
    const body = (await response.json()) as { code?: unknown; message?: unknown };
    if (typeof body.code === "number") code = body.code;
    if (typeof body.message === "string") zoomMessage = body.message;
  } catch {
    // Empty or non-JSON body.
  }
  const scope = ZOOM_SCOPES[operation];
  const scopeProblem = code === 4711 || /does not contain scopes|invalid scope/i.test(zoomMessage);
  if (scopeProblem) {
    const missing = parseMissingScopes(zoomMessage);
    const named = missing.length ? missing.join(", ") : `${scope.granular} (classic: ${scope.classic})`;
    throw new ZoomApiError(
      `Zoom ${operation} failed: the Server-to-Server OAuth app is missing scope ${named}. Add it under the app's Scopes in the Zoom Marketplace, then re-activate the app.`,
      operation,
      response.status,
      code,
      missing.length ? missing : [scope.granular],
    );
  }
  throw new ZoomApiError(
    `Zoom ${operation} failed (HTTP ${response.status}${code !== undefined ? `, code ${code}` : ""})${zoomMessage ? `: ${zoomMessage}` : ""}.`,
    operation,
    response.status,
    code,
  );
}

async function call<T>(operation: ZoomOperation, path: string, init: RequestInit = {}): Promise<T> {
  const response = await zoomFetch(path, init);
  if (!response.ok) return fail(operation, response);
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

function meetingBody(input: UpdateMeetingInput) {
  const body: Record<string, unknown> = {};
  if (input.topic !== undefined) body.topic = input.topic;
  if (input.startsAt !== undefined) {
    body.start_time = zoomUtcTime(input.startsAt);
    body.timezone = "UTC";
  }
  if (input.durationMin !== undefined) {
    if (!Number.isInteger(input.durationMin) || input.durationMin <= 0) throw new TypeError("durationMin must be a positive integer.");
    body.duration = input.durationMin;
  }
  if (input.agenda !== undefined) body.agenda = input.agenda;
  if (input.password !== undefined) body.password = input.password;
  if (input.recurrence !== undefined) body.recurrence = input.recurrence;
  if (input.settings !== undefined) body.settings = input.settings;
  return body;
}

function withQuery(path: string, query: Record<string, string | number | boolean | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value !== undefined) params.set(key, String(value));
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

// ── API ────────────────────────────────────────────────────────────────────

/** Schedule a meeting (type 2) or, with recurrence, a recurring meeting (type 8). */
export function createMeeting(hostUserId: string, input: CreateMeetingInput): Promise<ZoomMeeting> {
  const body = {
    ...meetingBody(input),
    type: input.recurrence ? 8 : 2,
    settings: { ...DEFAULT_SETTINGS, ...input.settings },
  };
  return call("createMeeting", `/users/${encodeURIComponent(hostUserId)}/meetings`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** Current meeting details, including a freshly issued start_url. */
export function getMeeting(meetingId: string | number, options: { occurrenceId?: string; showPreviousOccurrences?: boolean } = {}): Promise<ZoomMeeting> {
  return call(
    "getMeeting",
    withQuery(`/meetings/${encodeMeetingIdOrUuid(meetingId)}`, {
      occurrence_id: options.occurrenceId,
      show_previous_occurrences: options.showPreviousOccurrences,
    }),
  );
}

/** Patch a meeting, or one occurrence of a recurring meeting. */
export async function updateMeeting(meetingId: string | number, input: UpdateMeetingInput, options: { occurrenceId?: string } = {}): Promise<void> {
  await call<void>("updateMeeting", withQuery(`/meetings/${encodeMeetingIdOrUuid(meetingId)}`, { occurrence_id: options.occurrenceId }), {
    method: "PATCH",
    body: JSON.stringify(meetingBody(input)),
  });
}

/** Delete a meeting, or one occurrence. Zoom does not email registrants by default here. */
export async function deleteMeeting(meetingId: string | number, options: { occurrenceId?: string; notifyHost?: boolean } = {}): Promise<void> {
  await call<void>(
    "deleteMeeting",
    withQuery(`/meetings/${encodeMeetingIdOrUuid(meetingId)}`, {
      occurrence_id: options.occurrenceId,
      schedule_for_reminder: options.notifyHost ?? false,
    }),
    { method: "DELETE" },
  );
}

/** Cloud recordings for a meeting ID (latest instance) or a specific meeting UUID. */
export function listRecordings(meetingIdOrUuid: string | number): Promise<ZoomMeetingRecordings> {
  return call("listRecordings", `/meetings/${encodeMeetingIdOrUuid(meetingIdOrUuid)}/recordings`);
}

/**
 * A host's cloud recordings with a start date in [from, to] (UTC dates;
 * Zoom allows at most one month per request). Follows pagination.
 */
export async function listUserRecordings(hostUserId: string, from: Date, to: Date): Promise<ZoomMeetingRecordings[]> {
  const day = (date: Date) => date.toISOString().slice(0, 10);
  const meetings: ZoomMeetingRecordings[] = [];
  let nextPageToken: string | undefined;
  do {
    const page = await call<{ meetings?: ZoomMeetingRecordings[]; next_page_token?: string }>(
      "listUserRecordings",
      withQuery(`/users/${encodeURIComponent(hostUserId)}/recordings`, {
        from: day(from),
        to: day(to),
        page_size: 300,
        next_page_token: nextPageToken,
      }),
    );
    meetings.push(...(page.meetings ?? []));
    nextPageToken = page.next_page_token || undefined;
  } while (nextPageToken);
  return meetings;
}

/**
 * Open a cloud-recording file's download_url as a stream, with the OAuth
 * bearer token (Zoom then redirects to its storage). Only Zoom's own HTTPS
 * hosts are fetched. The caller must consume or cancel the body; the URL is
 * never logged or returned.
 */
export async function openRecordingDownload(downloadUrl: string): Promise<Response> {
  let url: URL;
  try {
    url = new URL(downloadUrl);
  } catch {
    throw new ZoomApiError("Zoom downloadRecording failed: the download URL is not valid.", "downloadRecording", 0);
  }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || !["zoom.us", "zoomgov.com"].some((domain) => host === domain || host.endsWith(`.${domain}`)))
    throw new ZoomApiError("Zoom downloadRecording failed: the download URL is not a Zoom URL.", "downloadRecording", 0);
  const response = await zoomFetch(url.toString(), { method: "GET" });
  if (!response.ok) return fail("downloadRecording", response);
  if (!response.body) throw new ZoomApiError("Zoom downloadRecording failed: empty response body.", "downloadRecording", response.status);
  return response;
}

/** All participants of an ended meeting instance (follows pagination). */
export async function getPastMeetingParticipants(meetingUuid: string): Promise<ZoomPastParticipant[]> {
  const participants: ZoomPastParticipant[] = [];
  let nextPageToken: string | undefined;
  do {
    const page = await call<{ participants?: ZoomPastParticipant[]; next_page_token?: string }>(
      "getPastMeetingParticipants",
      withQuery(`/past_meetings/${encodeMeetingIdOrUuid(meetingUuid)}/participants`, {
        page_size: 300,
        next_page_token: nextPageToken,
      }),
    );
    participants.push(...(page.participants ?? []));
    nextPageToken = page.next_page_token || undefined;
  } while (nextPageToken);
  return participants;
}

/** A user on the account, by Zoom user ID or email ("me" is the app's own user). */
export function getUser(userIdOrEmail: string): Promise<ZoomUser> {
  return call("getUser", `/users/${encodeURIComponent(userIdOrEmail)}`);
}
