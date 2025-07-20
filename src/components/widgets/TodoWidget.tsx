import React from "react";
import { CheckCircle2, Circle, Clock, FileEdit } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Todo item interface
 */
interface TodoItem {
  id?: string;
  status?: string;
  content?: string;
  priority?: string;
}

/**
 * Props interface for the TodoWidget component
 */
interface TodoWidgetProps {
  /** Array of todo items to display */
  todos: TodoItem[];
  /** Optional result object (currently unused) */
  result?: unknown;
}

/**
 * TodoWidget component for displaying a list of todo items
 *
 * A task management widget that displays todo items with status indicators,
 * priority badges, and completion states. Supports different status types
 * (completed, in_progress, pending) and priority levels (high, medium, low).
 *
 * @param todos - Array of todo objects with id, content, status, and priority
 * @param result - Optional result object (currently unused)
 *
 * @example
 * ```tsx
 * <TodoWidget
 *   todos={[
 *     { id: 1, content: "Complete project", status: "in_progress", priority: "high" },
 *     { id: 2, content: "Review code", status: "pending", priority: "medium" },
 *     { id: 3, content: "Update docs", status: "completed", priority: "low" }
 *   ]}
 * />
 * ```
 */
export const TodoWidget: React.FC<TodoWidgetProps> = ({ todos, result: _result }) => {
  const statusIcons = {
    completed: <CheckCircle2 className="h-4 w-4 text-green-500" />,
    in_progress: <Clock className="h-4 w-4 text-blue-500 animate-pulse" />,
    pending: <Circle className="h-4 w-4 text-muted-foreground" />,
  };

  const priorityColors = {
    high: "bg-red-500/10 text-red-500 border-red-500/20",
    medium: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    low: "bg-green-500/10 text-green-500 border-green-500/20",
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-3">
        <FileEdit className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">Todo List</span>
      </div>
      <div className="space-y-2">
        {todos.map((todo, idx) => (
          <div
            key={todo.id || idx}
            className={cn(
              "flex items-start gap-3 p-3 rounded-lg border bg-card/50",
              todo.status === "completed" && "opacity-60"
            )}
          >
            <div className="mt-0.5">
              {statusIcons[todo.status as keyof typeof statusIcons] || statusIcons.pending}
            </div>
            <div className="flex-1 space-y-1">
              <p className={cn("text-sm", todo.status === "completed" && "line-through")}>
                {todo.content}
              </p>
              {todo.priority && (
                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs",
                    priorityColors[todo.priority as keyof typeof priorityColors]
                  )}
                >
                  {todo.priority}
                </Badge>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
