# Claudia Server Examples

This directory contains example clients and usage demonstrations for the Claudia Server.

## Examples Included

### JavaScript/Node.js Client (`javascript/client.js`)
A complete Node.js client that demonstrates:
- HTTP API usage
- WebSocket streaming
- Error handling
- Session management

**Usage:**
```bash
cd examples/javascript
npm install ws  # Install WebSocket dependency
node client.js
```

### Python Client (`python/client.py`)
An async Python client using aiohttp and websockets:
- Async/await pattern
- Context managers for cleanup
- Type hints
- Error handling

**Requirements:**
```bash
pip install aiohttp websockets
```

**Usage:**
```bash
cd examples/python
python client.py
```

### curl Examples (`curl/api-examples.sh`)
A shell script demonstrating all REST API endpoints using curl:
- Health checks
- Session management
- Project operations
- Error scenarios

**Usage:**
```bash
cd examples/curl
./api-examples.sh
```

## Environment Variables

All examples support these environment variables:

- `CLAUDIA_SERVER_URL` - Server URL (default: http://localhost:3000)

Example:
```bash
export CLAUDIA_SERVER_URL=http://myserver:8080
node client.js
```

## Common Patterns

### 1. Basic Session Flow
```javascript
// Start session
const sessionId = await client.startSession(projectPath, prompt, model);

// Connect WebSocket for streaming
await client.connectWebSocket(sessionId);

// Handle streaming responses
client.on('claude_stream', (data) => {
  console.log(data.content);
});
```

### 2. Error Handling
```javascript
try {
  const sessionId = await client.startSession(projectPath, prompt, model);
} catch (error) {
  if (error.message.includes('CLAUDE_NOT_FOUND')) {
    console.log('Please install Claude Code CLI');
  } else {
    console.error('Unexpected error:', error);
  }
}
```

### 3. Session Management
```javascript
// List running sessions
const sessions = await client.getRunningSessions();

// Cancel specific session
await client.cancelSession(sessionId);

// Get session history
const history = await client.getSessionHistory(sessionId);
```

## WebSocket Message Types

### Client → Server
- `subscribe` - Subscribe to session updates
- `unsubscribe` - Unsubscribe from session

### Server → Client
- `status` - Connection/subscription status
- `claude_stream` - Claude response data
- `error` - Error messages

## Integration Tips

1. **Health Checks**: Always check `/api/status/health` before starting sessions
2. **Error Handling**: Wrap API calls in try-catch blocks
3. **WebSocket Reconnection**: Implement reconnection logic for production use
4. **Rate Limiting**: Respect the max_concurrent_sessions limit
5. **Cleanup**: Always close WebSocket connections when done

## Production Considerations

1. **Authentication**: Add authentication for production deployments
2. **HTTPS/WSS**: Use secure connections in production
3. **Monitoring**: Monitor health endpoints and WebSocket connections
4. **Logging**: Implement proper logging for debugging
5. **Error Recovery**: Handle network failures gracefully

For more detailed documentation, see the main README.md file.