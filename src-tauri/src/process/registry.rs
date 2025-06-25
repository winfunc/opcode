use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tokio::process::Child;

/// Information about a running agent process
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessInfo {
    pub run_id: i64,
    pub agent_id: i64,
    pub agent_name: String,
    pub pid: u32,
    pub started_at: DateTime<Utc>,
    pub project_path: String,
    pub task: String,
    pub model: String,
}

/// Information about a running process with handle
#[allow(dead_code)]
pub struct ProcessHandle {
    pub info: ProcessInfo,
    pub child: Arc<Mutex<Option<Child>>>,
    pub live_output: Arc<Mutex<String>>,
}

/// Registry for tracking active agent processes
pub struct ProcessRegistry {
    processes: Arc<Mutex<HashMap<i64, ProcessHandle>>>, // run_id -> ProcessHandle
}

impl ProcessRegistry {
    pub fn new() -> Self {
        Self {
            processes: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Register a new running process
    pub fn register_process(
        &self,
        run_id: i64,
        agent_id: i64,
        agent_name: String,
        pid: u32,
        project_path: String,
        task: String,
        model: String,
        child: Child,
    ) -> Result<(), String> {
        let mut processes = self.processes.lock().map_err(|e| e.to_string())?;

        let process_info = ProcessInfo {
            run_id,
            agent_id,
            agent_name,
            pid,
            started_at: Utc::now(),
            project_path,
            task,
            model,
        };

        let process_handle = ProcessHandle {
            info: process_info,
            child: Arc::new(Mutex::new(Some(child))),
            live_output: Arc::new(Mutex::new(String::new())),
        };

        processes.insert(run_id, process_handle);
        Ok(())
    }

    /// Unregister a process (called when it completes)
    #[allow(dead_code)]
    pub fn unregister_process(&self, run_id: i64) -> Result<(), String> {
        let mut processes = self.processes.lock().map_err(|e| e.to_string())?;
        processes.remove(&run_id);
        Ok(())
    }

    /// Get all running processes
    #[allow(dead_code)]
    pub fn get_running_processes(&self) -> Result<Vec<ProcessInfo>, String> {
        let processes = self.processes.lock().map_err(|e| e.to_string())?;
        Ok(processes
            .values()
            .map(|handle| handle.info.clone())
            .collect())
    }

    /// Get a specific running process
    #[allow(dead_code)]
    pub fn get_process(&self, run_id: i64) -> Result<Option<ProcessInfo>, String> {
        let processes = self.processes.lock().map_err(|e| e.to_string())?;
        Ok(processes.get(&run_id).map(|handle| handle.info.clone()))
    }

    /// Kill a running process with proper cleanup
    pub async fn kill_process(&self, run_id: i64) -> Result<bool, String> {
        use log::{error, info, warn};

        // First check if the process exists and get its PID
        let (pid, child_arc) = {
            let processes = self.processes.lock().map_err(|e| e.to_string())?;
            if let Some(handle) = processes.get(&run_id) {
                (handle.info.pid, handle.child.clone())
            } else {
                return Ok(false); // Process not found
            }
        };

        info!(
            "Attempting graceful shutdown of process {} (PID: {})",
            run_id, pid
        );

        // Send kill signal to the process
        let kill_sent = {
            let mut child_guard = child_arc.lock().map_err(|e| e.to_string())?;
            if let Some(child) = child_guard.as_mut() {
                match child.start_kill() {
                    Ok(_) => {
                        info!("Successfully sent kill signal to process {}", run_id);
                        true
                    }
                    Err(e) => {
                        error!("Failed to send kill signal to process {}: {}", run_id, e);
                        return Err(format!("Failed to kill process: {}", e));
                    }
                }
            } else {
                false // Process already killed
            }
        };

        if !kill_sent {
            return Ok(false);
        }

        // Wait for the process to exit (with timeout)
        let wait_result = tokio::time::timeout(tokio::time::Duration::from_secs(5), async {
            loop {
                // Check if process has exited
                let status = {
                    let mut child_guard = child_arc.lock().map_err(|e| e.to_string())?;
                    if let Some(child) = child_guard.as_mut() {
                        match child.try_wait() {
                            Ok(Some(status)) => {
                                info!("Process {} exited with status: {:?}", run_id, status);
                                *child_guard = None; // Clear the child handle
                                Some(Ok::<(), String>(()))
                            }
                            Ok(None) => {
                                // Still running
                                None
                            }
                            Err(e) => {
                                error!("Error checking process status: {}", e);
                                Some(Err(e.to_string()))
                            }
                        }
                    } else {
                        // Process already gone
                        Some(Ok(()))
                    }
                };

                match status {
                    Some(result) => return result,
                    None => {
                        // Still running, wait a bit
                        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
                    }
                }
            }
        })
        .await;

        match wait_result {
            Ok(Ok(_)) => {
                info!("Process {} exited gracefully", run_id);
            }
            Ok(Err(e)) => {
                error!("Error waiting for process {}: {}", run_id, e);
            }
            Err(_) => {
                warn!("Process {} didn't exit within 5 seconds after kill", run_id);
                // Force clear the handle
                if let Ok(mut child_guard) = child_arc.lock() {
                    *child_guard = None;
                }
            }
        }

        // Remove from registry after killing
        self.unregister_process(run_id)?;

        Ok(true)
    }

    /// Kill a process by PID using system commands (fallback method)
    pub fn kill_process_by_pid(&self, run_id: i64, pid: u32) -> Result<bool, String> {
        use log::{error, info, warn};

        info!("Attempting to kill process {} by PID {}", run_id, pid);

        let kill_result = if cfg!(target_os = "windows") {
            std::process::Command::new("taskkill")
                .args(["/F", "/PID", &pid.to_string()])
                .output()
        } else {
            // First try SIGTERM
            let term_result = std::process::Command::new("kill")
                .args(["-TERM", &pid.to_string()])
                .output();

            match &term_result {
                Ok(output) if output.status.success() => {
                    info!("Sent SIGTERM to PID {}", pid);
                    // Give it 2 seconds to exit gracefully
                    std::thread::sleep(std::time::Duration::from_secs(2));

                    // Check if still running
                    let check_result = std::process::Command::new("kill")
                        .args(["-0", &pid.to_string()])
                        .output();

                    if let Ok(output) = check_result {
                        if output.status.success() {
                            // Still running, send SIGKILL
                            warn!(
                                "Process {} still running after SIGTERM, sending SIGKILL",
                                pid
                            );
                            std::process::Command::new("kill")
                                .args(["-KILL", &pid.to_string()])
                                .output()
                        } else {
                            term_result
                        }
                    } else {
                        term_result
                    }
                }
                _ => {
                    // SIGTERM failed, try SIGKILL directly
                    warn!("SIGTERM failed for PID {}, trying SIGKILL", pid);
                    std::process::Command::new("kill")
                        .args(["-KILL", &pid.to_string()])
                        .output()
                }
            }
        };

        match kill_result {
            Ok(output) => {
                if output.status.success() {
                    info!("Successfully killed process with PID {}", pid);
                    // Remove from registry
                    self.unregister_process(run_id)?;
                    Ok(true)
                } else {
                    let error_msg = String::from_utf8_lossy(&output.stderr);
                    warn!("Failed to kill PID {}: {}", pid, error_msg);
                    Ok(false)
                }
            }
            Err(e) => {
                error!("Failed to execute kill command for PID {}: {}", pid, e);
                Err(format!("Failed to execute kill command: {}", e))
            }
        }
    }

    /// Check if a process is still running by trying to get its status
    #[allow(dead_code)]
    pub async fn is_process_running(&self, run_id: i64) -> Result<bool, String> {
        let processes = self.processes.lock().map_err(|e| e.to_string())?;

        if let Some(handle) = processes.get(&run_id) {
            let child_arc = handle.child.clone();
            drop(processes); // Release the lock before async operation

            let mut child_guard = child_arc.lock().map_err(|e| e.to_string())?;
            if let Some(ref mut child) = child_guard.as_mut() {
                match child.try_wait() {
                    Ok(Some(_)) => {
                        // Process has exited
                        *child_guard = None;
                        Ok(false)
                    }
                    Ok(None) => {
                        // Process is still running
                        Ok(true)
                    }
                    Err(_) => {
                        // Error checking status, assume not running
                        *child_guard = None;
                        Ok(false)
                    }
                }
            } else {
                Ok(false) // No child handle
            }
        } else {
            Ok(false) // Process not found in registry
        }
    }

    /// Append to live output for a process
    pub fn append_live_output(&self, run_id: i64, output: &str) -> Result<(), String> {
        let processes = self.processes.lock().map_err(|e| e.to_string())?;
        if let Some(handle) = processes.get(&run_id) {
            let mut live_output = handle.live_output.lock().map_err(|e| e.to_string())?;
            live_output.push_str(output);
            live_output.push('\n');
        }
        Ok(())
    }

    /// Get live output for a process
    pub fn get_live_output(&self, run_id: i64) -> Result<String, String> {
        let processes = self.processes.lock().map_err(|e| e.to_string())?;
        if let Some(handle) = processes.get(&run_id) {
            let live_output = handle.live_output.lock().map_err(|e| e.to_string())?;
            Ok(live_output.clone())
        } else {
            Ok(String::new())
        }
    }

    /// Cleanup finished processes
    #[allow(dead_code)]
    pub async fn cleanup_finished_processes(&self) -> Result<Vec<i64>, String> {
        let mut finished_runs = Vec::new();
        let processes_lock = self.processes.clone();

        // First, identify finished processes
        {
            let processes = processes_lock.lock().map_err(|e| e.to_string())?;
            let run_ids: Vec<i64> = processes.keys().cloned().collect();
            drop(processes);

            for run_id in run_ids {
                if !self.is_process_running(run_id).await? {
                    finished_runs.push(run_id);
                }
            }
        }

        // Then remove them from the registry
        {
            let mut processes = processes_lock.lock().map_err(|e| e.to_string())?;
            for run_id in &finished_runs {
                processes.remove(run_id);
            }
        }

        Ok(finished_runs)
    }
}

impl Default for ProcessRegistry {
    fn default() -> Self {
        Self::new()
    }
}

/// Global process registry state
pub struct ProcessRegistryState(pub Arc<ProcessRegistry>);

impl Default for ProcessRegistryState {
    fn default() -> Self {
        Self(Arc::new(ProcessRegistry::new()))
    }
}
