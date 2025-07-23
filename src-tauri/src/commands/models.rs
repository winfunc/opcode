use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::{AppHandle, Manager};
use crate::commands::storage::get_settings;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustomModel {
    pub name: String,
    pub identifier: String,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelConfig {
    pub custom_models: Vec<CustomModel>,
    pub env_model: Option<String>,
}

#[tauri::command]
pub async fn get_available_models(app: AppHandle) -> Result<ModelConfig, String> {
    let mut custom_models = Vec::new();
    let mut env_model = None;
    
    // Load custom models and environment variables from storage
    if let Ok(settings) = get_settings(&app).await {
        // Read custom models
        if let Some(models_value) = settings.get("custom_models") {
            if let Ok(models) = serde_json::from_value::<Vec<CustomModel>>(models_value.clone()) {
                custom_models = models;
            }
        }
    }
    
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
pub async fn save_custom_models(
    app: AppHandle,
    models: Vec<CustomModel>,
) -> Result<(), String> {
    let mut settings = get_settings(&app).await.unwrap_or_default();
    
    settings.insert("custom_models".to_string(), serde_json::to_value(&models)
        .map_err(|e| format!("Failed to serialize models: {}", e))?);
    
    // Save settings
    crate::commands::storage::save_settings(&app, settings).await
        .map_err(|e| format!("Failed to save settings: {}", e))?;
    
    Ok(())
}

#[tauri::command]
pub async fn add_custom_model(
    app: AppHandle,
    model: CustomModel,
) -> Result<(), String> {
    let mut current_models = Vec::new();
    
    // Get current model list
    if let Ok(settings) = get_settings(&app).await {
        if let Some(models_value) = settings.get("custom_models") {
            if let Ok(models) = serde_json::from_value::<Vec<CustomModel>>(models_value.clone()) {
                current_models = models;
            }
        }
    }
    
    // Check if model with same name already exists
    if current_models.iter().any(|m| m.name == model.name) {
        return Err("Model with this name already exists".to_string());
    }
    
    // Add new model
    current_models.push(model);
    
    // Save
    save_custom_models(app, current_models).await
}

#[tauri::command]
pub async fn remove_custom_model(
    app: AppHandle,
    model_name: String,
) -> Result<(), String> {
    let mut current_models = Vec::new();
    
    // Get current model list
    if let Ok(settings) = get_settings(&app).await {
        if let Some(models_value) = settings.get("custom_models") {
            if let Ok(models) = serde_json::from_value::<Vec<CustomModel>>(models_value.clone()) {
                current_models = models;
            }
        }
    }
    
    // Remove specified model
    current_models.retain(|m| m.name != model_name);
    
    // Save
    save_custom_models(app, current_models).await
} 