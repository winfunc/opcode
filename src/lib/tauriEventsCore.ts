/**
 * Environment-independent core of the event listener used by the UI.
 *
 * Kept free of runtime imports so the selection logic can be exercised
 * without a Tauri runtime or a bundler. The bound instance lives in
 * `tauriEvents.ts`.
 */

/** Event passed to listeners; matches the `payload` part of Tauri's `Event<T>`. */
export interface AppEvent<T> {
  payload: T;
}

/** Callback invoked for each received event. */
export type AppEventHandler<T> = (event: AppEvent<T>) => void;

/** Function that stops listening. */
export type UnlistenFn = () => void;

/** Signature shared by Tauri's `listen` and the web fallback. */
export type ListenFn = <T = unknown>(
  eventName: string,
  handler: AppEventHandler<T>
) => Promise<UnlistenFn>;

/** Dependencies of {@link createListen}. */
export interface ListenDeps {
  /** Returns true when running inside the Tauri desktop runtime. Called on every `listen`. */
  isTauri: () => boolean;
  /** Tauri's `listen` from `@tauri-apps/api/event`. */
  tauriListen: (eventName: string, handler: AppEventHandler<any>) => Promise<UnlistenFn>;
  /** Target that receives `CustomEvent`s in web mode (normally `window`). */
  target: EventTarget;
}

/**
 * Creates a `listen` function that uses Tauri's event system in the desktop
 * app and falls back to DOM `CustomEvent`s (dispatched by the web-mode API
 * adapter) in the browser.
 *
 * The environment is checked when `listen` is called, not when the module is
 * loaded, so web-mode initialisation order cannot flip the decision.
 *
 * @param deps - Environment check, Tauri listener and DOM event target
 */
export function createListen(deps: ListenDeps): ListenFn {
  return <T = unknown>(eventName: string, handler: AppEventHandler<T>): Promise<UnlistenFn> => {
    if (deps.isTauri()) {
      return deps.tauriListen(eventName, handler as AppEventHandler<any>);
    }

    const domHandler = (event: Event) => {
      handler({ payload: (event as CustomEvent<T>).detail });
    };
    deps.target.addEventListener(eventName, domHandler);
    return Promise.resolve(() => deps.target.removeEventListener(eventName, domHandler));
  };
}
