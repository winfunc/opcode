#!/bin/bash

# API Test Script for Claudia Web Server

API_BASE="http://localhost:3000/api"

echo "Testing Claudia Web API..."
echo "========================="

# Test health endpoint
echo -e "\n1. Testing health check endpoint..."
curl -s "$API_BASE/health" | jq '.'

# Test list projects endpoint
echo -e "\n2. Testing list projects endpoint..."
curl -s "$API_BASE/projects" | jq '.'

# Test list agents endpoint
echo -e "\n3. Testing list agents endpoint..."
curl -s "$API_BASE/agents" | jq '.'

# Test WebSocket connection (using wscat if available)
echo -e "\n4. Testing WebSocket endpoint..."
if command -v wscat &> /dev/null; then
    echo "Connecting to WebSocket at ws://localhost:3000/ws"
    timeout 2 wscat -c ws://localhost:3000/ws || echo "WebSocket test completed"
else
    echo "wscat not installed. Install with: npm install -g wscat"
    echo "Testing with curl instead..."
    curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" -H "Sec-WebSocket-Version: 13" -H "Sec-WebSocket-Key: SGVsbG8sIHdvcmxkIQ==" http://localhost:3000/ws
fi

echo -e "\nAPI tests completed!"