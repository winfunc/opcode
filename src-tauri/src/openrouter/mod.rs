use anyhow::Result;
use log::{debug, error, info, warn};
use reqwest::{Client, StatusCode};
use serde::{Deserialize, Serialize};
use std::time::Duration;

/// OpenRouter API client for model discovery and management
pub struct OpenRouterClient {
    client: Client,
    api_key: String,
    base_url: String,
}

/// OpenRouter model information
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OpenRouterModel {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub pricing: Option<ModelPricing>,
    pub context_length: Option<u32>,
    pub architecture: Option<ModelArchitecture>,
    pub top_provider: Option<ModelProvider>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ModelPricing {
    pub prompt: String,
    pub completion: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ModelArchitecture {
    pub modality: String,
    pub tokenizer: String,
    pub instruct_type: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ModelProvider {
    pub max_completion_tokens: Option<u32>,
    pub is_moderated: Option<bool>,
}

/// OpenRouter API response wrapper
#[derive(Debug, Serialize, Deserialize)]
pub struct ModelsResponse {
    pub data: Vec<OpenRouterModel>,
}

/// OpenRouter API error response
#[derive(Debug, Serialize, Deserialize)]
pub struct ApiError {
    pub error: ErrorDetails,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ErrorDetails {
    pub message: String,
    pub code: Option<String>,
}

impl OpenRouterClient {
    /// Create a new OpenRouter API client
    pub fn new(api_key: String) -> Result<Self> {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()?;

        Ok(Self {
            client,
            api_key,
            base_url: "https://openrouter.ai/api/v1".to_string(),
        })
    }

    /// Validate API key by making a test request
    pub async fn validate_api_key(&self) -> Result<bool> {
        info!("Validating OpenRouter API key...");
        
        let response = self
            .client
            .get(&format!("{}/models", self.base_url))
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("HTTP-Referer", "https://claudia.app")
            .header("X-Title", "Claudia AI Assistant")
            .send()
            .await;

        match response {
            Ok(resp) => {
                if resp.status().is_success() {
                    info!("OpenRouter API key validation successful");
                    Ok(true)
                } else {
                    warn!("OpenRouter API key validation failed: {}", resp.status());
                    Ok(false)
                }
            }
            Err(e) => {
                error!("Failed to validate OpenRouter API key: {}", e);
                Ok(false)
            }
        }
    }

    /// Fetch available models from OpenRouter API with retry logic
    pub async fn get_models(&self) -> Result<Vec<OpenRouterModel>> {
        let max_retries = 3;
        let mut attempt = 0;

        while attempt < max_retries {
            attempt += 1;
            debug!("Fetching OpenRouter models (attempt {})", attempt);

            match self.fetch_models_once().await {
                Ok(models) => {
                    info!("Successfully fetched {} models from OpenRouter", models.len());
                    return Ok(models);
                }
                Err(e) => {
                    warn!("Attempt {} failed: {}", attempt, e);
                    if attempt < max_retries {
                        let delay = Duration::from_millis(1000 * attempt as u64);
                        debug!("Retrying after {:?}", delay);
                        tokio::time::sleep(delay).await;
                    }
                }
            }
        }

        Err(anyhow::anyhow!("Failed to fetch models after {} attempts", max_retries))
    }

    /// Single attempt to fetch models from OpenRouter API
    async fn fetch_models_once(&self) -> Result<Vec<OpenRouterModel>> {
        let response = self
            .client
            .get(&format!("{}/models", self.base_url))
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("HTTP-Referer", "https://claudia.app")
            .header("X-Title", "Claudia AI Assistant")
            .send()
            .await?;

        if response.status().is_success() {
            let models_response: ModelsResponse = response.json().await?;
            Ok(models_response.data)
        } else {
            let status = response.status();
            match response.text().await {
                Ok(body) => {
                    // Try to parse as API error
                    if let Ok(api_error) = serde_json::from_str::<ApiError>(&body) {
                        return Err(anyhow::anyhow!(
                            "OpenRouter API error: {} (status: {})",
                            api_error.error.message,
                            status
                        ));
                    }
                    Err(anyhow::anyhow!(
                        "OpenRouter API request failed: {} - {}",
                        status,
                        body
                    ))
                }
                Err(_) => Err(anyhow::anyhow!(
                    "OpenRouter API request failed with status: {}",
                    status
                )),
            }
        }
    }

    /// Filter models for specific engine compatibility
    pub fn filter_models_for_engine(&self, models: &[OpenRouterModel], engine: &str) -> Vec<OpenRouterModel> {
        match engine {
            "aider" => {
                // Filter for models compatible with Aider
                models
                    .iter()
                    .filter(|model| {
                        // Aider works well with GPT models and Claude models
                        model.id.contains("gpt") || 
                        model.id.contains("claude") || 
                        model.id.contains("anthropic")
                    })
                    .cloned()
                    .collect()
            }
            "opencodex" => {
                // Filter for models compatible with OpenCodex
                models
                    .iter()
                    .filter(|model| {
                        // OpenCodex works with OpenAI compatible models
                        model.id.contains("gpt") || 
                        model.id.contains("codex") ||
                        model.id.contains("code")
                    })
                    .cloned()
                    .collect()
            }
            _ => models.to_vec(),
        }
    }
}

/// Validate OpenRouter API key from environment
pub fn validate_openrouter_api_key() -> Result<String> {
    match std::env::var("OPENROUTER_API_KEY") {
        Ok(key) => {
            if key.trim().is_empty() {
                Err(anyhow::anyhow!("OPENROUTER_API_KEY is set but empty"))
            } else {
                debug!("OpenRouter API key found in environment");
                Ok(key.trim().to_string())
            }
        }
        Err(_) => Err(anyhow::anyhow!(
            "OPENROUTER_API_KEY environment variable not found. Please set it to use Aider and OpenCodex engines."
        )),
    }
}

/// Check if binary exists and is executable
pub fn check_binary_exists(binary_name: &str) -> bool {
    // Try to execute the binary with --version or --help
    match std::process::Command::new(binary_name)
        .arg("--version")
        .output()
    {
        Ok(output) => {
            if output.status.success() {
                debug!("Binary '{}' found and executable", binary_name);
                true
            } else {
                debug!("Binary '{}' found but returned error status", binary_name);
                false
            }
        }
        Err(_) => {
            debug!("Binary '{}' not found in PATH", binary_name);
            false
        }
    }
}

/// Validate engine dependencies (binary and API key)
pub fn validate_engine_dependencies(engine: &str) -> Result<()> {
    match engine {
        "claude" => {
            // Claude engine doesn't need OpenRouter, just validate Claude binary exists
            // This is already handled in the existing claude execution logic
            Ok(())
        }
        "aider" => {
            // Check for aider binary
            if !check_binary_exists("aider") {
                return Err(anyhow::anyhow!(
                    "Aider binary not found. Please install aider-chat: pip install aider-chat"
                ));
            }
            
            // Check for OpenRouter API key
            validate_openrouter_api_key()?;
            Ok(())
        }
        "opencodex" => {
            // Check for opencodx binary
            if !check_binary_exists("opencodx") {
                return Err(anyhow::anyhow!(
                    "OpenCodex binary not found. Please install opencodx"
                ));
            }
            
            // Check for OpenRouter API key
            validate_openrouter_api_key()?;
            Ok(())
        }
        _ => Err(anyhow::anyhow!("Unsupported engine: {}", engine)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_empty_api_key() {
        std::env::set_var("OPENROUTER_API_KEY", "");
        assert!(validate_openrouter_api_key().is_err());
    }

    #[test]
    fn test_validate_missing_api_key() {
        std::env::remove_var("OPENROUTER_API_KEY");
        assert!(validate_openrouter_api_key().is_err());
    }

    #[test]
    fn test_check_binary_exists() {
        // Test with a binary that should exist on most systems
        assert!(check_binary_exists("echo"));
        
        // Test with a binary that shouldn't exist
        assert!(!check_binary_exists("nonexistent_binary_12345"));
    }
}