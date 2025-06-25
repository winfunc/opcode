//! Comprehensive test suite for sandbox functionality
//!
//! This test suite validates the sandboxing capabilities across different platforms,
//! ensuring that security policies are correctly enforced.

#[cfg(unix)]
#[macro_use]
pub mod common;

#[cfg(unix)]
pub mod unit;

#[cfg(unix)]
pub mod integration;

#[cfg(unix)]
pub mod e2e;
