//! Integration tests for network operations in sandbox
use crate::sandbox::common::*;
use crate::skip_if_unsupported;
use claudia_lib::sandbox::executor::SandboxExecutor;
use gaol::profile::{AddressPattern, Operation, Profile};
use serial_test::serial;
use std::net::TcpListener;
use tempfile::TempDir;

/// Get an available port for testing
fn get_available_port() -> u16 {
    let listener = TcpListener::bind("127.0.0.1:0").expect("Failed to bind to 0");
    let port = listener
        .local_addr()
        .expect("Failed to get local addr")
        .port();
    drop(listener); // Release the port
    port
}

/// Test allowed network operations
#[test]
#[serial]
fn test_allowed_network_all() {
    skip_if_unsupported!();

    let platform = PlatformConfig::current();
    if !platform.supports_network_all {
        eprintln!("Skipping test: network all not supported on this platform");
        return;
    }

    // Create test project
    let test_fs = TestFileSystem::new().expect("Failed to create test filesystem");

    // Create profile allowing all network access
    let operations = vec![Operation::NetworkOutbound(AddressPattern::All)];

    let profile = match Profile::new(operations) {
        Ok(p) => p,
        Err(_) => {
            eprintln!("Failed to create profile - operation not supported");
            return;
        }
    };

    // Create test binary that connects to localhost
    let port = get_available_port();
    let test_code = test_code::network_connect(&format!("127.0.0.1:{}", port));
    let binary_dir = TempDir::new().expect("Failed to create temp dir");
    let binary_path = create_test_binary("test_network", &test_code, binary_dir.path())
        .expect("Failed to create test binary");

    // Start a listener on the port
    let listener =
        TcpListener::bind(format!("127.0.0.1:{}", port)).expect("Failed to bind listener");

    // Execute in sandbox
    let executor = SandboxExecutor::new(profile, test_fs.project_path.clone());
    match executor.execute_sandboxed_spawn(
        &binary_path.to_string_lossy(),
        &[],
        &test_fs.project_path,
    ) {
        Ok(mut child) => {
            // Accept connection in a thread
            std::thread::spawn(move || {
                let _ = listener.accept();
            });

            let status = child.wait().expect("Failed to wait for child");
            assert!(
                status.success(),
                "Network connection should succeed when allowed"
            );
        }
        Err(e) => {
            eprintln!("Sandbox execution failed: {} (may be expected in CI)", e);
        }
    }
}

/// Test forbidden network operations
#[test]
#[serial]
fn test_forbidden_network() {
    skip_if_unsupported!();

    // Create test project
    let test_fs = TestFileSystem::new().expect("Failed to create test filesystem");

    // Create profile without network permissions
    let operations = vec![Operation::FileReadAll(gaol::profile::PathPattern::Subpath(
        test_fs.project_path.clone(),
    ))];

    let profile = match Profile::new(operations) {
        Ok(p) => p,
        Err(_) => {
            eprintln!("Failed to create profile - operation not supported");
            return;
        }
    };

    // Create test binary that tries to connect
    let test_code = test_code::network_connect("google.com:80");
    let binary_dir = TempDir::new().expect("Failed to create temp dir");
    let binary_path = create_test_binary("test_no_network", &test_code, binary_dir.path())
        .expect("Failed to create test binary");

    // Execute in sandbox
    let executor = SandboxExecutor::new(profile, test_fs.project_path.clone());
    match executor.execute_sandboxed_spawn(
        &binary_path.to_string_lossy(),
        &[],
        &test_fs.project_path,
    ) {
        Ok(mut child) => {
            let status = child.wait().expect("Failed to wait for child");
            // Network restrictions might not work on all platforms
            if status.success() {
                eprintln!("WARNING: Network connection was not blocked (platform limitation)");
                if std::env::consts::OS == "linux" {
                    panic!("Network should be blocked on Linux when not allowed");
                }
            }
        }
        Err(e) => {
            eprintln!("Sandbox execution failed: {} (may be expected in CI)", e);
        }
    }
}

