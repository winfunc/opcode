/**
 * URL Detection utility for terminal output
 * Detects various URL formats including localhost addresses
 */

import React from 'react';

// URL regex pattern that matches:
// - http:// and https:// URLs
// - localhost URLs with ports
// - IP addresses with ports
// - URLs with paths and query parameters
const URL_REGEX = /(?:https?:\/\/)?(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[[0-9a-fA-F:]+\]|(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,})(?::[0-9]+)?(?:\/[^\s]*)?/gi;

// More specific localhost pattern for better accuracy
const LOCALHOST_REGEX = /(?:https?:\/\/)?(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(?::[0-9]+)?(?:\/[^\s]*)?/gi;

export interface DetectedLink {
  url: string;
  fullUrl: string; // URL with protocol
  isLocalhost: boolean;
  startIndex: number;
  endIndex: number;
}

/**
 * Detects URLs in the given text
 * @param text - The text to search for URLs
 * @returns Array of detected links
 */
export function detectLinks(text: string): DetectedLink[] {
  const links: DetectedLink[] = [];
  const seenUrls = new Set<string>();
  
  // Reset regex lastIndex
  URL_REGEX.lastIndex = 0;
  
  let match;
  while ((match = URL_REGEX.exec(text)) !== null) {
    const url = match[0];
    
    // Skip if we've already seen this URL
    if (seenUrls.has(url)) continue;
    seenUrls.add(url);
    
    // Ensure the URL has a protocol
    let fullUrl = url;
    if (!url.match(/^https?:\/\//)) {
      // Default to http for localhost, https for others
      const isLocalhost = LOCALHOST_REGEX.test(url);
      fullUrl = `${isLocalhost ? 'http' : 'https'}://${url}`;
    }
    
    // Validate the URL
    try {
      new URL(fullUrl);
    } catch {
      // Invalid URL, skip
      continue;
    }
    
    links.push({
      url,
      fullUrl,
      isLocalhost: LOCALHOST_REGEX.test(url),
      startIndex: match.index,
      endIndex: match.index + url.length
    });
  }
  
  return links;
}

/**
 * Checks if a text contains any URLs
 * @param text - The text to check
 * @returns True if URLs are found
 */
export function hasLinks(text: string): boolean {
  URL_REGEX.lastIndex = 0;
  return URL_REGEX.test(text);
}

/**
 * Extracts the first URL from text
 * @param text - The text to search
 * @returns The first detected link or null
 */
export function getFirstLink(text: string): DetectedLink | null {
  const links = detectLinks(text);
  return links.length > 0 ? links[0] : null;
}

/**
 * Makes URLs in text clickable by wrapping them in a callback
 * @param text - The text containing URLs
 * @param onLinkClick - Callback when a link is clicked
 * @returns React elements with clickable links
 */
export function makeLinksClickable(
  text: string,
  onLinkClick: (url: string) => void
): React.ReactNode[] {
  const links = detectLinks(text);
  
  if (links.length === 0) {
    return [text];
  }
  
  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  
  links.forEach((link, index) => {
    // Add text before the link
    if (link.startIndex > lastIndex) {
      elements.push(text.substring(lastIndex, link.startIndex));
    }
    
    // Add the clickable link
    elements.push(
      <a
        key={`link-${index}`}
        href={link.fullUrl}
        onClick={(e) => {
          e.preventDefault();
          onLinkClick(link.fullUrl);
        }}
        className="text-primary underline hover:text-primary/80 cursor-pointer"
        title={link.fullUrl}
      >
        {link.url}
      </a>
    );
    
    lastIndex = link.endIndex;
  });
  
  // Add remaining text
  if (lastIndex < text.length) {
    elements.push(text.substring(lastIndex));
  }
  
  return elements;
} 