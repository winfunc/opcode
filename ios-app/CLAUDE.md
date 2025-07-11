# CLAUDE.md - iOS App Project Context

This file provides guidance to Claude Code when working with the Claudia React Native iOS app.

## Project Overview

This is a React Native iOS application that provides a mobile interface for Claude Code. It connects to the Claudia API server (web-server-complete.js) to manage sessions, agents, and analytics.

## Current Project Status

### Implementation Status: COMPLETE ✅
- All screens implemented and functional
- API client with full feature parity
- WebSocket support for real-time updates
- SSH framework included (experimental)

### Testing Status: PENDING 🔄
- Production testing on physical device required
- See PRODUCTION_TEST_PLAN.md for test cases
- Test execution log needs to be filled

## Development Commands

### Setup & Installation
```bash
# Install dependencies (use legacy peer deps due to React Native version)
npm install --legacy-peer-deps

# iOS setup
cd ios && pod install && cd ..

# Start Metro bundler
npx react-native start

# Run on iOS device
npx react-native run-ios --device "Device Name"
```

### Testing Commands
```bash
# Type checking
npx tsc --noEmit

# Start API server (in web directory)
node web-server-complete.js

# View device logs
npx react-native log-ios
```

## Architecture Overview

### Frontend Structure
- **Navigation**: Bottom tab navigation with 6 main screens
- **State Management**: React hooks + API client singleton
- **Real-time**: Socket.io client for WebSocket connections
- **Storage**: AsyncStorage for settings and connection info

### API Integration
- **Base URL**: Configured via connection setup screen
- **Authentication**: API key stored securely in AsyncStorage
- **Error Handling**: Try-catch with user-friendly alerts
- **Reconnection**: Automatic WebSocket reconnection logic

### Key Components

1. **ConnectionSetup.tsx**: Initial connection configuration
   - HTTP and SSH connection types
   - Validates and saves server URL

2. **SessionsScreen.tsx**: Main interaction screen
   - Real-time session output via WebSocket
   - Input field for sending commands
   - Session list with running indicators

3. **API Client (lib/api.ts)**: 
   - Axios for HTTP requests
   - Socket.io for WebSocket
   - Full TypeScript interfaces

## Important Implementation Details

### WebSocket Event Handling
```typescript
// Listen for real-time updates
socket.on('process-output', (data) => {
  // Updates session output in real-time
});

socket.on('session-status', (data) => {
  // Updates session running status
});
```

### Connection Flow
1. User enters server URL (e.g., http://192.168.1.100:8080)
2. App validates connection with health check
3. URL saved to AsyncStorage for persistence
4. WebSocket connection established
5. User can interact with sessions

### SSH Support (Experimental)
- Library: @dylankenneally/react-native-ssh-sftp
- Status: Implemented but unreliable on iOS
- Recommendation: Use HTTP connections only
- UI shows warning about SSH limitations

## Testing Focus Areas

### Critical Paths
1. **Connection Setup**: Must connect to remote server
2. **Session Creation**: Create and interact with sessions
3. **Real-time Updates**: WebSocket must stay stable
4. **Error Recovery**: Handle network interruptions

### Device-Specific Testing
- Test on various iPhone models
- Verify iPad layout (responsive design)
- Test iOS 13+ compatibility
- Check memory usage over time

### Known Limitations
1. **No iOS Simulator SSH**: Physical device required
2. **Background Limitations**: iOS restricts background networking
3. **File Access**: Limited to API server responses

## Debugging Tips

### Common Issues

1. **"No bundle URL present"**
   ```bash
   npx react-native start --reset-cache
   ```

2. **WebSocket disconnections**
   - Check server is still running
   - Verify network connectivity
   - Look for firewall issues

3. **Build failures**
   ```bash
   cd ios
   pod deintegrate
   pod install
   ```

### Performance Monitoring
- Use Xcode Instruments for memory profiling
- Monitor network requests in React Native Debugger
- Check for re-render issues with React DevTools

## Security Considerations

- API keys stored in AsyncStorage (encrypted on device)
- No hardcoded credentials
- HTTPS recommended for production
- SSH passwords not stored (session only)

## Future Enhancements

After testing is complete, consider:
1. Push notifications for task completion
2. Biometric authentication
3. iPad-specific UI optimizations
4. Offline mode with sync
5. Share extension for quick prompts

## Quick Reference

### File Locations
- API Client: `src/lib/api.ts`
- Screens: `src/screens/*.tsx`
- Navigation: `src/App.tsx`
- Types: Inline with implementations

### Key Dependencies
- @react-navigation/native & bottom-tabs
- axios & socket.io-client
- @react-native-async-storage/async-storage
- react-native-vector-icons
- @dylankenneally/react-native-ssh-sftp (experimental)

### Testing Checklist
- [ ] HTTP connection to remote server
- [ ] Create and manage sessions
- [ ] Real-time output streaming
- [ ] Agent CRUD operations
- [ ] MCP server management
- [ ] Usage analytics display
- [ ] Settings persistence
- [ ] Error handling
- [ ] Performance under load
- [ ] Network interruption recovery

Remember: Focus on HTTP connections for testing. SSH is experimental and not reliable on iOS.