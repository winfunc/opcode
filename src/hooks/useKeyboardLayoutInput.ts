import { useCallback, useRef } from 'react';
import { usePreferences } from '@/contexts/PreferencesContext';
import { translateKey, shouldTranslateKey, type KeyboardLayoutType } from '@/lib/keyboardLayouts';

/**
 * Hook to handle keyboard layout input translation for non-QWERTY layouts
 * Intercepts input events and translates characters from QWERTY to target layout in real-time
 * 
 * @returns Object with keyboard layout utilities and event handlers
 * @example
 * ```tsx
 * const { currentLayout, handleInput, handleBeforeInput } = useKeyboardLayoutInput();
 * 
 * <textarea
 *   onInput={handleInput}
 *   onBeforeInput={handleBeforeInput}
 * />
 * ```
 */
export function useKeyboardLayoutInput() {
  const { preferences } = usePreferences();
  const currentLayout = preferences.keyboardLayout as KeyboardLayoutType;
  const isComposingRef = useRef(false);

  /**
   * Handle input events with keyboard layout translation
   */
  const handleInput = useCallback(
    (
      event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>,
      onChange: (value: string) => void
    ) => {
      const target = event.target as HTMLInputElement | HTMLTextAreaElement;
      let value = target.value;

      // Only translate if we're not using QWERTY and not composing (IME)
      if (currentLayout !== 'qwerty' && !isComposingRef.current) {
        // Get the last character that was just typed
        const lastChar = value.slice(-1);
        
        if (lastChar && shouldTranslateKey({ key: lastChar } as KeyboardEvent)) {
          // Translate the last character from QWERTY to the target layout
          const translatedChar = translateKey(lastChar, currentLayout);
          
          if (translatedChar !== lastChar) {
            // Replace the last character with the translated one
            value = value.slice(0, -1) + translatedChar;
            
            // Update the input value directly
            target.value = value;
            
            // Set the cursor position to the end
            const cursorPos = value.length;
            setTimeout(() => {
              target.setSelectionRange(cursorPos, cursorPos);
            }, 0);
          }
        }
      }

      onChange(value);
    },
    [currentLayout]
  );

  /**
   * Handle beforeinput events to catch characters before they're inserted
   */
  const handleBeforeInput = useCallback(
    (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const inputEvent = event.nativeEvent as InputEvent;
      
      // Only handle insertText events
      if (inputEvent.inputType !== 'insertText' || !inputEvent.data) {
        return;
      }

      // Only translate if we're not using QWERTY and not composing
      if (currentLayout !== 'qwerty' && !isComposingRef.current) {
        const char = inputEvent.data;
        
        if (shouldTranslateKey({ key: char } as KeyboardEvent)) {
          const translatedChar = translateKey(char, currentLayout);
          
          if (translatedChar !== char) {
            // Prevent the original character from being inserted
            event.preventDefault();
            
            // Insert the translated character manually
            const target = event.target as HTMLInputElement | HTMLTextAreaElement;
            const start = target.selectionStart || 0;
            const end = target.selectionEnd || 0;
            const currentValue = target.value;
            
            const newValue = currentValue.slice(0, start) + translatedChar + currentValue.slice(end);
            target.value = newValue;
            
            // Set cursor position after the inserted character
            const newCursorPos = start + translatedChar.length;
            target.setSelectionRange(newCursorPos, newCursorPos);
            
            // Trigger a synthetic input event
            const syntheticEvent = new Event('input', { bubbles: true });
            target.dispatchEvent(syntheticEvent);
          }
        }
      }
    },
    [currentLayout]
  );

  /**
   * Handle composition events (for IME support)
   */
  const handleCompositionStart = useCallback(() => {
    isComposingRef.current = true;
  }, []);

  const handleCompositionEnd = useCallback(() => {
    isComposingRef.current = false;
  }, []);

  return {
    currentLayout,
    handleInput,
    handleBeforeInput,
    handleCompositionStart,
    handleCompositionEnd,
  };
}