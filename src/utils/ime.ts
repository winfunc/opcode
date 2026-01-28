/**
 * IME (Input Method Editor) utilities for handling East Asian language input
 *
 * These utilities solve the common problem where pressing Enter to confirm
 * IME conversion triggers unintended form submissions in chat-like interfaces.
 *
 * ## Supported Languages
 * This implementation is language-agnostic and works with any IME that uses
 * composition events, including but not limited to:
 * - Japanese (Hiragana/Katakana/Kanji conversion)
 * - Chinese (Pinyin, Wubi, Zhuyin, Cangjie, etc.)
 * - Korean (Hangul)
 * - Vietnamese (Telex, VNI, etc.)
 * - Other languages using IME composition
 *
 * ## Detection Strategy
 * The implementation uses multiple detection methods for cross-browser compatibility:
 * 1. `isComposing` property (React and native) - Primary method
 * 2. `compositionstart/compositionend` event tracking - Manual fallback
 * 3. `keyCode === 229` - Legacy fallback for Safari/WKWebView edge cases
 *
 * The strategy prioritizes isComposing and composition events as the main
 * detection methods, with keyCode 229 serving only as an additional fallback.
 *
 * ## Browser Compatibility Notes
 * - Safari/WKWebView: May fire events in different order than spec
 * - Firefox: Fires keydown/keyup during IME composition
 * - Chrome: Generally follows UI Events specification
 * - All browsers: keyCode 229 is expected but not guaranteed during IME
 *
 * ## References
 * - MDN keydown event: https://developer.mozilla.org/en-US/docs/Web/API/Element/keydown_event
 * - UI Events spec: https://www.w3.org/TR/uievents/
 * - WebKit bug: https://bugs.webkit.org/show_bug.cgi?id=165004
 * - stum.de IME handling: https://www.stum.de/2016/06/24/handling-ime-events-in-javascript/
 */

/**
 * Legacy keyCode value indicating IME processing
 *
 * When IME is active, keydown events typically return keyCode 229 instead
 * of the actual key code. This is a deprecated but practically useful
 * fallback for detecting IME composition, especially in Safari/WKWebView
 * where isComposing may be false on the Enter key event.
 *
 * IMPORTANT: This value is NOT guaranteed across all IMEs and browsers.
 * It should be used only as a fallback, not as the primary detection method.
 * The main detection should rely on isComposing and composition events.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/keyCode
 * @see https://www.w3.org/TR/uievents/#determine-keydown-keyup-keyCode
 */
export const LEGACY_IME_KEYCODE = 229;

/**
 * IME composition state refs type
 */
export type IMECompositionRefs = {
  /** Tracks whether we're between compositionstart and compositionend */
  isComposingRef: React.MutableRefObject<boolean>;
  /** Tracks if composition just ended (for one-shot Enter skip) */
  justEndedRef: React.MutableRefObject<boolean>;
};

/**
 * Determines if a keydown event is part of IME composition
 *
 * Uses multiple detection methods to handle browser inconsistencies:
 * 1. e.isComposing - React synthetic event property (primary)
 * 2. native.isComposing - Native KeyboardEvent property (primary)
 * 3. isComposingRef - Manual tracking via compositionstart/compositionend (fallback)
 * 4. keyCode === 229 - Legacy fallback for Safari/WKWebView edge cases
 *
 * This function is language-agnostic and works with any IME that uses
 * composition events (Japanese, Chinese, Korean, Vietnamese, etc.)
 *
 * @param e - The React keyboard event
 * @param isComposingRef - Ref tracking compositionstart/compositionend state
 * @returns true if the event is part of IME composition
 */
export function isImeComposingKeydown(
  e: React.KeyboardEvent,
  isComposingRef: React.MutableRefObject<boolean>
): boolean {
  const native = e.nativeEvent as KeyboardEvent;

  // Primary detection: isComposing property (most reliable when available)
  // Note: React's KeyboardEvent type doesn't include isComposing, but it exists at runtime
  const reactIsComposing = (e as unknown as { isComposing?: boolean }).isComposing;
  if (reactIsComposing || native.isComposing) {
    return true;
  }

  // Secondary detection: manual composition tracking
  if (isComposingRef.current) {
    return true;
  }

  // Tertiary detection: legacy keyCode fallback for Safari/WKWebView
  // Note: keyCode is deprecated and may be 0 or undefined in some cases
  const keyCode = typeof native.keyCode === "number" ? native.keyCode : 0;
  if (keyCode === LEGACY_IME_KEYCODE) {
    return true;
  }

  return false;
}

/**
 * Creates composition event handlers for IME state tracking
 *
 * These handlers maintain the isComposingRef and justEndedRef state
 * that is used by isImeComposingKeydown for fallback detection.
 *
 * @param refs - The IME composition state refs
 * @returns Event handlers for compositionstart, compositionend, and blur
 */
export function createCompositionHandlers(refs: IMECompositionRefs) {
  const { isComposingRef, justEndedRef } = refs;

  return {
    onCompositionStart: () => {
      isComposingRef.current = true;
      justEndedRef.current = false;
    },
    onCompositionEnd: () => {
      isComposingRef.current = false;
      // Set flag to skip the next Enter (one-shot)
      justEndedRef.current = true;
    },
    onBlur: () => {
      // Reset flags on focus loss to prevent stale state
      // This handles cases where IME is interrupted (e.g., user clicks away)
      isComposingRef.current = false;
      justEndedRef.current = false;
    },
  };
}

/**
 * Processes keydown event for IME-safe Enter handling
 *
 * Call this at the beginning of your keydown handler to:
 * 1. Reset justEndedRef on non-Enter keys
 * 2. Determine if the current Enter should be skipped
 *
 * This function is language-agnostic and works with any IME.
 *
 * @param e - The React keyboard event
 * @param refs - The IME composition state refs
 * @returns true if the Enter key should be skipped (IME operation)
 */
export function shouldSkipEnterForIME(
  e: React.KeyboardEvent,
  refs: IMECompositionRefs
): boolean {
  const { isComposingRef, justEndedRef } = refs;

  // Reset justEnded flag on non-Enter keys
  // This ensures the flag only affects the immediate Enter after composition
  if (justEndedRef.current && e.key !== "Enter") {
    justEndedRef.current = false;
  }

  if (e.key !== "Enter") {
    return false;
  }

  const composing = isImeComposingKeydown(e, isComposingRef);

  if (composing || justEndedRef.current) {
    // Skip this Enter and reset the one-shot flag
    justEndedRef.current = false;
    return true;
  }

  return false;
}
