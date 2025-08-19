# Claudia Server - TypeScript Implementation

This directory contains a complete standalone TypeScript server implementation of Claudia's Claude Code integration functionality.

## What is Claudia Server?

Claudia Server extracts the core Claude Code CLI wrapper functionality from the original Claudia desktop application and provides it as a standalone TypeScript/Node.js HTTP and WebSocket server. This allows you to integrate Claude Code into any application using standard web protocols.

## Key Benefits

- **Language Agnostic**: Use any programming language that can make HTTP requests
- **Standalone**: No desktop app required, runs as a service
- **Real-time**: WebSocket streaming for live Claude responses
- **Lightweight**: Pure TypeScript/Node.js implementation
- **API-First**: RESTful API design with comprehensive documentation
- **Cross-platform**: Works on Windows, macOS, and Linux

## Quick Start

```bash
cd claudia-server
npm install
npm run build
npm start
```

The server will start on `http://localhost:3000` with WebSocket support at `ws://localhost:3000/ws`.

## Documentation

- **[README.md](README.md)** - Complete API documentation
- **[QUICKSTART.md](QUICKSTART.md)** - Quick start guide
- **[examples/](examples/)** - Client examples in multiple languages

## Architecture

The server implements the same functionality as the Rust/Tauri backend:

```
┌─────────────────┐    HTTP/WS     ┌─────────────────┐    CLI     ┌─────────────────┐
│   Your Client   │ ────────────► │ Claudia Server  │ ─────────► │   Claude Code   │
│  (Any Language) │               │   (TypeScript)  │            │      CLI        │
└─────────────────┘               └─────────────────┘            └─────────────────┘
```

## Features Implemented

✅ Claude Code CLI integration with auto-discovery  
✅ Real-time streaming via WebSocket  
✅ Project and session management  
✅ CLAUDE.md file operations  
✅ Process management and monitoring  
✅ Health checks and server status  
✅ Comprehensive error handling  
✅ CORS and security middleware  
✅ Complete API documentation  
✅ Multiple client examples  

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/status/health` | GET | Server health check |
| `/api/claude/execute` | POST | Start new Claude session |
| `/api/claude/sessions/running` | GET | List running sessions |
| `/api/projects` | GET | List all projects |
| `/ws` | WebSocket | Real-time streaming |

See [README.md](README.md) for complete API documentation.

## Client Examples

### JavaScript
```javascript
const response = await fetch('http://localhost:3000/api/claude/execute', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    project_path: '/path/to/project',
    prompt: 'Help me code',
    model: 'claude-3-5-sonnet-20241022'
  })
});
```

### Python
```python
import aiohttp

async with aiohttp.ClientSession() as session:
    async with session.post('http://localhost:3000/api/claude/execute', 
                           json={'project_path': '/path', 'prompt': 'Help me'}) as resp:
        result = await resp.json()
```

### curl
```bash
curl -X POST http://localhost:3000/api/claude/execute \
  -H "Content-Type: application/json" \
  -d '{"project_path": "/path", "prompt": "Help me", "model": "claude-3-5-sonnet-20241022"}'
```

## Use Cases

- **Web Applications**: Integrate Claude Code into web apps
- **Mobile Apps**: Use from iOS/Android via HTTP API
- **CI/CD Pipelines**: Automated code analysis and generation
- **IDEs/Editors**: Custom editor integrations
- **Microservices**: Claude Code as a microservice
- **Chatbots**: Build Claude-powered chatbots
- **API Gateways**: Proxy Claude functionality

## Deployment

The server can be deployed anywhere Node.js runs:

- **Local Development**: `npm start`
- **Production**: PM2, Docker, Kubernetes
- **Cloud**: AWS, GCP, Azure, Heroku
- **Edge**: Vercel, Netlify Functions

## Comparison with Desktop App

| Feature | Desktop App | TypeScript Server |
|---------|-------------|-------------------|
| **Interface** | GUI (Tauri/React) | HTTP/WebSocket API |
| **Language** | Rust + TypeScript | Pure TypeScript |
| **Deployment** | Desktop installation | Web service |
| **Integration** | Standalone app | API for any client |
| **Scalability** | Single user | Multi-user capable |
| **Platform** | Desktop platforms | Any HTTP client |

## Getting Started

1. **Install dependencies**: `npm install`
2. **Build the project**: `npm run build`
3. **Start the server**: `npm start`
4. **Test the API**: `curl http://localhost:3000/api/status/health`
5. **Try examples**: See `examples/` directory

For detailed setup and usage instructions, see [QUICKSTART.md](QUICKSTART.md).

---

This TypeScript server provides the same powerful Claude Code integration as the desktop app, but as a flexible web service that can be integrated into any application or workflow.