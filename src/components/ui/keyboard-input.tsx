import * as React from "react"
import { cn } from "@/lib/utils"
import { useKeyboardLayoutInput } from "@/hooks/useKeyboardLayoutInput"

export interface KeyboardInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  onValueChange?: (value: string) => void;
}

/**
 * Input component with keyboard layout support
 */
const KeyboardInput = React.forwardRef<HTMLInputElement, KeyboardInputProps>(
  ({ className, type, onChange, onValueChange, onKeyDown, ...props }, ref) => {
    const {
      currentLayout,
      handleInput,
      handleBeforeInput,
      handleCompositionStart,
      handleCompositionEnd,
    } = useKeyboardLayoutInput();
    
    const inputRef = React.useRef<HTMLInputElement>(null);

    React.useImperativeHandle(ref, () => inputRef.current!);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      
      if (onChange) {
        onChange(e);
      }
      if (onValueChange) {
        onValueChange(newValue);
      }
    };

    const handleInputEvent = (e: React.FormEvent<HTMLInputElement>) => {
      handleInput(e, (value) => {
        if (onValueChange) {
          onValueChange(value);
        }
        // Also create a synthetic change event
        if (onChange) {
          const syntheticEvent = {
            ...e,
            target: { ...e.target, value },
          } as React.ChangeEvent<HTMLInputElement>;
          onChange(syntheticEvent);
        }
      });
    };

    // Add keyboard layout attribute for debugging
    React.useEffect(() => {
      if (inputRef.current) {
        inputRef.current.setAttribute('data-keyboard-layout', currentLayout);
      }
    }, [currentLayout]);

    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={inputRef}
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
KeyboardInput.displayName = "KeyboardInput"

export { KeyboardInput }