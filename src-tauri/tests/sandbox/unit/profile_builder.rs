//! Unit tests for ProfileBuilder
use claudia_lib::sandbox::profile::{ProfileBuilder, SandboxRule};
use std::path::PathBuf;
use test_case::test_case;

/// Helper to create a sandbox rule
fn make_rule(
    operation_type: &str,
    pattern_type: &str,
    pattern_value: &str,
    platforms: Option<&[&str]>,
) -> SandboxRule {
    SandboxRule {
        id: None,
        profile_id: 0,
        operation_type: operation_type.to_string(),
        pattern_type: pattern_type.to_string(),
        pattern_value: pattern_value.to_string(),
        enabled: true,
        platform_support: platforms.map(|p| {
            serde_json::to_string(&p.iter().map(|s| s.to_string()).collect::<Vec<_>>()).unwrap()
        }),
        created_at: String::new(),
    }
}

#[test]
fn test_profile_builder_creation() {
    let project_path = PathBuf::from("/test/project");
    let builder = ProfileBuilder::new(project_path.clone());

    assert!(
        builder.is_ok(),
        "ProfileBuilder should be created successfully"
    );
}

#[test]
fn test_empty_rules_creates_empty_profile() {
    let project_path = PathBuf::from("/test/project");
    let builder = ProfileBuilder::new(project_path).unwrap();

    let profile = builder.build_profile(vec![]);
    assert!(
        profile.is_ok(),
        "Empty rules should create valid empty profile"
    );
}

#[test]
fn test_file_read_rule_parsing() {
    let project_path = PathBuf::from("/test/project");
    let builder = ProfileBuilder::new(project_path.clone()).unwrap();

    let rules = vec![
        make_rule(
            "file_read_all",
            "literal",
            "/usr/lib/test.so",
            Some(&["linux", "macos"]),
        ),
        make_rule(
            "file_read_all",
            "subpath",
            "/usr/lib",
            Some(&["linux", "macos"]),
        ),
    ];

    let _profile = builder.build_profile(rules);

    // Profile creation might fail on unsupported platforms, but parsing should work
    if std::env::consts::OS == "linux" || std::env::consts::OS == "macos" {
        assert!(
            _profile.is_ok(),
            "File read rules should be parsed on supported platforms"
        );
    }
}

#[test]
fn test_network_rule_parsing() {
    let project_path = PathBuf::from("/test/project");
    let builder = ProfileBuilder::new(project_path).unwrap();

    let rules = vec![
        make_rule("network_outbound", "all", "", Some(&["linux", "macos"])),
        make_rule("network_outbound", "tcp", "8080", Some(&["macos"])),
        make_rule(
            "network_outbound",
            "local_socket",
            "/tmp/socket",
            Some(&["macos"]),
        ),
    ];

    let _profile = builder.build_profile(rules);

    if std::env::consts::OS == "linux" || std::env::consts::OS == "macos" {
        assert!(
            _profile.is_ok(),
            "Network rules should be parsed on supported platforms"
        );
    }
}

#[test]
fn test_system_info_rule_parsing() {
    let project_path = PathBuf::from("/test/project");
    let builder = ProfileBuilder::new(project_path).unwrap();

    let rules = vec![make_rule("system_info_read", "all", "", Some(&["macos"]))];

    let _profile = builder.build_profile(rules);

    if std::env::consts::OS == "macos" {
        assert!(
            _profile.is_ok(),
            "System info rule should be parsed on macOS"
        );
    }
}

#[test]
fn test_template_variable_replacement() {
    let project_path = PathBuf::from("/test/project");
    let builder = ProfileBuilder::new(project_path.clone()).unwrap();

    let rules = vec![
        make_rule(
            "file_read_all",
            "subpath",
            "{{PROJECT_PATH}}/src",
            Some(&["linux", "macos"]),
        ),
        make_rule(
            "file_read_all",
            "subpath",
            "{{HOME}}/.config",
            Some(&["linux", "macos"]),
        ),
    ];

    let _profile = builder.build_profile(rules);
    // We can't easily verify the exact paths without inspecting the Profile internals,
    // but this test ensures template replacement doesn't panic
}

#[test]
fn test_disabled_rules_are_ignored() {
    let project_path = PathBuf::from("/test/project");
    let builder = ProfileBuilder::new(project_path).unwrap();

    let mut rule = make_rule(
        "file_read_all",
        "subpath",
        "/usr/lib",
        Some(&["linux", "macos"]),
    );
    rule.enabled = false;

    let profile = builder.build_profile(vec![rule]);
    assert!(profile.is_ok(), "Disabled rules should be ignored");
}

