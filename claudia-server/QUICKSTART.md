# Claudia Server - Quick Start Guide

## Overview

Claudia Server is a standalone TypeScript/Node.js server that provides HTTP REST API and WebSocket streaming access to Claude Code functionality. It extracts the core Claude Code integration from the Claudia desktop app and makes it available as a web service.

## Installation & Setup

### Prerequisites
- Node.js 18.0.0 or later
- Claude Code CLI installed and available in PATH
- npm or similar package manager

### Quick Installation
```bash
cd claudia-server
npm install
npm run build
```

### Start the Server
```bash
# Start with default settings (port 3000)
npm start

# Or start with custom port
node dist/index.js --port 8080

# Show all options
node dist/index.js --help
```

## API Usage

### Health Check
```bash
curl http://localhost:3000/api/status/health
```

### Start Claude Session
```bash
curl -X POST http://localhost:3000/api/claude/execute \
  -H "Content-Type: application/json" \
  -d '{
    "project_path": "/path/to/your/project",
    "prompt": "Help me understand this codebase",
    "model": "claude-3-5-sonnet-20241022"
  }'
```

### WebSocket Streaming
```javascript
const ws = new WebSocket('ws://localhost:3000/ws');

ws.onopen = () => {
  // Subscribe to session updates
  ws.send(JSON.stringify({
    type: 'subscribe',
    session_id: 'your-session-id'
  }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('Claude response:', message);
};
```

## Key Features

- 🚀 **HTTP REST API** - Standard REST endpoints for all Claude operations
- 📡 **WebSocket Streaming** - Real-time streaming of Claude responses
- 🗂️ **Project Management** - Full project and session management
- 📝 **CLAUDE.md Support** - Read/write CLAUDE.md files
- 🔄 **Session Control** - Start, continue, resume, and cancel Claude sessions
- 🏠 **Auto-Discovery** - Automatically finds Claude binary installation

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/status/health` | Health check |
| GET | `/api/status/info` | Server information |
| GET | `/api/claude/version` | Claude version info |
| POST | `/api/claude/execute` | Start new Claude session |
| POST | `/api/claude/continue` | Continue conversation |
| POST | `/api/claude/resume` | Resume existing session |
| POST | `/api/claude/cancel/{id}` | Cancel running session |
| GET | `/api/claude/sessions/running` | List running sessions |
| GET | `/api/projects` | List all projects |
| POST | `/api/projects` | Create new project |
| WS | `/ws` | WebSocket endpoint |

## Client Examples

- **JavaScript/Node.js**: `examples/javascript/client.js`
- **Python**: `examples/python/client.py`
- **curl**: `examples/curl/api-examples.sh`

## Configuration

### Environment Variables
- `PORT` - Server port (default: 3000)
- `HOST` - Server host (default: 0.0.0.0)
- `CLAUDE_BINARY` - Path to Claude binary
- `CLAUDE_HOME` - Claude home directory

### Command Line Options
```bash
node dist/index.js --port 3000 --host localhost --claude-binary /usr/bin/claude
```

## Development

### Watch Mode
```bash
npm run dev
```

### Build
```bash
npm run build
```

### Lint & Format
```bash
npm run lint
npm run format
```

## Troubleshooting

### Claude Binary Not Found
```
Error: Claude binary not found. Please install Claude Code CLI.
```
**Solution**: Install Claude Code CLI or specify path with `--claude-binary`

### Port Already in Use
```
Error: listen EADDRINUSE: address already in use :::3000
```
**Solution**: Use different port with `--port 3001`

### WebSocket Connection Issues
**Solution**: Check firewall settings and ensure server is accessible

## Production Deployment

### Using PM2
```bash
npm install -g pm2
pm2 start dist/index.js --name claudia-server -- --port 3000
pm2 save
pm2 startup
```

### Using Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY dist ./dist
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### Nginx Proxy
```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
    
    location /ws {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

## Support

For detailed documentation, see `README.md`  
For examples, see `examples/` directory  
For issues, visit the [GitHub repository](https://github.com/getAsterisk/claudia)

---

This standalone TypeScript server provides the same core Claude Code functionality as the original Claudia desktop app, but as a web service that can be integrated with any client application.