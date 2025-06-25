use crate::sandbox::executor::{SerializedOperation, SerializedProfile};
use anyhow::{Context, Result};
#[cfg(unix)]
use gaol::profile::{AddressPattern, Operation, OperationSupport, PathPattern, Profile};
use log::{debug, info, warn};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Represents a sandbox profile from the database
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SandboxProfile {
    pub id: Option<i64>,
    pub name: String,
    pub description: Option<String>,
    pub is_active: bool,
    pub is_default: bool,
    pub created_at: String,
    pub updated_at: String,
}

/// Represents a sandbox rule from the database
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SandboxRule {
    pub id: Option<i64>,
    pub profile_id: i64,
    pub operation_type: String,
    pub pattern_type: String,
    pub pattern_value: String,
    pub enabled: bool,
    pub platform_support: Option<String>,
    pub created_at: String,
}

/// Result of building a profile
pub struct ProfileBuildResult {
    #[cfg(unix)]
    pub profile: Profile,
    #[cfg(not(unix))]
    pub profile: (), // Placeholder for Windows
    pub serialized: SerializedProfile,
}

/// Builder for creating gaol profiles from database configuration
pub struct ProfileBuilder {
    project_path: PathBuf,
    home_dir: PathBuf,
}

impl ProfileBuilder {
    /// Create a new profile builder
    pub fn new(project_path: PathBuf) -> Result<Self> {
        let home_dir = dirs::home_dir().context("Could not determine home directory")?;

        Ok(Self {
            project_path,
            home_dir,
        })
    }

    /// Build a gaol Profile from database rules filtered by agent permissions
    pub fn build_agent_profile(
        &self,
        rules: Vec<SandboxRule>,
        sandbox_enabled: bool,
        enable_file_read: bool,
        enable_file_write: bool,
        enable_network: bool,
    ) -> Result<ProfileBuildResult> {
        // If sandbox is completely disabled, return an empty profile
        if !sandbox_enabled {
            return Ok(ProfileBuildResult {
                #[cfg(unix)]
                profile: Profile::new(vec![])
                    .map_err(|_| anyhow::anyhow!("Failed to create empty profile"))?,
                #[cfg(not(unix))]
                profile: (),
                serialized: SerializedProfile { operations: vec![] },
            });
        }

        let mut filtered_rules = Vec::new();

        for rule in rules {
            if !rule.enabled {
                continue;
            }

            // Filter rules based on agent permissions
            let include_rule = match rule.operation_type.as_str() {
                "file_read_all" | "file_read_metadata" => enable_file_read,
                "network_outbound" => enable_network,
                "system_info_read" => true, // Always allow system info reading
                _ => true,                  // Include unknown rule types by default
            };

            if include_rule {
                filtered_rules.push(rule);
            }
        }

        // Always ensure project path access if file reading is enabled
        if enable_file_read {
            let has_project_access = filtered_rules.iter().any(|rule| {
                rule.operation_type == "file_read_all"
                    && rule.pattern_type == "subpath"
                    && rule.pattern_value.contains("{{PROJECT_PATH}}")
            });

            if !has_project_access {
                // Add a default project access rule
                filtered_rules.push(SandboxRule {
                    id: None,
                    profile_id: 0,
                    operation_type: "file_read_all".to_string(),
                    pattern_type: "subpath".to_string(),
                    pattern_value: "{{PROJECT_PATH}}".to_string(),
                    enabled: true,
                    platform_support: None,
                    created_at: String::new(),
                });
            }
        }

        self.build_profile_with_serialization(filtered_rules)
    }

    /// Build a gaol Profile from database rules
    #[cfg(unix)]
    pub fn build_profile(&self, rules: Vec<SandboxRule>) -> Result<Profile> {
        let result = self.build_profile_with_serialization(rules)?;
        Ok(result.profile)
    }

    /// Build a gaol Profile from database rules (Windows stub)
    #[cfg(not(unix))]
    pub fn build_profile(&self, _rules: Vec<SandboxRule>) -> Result<()> {
        warn!("Sandbox profiles are not supported on Windows");
        Ok(())
    }