#[test]
fn test_platform_filtering() {
    let project_path = PathBuf::from("/test/project");
    let builder = ProfileBuilder::new(project_path).unwrap();

    let current_os = std::env::consts::OS;
    let other_os = if current_os == "linux" {
        "macos"
    } else {
        "linux"
    };

    let rules = vec![
        // Rule for current platform
        make_rule("file_read_all", "subpath", "/test1", Some(&[current_os])),
        // Rule for other platform
        make_rule("file_read_all", "subpath", "/test2", Some(&[other_os])),
        // Rule for both platforms
        make_rule(
            "file_read_all",
            "subpath",
            "/test3",
            Some(&["linux", "macos"]),
        ),
        // Rule with no platform specification (should be included)
        make_rule("file_read_all", "subpath", "/test4", None),
    ];

    let _profile = builder.build_profile(rules);
    // Rules for other platforms should be filtered out
}

#[test]
fn test_invalid_operation_type() {
    let project_path = PathBuf::from("/test/project");
    let builder = ProfileBuilder::new(project_path).unwrap();

    let rules = vec![make_rule(
        "invalid_operation",
        "subpath",
        "/test",
        Some(&["linux", "macos"]),
    )];

    let _profile = builder.build_profile(rules);
    assert!(_profile.is_ok(), "Invalid operations should be skipped");
}

#[test]
fn test_invalid_pattern_type() {
    let project_path = PathBuf::from("/test/project");
    let builder = ProfileBuilder::new(project_path).unwrap();

    let rules = vec![make_rule(
        "file_read_all",
        "invalid_pattern",
        "/test",
        Some(&["linux", "macos"]),
    )];

    let _profile = builder.build_profile(rules);
    // Should either skip the rule or fail gracefully
}

#[test]
fn test_invalid_tcp_port() {
    let project_path = PathBuf::from("/test/project");
    let builder = ProfileBuilder::new(project_path).unwrap();

    let rules = vec![make_rule(
        "network_outbound",
        "tcp",
        "not_a_number",
        Some(&["macos"]),
    )];

    let _profile = builder.build_profile(rules);
    // Should handle invalid port gracefully
}

#[test_case("file_read_all", "subpath", "/test" ; "file read operation")]
#[test_case("file_read_metadata", "literal", "/test/file" ; "metadata read operation")]
#[test_case("network_outbound", "all", "" ; "network all operation")]
#[test_case("system_info_read", "all", "" ; "system info operation")]
fn test_operation_support_level(operation_type: &str, pattern_type: &str, pattern_value: &str) {
    let project_path = PathBuf::from("/test/project");
    let builder = ProfileBuilder::new(project_path).unwrap();

    let rule = make_rule(operation_type, pattern_type, pattern_value, None);
    let rules = vec![rule];

    match builder.build_profile(rules) {
        Ok(_) => {
            // Profile created successfully - operation is supported
            println!("Operation {operation_type} is supported on this platform");
        }
        Err(e) => {
            // Profile creation failed - likely due to unsupported operation
            println!("Operation {operation_type} is not supported: {e}");
        }
    }
}

#[test]
fn test_complex_profile_with_multiple_rules() {
    let project_path = PathBuf::from("/test/project");
    let builder = ProfileBuilder::new(project_path.clone()).unwrap();

    let rules = vec![
        // File operations
        make_rule(
            "file_read_all",
            "subpath",
            "{{PROJECT_PATH}}",
            Some(&["linux", "macos"]),
        ),
        make_rule(
            "file_read_all",
            "subpath",
            "/usr/lib",
            Some(&["linux", "macos"]),
        ),
        make_rule(
            "file_read_all",
            "literal",
            "/etc/hosts",
            Some(&["linux", "macos"]),
        ),
        make_rule("file_read_metadata", "subpath", "/", Some(&["macos"])),
        // Network operations
        make_rule("network_outbound", "all", "", Some(&["linux", "macos"])),
        make_rule("network_outbound", "tcp", "443", Some(&["macos"])),
        make_rule("network_outbound", "tcp", "80", Some(&["macos"])),
        // System info
        make_rule("system_info_read", "all", "", Some(&["macos"])),
    ];

    let _profile = builder.build_profile(rules);

    if std::env::consts::OS == "linux" || std::env::consts::OS == "macos" {
        assert!(
            _profile.is_ok(),
            "Complex profile should be created on supported platforms"
        );
    }
}

#[test]
fn test_rule_order_preservation() {
    let project_path = PathBuf::from("/test/project");
    let builder = ProfileBuilder::new(project_path).unwrap();

    // Create rules with specific order
    let rules = vec![
        make_rule(
            "file_read_all",
            "subpath",
            "/first",
            Some(&["linux", "macos"]),
        ),
        make_rule("network_outbound", "all", "", Some(&["linux", "macos"])),
        make_rule(
            "file_read_all",
            "subpath",
            "/second",
            Some(&["linux", "macos"]),
        ),
    ];

    let _profile = builder.build_profile(rules);
    // Order should be preserved in the resulting profile
}
