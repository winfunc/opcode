# [Flutter Migration] Phase 1: Project Setup and Foundation

## Overview
Initialize Flutter project structure and set up foundational architecture for migrating from React/Tauri to Flutter.

## Tasks

### 1.1 Flutter Project Initialization
- [ ] Create new Flutter project in `src-flutter/` directory
- [ ] Configure Flutter desktop support (Windows, macOS, Linux)
- [ ] Set up project structure following Flutter best practices
- [ ] Configure build scripts and development commands
- [ ] Set up CI/CD pipeline for Flutter builds

### 1.2 Core Dependencies Setup
- [ ] Add essential packages:
  - `riverpod` or `bloc` for state management
  - `go_router` for navigation
  - `drift` for SQLite database (equivalent to rusqlite)
  - `window_manager` for custom window controls
  - `flutter_rust_bridge` for Rust FFI integration
- [ ] Configure platform-specific dependencies
- [ ] Set up code generation tools

### 1.3 Rust Backend Integration Strategy
- [ ] Create Rust FFI library from existing Tauri commands
- [ ] Implement `flutter_rust_bridge` bindings
- [ ] Set up shared library compilation for all platforms
- [ ] Create Rust API layer compatible with Flutter FFI
- [ ] Test basic Rust-Flutter communication

## Acceptance Criteria
- [ ] Flutter project builds successfully on all target platforms
- [ ] Basic Rust FFI communication is working
- [ ] Core dependencies are properly configured
- [ ] CI/CD pipeline is functional for Flutter builds

## Timeline
**Estimated Duration:** 2 weeks (Weeks 1-2)

## Priority
🔴 **Critical** - Foundation for entire migration

## Labels
`flutter-migration`, `phase-1`, `setup`, `foundation`

---
**Issue Template Instructions:**
- Copy this content when creating the GitHub issue
- Add labels: `flutter-migration`, `phase-1`, `setup`, `foundation`
- Set milestone if using project milestones
- Assign to relevant team members