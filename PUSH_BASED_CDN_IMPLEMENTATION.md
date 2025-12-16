# Push-Based CDN Implementation Guide for PakStream

**Complete Step-by-Step Setup for Laptop (Origin) and Edge Servers**

**Author:** Hilal Ahmed  
**Date:** October 29, 2025  
**Version:** 3.0 - Complete Implementation Guide

---

## 🎯 OVERVIEW & ARCHITECTURE

### What We're Building

```
┌─────────────────────────────────────────────────────────┐
│ YOUR LAPTOP (Origin Server)                             │
│ - Runs PakStream backend (Node.js)                      │
│ - Processes videos with FFmpeg                          │
│ - PUSHES files to edge servers automatically            │
│ - NOT accessible by users                               │
└────────────────┬────────────────────────────────────────┘
                 │
                 │ lsyncd AUTO-PUSHES files
                 │
    ┌────────────┼────────────┬────────────┐
    ↓            ↓            ↓            ↓
┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐
│ Edge PC │ │ Edge PC │ │ Edge PC │ │ Edge PC │
│   #1    │ │   #2    │ │   #3    │ │   #4    │
│ (Nginx) │ │ (Nginx) │ │ (Nginx) │ │ (Nginx) │
└────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘
     │           │           │           │
     ↓           ↓           ↓           ↓
  Users       Users       Users       Users
```

### Key Principle

- **Laptop = Origin** → Processes and PUSHES videos
- **Other PCs = Edges** → Receive and SERVE videos
- **Users NEVER access Origin directly**

---

## 💻 HARDWARE REQUIREMENTS

### Laptop (Origin Server)

- ✅ OS: Windows with WSL2 (Ubuntu)
- ✅ RAM: 8GB+ (16GB recommended)
- ✅ Storage: 100GB+ free space
- ✅ Network: Ethernet or strong WiFi

### Edge Servers (Other PCs)

- ✅ OS: Any (Windows/Linux/Ubuntu)
- ✅ RAM: 4GB+ per PC
- ✅ Storage: 100GB+ per PC (same as origin)
- ✅ Network: Ethernet or strong WiFi

### Network Setup

- All machines must be on same local network (same WiFi/router)
- Get IP addresses: Run `ipconfig` (Windows) or `ip a` (Linux)

---

## 📥 SOFTWARE DOWNLOADS

### FOR YOUR LAPTOP (Origin Server - WSL Ubuntu)

Nothing to download! Use WSL terminal:

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install required packages (all FREE)
sudo apt install -y lsyncd rsync openssh-server nginx
```

### FOR EDGE SERVERS (Other PCs)

#### Option 1: Windows Edge Server

**Download Nginx for Windows:**
- URL: http://nginx.org/en/download.html
- Download: `nginx-1.24.0.zip` (Stable version)
- Extract to: `C:\nginx\`

**Enable OpenSSH Server (Built-in Windows):**
- Go to: Settings → Apps → Optional Features
- Click "Add a feature"
- Find and install: **OpenSSH Server**

#### Option 2: Linux/Ubuntu Edge Server

```bash
# Install Nginx and SSH (all FREE)
sudo apt update
sudo apt install -y nginx openssh-server

# Start services
sudo systemctl start nginx
sudo systemctl start ssh
sudo systemctl enable nginx
sudo systemctl enable ssh
```

---

## 🖥️ PART A: LAPTOP SETUP (ORIGIN SERVER)

> **Open:** WSL Ubuntu Terminal

### STEP A1: Get Your Laptop IP Address

```bash
# In WSL, get Windows IP (not WSL IP)
ip route | grep default | awk '{print $3}'
# Example output: 192.168.1.50

# Save this IP - you'll need it for edge servers!
```

📝 **Write down your laptop IP:** `192.168.1._____`

---

### STEP A2: Create Storage Directories

```bash
# Create directory for edge servers to receive files
sudo mkdir -p /var/www/edge-storage/videos/processed
sudo chown -R $USER:$USER /var/www/edge-storage
sudo chmod -R 755 /var/www/edge-storage

