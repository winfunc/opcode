import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Clock, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { type ClaudeModel } from "@/types/models";

/**
 * Interface for queued prompt items
 */
interface QueuedPrompt {
  id: string;
  prompt: string;
  model: ClaudeModel;
}

/**
 * Props interface for the PromptQueue component
 */
interface PromptQueueProps {
  queuedPrompts: QueuedPrompt[];
  onRemove: (id: string) => void;
  className?: string;
}

/**
 * PromptQueue component for displaying queued prompts
 *
 * Shows a list of prompts waiting to be processed with model indicators,
 * removal controls, and smooth animations. Automatically hides when empty
 * and provides visual feedback for different Claude models.
 *
 * @param queuedPrompts - Array of prompts waiting to be processed
 * @param onRemove - Callback to remove a prompt from the queue
 * @param className - Optional CSS classes for styling
 *
 * @example
 * ```tsx
 * <PromptQueue
 *   queuedPrompts={pendingPrompts}
 *   onRemove={(id) => removeFromQueue(id)}
 *   className="border-t"
 * />
 * ```
 */
export const PromptQueue: React.FC<PromptQueueProps> = React.memo(
  ({ queuedPrompts, onRemove, className }) => {
    if (queuedPrompts.length === 0) return null;

    return (
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: "auto" }}
        exit={{ opacity: 0, height: 0 }}
        className={cn("border-t bg-muted/20", className)}
      >
        <div className="px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Queued Prompts</span>
            <Badge variant="secondary" className="text-xs">
              {queuedPrompts.length}
            </Badge>
          </div>

          <div className="space-y-2 max-h-32 overflow-y-auto">
            <AnimatePresence mode="popLayout">
              {queuedPrompts.map((queuedPrompt, index) => (
                <motion.div
                  key={queuedPrompt.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-start gap-2 p-2 rounded-md bg-background/50"
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {(() => {
                      switch (queuedPrompt.model) {
                        case "opus":
                          return <Sparkles className="h-3.5 w-3.5 text-purple-500" />;
                        case "haiku":
                          return <Zap className="h-3.5 w-3.5 text-green-500" />;
                        case "sonnet-3-7":
                          return <Sparkles className="h-3.5 w-3.5 text-blue-500" />;
                        default:
                          return <Zap className="h-3.5 w-3.5 text-amber-500" />;
                      }
                    })()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{queuedPrompt.prompt}</p>
                    <span className="text-xs text-muted-foreground">
                      {(() => {
                        const modelNames = {
                          haiku: "Haiku",
                          "sonnet-3-5": "Sonnet 3.5",
                          "sonnet-3-7": "Sonnet 3.7",
                          sonnet: "Sonnet 4",
                          opus: "Opus",
                        };
                        return (
                          modelNames[queuedPrompt.model as keyof typeof modelNames] ||
                          queuedPrompt.model
                        );
                      })()}
                    </span>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 flex-shrink-0"
                    onClick={() => onRemove(queuedPrompt.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    );
  }
);
