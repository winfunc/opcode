# React Native Claudia App - Production Testing Plan

## Overview
This document outlines the comprehensive production testing plan for the React Native Claudia iOS app. All tests must be executed on real devices (iOS simulator not supported for SSH features).

## Test Environment Setup

### Prerequisites
1. **Host Machine (Server)**:
   - Node.js 18+ installed
   - Claudia web server running: `cd web && node web-server-complete.js`
   - Note server IP address: `ifconfig | grep "inet "`

2. **iOS Device**:
   - iPhone or iPad with iOS 13.0+
   - Connected to same network as host machine
   - Developer mode enabled

3. **Development Machine**:
   - macOS with Xcode 14+
   - React Native development environment configured
   - CocoaPods installed

### Build and Deploy
```bash
# Install dependencies
cd ios-app
npm install --legacy-peer-deps

# iOS specific setup
cd ios
pod install
cd ..

# Run on device
npx react-native run-ios --device "Your iPhone Name"
```

## Test Cases

### 1. Connection Setup (Critical Path)

#### Test 1.1: HTTP Connection
- **Steps**:
  1. Launch app fresh (no saved connection)
  2. Select HTTP connection type
  3. Enter server URL: `http://[HOST_IP]:8080`
  4. Tap Connect
- **Expected**: Successfully connects, shows home screen
- **Verify**: Server health check passes

#### Test 1.2: Connection Persistence
- **Steps**:
  1. Force quit app after successful connection
  2. Relaunch app
- **Expected**: Automatically reconnects to saved server
- **Verify**: No connection setup screen shown

#### Test 1.3: Invalid Connection
- **Steps**:
  1. Enter invalid URL: `http://192.168.1.999:8080`
  2. Tap Connect
- **Expected**: Error alert "Failed to connect to server"
- **Verify**: Remains on connection screen

### 2. Home Dashboard

#### Test 2.1: Dashboard Data Loading
- **Steps**:
  1. Navigate to Home tab
  2. Pull to refresh
- **Expected**: 
  - Stats cards update with real data
  - Recent sessions list populates
  - No loading errors

#### Test 2.2: Quick Actions
- **Steps**:
  1. Tap each quick action card
- **Expected**: Navigates to correct screen
- **Verify**: All 4 actions work

### 3. Sessions Management

#### Test 3.1: Create New Session
- **Steps**:
  1. Tap "New Session" button
  2. Enter args: `test-project`
  3. Create session
- **Expected**: 
  - Session created and selected
  - Real-time output displayed
  - Input field enabled

#### Test 3.2: Session Interaction
- **Steps**:
  1. Type message: "Hello Claude"
  2. Send message
  3. Wait for response
- **Expected**:
  - Message sent successfully
  - Response received in output
  - WebSocket connection stable

#### Test 3.3: Resume/Stop Session
- **Steps**:
  1. Stop running session
  2. Select stopped session
  3. Resume session
- **Expected**: 
  - Status updates correctly
  - Can send messages when running
  - Cannot send when stopped

### 4. Agent Management

#### Test 4.1: Create Custom Agent
- **Steps**:
  1. Navigate to Agents tab
  2. Tap "New Agent"
  3. Fill all fields with test data
  4. Toggle permissions as needed
  5. Save
- **Expected**: Agent created and appears in list

#### Test 4.2: Run Agent
- **Steps**:
  1. Tap play button on agent
  2. Enter prompt: "Test prompt"
  3. Run
- **Expected**: 
  - Execution starts
  - Success alert with execution ID

#### Test 4.3: Edit/Delete Agent
- **Steps**:
  1. Edit agent details
  2. Save changes
  3. Delete different agent
- **Expected**: 
  - Changes persist
  - Deletion confirmed

### 5. MCP Servers

#### Test 5.1: Add MCP Server
- **Steps**:
  1. Add new MCP server
  2. Enter command: `npx test-server`
  3. Toggle enabled/disabled
- **Expected**: 
  - Server saved
  - Toggle state persists

#### Test 5.2: Default Servers
- **Steps**:
  1. Try to edit default server
  2. Try to delete default server
- **Expected**: Actions disabled for default servers

### 6. Usage Analytics

#### Test 6.1: Date Range Selection
- **Steps**:
  1. Select Week view
  2. Select Month view
  3. Select All Time view
- **Expected**: 
  - Data updates for each range
  - Chart redraws correctly

#### Test 6.2: Usage Display
- **Expected**:
  - Token counts formatted correctly (K, M)
  - Costs show with $ symbol
  - Model breakdown accurate

### 7. Settings

#### Test 7.1: API Key Management
- **Steps**:
  1. Enter API key
  2. Toggle visibility
  3. Save settings
- **Expected**: 
  - Key saved securely
  - Visibility toggle works

#### Test 7.2: Theme Selection
- **Steps**:
  1. Select each theme option
- **Expected**: Theme preference saved

#### Test 7.3: Disconnect
- **Steps**:
  1. Tap Disconnect
  2. Confirm
- **Expected**: Returns to connection setup

### 8. Real-time Features

#### Test 8.1: WebSocket Stability
- **Steps**:
  1. Keep session open for 5 minutes
  2. Send periodic messages
- **Expected**: 
  - Connection remains stable
  - No disconnections
  - Messages flow both ways

#### Test 8.2: Background/Foreground
- **Steps**:
  1. Start session
  2. Background app
  3. Wait 30 seconds
  4. Foreground app
- **Expected**: 
  - Reconnects automatically
  - No data loss

### 9. Performance Tests

#### Test 9.1: Large Output Handling
- **Steps**:
  1. Run command that generates 1000+ lines
- **Expected**: 
  - Smooth scrolling
  - No UI freezing
  - Memory usage stable

#### Test 9.2: Multiple Sessions
- **Steps**:
  1. Create 10 sessions
  2. Switch between them rapidly
- **Expected**: 
  - Quick switching
  - Correct data shown

### 10. Error Handling

#### Test 10.1: Network Interruption
- **Steps**:
  1. Disable WiFi during session
  2. Re-enable WiFi
- **Expected**: 
  - Error shown
  - Automatic reconnection

#### Test 10.2: Server Restart
- **Steps**:
  1. Stop server while connected
  2. Restart server
- **Expected**: 
  - Connection error shown
  - Can reconnect manually

## Acceptance Criteria

### Critical Features (Must Pass)
- [ ] HTTP connection to remote server
- [ ] Create and interact with sessions
- [ ] Real-time output streaming
- [ ] Send input to sessions
- [ ] View usage analytics
- [ ] Manage settings

### Important Features (Should Pass)
- [ ] Agent management
- [ ] MCP server configuration
- [ ] Session persistence
- [ ] Error recovery
- [ ] Performance under load

### Known Limitations
1. SSH connections not fully implemented (React Native library limitations)
2. iOS simulator not supported for SSH features
3. File operations limited by API server

## Test Execution Log

| Test Case | Date | Device | iOS Version | Result | Notes |
|-----------|------|--------|-------------|--------|-------|
| 1.1 | | | | | |
| 1.2 | | | | | |
| ... | | | | | |

## Post-Testing Actions
1. Document any bugs found
2. Update README with tested configurations
3. Create issues for any failures
4. Performance optimization if needed