# Verify it exists
ls -la /var/www/edge-storage/videos/
```

**Expected output:**
```
drwxr-xr-x 3 hilal hilal 4096 Oct 30 09:41 .
drwxr-xr-x 3 hilal hilal 4096 Oct 30 09:41 ..
drwxr-xr-x 2 hilal hilal 4096 Oct 30 09:41 processed
```

---

### STEP A3: Setup SSH Keys (For Passwordless Push)

```bash
# Generate SSH key pair
ssh-keygen -t rsa -b 4096 -f ~/.ssh/edge_push_key -N ""
```

**Expected output:**
```
Generating public/private rsa key pair.
Your identification has been saved in /home/hilal/.ssh/edge_push_key
Your public key has been saved in /home/hilal/.ssh/edge_push_key.pub
```

```bash
# View public key (you'll copy this to edge servers)
cat ~/.ssh/edge_push_key.pub
```

**Output looks like:**
```
ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQDxxxxxx... user@laptop
```

⚠️ **IMPORTANT:** Copy this entire line - you'll need it for EACH edge server!

---

### STEP A4: Install and Configure lsyncd

```bash
# Install lsyncd
sudo apt install -y lsyncd

# Create log directory
sudo mkdir -p /var/log/lsyncd
sudo touch /var/log/lsyncd/lsyncd.log
sudo chmod 777 /var/log/lsyncd/lsyncd.log
```

---

### STEP A5: Create lsyncd Configuration File

```bash
# Create config file
sudo nano /etc/lsyncd/lsyncd.conf.lua
```

**Paste this COMPLETE configuration:**

```lua
-- lsyncd Configuration for PakStream CDN
-- This automatically pushes processed videos to edge servers

settings {
    logfile = "/var/log/lsyncd/lsyncd.log",
    statusFile = "/var/log/lsyncd/lsyncd.status",
    statusInterval = 10,
    maxProcesses = 4,
    nodaemon = false
}

-- Edge Server 1
-- REPLACE 192.168.1.101 with your Edge PC #1 IP
sync {
    default.rsync,
    source = "/home/hilal/projects/PakStream/backend/uploads/videos/processed/",
    target = "edgeuser@192.168.1.101:/var/www/edge-storage/videos/processed/",
    delay = 5,
    rsync = {
        archive = true,
        compress = true,
        perms = true,
        owner = false,
        group = false,
        rsh = "/usr/bin/ssh -i /home/hilal/.ssh/edge_push_key -o StrictHostKeyChecking=no"
    }
}

-- Edge Server 2 (Add more edge servers by copying this block)
-- Uncomment and modify when you add second edge PC
--[[
sync {
    default.rsync,
    source = "/home/hilal/projects/PakStream/backend/uploads/videos/processed/",
    target = "edgeuser@192.168.1.102:/var/www/edge-storage/videos/processed/",
    delay = 5,
    rsync = {
        archive = true,
        compress = true,
        perms = true,
        owner = false,
        group = false,
        rsh = "/usr/bin/ssh -i /home/hilal/.ssh/edge_push_key -o StrictHostKeyChecking=no"
    }
}
]]--

-- Edge Server 3
--[[
sync {
    default.rsync,
    source = "/home/hilal/projects/PakStream/backend/uploads/videos/processed/",
    target = "edgeuser@192.168.1.103:/var/www/edge-storage/videos/processed/",
    delay = 5,
    rsync = {
        archive = true,
        compress = true,
        perms = true,
        owner = false,
        group = false,
        rsh = "/usr/bin/ssh -i /home/hilal/.ssh/edge_push_key -o StrictHostKeyChecking=no"
    }
}
]]--

