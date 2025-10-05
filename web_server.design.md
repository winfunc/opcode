# Opcode Web Server Design

This document describes the implementation of Opcode's web server mode, which allows access to Claude Code from mobile devices and browsers while maintaining full functionality.

## Overview

The web server provides a REST API and WebSocket interface that mirrors the Tauri desktop app's functionality, enabling phone/browser access to Claude Code sessions.

## Architecture

```
┌─────────────────┐    WebSocket     ┌─────────────────┐    Process     ┌─────────────────┐
│   Browser UI    │ ←──────────────→ │  Rust Backend   │ ────────────→  │  Claude Binary  │
│                 │    REST API      │   (Axum Server) │               │                 │
│ • React/TS      │ ←──────────────→ │                 │               │ • claude-code   │
│ • WebSocket     │                  │ • Session Mgmt  │               │ • Subprocess    │
│ • DOM Events    │                  │ • Process Spawn │               │ • Stream Output │
└─────────────────┘                  └─────────────────┘               └─────────────────┘
```

## Key Components

### 1. Rust Web Server (`src-tauri/src/web_server.rs`)

**Main Functions:**
- `create_web_server()` - Sets up Axum server with routes
- `claude_websocket_handler()` - Manages WebSocket connections
- `execute_claude_command()` / `continue_claude_command()` / `resume_claude_command()` - Execute Claude processes
- `find_claude_binary_web()` - Locates Claude binary (bundled or system)

**Key Features:**
- **WebSocket Streaming**: Real-time output from Claude processes
- **Session Management**: Tracks active WebSocket sessions
- **Process Spawning**: Launches Claude subprocesses with proper arguments
- **Comprehensive Logging**: Detailed trace output for debugging

### 2. Frontend Event Handling (`src/components/ClaudeCodeSession.tsx`)

**Dual Mode Support:**
```typescript
const listen = tauriListen || ((eventName: string, callback: (event: any) => void) => {
  // Web mode: Use DOM events
  const domEventHandler = (event: any) => {
    callback({ payload: event.detail });
  };
  window.addEventListener(eventName, domEventHandler);
  return Promise.resolve(() => window.removeEventListener(eventName, domEventHandler));
});
```

**Message Processing:**
- Handles both string payloads (Tauri) and object payloads (Web)
- Maintains compatibility with existing UI components
- Comprehensive error handling and logging

### 3. WebSocket Communication (`src/lib/apiAdapter.ts`)

**Request Format:**
```json
{
  "command_type": "execute|continue|resume",
  "project_path": "/path/to/project",
  "prompt": "user prompt",
  "model": "sonnet|opus",
  "session_id": "uuid-for-resume"
}
```

**Response Format:**
```json
{
  "type": "start|output|completion|error",
  "content": "parsed Claude message",
  "message": "status message",
  "status": "success|error"
}
```

## Message Flow

### 1. Prompt Submission
```
Browser → WebSocket Request → Rust Backend → Claude Process
```

### 2. Streaming Response
```
Claude Process → Rust Backend → WebSocket → Browser DOM Events → UI Update
```

### 3. Event Chain
1. **User Input**: Prompt submitted via FloatingPromptInput
2. **WebSocket Send**: JSON request sent to `/ws/claude`
3. **Process Spawn**: Rust spawns `claude` subprocess
4. **Stream Parse**: Stdout lines parsed and wrapped in JSON
5. **Event Dispatch**: DOM events fired for `claude-output`
6. **UI Update**: React components receive and display messages

## File Structure

```
opcode/
├── src-tauri/src/
│   └── web_server.rs           # Main web server implementation
├── src/
│   ├── lib/
│   │   └── apiAdapter.ts       # WebSocket client & environment detection
│   └── components/
│       ├── ClaudeCodeSession.tsx           # Main session component
│       └── claude-code-session/
│           └── useClaudeMessages.ts        # Alternative hook implementation
└── justfile                    # Build configuration (just web)
```

## Build & Deployment

### Development
```bash
nix-shell --run 'just web'
# Builds frontend and starts Rust server on port 8080
```

### Production Considerations
- **Binary Location**: Checks bundled binary first, falls back to system PATH
- **CORS**: Configured for phone browser access
- **Error Handling**: Comprehensive logging and graceful failures
- **Session Cleanup**: Proper WebSocket session management

## Debugging Features

### Comprehensive Tracing
- **Backend**: All WebSocket events, process spawning, and message forwarding
- **Frontend**: Event setup, message parsing, and UI updates
- **Process**: Claude binary execution and output streaming

