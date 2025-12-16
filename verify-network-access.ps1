# Network Access Verification Script
# This script checks if ports are properly forwarded and accessible

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "PakStream Network Access Verification" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Get IP addresses
$wslIp = (wsl hostname -I).Split()[0]
$windowsIp = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -like "192.168.*" }).IPAddress | Select-Object -First 1

Write-Host "IP Addresses:" -ForegroundColor Yellow
Write-Host "  WSL IP:     $wslIp" -ForegroundColor White
Write-Host "  Windows IP: $windowsIp" -ForegroundColor White
Write-Host ""

# Check port forwarding
Write-Host "Port Forwarding Status:" -ForegroundColor Yellow
$portProxy = netsh interface portproxy show all
if ($portProxy -match "3000") {
    Write-Host "  ✅ Port 3000 is forwarded" -ForegroundColor Green
} else {
    Write-Host "  ❌ Port 3000 is NOT forwarded" -ForegroundColor Red
}

if ($portProxy -match "5000") {
    Write-Host "  ✅ Port 5000 is forwarded" -ForegroundColor Green
} else {
    Write-Host "  ❌ Port 5000 is NOT forwarded" -ForegroundColor Red
}
Write-Host ""

# Check firewall rules
Write-Host "Firewall Rules:" -ForegroundColor Yellow
$fwRule3000 = Get-NetFirewallRule -DisplayName "WSL Port 3000" -ErrorAction SilentlyContinue
$fwRule5000 = Get-NetFirewallRule -DisplayName "WSL Port 5000" -ErrorAction SilentlyContinue

if ($fwRule3000) {
    Write-Host "  ✅ Firewall rule for port 3000 exists" -ForegroundColor Green
} else {
    Write-Host "  ❌ Firewall rule for port 3000 is missing" -ForegroundColor Red
}

if ($fwRule5000) {
    Write-Host "  ✅ Firewall rule for port 5000 exists" -ForegroundColor Green
} else {
    Write-Host "  ❌ Firewall rule for port 5000 is missing" -ForegroundColor Red
}
Write-Host ""

# Test connectivity
Write-Host "Connectivity Tests:" -ForegroundColor Yellow

# Test port 3000
try {
    $response = Test-NetConnection -ComputerName $windowsIp -Port 3000 -WarningAction SilentlyContinue
    if ($response.TcpTestSucceeded) {
        Write-Host "  ✅ Port 3000 is accessible on $windowsIp" -ForegroundColor Green
    } else {
        Write-Host "  ❌ Port 3000 is NOT accessible on $windowsIp" -ForegroundColor Red
    }
} catch {
    Write-Host "  ❌ Could not test port 3000: $_" -ForegroundColor Red
}

# Test port 5000
try {
    $response = Test-NetConnection -ComputerName $windowsIp -Port 5000 -WarningAction SilentlyContinue
    if ($response.TcpTestSucceeded) {
        Write-Host "  ✅ Port 5000 is accessible on $windowsIp" -ForegroundColor Green
    } else {
        Write-Host "  ❌ Port 5000 is NOT accessible on $windowsIp" -ForegroundColor Red
    }
} catch {
    Write-Host "  ❌ Could not test port 5000: $_" -ForegroundColor Red
}
Write-Host ""

# Check if services are running in WSL
Write-Host "WSL Service Status:" -ForegroundColor Yellow
Write-Host "  Checking if services are running in WSL..." -ForegroundColor Gray

$nodeProcess = wsl bash -c "pgrep -f 'node.*3000\|node.*5000' | wc -l"
if ([int]$nodeProcess -gt 0) {
    Write-Host "  ✅ Node.js processes detected in WSL" -ForegroundColor Green
} else {
    Write-Host "  ⚠️  No Node.js processes detected in WSL" -ForegroundColor Yellow
    Write-Host "     Make sure frontend and backend are running!" -ForegroundColor Gray
}
Write-Host ""

# Summary
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Summary" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Frontend URL: http://$windowsIp:3000" -ForegroundColor Yellow
Write-Host "Backend URL:  http://$windowsIp:5000" -ForegroundColor Yellow
Write-Host ""
Write-Host "To access from another device:" -ForegroundColor White
Write-Host "  1. Make sure both devices are on the same network" -ForegroundColor Gray
Write-Host "  2. Open browser: http://$windowsIp:3000" -ForegroundColor Gray
Write-Host "  3. Check browser console (F12) for API calls" -ForegroundColor Gray
Write-Host ""

