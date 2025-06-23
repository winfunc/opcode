import React from "react";
import { StreamMessage } from "./StreamMessage";
import type { ClaudeStreamMessage } from "./AgentExecution";

/**
 * Demo component showing all the different message types and tools
 */
export const AgentExecutionDemo: React.FC = () => {
  // Sample messages based on the provided JSONL session
  const messages: ClaudeStreamMessage[] = [
    // Skip meta message (should not render)
    {
      type: "user",
      isMeta: true,
      message: { content: [] },
      timestamp: "2025-06-11T14:08:53.771Z"
    },
    
    // Summary message
    {
      leafUuid: "3c5ecb4f-c1f0-40c2-a357-ab7642ad28b8",
      summary: "JSONL Viewer Model Configuration and Setup",
      type: "summary" as any
    },
    
    // Assistant with Edit tool
    {
      type: "assistant",
      message: {
        content: [{
          type: "tool_use",
          name: "Edit",
          input: {
            file_path: "/Users/mufeedvh/dev/jsonl-viewer/script.js",
            new_string: "reader.onerror = () => reject(new Error('Failed to read file'));",
            old_string: "reader.onerror = e => reject(new Error('Failed to read file'));"
          }
        }],
        usage: { input_tokens: 4, output_tokens: 158 }
      }
    },
    
    // User with Edit tool result
    {
      type: "user",
      message: {
        content: [{
          type: "tool_result",
          content: `The file /Users/mufeedvh/dev/jsonl-viewer/script.js has been updated. Here's the result of running \`cat -n\` on a snippet of the edited file:
   220       readFileAsText(file) {
   221         return new Promise((resolve, reject) => {
   222           const reader = new FileReader();
   223           reader.onload = e => resolve(e.target.result);
   224           reader.onerror = () => reject(new Error('Failed to read file'));
   225           reader.readAsText(file);
   226         });
   227       }
   228`
        }]
      }
    },
    
    // Assistant with MCP tool
    {
      type: "assistant",
      message: {
        content: [{
          type: "tool_use",
          name: "mcp__ide__getDiagnostics",
          input: {}
        }],
        usage: { input_tokens: 4, output_tokens: 37 }
      }
    },
    
    // User with empty tool result
    {
      type: "user",
      message: {
        content: [{
          type: "tool_result",
          content: ""
        }]
      }
    },
    
    // Assistant with Write tool (large content)
    {
      type: "assistant",
      message: {
        content: [{
          type: "tool_use",
          name: "Write",
          input: {
            file_path: "/Users/mufeedvh/dev/jsonl-viewer/styles.css",
            content: `/* Reset and Base Styles */
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    line-height: 1.6;
    color: #cdd6f4;
    background: #1e1e2e;
    min-height: 100vh;
}

/* Container */
.container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
}

/* Header */
.header {
    text-align: center;
    margin-bottom: 40px;
}

.header h1 {
    font-size: 2.5rem;
    font-weight: 700;
    color: #cdd6f4;
    margin-bottom: 8px;
}

.header p {
    color: #a6adc8;
    font-size: 1.1rem;
}

/* Input Section */
.input-section {
    display: grid;
    gap: 20px;
    margin-bottom: 30px;
}

/* Drop Zone */
.drop-zone {
    border: 2px dashed #45475a;
    border-radius: 12px;
    padding: 40px 20px;
    text-align: center;
    cursor: pointer;
    transition: all 0.3s ease;
    background: #1e1e2e;
    position: relative;
}

.drop-zone:hover,
.drop-zone.drag-over {
    border-color: #89b4fa;
    background: #313244;
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(137, 180, 250, 0.1);
}

/* ... many more lines of CSS ... */
/* This content is over 1000 characters so it should show the maximize button */
` + '\n'.repeat(100) + '/* End of very long CSS file */'
          }
        }]
      }
    }
  ];

  return (
    <div className="max-w-4xl mx-auto p-8 space-y-4">
      <h1 className="text-2xl font-bold mb-6">Agent Execution Demo</h1>
      
      {messages.map((message, idx) => (
        <StreamMessage key={idx} message={message} streamMessages={messages} />
      ))}
    </div>
  );
}; 