-- Edge Server 4
--[[
sync {
    default.rsync,
    source = "/home/hilal/projects/PakStream/backend/uploads/videos/processed/",
    target = "edgeuser@192.168.1.104:/var/www/edge-storage/videos/processed/",
    delay = 5,
    rsync = {
        archive = true,
        compress = true,
        perms = true,
        owner = false,
        group = false,
        rsh = "/usr/bin/ssh -i /home/hilal/.ssh/edge_push_key -o StrictHostKeyChecking=no"
    }
}
]]--
```

**Save:** Press `Ctrl+O`, `Enter`, then `Ctrl+X`

⚠️ **IMPORTANT:** Replace `192.168.1.101` with actual IP of your edge PC!

---

### STEP A6: Update Nginx Configuration (Port 8080)

```bash
# Edit Nginx config
sudo nano /etc/nginx/sites-available/pakstream-edge
```

**Replace ENTIRE content with this COMPLETE config:**

```nginx
# PakStream Edge Server Configuration (Port 8080)
# This serves local files ONLY (no proxy to origin for videos)

upstream backend_origin {
    server localhost:5000;
    keepalive 32;
}

server {
    listen 8080;
    server_name localhost;

    # Maximum upload size
    client_max_body_size 2G;

    # Health check endpoint
    location /health {
        return 200 "Edge server is healthy - Push-based CDN active\n";
        add_header Content-Type text/plain;
    }

    # API endpoints - PROXY to origin backend
    location /api/ {
        proxy_pass http://backend_origin;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # No caching for API
        proxy_cache off;
        proxy_buffering off;
        
        # Timeouts
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }

    # Socket.IO - Real-time connections
    location /socket.io/ {
        proxy_pass http://backend_origin;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        
        # WebSocket timeouts
        proxy_connect_timeout 7d;
        proxy_send_timeout 7d;
        proxy_read_timeout 7d;
    }

    # Video files - SERVE FROM LOCAL FILESYSTEM (NO PROXY!)
    location /uploads/videos/ {
        # Serve from local edge storage
        alias /var/www/edge-storage/videos/;
        
        # If file not found, return 404 (NO origin fallback)
        try_files $uri =404;
        
        # CORS headers
        add_header Access-Control-Allow-Origin "*" always;
        add_header Access-Control-Allow-Methods "GET, OPTIONS" always;
        add_header Access-Control-Allow-Headers "*" always;
        
        # Cache control (browser caching only)
        expires 7d;
        add_header Cache-Control "public, immutable";
        
        # Custom headers to identify edge serving
        add_header X-Served-From "Local-Edge-Storage";
        add_header X-CDN-Type "Push-Based";
        
        # HLS content types
        location ~ \.m3u8$ {
            add_header Content-Type application/vnd.apple.mpegurl;
            add_header Access-Control-Allow-Origin "*" always;
            expires 0;
        }
        
        location ~ \.ts$ {
            add_header Content-Type video/mp2t;
            add_header Access-Control-Allow-Origin "*" always;
        }
        
        # Disable access logs for video segments (performance)
        access_log off;
    }

    # Upload endpoint - PROXY to origin
    location /uploads/presentations/ {
        proxy_pass http://backend_origin;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        
        # No caching
        proxy_cache off;
        proxy_buffering off;
    }

    # Error pages
    error_page 404 /404.html;
    location = /404.html {
        return 404 '{"error": "Resource not found on edge server"}';
        add_header Content-Type application/json;
    }

    error_page 500 502 503 504 /50x.html;
    location = /50x.html {
        return 500 '{"error": "Edge server error"}';
        add_header Content-Type application/json;
    }
}
```

**Save:** `Ctrl+O`, `Enter`, `Ctrl+X`

**Test and reload Nginx:**

```bash
# Test configuration
sudo nginx -t

# If successful, reload
sudo systemctl reload nginx

# Check if running
curl http://localhost:8080/health
# Should return: "Edge server is healthy - Push-based CDN active"
```

---

### STEP A7: Enable lsyncd Service

```bash
# Enable lsyncd to start on boot
sudo systemctl enable lsyncd

