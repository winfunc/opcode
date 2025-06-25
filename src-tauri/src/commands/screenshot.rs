use headless_chrome::protocol::cdp::Page;
use headless_chrome::{Browser, LaunchOptions};
use std::fs;
use std::time::Duration;
use tauri::AppHandle;

/// Captures a screenshot of a URL using headless Chrome
///
/// This function launches a headless Chrome browser, navigates to the specified URL,
/// and captures a screenshot of either the entire page or a specific element.
///
/// # Arguments
/// * `app` - The Tauri application handle
/// * `url` - The URL to capture
/// * `selector` - Optional CSS selector for a specific element to capture
/// * `full_page` - Whether to capture the entire page or just the viewport
///
/// # Returns
/// * `Result<String, String>` - The path to the saved screenshot file, or an error message
#[tauri::command]
pub async fn capture_url_screenshot(
    _app: AppHandle,
    url: String,
    selector: Option<String>,
    full_page: bool,
) -> Result<String, String> {
    log::info!(
        "Capturing screenshot of URL: {}, selector: {:?}, full_page: {}",
        url,
        selector,
        full_page
    );

    // Run the browser operations in a blocking task since headless_chrome is not async
    let result =
        tokio::task::spawn_blocking(move || capture_screenshot_sync(url, selector, full_page))
            .await
            .map_err(|e| format!("Failed to spawn blocking task: {}", e))?;

    // Log the result of the headless Chrome capture before returning
    match &result {
        Ok(path) => log::info!("capture_url_screenshot returning path: {}", path),
        Err(err) => log::error!("capture_url_screenshot encountered error: {}", err),
    }

    result
}

/// Synchronous helper function to capture screenshots using headless Chrome
fn capture_screenshot_sync(
    url: String,
    selector: Option<String>,
    full_page: bool,
) -> Result<String, String> {
    // Configure browser launch options
    let launch_options = LaunchOptions {
        headless: true,
        window_size: Some((1920, 1080)),
        ..Default::default()
    };

    // Launch the browser
    let browser =
        Browser::new(launch_options).map_err(|e| format!("Failed to launch browser: {}", e))?;

    // Create a new tab
    let tab = browser
        .new_tab()
        .map_err(|e| format!("Failed to create new tab: {}", e))?;

    // Set a reasonable timeout for page navigation
    tab.set_default_timeout(Duration::from_secs(30));

    // Navigate to the URL
    tab.navigate_to(&url)
        .map_err(|e| format!("Failed to navigate to URL: {}", e))?;

    // Wait for the page to load
    // Try to wait for network idle, but don't fail if it times out
    let _ = tab.wait_until_navigated();

    // Additional wait to ensure dynamic content loads
    std::thread::sleep(Duration::from_millis(500));

    // Wait explicitly for the <body> element to exist – this often prevents
    // "Unable to capture screenshot" CDP errors on some pages
    if let Err(e) = tab.wait_for_element("body") {
        log::warn!(
            "Timed out waiting for <body> element: {} – continuing anyway",
            e
        );
    }

    // Capture the screenshot
    let screenshot_data = if let Some(selector) = selector {
        // Wait for the element and capture it
        log::info!("Waiting for element with selector: {}", selector);

        let element = tab
            .wait_for_element(&selector)
            .map_err(|e| format!("Failed to find element '{}': {}", selector, e))?;

        element
            .capture_screenshot(Page::CaptureScreenshotFormatOption::Png)
            .map_err(|e| format!("Failed to capture element screenshot: {}", e))?
    } else {
        // Capture the entire page or viewport
        log::info!(
            "Capturing {} screenshot",
            if full_page { "full page" } else { "viewport" }
        );

        // Get the page dimensions for full page screenshot
        let clip = if full_page {
            // Execute JavaScript to get the full page dimensions
            let dimensions = tab
                .evaluate(
                    r#"
                    ({
                        width: Math.max(
                            document.body.scrollWidth,
                            document.documentElement.scrollWidth,
                            document.body.offsetWidth,
                            document.documentElement.offsetWidth,
                            document.documentElement.clientWidth
                        ),
                        height: Math.max(
                            document.body.scrollHeight,
                            document.documentElement.scrollHeight,
                            document.body.offsetHeight,
                            document.documentElement.offsetHeight,
                            document.documentElement.clientHeight
                        )
                    })
                    "#,
                    false,
                )
                .map_err(|e| format!("Failed to get page dimensions: {}", e))?;

            // Extract dimensions from the result
            let width = dimensions
                .value
                .as_ref()
                .and_then(|v| v.as_object())
                .and_then(|obj| obj.get("width"))
                .and_then(|v| v.as_f64())
                .unwrap_or(1920.0);

            let height = dimensions
                .value
                .as_ref()
                .and_then(|v| v.as_object())
                .and_then(|obj| obj.get("height"))
                .and_then(|v| v.as_f64())
                .unwrap_or(1080.0);

            Some(Page::Viewport {
                x: 0.0,
                y: 0.0,
                width,
                height,
                scale: 1.0,
            })
        } else {
            None
        };

        let capture_result = tab.capture_screenshot(
            Page::CaptureScreenshotFormatOption::Png,
            None,
            clip.clone(),
            full_page, // capture_beyond_viewport only makes sense for full page
        );

        match capture_result {
            Ok(data) => data,
            Err(err) => {
                // Retry once with capture_beyond_viewport=true which works around some Chromium bugs
                log::warn!(
                    "Initial screenshot attempt failed: {}. Retrying with capture_beyond_viewport=true",
                    err
                );

                tab.capture_screenshot(Page::CaptureScreenshotFormatOption::Png, None, clip, true)
                    .map_err(|e| format!("Failed to capture screenshot after retry: {}", e))?
            }
        }
    };

    // Save to temporary file
    let temp_dir = std::env::temp_dir();
    let timestamp = chrono::Utc::now().timestamp_millis();
    let filename = format!("claudia_screenshot_{}.png", timestamp);
    let file_path = temp_dir.join(filename);

    fs::write(&file_path, screenshot_data)
        .map_err(|e| format!("Failed to save screenshot: {}", e))?;

    // Log the screenshot path prominently
    println!("═══════════════════════════════════════════════════════════════");
    println!("📸 SCREENSHOT SAVED SUCCESSFULLY!");
    println!("📁 Location: {}", file_path.display());
    println!("═══════════════════════════════════════════════════════════════");

    log::info!("Screenshot saved to: {:?}", file_path);

    Ok(file_path.to_string_lossy().to_string())
}

