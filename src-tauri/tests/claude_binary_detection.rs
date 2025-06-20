//! Tests for Claude binary detection functionality
//! 
//! This module tests the find_claude_binary function to ensure it correctly
//! detects Claude installations in various locations, including NVM paths.

use std::fs;
use std::path::PathBuf;
use tempfile::TempDir;

// Mock the find_claude_binary function for testing
fn find_claude_binary_test(home_dir: &str) -> Result<String, String> {
    // Common installation paths for claude
    let mut paths_to_check: Vec<String> = vec![
        "/usr/local/bin/claude".to_string(),
        "/opt/homebrew/bin/claude".to_string(),
        "/usr/bin/claude".to_string(),
        "/bin/claude".to_string(),
    ];
    
    // Also check user-specific paths
    paths_to_check.extend(vec![
        format!("{}/.claude/local/claude", home_dir),
        format!("{}/.local/bin/claude", home_dir),
        format!("{}/.npm-global/bin/claude", home_dir),
        format!("{}/.yarn/bin/claude", home_dir),
        format!("{}/.bun/bin/claude", home_dir),
        format!("{}/bin/claude", home_dir),
        // Check common node_modules locations
        format!("{}/node_modules/.bin/claude", home_dir),
        format!("{}/.config/yarn/global/node_modules/.bin/claude", home_dir),
    ]);
    
    // Check NVM paths
    if let Ok(nvm_dirs) = std::fs::read_dir(format!("{}/.nvm/versions/node", home_dir)) {
        for entry in nvm_dirs.flatten() {
            if entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                let nvm_claude_path = format!("{}/bin/claude", entry.path().display());
                paths_to_check.push(nvm_claude_path);
            }
        }
    }
    
    // Check each path
    for path in paths_to_check {
        let path_buf = PathBuf::from(&path);
        if path_buf.exists() && path_buf.is_file() {
            return Ok(path);
        }
    }
    
    Err("Could not find claude binary in any common location".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_find_claude_binary_standard_paths() {
        // Create a temporary directory structure
        let temp_dir = TempDir::new().unwrap();
        let home_path = temp_dir.path().to_str().unwrap();
        
        // Create a mock claude binary in .local/bin
        let local_bin_dir = temp_dir.path().join(".local/bin");
        fs::create_dir_all(&local_bin_dir).unwrap();
        let claude_path = local_bin_dir.join("claude");
        fs::write(&claude_path, "#!/bin/bash\necho 'claude mock'").unwrap();
        
        // Make it executable on Unix systems
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mut perms = claude_path.metadata().unwrap().permissions();
            perms.set_mode(0o755);
            fs::set_permissions(&claude_path, perms).unwrap();
        }
        
        let result = find_claude_binary_test(home_path);
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), claude_path.to_str().unwrap());
    }
    
    #[test]
    fn test_find_claude_binary_nvm_paths() {
        // Create a temporary directory structure with NVM layout
        let temp_dir = TempDir::new().unwrap();
        let home_path = temp_dir.path().to_str().unwrap();
        
        // Create NVM directory structure: ~/.nvm/versions/node/v22.15.0/bin/claude
        let nvm_node_dir = temp_dir.path().join(".nvm/versions/node/v22.15.0/bin");
        fs::create_dir_all(&nvm_node_dir).unwrap();
        let claude_path = nvm_node_dir.join("claude");
        fs::write(&claude_path, "#!/bin/bash\necho 'claude nvm mock'").unwrap();
        
        // Make it executable on Unix systems
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mut perms = claude_path.metadata().unwrap().permissions();
            perms.set_mode(0o755);
            fs::set_permissions(&claude_path, perms).unwrap();
        }
        
        let result = find_claude_binary_test(home_path);
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), claude_path.to_str().unwrap());
    }
    
    #[test]
    fn test_find_claude_binary_multiple_nvm_versions() {
        // Create a temporary directory structure with multiple NVM versions
        let temp_dir = TempDir::new().unwrap();
        let home_path = temp_dir.path().to_str().unwrap();
        
        // Create multiple NVM node versions
        let versions = ["v18.15.0", "v20.10.0", "v22.15.0"];
        let mut created_paths = Vec::new();
        
        for version in &versions {
            let nvm_node_dir = temp_dir.path().join(format!(".nvm/versions/node/{}/bin", version));
            fs::create_dir_all(&nvm_node_dir).unwrap();
            let claude_path = nvm_node_dir.join("claude");
            fs::write(&claude_path, format!("#!/bin/bash\necho 'claude {} mock'", version)).unwrap();
            
            // Make it executable on Unix systems
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                let mut perms = claude_path.metadata().unwrap().permissions();
                perms.set_mode(0o755);
                fs::set_permissions(&claude_path, perms).unwrap();
            }
            
            created_paths.push(claude_path.to_str().unwrap().to_string());
        }
        
        let result = find_claude_binary_test(home_path);
        assert!(result.is_ok());
        
        // Should find one of the claude binaries (the order depends on filesystem iteration)
        let found_path = result.unwrap();
        assert!(created_paths.contains(&found_path));
    }
    
    #[test]
    fn test_find_claude_binary_prefers_standard_over_nvm() {
        // Create a temporary directory structure with both standard and NVM paths
        let temp_dir = TempDir::new().unwrap();
        let home_path = temp_dir.path().to_str().unwrap();
        
        // Create claude in .local/bin (standard location)
        let local_bin_dir = temp_dir.path().join(".local/bin");
        fs::create_dir_all(&local_bin_dir).unwrap();
        let standard_claude_path = local_bin_dir.join("claude");
        fs::write(&standard_claude_path, "#!/bin/bash\necho 'claude standard mock'").unwrap();
        
        // Create claude in NVM path
        let nvm_node_dir = temp_dir.path().join(".nvm/versions/node/v22.15.0/bin");
        fs::create_dir_all(&nvm_node_dir).unwrap();
        let nvm_claude_path = nvm_node_dir.join("claude");
        fs::write(&nvm_claude_path, "#!/bin/bash\necho 'claude nvm mock'").unwrap();
        
        // Make both executable on Unix systems
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            for path in [&standard_claude_path, &nvm_claude_path] {
                let mut perms = path.metadata().unwrap().permissions();
                perms.set_mode(0o755);
                fs::set_permissions(path, perms).unwrap();
            }
        }
        
        let result = find_claude_binary_test(home_path);
        assert!(result.is_ok());
        
        // Should prefer the standard location over NVM (since it's checked first)
        assert_eq!(result.unwrap(), standard_claude_path.to_str().unwrap());
    }
    
    #[test]
    fn test_find_claude_binary_no_installation() {
        // Create a temporary directory with no claude installation
        let temp_dir = TempDir::new().unwrap();
        let home_path = temp_dir.path().to_str().unwrap();
        
        let result = find_claude_binary_test(home_path);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Could not find claude binary in any common location");
    }
    
    #[test]
    fn test_find_claude_binary_invalid_nvm_structure() {
        // Create a temporary directory with invalid NVM structure
        let temp_dir = TempDir::new().unwrap();
        let home_path = temp_dir.path().to_str().unwrap();
        
        // Create NVM directory but with no node versions
        let nvm_node_dir = temp_dir.path().join(".nvm/versions/node");
        fs::create_dir_all(&nvm_node_dir).unwrap();
        
        let result = find_claude_binary_test(home_path);
        assert!(result.is_err());
    }
}