# DON'T start it yet! (We need to setup edge servers first)
# We'll start it after edge servers are ready
```

---

### STEP A8: Verify Current PakStream Backend

```bash
cd /home/hilal/projects/PakStream/backend

# Check if backend is running
ps aux | grep node

# If not running, start it
npm start
```

**Leave this terminal open!**

---

## 🌐 PART B: EDGE SERVER SETUP (OTHER PCs)

**Time Required:** 1-2 hours PER edge server

> Do this on EACH edge PC

---

### STEP B1: Get Edge PC IP Address

**Windows:**
```powershell
# Open PowerShell
ipconfig

# Look for "IPv4 Address" under your network adapter
# Example: 192.168.1.101
```

**Linux:**
```bash
# Get IP address
ip a | grep inet

# Example: 192.168.1.101
```

📝 **Write down this edge PC IP:** `192.168.1._____`

---

### STEP B2: Create Storage Directory

**Windows:**
```powershell
# Open PowerShell as Administrator
mkdir C:\edge-storage\videos\processed -Force

# Verify creation
dir C:\edge-storage\videos\
```

**Linux:**
```bash
sudo mkdir -p /var/www/edge-storage/videos/processed
sudo chmod -R 755 /var/www/edge-storage
ls -la /var/www/edge-storage/videos/
```

---

### STEP B3: Setup SSH Server

**Windows:**
```powershell
# Start OpenSSH Server
Start-Service sshd

# Set to start automatically
Set-Service -Name sshd -StartupType 'Automatic'

# Allow SSH through firewall
New-NetFirewallRule -Name sshd -DisplayName 'OpenSSH Server (sshd)' -Enabled True -Direction Inbound -Protocol TCP -Action Allow -LocalPort 22

# Test if running
Get-Service sshd
# Status should be "Running"
```

**Linux:**
```bash
sudo systemctl start ssh
sudo systemctl enable ssh
sudo systemctl status ssh
```

---

### STEP B4: Create User for File Transfer

**Windows:**
```powershell
# Create user named "edgeuser"
net user edgeuser EdgePass123! /add

# Give admin rights (needed for file operations)
net localgroup Administrators edgeuser /add

# Verify user created
net user edgeuser
```

**Linux:**
```bash
# Create user
sudo adduser edgeuser
# Set password: EdgePass123!

# Add to www-data group
sudo usermod -aG www-data edgeuser
```

---

### STEP B5: Add Laptop's SSH Public Key

**Windows:**

```powershell
# Create .ssh directory for edgeuser
mkdir C:\Users\edgeuser\.ssh -Force

# Create authorized_keys file
notepad C:\Users\edgeuser\.ssh\authorized_keys
```

**In Notepad:**
1. Paste the SSH public key from your laptop (from Step A3)
2. It looks like: `ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQDxxxxxx...`
3. Save and close

**Set permissions:**
```powershell
icacls C:\Users\edgeuser\.ssh\authorized_keys /inheritance:r
icacls C:\Users\edgeuser\.ssh\authorized_keys /grant:r "edgeuser:F"
```

**Linux:**

```bash
# Switch to edgeuser
sudo su - edgeuser

# Create .ssh directory
mkdir -p ~/.ssh
chmod 700 ~/.ssh

# Create authorized_keys file
nano ~/.ssh/authorized_keys
```

**In nano:**
1. Paste the SSH public key from your laptop
2. Save: `Ctrl+O`, `Enter`, `Ctrl+X`

```bash
# Set permissions
chmod 600 ~/.ssh/authorized_keys

# Exit back to your user
exit
```

---

### STEP B6: Test SSH Connection from Laptop

**On your LAPTOP (WSL terminal):**

```bash
# Test connection (replace with your edge PC IP)
ssh -i ~/.ssh/edge_push_key edgeuser@192.168.1.101

