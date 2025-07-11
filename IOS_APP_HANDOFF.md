# Claude Code Handoff - iOS App Testing & Deployment

## Project Context

This document provides complete context for continuing the Claudia iOS app development in a new Claude Code session on macOS. The React Native app has been fully implemented and needs production testing on a physical iOS device.

## Current Status

### ✅ Completed Tasks
1. **Research React Native project structure and dependencies** - DONE
2. **Create React Native project structure** - DONE
3. **Set up core dependencies (navigation, networking, WebSocket)** - DONE
4. **Implement API client for remote host connection** - DONE
5. **Port existing React components to React Native** - DONE
6. **Implement SSH connection functionality** - DONE (with limitations)
7. **Create production testing plan** - DONE
8. **Update documentation with build and API server instructions** - DONE

### 🔄 Pending Task
9. **Execute production tests on real device** - PENDING

## Quick Start Commands

```bash
# Clone and navigate to project
git clone https://github.com/yourusername/claudia.git
cd claudia
git checkout ios-implementation

# Navigate to iOS app
cd ios-app

# Install dependencies
npm install --legacy-peer-deps

# iOS specific setup
cd ios
pod install
cd ..

# Start Metro bundler
npx react-native start

# In another terminal, run on device
npx react-native run-ios --device "Your Device Name"
```

## /claude Command for This Project

When starting a new session, use this command to set up the context:

```
/claude setup-ios-testing

I need to continue testing the Claudia React Native iOS app. The app is fully implemented and needs production testing on a physical iOS device. 

Key files to review:
- ios-app/PRODUCTION_TEST_PLAN.md - Complete test plan
- ios-app/src/lib/api.ts - API client implementation
- ios-app/src/App.tsx - Main app with navigation
- web/web-server-complete.js - API server to run

The main task is to execute all test cases in PRODUCTION_TEST_PLAN.md on a real iOS device and document results.
```

## Environment Setup Checklist

### Prerequisites
- [ ] macOS 12.0 or later
- [ ] Xcode 14.0 or later installed
- [ ] Node.js 18.0 or later
- [ ] CocoaPods installed (`sudo gem install cocoapods`)
- [ ] Physical iOS device (iPhone/iPad with iOS 13.0+)
- [ ] Apple Developer account (free tier is sufficient)

### API Server Setup
1. **On host machine**, start the API server:
   ```bash
   cd web
   node web-server-complete.js
   ```

2. **Find your Mac's IP address**:
   ```bash
   ifconfig | grep "inet " | grep -v 127.0.0.1
   ```

3. **Ensure firewall allows port 8080**:
   - System Preferences > Security & Privacy > Firewall
   - Add Node.js to allowed applications

## Testing Workflow

### 1. Device Preparation
```bash
# List connected devices
xcrun xctrace list devices

# Trust the device
# On iPhone: Settings > General > Device Management > Trust
```

### 2. Build and Deploy
```bash
# Option 1: Command line
npx react-native run-ios --device "Your iPhone"

# Option 2: Xcode
# Open ios/ClaudiaApp.xcworkspace
# Select your device and press Run
```

### 3. Execute Test Plan

Follow the test cases in `ios-app/PRODUCTION_TEST_PLAN.md`:

1. **Connection Tests** (Critical)
   - HTTP connection to server
   - Connection persistence
   - Error handling

2. **Feature Tests**
   - Home dashboard
   - Session management
   - Agent CRUD operations
   - MCP server configuration
   - Usage analytics
   - Settings management

3. **Real-time Tests**
   - WebSocket stability
   - Session input/output
   - Background/foreground handling

4. **Performance Tests**
   - Large output handling
   - Multiple session switching
   - Memory usage monitoring

### 4. Document Results

Update the test execution log in `ios-app/PRODUCTION_TEST_PLAN.md`:

```markdown
| Test Case | Date | Device | iOS Version | Result | Notes |
|-----------|------|--------|-------------|--------|-------|
| 1.1 | 2024-01-XX | iPhone 13 | 17.0 | ✅ Pass | Connected successfully |
```

## Known Issues & Workarounds

