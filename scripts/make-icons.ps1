Add-Type -AssemblyName System.Drawing

$inputPath = "D:\vps\HyperVPN\public\icons\hyper.png"
$outputPath = "D:\vps\HyperVPN\public\icons\hyper_square.png"

$orig = [System.Drawing.Image]::FromFile($inputPath)
$targetSize = 512
$square = New-Object System.Drawing.Bitmap($targetSize, $targetSize, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($square)
$g.Clear([System.Drawing.Color]::Transparent)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

$scale = [Math]::Min($targetSize / $orig.Width, $targetSize / $orig.Height)
$destW = [int]($orig.Width * $scale)
$destH = [int]($orig.Height * $scale)
$destX = [int](($targetSize - $destW) / 2)
$destY = [int](($targetSize - $destH) / 2)

$g.DrawImage($orig, $destX, $destY, $destW, $destH)
$g.Dispose()
$orig.Dispose()

$square.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
$square.Dispose()
Write-Host "Created $outputPath successfully"
