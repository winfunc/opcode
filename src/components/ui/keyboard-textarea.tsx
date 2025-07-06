import * as React from "react"
import { cn } from "@/lib/utils"
import { useKeyboardLayoutInput } from "@/hooks/useKeyboardLayoutInput"

/** Props for KeyboardTextarea component */
export interface KeyboardTextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Optional callback for value changes */
  onValueChange?: (value: string) => void;
}

/**
 * Textarea component with automatic keyboard layout translation
 * Supports COLEMAK, DVORAK, and WORKMAN layouts with real-time character conversion
 */
const KeyboardTextarea = React.forwardRef<HTMLTextAreaElement, KeyboardTextareaProps>(
  ({ className, onChange, onValueChange, onKeyDown, ...props }, ref) => {
    const {
      currentLayout,
      handleInput,
      handleBeforeInput,
      handleCompositionStart,
      handleCompositionEnd,
    } = useKeyboardLayoutInput();
    
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);

    React.useImperativeHandle(ref, () => textareaRef.current!);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      
      if (onChange) {
        onChange(e);
      }
      if (onValueChange) {
        onValueChange(newValue);
      }
    };

    const handleInputEvent = (e: React.FormEvent<HTMLTextAreaElement>) => {
      handleInput(e, (value) => {
        if (onValueChange) {
          onValueChange(value);
        }
        // Also create a synthetic change event
        if (onChange) {
          const syntheticEvent = {
            ...e,
            target: { ...e.target, value },
          } as React.ChangeEvent<HTMLTextAreaElement>;
          onChange(syntheticEvent);
        }
      });
    };

    // Add keyboard layout attribute for debugging
    React.useEffect(() => {
      if (textareaRef.current) {
        textareaRef.current.setAttribute('data-keyboard-layout', currentLayout);
      }
    }, [currentLayout]);

    return (
      <textarea
        className={cn(
          "flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={textareaRef}
        onChange={handleChange}
        onInput={handleInputEvent}
        onBeforeInput={handleBeforeInput}
        onKeyDown={onKeyDown}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        {...props}
      />
    )
  }
)
KeyboardTextarea.displayName = "KeyboardTextarea"

export { KeyboardTextarea }