/**
 * Keyboard layout mappings for alternative keyboard layouts
 * Provides comprehensive character translation from QWERTY to COLEMAK, DVORAK, and WORKMAN
 * 
 * This module enables users with alternative keyboard layouts to type naturally
 * while the application receives the correct characters for their chosen layout.
 */

/** Mapping from QWERTY characters to target layout characters */
export type LayoutMapping = {
  [key: string]: string;
};

// COLEMAK layout mapping (QWERTY physical key -> COLEMAK character)
export const COLEMAK_MAPPING: LayoutMapping = {
  // Top row
  'q': 'q',
  'w': 'w',
  'e': 'f',
  'r': 'p',
  't': 'g',
  'y': 'j',
  'u': 'l',
  'i': 'u',
  'o': 'y',
  'p': ';',
  // Middle row
  'a': 'a',
  's': 'r',
  'd': 's',
  'f': 't',
  'g': 'd',
  'h': 'h',
  'j': 'n',
  'k': 'e',
  'l': 'i',
  ';': 'o',
  // Bottom row
  'z': 'z',
  'x': 'x',
  'c': 'c',
  'v': 'v',
  'b': 'b',
  'n': 'k',
  'm': 'm',
  // Capital letters
  'Q': 'Q',
  'W': 'W',
  'E': 'F',
  'R': 'P',
  'T': 'G',
  'Y': 'J',
  'U': 'L',
  'I': 'U',
  'O': 'Y',
  'P': ':',
  'A': 'A',
  'S': 'R',
  'D': 'S',
  'F': 'T',
  'G': 'D',
  'H': 'H',
  'J': 'N',
  'K': 'E',
  'L': 'I',
  ':': 'O',
  'Z': 'Z',
  'X': 'X',
  'C': 'C',
  'V': 'V',
  'B': 'B',
  'N': 'K',
  'M': 'M',
};

// Reverse mapping for COLEMAK (COLEMAK character -> QWERTY physical key)
export const COLEMAK_REVERSE_MAPPING: LayoutMapping = Object.entries(COLEMAK_MAPPING).reduce(
  (acc, [qwerty, colemak]) => {
    acc[colemak] = qwerty;
    return acc;
  },
  {} as LayoutMapping
);

// DVORAK layout mapping (QWERTY physical key -> DVORAK character)
export const DVORAK_MAPPING: LayoutMapping = {
  // Top row
  'q': "'",
  'w': ',',
  'e': '.',
  'r': 'p',
  't': 'y',
  'y': 'f',
  'u': 'g',
  'i': 'c',
  'o': 'r',
  'p': 'l',
  '[': '/',
  ']': '=',
  // Middle row
  'a': 'a',
  's': 'o',
  'd': 'e',
  'f': 'u',
  'g': 'i',
  'h': 'd',
  'j': 'h',
  'k': 't',
  'l': 'n',
  ';': 's',
  "'": '-',
  // Bottom row
  'z': ';',
  'x': 'q',
  'c': 'j',
  'v': 'k',
  'b': 'x',
  'n': 'b',
  'm': 'm',
  ',': 'w',
  '.': 'v',
  '/': 'z',
  // Capital letters
  'Q': '"',
  'W': '<',
  'E': '>',
  'R': 'P',
  'T': 'Y',
  'Y': 'F',
  'U': 'G',
  'I': 'C',
  'O': 'R',
  'P': 'L',
  'A': 'A',
  'S': 'O',
  'D': 'E',
  'F': 'U',
  'G': 'I',
  'H': 'D',
  'J': 'H',
  'K': 'T',
  'L': 'N',
  ':': 'S',
  '"': '_',
  'Z': ':',
  'X': 'Q',
  'C': 'J',
  'V': 'K',
  'B': 'X',
  'N': 'B',
  'M': 'M',
  '<': 'W',
  '>': 'V',
  '?': 'Z',
};

// WORKMAN layout mapping (QWERTY physical key -> WORKMAN character)
export const WORKMAN_MAPPING: LayoutMapping = {
  // Top row
  'q': 'q',
  'w': 'd',
  'e': 'r',
  'r': 'w',
  't': 'b',
  'y': 'j',
  'u': 'f',
  'i': 'u',
  'o': 'p',
  'p': ';',
  // Middle row
  'a': 'a',
  's': 's',
  'd': 'h',
  'f': 't',
  'g': 'g',
  'h': 'y',
  'j': 'n',
  'k': 'e',
  'l': 'o',
  ';': 'i',
  // Bottom row
  'z': 'z',
  'x': 'x',
  'c': 'm',
  'v': 'c',
  'b': 'v',
  'n': 'k',
  'm': 'l',
  // Capital letters
  'Q': 'Q',
  'W': 'D',
  'E': 'R',
  'R': 'W',
  'T': 'B',
  'Y': 'J',
  'U': 'F',
  'I': 'U',
  'O': 'P',
  'P': ':',
  'A': 'A',
  'S': 'S',
  'D': 'H',
  'F': 'T',
  'G': 'G',
  'H': 'Y',
  'J': 'N',
  'K': 'E',
  'L': 'O',
  ':': 'I',
  'Z': 'Z',
  'X': 'X',
  'C': 'M',
  'V': 'C',
  'B': 'V',
  'N': 'K',
  'M': 'L',
};

