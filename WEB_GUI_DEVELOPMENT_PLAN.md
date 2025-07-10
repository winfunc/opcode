# Web GUI Development Plan for Claudia

## Project Overview

This document outlines the implementation plan for adding a web-based GUI to Claudia, allowing the application to be accessed remotely through a web browser while maintaining all existing desktop functionality.

## Current Architecture Analysis

### Core Components
- **Backend**: Rust with Tauri 2 framework
- **Frontend**: React 18 + TypeScript + Vite
- **Database**: SQLite for local storage
- **IPC**: Tauri's command system for frontend-backend communication
- **Key Features**:
  - Claude Code session management
  - Custom AI agents with execution
  - Usage analytics and tracking
  - MCP server management
  - Timeline/checkpoint functionality
  - Real-time process output streaming

### Architecture Transformation Strategy
- Add web server module to Rust backend
- Create REST API + WebSocket layer
- Implement API adapter pattern in frontend
- Maintain backward compatibility with desktop mode

## Implementation Phases

### Phase 1: Web Server Foundation (Current)

#### Tasks:
1. ✅ Create development plan document
2. Create web server module structure
3. Implement basic HTTP server with Axum
4. Set up routing infrastructure
5. Add CORS configuration

#### Files to Create/Modify:
- `src-tauri/Cargo.toml` - Add web server dependencies
- `src-tauri/src/web_server/mod.rs` - Main web server module
- `src-tauri/src/web_server/routes.rs` - API route definitions
- `src-tauri/src/web_server/handlers.rs` - Request handlers
- `src-tauri/src/main.rs` - Integrate web server

### Phase 2: REST API Implementation

#### Core API Endpoints:

##### Project Management
- `GET /api/projects` - List all projects
- `GET /api/projects/:id/sessions` - Get project sessions
- `GET /api/sessions/:id` - Get session details
- `POST /api/sessions` - Create new session

##### Claude Execution
- `POST /api/claude/execute` - Start Claude Code execution
- `POST /api/claude/continue` - Continue existing session
- `POST /api/claude/cancel` - Cancel running session
- `GET /api/claude/status/:session_id` - Get execution status

##### Agent Management
- `GET /api/agents` - List all agents
- `POST /api/agents` - Create new agent
- `PUT /api/agents/:id` - Update agent
- `DELETE /api/agents/:id` - Delete agent
- `POST /api/agents/:id/execute` - Execute agent

##### Usage Analytics
- `GET /api/usage/stats` - Get usage statistics
- `GET /api/usage/details` - Get detailed usage
- `GET /api/usage/date-range` - Get usage by date range

##### MCP Servers
- `GET /api/mcp/servers` - List MCP servers
- `POST /api/mcp/servers` - Add MCP server
- `DELETE /api/mcp/servers/:name` - Remove MCP server
- `POST /api/mcp/test` - Test MCP connection

### Phase 3: WebSocket Implementation

#### Real-time Events:
- `process-output` - Stream Claude output
- `process-completed` - Process completion notification
- `checkpoint-created` - Checkpoint creation events
- `agent-status` - Agent execution status
- `usage-update` - Real-time usage updates

### Phase 4: Frontend Adaptation

#### API Adapter Pattern:
```typescript
// src/lib/api-adapter.ts
interface ApiAdapter {
  isDesktop: boolean;
  invoke<T>(command: string, args?: any): Promise<T>;
  listen(event: string, handler: Function): () => void;
  removeAllListeners(event?: string): void;
}

// Web implementation
class WebApiAdapter implements ApiAdapter {
  private ws: WebSocket;
  private apiBase: string;
  
  async invoke<T>(command: string, args?: any): Promise<T> {
    // Transform Tauri commands to REST API calls
  }
  
  listen(event: string, handler: Function): () => void {
    // WebSocket event listeners
  }
}
```

### Phase 5: Authentication & Security