### Debug Output Examples
```
[TRACE] WebSocket handler started - session_id: uuid
[TRACE] Successfully parsed request: {...}
[TRACE] Claude process spawned successfully
[TRACE] Forwarding message to WebSocket: {...}
[TRACE] DOM event received: claude-output {...}
[TRACE] handleStreamMessage - message type: assistant
```

## Key Fixes Implemented

### 1. Event Handling Compatibility
**Problem**: Original code only worked with Tauri events
**Solution**: Enhanced `listen` function to support DOM events in web mode

### 2. Message Format Mismatch  
**Problem**: Backend sent JSON strings, frontend expected parsed objects
**Solution**: Parse `content` field in WebSocket handler before dispatching events

### 3. Process Integration
**Problem**: Web mode lacked Claude binary execution
**Solution**: Full subprocess spawning with proper argument passing and output streaming

### 4. Session Management
**Problem**: No state tracking for multiple concurrent sessions
**Solution**: HashMap-based session tracking with proper cleanup

### 5. Missing REST Endpoints
**Problem**: Frontend expected cancel and output endpoints that didn't exist
**Solution**: Added `/api/sessions/{sessionId}/cancel` and `/api/sessions/{sessionId}/output` endpoints

### 6. Error Event Handling
**Problem**: WebSocket errors and unexpected closures didn't dispatch UI events
**Solution**: Added `claude-error` and `claude-complete` event dispatching for all error scenarios

## Critical Issues Still Remaining

### 1. Session-Scoped Event Dispatching (CRITICAL)
**Problem**: The UI expects session-specific events like `claude-output:${sessionId}` but the backend only dispatches generic events like `claude-output`.

**Current Backend Behavior**:
```typescript
// Only dispatches generic events
window.dispatchEvent(new CustomEvent('claude-output', { detail: claudeMessage }));
window.dispatchEvent(new CustomEvent('claude-complete', { detail: success }));
window.dispatchEvent(new CustomEvent('claude-error', { detail: error }));
```

**Frontend Expectations**:
```typescript
// Expects session-scoped events
await listen(`claude-output:${sessionId}`, handleOutput);
await listen(`claude-error:${sessionId}`, handleError);
await listen(`claude-complete:${sessionId}`, handleComplete);
```

**Impact**: Session isolation doesn't work - all sessions receive all events.

### 2. Process Management and Cancellation (CRITICAL)
**Problem**: The cancel endpoint is just a stub that doesn't actually terminate running Claude processes.

**Current Implementation**:
```rust
async fn cancel_claude_execution(Path(sessionId): Path<String>) -> Json<ApiResponse<()>> {
    // Just logs - doesn't actually cancel anything
    println!("[TRACE] Cancel request for session: {}", sessionId);
    Json(ApiResponse::success(()))
}
```

**Missing**:
- Process tracking and storage in session state
- Actual process termination via `kill()` or process handles
- Proper cleanup of WebSocket sessions on cancellation
- Session-specific process management

### 3. Missing stderr Handling (MEDIUM)
**Problem**: Claude processes can write errors to stderr, but the web server only captures stdout.

**Current**: Only `child.stdout` is captured and streamed
**Missing**: `child.stderr` capture and `claude-error` event emission

### 4. Missing claude-cancelled Events (MEDIUM)
**Problem**: The Tauri implementation emits `claude-cancelled` events but the web server doesn't.

**Tauri Implementation**:
```rust
let _ = app.emit(&format!("claude-cancelled:{}", sid), true);
let _ = app.emit("claude-cancelled", true);
```

**Web Server**: No `claude-cancelled` events are dispatched.

### 5. WebSocket Session ID Mapping (MEDIUM)
**Problem**: The web server generates its own session IDs but doesn't map them to the frontend's session IDs.

**Current**: WebSocket handler creates `uuid::Uuid::new_v4().to_string()` but frontend passes `sessionId` in request.
**Missing**: Proper session ID mapping and tracking.

## Required Fixes for Full Functionality

### Priority 1 (Critical - Breaks Core Functionality)

1. **Session-Scoped Event Dispatching**
   - Modify `apiAdapter.ts` to dispatch both generic and session-specific events
   - Update WebSocket handler to use the frontend's sessionId instead of generating new ones
   - Ensure events like `claude-output:${sessionId}` are dispatched correctly

2. **Process Management and Cancellation**
   - Add process handle storage to AppState
   - Implement actual process termination in `cancel_claude_execution`
   - Add proper cleanup on WebSocket disconnection

### Priority 2 (High - Improves Reliability)

3. **stderr Handling**
   - Capture both stdout and stderr in Claude process execution
   - Emit `claude-error` events for stderr content
   - Properly handle process error states