# If asked "Are you sure you want to continue connecting?", type: yes

# If successful, you'll be logged into edge PC!
# Type: exit
```

⚠️ **If connection fails, see Troubleshooting section!**

---

### STEP B7: Install and Configure Nginx

#### Windows Edge Server:

1. **Extract Nginx:**
   - Extract `nginx-1.24.0.zip` to `C:\nginx\`

2. **Create Nginx config:**

```powershell
# Edit nginx configuration
notepad C:\nginx\conf\nginx.conf
```

**Replace ENTIRE content with this:**

```nginx
# PakStream Edge Server - Windows
# Serves ONLY local files pushed from origin

worker_processes 2;

events {
    worker_connections 1024;
}

http {
    include mime.types;
    default_type application/octet-stream;
    sendfile on;
    keepalive_timeout 65;

    server {
        listen 80;
        server_name localhost;

        # Health check
        location /health {
            return 200 "Edge server healthy - Windows\n";
            add_header Content-Type text/plain;
        }

        # Serve videos from local storage
        location /videos/ {
            # Serve from edge storage
            alias C:/edge-storage/videos/;
            
            # If not found, return 404 (no origin fallback)
            try_files $uri =404;
            
            # CORS
            add_header Access-Control-Allow-Origin * always;
            
            # Cache control
            expires 7d;
            add_header Cache-Control "public, immutable";
            add_header X-Served-From "Edge-Windows";
        }

        # HLS playlists
        location ~ \.m3u8$ {
            alias C:/edge-storage/videos/;
            add_header Content-Type application/vnd.apple.mpegurl;
            add_header Access-Control-Allow-Origin * always;
            expires 0;
        }

        # HLS segments
        location ~ \.ts$ {
            alias C:/edge-storage/videos/;
            add_header Content-Type video/mp2t;
            add_header Access-Control-Allow-Origin * always;
        }
    }
}
```

**Save and close Notepad**

3. **Start Nginx:**

```powershell
# Navigate to Nginx directory
cd C:\nginx

# Start Nginx
start nginx.exe

# Check if running
.\nginx.exe -t

# Test health check
curl http://localhost/health
```

---

#### Linux Edge Server:

```bash
# Edit Nginx config
sudo nano /etc/nginx/sites-available/edge-server
```

**Paste this COMPLETE configuration:**

```nginx
# PakStream Edge Server - Linux
# Serves ONLY local files pushed from origin

server {
    listen 80;
    listen [::]:80;
    server_name _;

    # Maximum body size
    client_max_body_size 2G;

    # Health check
    location /health {
        return 200 "Edge server healthy - Linux\n";
        add_header Content-Type text/plain;
    }

    # Serve videos from local storage
    location /videos/ {
        # Serve from edge storage
        alias /var/www/edge-storage/videos/processed/;
        
        # If not found, return 404 (no origin fallback)
        try_files $uri =404;
        
        # CORS headers
        add_header Access-Control-Allow-Origin "*" always;
        add_header Access-Control-Allow-Methods "GET, OPTIONS" always;
        
        # Cache control
        expires 7d;
        add_header Cache-Control "public, immutable";
        add_header X-Served-From "Edge-Linux";
        
        # Disable access logs
        access_log off;
    }

    # HLS playlists
    location ~ \.m3u8$ {
        root /var/www/edge-storage/videos;
        add_header Content-Type application/vnd.apple.mpegurl;
        add_header Access-Control-Allow-Origin "*" always;
        expires 0;
    }

    # HLS segments
    location ~ \.ts$ {
        root /var/www/edge-storage/videos;
        add_header Content-Type video/mp2t;
        add_header Access-Control-Allow-Origin "*" always;
    }

    # Error handling
    error_page 404 /404.html;
    location = /404.html {
        return 404 '{"error": "File not found on edge"}';
        add_header Content-Type application/json;
    }
}
```

**Save:** `Ctrl+O`, `Enter`, `Ctrl+X`

**Enable and test:**

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/edge-server /etc/nginx/sites-enabled/

# Remove default site
sudo rm /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx

# Test health check
curl http://localhost/health
```