    /// Build a gaol Profile from database rules and return serialized operations
    pub fn build_profile_with_serialization(
        &self,
        rules: Vec<SandboxRule>,
    ) -> Result<ProfileBuildResult> {
        #[cfg(unix)]
        {
            let mut operations = Vec::new();
            let mut serialized_operations = Vec::new();

            for rule in rules {
                if !rule.enabled {
                    continue;
                }

                // Check platform support
                if !self.is_rule_supported_on_platform(&rule) {
                    debug!(
                        "Skipping rule {} - not supported on current platform",
                        rule.operation_type
                    );
                    continue;
                }

                match self.build_operation_with_serialization(&rule) {
                    Ok(Some((op, serialized))) => {
                        // Check if operation is supported on current platform
                        if matches!(
                            op.support(),
                            gaol::profile::OperationSupportLevel::CanBeAllowed
                        ) {
                            operations.push(op);
                            serialized_operations.push(serialized);
                        } else {
                            warn!(
                                "Operation {:?} not supported at desired level on current platform",
                                rule.operation_type
                            );
                        }
                    }
                    Ok(None) => {
                        debug!(
                            "Skipping unsupported operation type: {}",
                            rule.operation_type
                        );
                    }
                    Err(e) => {
                        warn!(
                            "Failed to build operation for rule {}: {}",
                            rule.id.unwrap_or(0),
                            e
                        );
                    }
                }
            }

            // Ensure project path access is included
            let has_project_access = serialized_operations.iter().any(|op| {
                matches!(op, SerializedOperation::FileReadAll { path, is_subpath: true } if path == &self.project_path)
            });

            if !has_project_access {
                operations.push(Operation::FileReadAll(PathPattern::Subpath(
                    self.project_path.clone(),
                )));
                serialized_operations.push(SerializedOperation::FileReadAll {
                    path: self.project_path.clone(),
                    is_subpath: true,
                });
            }

            // Create the profile
            let profile = Profile::new(operations)
                .map_err(|_| anyhow::anyhow!("Failed to create sandbox profile - some operations may not be supported on this platform"))?;

            Ok(ProfileBuildResult {
                profile,
                serialized: SerializedProfile {
                    operations: serialized_operations,
                },
            })
        }

        #[cfg(not(unix))]
        {
            // On Windows, we just create a serialized profile without actual sandboxing
            let mut serialized_operations = Vec::new();

            for rule in rules {
                if !rule.enabled {
                    continue;
                }

                if let Ok(Some(serialized)) = self.build_serialized_operation(&rule) {
                    serialized_operations.push(serialized);
                }
            }

            Ok(ProfileBuildResult {
                profile: (),
                serialized: SerializedProfile {
                    operations: serialized_operations,
                },
            })
        }
    }

    /// Build a gaol Operation from a database rule
    #[cfg(unix)]
    fn build_operation(&self, rule: &SandboxRule) -> Result<Option<Operation>> {
        match self.build_operation_with_serialization(rule) {
            Ok(Some((op, _))) => Ok(Some(op)),
            Ok(None) => Ok(None),
            Err(e) => Err(e),
        }
    }

    /// Build a gaol Operation and its serialized form from a database rule
    #[cfg(unix)]
    fn build_operation_with_serialization(
        &self,
        rule: &SandboxRule,
    ) -> Result<Option<(Operation, SerializedOperation)>> {
        match rule.operation_type.as_str() {
            "file_read_all" => {
                let (pattern, path, is_subpath) =
                    self.build_path_pattern_with_info(&rule.pattern_type, &rule.pattern_value)?;
                Ok(Some((
                    Operation::FileReadAll(pattern),
                    SerializedOperation::FileReadAll { path, is_subpath },
                )))
            }
            "file_read_metadata" => {
                let (pattern, path, is_subpath) =
                    self.build_path_pattern_with_info(&rule.pattern_type, &rule.pattern_value)?;
                Ok(Some((
                    Operation::FileReadMetadata(pattern),
                    SerializedOperation::FileReadMetadata { path, is_subpath },
                )))
            }
            "network_outbound" => {
                let (pattern, serialized) = self.build_address_pattern_with_serialization(
                    &rule.pattern_type,
                    &rule.pattern_value,
                )?;
                Ok(Some((Operation::NetworkOutbound(pattern), serialized)))
            }
            "system_info_read" => Ok(Some((
                Operation::SystemInfoRead,
                SerializedOperation::SystemInfoRead,
            ))),
            _ => Ok(None),
        }
    }

