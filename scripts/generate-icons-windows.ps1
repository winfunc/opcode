# PowerShell script to generate Windows ICO files from PNG source
# This script creates a proper ICO file that works with Windows Resource Compiler

param(
    [Parameter(Mandatory=$true)]
    [string]$InputPng,
    
    [Parameter(Mandatory=$true)]
    [string]$OutputIco
)

# Load System.Drawing assembly
Add-Type -AssemblyName System.Drawing

function Create-MultiSizeIcon {
    param(
        [string]$SourcePath,
        [string]$OutputPath
    )
    
    try {
        # Load the source image
        $sourceImage = [System.Drawing.Image]::FromFile($SourcePath)
        
        # Create various sizes for the ICO file
        $sizes = @(16, 24, 32, 48, 64, 128, 256)
        $iconImages = @()
        
        foreach ($size in $sizes) {
            # Create a bitmap for this size
            $bitmap = New-Object System.Drawing.Bitmap($size, $size)
            $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
            
            # Set high quality rendering
            $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
            $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
            
            # Draw the scaled image
            $graphics.DrawImage($sourceImage, 0, 0, $size, $size)
            
            # Convert to icon
            $hIcon = $bitmap.GetHicon()
            $icon = [System.Drawing.Icon]::FromHandle($hIcon)
            
            # Save this size
            $iconImages += $icon
            
            # Cleanup
            $graphics.Dispose()
            $bitmap.Dispose()
        }
        
        # Create the final ICO file with multiple sizes
        $fileStream = [System.IO.FileStream]::new($OutputPath, [System.IO.FileMode]::Create)
        
        # ICO file header
        $iconHeader = New-Object byte[] 6
        $iconHeader[0] = 0  # Reserved
        $iconHeader[1] = 0  # Reserved
        $iconHeader[2] = 1  # ICO file type
        $iconHeader[3] = 0  # ICO file type
        $iconHeader[4] = [byte]$iconImages.Count  # Number of images
        $iconHeader[5] = 0  # Number of images (high byte)
        
        $fileStream.Write($iconHeader, 0, 6)
        
        # Calculate offset for image data
        $imageOffset = 6 + ($iconImages.Count * 16)  # Header + directory entries
        
        # Write directory entries
        for ($i = 0; $i -lt $iconImages.Count; $i++) {
            $icon = $iconImages[$i]
            $size = $sizes[$i]
            
            # Get icon data
            $iconStream = New-Object System.IO.MemoryStream
            $icon.Save($iconStream)
            $iconData = $iconStream.ToArray()
            $iconStream.Close()
            
            # Directory entry
            $dirEntry = New-Object byte[] 16
            $dirEntry[0] = if ($size -eq 256) { 0 } else { [byte]$size }  # Width
            $dirEntry[1] = if ($size -eq 256) { 0 } else { [byte]$size }  # Height
            $dirEntry[2] = 0  # Color palette
            $dirEntry[3] = 0  # Reserved
            $dirEntry[4] = 1  # Color planes
            $dirEntry[5] = 0  # Color planes (high byte)
            $dirEntry[6] = 32  # Bits per pixel
            $dirEntry[7] = 0   # Bits per pixel (high byte)
            
            # Size of image data
            $dataSize = $iconData.Length
            $dirEntry[8] = [byte]($dataSize -band 0xFF)
            $dirEntry[9] = [byte](($dataSize -shr 8) -band 0xFF)
            $dirEntry[10] = [byte](($dataSize -shr 16) -band 0xFF)
            $dirEntry[11] = [byte](($dataSize -shr 24) -band 0xFF)
            
            # Offset to image data
            $dirEntry[12] = [byte]($imageOffset -band 0xFF)
            $dirEntry[13] = [byte](($imageOffset -shr 8) -band 0xFF)
            $dirEntry[14] = [byte](($imageOffset -shr 16) -band 0xFF)
            $dirEntry[15] = [byte](($imageOffset -shr 24) -band 0xFF)
            
            $fileStream.Write($dirEntry, 0, 16)
            $imageOffset += $dataSize
        }
        
        # Write image data
        foreach ($icon in $iconImages) {
            $iconStream = New-Object System.IO.MemoryStream
            $icon.Save($iconStream)
            $iconData = $iconStream.ToArray()
            $fileStream.Write($iconData, 0, $iconData.Length)
            $iconStream.Close()
        }
        
        $fileStream.Close()
        
        # Cleanup
        $sourceImage.Dispose()
        foreach ($icon in $iconImages) {
            $icon.Dispose()
        }
        
        Write-Host "✓ Successfully created ICO file: $OutputPath"
        return $true
        
    } catch {
        Write-Error "Failed to create ICO file: $($_.Exception.Message)"
        return $false
    }
}

# Main execution
if (-not (Test-Path $InputPng)) {
    Write-Error "Input PNG file not found: $InputPng"
    exit 1
}

$result = Create-MultiSizeIcon -SourcePath $InputPng -OutputPath $OutputIco

if ($result) {
    Write-Host "ICO file generated successfully!"
    exit 0
} else {
    Write-Error "Failed to generate ICO file"
    exit 1
} 