# Unlocking the Full Power of `claude-code-router` in Claudia: Dynamic Model Switching is Here!

For a while now, our powerful `claude-code-router` (`ccr`) integration has been the engine under the hood of Claudia, allowing for incredible flexibility in routing AI requests. However, the Claudia UI was still catching up—users were limited to selecting only the default Claude Sonnet and Opus models, even if their `ccr` configuration was brimming with models from LiteLLM, GitHub, and more.

Today, that changes. We're thrilled to announce that we've fully integrated `ccr`'s dynamic model configuration directly into the Claudia interface, putting the full power of your custom AI backend right at your fingertips.

## The Challenge: Bridging the Gap

The core of this new feature was bridging the gap between Claudia's frontend and the `claude-code-router`'s configuration file (`~/.claude-code-router/config.json`). The UI needed a way to dynamically discover which models were available, who the provider was, and which model was the default, without having this information hardcoded.

## The Solution: A Backend Command and a Smarter UI

We approached this with a clean, two-part solution that respects the separation between our frontend and backend logic.

### 1. A New Backend Command: `get_ccr_model_info`

First, we created a new command in our Tauri backend. This Rust function is responsible for locating and parsing the `ccr` `config.json` file.

Here’s a look at the implementation in `src-tauri/src/commands/ccr.rs`:

```rust
// src-tauri/src/commands/ccr.rs

#[derive(Debug, Serialize, Clone)]
pub struct CcrModelInfo {
    provider: String,
    models: Vec<String>,
    default_model: String,
}

#[tauri::command]
pub fn get_ccr_model_info() -> Result<CcrModelInfo, String> {
    // 1. Find ~/.claude-code-router/config.json
    let home_dir = dirs::home_dir().ok_or_else(...)
    let config_path = home_dir.join(".claude-code-router").join("config.json");

    // 2. Read and parse the file content
    let config_content = fs::read_to_string(&config_path)...;
    let config: CcrConfig = serde_json::from_str(&config_content)...;

    // 3. Extract the provider, list of models, and the default model name
    let provider = config.providers.get(0).ok_or_else(...)
    let default_model_name = config.router.default.split(',').nth(1).unwrap_or("").trim().to_string();

    // 4. Return the structured information to the frontend
    Ok(CcrModelInfo {
        provider: provider.name.clone(),
        models: provider.models.clone(),
        default_model: default_model_name,
    })
}
```

This command provides a clean API for the frontend to get all the necessary information in a single, structured call.

### 2. A Dynamic Frontend Component

Next, we modified the `FloatingPromptInput.tsx` component. Instead of using a hardcoded list of models, it now fetches this information from the new backend command when it loads.

```tsx
// src/components/FloatingPromptInput.tsx

// ... imports and other state ...
const [models, setModels] = useState<Model[]>(DEFAULT_MODELS);
const [selectedModel, setSelectedModel] = useState<string>(defaultModel);
const [isCcrLoading, setIsCcrLoading] = useState(true);

useEffect(() => {
  const fetchCcrInfo = async () => {
    try {
      setIsCcrLoading(true);
      // Fetch model info from our new backend command
      const info = await api.getCcrModelInfo();
      setCcrInfo(info);
      
      // Create the list of models for the UI
      const ccrModels: Model[] = info.models.map(m => ({
        id: m,
        name: m,
        description: `From ${info.provider}`,
        icon: <Sparkles className="h-4 w-4" />
      }));
      
      setModels(ccrModels);
      setSelectedModel(info.default_model || ccrModels[0]?.id || defaultModel);
    } catch (error) {
      console.warn("Could not load ccr config, falling back to default models.");
      setModels(DEFAULT_MODELS);
    } finally {
      setIsCcrLoading(false);
    }
  };
  fetchCcrInfo();
}, [defaultModel]);
```

When a user selects a model from the now-dynamic dropdown, the `onModelChange` callback is triggered, which sends the `/model provider_name,model_name` command to the running session, instantly switching the active model.

### 3. A Quick UI Fix: Making it Scroll

With a potentially long list of models, we quickly noticed the selection popover could overflow the screen. We applied a simple but effective fix by making the model list container scrollable.

```tsx
// src/components/FloatingPromptInput.tsx (in the Popover content)

<div className="w-[300px] p-1 max-h-60 overflow-y-auto">
  {models.map((model) => (
    // ... button for each model
  ))}
</div>
```
The `max-h-60` and `overflow-y-auto` classes ensure that our UI remains clean and usable, no matter how many models you've configured.

## How to Use the New Feature

Using the dynamic model switcher is incredibly simple:

1.  **Start a Claude Code Session** in any project.
2.  **Click the Model Selector** button in the prompt input bar at the bottom.
3.  **Browse and Select:** You will now see the complete list of models from your `claude-code-router` configuration. Simply click on any model to switch to it for your next prompt.

That's it! You can now seamlessly switch between a fast model for simple tasks, a powerful model for complex reasoning, or any other specialized model you have configured, all without leaving the Claudia interface. This update truly unlocks the full potential of your custom AI backend, making Claudia an even more powerful and flexible tool for AI-assisted development.