4. **claude-cancelled Events**
   - Add `claude-cancelled` event dispatching for consistency with Tauri
   - Implement proper cancellation flow matching desktop behavior

### Priority 3 (Medium - Nice to Have)

5. **Session ID Mapping**
   - Use frontend-provided sessionId consistently
   - Remove UUID generation in WebSocket handler
   - Ensure session tracking works correctly

## Implementation Notes

### Session-Scoped Events Fix
The web server should dispatch both generic and session-specific events to match Tauri:
```typescript
// Both events should be dispatched
window.dispatchEvent(new CustomEvent('claude-output', { detail: claudeMessage }));
window.dispatchEvent(new CustomEvent(`claude-output:${sessionId}`, { detail: claudeMessage }));
```

### Process Management Fix
The AppState should track process handles:
```rust
pub struct AppState {
    pub active_sessions: Arc<Mutex<HashMap<String, tokio::sync::mpsc::Sender<String>>>>,
    pub active_processes: Arc<Mutex<HashMap<String, tokio::process::Child>>>,
}
```

## Performance Considerations

- **Streaming**: Real-time output without buffering delays
- **Memory**: Proper cleanup of completed sessions
- **Concurrency**: Multiple WebSocket connections supported
- **Error Recovery**: Graceful handling of process failures

## Security Notes

- **Binary Execution**: Uses `--dangerously-skip-permissions` flag for web mode
- **CORS**: Allows all origins for development (should be restricted in production)
- **Process Isolation**: Each session runs in separate subprocess
- **Input Validation**: JSON parsing with error handling

## Future Enhancements

1. **Authentication**: Add user authentication for production deployment
2. **Rate Limiting**: Prevent abuse of Claude API calls
3. **Session Persistence**: Save/restore session state across reconnections
4. **Mobile Optimization**: Enhanced UI for mobile browsers
5. **Error Recovery**: Automatic reconnection on WebSocket failures
6. **Process Monitoring**: Add process health checks and automatic restart
7. **Concurrent Session Limits**: Limit number of concurrent Claude processes
8. **File Management**: Add file upload/download capabilities for web mode
9. **Advanced Logging**: Structured logging with log levels and rotation

## Testing

### Manual Testing
1. Start web server: `nix-shell --run 'just web'`
2. Open browser to `http://localhost:8080`
3. Select project directory
4. Send prompt and verify streaming response
5. Check browser console for trace output

### Debug Tools
- **Browser DevTools**: WebSocket messages and console logs
- **Server Logs**: Rust trace output for backend debugging
- **Network Tab**: REST API calls and WebSocket traffic

## Troubleshooting

### Common Issues

1. **No Claude Binary**: Check PATH or install Claude Code
2. **WebSocket Errors**: Verify server is running and accessible
3. **Event Not Received**: Check DOM event listeners in browser console
4. **Process Spawn Failure**: Verify project path and permissions
5. **Session Events Not Working**: Check if session-scoped events are being dispatched (critical issue)
6. **Cancel Button Doesn't Work**: Process cancellation not implemented yet (critical issue)
7. **Multiple Sessions Interfere**: Generic events cause cross-session interference
8. **Errors Not Displayed**: stderr not captured, only stdout is shown

### Debug Commands
```bash
# Check Claude binary
which claude

# Test WebSocket endpoint
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Key: test" -H "Sec-WebSocket-Version: 13" \
  http://localhost:8080/ws/claude

# Monitor server logs
tail -f server.log  # if logging to file
```

## Current Status

The web server implementation provides **basic functionality** but has **critical issues** that prevent full feature parity with the Tauri desktop app:

### ✅ Working Features
- WebSocket-based Claude execution with streaming output
- Basic session management and tracking
- REST API endpoints for most functionality
- Comprehensive debugging and tracing
- Error handling for WebSocket failures
- Basic process spawning and output capture

### ❌ Critical Issues (Breaks Core Functionality)
- **Session-scoped event dispatching**: Sessions interfere with each other
- **Process cancellation**: Cancel button doesn't actually terminate processes
- **stderr handling**: Error messages from Claude not displayed
- **claude-cancelled events**: Missing cancellation event support

### ⚠️ Current State
The web server is **functional for single-session use** but **not suitable for production** due to the session isolation issues. Multiple concurrent sessions will interfere with each other, and users cannot cancel running processes.

### 🔧 Next Steps
1. Fix session-scoped event dispatching (highest priority)
2. Implement proper process management and cancellation
3. Add stderr capture and error event emission
4. Test with multiple concurrent sessions

This implementation successfully bridges the gap between Tauri desktop and web deployment, but requires the above fixes to achieve full feature parity while adapting to browser constraints.