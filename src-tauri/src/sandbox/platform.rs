use serde::{Deserialize, Serialize};
use std::env;

/// Represents the sandbox capabilities of the current platform
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlatformCapabilities {
    /// The current operating system
    pub os: String,
    /// Whether sandboxing is supported on this platform
    pub sandboxing_supported: bool,
    /// Supported operations and their support levels
    pub operations: Vec<OperationSupport>,
    /// Platform-specific notes or warnings
    pub notes: Vec<String>,
}

/// Represents support for a specific operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OperationSupport {
    /// The operation type
    pub operation: String,
    /// Support level: "never", "can_be_allowed", "cannot_be_precisely", "always"
    pub support_level: String,
    /// Human-readable description
    pub description: String,
}

/// Get the platform capabilities for sandboxing
pub fn get_platform_capabilities() -> PlatformCapabilities {
    let os = env::consts::OS;

    match os {
        "linux" => get_linux_capabilities(),
        "macos" => get_macos_capabilities(),
        "freebsd" => get_freebsd_capabilities(),
        _ => get_unsupported_capabilities(os),
    }
}

fn get_linux_capabilities() -> PlatformCapabilities {
    PlatformCapabilities {
        os: "linux".to_string(),
        sandboxing_supported: true,
        operations: vec![
            OperationSupport {
                operation: "file_read_all".to_string(),
                support_level: "can_be_allowed".to_string(),
                description: "Can allow file reading via bind mounts in chroot jail".to_string(),
            },
            OperationSupport {
                operation: "file_read_metadata".to_string(),
                support_level: "cannot_be_precisely".to_string(),
                description: "Cannot be precisely controlled, allowed if file read is allowed".to_string(),
            },
            OperationSupport {
                operation: "network_outbound_all".to_string(),
                support_level: "can_be_allowed".to_string(),
                description: "Can allow all network access by not creating network namespace".to_string(),
            },
            OperationSupport {
                operation: "network_outbound_tcp".to_string(),
                support_level: "cannot_be_precisely".to_string(),
                description: "Cannot filter by specific ports with seccomp".to_string(),
            },
            OperationSupport {
                operation: "network_outbound_local".to_string(),
                support_level: "cannot_be_precisely".to_string(),
                description: "Cannot filter by specific socket paths with seccomp".to_string(),
            },
            OperationSupport {
                operation: "system_info_read".to_string(),
                support_level: "never".to_string(),
                description: "Not supported on Linux".to_string(),
            },
        ],
        notes: vec![
            "Linux sandboxing uses namespaces (user, PID, IPC, mount, UTS, network) and seccomp-bpf".to_string(),
            "File access is controlled via bind mounts in a chroot jail".to_string(),
            "Network filtering is all-or-nothing (cannot filter by port/address)".to_string(),
            "Process creation and privilege escalation are always blocked".to_string(),
        ],
    }
}

fn get_macos_capabilities() -> PlatformCapabilities {
    PlatformCapabilities {
        os: "macos".to_string(),
        sandboxing_supported: true,
        operations: vec![
            OperationSupport {
                operation: "file_read_all".to_string(),
                support_level: "can_be_allowed".to_string(),
                description: "Can allow file reading with Seatbelt profiles".to_string(),
            },
            OperationSupport {
                operation: "file_read_metadata".to_string(),
                support_level: "can_be_allowed".to_string(),
                description: "Can allow metadata reading with Seatbelt profiles".to_string(),
            },
            OperationSupport {
                operation: "network_outbound_all".to_string(),
                support_level: "can_be_allowed".to_string(),
                description: "Can allow all network access".to_string(),
            },
            OperationSupport {
                operation: "network_outbound_tcp".to_string(),
                support_level: "can_be_allowed".to_string(),
                description: "Can allow specific TCP ports".to_string(),
            },
            OperationSupport {
                operation: "network_outbound_local".to_string(),
                support_level: "can_be_allowed".to_string(),
                description: "Can allow specific local socket paths".to_string(),
            },
            OperationSupport {
                operation: "system_info_read".to_string(),
                support_level: "can_be_allowed".to_string(),
                description: "Can allow sysctl reads".to_string(),
            },
        ],
        notes: vec![
            "macOS sandboxing uses Seatbelt (sandbox_init API)".to_string(),
            "More fine-grained control compared to Linux".to_string(),
            "Can filter network access by port and socket path".to_string(),
            "Supports platform-specific operations like Mach port lookups".to_string(),
        ],
    }
}

fn get_freebsd_capabilities() -> PlatformCapabilities {
    PlatformCapabilities {
        os: "freebsd".to_string(),
        sandboxing_supported: true,
        operations: vec![
            OperationSupport {
                operation: "system_info_read".to_string(),
                support_level: "always".to_string(),
                description: "Always allowed with Capsicum".to_string(),
            },
            OperationSupport {
                operation: "file_read_all".to_string(),
                support_level: "never".to_string(),
                description: "Not supported with current Capsicum implementation".to_string(),
            },
            OperationSupport {
                operation: "file_read_metadata".to_string(),
                support_level: "never".to_string(),
                description: "Not supported with current Capsicum implementation".to_string(),
            },
            OperationSupport {
                operation: "network_outbound_all".to_string(),
                support_level: "never".to_string(),
                description: "Not supported with current Capsicum implementation".to_string(),
            },
        ],
        notes: vec![
            "FreeBSD support is very limited in gaol".to_string(),
            "Uses Capsicum for capability-based security".to_string(),
            "Most operations are not supported".to_string(),
        ],
    }
}

fn get_unsupported_capabilities(os: &str) -> PlatformCapabilities {
    PlatformCapabilities {
        os: os.to_string(),
        sandboxing_supported: false,
        operations: vec![],
        notes: vec![
            format!("Sandboxing is not supported on {} platform", os),
            "Claude Code will run without sandbox restrictions".to_string(),
        ],
    }
}

/// Check if sandboxing is available on the current platform
pub fn is_sandboxing_available() -> bool {
    matches!(env::consts::OS, "linux" | "macos" | "freebsd")
}
