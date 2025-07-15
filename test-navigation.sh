#!/bin/bash

# Claudia UI Testing Script
# This script provides a systematic approach to testing each section

echo "🔍 Starting Claudia UI Backend Connection Tests"
echo "=============================================="
echo "Backend URL: http://localhost:1420"
echo "Test Results Directory: ~/Desktop/claudia-test-results"
echo

# Create results directory
mkdir -p ~/Desktop/claudia-test-results

# Check if Tauri backend is running
echo "📡 Checking backend connectivity..."
if curl -s http://localhost:1420 > /dev/null; then
    echo "✅ Backend is responsive at http://localhost:1420"
else
    echo "❌ Backend is not responsive - tests will fail"
    exit 1
fi

# Check if Tauri process is running
TAURI_PID=$(ps aux | grep "tauri dev" | grep -v grep | awk '{print $2}')
if [ ! -z "$TAURI_PID" ]; then
    echo "✅ Tauri dev process is running (PID: $TAURI_PID)"
else
    echo "❌ Tauri dev process not found"
fi

echo
echo "🎯 Manual Testing Instructions:"
echo "================================"
echo "1. Open http://localhost:1420 in your browser"
echo "2. Open Developer Tools (F12)"
echo "3. Navigate to each section and check for:"
echo "   - Console errors"
echo "   - Network request failures"
echo "   - UI error messages"
echo "   - Data loading success/failure"
echo
echo "📋 Sections to Test:"
echo "==================="

declare -a sections=(
    "Welcome Page:Main landing page with navigation cards"
    "Usage Dashboard:Click Usage button in top bar"
    "CLAUDE.md:Click CLAUDE button in top bar"
    "MCP:Click MCP button in top bar"
    "Settings:Click Settings button in top bar"
    "CC Agents:Click CC Agents card from welcome page"
    "CC Projects:Click CC Projects card from welcome page"
)

for i in "${!sections[@]}"; do
    IFS=':' read -r section_name section_desc <<< "${sections[$i]}"
    echo "$((i+1)). $section_name"
    echo "   Description: $section_desc"
    echo "   Screenshot: Take a screenshot and save as $(printf "%02d" $((i+1)))-${section_name// /-}.png"
    echo
done

echo "🧪 JavaScript Console Test:"
echo "============================"
echo "Run this in the browser console to test backend connections:"
echo
cat << 'EOF'
// Test all Tauri backend connections
async function testAllBackends() {
    const tests = [
        ['Usage Stats', 'get_usage_stats'],
        ['System Prompt', 'get_system_prompt'],
        ['MCP List', 'mcp_list'],
        ['Claude Settings', 'get_claude_settings'],
        ['List Agents', 'list_agents'],
        ['List Projects', 'list_projects'],
        ['Claude Version', 'check_claude_version']
    ];
    
    console.log('🔍 Testing Backend Connections...');
    
    for (const [name, command] of tests) {
        try {
            const result = await window.__TAURI__.core.invoke(command);
            console.log(`✅ ${name}: SUCCESS`, result);
        } catch (error) {
            console.log(`❌ ${name}: FAILED`, error);
        }
    }
}

testAllBackends();
EOF

echo
echo "📊 Expected Results Based on Previous Issues:"
echo "=============================================="
echo "BEFORE (Previous State):"
echo "❌ Usage Dashboard - Failed to load usage statistics"
echo "❌ CLAUDE.md - Failed to load system prompt"
echo "❌ MCP - Failed to load MCP servers"
echo "❌ Settings - Failed to load settings"
echo "❌ CC Agents - Failed to create/save agents"
echo "❌ CC Projects - Failed to load projects"
echo
echo "AFTER (Expected with Tauri Backend):"
echo "✅ Usage Dashboard - Should load usage statistics"
echo "✅ CLAUDE.md - Should load system prompt"
echo "✅ MCP - Should load MCP servers"
echo "✅ Settings - Should load settings"
echo "✅ CC Agents - Should allow creating/saving agents"
echo "✅ CC Projects - Should load projects properly"
echo
echo "🚀 Start testing now by opening: http://localhost:1420"