### 1. SSH Connection Limitations
- **Issue**: React Native SSH library doesn't work reliably on iOS
- **Workaround**: Use HTTP connections for all testing
- **Note**: SSH UI is implemented but marked as experimental

### 2. Metro Bundler Issues
```bash
# If "No bundle URL present"
npx react-native start --reset-cache

# If port 8081 is in use
npx react-native start --port=8082
```

### 3. Pod Installation Failures
```bash
cd ios
pod deintegrate
pod install --repo-update
cd ..
```

### 4. Signing Issues in Xcode
1. Open `ios/ClaudiaApp.xcworkspace`
2. Select ClaudiaApp target
3. Signing & Capabilities tab
4. Select your Apple ID team
5. Change bundle identifier if needed

## Code Structure Reference

```
ios-app/
├── src/
│   ├── screens/          # All UI screens
│   │   ├── HomeScreen.tsx
│   │   ├── SessionsScreen.tsx
│   │   ├── AgentsScreen.tsx
│   │   ├── MCPServersScreen.tsx
│   │   ├── UsageScreen.tsx
│   │   ├── SettingsScreen.tsx
│   │   └── ConnectionSetup.tsx
│   ├── lib/
│   │   ├── api.ts       # API client with WebSocket
│   │   └── ssh.ts       # SSH manager (experimental)
│   └── App.tsx          # Main app with navigation
├── ios/                 # iOS native code
├── PRODUCTION_TEST_PLAN.md
└── REACT_NATIVE_README.md
```

## Critical Test Scenarios

### Session Management Flow
1. Create new session with args
2. Send input and verify output
3. Stop/resume session
4. Switch between multiple sessions
5. Verify WebSocket reconnection

### Agent Execution Flow
1. Create agent with custom prompt
2. Set permissions (file/network)
3. Run agent with test prompt
4. Verify execution ID returned
5. Edit and delete agents

### Error Recovery
1. Kill API server while connected
2. Verify error message
3. Restart server
4. Verify reconnection works

## Final Deployment Steps

After successful testing:

1. **Update test results** in PRODUCTION_TEST_PLAN.md
2. **Document any bugs** found during testing
3. **Create production build**:
   ```bash
   cd ios
   xcodebuild -workspace ClaudiaApp.xcworkspace \
              -scheme ClaudiaApp \
              -configuration Release \
              -archivePath build/ClaudiaApp.xcarchive \
              archive
   ```

4. **Consider TestFlight** distribution for beta testing

## Success Criteria

The iOS app is considered ready when:
- [ ] All critical test cases pass
- [ ] WebSocket connections remain stable for 10+ minutes
- [ ] No memory leaks detected
- [ ] UI responsive on all screen sizes
- [ ] Error handling works correctly
- [ ] Documentation is complete

## Important Notes

### iOS App is a Git Submodule
The ios-app directory was added as a git submodule. When cloning:
```bash
git clone --recursive https://github.com/yourusername/claudia.git
# Or if already cloned:
git submodule update --init --recursive
```

### API Server Compatibility
The iOS app requires the enhanced web server with WebSocket support:
- Use `web/web-server-complete.js` (NOT the basic web-server.js)
- Ensure SQLite database is accessible
- WebSocket runs on same port as HTTP (8080)

### Testing Priority
Focus on these critical paths first:
1. Connection establishment
2. Session creation and interaction
3. Real-time output streaming
4. Error handling and recovery

## Contact & Resources

- Main README: `claudia/README.md`
- iOS App README: `ios-app/REACT_NATIVE_README.md`
- Test Plan: `ios-app/PRODUCTION_TEST_PLAN.md`
- Web GUI docs: `claudia/WEB_GUI_TEST_REPORT.md`
- API implementation: `claudia/web/web-server-complete.js`

## Next Steps After Testing

1. Fix any critical bugs discovered
2. Optimize performance if needed
3. Consider adding:
   - Push notifications for completed tasks
   - Biometric authentication
   - iPad-specific UI optimizations
   - Offline mode with sync
   - App Store deployment preparation

Good luck with the testing! The app is fully functional and ready for real-device validation.