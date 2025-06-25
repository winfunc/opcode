#[allow(unused)]
pub mod defaults;
#[allow(unused)]
pub mod executor;
#[allow(unused)]
pub mod platform;
#[allow(unused)]
pub mod profile;

// These are used in agents.rs and claude.rs via direct module paths
#[allow(unused)]
pub use profile::{ProfileBuilder, SandboxProfile, SandboxRule};
// These are used in main.rs and sandbox.rs
#[allow(unused)]
pub use executor::{should_activate_sandbox, SandboxExecutor};
// These are used in sandbox.rs
#[allow(unused)]
pub use platform::{get_platform_capabilities, PlatformCapabilities};
// Used for initial setup
#[allow(unused)]
pub use defaults::create_default_profiles;
