import React from "react";
import { Terminal, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Props interface for the BashWidget component
 */
interface BashWidgetProps {
  /** The bash command to display */
  command: string;
  /** Optional description of what the command does */
  description?: string;
  /** Result object containing command output and status */
  result?: unknown;
}

/**
 * BashWidget component for displaying bash commands and their results
 *
 * A terminal-styled widget that shows bash commands with optional descriptions
 * and results. Supports both success and error states with appropriate styling.
 *
 * @param command - The bash command to display
 * @param description - Optional description of the command
 * @param result - Result object with content and error status
 *
 * @example
 * ```tsx
 * <BashWidget
 *   command="ls -la"
 *   description="List directory contents"
 *   result={{ content: "file1.txt\nfile2.txt", is_error: false }}
 * />
 *
 * <BashWidget
 *   command="npm install"
 *   description="Installing dependencies"
 * />
 * ```
 */
export const BashWidget: React.FC<BashWidgetProps> = ({
  command,
  description,
  result,
}): React.ReactElement => {
  // Extract result content if available
  let resultContent = "";
  let isError = false;

  if (result) {
    const resultObj = result as { is_error?: boolean; content?: unknown };
    isError = resultObj.is_error || false;
    if (typeof resultObj.content === "string") {
      resultContent = resultObj.content;
    } else if (resultObj.content && typeof resultObj.content === "object") {
      const contentObj = resultObj.content as { text?: string } | unknown[];
      if ("text" in contentObj && typeof contentObj.text === "string") {
        resultContent = contentObj.text;
      } else if (Array.isArray(contentObj)) {
        resultContent = contentObj
          .map((c: unknown) =>
            typeof c === "string" ? c : (c as Record<string, unknown>).text || JSON.stringify(c)
          )
          .join("\n");
      } else {
        resultContent = JSON.stringify(resultObj.content, null, 2);
      }
    }
  }

  return (
    <div className="rounded-lg border bg-zinc-950 overflow-hidden">
      <div className="px-4 py-2 bg-zinc-900/50 flex items-center gap-2 border-b">
        <Terminal className="h-3.5 w-3.5 text-green-500" />
        <span className="text-xs font-mono text-muted-foreground">Terminal</span>
        {description && (
          <>
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{description}</span>
          </>
        )}
        {/* Show loading indicator when no result yet */}
        {!result && (
          <div className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
            <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
            <span>Running...</span>
          </div>
        )}
      </div>
      <div className="p-4 space-y-3">
        <code className="text-xs font-mono text-green-400 block">$ {command}</code>

        {/* Show result if available */}
        {
          (result && (
            <div
              className={cn(
                "mt-3 p-3 rounded-md border text-xs font-mono whitespace-pre-wrap overflow-x-auto",
                isError
                  ? "border-red-500/20 bg-red-500/5 text-red-400"
                  : "border-green-500/20 bg-green-500/5 text-green-300"
              )}
            >
              {resultContent || (isError ? "Command failed" : "Command completed")}
            </div>
          )) as React.ReactNode
        }
      </div>
    </div>
  );
};
