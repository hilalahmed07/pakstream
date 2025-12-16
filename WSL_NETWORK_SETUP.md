# WSL Network Access Setup Guide

## Problem
When running PakStream in WSL2, services are not directly accessible from other devices on your network because WSL2 uses a virtual network. The Windows host IP (192.168.1.101) can't reach WSL services without port forwarding.

## Solution
We need to:
1. Forward ports from WSL to Windows
2. Configure Windows Firewall
3. Set frontend environment variables to use Windows IP

## Step-by-Step Setup

### Step 1: Set Up Port Forwarding

**Option A: Using PowerShell Script (Recommended)**

1. Open PowerShell as **Administrator**
2. Navigate to your project directory
3. Run the port forwarding script:
   ```powershell
   .\wsl-port-forward.ps1
   ```

**Option B: Manual Setup**

1. Get your WSL IP address:
   ```bash
   wsl hostname -I
   ```
   (You'll see something like: `172.28.242.78`)

2. In PowerShell (as Administrator), forward ports:
   ```powershell
   # Forward port 3000 (frontend)
   netsh interface portproxy add v4tov4 listenport=3000 listenaddress=0.0.0.0 connectport=3000 connectaddress=172.28.242.78
   
   # Forward port 5000 (backend)
   netsh interface portproxy add v4tov4 listenport=5000 listenaddress=0.0.0.0 connectport=5000 connectaddress=172.28.242.78
   ```

### Step 2: Configure Windows Firewall

**Option A: Using PowerShell Script (Recommended)**

1. Open PowerShell as **Administrator**
2. Run:
   ```powershell
   .\wsl-firewall-rules.ps1
   ```

**Option B: Manual Setup**

In PowerShell (as Administrator):
```powershell
# Allow port 3000
New-NetFirewallRule -DisplayName "WSL Port 3000" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow

# Allow port 5000
New-NetFirewallRule -DisplayName "WSL Port 5000" -Direction Inbound -LocalPort 5000 -Protocol TCP -Action Allow
```

### Step 3: Configure Frontend Environment

The frontend `.env` file has been created with the correct Windows IP (192.168.1.101). 

**Important:** After creating/updating `.env`, restart the frontend:
```bash
cd frontend
# Stop the frontend (Ctrl+C if running)
npm start
```

### Step 4: Verify Backend Configuration

Make sure your backend is running and listening on `0.0.0.0` (which it already does). In WSL:
```bash
cd backend
npm start
```

You should see:
```
Server is running on port 5000
Access from network: http://0.0.0.0:5000 (all interfaces)
```

## Verification

### From Windows (Same Machine)
1. Open browser: `http://localhost:3000` - Should work
2. Open browser: `http://192.168.1.101:3000` - Should work

### From Another Device on Network
1. Open browser: `http://192.168.1.101:3000` - Should work
2. Check browser console (F12) - API calls should go to `http://192.168.1.101:5000`

### Test Backend Directly
From another device or Windows:
```bash
curl http://192.168.1.101:5000/api/videos
```

## Troubleshooting

### Port Forwarding Not Working

1. **Check if ports are forwarded:**
   ```powershell
   netsh interface portproxy show all
   ```

2. **Remove and re-add forwarding:**
   ```powershell
   # Remove all portproxy rules
   netsh interface portproxy reset
   
   # Re-run the port forwarding script
   .\wsl-port-forward.ps1
   ```

3. **Check WSL IP (it may change after restart):**
   ```bash
   wsl hostname -I
   ```
   If it changed, update the port forwarding rules with the new IP.

### Firewall Issues

1. **Check firewall rules:**
   ```powershell
   Get-NetFirewallRule -DisplayName "WSL Port*"
   ```

2. **Temporarily disable firewall to test:**
   ```powershell
   Set-NetFirewallProfile -Profile Domain,Public,Private -Enabled False
   ```
   (Remember to re-enable it!)

### Frontend Still Using Wrong URL

1. **Check if .env file exists:**
   ```bash
   cat frontend/.env
   ```

2. **Restart frontend after .env changes:**
   - Stop frontend (Ctrl+C)
   - Start again: `npm start`

3. **Check browser console:**
   - Open DevTools (F12)
   - Look for "🔧 API Configuration" log
   - Verify it shows `192.168.1.101:5000`

### Backend Not Accessible

1. **Verify backend is running in WSL:**
   ```bash
   wsl
   cd ~/projects/PakStream/backend
   npm start
   ```

2. **Check if backend is listening:**
   ```bash
   # In WSL
   netstat -tulpn | grep 5000
   ```

3. **Test from WSL:**
   ```bash
   curl http://localhost:5000/api/videos
   ```

## Important Notes

1. **WSL IP Changes:** The WSL IP address may change after Windows restart. You'll need to re-run the port forwarding script.

2. **Persistent Port Forwarding:** To make port forwarding persistent, you can:
   - Create a Windows Task Scheduler task to run the script on startup
   - Or use WSL2 port forwarding features (requires Windows 11 or specific WSL versions)

3. **Alternative: Use Windows IP in WSL:** You can also configure WSL to use the Windows host IP, but port forwarding is simpler.

## Quick Reference

- **Windows IP:** 192.168.1.101
- **WSL IP:** 172.28.242.78 (check with `wsl hostname -I`)
- **Frontend Port:** 3000
- **Backend Port:** 5000
- **Frontend URL:** http://192.168.1.101:3000
- **Backend URL:** http://192.168.1.101:5000

