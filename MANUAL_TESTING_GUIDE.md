# Manual Testing Guide: Claudia UI Backend Connections

## 🎯 Quick Test Instructions

### Step 1: Open Application
1. Navigate to: **http://localhost:1420**
2. Open Browser Developer Tools (F12)
3. Go to **Console** tab

### Step 2: Run Backend Test
Copy and paste this into the console:

```javascript
async function quickTest() {
    if (typeof window.__TAURI__ === 'undefined') {
        console.log('❌ Tauri not available - backend will not work');
        return;
    }
    
    console.log('🔍 Testing Claudia Backend...');
    
    const tests = [
        ['Projects', 'list_projects'],
        ['Agents', 'list_agents'], 
        ['Usage Stats', 'get_usage_stats'],
        ['Settings', 'get_claude_settings'],
        ['MCP Servers', 'mcp_list'],
        ['System Prompt', 'get_system_prompt']
    ];
    
    for (const [name, cmd] of tests) {
        try {
            const result = await window.__TAURI__.core.invoke(cmd);
            console.log(`✅ ${name}: Working`);
        } catch (error) {
            console.log(`❌ ${name}: Failed - ${error.message}`);
        }
    }
}

quickTest();
```

### Step 3: Test Each UI Section

#### A. Welcome Page
- ✅ Should see: "Welcome to Claudia" with two cards
- ✅ Cards: "CC Agents" and "CC Projects"
- ❌ Before: Cards might be non-functional
- ✅ After: Cards should be clickable

#### B. CC Projects (Click "CC Projects" card)
- ❌ Before: "Failed to load projects" error
- ✅ After: Should load project list or show "No projects found"
- Test: Click "New Claude Code session" button should work

#### C. CC Agents (Go back, click "CC Agents" card)  
- ❌ Before: Failed to load agents
- ✅ After: Should show agent list or empty state
- Test: "Create New Agent" should be functional

#### D. Usage Dashboard (Click usage icon in top bar)
- ❌ Before: "Failed to load usage statistics"
- ✅ After: Should show usage charts/data or "No usage data"

#### E. Settings (Click gear icon in top bar)
- ❌ Before: Failed to load settings
- ✅ After: Should show Claude settings form

#### F. MCP Manager (Click MCP icon in top bar)
- ❌ Before: Failed to load MCP servers  
- ✅ After: Should show MCP server list

#### G. CLAUDE.md Editor (Click CLAUDE icon in top bar)
- ❌ Before: Failed to load system prompt
- ✅ After: Should show editable CLAUDE.md content

### Step 4: Screenshot Each Section
Take screenshots of each section showing:
1. ✅ Data loads successfully (no "Failed to load" errors)
2. ✅ Proper UI rendering
3. ✅ Functional buttons/forms

## 🔍 What to Look For

### ✅ **Success Indicators:**
- No "Failed to load" error messages
- Data appears in lists/forms
- Buttons are clickable and responsive
- Console shows no Tauri invoke errors

### ❌ **Failure Indicators:**
- Red error messages in UI
- Empty sections with error text
- Console errors mentioning "invoke" or "Tauri"
- Buttons that don't respond to clicks

## 📋 Expected Before/After Comparison

| Section | Before (No Backend) | After (Tauri Backend) |
|---------|-------------------|----------------------|
| **CC Projects** | ❌ "Failed to load projects" | ✅ Project list or empty state |
| **CC Agents** | ❌ "Failed to load agents" | ✅ Agent list or creation form |
| **Usage Dashboard** | ❌ "Failed to load usage statistics" | ✅ Usage charts or no data message |
| **Settings** | ❌ "Failed to load settings" | ✅ Settings form with fields |
| **MCP Manager** | ❌ "Failed to load MCP servers" | ✅ Server list or empty state |
| **CLAUDE.md** | ❌ "Failed to load system prompt" | ✅ Editable markdown content |

## 🚨 Common Issues to Check

1. **Tauri Not Available**: Console shows "Tauri not available"
   - Solution: Ensure Tauri dev server is running

2. **Port Not Accessible**: Page won't load
   - Solution: Check http://localhost:1420 is responding

3. **Mixed Success/Failure**: Some endpoints work, others don't
   - This indicates partial backend implementation

## 📸 Screenshot Naming Convention
Save screenshots as:
- `before-[section].png` (if you have old screenshots)
- `after-[section].png` (current state)
- `console-test-results.png` (console output)

---

**Quick Summary Test**: If the browser console test shows mostly ✅ success results, the Tauri backend is working and has resolved the previous "Failed to load" issues across the Claudia UI.