---

### STEP B8: Allow Nginx Through Firewall

**Windows:**
```powershell
# Allow HTTP through firewall
New-NetFirewallRule -DisplayName "Nginx HTTP" -Direction Inbound -LocalPort 80 -Protocol TCP -Action Allow
```

**Linux:**
```bash
sudo ufw allow 80/tcp
sudo ufw reload
```

---

### STEP B9: Verify Edge Server is Ready

**Test from edge PC itself:**
```bash
# Windows PowerShell or Linux terminal
curl http://localhost/health
# Expected: "Edge server healthy"
```

**Test from your LAPTOP:**
```bash
# Replace with edge PC IP
curl http://192.168.1.101/health
# Expected: "Edge server healthy"
```

✅ **Edge server is ready!**

> **Repeat PART B for each additional edge PC you have.**

---

## 🔧 PART C: BACKEND CODE MODIFICATIONS

**Location:** Your Laptop  
**Time Required:** 1 hour

---

### STEP C1: Update Video Model

**File:** `backend/src/models/Video.js`

**Find the status field (around line 44) and modify:**

```javascript
// OLD:
enum: ['uploading', 'processing', 'ready', 'error', 'failed'],

// NEW:
enum: ['uploading', 'processing', 'processing_complete', 'distributing', 'ready', 'error', 'failed', 'distribution_failed'],
```

**ADD after the status field (after line 46):**

```javascript
  distribution: {
    status: {
      type: String,
      enum: ['pending', 'distributing', 'distributed', 'failed'],
      default: 'pending'
    },
    edges: [{
      name: String,
      ip: String,
      status: String,
      distributedAt: Date,
      verified: {
        type: Boolean,
        default: false
      }
    }],
    startedAt: Date,
    completedAt: Date,
    lastError: String
  },
```

---

### STEP C2: Create Distribution Service

**Create new file:** `backend/src/services/distributionService.js`

