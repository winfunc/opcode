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

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use tempfile::TempDir;

    /// Helper function to create a mock app handle for testing
    /// This creates a temporary database for testing purposes
    async fn create_test_settings() -> (tempfile::TempDir, rusqlite::Connection) {
        let temp_dir = TempDir::new().unwrap();
        let db_path = temp_dir.path().join("test.db");
        let conn = rusqlite::Connection::open(&db_path).unwrap();
        
        // Create the settings table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS app_settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        ).unwrap();
        
        (temp_dir, conn)
    }

    #[test]
    fn test_custom_model_validation() {
        // Valid model
        let valid_model = CustomModel {
            name: "Test Model".to_string(),
            identifier: "test-model-v1".to_string(),
            description: Some("A test model".to_string()),
        };
        assert!(valid_model.validate().is_ok());

        // Empty name should fail
        let invalid_name = CustomModel {
            name: "".to_string(),
            identifier: "test-model-v1".to_string(),
            description: None,
        };
        assert!(invalid_name.validate().is_err());
        assert!(invalid_name.validate().unwrap_err().contains("name cannot be empty"));

        // Empty identifier should fail
        let invalid_identifier = CustomModel {
            name: "Test Model".to_string(),
            identifier: "".to_string(),
            description: None,
        };
        assert!(invalid_identifier.validate().is_err());
        assert!(invalid_identifier.validate().unwrap_err().contains("identifier cannot be empty"));

        // Whitespace-only name should fail
        let whitespace_name = CustomModel {
            name: "   ".to_string(),
            identifier: "test-model-v1".to_string(),
            description: None,
        };
        assert!(whitespace_name.validate().is_err());
    }

    #[tokio::test]
    async fn test_model_serialization_deserialization() {
        let models = vec![
            CustomModel {
                name: "Model 1".to_string(),
                identifier: "model-1".to_string(),
                description: Some("First test model".to_string()),
            },
            CustomModel {
                name: "Model 2".to_string(),
                identifier: "model-2".to_string(),
                description: None,
            },
        ];

        // Test JSON serialization
        let json_value = serde_json::to_value(&models).unwrap();
        let deserialized: Vec<CustomModel> = serde_json::from_value(json_value).unwrap();
        
        assert_eq!(deserialized.len(), 2);
        assert_eq!(deserialized[0].name, "Model 1");
        assert_eq!(deserialized[1].identifier, "model-2");
        assert_eq!(deserialized[0].description, Some("First test model".to_string()));
        assert_eq!(deserialized[1].description, None);
    }

    #[test]
    fn test_anthropic_model_deserialization() {
        // Test deserializing a typical Anthropic API response structure
        let json_data = json!({
            "id": "claude-3-5-sonnet-20241022",
            "display_name": "Claude 3.5 Sonnet",
            "created": "2024-10-22"
        });

        let model: AnthropicModel = serde_json::from_value(json_data).unwrap();
        assert_eq!(model.id, "claude-3-5-sonnet-20241022");
        assert_eq!(model.display_name, Some("Claude 3.5 Sonnet".to_string()));
        assert_eq!(model.created, Some("2024-10-22".to_string()));

        // Test with minimal data
        let minimal_json = json!({
            "id": "claude-3-haiku-20241022"
        });

        let minimal_model: AnthropicModel = serde_json::from_value(minimal_json).unwrap();
        assert_eq!(minimal_model.id, "claude-3-haiku-20241022");
        assert_eq!(minimal_model.display_name, None);
        assert_eq!(minimal_model.created, None);
    }

    #[test]
    fn test_model_config_serialization() {
        let config = ModelConfig {
            custom_models: vec![
                CustomModel {
                    name: "Test Model".to_string(),
                    identifier: "test-model".to_string(),
                    description: Some("Test description".to_string()),
                }
            ],
            env_model: Some("claude-3-5-sonnet-20241022".to_string()),
        };

        // Test serialization and deserialization
        let json_str = serde_json::to_string(&config).unwrap();
        let deserialized: ModelConfig = serde_json::from_str(&json_str).unwrap();
        
        assert_eq!(deserialized.custom_models.len(), 1);
        assert_eq!(deserialized.custom_models[0].name, "Test Model");
        assert_eq!(deserialized.env_model, Some("claude-3-5-sonnet-20241022".to_string()));
    }

    #[test]
    fn test_custom_model_with_optional_description() {
        let model_with_desc = CustomModel {
            name: "Model With Desc".to_string(),
            identifier: "model-with-desc".to_string(),
            description: Some("Has description".to_string()),
        };

        let model_without_desc = CustomModel {
            name: "Model Without Desc".to_string(),
            identifier: "model-without-desc".to_string(),
            description: None,
        };

        // Both should be valid
        assert!(model_with_desc.validate().is_ok());
        assert!(model_without_desc.validate().is_ok());

        // Test serialization
        let json_with = serde_json::to_string(&model_with_desc).unwrap();
        let json_without = serde_json::to_string(&model_without_desc).unwrap();
        
        assert!(json_with.contains("Has description"));
        assert!(!json_without.contains("Has description"));
    }

    #[test] 
    fn test_anthropic_models_response_deserialization() {
        let response_json = json!({
            "data": [
                {
                    "id": "claude-3-5-sonnet-20241022",
                    "display_name": "Claude 3.5 Sonnet",
                    "created": "2024-10-22"
                },
                {
                    "id": "claude-3-haiku-20241022",
                    "display_name": "Claude 3 Haiku"
                }
            ]
        });

        let response: AnthropicModelsResponse = serde_json::from_value(response_json).unwrap();
        assert_eq!(response.data.len(), 2);
        assert_eq!(response.data[0].id, "claude-3-5-sonnet-20241022");
        assert_eq!(response.data[1].id, "claude-3-haiku-20241022");
        assert_eq!(response.data[0].display_name, Some("Claude 3.5 Sonnet".to_string()));
        assert_eq!(response.data[1].created, None);
    }

    #[test]
    fn test_model_validation_edge_cases() {
        // Test with unicode characters
        let unicode_model = CustomModel {
            name: "模型测试".to_string(),
            identifier: "model-测试".to_string(),
            description: Some("测试描述".to_string()),
        };
        assert!(unicode_model.validate().is_ok());

        // Test with very long strings
        let long_name = "a".repeat(1000);
        let long_model = CustomModel {
            name: long_name.clone(),
            identifier: "long-model".to_string(),
            description: Some(long_name),
        };
        assert!(long_model.validate().is_ok());

        // Test with only whitespace
        let whitespace_identifier = CustomModel {
            name: "Valid Name".to_string(),
            identifier: "   \t\n   ".to_string(),
            description: None,
        };
        assert!(whitespace_identifier.validate().is_err());
    }

    #[tokio::test]
    async fn test_database_operations() {
        let (_temp_dir, conn) = create_test_settings().await;
        
        // Test inserting custom models data
        let models = vec![
            CustomModel {
                name: "Test Model 1".to_string(),
                identifier: "test-1".to_string(),
                description: Some("First model".to_string()),
            },
            CustomModel {
                name: "Test Model 2".to_string(),
                identifier: "test-2".to_string(),
                description: None,
            },
        ];
        
        let models_json = serde_json::to_value(&models).unwrap();
        
        // Insert models into the database
        conn.execute(
            "INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)",
            rusqlite::params!["custom_models", models_json.to_string()],
        ).unwrap();
        
        // Read models back from the database
        let stored_json: String = conn.query_row(
            "SELECT value FROM app_settings WHERE key = ?",
            rusqlite::params!["custom_models"],
            |row| row.get(0),
        ).unwrap();
        
        let stored_models: Vec<CustomModel> = serde_json::from_str(&stored_json).unwrap();
        assert_eq!(stored_models.len(), 2);
        assert_eq!(stored_models[0].name, "Test Model 1");
        assert_eq!(stored_models[1].description, None);
    }
}
