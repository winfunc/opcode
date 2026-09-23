import { useCallback, useRef } from "react";
import {
  isImeComposingKeydown,
  createCompositionHandlers,
  type IMECompositionRefs,
} from "../utils/ime";

/**
 * Custom hook for IME-safe Enter key submission
 *
 * Solves the common problem in chat interfaces where pressing Enter
 * to confirm IME conversion (e.g., Japanese kanji selection) triggers
 * unintended message submission.
 *
 * ## Problem
 * When typing Japanese/Chinese/Korean with IME:
 * 1. First Enter confirms the character conversion (e.g., hiragana → kanji)
 * 2. Second Enter should send the message
 * Without proper handling, both Enter presses send the message.
 *
 * ## Solution
 * This hook combines multiple detection methods to reliably identify
 * IME composition state across different browsers and WebViews:
 * - isComposing property (React and native)
 * - compositionstart/compositionend event tracking
 * - keyCode 229 fallback for Safari/WKWebView
 *
 * ## Usage
 * ```tsx
 * const ime = useIMESafeEnterSubmit(handleSend);
 *
 * <textarea
 *   {...ime}
 *   value={text}
 *   onChange={handleChange}
 * />
 * ```
 *
 * ## Combining with other keydown handlers
 * ```tsx
 * const ime = useIMESafeEnterSubmit(handleSend);
 *
 * const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
 *   ime.onKeyDown(e);
 *   if (e.defaultPrevented) return;
 *   // Other shortcut handling...
 * };
 * ```
 *
 * @param onSubmit - Callback to execute when Enter is pressed (non-IME)
 * @returns Event handlers to spread onto the input element
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/keydown_event
 * @see https://www.stum.de/2016/06/24/handling-ime-events-in-javascript/
 */

type InputElement = HTMLInputElement | HTMLTextAreaElement;

type IMEHandlers<T extends InputElement> = {
  onCompositionStart: React.CompositionEventHandler<T>;
  onCompositionEnd: React.CompositionEventHandler<T>;
  onKeyDown: React.KeyboardEventHandler<T>;
  onBlur: React.FocusEventHandler<T>;
};

export function useIMESafeEnterSubmit<T extends InputElement = HTMLTextAreaElement>(
  onSubmit: () => void
): IMEHandlers<T> {
  const isComposingRef = useRef(false);
  const justEndedRef = useRef(false);

  const refs: IMECompositionRefs = { isComposingRef, justEndedRef };
  const compositionHandlers = createCompositionHandlers(refs);

  const onCompositionStart = useCallback(
    compositionHandlers.onCompositionStart,
    []
  );

  const onCompositionEnd = useCallback(
    compositionHandlers.onCompositionEnd,
    []
  );

  const onBlur = useCallback(
    compositionHandlers.onBlur,
    []
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<T>) => {
      // Reset justEnded flag on non-Enter keys
      if (justEndedRef.current && e.key !== "Enter") {
        justEndedRef.current = false;
      }

      // Shift+Enter = newline, not submit
      if (e.key !== "Enter" || e.shiftKey) return;

      const composing = isImeComposingKeydown(e, isComposingRef);

      if (composing || justEndedRef.current) {
        // Skip this Enter (IME conversion confirmation)
        justEndedRef.current = false;
        return;
      }

      // Normal Enter = submit
      e.preventDefault();
      onSubmit();
    },
    [onSubmit]
  );

  return { onCompositionStart, onCompositionEnd, onKeyDown, onBlur };
}

/**
 * Re-export utility functions for use in components with custom keydown handlers
 */
export {
  isImeComposingKeydown,
  shouldSkipEnterForIME,
  createCompositionHandlers,
  LEGACY_IME_KEYCODE,
  type IMECompositionRefs,
} from "../utils/ime";
