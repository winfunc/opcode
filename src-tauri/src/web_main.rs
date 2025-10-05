use clap::Parser;

mod commands;
mod checkpoint;
mod claude_binary;
mod process;
mod web_server;

#[derive(Parser)]
#[command(name = "claudia-web")]
#[command(about = "Claudia Web Server - Access Claudia from your phone")]
struct Args {
    /// Port to run the web server on
    #[arg(short, long, default_value = "8080")]
    port: u16,
    
    /// Host to bind to (0.0.0.0 for all interfaces)
    #[arg(short = 'H', long, default_value = "0.0.0.0")]
    host: String,
}

#[tokio::main]
async fn main() {
    env_logger::init();
    
    let args = Args::parse();
    
    println!("🚀 Starting Claudia Web Server...");
    println!("📱 Will be accessible from phones at: http://{}:{}", args.host, args.port);
    
    if let Err(e) = web_server::start_web_mode(Some(args.port)).await {
        eprintln!("❌ Failed to start web server: {}", e);
        std::process::exit(1);
    }
}