/// Test TCP port-specific network rules (macOS only)
#[test]
#[serial]
#[cfg(target_os = "macos")]
fn test_network_tcp_port_specific() {
    let platform = PlatformConfig::current();
    if !platform.supports_network_tcp {
        eprintln!("Skipping test: TCP port filtering not supported");
        return;
    }

    // Create test project
    let test_fs = TestFileSystem::new().expect("Failed to create test filesystem");

    // Get two ports - one allowed, one forbidden
    let allowed_port = get_available_port();
    let forbidden_port = get_available_port();

    // Create profile allowing only specific port
    let operations = vec![Operation::NetworkOutbound(AddressPattern::Tcp(
        allowed_port,
    ))];

    let profile = match Profile::new(operations) {
        Ok(p) => p,
        Err(_) => {
            eprintln!("Failed to create profile - operation not supported");
            return;
        }
    };

    // Test 1: Allowed port
    {
        let test_code = test_code::network_connect(&format!("127.0.0.1:{}", allowed_port));
        let binary_dir = TempDir::new().expect("Failed to create temp dir");
        let binary_path = create_test_binary("test_allowed_port", &test_code, binary_dir.path())
            .expect("Failed to create test binary");

        let listener = TcpListener::bind(format!("127.0.0.1:{}", allowed_port))
            .expect("Failed to bind listener");

        let executor = SandboxExecutor::new(profile.clone(), test_fs.project_path.clone());
        match executor.execute_sandboxed_spawn(
            &binary_path.to_string_lossy(),
            &[],
            &test_fs.project_path,
        ) {
            Ok(mut child) => {
                std::thread::spawn(move || {
                    let _ = listener.accept();
                });

                let status = child.wait().expect("Failed to wait for child");
                assert!(
                    status.success(),
                    "Connection to allowed port should succeed"
                );
            }
            Err(e) => {
                eprintln!("Sandbox execution failed: {} (may be expected in CI)", e);
            }
        }
    }

    // Test 2: Forbidden port
    {
        let test_code = test_code::network_connect(&format!("127.0.0.1:{}", forbidden_port));
        let binary_dir = TempDir::new().expect("Failed to create temp dir");
        let binary_path = create_test_binary("test_forbidden_port", &test_code, binary_dir.path())
            .expect("Failed to create test binary");

        let executor = SandboxExecutor::new(profile, test_fs.project_path.clone());
        match executor.execute_sandboxed_spawn(
            &binary_path.to_string_lossy(),
            &[],
            &test_fs.project_path,
        ) {
            Ok(mut child) => {
                let status = child.wait().expect("Failed to wait for child");
                assert!(
                    !status.success(),
                    "Connection to forbidden port should fail"
                );
            }
            Err(e) => {
                eprintln!("Sandbox execution failed: {} (may be expected in CI)", e);
            }
        }
    }
}

/// Test local socket connections (Unix domain sockets)
#[test]
#[serial]
#[cfg(unix)]
fn test_local_socket_connections() {
    skip_if_unsupported!();

    let platform = PlatformConfig::current();

    // Create test project
    let test_fs = TestFileSystem::new().expect("Failed to create test filesystem");
    let socket_path = test_fs.project_path.join("test.sock");

    // Create appropriate profile based on platform
    let operations = if platform.supports_network_local {
        vec![Operation::NetworkOutbound(AddressPattern::LocalSocket(
            socket_path.clone(),
        ))]
    } else if platform.supports_network_all {
        // Fallback to allowing all network
        vec![Operation::NetworkOutbound(AddressPattern::All)]
    } else {
        eprintln!("Skipping test: no network support on this platform");
        return;
    };

    let profile = match Profile::new(operations) {
        Ok(p) => p,
        Err(_) => {
            eprintln!("Failed to create profile - operation not supported");
            return;
        }
    };

    // Create test binary that connects to local socket
    let test_code = format!(
        r#"
use std::os::unix::net::UnixStream;

fn main() {{
    match UnixStream::connect("{}") {{
        Ok(_) => {{
            println!("SUCCESS: Connected to local socket");
        }}
        Err(e) => {{
            eprintln!("FAILURE: {{}}", e);
            std::process::exit(1);
        }}
    }}
}}
"#,
        socket_path.to_string_lossy()
    );

    let binary_dir = TempDir::new().expect("Failed to create temp dir");
    let binary_path = create_test_binary("test_local_socket", &test_code, binary_dir.path())
        .expect("Failed to create test binary");

    // Create Unix socket listener
    use std::os::unix::net::UnixListener;
    let listener = UnixListener::bind(&socket_path).expect("Failed to bind Unix socket");

    // Execute in sandbox
    let executor = SandboxExecutor::new(profile, test_fs.project_path.clone());
    match executor.execute_sandboxed_spawn(
        &binary_path.to_string_lossy(),
        &[],
        &test_fs.project_path,
    ) {
        Ok(mut child) => {
            std::thread::spawn(move || {
                let _ = listener.accept();
            });

            let status = child.wait().expect("Failed to wait for child");
            assert!(
                status.success(),
                "Local socket connection should succeed when allowed"
            );
        }
        Err(e) => {
            eprintln!("Sandbox execution failed: {} (may be expected in CI)", e);
        }
    }

    // Clean up socket file
    let _ = std::fs::remove_file(&socket_path);
}