export type KeyboardLayoutType = 'qwerty' | 'colemak' | 'dvorak' | 'workman';

/**
 * Get the keyboard layout mapping for a given layout type
 * @param layout - The target keyboard layout
 * @returns Layout mapping object or null for QWERTY
 */
export function getLayoutMapping(layout: KeyboardLayoutType): LayoutMapping | null {
  switch (layout) {
    case 'colemak':
      return COLEMAK_MAPPING;
    case 'dvorak':
      return DVORAK_MAPPING;
    case 'workman':
      return WORKMAN_MAPPING;
    case 'qwerty':
    default:
      return null; // QWERTY doesn't need mapping
  }
}

/**
 * Translate a key from QWERTY to the target layout
 * @param key - The character to translate
 * @param targetLayout - The target keyboard layout
 * @returns Translated character or original if no mapping exists
 */
export function translateKey(key: string, targetLayout: KeyboardLayoutType): string {
  if (targetLayout === 'qwerty') {
    return key;
  }

  const mapping = getLayoutMapping(targetLayout);
  if (!mapping) {
    return key;
  }

  return mapping[key] || key;
}

/**
 * Translate a key from the source layout back to what QWERTY would produce
 * This is used when the OS keyboard layout is set to non-QWERTY but we want QWERTY output
 */
export function translateFromLayoutToQwerty(key: string, sourceLayout: KeyboardLayoutType): string {
  if (sourceLayout === 'qwerty') {
    return key;
  }

  // Create reverse mappings
  const mapping = getLayoutMapping(sourceLayout);
  if (!mapping) {
    return key;
  }

  // Find the QWERTY key that maps to this character
  for (const [qwertyKey, layoutChar] of Object.entries(mapping)) {
    if (layoutChar === key) {
      return qwertyKey;
    }
  }

  return key;
}

/**
 * Translate a key from the source layout to QWERTY
 */
export function translateToQwerty(key: string, sourceLayout: KeyboardLayoutType): string {
  if (sourceLayout === 'qwerty') {
    return key;
  }

  let reverseMapping: LayoutMapping | null = null;
  
  switch (sourceLayout) {
    case 'colemak':
      reverseMapping = COLEMAK_REVERSE_MAPPING;
      break;
    case 'dvorak':
      // Create reverse mapping for DVORAK
      reverseMapping = Object.entries(DVORAK_MAPPING).reduce(
        (acc, [qwerty, dvorak]) => {
          acc[dvorak] = qwerty;
          return acc;
        },
        {} as LayoutMapping
      );
      break;
    case 'workman':
      // Create reverse mapping for WORKMAN
      reverseMapping = Object.entries(WORKMAN_MAPPING).reduce(
        (acc, [qwerty, workman]) => {
          acc[workman] = qwerty;
          return acc;
        },
        {} as LayoutMapping
      );
      break;
  }

  if (!reverseMapping) {
    return key;
  }

  return reverseMapping[key] || key;
}

/**
 * Check if a keyboard event should be translated
 * @param event - The keyboard event to check
 * @returns True if the key should be translated, false for special keys/modifiers
 */
export function shouldTranslateKey(event: KeyboardEvent): boolean {
  // Don't translate if any modifier keys are pressed
  if (event.ctrlKey || event.metaKey || event.altKey) {
    return false;
  }

  // Don't translate special keys
  const specialKeys = [
    'Enter', 'Tab', 'Escape', 'Backspace', 'Delete',
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
    'Home', 'End', 'PageUp', 'PageDown',
    'F1', 'F2', 'F3', 'F4', 'F5', 'F6',
    'F7', 'F8', 'F9', 'F10', 'F11', 'F12',
    'Shift', 'Control', 'Alt', 'Meta',
    'CapsLock', 'NumLock', 'ScrollLock'
  ];

  if (specialKeys.includes(event.key)) {
    return false;
  }

  // Only translate single character keys
  return event.key.length === 1;
}