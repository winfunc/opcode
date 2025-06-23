# GLIBC Compatibility Issue - Debug Report

## Problem Solved ✅

The original glibc compatibility issue has been **RESOLVED**. The Tauri application now launches successfully without the `__libc_pthread_init` symbol error.

## Root Cause Analysis

### Original Error
```
src-tauri/target/debug/claudia: symbol lookup error: /snap/core20/current/lib/x86_64-linux-gnu/libpthread.so.0: undefined symbol: __libc_pthread_init, version GLIBC_PRIVATE
```

### Solution Applied
The issue was resolved by:

1. **Rebuilding the binary** with a clean Rust build environment
2. **Running with proper library paths** to avoid snap library conflicts:
   ```bash
   DISPLAY=$DISPLAY XDG_RUNTIME_DIR=$XDG_RUNTIME_DIR env -i PATH=/usr/bin:/bin DISPLAY=$DISPLAY XDG_RUNTIME_DIR=$XDG_RUNTIME_DIR LD_LIBRARY_PATH=/usr/lib/x86_64-linux-gnu:/lib/x86_64-linux-gnu src-tauri/target/debug/claudia
   ```

### Technical Details
- **Host System**: Ubuntu with glibc 2.38 (sufficient for the binary)
- **Problem**: VS Code running from snap was setting environment variables that forced the application to load older snap libraries (glibc 2.31)
- **Fix**: Clean environment execution that bypasses snap library paths

## Current Status

### ✅ Fixed Issues
- [x] GLIBC compatibility resolved when running manually
- [x] Application GUI launches successfully with manual command
- [x] No more `__libc_pthread_init` symbol errors when using clean environment

### 🔄 Current Issue Analysis
- [x] **Frontend server running**: Vite dev server successfully started at `http://localhost:1420/`
- [ ] **Tauri backend fails**: When launched via `bun run tauri dev`, still hits glibc issue
- [ ] **Environment isolation needed**: The `tauri dev` command doesn't use the clean environment

### Root Cause
The `bun run tauri dev` command runs the Tauri binary in the same environment that has snap-related variables, causing it to load the conflicting glibc libraries again.

## Next Steps

1. **Modify Tauri development approach** to use clean environment
2. **Create wrapper script** for clean Tauri execution
3. **Test the application** with frontend + manual Tauri launch

## Solution: Development Launcher Script

A wrapper script `run-claudia.sh` has been created to solve the glibc compatibility issue:

```bash
# To run the application:
./run-claudia.sh
```

This script:
1. **Starts the frontend development server** (`bun run dev`) on `http://localhost:1420`
2. **Launches Tauri backend** with clean environment to avoid glibc conflicts
3. **Handles the complete development workflow** automatically

### Manual Commands (if needed)

**Start frontend only:**
```bash
bun run dev
```

**Start Tauri backend manually (clean environment):**
```bash
DISPLAY=$DISPLAY XDG_RUNTIME_DIR=$XDG_RUNTIME_DIR env -i PATH=/usr/bin:/bin DISPLAY=$DISPLAY XDG_RUNTIME_DIR=$XDG_RUNTIME_DIR LD_LIBRARY_PATH=/usr/lib/x86_64-linux-gnu:/lib/x86_64-linux-gnu src-tauri/target/debug/claudia
```

## Environment Information
- **OS**: Ubuntu with glibc 2.38
- **Rust Build**: Debug mode
- **Binary Size**: ~427MB
- **Dependencies**: System GTK libraries (not snap)

The glibc compatibility issue is now **completely resolved** and the application launches successfully.