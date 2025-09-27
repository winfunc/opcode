# Session Deletion Feature - Ready for Contribution

## 📋 Overview
This feature adds a delete button to session cards that allows users to permanently delete session files, addressing [Issue #305](https://github.com/getAsterisk/opcode/issues/305).

## 🎯 Implementation Details

### Backend Changes
- **File**: `src-tauri/src/commands/claude.rs`
- **Added**: `delete_session` command with comprehensive documentation
- **Functionality**: Deletes both `.jsonl` session files and associated todo data

### Frontend Changes
- **File**: `src/lib/api.ts`
- **Added**: `deleteSession` method with proper error handling
- **Integration**: Full TypeScript support with JSDoc documentation

### UI Changes
- **File**: `src/components/SessionList.tsx`
- **Added**: Hover-reveal delete button with Trash2 icon
- **UX**: Confirmation dialog before deletion
- **Styling**: Follows project design patterns

### State Management
- **File**: `src/stores/sessionStore.ts`
- **Updated**: Real API integration replacing placeholder
- **File**: `src/components/TabContent.tsx`
- **Added**: `onSessionDelete` callback for immediate UI updates

## 🚀 How to Contribute

### Step 1: Fork the Repository
1. Go to https://github.com/getAsterisk/opcode
2. Click "Fork" to create your own fork
3. Clone your fork locally

### Step 2: Apply Changes
From this directory, copy all the modified files to your fork:

```bash
# Copy the changes to your fork
cp -r src-tauri/src/commands/claude.rs YOUR_FORK/src-tauri/src/commands/claude.rs
cp -r src-tauri/src/main.rs YOUR_FORK/src-tauri/src/main.rs
cp -r src/lib/api.ts YOUR_FORK/src/lib/api.ts
cp -r src/components/SessionList.tsx YOUR_FORK/src/components/SessionList.tsx
cp -r src/components/TabContent.tsx YOUR_FORK/src/components/TabContent.tsx
cp -r src/stores/sessionStore.ts YOUR_FORK/src/stores/sessionStore.ts
```

### Step 3: Create Pull Request
1. Create a branch: `git checkout -b feature/session-deletion-functionality`
2. Commit changes with the provided commit message
3. Push to your fork
4. Create PR from your fork to getAsterisk/opcode

## 📝 Pull Request Template

**Title**: `Feature: Add session deletion functionality`

**Description**:
```
Implements session deletion feature with delete button on hover for each session card.

Addresses issue #305 where users requested the ability to delete unnecessary sessions.

## Changes:
- **Backend**: Added `delete_session` Rust command to remove .jsonl files and associated todo data
- **Frontend**: Added `deleteSession` API method with proper error handling
- **UI**: Added Trash2 icon delete button that appears on session card hover
- **UX**: Added confirmation dialog before deletion to prevent accidents
- **State**: Updated local state management to remove sessions immediately after deletion

## Features:
- Hover-to-reveal delete button for clean UI
- Confirmation dialog with session details
- Deletes both session file and associated todo data
- Proper error handling and user feedback
- Follows project coding standards and documentation guidelines

## Testing:
- ✅ Code compiles without errors
- ✅ Follows project linting standards (cargo fmt, cargo clippy)
- ✅ Comprehensive documentation added
- ✅ UI integration tested

Fixes #305
```

## ✅ Code Quality Checklist
- [x] Rust code formatted with `cargo fmt`
- [x] Code follows project conventions
- [x] Comprehensive documentation added
- [x] Error handling implemented
- [x] TypeScript integration complete
- [x] UI follows design patterns
- [x] State management updated
- [x] No breaking changes

## 🎯 Benefits
- **User Requested**: Directly addresses Issue #305
- **Clean Implementation**: Follows all project standards
- **Non-Breaking**: Adds new functionality without affecting existing features
- **Well Documented**: Comprehensive docs and comments
- **Error Handling**: Robust error handling and user feedback

This feature is ready for immediate integration into the opcode project!