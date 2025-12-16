# Windows Firewall Rules for WSL Ports
# Run this script in PowerShell as Administrator

Write-Host "Setting up Windows Firewall rules for WSL ports..." -ForegroundColor Yellow

# Remove existing rules if they exist
$existingRule3000 = Get-NetFirewallRule -DisplayName "WSL Port 3000" -ErrorAction SilentlyContinue
$existingRule5000 = Get-NetFirewallRule -DisplayName "WSL Port 5000" -ErrorAction SilentlyContinue

if ($existingRule3000) {
    Remove-NetFirewallRule -DisplayName "WSL Port 3000" -Confirm:$false
    Write-Host "Removed existing rule for port 3000" -ForegroundColor Yellow
}

if ($existingRule5000) {
    Remove-NetFirewallRule -DisplayName "WSL Port 5000" -Confirm:$false
    Write-Host "Removed existing rule for port 5000" -ForegroundColor Yellow
}

# Create new firewall rules
try {
    New-NetFirewallRule -DisplayName "WSL Port 3000" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow -Profile Any
    Write-Host "✅ Firewall rule created for port 3000" -ForegroundColor Green
}
catch {
    Write-Host "❌ Error creating firewall rule for port 3000: $_" -ForegroundColor Red
}

try {
    New-NetFirewallRule -DisplayName "WSL Port 5000" -Direction Inbound -LocalPort 5000 -Protocol TCP -Action Allow -Profile Any
    Write-Host "✅ Firewall rule created for port 5000" -ForegroundColor Green
}
catch {
    Write-Host "❌ Error creating firewall rule for port 5000: $_" -ForegroundColor Red
}

Write-Host "`nFirewall rules setup complete!" -ForegroundColor Green

