# PowerShell script to convert PNG to ICO format
$pngPath = "src-tauri\icons\icon.png"
$icoPath = "src-tauri\icons\icon.ico"

Add-Type -AssemblyName System.Drawing

# Load the PNG image
$png = [System.Drawing.Image]::FromFile((Resolve-Path $pngPath))

# Create a new bitmap with 32x32 size
$bitmap = New-Object System.Drawing.Bitmap(32, 32)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.DrawImage($png, 0, 0, 32, 32)

# Create ICO file
$icon = [System.Drawing.Icon]::FromHandle($bitmap.GetHicon())
$fileStream = [System.IO.File]::Create((Resolve-Path ".").Path + "\" + $icoPath)
$icon.Save($fileStream)

# Clean up
$fileStream.Close()
$graphics.Dispose()
$bitmap.Dispose()
$png.Dispose()

Write-Host "ICO file created successfully at $icoPath"