/**
 * Output cache hook separated to avoid fast refresh warnings
 */
import { useContext } from "react";
import { OutputCacheContextType, createOutputCacheError } from "./outputCacheUtils";

import React from "react";

const OutputCacheContext = React.createContext<OutputCacheContextType | null>(null);

export function useOutputCache() {
  const context = useContext(OutputCacheContext);
  if (!context) {
    throw createOutputCacheError("useOutputCache");
  }
  return context;
}

export { OutputCacheContext };
