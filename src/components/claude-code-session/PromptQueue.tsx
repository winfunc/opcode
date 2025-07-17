import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, Sparkles, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface QueuedPrompt {
  id: string;
  prompt: string;
  model: "sonnet" | "opus";
}

interface PromptQueueProps {
  queuedPrompts: QueuedPrompt[];
  onRemove: (id: string) => void;
  className?: string;
}

export const PromptQueue: React.FC<PromptQueueProps> = React.memo(({
  queuedPrompts,
  onRemove,
  className
}) => {
  if (queuedPrompts.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
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
                  {queuedPrompt.model === "opus" ? (
                    <Sparkles className="h-3.5 w-3.5 text-purple-500" />
                  ) : (
                    <Zap className="h-3.5 w-3.5 text-amber-500" />
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{queuedPrompt.prompt}</p>
                  <span className="text-xs text-muted-foreground">
                    {queuedPrompt.model === "opus" ? "Opus" : "Sonnet"}
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
});