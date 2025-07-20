/**
 * Output cache hook separated to avoid fast refresh warnings
 */
import { useContext } from "react";
import { OutputCacheContextType, createOutputCacheError } from "./outputCacheUtils";

import React from "react";

/**
 * React context for output cache functionality
 *
 * Provides access to cached session outputs and cache management functions
 * throughout the component tree.
 */
const OutputCacheContext = React.createContext<OutputCacheContextType | null>(null);

/**
 * Hook for accessing output cache functionality
 *
 * Provides access to cached session outputs and cache management functions.
 * Must be used within an OutputCacheProvider component.
 *
 * @returns Output cache context with caching functions
 * @throws Error if used outside OutputCacheProvider
 *
 * @example
 * ```tsx
 * function SessionViewer({ sessionId }: { sessionId: number }) {
 *   const { getCachedOutput, setCachedOutput, clearCache } = useOutputCache();
 *
 *   const cachedData = getCachedOutput(sessionId);
 *
 *   return (
 *     <div>
 *       {cachedData ? (
 *         <div>Cached output: {cachedData.output}</div>
 *       ) : (
 *         <div>No cached data</div>
 *       )}
 *       <button onClick={() => clearCache(sessionId)}>
 *         Clear Cache
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useOutputCache() {
  const context = useContext(OutputCacheContext);
  if (!context) {
    throw createOutputCacheError("useOutputCache");
  }
  return context;
}

export { OutputCacheContext };
