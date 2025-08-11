use std::fs;
use std::path::Path;
use serde::{Deserialize, Serialize};
use anyhow::Result;
use pdf_extract::extract_text;
use csv::Reader;
use calamine::{open_workbook, Reader as CalamineReader, Xlsx, Data};

#[derive(Debug, Serialize, Deserialize)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_directory: bool,
    pub size: Option<u64>,
    pub extension: Option<String>,
}

#[tauri::command]
pub async fn read_directory(path: String) -> Result<Vec<FileEntry>, String> {
    let expanded_path = if path.starts_with("~/") {
        let home = dirs::home_dir()
            .ok_or_else(|| "Cannot find home directory".to_string())?;
        home.join(&path[2..])
    } else {
        Path::new(&path).to_path_buf()
    };
    
    if !expanded_path.exists() || !expanded_path.is_dir() {
        return Err("Directory does not exist".to_string());
    }

    let mut entries = Vec::new();
    
    match fs::read_dir(&expanded_path) {
        Ok(dir_entries) => {
            for entry in dir_entries {
                match entry {
                    Ok(entry) => {
                        let path = entry.path();
                        let name = path.file_name()
                            .and_then(|n| n.to_str())
                            .unwrap_or("Unknown")
                            .to_string();
                        
                        let is_directory = path.is_dir();
                        let size = if is_directory {
                            None
                        } else {
                            fs::metadata(&path).ok().map(|m| m.len())
                        };
                        
                        let extension = if is_directory {
                            None
                        } else {
                            path.extension()
                                .and_then(|ext| ext.to_str())
                                .map(|s| s.to_string())
                        };

                        entries.push(FileEntry {
                            name,
                            path: path.to_string_lossy().to_string(),
                            is_directory,
                            size,
                            extension,
                        });
                    }
                    Err(_) => continue,
                }
            }
        }
        Err(e) => return Err(format!("Failed to read directory: {}", e)),
    }
    
    // Sort directories first, then files
    entries.sort_by(|a, b| {
        match (a.is_directory, b.is_directory) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });
    
    Ok(entries)
}

#[tauri::command]
pub async fn get_default_directories() -> Result<Vec<String>, String> {
    let home = dirs::home_dir()
        .ok_or_else(|| "Cannot find home directory".to_string())?;
    
    let default_dirs = vec![
        home.to_string_lossy().to_string(),
        home.join("Documents").to_string_lossy().to_string(),
        home.join("Downloads").to_string_lossy().to_string(),
        home.join("Pictures").to_string_lossy().to_string(),
        home.join("Movies").to_string_lossy().to_string(),
        home.join("Music").to_string_lossy().to_string(),
    ];
    
    Ok(default_dirs)
}

#[tauri::command]
pub async fn read_file(file_path: String) -> Result<String, String> {
    let expanded_path = if file_path.starts_with("~/") {
        let home = dirs::home_dir()
            .ok_or_else(|| "Cannot find home directory".to_string())?;
        home.join(&file_path[2..])
    } else {
        Path::new(&file_path).to_path_buf()
    };
    
    if !expanded_path.exists() || expanded_path.is_dir() {
        return Err("File does not exist or is a directory".to_string());
    }
    
    // Check file size to prevent reading very large files
    if let Ok(metadata) = fs::metadata(&expanded_path) {
        if metadata.len() > 1024 * 1024 { // 1MB limit
            return Err("File is too large to display".to_string());
        }
    }
    
    match fs::read_to_string(&expanded_path) {
        Ok(content) => Ok(content),
        Err(e) => Err(format!("Failed to read file: {}", e)),
    }
}

#[tauri::command]
pub async fn read_pdf_content(file_path: String) -> Result<String, String> {
    let expanded_path = if file_path.starts_with("~/") {
        let home = dirs::home_dir()
            .ok_or_else(|| "Cannot find home directory".to_string())?;
        home.join(&file_path[2..])
    } else {
        Path::new(&file_path).to_path_buf()
    };
    
    if !expanded_path.exists() || expanded_path.is_dir() {
        return Err("File does not exist or is a directory".to_string());
    }
    
    match extract_text(&expanded_path) {
        Ok(content) => Ok(content),
        Err(e) => Err(format!("Failed to extract PDF content: {}", e)),
    }
}

#[tauri::command]
pub async fn read_csv_content(file_path: String) -> Result<String, String> {
    let expanded_path = if file_path.starts_with("~/") {
        let home = dirs::home_dir()
            .ok_or_else(|| "Cannot find home directory".to_string())?;
        home.join(&file_path[2..])
    } else {
        Path::new(&file_path).to_path_buf()
    };
    
    if !expanded_path.exists() || expanded_path.is_dir() {
        return Err("File does not exist or is a directory".to_string());
    }
    
    let file = std::fs::File::open(expanded_path)
        .map_err(|e| format!("Failed to open CSV file: {}", e))?;
    
    let mut reader = Reader::from_reader(file);
    let mut content = String::new();
    
    // Read headers if they exist
    if let Ok(headers) = reader.headers() {
        content.push_str(&headers.iter().collect::<Vec<_>>().join(","));
        content.push('\n');
    }
    
    // Read all records
    for (i, result) in reader.records().enumerate() {
        if i >= 1000 { // Limit to first 1000 rows for performance
            content.push_str(&format!("... (truncated at {} rows)\n", i));
            break;
        }
        
        match result {
            Ok(record) => {
                content.push_str(&record.iter().collect::<Vec<_>>().join(","));
                content.push('\n');
            }
            Err(e) => {
                content.push_str(&format!("Error reading row {}: {}\n", i, e));
            }
        }
    }
    
    Ok(content)
}

