Add-Type -AssemblyName System.Drawing
$ico = [System.Drawing.Icon]::ExtractAssociatedIcon("C:\Users\T9813424\OneDrive - Hitachi Group\Documents\11. Scripts\OpenDraw\node_modules\electron\dist\electron.exe")
$bmp = $ico.ToBitmap()
$bmp.Save("C:\Users\T9813424\OneDrive - Hitachi Group\Documents\11. Scripts\OpenDraw\electron_icon_extracted.png")
Write-Host "Saved electron_icon_extracted.png"

