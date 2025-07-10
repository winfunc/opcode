#!/bin/bash

# Test script for web server functionality

echo "Testing Claudia Web Server..."
echo "=============================="

# Set environment variables to enable web server
export WEB_SERVER_ENABLED=true
export WEB_SERVER_PORT=3000
export WEB_SERVER_HOST=0.0.0.0
export JWT_SECRET=test-secret-key
export AUTH_ENABLED=false  # Disable auth for testing

echo "Starting server with web interface enabled..."
echo "Web server will be available at http://localhost:3000"
echo ""
echo "API endpoints:"
echo "  - Health check: http://localhost:3000/api/health"
echo "  - List projects: http://localhost:3000/api/projects"
echo "  - WebSocket: ws://localhost:3000/ws"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Run the development server
cd src-tauri && cargo run