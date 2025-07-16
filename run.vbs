Set shell = CreateObject("WScript.Shell")
shell.Run "wsl bash -c ""cd /mnt/f/claudia/claudia/src-tauri/target/release && ./claudia""", 0, False
