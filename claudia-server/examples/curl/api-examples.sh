#!/bin/bash

# Claudia Server curl examples
# These examples demonstrate the REST API functionality

SERVER_URL="${CLAUDIA_SERVER_URL:-http://localhost:3000}"

echo "🚀 Claudia Server API Examples"
echo "Server URL: $SERVER_URL"
echo

# Check server health
echo "1. 🩺 Health Check"
curl -s "$SERVER_URL/api/status/health" | jq '.'
echo

# Get server info
echo "2. ℹ️  Server Info"
curl -s "$SERVER_URL/api/status/info" | jq '.'
echo

# Check Claude version
echo "3. 🤖 Claude Version"
curl -s "$SERVER_URL/api/claude/version" | jq '.'
echo

# List projects
echo "4. 📁 List Projects"
curl -s "$SERVER_URL/api/projects" | jq '.'
echo

# Create a new project (optional)
# echo "5. 📂 Create Project"
# curl -s -X POST "$SERVER_URL/api/projects" \
#   -H "Content-Type: application/json" \
#   -d '{"path": "/tmp/test-project"}' | jq '.'
# echo

# Start a Claude session
echo "5. 🚀 Start Claude Session"
PROJECT_PATH="$(pwd)"
SESSION_RESPONSE=$(curl -s -X POST "$SERVER_URL/api/claude/execute" \
  -H "Content-Type: application/json" \
  -d "{
    \"project_path\": \"$PROJECT_PATH\",
    \"prompt\": \"Help me understand this project structure\",
    \"model\": \"claude-3-5-sonnet-20241022\"
  }")

echo "$SESSION_RESPONSE" | jq '.'

# Extract session ID for further examples
SESSION_ID=$(echo "$SESSION_RESPONSE" | jq -r '.data.session_id // empty')

if [ -n "$SESSION_ID" ]; then
  echo
  echo "6. 📊 Get Session Info"
  curl -s "$SERVER_URL/api/claude/sessions/$SESSION_ID" | jq '.'
  echo
  
  echo "7. 🏃 List Running Sessions"
  curl -s "$SERVER_URL/api/claude/sessions/running" | jq '.'
  echo
  
  # Wait a moment for some output
  echo "8. ⏳ Waiting 5 seconds for some output..."
  sleep 5
  
  echo "9. 📜 Get Session History (first 500 chars)"
  curl -s "$SERVER_URL/api/claude/sessions/$SESSION_ID/history" | jq -r '.data.history' | head -c 500
  echo "..."
  echo
  
  echo "10. 🛑 Cancel Session"
  curl -s -X POST "$SERVER_URL/api/claude/cancel/$SESSION_ID" | jq '.'
  echo
else
  echo "❌ Failed to create session, skipping session-specific examples"
fi

echo "✅ Examples completed!"
echo
echo "💡 For real-time streaming, use WebSocket connection:"
echo "   ws://${SERVER_URL#http://}/ws"
echo
echo "📖 For more examples, see:"
echo "   - JavaScript: examples/javascript/client.js"
echo "   - Python: examples/python/client.py"