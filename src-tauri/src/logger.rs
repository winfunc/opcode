use log::LevelFilter;
use std::env;

/// 初始化统一的日志配置
/// 根据环境和配置自动设置日志级别
pub fn init_logger() {
    let mut builder = env_logger::Builder::new();
    
    // 根据编译模式设置默认日志级别
    let default_level = if cfg!(debug_assertions) {
        LevelFilter::Debug
    } else {
        LevelFilter::Warn
    };
    
    // 从环境变量读取日志级别，优先级最高
    let log_level = env::var("RUST_LOG")
        .ok()
        .and_then(|level| level.parse().ok())
        .unwrap_or(default_level);
    
    builder
        .filter_level(log_level)
        .format_timestamp_secs()
        .format_module_path(false)
        .format_target(false);
    
    // 生产环境下的特殊配置
    if !cfg!(debug_assertions) {
        builder
            .format(|buf, record| {
                use std::io::Write;
                // 生产环境下简化日志格式
                writeln!(
                    buf,
                    "[{}] {}",
                    record.level(),
                    record.args()
                )
            });
    } else {
        // 开发环境下详细的日志格式
        builder
            .format(|buf, record| {
                use std::io::Write;
                writeln!(
                    buf,
                    "[{}] [{}:{}] {}",
                    record.level(),
                    record.file().unwrap_or("unknown"),
                    record.line().unwrap_or(0),
                    record.args()
                )
            });
    }
    
    builder.init();
    
    // 记录初始化信息
    log::info!("Logger initialized with level: {:?}", log_level);
    if cfg!(debug_assertions) {
        log::debug!("Running in debug mode");
    } else {
        log::info!("Running in release mode");
    }
}

/// 日志宏的便捷封装，在生产环境下自动过滤调试日志
#[macro_export]
macro_rules! debug_log {
    ($($arg:tt)*) => {
        #[cfg(debug_assertions)]
        log::debug!($($arg)*);
    };
}

#[macro_export]
macro_rules! info_log {
    ($($arg:tt)*) => {
        log::info!($($arg)*);
    };
}

#[macro_export]
macro_rules! warn_log {
    ($($arg:tt)*) => {
        log::warn!($($arg)*);
    };
}

#[macro_export]
macro_rules! error_log {
    ($($arg:tt)*) => {
        log::error!($($arg)*);
    };
}

/// 性能测量宏，仅在调试模式下启用
#[macro_export]
macro_rules! time_operation {
    ($name:expr, $operation:expr) => {{
        #[cfg(debug_assertions)]
        let start = std::time::Instant::now();
        
        let result = $operation;
        
        #[cfg(debug_assertions)]
        {
            let duration = start.elapsed();
            log::debug!("Operation '{}' took: {:?}", $name, duration);
        }
        
        result
    }};
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_logger_macros() {
        init_logger();
        
        debug_log!("This is a debug message");
        info_log!("This is an info message");
        warn_log!("This is a warning message");
        error_log!("This is an error message");
        
        let result = time_operation!("test_operation", {
            std::thread::sleep(std::time::Duration::from_millis(10));
            42
        });
        
        assert_eq!(result, 42);
    }
}