    /// Build a PathPattern from pattern type and value
    #[cfg(unix)]
    fn build_path_pattern(&self, pattern_type: &str, pattern_value: &str) -> Result<PathPattern> {
        let (pattern, _, _) = self.build_path_pattern_with_info(pattern_type, pattern_value)?;
        Ok(pattern)
    }

    /// Build a PathPattern and return additional info for serialization
    #[cfg(unix)]
    fn build_path_pattern_with_info(
        &self,
        pattern_type: &str,
        pattern_value: &str,
    ) -> Result<(PathPattern, PathBuf, bool)> {
        // Replace template variables
        let expanded_value = pattern_value
            .replace("{{PROJECT_PATH}}", &self.project_path.to_string_lossy())
            .replace("{{HOME}}", &self.home_dir.to_string_lossy());

        let path = PathBuf::from(expanded_value);

        match pattern_type {
            "literal" => Ok((PathPattern::Literal(path.clone()), path, false)),
            "subpath" => Ok((PathPattern::Subpath(path.clone()), path, true)),
            _ => Err(anyhow::anyhow!(
                "Unknown path pattern type: {}",
                pattern_type
            )),
        }
    }

    /// Build an AddressPattern from pattern type and value
    #[cfg(unix)]
    fn build_address_pattern(
        &self,
        pattern_type: &str,
        pattern_value: &str,
    ) -> Result<AddressPattern> {
        let (pattern, _) =
            self.build_address_pattern_with_serialization(pattern_type, pattern_value)?;
        Ok(pattern)
    }

    /// Build an AddressPattern and its serialized form
    #[cfg(unix)]
    fn build_address_pattern_with_serialization(
        &self,
        pattern_type: &str,
        pattern_value: &str,
    ) -> Result<(AddressPattern, SerializedOperation)> {
        match pattern_type {
            "all" => Ok((
                AddressPattern::All,
                SerializedOperation::NetworkOutbound {
                    pattern: "all".to_string(),
                },
            )),
            "tcp" => {
                let port = pattern_value
                    .parse::<u16>()
                    .context("Invalid TCP port number")?;
                Ok((
                    AddressPattern::Tcp(port),
                    SerializedOperation::NetworkTcp { port },
                ))
            }
            "local_socket" => {
                let path = PathBuf::from(pattern_value);
                Ok((
                    AddressPattern::LocalSocket(path.clone()),
                    SerializedOperation::NetworkLocalSocket { path },
                ))
            }
            _ => Err(anyhow::anyhow!(
                "Unknown address pattern type: {}",
                pattern_type
            )),
        }
    }

    /// Check if a rule is supported on the current platform
    fn is_rule_supported_on_platform(&self, rule: &SandboxRule) -> bool {
        if let Some(platforms_json) = &rule.platform_support {
            if let Ok(platforms) = serde_json::from_str::<Vec<String>>(platforms_json) {
                let current_os = std::env::consts::OS;
                return platforms.contains(&current_os.to_string());
            }
        }
        // If no platform support specified, assume it's supported
        true
    }

    /// Build only the serialized operation (for Windows)
    #[cfg(not(unix))]
    fn build_serialized_operation(
        &self,
        rule: &SandboxRule,
    ) -> Result<Option<SerializedOperation>> {
        let pattern_value = self.expand_pattern_value(&rule.pattern_value);

        match rule.operation_type.as_str() {
            "file_read_all" => {
                let (path, is_subpath) =
                    self.parse_path_pattern(&rule.pattern_type, &pattern_value)?;
                Ok(Some(SerializedOperation::FileReadAll { path, is_subpath }))
            }
            "file_read_metadata" => {
                let (path, is_subpath) =
                    self.parse_path_pattern(&rule.pattern_type, &pattern_value)?;
                Ok(Some(SerializedOperation::FileReadMetadata {
                    path,
                    is_subpath,
                }))
            }
            "network_outbound" => Ok(Some(SerializedOperation::NetworkOutbound {
                pattern: pattern_value,
            })),
            "network_tcp" => {
                let port = pattern_value.parse::<u16>().context("Invalid TCP port")?;
                Ok(Some(SerializedOperation::NetworkTcp { port }))
            }
            "network_local_socket" => {
                let path = PathBuf::from(pattern_value);
                Ok(Some(SerializedOperation::NetworkLocalSocket { path }))
            }
            "system_info_read" => Ok(Some(SerializedOperation::SystemInfoRead)),
            _ => Ok(None),
        }
    }

