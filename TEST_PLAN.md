# Recent Directories Feature - Test Plan

## Automated Tests

### Setup
```bash
# Install dependencies
bun install

# Run all tests
bun run test

# Run tests in watch mode
bun run test:run

# Run with coverage
bun run test:coverage
```

### Test Coverage

#### Hook Tests (`src/hooks/__tests__/useRecentDirectories.test.ts`)
- ✅ **Initial Loading**: Loading state, existing directories, corrupted data handling, API errors
- ✅ **Adding Directories**: New directories, duplicate handling, 10-item limit, path validation, display name generation
- ✅ **Removing Directories**: Single removal, non-existent path handling
- ✅ **Clearing All**: Complete list clearing
- ✅ **Settings Persistence**: Save on add/remove/clear, error handling
- ✅ **Data Sorting**: Most recent first ordering

#### Component Tests (`src/components/__tests__/RecentDirectoriesDropdown.test.tsx`)
- ✅ **Loading State**: Shows loading indicator and disabled button
- ✅ **Empty State**: Disabled button with count, proper tooltips
- ✅ **With Directories**: Enabled button, dropdown content, directory selection
- ✅ **User Interactions**: Directory clicking, remove button, clear all
- ✅ **Accessibility**: ARIA labels, roles, tooltips
- ✅ **Time Formatting**: Relative time display (just now, minutes ago, hours ago, days ago, date)

## Manual Testing Checklist

### Prerequisites
- Claude Code application running via `bun run tauri dev`
- Clean slate (no existing recent directories)

### Test Scenarios

#### 1. Initial State
- [ ] Open new Claude Code session
- [ ] Verify "Recent (0)" button is visible and disabled
- [ ] Verify button tooltip shows "No recent directories"

#### 2. First Directory Usage
- [ ] Enter a project directory path (e.g., `/Users/your-name/projects/test-project`)
- [ ] Start a Claude Code session (enter any prompt)
- [ ] Verify the session starts successfully
- [ ] Close/restart Claude Code

#### 3. Recent Directories Appears
- [ ] Open new Claude Code session
- [ ] Verify "Recent (1)" button is now enabled
- [ ] Verify button tooltip shows "Select from recent directories"
- [ ] Click the Recent button
- [ ] Verify dropdown shows:
  - [ ] "Recent Directories" header
  - [ ] One directory entry with correct name and full path
  - [ ] Relative timestamp (e.g., "Just now", "2m ago")
  - [ ] X button for removal
  - [ ] "Clear all recent directories" option at bottom

#### 4. Directory Selection
- [ ] Click on the directory entry in dropdown
- [ ] Verify the path populates in the directory input field
- [ ] Verify dropdown closes automatically

#### 5. Multiple Directories
- [ ] Use 3-4 different directories over time
- [ ] Verify all appear in dropdown, sorted by most recent first
- [ ] Verify each shows correct timestamps
- [ ] Verify current directory (if any) is highlighted

#### 6. Directory Removal
- [ ] Open recent directories dropdown
- [ ] Click X button on one directory
- [ ] Verify directory is removed from list immediately
- [ ] Verify count updates in button text
- [ ] Verify removal doesn't select the directory (event propagation stopped)

#### 7. Clear All Functionality
- [ ] Have multiple directories in recent list
- [ ] Open dropdown and click "Clear all recent directories"
- [ ] Verify all directories are removed
- [ ] Verify button becomes disabled and shows "Recent (0)"

#### 8. Persistence Testing
- [ ] Add several directories to recent list
- [ ] Completely quit Claude Code application
- [ ] Restart Claude Code
- [ ] Verify recent directories persist and are loaded correctly

#### 9. Maximum Limit Testing
- [ ] Add 10+ different directories over time
- [ ] Verify only 10 most recent are kept
- [ ] Verify oldest directories are automatically removed

#### 10. Session Resume Testing
- [ ] Start a session with a directory
- [ ] Let session run, then resume it later
- [ ] Verify the directory is tracked as recently used
- [ ] Verify timestamp updates appropriately

#### 11. Error Handling
- [ ] Test with very long directory paths
- [ ] Test with special characters in paths
- [ ] Test with non-existent paths (should still be tracked)
- [ ] Verify UI remains stable in all cases

#### 12. Accessibility Testing
- [ ] Navigate using keyboard only (Tab, Enter, Escape)
- [ ] Verify screen reader compatibility (if available)
- [ ] Verify proper focus management
- [ ] Verify all interactive elements have proper labels

#### 13. Visual Testing
- [ ] Test with different window sizes
- [ ] Verify dropdown positioning doesn't go off-screen
- [ ] Verify text truncation works for long paths
- [ ] Verify timestamps are formatted consistently
- [ ] Test with system dark/light mode changes

#### 14. Integration Testing
- [ ] Verify feature works alongside file picker button
- [ ] Verify no conflicts with existing UI components
- [ ] Test with different project types and structures
- [ ] Verify performance with large directory lists

### Expected Behavior Summary

✅ **Basic Functionality**
- Tracks last 10 working directories automatically
- Persists across app restarts in `~/.claude/settings.json`
- Shows relative timestamps (just now, 2m ago, 3h ago, 2d ago, then dates)
- Sorts by most recent usage first

✅ **User Experience**
- Button disabled when no directories (prevents empty dropdown)
- Current directory highlighted in list
- Individual remove buttons with proper event handling
- Clear all option for bulk removal
- Proper loading states and error handling

✅ **Technical Reliability**
- Graceful handling of corrupted data
- API error recovery
- Proper React state management
- No memory leaks or performance issues

## Regression Testing

After any changes to the feature, verify:
- [ ] All automated tests pass (`bun run test:run`)
- [ ] No TypeScript errors (`bunx tsc --noEmit`)
- [ ] Rust tests still pass (`cargo test`)
- [ ] Feature works in actual Tauri application
- [ ] No new console errors or warnings

## Performance Considerations

- Settings are loaded once on hook mount
- Settings save operations are debounced/async
- Large directory lists (up to 10) should render smoothly
- Memory usage should remain stable during normal usage

---

**Test Status**: ✅ All automated tests passing  
**Manual Testing**: Ready for comprehensive manual validation  
**Ready for Production**: Pending successful manual test completion