// Enhanced message types that map tool calls with their results
export interface ToolCall {
  id: string;
  name: string;
  input: any;
  timestamp?: number;
}

export interface ToolResult {
  toolUseId: string;
  content: any;
  isError?: boolean;
  timestamp?: number;
}

export interface EnhancedMessage {
  type: "system" | "assistant" | "user" | "result";
  subtype?: string;
  message?: {
    content?: any[];
    usage?: {
      input_tokens: number;
      output_tokens: number;
    };
  };
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
  // Enhanced fields for tool call mapping
  toolCalls?: ToolCall[];
  toolResults?: Map<string, ToolResult>;
  [key: string]: any;
}

// Helper function to extract tool calls from assistant messages
export function extractToolCalls(message: any): ToolCall[] {
  const toolCalls: ToolCall[] = [];
  
  if (message.type === "assistant" && message.message?.content && Array.isArray(message.message.content)) {
    for (const content of message.message.content) {
      if (content.type === "tool_use" && content.id) {
        toolCalls.push({
          id: content.id,
          name: content.name || "unknown",
          input: content.input,
          timestamp: Date.now()
        });
      }
    }
  }
  
  return toolCalls;
}

// Helper function to extract tool results from user messages
export function extractToolResult(message: any): ToolResult | null {
  if (message.type === "user" && message.message?.content && Array.isArray(message.message.content)) {
    for (const content of message.message.content) {
      if (content.type === "tool_result" && content.tool_use_id) {
        return {
          toolUseId: content.tool_use_id,
          content: content.content,
          isError: content.is_error || false,
          timestamp: Date.now()
        };
      }
    }
  }
  
  return null;
}

// Function to enhance messages with tool call/result mapping
export function enhanceMessages(rawMessages: any[]): EnhancedMessage[] {
  const enhanced: EnhancedMessage[] = [];
  
  // First pass: create enhanced messages and collect all tool calls
  const toolCallMap = new Map<string, { message: EnhancedMessage, toolCall: ToolCall }>();
  
  for (let i = 0; i < rawMessages.length; i++) {
    const message = rawMessages[i];
    const enhancedMessage: EnhancedMessage = { ...message };
    
    // Extract tool calls from assistant messages
    const toolCalls = extractToolCalls(message);
    if (toolCalls.length > 0) {
      enhancedMessage.toolCalls = toolCalls;
      enhancedMessage.toolResults = new Map();
      
      // Store reference to tool calls for later mapping
      for (const toolCall of toolCalls) {
        toolCallMap.set(toolCall.id, { message: enhancedMessage, toolCall });
      }
    }
    
    enhanced.push(enhancedMessage);
  }
  
  // Second pass: extract tool results and attach them to corresponding tool calls
  for (let i = 0; i < rawMessages.length; i++) {
    const message = rawMessages[i];
    
    // Extract tool results from user messages
    if (message.type === "user" && message.message?.content && Array.isArray(message.message.content)) {
      let hasOnlyMappedToolResults = true;
      let hasAnyContent = false;
      
      for (const content of message.message.content) {
        if (content.type === "tool_result" && content.tool_use_id) {
          hasAnyContent = true;
          const toolCallInfo = toolCallMap.get(content.tool_use_id);
          if (toolCallInfo) {
            // Create tool result
            const toolResult: ToolResult = {
              toolUseId: content.tool_use_id,
              content: content.content,
              isError: content.is_error || false,
              timestamp: Date.now()
            };
            
            // Attach result to the assistant message that contains the tool call
            toolCallInfo.message.toolResults?.set(content.tool_use_id, toolResult);
          } else {
            // This tool result doesn't have a matching tool call
            hasOnlyMappedToolResults = false;
          }
        } else if (content.type !== "tool_result") {
          // This message has non-tool-result content
          hasOnlyMappedToolResults = false;
          hasAnyContent = true;
        }
      }
      
      // Only mark as meta if the message contains ONLY tool results that have been mapped
      if (hasAnyContent && hasOnlyMappedToolResults) {
        enhanced[i].isMeta = true;
      }
    }
  }
  
  return enhanced;
}