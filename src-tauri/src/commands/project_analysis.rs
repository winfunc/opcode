use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::process::Command;
use tauri::State;
use crate::language_cache::LanguageCache;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LanguageStats {
    pub name: String,
    pub percentage: f32,
    pub bytes: u64,
    pub color: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProjectAnalysis {
    pub languages: Vec<LanguageStats>,
    pub total_files: u32,
    pub total_bytes: u64,
    pub analyzed_at: u64,
}

#[tauri::command]
pub async fn analyze_project_languages(
    project_path: String,
    cache: State<'_, LanguageCache>,
) -> Result<ProjectAnalysis, String> {
    log::info!("Analyzing project languages for: {project_path}");
    
    let path = PathBuf::from(&project_path);
    
    // Early return for non-existent paths
    if !path.exists() {
        log::warn!("Project path does not exist: {project_path}, returning empty analysis");
        return Ok(ProjectAnalysis {
            languages: Vec::new(),
            total_files: 0,
            total_bytes: 0,
            analyzed_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
        });
    }
    
    // Skip analysis for empty directories
    if path.is_dir() {
        let mut entries = std::fs::read_dir(&path).map_err(|e| format!("Failed to read directory: {e}"))?;
        if entries.next().is_none() {
            log::info!("Directory is empty: {project_path}");
            return Ok(ProjectAnalysis {
                languages: Vec::new(),
                total_files: 0,
                total_bytes: 0,
                analyzed_at: std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_secs(),
            });
        }
    }

    let cache_key = format!("lang_analysis_{}", project_path.replace("/", "_"));
    
    // Check in-memory cache first
    if let Some(cached) = cache.get(&cache_key) {
        return Ok(cached);
    }
    
    // Then check file cache
    if let Ok(cached) = get_cached_analysis(&cache_key) {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();
        
        if now - cached.analyzed_at < 3600 {
            // Store in memory cache for faster access
            cache.set(cache_key.clone(), cached.clone());
            return Ok(cached);
        }
    }

    // linguist-js outputs JS object notation, not valid JSON, so we need to convert it
    let output = if cfg!(target_os = "windows") {
        let cmd_str = format!(
            "npx linguist-js --analyze \"{project_path}\" --json 2>nul | node -e \"const input = require('fs').readFileSync(0, 'utf8'); if (input.trim()) {{ try {{ console.log(JSON.stringify(eval('(' + input + ')'))); }} catch (e) {{ console.error('Parse error:', e.message); process.exit(1); }} }} else {{ console.log('{{}}'); }}\""
        );
        Command::new("cmd")
            .args(["/C", &cmd_str])
            .output()
            .map_err(|e| format!("Failed to run linguist-js: {e}"))?
    } else {
        let cmd_str = format!(
            "npx linguist-js --analyze \"{project_path}\" --json 2>/dev/null | node -e \"const input = require('fs').readFileSync(0, 'utf8'); if (input.trim()) {{ try {{ console.log(JSON.stringify(eval('(' + input + ')'))); }} catch (e) {{ console.error('Parse error:', e.message); process.exit(1); }} }} else {{ console.log('{{}}'); }}\""
        );
        Command::new("sh")
            .args(["-c", &cmd_str])
            .output()
            .map_err(|e| format!("Failed to run linguist-js: {e}"))?
    };

    if !output.status.success() {
        log::error!("linguist-js stderr: {}", String::from_utf8_lossy(&output.stderr));
        return Err(format!("linguist-js failed: {}", String::from_utf8_lossy(&output.stderr)));
    }
    
    log::debug!("linguist-js output length: {} bytes", output.stdout.len());

    // Handle empty output case
    if output.stdout.is_empty() || output.stdout == b"{}" {
        log::warn!("linguist-js returned empty output for {project_path}");
        return Ok(ProjectAnalysis {
            languages: Vec::new(),
            total_files: 0,
            total_bytes: 0,
            analyzed_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
        });
    }

    let result: serde_json::Value = serde_json::from_slice(&output.stdout)
        .map_err(|e| format!("Failed to parse linguist output: {e}"))?;
    
    log::debug!("Parsed JSON keys: {:?}", result.as_object().map(|o| o.keys().collect::<Vec<_>>()));

    // Handle missing fields gracefully
    let total_bytes = result.get("languages")
        .and_then(|l| l.get("bytes"))
        .and_then(|b| b.as_u64())
        .unwrap_or(0);
    
    let languages = if let Some(langs) = result.get("languages")
        .and_then(|l| l.get("results"))
        .and_then(|r| r.as_object()) {
        let mut language_vec: Vec<LanguageStats> = langs
            .iter()
            .filter_map(|(name, data)| {
                let bytes = data["bytes"].as_u64().unwrap_or(0);
                if bytes == 0 {
                    return None;
                }
                
                let percentage = if total_bytes > 0 {
                    (bytes as f64 / total_bytes as f64 * 100.0) as f32
                } else {
                    0.0
                };
                
                let color = data["color"].as_str()
                    .map(|c| c.to_string())
                    .unwrap_or_else(|| get_language_color(name));
                
                Some(LanguageStats {
                    name: name.clone(),
                    percentage,
                    bytes,
                    color,
                })
            })
            .filter(|lang| lang.percentage > 0.1)
            .collect();

        language_vec.sort_by(|a, b| b.percentage.partial_cmp(&a.percentage).unwrap());
        language_vec.truncate(10);
        
        log::info!("Found {} languages for project {}", language_vec.len(), project_path);
        for lang in &language_vec {
            log::debug!("  - {}: {:.1}% ({} bytes)", lang.name, lang.percentage, lang.bytes);
        }
        
        language_vec
    } else {
        log::warn!("No languages found in linguist output");
        Vec::new()
    };

    let total_files = result.get("files")
        .and_then(|f| f.get("count"))
        .and_then(|c| c.as_u64())
        .unwrap_or(0) as u32;
    
    let analysis = ProjectAnalysis {
        languages,
        total_files,
        total_bytes,
        analyzed_at: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs(),
    };

    // Store in both file and memory cache
    cache_analysis(&cache_key, &analysis)?;
    cache.set(cache_key, analysis.clone());
    
    Ok(analysis)
}

#[tauri::command]
pub async fn analyze_projects_batch(
    project_paths: Vec<String>,
    cache: State<'_, LanguageCache>,
) -> Result<Vec<(String, Result<ProjectAnalysis, String>)>, String> {
    use futures::future::join_all;
    
    log::info!("Batch analyzing {} projects", project_paths.len());
    
    let cache_ref = cache.inner().clone();
    
    let futures = project_paths.into_iter().map(|path| {
        let cache_clone = cache_ref.clone();
        async move {
            let result = analyze_single_project(path.clone(), &cache_clone).await;
            (path, result)
        }
    });
    
    let results = join_all(futures).await;
    Ok(results)
}

async fn analyze_single_project(
    project_path: String,
    cache: &LanguageCache,
) -> Result<ProjectAnalysis, String> {
    let path = PathBuf::from(&project_path);
    
    // Early return for non-existent paths
    if !path.exists() {
        log::warn!("Project path does not exist: {project_path}, returning empty analysis");
        return Ok(ProjectAnalysis {
            languages: Vec::new(),
            total_files: 0,
            total_bytes: 0,
            analyzed_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
        });
    }
    
    let cache_key = format!("lang_analysis_{}", project_path.replace("/", "_"));
    
    // Check in-memory cache first
    if let Some(cached) = cache.get(&cache_key) {
        return Ok(cached);
    }
    
    // Then check file cache
    if let Ok(cached) = get_cached_analysis(&cache_key) {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();
        
        if now - cached.analyzed_at < 3600 {
            // Store in memory cache for faster access
            cache.set(cache_key.clone(), cached.clone());
            return Ok(cached);
        }
    }
    
    // Skip analysis for empty directories
    if path.is_dir() {
        let mut entries = std::fs::read_dir(&path).map_err(|e| format!("Failed to read directory: {e}"))?;
        if entries.next().is_none() {
            log::info!("Directory is empty: {project_path}");
            return Ok(ProjectAnalysis {
                languages: Vec::new(),
                total_files: 0,
                total_bytes: 0,
                analyzed_at: std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_secs(),
            });
        }
    }
    
    // Run linguist-js
    let project_path_clone = project_path.clone();
    let output = tokio::task::spawn_blocking(move || {
        run_linguist_js(&project_path_clone)
    }).await
    .map_err(|e| format!("Failed to spawn blocking task: {e}"))?
    .map_err(|e| format!("Failed to run linguist-js: {e}"))?;
    
    // Parse and process the output
    let analysis = parse_linguist_output(output, &project_path)?;
    
    // Store in both file and memory cache
    cache_analysis(&cache_key, &analysis)?;
    cache.set(cache_key, analysis.clone());
    
    Ok(analysis)
}

fn run_linguist_js(project_path: &str) -> Result<std::process::Output, String> {
    let cmd_str = if cfg!(target_os = "windows") {
        format!(
            "npx linguist-js --analyze \"{project_path}\" --json 2>nul | node -e \"const input = require('fs').readFileSync(0, 'utf8'); if (input.trim()) {{ try {{ console.log(JSON.stringify(eval('(' + input + ')'))); }} catch (e) {{ console.error('Parse error:', e.message); process.exit(1); }} }} else {{ console.log('{{}}'); }}\""
        )
    } else {
        format!(
            "npx linguist-js --analyze \"{project_path}\" --json 2>/dev/null | node -e \"const input = require('fs').readFileSync(0, 'utf8'); if (input.trim()) {{ try {{ console.log(JSON.stringify(eval('(' + input + ')'))); }} catch (e) {{ console.error('Parse error:', e.message); process.exit(1); }} }} else {{ console.log('{{}}'); }}\""
        )
    };
    
    let output = if cfg!(target_os = "windows") {
        Command::new("cmd")
            .args(["/C", &cmd_str])
            .output()
    } else {
        Command::new("sh")
            .args(["-c", &cmd_str])
            .output()
    };
    
    output.map_err(|e| format!("Failed to run linguist-js: {e}"))
}

fn parse_linguist_output(output: std::process::Output, project_path: &str) -> Result<ProjectAnalysis, String> {
    if !output.status.success() {
        log::error!("linguist-js stderr: {}", String::from_utf8_lossy(&output.stderr));
        return Err(format!("linguist-js failed: {}", String::from_utf8_lossy(&output.stderr)));
    }
    
    log::debug!("linguist-js output length: {} bytes", output.stdout.len());
    
    // Handle empty output case
    if output.stdout.is_empty() || output.stdout == b"{}" {
        log::warn!("linguist-js returned empty output for {project_path}");
        return Ok(ProjectAnalysis {
            languages: Vec::new(),
            total_files: 0,
            total_bytes: 0,
            analyzed_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
        });
    }
    
    let result: serde_json::Value = serde_json::from_slice(&output.stdout)
        .map_err(|e| format!("Failed to parse linguist output: {e}"))?;
    
    log::debug!("Parsed JSON keys: {:?}", result.as_object().map(|o| o.keys().collect::<Vec<_>>()));
    
    // Handle missing fields gracefully
    let total_bytes = result.get("languages")
        .and_then(|l| l.get("bytes"))
        .and_then(|b| b.as_u64())
        .unwrap_or(0);
    
    let languages = if let Some(langs) = result.get("languages")
        .and_then(|l| l.get("results"))
        .and_then(|r| r.as_object()) {
        let mut language_vec: Vec<LanguageStats> = langs
            .iter()
            .filter_map(|(name, data)| {
                let bytes = data["bytes"].as_u64().unwrap_or(0);
                if bytes == 0 {
                    return None;
                }
                
                let percentage = if total_bytes > 0 {
                    (bytes as f64 / total_bytes as f64 * 100.0) as f32
                } else {
                    0.0
                };
                
                let color = data["color"].as_str()
                    .map(|c| c.to_string())
                    .unwrap_or_else(|| get_language_color(name));
                
                Some(LanguageStats {
                    name: name.clone(),
                    percentage,
                    bytes,
                    color,
                })
            })
            .filter(|lang| lang.percentage > 0.1)
            .collect();

        language_vec.sort_by(|a, b| b.percentage.partial_cmp(&a.percentage).unwrap());
        language_vec.truncate(10);
        
        log::info!("Found {} languages for project {}", language_vec.len(), project_path);
        for lang in &language_vec {
            log::debug!("  - {}: {:.1}% ({} bytes)", lang.name, lang.percentage, lang.bytes);
        }
        
        language_vec
    } else {
        log::warn!("No languages found in linguist output");
        Vec::new()
    };

    let total_files = result.get("files")
        .and_then(|f| f.get("count"))
        .and_then(|c| c.as_u64())
        .unwrap_or(0) as u32;
    
    Ok(ProjectAnalysis {
        languages,
        total_files,
        total_bytes,
        analyzed_at: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs(),
    })
}

fn get_language_color(language: &str) -> String {
    match language {
        "JavaScript" => "#f1e05a".to_string(),
        "TypeScript" => "#3178c6".to_string(),
        "Python" => "#3572A5".to_string(),
        "Rust" => "#dea584".to_string(),
        "Go" => "#00ADD8".to_string(),
        "Java" => "#b07219".to_string(),
        "C++" => "#f34b7d".to_string(),
        "C" => "#555555".to_string(),
        "C#" => "#178600".to_string(),
        "PHP" => "#4F5D95".to_string(),
        "Ruby" => "#701516".to_string(),
        "Swift" => "#FA7343".to_string(),
        "Kotlin" => "#A97BFF".to_string(),
        "Dart" => "#00B4AB".to_string(),
        "Vue" => "#41b883".to_string(),
        "HTML" => "#e34c26".to_string(),
        "CSS" => "#563d7c".to_string(),
        "SCSS" => "#c6538c".to_string(),
        "Shell" => "#89e051".to_string(),
        "YAML" => "#cb171e".to_string(),
        "JSON" => "#292929".to_string(),
        "Markdown" => "#083fa1".to_string(),
        _ => "#6c757d".to_string(),
    }
}

fn get_cached_analysis(cache_key: &str) -> Result<ProjectAnalysis, String> {
    let cache_dir = dirs::cache_dir()
        .ok_or("Failed to get cache directory")?
        .join("claudia")
        .join("language_cache");
    
    let cache_file = cache_dir.join(format!("{cache_key}.json"));
    
    if cache_file.exists() {
        let content = std::fs::read_to_string(&cache_file)
            .map_err(|e| format!("Failed to read cache: {e}"))?;
        
        let analysis = serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse cache: {e}"))?;
        
        Ok(analysis)
    } else {
        Err("Cache not found".to_string())
    }
}

fn cache_analysis(cache_key: &str, analysis: &ProjectAnalysis) -> Result<(), String> {
    let cache_dir = dirs::cache_dir()
        .ok_or("Failed to get cache directory")?
        .join("claudia")
        .join("language_cache");
    
    std::fs::create_dir_all(&cache_dir)
        .map_err(|e| format!("Failed to create cache directory: {e}"))?;
    
    let cache_file = cache_dir.join(format!("{cache_key}.json"));
    
    let content = serde_json::to_string(analysis)
        .map_err(|e| format!("Failed to serialize analysis: {e}"))?;
    
    std::fs::write(&cache_file, content)
        .map_err(|e| format!("Failed to write cache: {e}"))?;
    
    Ok(())
}