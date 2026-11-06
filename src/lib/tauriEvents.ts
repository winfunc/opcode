/**
 * Event listener for backend events (`claude-output`, `claude-complete`, ...).
 *
 * Use this instead of importing `listen` from `@tauri-apps/api/event`
 * directly: it also works in web mode, where the API adapter delivers the same
 * events as DOM `CustomEvent`s.
 */
import { listen as tauriListen } from "@tauri-apps/api/event";
import { isTauriRuntime } from "./apiAdapter";
import { createListen } from "./tauriEventsCore";

export type { AppEvent, AppEventHandler, UnlistenFn } from "./tauriEventsCore";

/**
 * Listens for a backend event.
 *
 * @param eventName - Event name, e.g. `claude-output:<sessionId>`
 * @param handler - Called with `{ payload }` for every event
 * @returns A function that stops listening
 */
export const listen = createListen({
  isTauri: isTauriRuntime,
  tauriListen,
  target: window,
});
