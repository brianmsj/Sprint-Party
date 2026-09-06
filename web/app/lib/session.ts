/**
 * SprintParty session threading.
 *
 * The ServiceNow-first flow creates the room up front (on `/create`) and then
 * carries that room's identity through story selection and the Planning Queue so
 * the picked stories start in the *same* room — no second room is created.
 *
 * The room slug travels as a `?room=<slug>` query param. These helpers are
 * client-only (they read `window.location`); every page that uses them already
 * gates on a mounted check, matching the existing localStorage-store pattern.
 */

export const ROOM_QUERY_PARAM = "room";

/** localStorage key that remembers the last host name, to prefill it. */
export const HOST_NAME_KEY = "sprintparty:hostName";

/** Best-effort persist of the host name for prefilling later screens. */
export function rememberHostName(name: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(HOST_NAME_KEY, name.trim());
  } catch {
    // Non-fatal — just means we can't prefill next time.
  }
}

/** Read the remembered host name, or `""`. */
export function readStoredHostName(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(HOST_NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

/** Read the current session's room slug from the URL, or `null` if absent. */
export function readRoomParam(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const value = new URLSearchParams(window.location.search).get(
      ROOM_QUERY_PARAM,
    );
    return value && value.trim() ? value.trim() : null;
  } catch {
    return null;
  }
}

/** Append `?room=<slug>` to a path when a session room is known. */
export function withRoomParam(path: string, slug: string | null): string {
  if (!slug) return path;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}${ROOM_QUERY_PARAM}=${encodeURIComponent(slug)}`;
}
