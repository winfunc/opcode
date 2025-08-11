use serde::{Deserialize, Serialize};
use std::fs;
use log::{info, warn};

#[derive(Debug, Deserialize, Serialize, Clone)]
struct CcrProvider {
    name: String,
    models: Vec<String>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
struct CcrRouter {
    default: String,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
struct CcrConfig {
    #[serde(rename = "Providers")]
    providers: Vec<CcrProvider>,
    #[serde(rename = "Router")]
    router: CcrRouter,
}

#[derive(Debug, Serialize, Clone)]
pub struct CcrModelInfo {
    provider: String,
    models: Vec<String>,
    default_model: String,
}

#[tauri::command]
pub fn get_ccr_model_info() -> Result<CcrModelInfo, String> {
    info!("Attempting to read claude-code-router config");
    let home_dir = dirs::home_dir().ok_or_else(|| "Could not find home directory".to_string())?;
    let config_path = home_dir.join(".claude-code-router").join("config.json");

    if !config_path.exists() {
        let err_msg = format!("ccr config not found at {:?}", config_path);
        warn!("{}", err_msg);
        return Err(err_msg);
    }

    let config_content = fs::read_to_string(&config_path)
        .map_err(|e| format!("Failed to read ccr config file: {}", e))?;

    let config: CcrConfig = serde_json::from_str(&config_content)
        .map_err(|e| format!("Failed to parse ccr config file: {}", e))?;

    // Assuming the first provider is the one we want, as per the user's setup.
    let provider = config.providers.get(0).ok_or_else(|| "No providers found in ccr config".to_string())?;

    // The default model is in the format "provider,model_name". We need to extract the model name.
    let default_model_name = config.router.default.split(',').nth(1).unwrap_or("").trim().to_string();

    Ok(CcrModelInfo {
        provider: provider.name.clone(),
        models: provider.models.clone(),
        default_model: default_model_name,
    })
}
