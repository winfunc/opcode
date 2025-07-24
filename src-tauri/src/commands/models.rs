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
    let env_model = get_env_var("ANTHROPIC_MODEL").await;

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

#[derive(Debug, Deserialize)]
struct AnthropicModel {
    id: String,
    display_name: Option<String>,
    created: Option<String>,
}

#[derive(Debug, Deserialize)]
struct AnthropicModelsResponse {
    data: Vec<AnthropicModel>,
}

/// Helper function to get environment variable from Claude settings or system env
async fn get_env_var(key: &str) -> Option<String> {
    // First try to get from Claude settings
    if let Ok(claude_settings) = crate::commands::claude::get_claude_settings().await {
        if let Some(env) = claude_settings.data.get("env").and_then(|v| v.as_object()) {
            if let Some(value) = env.get(key).and_then(|v| v.as_str()) {
                return Some(value.to_string());
            }
        }
    }
    
    // Fallback to system environment variable
    std::env::var(key).ok()
}

/// Fetch official models from Anthropic API
async fn fetch_official_models_from_api() -> Result<Vec<CustomModel>, String> {
    let api_key = get_env_var("ANTHROPIC_API_KEY").await
        .ok_or("Anthropic API key not found. Please set ANTHROPIC_API_KEY in environment variables or Claude settings.")?;

    let client = reqwest::Client::new();
    let response = client
        .get("https://api.anthropic.com/v1/models")
        .header("x-api-key", &api_key)
        .header("anthropic-version", "2023-06-01")
        .header("User-Agent", "Claudia-App")
        .send()
        .await
        .map_err(|e| format!("Failed to fetch models from Anthropic API: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!("Anthropic API request failed with status {}: {}", status, error_text));
    }

    let api_response: AnthropicModelsResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse Anthropic API response: {}", e))?;

    let mut models: Vec<CustomModel> = api_response.data
        .into_iter()
        .map(|model| {
            let description = model.created
                .map(|created| format!("Official Anthropic model (created: {})", created))
                .unwrap_or_else(|| "Official Anthropic model".to_string());

            CustomModel {
                name: model.display_name.unwrap_or(model.id.clone()),
                identifier: model.id,
                description: Some(description),
            }
        })
        .collect();

    // Sort models by identifier for consistent ordering
    models.sort_by(|a, b| a.identifier.cmp(&b.identifier));

    Ok(models)
}

#[tauri::command]
pub async fn get_official_models() -> Result<Vec<CustomModel>, String> {
    // Try to fetch from Anthropic API
    match fetch_official_models_from_api().await {
        Ok(models) => {
            log::info!("Successfully fetched {} models from Anthropic API", models.len());
            Ok(models)
        }
        Err(e) => {
            log::warn!("Failed to fetch from Anthropic API: {}", e);
            // Return empty list if API call fails
            Ok(Vec::new())
        }
    }
}
