use crate::commands::storage::get_settings;
use serde::{Deserialize, Serialize};
use tauri::AppHandle;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustomModel {
    pub name: String,
    pub identifier: String,
    pub description: Option<String>,
}

impl CustomModel {
    pub fn validate(&self) -> Result<(), String> {
        if self.name.trim().is_empty() {
            return Err("Model name cannot be empty".to_string());
        }
        if self.identifier.trim().is_empty() {
            return Err("Model identifier cannot be empty".to_string());
        }
        Ok(())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelConfig {
    pub custom_models: Vec<CustomModel>,
    pub env_model: Option<String>,
}

/// Helper function to load custom models from settings
async fn load_custom_models(app: &AppHandle) -> Result<Vec<CustomModel>, String> {
    let settings = get_settings(app).await?;
    if let Some(models_value) = settings.get("custom_models") {
        serde_json::from_value(models_value.clone())
            .map_err(|e| format!("Failed to parse models: {}", e))
    } else {
        Ok(Vec::new())
    }
}

#[tauri::command]
pub async fn get_available_models(app: AppHandle) -> Result<ModelConfig, String> {
    let custom_models = load_custom_models(&app).await.unwrap_or_default();
    let mut env_model = None;

    // Read ANTHROPIC_MODEL environment variable from Claude Settings
    if let Ok(claude_settings) = crate::commands::claude::get_claude_settings().await {
        if let Some(env) = claude_settings.data.get("env").and_then(|v| v.as_object()) {
            if let Some(anthropic_model) = env.get("ANTHROPIC_MODEL").and_then(|v| v.as_str()) {
                env_model = Some(anthropic_model.to_string());
            }
        }
    }

    // Fallback to system environment variable if not found in Claude Settings
    if env_model.is_none() {
        env_model = std::env::var("ANTHROPIC_MODEL").ok();
    }

    Ok(ModelConfig {
        custom_models,
        env_model,
    })
}

#[tauri::command]
pub async fn save_custom_models(app: AppHandle, models: Vec<CustomModel>) -> Result<(), String> {
    let mut settings = get_settings(&app)
        .await
        .map_err(|e| format!("Failed to get settings: {}", e))?;

    settings.insert(
        "custom_models".to_string(),
        serde_json::to_value(&models).map_err(|e| format!("Failed to serialize models: {}", e))?,
    );

    // Save settings
    crate::commands::storage::save_settings(&app, settings)
        .await
        .map_err(|e| format!("Failed to save settings: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn add_custom_model(app: AppHandle, model: CustomModel) -> Result<(), String> {
    // Validate the model
    model.validate()?;

    // Get current model list
    let mut current_models = load_custom_models(&app).await?;

    // Check if model with same name already exists
    if let Some(existing) = current_models.iter().find(|m| m.name == model.name) {
        return Err(format!("Model '{}' already exists", existing.name));
    }

    // Add new model
    current_models.push(model);

    // Save
    save_custom_models(app, current_models).await
}

#[tauri::command]
pub async fn remove_custom_model(app: AppHandle, model_name: String) -> Result<(), String> {
    // Get current model list
    let mut current_models = load_custom_models(&app).await?;

    // Remove specified model
    current_models.retain(|m| m.name != model_name);

    // Save
    save_custom_models(app, current_models).await
}
