# Blog Post: Integrating Claudia with a Custom AI Backend using claude-code-router and LiteLLM

## The Goal: A Multi-Provider AI Powerhouse for Claudia

Claudia is a fantastic GUI for the `claude-code` CLI, but by default, it's tied to Anthropic's models. My goal was to unlock its full potential by routing all of its AI requests through a custom backend powered by LiteLLM. This would allow me to:

1.  Use a variety of models from different providers (like Google, OpenAI, and local models via Ollama).
2.  Have fine-grained control over model routing for different tasks (e.g., a powerful model for coding, a fast model for simple queries).
3.  Track usage and costs across all models in a centralized place.

To achieve this, I used the brilliant `claude-code-router` (`ccr`) tool, which is designed to act as a smart proxy for the `claude-code` CLI.

## The Architecture

The final, working architecture looks like this:

```mermaid
flowchart TD
    A[Claudia GUI] --> B{ccr_wrapper.sh};
    B --> C[claude-code-router (ccr)];
    C --> D[LiteLLM Proxy];
    D --> E[Multiple AI Models];

    subgraph "Local Machine"
        A
        B
        C
        D
    end

    subgraph "AI Providers (Cloud/Local)"
        E
    end
```

1.  **Claudia GUI**: The user interacts with Claudia, sending prompts and receiving AI responses.
2.  **`ccr_wrapper.sh`**: A crucial, custom-made script that acts as a bridge.
3.  **`claude-code-router` (`ccr`)**: This tool receives requests, intelligently routes them based on its `config.json`, and forwards them to LiteLLM.
4.  **LiteLLM Proxy**: This server translates the standardized requests from `ccr` into the specific formats required by different AI providers.
5.  **AI Models**: The final destination for the requests.

## The Challenge: A Mismatch in Execution

The integration wasn't straightforward. The core problem was a mismatch between how Claudia executes the AI binary and how `ccr` is designed to be used.

-   **Claudia's Expectation**: Claudia is hard-coded to execute a binary that behaves *exactly* like the official `claude` CLI. It calls the binary with arguments like `--version` for validation or `-p "Your prompt here"` for execution.
-   **`ccr`'s Reality**: `ccr` is a wrapper, not a direct replacement. To use it for an interactive session, you must use the `code` subcommand (e.g., `ccr code -p "Your prompt here"`).

When I initially configured Claudia to point directly to the `ccr` executable, it failed. Claudia would try to run `ccr --version`, which is not a valid command, instead of the correct `ccr code --version`. This caused errors and prevented any requests from reaching the LiteLLM proxy.

## The Solution: The Wrapper Script

The breakthrough came from realizing we needed a "translator" between Claudia and `ccr`. The solution was a simple but powerful shell script, `ccr_wrapper.sh`.

This script does one simple job: it takes whatever arguments it receives and inserts the necessary `code` subcommand before passing them on to the actual `ccr` executable.

Here is the content of `scripts/ccr_wrapper.sh`:

```bash
#!/bin/bash
# This script acts as a bridge between Claudia and the ccr tool.
# It takes all arguments passed to it and forwards them to "ccr code".
/home/sedinha/.nvm/versions/node/v20.18.2/bin/ccr code "$@"
```

The `"$@"` is the key part—it means "all arguments passed to this script."

## Step-by-Step Integration Guide

Here’s how we made it work, from start to finish:

### Step 1: Modify Claudia's Binary Discovery

First, we needed to make Claudia aware of our custom executable. We edited the Rust source code at `src-tauri/src/claude_binary.rs`.

We modified the `discover_system_installations` function to manually add the path to our wrapper script. This ensures it appears in the "Available Installations" dropdown in Claudia's settings.

```rust
// src-tauri/src/claude_binary.rs

/// Discovers all Claude installations on the system
fn discover_system_installations() -> Vec<ClaudeInstallation> {
    let mut installations = Vec::new();

    // Manually add ccr wrapper script path
    let ccr_path = "/home/sedinha/Desktop/claudia/scripts/ccr_wrapper.sh".to_string();
    if PathBuf::from(&ccr_path).exists() {
        info!("Found ccr wrapper at: {}", ccr_path);
        let version = get_claude_version(&ccr_path).ok().flatten();
        installations.push(ClaudeInstallation {
            path: ccr_path,
            version,
            source: "ccr-wrapper".to_string(), // Custom source name
            installation_type: InstallationType::Custom,
        });
    }

    // ... (rest of the original discovery logic)
}
```

### Step 2: Create and Permission the Wrapper Script

Next, we created the `ccr_wrapper.sh` script inside the project's `scripts` directory and made it executable.

```bash
# Create the file
touch scripts/ccr_wrapper.sh

# Add the script content (as shown above)

# Make it executable
chmod +x scripts/ccr_wrapper.sh
```

### Step 3: Rebuild Claudia

With the code changes and the new script in place, the final step was to rebuild the Claudia application. This compiles the Rust backend with our modifications.

```bash
# From the root of the claudia project
STRIP=/bin/true cargo tauri build
```
*(Note: The `STRIP=/bin/true` prefix was used to resolve a specific build issue on Arch Linux.)*

### Step 4: Configure and Test

After rebuilding and launching the new version of Claudia:
1.  I went into the settings and selected our `ccr-wrapper` as the "Claude Code Installation."
2.  I started my LiteLLM proxy in a separate terminal.
3.  I started a new chat session in Claudia and sent a message.

Success! The logs immediately appeared in the LiteLLM terminal, confirming that the request had been successfully routed from Claudia, through our wrapper, through `ccr`, and finally to the LiteLLM backend.

## Conclusion

This integration is a powerful example of how flexible, open-source tools can be combined to create a customized and powerful development environment. By using a simple wrapper script, we were able to bridge the gap between Claudia's expectations and `ccr`'s command structure, unlocking a world of multi-provider AI capabilities within a beautiful and intuitive GUI.
