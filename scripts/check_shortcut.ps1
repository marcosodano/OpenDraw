$w = New-Object -ComObject WScript.Shell
$desktop1 = Join-Path $env:USERPROFILE "OneDrive - Hitachi Group\Desktop\OpenDraw.lnk"
$desktop2 = Join-Path $env:USERPROFILE "Desktop\OpenDraw.lnk"

Write-Host "=== Desktop 1: $desktop1 ==="
if (Test-Path $desktop1) {
    $s = $w.CreateShortcut($desktop1)
    Write-Host "Target: $($s.TargetPath)"
    Write-Host "WorkingDir: $($s.WorkingDirectory)"
    Write-Host "Icon: $($s.IconLocation)"
} else {
    Write-Host "Not found"
}

Write-Host "=== Desktop 2: $desktop2 ==="
if (Test-Path $desktop2) {
    $s = $w.CreateShortcut($desktop2)
    Write-Host "Target: $($s.TargetPath)"
    Write-Host "WorkingDir: $($s.WorkingDirectory)"
    Write-Host "Icon: $($s.IconLocation)"
} else {
    Write-Host "Not found"
}

