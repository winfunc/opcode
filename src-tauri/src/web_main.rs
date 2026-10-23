use clap::Parser;

mod checkpoint;
mod claude_binary;
mod commands;
mod process;
mod web_server;

#[derive(Parser)]
#[command(name = "opcode-web")]
#[command(about = "Opcode Web Server - Access Opcode from your phone")]
struct Args {
    /// Port to run the web server on
    #[arg(short, long, default_value = "8080")]
    port: u16,

    /// Host to bind to (defaults to localhost; pass 0.0.0.0 to expose on the network)
    #[arg(short = 'H', long, default_value = "127.0.0.1")]
    host: String,
}

#[tokio::main]
async fn main() {
    env_logger::init();

    let args = Args::parse();

    println!("🚀 Starting Opcode Web Server...");
    println!("🌐 Listening on http://{}:{}", args.host, args.port);
    if args.host == "0.0.0.0" {
        println!("⚠️  Bound to all interfaces without authentication - only do this on a trusted network.");
    }

    if let Err(e) = web_server::start_web_mode(Some(args.port), &args.host).await {
        eprintln!("❌ Failed to start web server: {}", e);
        std::process::exit(1);
    }
}
