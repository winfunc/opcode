import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ChevronDown, 
  ChevronRight, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  Terminal,
  FileText,
  Search,
  Edit,
  FolderOpen,
  Code
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ToolCall, ToolResult } from "@/types/enhanced-messages";

interface CollapsibleToolResultProps {
  toolCall: ToolCall;
  toolResult?: ToolResult;
  className?: string;
  children?: React.ReactNode;
}

// Map tool names to icons
const toolIcons: Record<string, React.ReactNode> = {
  read: <FileText className="h-4 w-4" />,
  write: <Edit className="h-4 w-4" />,
  edit: <Edit className="h-4 w-4" />,
  multiedit: <Edit className="h-4 w-4" />,
  bash: <Terminal className="h-4 w-4" />,
  ls: <FolderOpen className="h-4 w-4" />,
  glob: <Search className="h-4 w-4" />,
  grep: <Search className="h-4 w-4" />,
  task: <Code className="h-4 w-4" />,
  default: <Terminal className="h-4 w-4" />
};

// Get tool icon based on tool name
function getToolIcon(toolName: string): React.ReactNode {
  const lowerName = toolName.toLowerCase();
  return toolIcons[lowerName] || toolIcons.default;
}

// Get display name for tools
function getToolDisplayName(toolName: string): string {
  const displayNames: Record<string, string> = {
    ls: "List directory",
    read: "Read file",
    write: "Write file",
    edit: "Edit file",
    multiedit: "Multi-edit file",
    bash: "Run command",
    glob: "Find files",
    grep: "Search files",
    task: "Run task",
    todowrite: "Update todos",
    todoread: "Read todos",
    websearch: "Search web",
    webfetch: "Fetch webpage"
  };
  
  const lowerName = toolName.toLowerCase();
  return displayNames[lowerName] || toolName;
}

// Get a brief description of the tool call
function getToolDescription(toolCall: ToolCall): string {
  const name = toolCall.name.toLowerCase();
  const input = toolCall.input;
  
  switch (name) {
    case "read":
      return input?.file_path ? `${input.file_path}` : "Reading file";
    case "write":
      return input?.file_path ? `${input.file_path}` : "Writing file";
    case "edit":
    case "multiedit":
      return input?.file_path ? `${input.file_path}` : "Editing file";
    case "bash":
      return input?.command ? `${input.command}` : "Running command";
    case "ls":
      return input?.path ? `${input.path}` : "Listing directory";
    case "glob":
      return input?.pattern ? `${input.pattern}` : "Finding files";
    case "grep":
      return input?.pattern ? `${input.pattern}` : "Searching files";
    case "task":
      return input?.description || "Running task";
    default:
      return toolCall.name;
  }
}

export const CollapsibleToolResult: React.FC<CollapsibleToolResultProps> = ({
  toolCall,
  toolResult,
  className,
  children
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const isPending = !toolResult;
  const isError = toolResult?.isError;
  
  return (
    <div className={cn("space-y-2", className)}>
      {/* Tool Call Header */}
      <div
        className={cn(
          "flex items-center gap-2 p-2 rounded-md border cursor-pointer transition-colors",
          "hover:bg-muted/50",
          isPending && "border-muted-foreground/20",
          !isPending && !isError && "border-green-500/20",
          isError && "border-destructive/20"
        )}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {/* Expand/Collapse Icon */}
        <motion.div
          animate={{ rotate: isExpanded ? 90 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
        </motion.div>
        
        {/* Tool Icon */}
        <div className="text-muted-foreground">
          {getToolIcon(toolCall.name)}
        </div>
        
        {/* Tool Name */}
        <span className="text-sm font-medium">
          {getToolDisplayName(toolCall.name)}
        </span>
        
        {/* Tool Description */}
        <span className="text-xs text-muted-foreground flex-1 truncate">
          {getToolDescription(toolCall)}
        </span>
        
        {/* Status Icon */}
        <div className="ml-auto">
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : isError ? (
            <AlertCircle className="h-4 w-4 text-destructive" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          )}
        </div>
      </div>
      
      {/* Tool Result (collapsible) */}
      <AnimatePresence>
        {isExpanded && toolResult && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className={cn(
              "ml-6 p-2 rounded-md border",
              isError ? "border-destructive/20 bg-destructive/5" : "border-green-500/20 bg-green-500/5"
            )}>
              <div className="flex items-center gap-2 mb-2">
                {isError ? (
                  <AlertCircle className="h-4 w-4 text-destructive" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                )}
                <span className="text-sm font-medium">
                  {isError ? "Tool Error" : "Tool Result"}
                </span>
              </div>
              
              {/* Result Content */}
              <div className="text-xs font-mono overflow-x-auto whitespace-pre-wrap">
                {typeof toolResult.content === 'string' 
                  ? toolResult.content 
                  : JSON.stringify(toolResult.content, null, 2)}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};