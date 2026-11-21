# Generate raster assets from the exact LOGO SVG geometry in DayLoop.html.
# Source: circle (16,16) radius 12.5, cobalt stroke 4.5;
# amber upper-right arc from -90 to 0 degrees; white center radius 3.5.
Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$src = Join-Path $root 'frontend\public\dayloop-mark.svg'
if (-not (Test-Path $src)) { throw 'Missing canonical DayLoop SVG' }

function Save-Logo([string]$path, [int]$width, [int]$height, [double]$sizeFraction, [string]$background) {
  $bmp = [System.Drawing.Bitmap]::new($width, $height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $bg = if ($background -eq 'transparent') { [System.Drawing.Color]::Transparent } elseif ($background -eq 'white') { [System.Drawing.Color]::White } else { [System.Drawing.Color]::FromArgb(15,16,20) }
  $g.Clear($bg)
  $side=[Math]::Min($width,$height)*$sizeFraction
  $scale=[float]($side/32)
  $g.TranslateTransform([float](($width-$side)/2), [float](($height-$side)/2))
  $g.ScaleTransform($scale,$scale)
  $blue=[System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(43,76,255),[float]4.5)
  $amber=[System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(242,154,31),[float]4.5)
  $amber.StartCap=[System.Drawing.Drawing2D.LineCap]::Round
  $amber.EndCap=[System.Drawing.Drawing2D.LineCap]::Round
  $white=[System.Drawing.SolidBrush]::new([System.Drawing.Color]::White)
  $g.DrawEllipse($blue,[float]3.5,[float]3.5,[float]25,[float]25)
  $g.DrawArc($amber,[float]3.5,[float]3.5,[float]25,[float]25,[float]-90,[float]90)
  $g.FillEllipse($white,[float]12.5,[float]12.5,[float]7,[float]7)
  $parent=Split-Path $path
  if (!(Test-Path $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
  $temp=$path+'.tmp'
  $bmp.Save($temp,[System.Drawing.Imaging.ImageFormat]::Png)
  $white.Dispose();$blue.Dispose();$amber.Dispose();$g.Dispose();$bmp.Dispose()
  Move-Item -Path $temp -Destination $path -Force
}

Save-Logo (Join-Path $root 'frontend\public\dayloop-mark.png') 512 512 0.87 'transparent'
$res=Join-Path $root 'mobile\android\app\src\main\res'
foreach ($item in @(@('mdpi',48),@('hdpi',72),@('xhdpi',96),@('xxhdpi',144),@('xxxhdpi',192))) {
  $dir=Join-Path $res ('mipmap-'+$item[0])
  $n=[int]$item[1]
  Save-Logo (Join-Path $dir 'ic_launcher.png') $n $n 0.70 'dark'
  Save-Logo (Join-Path $dir 'ic_launcher_round.png') $n $n 0.70 'dark'
  $f=[int]($n*108/48)
  Save-Logo (Join-Path $dir 'ic_launcher_foreground.png') $f $f 0.67 'transparent'
}
# Replace every previous Capacitor default splash bitmap, preserving orientation/density sizes.
foreach ($file in (Get-ChildItem -Path $res -Recurse -Filter 'splash.png')) {
  $img=[System.Drawing.Image]::FromFile($file.FullName)
  $w=$img.Width; $h=$img.Height
  $img.Dispose()
  Save-Logo $file.FullName $w $h 0.19 'white'
}
Write-Output 'Updated web PNG, all Android launcher densities, and every native splash bitmap with the HTML SVG artwork.'
