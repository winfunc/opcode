//! Unit tests for platform capabilities
use claudia_lib::sandbox::platform::{get_platform_capabilities, is_sandboxing_available};
use pretty_assertions::assert_eq;
use std::env;

#[test]
fn test_sandboxing_availability() {
    let is_available = is_sandboxing_available();
    let expected = matches!(env::consts::OS, "linux" | "macos" | "freebsd");

    assert_eq!(
        is_available, expected,
        "Sandboxing availability should match platform support"
    );
}

#[test]
fn test_platform_capabilities_structure() {
    let caps = get_platform_capabilities();

    // Verify basic structure
    assert_eq!(caps.os, env::consts::OS, "OS should match current platform");
    assert!(
        !caps.operations.is_empty() || !caps.sandboxing_supported,
        "Should have operations if sandboxing is supported"
    );
    assert!(
        !caps.notes.is_empty(),
        "Should have platform-specific notes"
    );
}

#[test]
#[cfg(target_os = "linux")]
fn test_linux_capabilities() {
    let caps = get_platform_capabilities();

    assert_eq!(caps.os, "linux");
    assert!(caps.sandboxing_supported);

    // Verify Linux-specific capabilities
    let file_read = caps
        .operations
        .iter()
        .find(|op| op.operation == "file_read_all")
        .expect("file_read_all should be present");
    assert_eq!(file_read.support_level, "can_be_allowed");

    let metadata_read = caps
        .operations
        .iter()
        .find(|op| op.operation == "file_read_metadata")
        .expect("file_read_metadata should be present");
    assert_eq!(metadata_read.support_level, "cannot_be_precisely");

    let network_all = caps
        .operations
        .iter()
        .find(|op| op.operation == "network_outbound_all")
        .expect("network_outbound_all should be present");
    assert_eq!(network_all.support_level, "can_be_allowed");

    let network_tcp = caps
        .operations
        .iter()
        .find(|op| op.operation == "network_outbound_tcp")
        .expect("network_outbound_tcp should be present");
    assert_eq!(network_tcp.support_level, "cannot_be_precisely");

    let system_info = caps
        .operations
        .iter()
        .find(|op| op.operation == "system_info_read")
        .expect("system_info_read should be present");
    assert_eq!(system_info.support_level, "never");
}

#[test]
#[cfg(target_os = "macos")]
fn test_macos_capabilities() {
    let caps = get_platform_capabilities();

    assert_eq!(caps.os, "macos");
    assert!(caps.sandboxing_supported);

    // Verify macOS-specific capabilities
    let file_read = caps
        .operations
        .iter()
        .find(|op| op.operation == "file_read_all")
        .expect("file_read_all should be present");
    assert_eq!(file_read.support_level, "can_be_allowed");

    let metadata_read = caps
        .operations
        .iter()
        .find(|op| op.operation == "file_read_metadata")
        .expect("file_read_metadata should be present");
    assert_eq!(metadata_read.support_level, "can_be_allowed");

    let network_tcp = caps
        .operations
        .iter()
        .find(|op| op.operation == "network_outbound_tcp")
        .expect("network_outbound_tcp should be present");
    assert_eq!(network_tcp.support_level, "can_be_allowed");

    let system_info = caps
        .operations
        .iter()
        .find(|op| op.operation == "system_info_read")
        .expect("system_info_read should be present");
    assert_eq!(system_info.support_level, "can_be_allowed");
}

#[test]
#[cfg(target_os = "freebsd")]
fn test_freebsd_capabilities() {
    let caps = get_platform_capabilities();

    assert_eq!(caps.os, "freebsd");
    assert!(caps.sandboxing_supported);

    // Verify FreeBSD-specific capabilities
    let file_read = caps
        .operations
        .iter()
        .find(|op| op.operation == "file_read_all")
        .expect("file_read_all should be present");
    assert_eq!(file_read.support_level, "never");

    let system_info = caps
        .operations
        .iter()
        .find(|op| op.operation == "system_info_read")
        .expect("system_info_read should be present");
    assert_eq!(system_info.support_level, "always");
}

#[test]
#[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "freebsd")))]
fn test_unsupported_platform_capabilities() {
    let caps = get_platform_capabilities();

    assert!(!caps.sandboxing_supported);
    assert_eq!(caps.operations.len(), 0);
    assert!(caps.notes.iter().any(|note| note.contains("not supported")));
}

#[test]
fn test_all_operations_have_descriptions() {
    let caps = get_platform_capabilities();

    for op in &caps.operations {
        assert!(
            !op.description.is_empty(),
            "Operation {} should have a description",
            op.operation
        );
        assert!(
            !op.support_level.is_empty(),
            "Operation {} should have a support level",
            op.operation
        );
    }
}

#[test]
fn test_support_level_values() {
    let caps = get_platform_capabilities();
    let valid_levels = ["never", "can_be_allowed", "cannot_be_precisely", "always"];

    for op in &caps.operations {
        assert!(
            valid_levels.contains(&op.support_level.as_str()),
            "Operation {} has invalid support level: {}",
            op.operation,
            op.support_level
        );
    }
}