/// Cleans up old screenshot files from the temporary directory
///
/// This function removes screenshot files older than the specified number of minutes
/// to prevent accumulation of temporary files.
///
/// # Arguments
/// * `older_than_minutes` - Remove files older than this many minutes (default: 60)
///
/// # Returns
/// * `Result<usize, String>` - The number of files deleted, or an error message
#[tauri::command]
pub async fn cleanup_screenshot_temp_files(
    older_than_minutes: Option<u64>,
) -> Result<usize, String> {
    let minutes = older_than_minutes.unwrap_or(60);
    log::info!(
        "Cleaning up screenshot files older than {} minutes",
        minutes
    );

    let temp_dir = std::env::temp_dir();
    let cutoff_time = chrono::Utc::now() - chrono::Duration::minutes(minutes as i64);
    let mut deleted_count = 0;

    // Read directory entries
    let entries =
        fs::read_dir(&temp_dir).map_err(|e| format!("Failed to read temp directory: {}", e))?;

    for entry in entries {
        if let Ok(entry) = entry {
            let path = entry.path();

            // Check if it's a claudia screenshot file
            if let Some(filename) = path.file_name() {
                if let Some(filename_str) = filename.to_str() {
                    if filename_str.starts_with("claudia_screenshot_")
                        && filename_str.ends_with(".png")
                    {
                        // Check file age
                        if let Ok(metadata) = fs::metadata(&path) {
                            if let Ok(modified) = metadata.modified() {
                                let modified_time = chrono::DateTime::<chrono::Utc>::from(modified);
                                if modified_time < cutoff_time {
                                    // Delete the file
                                    if fs::remove_file(&path).is_ok() {
                                        deleted_count += 1;
                                        log::debug!("Deleted old screenshot: {:?}", path);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    log::info!("Cleaned up {} old screenshot files", deleted_count);
    Ok(deleted_count)
}
