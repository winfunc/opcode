{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  buildInputs = with pkgs; [
    # Core development tools
    just
    git

    # Node.js/Bun toolchain
    bun
    nodejs

    # Rust toolchain
    rustc
    cargo
    rustfmt
    clippy
    
    # System dependencies for Tauri development
    pkg-config
    webkitgtk_4_1
    gtk3
    cairo
    gdk-pixbuf
    glib
    dbus
    openssl
    librsvg
    libsoup_3
    libayatana-appindicator
    
    # Development utilities
    curl
    wget
    jq
  ];
  
  # Environment variables for development
  RUST_SRC_PATH = "${pkgs.rust.packages.stable.rustPlatform.rustLibSrc}";
}
