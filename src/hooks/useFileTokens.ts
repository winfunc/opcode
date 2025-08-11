import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

export function useFileTokens() {
  const [tokenCache, setTokenCache] = useState<Map<string, number>>(new Map());

  const calculateTokens = useCallback(async (filePath: string): Promise<number | null> => {
    if (tokenCache.has(filePath)) {
      return tokenCache.get(filePath) || null;
    }

    try {
      const tokens = await invoke<number | null>("calculate_file_tokens", {
        filePath,
      });
      if (tokens !== null) {
        setTokenCache((prev) => new Map(prev).set(filePath, tokens));
      }
      return tokens;
    } catch {
      return null;
    }
  }, [tokenCache]);

  return { calculateTokens };
}