```javascript
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const Video = require('../models/Video');

class DistributionService {
    constructor() {
        // Edge server configurations
        this.edgeServers = [
            {
                name: 'Edge-1',
                ip: '192.168.1.101',  // UPDATE WITH YOUR EDGE IP
                user: 'edgeuser',
                path: '/var/www/edge-storage/videos/processed/'
            },
            // Add more edge servers as needed
        ];
        
        this.sshKeyPath = '/home/hilal/.ssh/edge_push_key';
    }

    async distributeVideo(videoId) {
        const video = await Video.findById(videoId);
        if (!video) {
            throw new Error('Video not found');
        }

        // Update status to distributing
        video.status = 'distributing';
        video.distribution = {
            status: 'distributing',
            startedAt: new Date(),
            edges: []
        };
        await video.save();

        const processedDir = path.join(
            __dirname, 
            '../../uploads/videos/processed', 
            videoId
        );

        // Distribute to each edge server
        const results = await Promise.allSettled(
            this.edgeServers.map(edge => 
                this.pushToEdge(edge, processedDir, videoId)
            )
        );

        // Update distribution status for each edge
        const edgeResults = results.map((result, index) => ({
            name: this.edgeServers[index].name,
            ip: this.edgeServers[index].ip,
            status: result.status === 'fulfilled' ? 'distributed' : 'failed',
            distributedAt: new Date(),
            verified: result.status === 'fulfilled'
        }));

        // Check if all distributions succeeded
        const allSuccess = results.every(r => r.status === 'fulfilled');

        video.distribution.edges = edgeResults;
        video.distribution.status = allSuccess ? 'distributed' : 'failed';
        video.distribution.completedAt = new Date();
        video.status = allSuccess ? 'ready' : 'distribution_failed';
        
        await video.save();

        return {
            success: allSuccess,
            edges: edgeResults
        };
    }

    async pushToEdge(edge, sourceDir, videoId) {
        return new Promise((resolve, reject) => {
            const targetPath = `${edge.user}@${edge.ip}:${edge.path}`;
            
            const rsyncCmd = `rsync -avz --progress -e "ssh -i ${this.sshKeyPath} -o StrictHostKeyChecking=no" ${sourceDir}/ ${targetPath}${videoId}/`;

            console.log(`Pushing to ${edge.name} (${edge.ip})...`);

            exec(rsyncCmd, { maxBuffer: 50 * 1024 * 1024 }, (error, stdout, stderr) => {
                if (error) {
                    console.error(`Distribution to ${edge.name} failed:`, error.message);
                    reject(error);
                } else {
                    console.log(`Distribution to ${edge.name} completed`);
                    resolve({ edge: edge.name, success: true });
                }
            });
        });
    }

    async verifyDistribution(videoId) {
        const video = await Video.findById(videoId);
        if (!video || !video.distribution) {
            throw new Error('Video or distribution info not found');
        }

        const verificationResults = await Promise.allSettled(
            this.edgeServers.map(edge => this.verifyOnEdge(edge, videoId))
        );

        return verificationResults.map((result, index) => ({
            edge: this.edgeServers[index].name,
            verified: result.status === 'fulfilled' && result.value
        }));
    }

    async verifyOnEdge(edge, videoId) {
        return new Promise((resolve, reject) => {
            const checkCmd = `ssh -i ${this.sshKeyPath} -o StrictHostKeyChecking=no ${edge.user}@${edge.ip} "ls -la ${edge.path}${videoId}/"`;

            exec(checkCmd, (error, stdout, stderr) => {
                if (error) {
                    resolve(false);
                } else {
                    resolve(stdout.includes('master.m3u8'));
                }
            });
        });
    }
}

module.exports = new DistributionService();
```

---

### STEP C3: Update Video Processor

**File:** `backend/src/services/videoProcessor.js`

**Add at the top (with other imports):**

```javascript
const distributionService = require('./distributionService');
```

**Find the section where processing completes (look for status = 'ready') and modify:**

```javascript
// OLD:
video.status = 'ready';
await video.save();

// NEW:
video.status = 'processing_complete';
await video.save();

// Auto-distribute to edge servers
try {
    console.log(`Starting distribution for video: ${video._id}`);
    await distributionService.distributeVideo(video._id);
    console.log(`Distribution completed for video: ${video._id}`);
} catch (distError) {
    console.error('Distribution failed:', distError);
    video.status = 'distribution_failed';
    video.distribution.lastError = distError.message;
    await video.save();
}
```

---

### STEP C4: Add Distribution API Routes

**File:** `backend/src/routes/video.js`

**Add these new routes:**

```javascript
const distributionService = require('../services/distributionService');

// Manual trigger distribution
router.post('/:id/distribute', auth, adminOnly, async (req, res) => {
    try {
        const result = await distributionService.distributeVideo(req.params.id);
        res.json({
            success: true,
            message: 'Distribution initiated',
            result
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Check distribution status
router.get('/:id/distribution-status', auth, async (req, res) => {
    try {
        const video = await Video.findById(req.params.id);
        res.json({
            success: true,
            distribution: video.distribution
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Verify distribution on edges
router.get('/:id/verify-distribution', auth, adminOnly, async (req, res) => {
    try {
        const result = await distributionService.verifyDistribution(req.params.id);
        res.json({
            success: true,
            verification: result
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});
```

---

## 🚀 PART D: START THE CDN SYSTEM

### STEP D1: Start lsyncd on Laptop

```bash
# Start lsyncd service
sudo systemctl start lsyncd

# Check status
sudo systemctl status lsyncd

# View logs
sudo tail -f /var/log/lsyncd/lsyncd.log
```

---

### STEP D2: Test File Push

