# Claudia iOS App

A React Native iOS application for Claude Code, providing a mobile interface to manage sessions, agents, and interact with your AI coding assistant.

## Features

- 📱 Native iOS experience with full API compatibility
- 🔌 Connect to remote Claudia API servers
- 💬 Real-time session management with WebSocket support
- 🤖 Agent creation and execution
- 📊 Usage analytics and tracking
- ⚙️ MCP server configuration
- 🎨 Light/Dark/System theme support
- 🔐 Secure API key storage

## Prerequisites

### Development Machine
- macOS 12.0 or later
- Xcode 14.0 or later
- Node.js 18.0 or later
- npm 9.0 or later
- CocoaPods (`sudo gem install cocoapods`)

### iOS Device
- iPhone or iPad running iOS 13.0+
- Connected to the same network as your API server
- Developer mode enabled (Settings > Privacy & Security > Developer Mode)

### Host Machine (API Server)
- Node.js 18.0 or later
- Claudia project with web server

## Installation

1. **Clone the repository**:
```bash
git clone https://github.com/yourusername/claudia.git
cd claudia/ios-app
```

2. **Install dependencies**:
```bash
npm install --legacy-peer-deps
```

3. **Install iOS dependencies**:
```bash
cd ios
pod install
cd ..
```

4. **Configure your development team** (required for device deployment):
- Open `ios/ClaudiaApp.xcworkspace` in Xcode
- Select the ClaudiaApp target
- Go to Signing & Capabilities
- Select your development team

## Setting Up the API Server

The iOS app connects to a Claudia API server running on your host machine. Here's how to set it up:

### 1. Start the API Server

On your host machine (Mac, Linux, or Windows):

```bash
# Navigate to the Claudia web directory
cd /path/to/claudia/web

# Start the complete API server
node web-server-complete.js
```

The server will start on port 8080 by default.

### 2. Find Your Host IP Address

The iOS app needs your computer's IP address to connect:

**macOS**:
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
```

**Linux**:
```bash
ip addr show | grep "inet " | grep -v 127.0.0.1
```

**Windows**:
```bash
ipconfig
# Look for IPv4 Address
```

Your IP will typically be something like `192.168.1.100`.

### 3. Configure Firewall (if needed)

Ensure port 8080 is accessible:

**macOS**:
- System Preferences > Security & Privacy > Firewall
- Click "Firewall Options"
- Add Node.js to allowed applications

**Windows**:
- Windows Defender Firewall
- Allow an app
- Add Node.js

## Running the App

### iOS Simulator (Limited Functionality)
```bash
npx react-native run-ios
```
⚠️ **Note**: SSH features are not available in the simulator.

### Physical iOS Device (Recommended)

1. **Connect your iPhone/iPad** via USB
2. **Trust the computer** on your device
3. **List available devices**:
```bash
xcrun xctrace list devices
```
4. **Run on specific device**:
```bash
npx react-native run-ios --device "Your iPhone Name"
```

### Alternative: Using Xcode

1. Open `ios/ClaudiaApp.xcworkspace` in Xcode
2. Select your device from the device list
3. Press the Run button (⌘R)

## First Time Setup

1. **Launch the app** on your iOS device
2. **Select connection type**: HTTP (recommended)
3. **Enter server URL**: `http://YOUR_HOST_IP:8080`
   - Example: `http://192.168.1.100:8080`
4. **Tap Connect**

The connection will be saved for future launches.

## Usage

### Creating a Session
1. Navigate to the Sessions tab
2. Tap "New Session"
3. Enter session arguments (e.g., project name)
4. Start interacting with Claude

### Managing Agents
1. Go to the Agents tab
2. Create custom agents with specific prompts
3. Configure permissions for file and network access
4. Run agents with custom prompts

### Monitoring Usage
- View token usage and costs in the Usage tab
- Filter by week, month, or all time
- See breakdown by model

### Configuration
- Add your Claude API key in Settings
- Choose your preferred theme
- Enable/disable auto-save and notifications

## Troubleshooting

### Connection Issues

**"Failed to connect to server"**
- Verify the API server is running
- Check you're using the correct IP address
- Ensure both devices are on the same network
- Disable VPN if active
- Check firewall settings

**WebSocket disconnections**
- Check network stability
- Ensure the server remains running
- Try reducing the distance to WiFi router

### Build Issues

**"No bundle URL present"**
```bash
# Reset Metro bundler
npx react-native start --reset-cache
```

**CocoaPods issues**
```bash
cd ios
pod deintegrate
pod install
cd ..
```

**Module not found errors**
```bash
# Clear all caches
watchman watch-del-all
rm -rf node_modules
npm install --legacy-peer-deps
cd ios && pod install
```

### Performance Issues

- Close other apps to free memory
- Ensure good WiFi signal strength
- Restart the app if it becomes unresponsive

## Development

### Project Structure
```
ios-app/
├── src/
│   ├── screens/       # Screen components
│   ├── lib/          # API client and utilities
│   └── App.tsx       # Main app component
├── ios/              # iOS-specific code
├── android/          # Android files (not used)
└── package.json      # Dependencies
```

### Adding New Features

1. Create new screen in `src/screens/`
2. Add to navigation in `App.tsx`
3. Extend API client if needed
4. Test on real device

### Debugging

**Enable Remote Debugging**:
1. Shake device or press Cmd+D in simulator
2. Select "Debug with Chrome"

**View Network Requests**:
```bash
# In the React Native Debugger
# Network tab shows all API calls
```

## Security Notes

- API keys are stored locally using AsyncStorage
- SSH connections use encrypted channels
- No credentials are transmitted in plain text
- Server connections should use HTTPS in production

## Known Limitations

1. **SSH Support**: The SSH library has limited iOS compatibility. SSH features are included but may not work reliably. Use HTTP connections for best results.

2. **iOS Simulator**: Cannot test SSH features in simulator due to library constraints.

3. **Background Execution**: iOS limits background network activity. Sessions may disconnect when app is backgrounded for extended periods.

4. **File Access**: Limited to what the API server exposes. No direct file system access on iOS.

## Contributing

1. Fork the repository
2. Create your feature branch
3. Test thoroughly on real devices
4. Submit a pull request

## License

[Your License Here]

## Support

For issues and questions:
- GitHub Issues: [your-repo-url]
- Documentation: See main Claudia docs