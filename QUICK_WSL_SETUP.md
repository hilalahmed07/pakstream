# Quick WSL Network Setup Guide

## The Problem
Your services run in WSL2, which uses a virtual network. When you access `192.168.1.101:3000` from another device, the frontend tries to connect to `192.168.1.101:5000` for the backend, but port 5000 in WSL isn't accessible from Windows network.

## Quick Fix (5 minutes)

### Step 1: Set Up Port Forwarding (PowerShell as Administrator)

Open PowerShell as **Administrator** and run:

```powershell
# Get WSL IP
$wslIp = (wsl hostname -I).Split()[0]
Write-Host "WSL IP: $wslIp"

# Forward port 3000
netsh interface portproxy add v4tov4 listenport=3000 listenaddress=0.0.0.0 connectport=3000 connectaddress=$wslIp

# Forward port 5000
netsh interface portproxy add v4tov4 listenport=5000 listenaddress=0.0.0.0 connectport=5000 connectaddress=$wslIp
```

Or use the provided script:
```powershell
.\wsl-port-forward.ps1
```

### Step 2: Configure Windows Firewall (PowerShell as Administrator)

```powershell
New-NetFirewallRule -DisplayName "WSL Port 3000" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "WSL Port 5000" -Direction Inbound -LocalPort 5000 -Protocol TCP -Action Allow
```

Or use the provided script:
```powershell
.\wsl-firewall-rules.ps1
```

### Step 3: Create Frontend .env File

In WSL, create `frontend/.env`:

```bash
cd ~/projects/PakStream/frontend
nano .env
```

Add these lines:
```bash
REACT_APP_API_BASE_URL=http://192.168.1.101:5000
REACT_APP_SOCKET_URL=http://192.168.1.101:5000
```

**Important:** After creating `.env`, restart the frontend:
```bash
# Stop frontend (Ctrl+C)
npm start
```

### Step 4: Verify Everything Works

Run the verification script:
```powershell
.\verify-network-access.ps1
```

Or test manually:
- From Windows: Open `http://192.168.1.101:3000`
- From another device: Open `http://192.168.1.101:3000`
- Check browser console (F12) - should see API calls to `192.168.1.101:5000`

## Important Notes

1. **WSL IP Changes:** If you restart Windows, the WSL IP might change. Re-run the port forwarding script.

2. **Check WSL IP:**
   ```bash
   wsl hostname -I
   ```

3. **Remove Port Forwarding (if needed):**
   ```powershell
   netsh interface portproxy delete v4tov4 listenport=3000 listenaddress=0.0.0.0
   netsh interface portproxy delete v4tov4 listenport=5000 listenaddress=0.0.0.0
   ```

## Troubleshooting

### Port forwarding not working?
```powershell
# Check current port forwarding rules
netsh interface portproxy show all

# If WSL IP changed, remove old rules and add new ones
netsh interface portproxy reset
# Then re-run port forwarding script
```

### Frontend still using wrong URL?
1. Make sure `.env` file exists in `frontend/` directory
2. Restart frontend after creating/updating `.env`
3. Check browser console for "🔧 API Configuration" log

### Backend not accessible?
1. Make sure backend is running in WSL: `cd backend && npm start`
2. Check backend logs - should show "Access from network: http://0.0.0.0:5000"
3. Test from WSL: `curl http://localhost:5000/api/videos`

