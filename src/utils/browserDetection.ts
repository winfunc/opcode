/**
 * Browser Detection Utilities for Claudia
 * Detects browser compatibility for Playwright MCP functionality
 */

interface BrowserInfo {
  name: string;
  isChromium: boolean;
  isSupported: boolean;
  version?: string;
}

/**
 * Detects the current browser and returns compatibility information
 */
export function detectBrowser(): BrowserInfo {
  const userAgent = navigator.userAgent;
  
  // Chromium detection (ONLY supported browser)
  // Check for Chromium first, before Chrome detection
  if (userAgent.includes('Chromium')) {
    return {
      name: 'Chromium',
      isChromium: true,
      isSupported: true,
      version: getVersion(userAgent, 'Chromium/')
    };
  }
  
  // Chrome detection (NOT supported - may cause conflicts)  
  // Only detect Chrome if it's NOT Chromium
  if (userAgent.includes('Chrome') && !userAgent.includes('Chromium') && !userAgent.includes('Edg')) {
    return {
      name: 'Google Chrome',
      isChromium: true,
      isSupported: false,
      version: getVersion(userAgent, 'Chrome/')
    };
  }
  
  // Edge detection (NOT supported)
  if (userAgent.includes('Edg')) {
    return {
      name: 'Microsoft Edge',
      isChromium: true,
      isSupported: false,
      version: getVersion(userAgent, 'Edg/')
    };
  }
  
  // Brave detection (NOT supported)
  if (userAgent.includes('Chrome') && (window as any).navigator?.brave) {
    return {
      name: 'Brave Browser',
      isChromium: true,
      isSupported: false,
      version: getVersion(userAgent, 'Chrome/')
    };
  }
  
  // Safari detection
  if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
    return {
      name: 'Safari',
      isChromium: false,
      isSupported: false,
      version: getVersion(userAgent, 'Version/')
    };
  }
  
  // Firefox detection
  if (userAgent.includes('Firefox')) {
    return {
      name: 'Firefox',
      isChromium: false,
      isSupported: false,
      version: getVersion(userAgent, 'Firefox/')
    };
  }
  
  // Fallback for unknown browsers
  return {
    name: 'Unknown Browser',
    isChromium: false,
    isSupported: false
  };
}

/**
 * Extracts version number from user agent string
 */
function getVersion(userAgent: string, versionPrefix: string): string | undefined {
  const index = userAgent.indexOf(versionPrefix);
  if (index === -1) return undefined;
  
  const versionStart = index + versionPrefix.length;
  const versionEnd = userAgent.indexOf(' ', versionStart);
  const versionString = userAgent.substring(versionStart, versionEnd === -1 ? undefined : versionEnd);
  
  return versionString.split('.')[0]; // Return major version only
}

/**
 * Checks if the current browser supports Playwright MCP functionality
 */
export function isPlaywrightMCPSupported(): boolean {
  const browser = detectBrowser();
  return browser.isSupported;
}

/**
 * Gets a user-friendly message about browser compatibility
 */
export function getBrowserCompatibilityMessage(): {
  isSupported: boolean;
  message: string;
  recommendedAction?: string;
} {
  const browser = detectBrowser();
  
  if (browser.isSupported) {
    return {
      isSupported: true,
      message: `✅ ${browser.name} is fully supported for all Claudia features including Playwright MCP.`
    };
  }
  
  return {
    isSupported: false,
    message: `⚠️ ${browser.name} has limited functionality. Playwright MCP and browser automation features will not work.`,
    recommendedAction: 'Please switch to Chromium browser for full functionality.'
  };
}

/**
 * Gets the list of supported browsers
 */
export function getSupportedBrowsers(): string[] {
  return [
    'Chromium (유일한 지원 브라우저)'
  ];
}

/**
 * Gets the list of unsupported browsers
 */
export function getUnsupportedBrowsers(): string[] {
  return [
    'Safari',
    'Firefox',
    'Internet Explorer',
    'Opera (non-Chromium)',
    'Other WebKit/Gecko browsers'
  ];
}