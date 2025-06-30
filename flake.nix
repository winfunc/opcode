{
  description = "Claudia - A Tauri application";

  nixConfig = {
    extra-substituters = [
      "https://cache.nixos.org"
      "https://cache.garnix.io"
    ];
    extra-trusted-public-keys = [
      "cache.nixos.org-1:6NCHdD59X431o0gWypbMrAURkbJ16ZPMQFGspcDShjY="
      "cache.garnix.io:CTFPyKSLcx5RMKJfLo5EEPUObbA78b0YQ2DTCJXqr9g="
    ];
  };

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    rust-overlay = {
      url = "github:oxalica/rust-overlay";
      inputs.nixpkgs.follows = "nixpkgs";
    };
    bun2nix = {
      url = "github:baileyluTCD/bun2nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = { self, nixpkgs, flake-utils, rust-overlay, bun2nix }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        overlays = [ (import rust-overlay) ];
        pkgs = import nixpkgs {
          inherit system overlays;
          config = {
            allowUnfree = true;
          };
        };
        lib = pkgs.lib;
        
        rustToolchain = pkgs.rust-bin.stable.latest.default.override {
          extensions = [ "rust-src" "rustfmt" ];
        };

        # Build dependencies
        buildInputs = with pkgs; [
          rustToolchain
          pkg-config
          openssl
          sqlite
          claude-code
          # Graphics and display dependencies
          libGL
          libGLU
          mesa
          vulkan-loader
          vulkan-validation-layers
        ] ++ lib.optionals stdenv.isDarwin [
          darwin.apple_sdk.frameworks.AppKit
          darwin.apple_sdk.frameworks.WebKit
          darwin.apple_sdk.frameworks.Security
          darwin.apple_sdk.frameworks.CoreGraphics
          darwin.apple_sdk.frameworks.CoreServices
        ] ++ lib.optionals stdenv.isLinux [
          gtk3
          webkitgtk_4_1
          libsoup_3
          glib
          cairo
          gdk-pixbuf
          pango
          # Wayland support
          wayland
          wayland-protocols
          libxkbcommon
          # X11 fallback
          xorg.libX11
          xorg.libXrandr
          xorg.libXi
          xorg.libXcursor
        ];

        nativeBuildInputs = with pkgs; [
          nodejs_20
          bun
          cargo-tauri
          wrapGAppsHook3
        ];

      in
      {
        packages = {
          default = self.packages.${system}.claudia;
          
          # Build the frontend using bun2nix
          claudia-frontend = bun2nix.lib.${system}.mkBunDerivation {
            pname = "claudia-frontend";
            version = "0.1.0";
            # Filter source to only include frontend files for better caching
            src = lib.cleanSourceWith {
              src = ./.;
              filter = path: type:
                let 
                  baseName = baseNameOf path;
                  relativePath = lib.removePrefix (toString ./. + "/") (toString path);
                in
                # Include essential files and frontend directories
                (lib.hasPrefix "src/" relativePath) ||
                (lib.hasPrefix "public/" relativePath) ||
                (baseName == "package.json") ||
                (baseName == "bun.lock") ||
                (baseName == "bun.nix") ||
                (baseName == "tsconfig.json") ||
                (baseName == "tsconfig.node.json") ||
                (baseName == "vite.config.ts") ||
                (baseName == "tailwind.config.js") ||
                (baseName == "postcss.config.js") ||
                (baseName == "index.html") ||
                (type == "directory" && !lib.hasPrefix "src-tauri/" relativePath && !lib.hasPrefix ".git/" relativePath && !lib.hasPrefix "target/" relativePath);
            };
            bunNix = ./bun.nix;
            index = "src/main.tsx";
            # Override install phase to build and copy our frontend
            installPhase = ''
              # Run the build
              bun run build
              
              # Create output directory and copy built files
              mkdir -p $out
              cp -r dist $out/
            '';
          };
          
          claudia = pkgs.rustPlatform.buildRustPackage rec {
            pname = "claudia";
            version = "0.1.0";
            
            # Include all src-tauri files except nix-specific ones
            src = lib.cleanSourceWith {
              src = ./src-tauri;
              filter = path: type:
                let 
                  baseName = baseNameOf path;
                  relativePath = lib.removePrefix (toString ./src-tauri + "/") (toString path);
                in
                # Exclude nix-specific files but include everything else
                !(lib.hasPrefix ".nix" baseName) &&
                !(lib.hasSuffix ".nix" baseName) &&
                !(baseName == "flake.lock") &&
                !(baseName == "flake.nix");
            };
            
            cargoLock = {
              lockFile = ./src-tauri/Cargo.lock;
            };
            
            # Don't run tests during build
            doCheck = false;
            
            inherit buildInputs;
            
            nativeBuildInputs = with pkgs; [
              pkg-config
              rustToolchain
              nodejs_20
              bun
              cargo-tauri
              wrapGAppsHook3
              copyDesktopItems
              makeWrapper
            ];
            
            # Copy pre-built frontend before building
            preBuild = ''
              # We're in src-tauri directory, Tauri expects dist to be at ../dist
              mkdir -p ../dist
              cp -r ${self.packages.${system}.claudia-frontend}/dist/* ../dist/
              
              # Modify tauri.conf.json to remove beforeBuildCommand since we already built frontend
              ${pkgs.jq}/bin/jq '.build.beforeBuildCommand = ""' tauri.conf.json > tauri.conf.json.tmp
              mv tauri.conf.json.tmp tauri.conf.json
              
              # CRITICAL: Set up for cargo-tauri build
              export CARGO_BUILD_TARGET_DIR="target"
            '';
            
            # Override build phase to use cargo-tauri
            buildPhase = ''
              runHook preBuild
              
              # Build with cargo-tauri to properly embed assets
              ${pkgs.cargo-tauri}/bin/cargo-tauri build --no-bundle
              
              runHook postBuild
            '';
            
            # Custom install since we're not using bundles
            installPhase = ''
              runHook preInstall
              
              # Install the built binary
              mkdir -p $out/bin
              cp target/release/claudia $out/bin/
              
              # Install desktop files and icons on Linux
              ${lib.optionalString (pkgs.stdenv.isLinux) ''
                mkdir -p $out/share/icons/hicolor/128x128/apps
                if [[ -f icons/128x128.png ]]; then
                  cp icons/128x128.png $out/share/icons/hicolor/128x128/apps/claudia.png
                fi
              ''}
              
              runHook postInstall
            '';
            
            # wrapGAppsHook3 handles most of the wrapping automatically
            dontWrapGApps = true;
            
            postFixup = ''
              # Manually wrap with additional Tauri-specific environment variables
              wrapGApp $out/bin/claudia \
                --set WEBKIT_DISABLE_COMPOSITING_MODE "1" \
                --set LIBGL_ALWAYS_SOFTWARE "1" \
                --set GALLIUM_DRIVER "llvmpipe"
            '';
            
            desktopItems = lib.optionals pkgs.stdenv.isLinux [
              (pkgs.makeDesktopItem {
                name = "claudia";
                exec = "claudia";
                icon = "claudia";
                desktopName = "Claudia";
                comment = "A Tauri application";
                categories = [ "Utility" ];
              })
            ];
          };
        };
        
        devShells.default = pkgs.mkShell {
          buildInputs = buildInputs ++ nativeBuildInputs ++ [
            bun2nix.packages.${system}.default
          ];
          
          shellHook = ''
            echo "Claudia development environment"
            echo "Run 'bun install' to install dependencies"
            echo "Run 'bun run tauri dev' to start development server"
            echo ""
            echo "To generate bun.nix for Nix builds:"
            echo "  bun2nix -o bun.nix"
          '';
        };
      });
}