#### Security Features:
- JWT-based authentication
- API key management
- Rate limiting
- CORS configuration
- Secure WebSocket connections
- Audit logging

### Phase 6: Deployment Configuration

#### Docker Setup:
- Multi-stage Dockerfile
- docker-compose configuration
- Environment variable management
- Health check endpoints
- Monitoring integration

## Current Implementation Status

### Completed:
- ✅ Development plan created
- ✅ Repository forked and ready
- ✅ Web server module setup
- ✅ Basic REST API structure implemented
- ✅ Health check endpoint working
- ✅ Projects listing endpoint (using existing Tauri commands)
- ✅ Agents listing endpoint implemented
- ✅ WebSocket foundation established
- ✅ JWT authentication system prepared
- ✅ CORS configuration added
- ✅ Test scripts created (test_web_server.sh, test_api.sh)
- ✅ HTML test client created (web_test.html)

### In Progress:
- 🔄 REST API handler implementation
- 🔄 WebSocket event streaming

### Pending:
- ⏳ Complete all API endpoint implementations
- ⏳ WebSocket real-time event handling
- ⏳ Frontend API adapter
- ⏳ Authentication integration
- ⏳ Deployment configuration
- ⏳ Docker setup
- ⏳ Performance optimization

## Technical Specifications

### Dependencies to Add:
```toml
# Web server
axum = "0.7"
tower = "0.4"
tower-http = { version = "0.5", features = ["cors", "fs"] }

# WebSocket
tokio-tungstenite = "0.21"

# Authentication
jsonwebtoken = "9"
bcrypt = "0.15"

# API documentation
utoipa = { version = "4", features = ["axum_extras"] }
utoipa-swagger-ui = { version = "6", features = ["axum"] }
```

### Environment Variables:
```env
# Web server configuration
WEB_SERVER_ENABLED=true
WEB_SERVER_PORT=3000
WEB_SERVER_HOST=0.0.0.0

# Authentication
JWT_SECRET=your-secret-key
JWT_EXPIRY=24h

# Database
DATABASE_URL=sqlite://claudia.db

# Claude binary
CLAUDE_BINARY_PATH=/usr/local/bin/claude
```

## Testing Strategy

### Unit Tests:
- API endpoint tests
- WebSocket handler tests
- Authentication tests
- Database operation tests

### Integration Tests:
- Full API flow tests
- WebSocket connection tests
- Frontend-backend communication tests
- Multi-user scenario tests

### Performance Tests:
- Load testing with k6
- WebSocket scalability tests
- Database query optimization
- Memory usage profiling

## Deployment Architecture

```
┌─────────────────┐     ┌─────────────────┐
│   Nginx/Proxy   │────▶│   Web Server    │
└─────────────────┘     └─────────────────┘
                               │
                    ┌──────────┴──────────┐
                    │                     │
              ┌─────▼─────┐         ┌─────▼─────┐
              │  REST API  │         │ WebSocket │
              └─────┬─────┘         └─────┬─────┘
                    │                     │
                    └──────────┬──────────┘
                               │
                        ┌──────▼──────┐
                        │   Business   │
                        │    Logic     │
                        └──────┬──────┘
                               │
                        ┌──────▼──────┐
                        │   Database   │
                        │   (SQLite)   │
                        └─────────────┘
```

## Development Guidelines

1. **Backward Compatibility**: Ensure desktop mode continues to work
2. **API Consistency**: Match Tauri command names in REST endpoints
3. **Error Handling**: Comprehensive error responses with proper HTTP codes
4. **Documentation**: OpenAPI/Swagger documentation for all endpoints
5. **Security First**: Implement authentication from the beginning
6. **Testing**: Write tests alongside implementation
7. **Performance**: Consider caching and optimization early

## Next Steps

1. Set up web server module structure
2. Implement basic HTTP server
3. Create first API endpoints
4. Set up WebSocket server
5. Begin frontend adaptation

---

*This document will be updated as implementation progresses.*