    /// Helper method to expand pattern values (Windows version)
    #[cfg(not(unix))]
    fn expand_pattern_value(&self, pattern_value: &str) -> String {
        pattern_value
            .replace("{{PROJECT_PATH}}", &self.project_path.to_string_lossy())
            .replace("{{HOME}}", &self.home_dir.to_string_lossy())
    }

    /// Helper method to parse path patterns (Windows version)
    #[cfg(not(unix))]
    fn parse_path_pattern(
        &self,
        pattern_type: &str,
        pattern_value: &str,
    ) -> Result<(PathBuf, bool)> {
        let path = PathBuf::from(pattern_value);

        match pattern_type {
            "literal" => Ok((path, false)),
            "subpath" => Ok((path, true)),
            _ => Err(anyhow::anyhow!(
                "Unknown path pattern type: {}",
                pattern_type
            )),
        }
    }
}

/// Load a sandbox profile by ID
pub fn load_profile(conn: &Connection, profile_id: i64) -> Result<SandboxProfile> {
    conn.query_row(
        "SELECT id, name, description, is_active, is_default, created_at, updated_at 
         FROM sandbox_profiles WHERE id = ?1",
        params![profile_id],
        |row| {
            Ok(SandboxProfile {
                id: Some(row.get(0)?),
                name: row.get(1)?,
                description: row.get(2)?,
                is_active: row.get(3)?,
                is_default: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        },
    )
    .context("Failed to load sandbox profile")
}

/// Load the default sandbox profile
pub fn load_default_profile(conn: &Connection) -> Result<SandboxProfile> {
    conn.query_row(
        "SELECT id, name, description, is_active, is_default, created_at, updated_at 
         FROM sandbox_profiles WHERE is_default = 1",
        [],
        |row| {
            Ok(SandboxProfile {
                id: Some(row.get(0)?),
                name: row.get(1)?,
                description: row.get(2)?,
                is_active: row.get(3)?,
                is_default: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        },
    )
    .context("Failed to load default sandbox profile")
}

/// Load rules for a sandbox profile
pub fn load_profile_rules(conn: &Connection, profile_id: i64) -> Result<Vec<SandboxRule>> {
    let mut stmt = conn.prepare(
        "SELECT id, profile_id, operation_type, pattern_type, pattern_value, enabled, platform_support, created_at 
         FROM sandbox_rules WHERE profile_id = ?1 AND enabled = 1"
    )?;

    let rules = stmt
        .query_map(params![profile_id], |row| {
            Ok(SandboxRule {
                id: Some(row.get(0)?),
                profile_id: row.get(1)?,
                operation_type: row.get(2)?,
                pattern_type: row.get(3)?,
                pattern_value: row.get(4)?,
                enabled: row.get(5)?,
                platform_support: row.get(6)?,
                created_at: row.get(7)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(rules)
}

/// Get or create the gaol Profile for execution
#[cfg(unix)]
pub fn get_gaol_profile(
    conn: &Connection,
    profile_id: Option<i64>,
    project_path: PathBuf,
) -> Result<Profile> {
    // Load the profile
    let profile = if let Some(id) = profile_id {
        load_profile(conn, id)?
    } else {
        load_default_profile(conn)?
    };

    info!("Using sandbox profile: {}", profile.name);

    // Load the rules
    let rules = load_profile_rules(conn, profile.id.unwrap())?;
    info!("Loaded {} sandbox rules", rules.len());

    // Build the gaol profile
    let builder = ProfileBuilder::new(project_path)?;
    builder.build_profile(rules)
}

/// Get or create the gaol Profile for execution (Windows stub)
#[cfg(not(unix))]
pub fn get_gaol_profile(
    _conn: &Connection,
    _profile_id: Option<i64>,
    _project_path: PathBuf,
) -> Result<()> {
    warn!("Sandbox profiles are not supported on Windows");
    Ok(())
}
