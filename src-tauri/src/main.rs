// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod sandbox;
mod checkpoint;
mod process;

use tauri::Manager;
use commands::claude::{
    get_claude_settings, get_project_sessions, get_system_prompt, list_projects, open_new_session,
    check_claude_version, save_system_prompt, save_claude_settings,
    find_claude_md_files, read_claude_md_file, save_claude_md_file,
    load_session_history, execute_claude_code, continue_claude_code, resume_claude_code,
    list_directory_contents, search_files,
    create_checkpoint, restore_checkpoint, list_checkpoints, fork_from_checkpoint,
    get_session_timeline, update_checkpoint_settings, get_checkpoint_diff,
    track_checkpoint_message, track_session_messages, check_auto_checkpoint, cleanup_old_checkpoints,
    get_checkpoint_settings, clear_checkpoint_manager, get_checkpoint_state_stats,
    get_recently_modified_files, cancel_claude_code, ClaudeProcessState,
};
use commands::agents::{
    init_database, list_agents, create_agent, update_agent, delete_agent, 
    get_agent, execute_agent, list_agent_runs, get_agent_run, 
    get_agent_run_with_real_time_metrics, list_agent_runs_with_metrics, 
    migrate_agent_runs_to_session_ids, list_running_sessions, kill_agent_session,
    get_session_status, cleanup_finished_processes, get_session_output, 
    get_live_session_output, stream_session_output, get_claude_binary_path,
    set_claude_binary_path, AgentDb
};
use commands::sandbox::{
    list_sandbox_profiles, create_sandbox_profile, update_sandbox_profile, delete_sandbox_profile,
    get_sandbox_profile, list_sandbox_rules, create_sandbox_rule, update_sandbox_rule,
    delete_sandbox_rule, get_platform_capabilities, test_sandbox_profile,
    list_sandbox_violations, log_sandbox_violation, clear_sandbox_violations, get_sandbox_violation_stats,
    export_sandbox_profile, export_all_sandbox_profiles, import_sandbox_profiles,
};
use commands::usage::{
    get_usage_stats, get_usage_by_date_range, get_usage_details, get_session_stats,
};
use commands::mcp::{
    mcp_add, mcp_list, mcp_get, mcp_remove, mcp_add_json, mcp_add_from_claude_desktop,
    mcp_serve, mcp_test_connection, mcp_reset_project_choices, mcp_get_server_status,
    mcp_read_project_config, mcp_save_project_config,
};
use std::sync::Mutex;
use checkpoint::state::CheckpointState;
use process::ProcessRegistryState;

fn main() {
    // Initialize logger
    env_logger::init();

    // Check if we need to activate sandbox in this process
    if sandbox::executor::should_activate_sandbox() {
        // This is a child process that needs sandbox activation
        if let Err(e) = sandbox::executor::SandboxExecutor::activate_sandbox_in_child() {
            log::error!("Failed to activate sandbox: {}", e);
            // Continue without sandbox rather than crashing
        }
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // Initialize agents database
            let conn = init_database(&app.handle()).expect("Failed to initialize agents database");
            app.manage(AgentDb(Mutex::new(conn)));
            
            // Initialize checkpoint state
            let checkpoint_state = CheckpointState::new();
            
            // Set the Claude directory path
            if let Ok(claude_dir) = dirs::home_dir()
                .ok_or_else(|| "Could not find home directory")
                .and_then(|home| {
                    let claude_path = home.join(".claude");
                    claude_path.canonicalize()
                        .map_err(|_| "Could not find ~/.claude directory")
                }) {
                let state_clone = checkpoint_state.clone();
                tauri::async_runtime::spawn(async move {
                    state_clone.set_claude_dir(claude_dir).await;
                });
            }
            
            app.manage(checkpoint_state);
            
            // Initialize process registry
            app.manage(ProcessRegistryState::default());
            
            // Initialize Claude process state
            app.manage(ClaudeProcessState::default());
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            list_projects,
            get_project_sessions,
            get_claude_settings,
            open_new_session,
            get_system_prompt,
            check_claude_version,
            save_system_prompt,
            save_claude_settings,
            find_claude_md_files,
            read_claude_md_file,
            save_claude_md_file,
            load_session_history,
            execute_claude_code,
            continue_claude_code,
            resume_claude_code,
            list_directory_contents,
            search_files,
            create_checkpoint,
            restore_checkpoint,
            list_checkpoints,
            fork_from_checkpoint,
            get_session_timeline,
            update_checkpoint_settings,
            get_checkpoint_diff,
            track_checkpoint_message,
            track_session_messages,
            check_auto_checkpoint,
            cleanup_old_checkpoints,
            get_checkpoint_settings,
            clear_checkpoint_manager,
            get_checkpoint_state_stats,
            get_recently_modified_files,
            cancel_claude_code,
            list_agents,
            create_agent,
            update_agent,
            delete_agent,
            get_agent,
            execute_agent,
            list_agent_runs,
            get_agent_run,
            get_agent_run_with_real_time_metrics,
            list_agent_runs_with_metrics,
            migrate_agent_runs_to_session_ids,
            list_running_sessions,
            kill_agent_session,
            get_session_status,
            cleanup_finished_processes,
            get_session_output,
            get_live_session_output,
            stream_session_output,
            get_claude_binary_path,
            set_claude_binary_path,
            list_sandbox_profiles,
            get_sandbox_profile,
            create_sandbox_profile,
            update_sandbox_profile,
            delete_sandbox_profile,
            list_sandbox_rules,
            create_sandbox_rule,
            update_sandbox_rule,
            delete_sandbox_rule,
            test_sandbox_profile,
            get_platform_capabilities,
            list_sandbox_violations,
            log_sandbox_violation,
            clear_sandbox_violations,
            get_sandbox_violation_stats,
            export_sandbox_profile,
            export_all_sandbox_profiles,
            import_sandbox_profiles,
            get_usage_stats,
            get_usage_by_date_range,
            get_usage_details,
            get_session_stats,
            mcp_add,
            mcp_list,
            mcp_get,
            mcp_remove,
            mcp_add_json,
            mcp_add_from_claude_desktop,
            mcp_serve,
            mcp_test_connection,
            mcp_reset_project_choices,
            mcp_get_server_status,
            mcp_read_project_config,
            mcp_save_project_config
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