#[tauri::command]
pub async fn read_xlsx_content(file_path: String) -> Result<String, String> {
    let expanded_path = if file_path.starts_with("~/") {
        let home = dirs::home_dir()
            .ok_or_else(|| "Cannot find home directory".to_string())?;
        home.join(&file_path[2..])
    } else {
        Path::new(&file_path).to_path_buf()
    };
    
    if !expanded_path.exists() || expanded_path.is_dir() {
        return Err("File does not exist or is a directory".to_string());
    }
    
    let mut workbook: Xlsx<_> = open_workbook(&expanded_path)
        .map_err(|e| format!("Failed to open XLSX file: {}", e))?;
    
    let mut content = String::new();
    
    // Get the first worksheet
    let sheet_names = workbook.sheet_names().to_owned();
    if sheet_names.is_empty() {
        return Err("No worksheets found in XLSX file".to_string());
    }
    
    let sheet_name = &sheet_names[0];
    content.push_str(&format!("Sheet: {}\n\n", sheet_name));
    
    if let Ok(range) = workbook.worksheet_range(sheet_name) {
        let mut row_count = 0;
        for row in range.rows() {
            if row_count >= 1000 { // Limit to first 1000 rows for performance
                content.push_str(&format!("... (truncated at {} rows)\n", row_count));
                break;
            }
            
            let row_data: Vec<String> = row.iter()
                .map(|cell| match cell {
                    Data::Empty => String::new(),
                    Data::String(s) => s.clone(),
                    Data::Float(f) => f.to_string(),
                    Data::Int(i) => i.to_string(),
                    Data::Bool(b) => b.to_string(),
                    Data::Error(e) => format!("Error: {:?}", e),
                    Data::DateTime(dt) => format!("{}", dt),
                    Data::DateTimeIso(dt) => dt.clone(),
                    Data::DurationIso(d) => d.clone(),
                })
                .collect();
            
            content.push_str(&row_data.join("\t"));
            content.push('\n');
            row_count += 1;
        }
    }
    
    Ok(content)
}

#[tauri::command]
pub async fn calculate_file_tokens(file_path: String) -> Result<Option<u32>, String> {
    let path = Path::new(&file_path);
    
    if !path.exists() || path.is_dir() {
        return Ok(None);
    }
    
    let extension = path.extension()
        .and_then(|ext| ext.to_str())
        .map(|s| s.to_lowercase());
    
    // Only calculate tokens for text, image, audio, and document files
    let is_supported = match extension.as_deref() {
        Some("txt") | Some("md") | Some("rs") | Some("js") | Some("ts") | Some("tsx") | 
        Some("jsx") | Some("py") | Some("java") | Some("cpp") | Some("c") | Some("h") |
        Some("css") | Some("html") | Some("json") | Some("xml") | Some("yaml") |
        Some("yml") | Some("toml") | Some("cfg") | Some("ini") | Some("sh") |
        Some("png") | Some("jpg") | Some("jpeg") | Some("gif") | Some("webp") |
        Some("mp3") | Some("wav") | Some("flac") | Some("ogg") |
        Some("pdf") | Some("csv") | Some("xlsx") => true,
        _ => false,
    };
    
    if !is_supported {
        return Ok(None);
    }
    
    // For now, return a simple estimation based on file size
    // In a real implementation, you would use tiktoken-rs here
    match fs::metadata(path) {
        Ok(metadata) => {
            let size = metadata.len();
            // Rough estimation: ~4 characters per token for text files
            let estimated_tokens = match extension.as_deref() {
                Some("png") | Some("jpg") | Some("jpeg") | Some("gif") | Some("webp") => {
                    // Image tokens estimation (very rough)
                    (size / 1000) as u32 + 100
                }
                Some("mp3") | Some("wav") | Some("flac") | Some("ogg") => {
                    // Audio tokens estimation (very rough)
                    (size / 10000) as u32 + 50
                }
                Some("pdf") => {
                    // PDF tokens estimation (rough, based on compressed text)
                    (size / 8) as u32 + 100
                }
                Some("csv") => {
                    // CSV tokens estimation (similar to text but more structured)
                    (size / 5) as u32
                }
                Some("xlsx") => {
                    // XLSX tokens estimation (compressed format)
                    (size / 15) as u32 + 200
                }
                _ => {
                    // Text files
                    (size / 4) as u32
                }
            };
            Ok(Some(estimated_tokens))
        }
        Err(_) => Ok(None),
    }
}