```bash
# Create test file on laptop
echo "test" > /home/hilal/projects/PakStream/backend/uploads/videos/processed/test.txt

# Wait 5 seconds...

# Check if file appeared on edge server
ssh -i ~/.ssh/edge_push_key edgeuser@192.168.1.101 "ls -la /var/www/edge-storage/videos/processed/"

# You should see test.txt!
```

---

### STEP D3: Upload a Real Video

1. Open PakStream frontend
2. Upload a video through the admin panel
3. Wait for processing to complete
4. Check edge server for files:

```bash
ssh -i ~/.ssh/edge_push_key edgeuser@192.168.1.101 "ls -la /var/www/edge-storage/videos/processed/"
```

---

## 🔍 TROUBLESHOOTING

### SSH Connection Issues

```bash
# Test SSH manually
ssh -v -i ~/.ssh/edge_push_key edgeuser@192.168.1.101

# Check SSH key permissions
chmod 600 ~/.ssh/edge_push_key
chmod 644 ~/.ssh/edge_push_key.pub
```

### lsyncd Not Syncing

```bash
# Check lsyncd logs
sudo tail -100 /var/log/lsyncd/lsyncd.log

# Restart lsyncd
sudo systemctl restart lsyncd

# Test rsync manually
rsync -avz --progress -e "ssh -i ~/.ssh/edge_push_key" /source/path/ edgeuser@192.168.1.101:/dest/path/
```

### Edge Server Not Serving Files

```bash
# Check Nginx logs
# Windows: C:\nginx\logs\error.log
# Linux: /var/log/nginx/error.log

# Test file exists
ls -la /var/www/edge-storage/videos/processed/

# Test Nginx config
sudo nginx -t
sudo systemctl reload nginx
```

---

## 📊 MONITORING COMMANDS

### On Laptop (Origin)

```bash
# Watch lsyncd activity
sudo tail -f /var/log/lsyncd/lsyncd.log

# Check lsyncd status
sudo systemctl status lsyncd

# See what's being synced
cat /var/log/lsyncd/lsyncd.status
```

### On Edge Servers

```bash
# Watch for new files
watch -n 2 'ls -la /var/www/edge-storage/videos/processed/'

# Check Nginx access logs
sudo tail -f /var/log/nginx/access.log

# Check disk usage
df -h /var/www/edge-storage/
```

---

## ✅ VERIFICATION CHECKLIST

### Laptop (Origin)
- [ ] SSH keys generated
- [ ] lsyncd installed and configured
- [ ] Nginx configured on port 8080
- [ ] Backend running
- [ ] Can SSH to each edge server without password

### Each Edge Server
- [ ] SSH server running
- [ ] edgeuser created with SSH key
- [ ] Storage directory created
- [ ] Nginx installed and configured
- [ ] Firewall allows port 80
- [ ] Health check responds

### Full System
- [ ] Test file syncs from laptop to edges
- [ ] Video upload triggers distribution
- [ ] Users can stream from edge servers
- [ ] All edge servers have same content

---

## 🎉 SUCCESS CRITERIA

When everything is working:

1. **Upload video on laptop** → Video processes with FFmpeg
2. **lsyncd detects new files** → Automatically pushes to all edges
3. **User requests video** → Gets served from nearest edge
4. **Check headers** → `X-Served-From: Edge-Linux` or `Edge-Windows`

**Congratulations! You now have a working Push-Based CDN!** 🚀

---

## 📝 QUICK REFERENCE

| Component | Location | Port | Purpose |
|-----------|----------|------|---------|
| PakStream Backend | Laptop | 5000 | API & Processing |
| Origin Nginx | Laptop | 8080 | Local routing |
| lsyncd | Laptop | N/A | File sync daemon |
| Edge Nginx | Edge PCs | 80 | Serve videos |
| SSH | All machines | 22 | Secure file transfer |

---

**Document End - Version 3.0**

