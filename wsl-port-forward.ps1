# WSL Port Forwarding Script for PakStream
# This script forwards ports from WSL to Windows so they're accessible from the network
# Run this script in PowerShell as Administrator

# Get WSL IP address
$wslIp = (wsl hostname -I).Split()[0]
Write-Host "WSL IP Address: $wslIp" -ForegroundColor Green

# Ports to forward
$ports = @(3000, 5000)

# Get the Windows IP address on the local network
$windowsIp = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -like "192.168.*" }).IPAddress | Select-Object -First 1
Write-Host "Windows IP Address: $windowsIp" -ForegroundColor Green

foreach ($port in $ports) {
    Write-Host "`nSetting up port forwarding for port $port..." -ForegroundColor Yellow
    
    # Remove existing rule if it exists
    $existingRule = Get-NetNatStaticMapping | Where-Object { $_.ExternalPort -eq $port -and $_.InternalAddress -eq $wslIp }
    if ($existingRule) {
        Write-Host "Removing existing rule for port $port..." -ForegroundColor Yellow
        Remove-NetNatStaticMapping -StaticMappingID $existingRule.StaticMappingID -Confirm:$false
    }
    
    # Create new port forwarding rule
    try {
        # First, we need to create a NAT if it doesn't exist
        $natName = "WSLNAT"
        $nat = Get-NetNat -Name $natName -ErrorAction SilentlyContinue
        if (-not $nat) {
            Write-Host "Creating NAT: $natName" -ForegroundColor Yellow
            New-NetNat -Name $natName -InternalIPInterfaceAddressPrefix "172.16.0.0/12"
        }
        
        # Add port forwarding rule
        Add-NetNatStaticMapping -NatName $natName -Protocol TCP -ExternalIPAddress 0.0.0.0 -ExternalPort $port -InternalIPAddress $wslIp -InternalPort $port
        Write-Host "✅ Port $port forwarded successfully!" -ForegroundColor Green
    }
    catch {
        Write-Host "❌ Error forwarding port $port : $_" -ForegroundColor Red
        Write-Host "Trying alternative method..." -ForegroundColor Yellow
        
        # Alternative: Use netsh portproxy (simpler but less robust)
        try {
            netsh interface portproxy add v4tov4 listenport=$port listenaddress=0.0.0.0 connectport=$port connectaddress=$wslIp
            Write-Host "✅ Port $port forwarded using netsh!" -ForegroundColor Green
        }
        catch {
            Write-Host "❌ Failed to forward port $port : $_" -ForegroundColor Red
        }
    }
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Port Forwarding Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Frontend: http://$windowsIp:3000" -ForegroundColor Yellow
Write-Host "Backend:  http://$windowsIp:5000" -ForegroundColor Yellow
Write-Host "`nNote: You may need to allow these ports in Windows Firewall" -ForegroundColor Yellow
Write-Host "Run: New-NetFirewallRule -DisplayName 'WSL Port 3000' -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow" -ForegroundColor Gray
Write-Host "Run: New-NetFirewallRule -DisplayName 'WSL Port 5000' -Direction Inbound -LocalPort 5000 -Protocol TCP -Action Allow" -ForegroundColor Gray

