# Interacting with Your Custom Claude Code Router Setup

This document is your guide to using the `claude-code-router` (ccr) command-line tool, which has been specially configured to work with LiteLLM as a powerful backend.

## How It Works: `claude-code-router` + LiteLLM

Your current setup is a sophisticated, two-part system that provides incredible flexibility:

1.  **`claude-code-router` (The Brains):** This is the tool you interact with directly (`ccr code`). Its main job is to be an intelligent **router**. Based on the `Router` settings in your `config.json`, it decides which *type* of model is best suited for a task (e.g., a powerful model for thinking, a fast model for background tasks). It then sends a standardized API request to LiteLLM.

2.  **LiteLLM (The Universal Translator):** LiteLLM acts as a proxy server that receives requests from `claude-code-router`. Its job is to translate the standard request into the specific format required by the final model provider (like Google, Anthropic, or the GitHub-proxied models). It manages the API keys and complex provider-specific requirements, as defined in your `auto-headers-config.yaml`.

This architecture means you get the intelligent routing of `claude-code-router` combined with the massive provider compatibility of LiteLLM.

## Your Router Configuration

The `Router` section in `config.json` defines the default model for different scenarios. Here is your current setup:

-   **Default (`/model default`):** `litellm-github,gpt-4.1`
    -   Used for general-purpose tasks.
-   **Background:** `litellm-github,gemini-2.0-flash-001`
    -   A fast, efficient model for background tasks.
-   **Think:** `litellm-github,claude-3.7-sonnet-thought`
    -   A powerful model for complex reasoning and planning.
-   **Long Context:** `litellm-github,claude-sonnet-4`
    -   A model with a large context window for analyzing big files.
-   **Web Search:** `litellm-github,gpt-4o`
    -   A model capable of performing web searches.

## How to Switch Models

You can dynamically switch the active model at any time inside the `ccr code` interface using the `/model` command.

**The format is crucial:** `/model provider_name,model_name`

In your setup, the `provider_name` is always `litellm-github`, as defined in your `config.json`.

### Examples:

-   **To switch to the "think" model:**
    ```
    /model litellm-github,claude-3.7-sonnet-thought
    ```

-   **To switch to the "background" model:**
    ```
    /model litellm-github,gemini-2.0-flash-001
    ```

-   **To switch to the new `gemini-1.5-pro` model:**
    ```
    /model litellm-github,gemini-1.5-pro
    ```

-   **To switch back to the default model:**
    ```
    /model default
    ```

After changing the model, you can always run `/status` to confirm which model is currently active.

## Full List of Available Models

Here are all the models you have configured and can switch to using the `/model litellm-github,MODEL_NAME` command:

-   `claude-3.5-sonnet`
-   `claude-3.7-sonnet`
-   `claude-3.7-sonnet-thought`
-   `claude-sonnet-4`
-   `gemini-1.5-flash`
-   `gemini-1.5-pro`
-   `gemini-2.0-flash-001`
-   `gemini-pro`
-   `gemini-pro-vision`
-   `gpt-3.5-turbo`
-   `gpt-3.5-turbo-0613`
-   `gpt-4`
-   `gpt-4-0613`
-   `gpt-4-o-preview`
-   `gpt-4.1`
-   `gpt-4.1-2025-04-14`
-   `gpt-4o`
-   `gpt-4o-2024-05-13`
-   `gpt-4o-2024-08-06`
-   `gpt-4o-2024-11-20`
-   `gpt-4o-mini`
-   `gpt-4o-mini-2024-07-18`
-   `o3-mini`
-   `o3-mini-2025-01-31`
-   `o3-mini-paygo`
-   `text-embedding-3-small`
-   `text-embedding-3-small-inference`
-   `text-embedding-ada-002`
-   `llama-3-1-405b`
-   `phi-4`
