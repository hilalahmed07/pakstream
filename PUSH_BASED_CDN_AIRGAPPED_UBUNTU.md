# Push-Based CDN Implementation Guide for PakStream
## Complete Step-by-Step Setup for Airgapped Ubuntu Systems

**Author:** Hilal Ahmed  
**Date:** January 2025  
**Version:** 4.0 - Airgapped Ubuntu Implementation Guide

---

## 🎯 OVERVIEW & ARCHITECTURE

### What We're Building

```
┌─────────────────────────────────────────────────────────┐
│ ORIGIN SERVER (Airgapped Ubuntu)                        │
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
│ Edge #1 │ │ Edge #2 │ │ Edge #3 │ │ Edge #4 │
│ Ubuntu  │ │ Ubuntu  │ │ Ubuntu  │ │ Ubuntu  │
│ (Nginx) │ │ (Nginx) │ │ (Nginx) │ │ (Nginx) │
└────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘
     │           │           │           │
     ↓           ↓           ↓           ↓
  Users       Users       Users       Users
```

### Key Principle

- **Origin Server** = Processes and PUSHES videos to edges
- **Edge Servers** = Receive and SERVE videos to users
- **Users NEVER access Origin directly** - only edge servers
- **All machines are airgapped Ubuntu** - no internet connection

---

## 💻 HARDWARE REQUIREMENTS

### Origin Server (Airgapped Ubuntu)

- ✅ **OS:** Ubuntu 20.04 LTS or 22.04 LTS
- ✅ **RAM:** 8GB+ (16GB recommended for video processing)
- ✅ **Storage:** 500GB+ free space (for video processing)
- ✅ **Network:** Ethernet connection to same network as edge servers
- ✅ **CPU:** Multi-core processor (4+ cores recommended)

### Edge Servers (Airgapped Ubuntu)

- ✅ **OS:** Ubuntu 20.04 LTS or 22.04 LTS
- ✅ **RAM:** 4GB+ per server
- ✅ **Storage:** 500GB+ per server (same capacity as origin)
- ✅ **Network:** Ethernet connection to same network
- ✅ **CPU:** 2+ cores per server

### Network Setup

- All machines must be on **same local network** (same switch/router)
- Static IP addresses recommended for all servers
- Get IP addresses: Run `ip a` or `hostname -I` on each machine
- Ensure SSH (port 22) and HTTP (port 80) are accessible between machines

---

## 📦 PART 0: OFFLINE PACKAGE PREPARATION

**⚠️ IMPORTANT:** Do this on an **internet-connected machine** before deploying to airgapped systems.

### Step 0.1: Download Required Packages

Create a directory for offline packages:

```bash
mkdir -p ~/pakstream-offline-packages
cd ~/pakstream-offline-packages
```

#### Download Node.js (v18+)

```bash
# For Ubuntu 20.04/22.04 x64
wget https://nodejs.org/dist/v20.11.0/node-v20.11.0-linux-x64.tar.xz

# Or download manually from:
# https://nodejs.org/dist/v20.11.0/
# File: node-v20.11.0-linux-x64.tar.xz
```

#### Download Nginx

```bash
# Download Nginx source or pre-built package
wget http://nginx.org/download/nginx-1.24.0.tar.gz

# Or download manually from:
# http://nginx.org/download/
# File: nginx-1.24.0.tar.gz
```

#### Download lsyncd Dependencies

```bash
# Create directory for apt packages
mkdir -p apt-packages

# On internet-connected Ubuntu machine, download dependencies:
sudo apt-get download lsyncd rsync openssh-server nginx
sudo apt-get download $(apt-cache depends lsyncd | grep -E 'Depends|Recommends' | cut -d: -f2 | tr -d ' ')

# Copy all .deb files to apt-packages directory
```

#### Download FFmpeg

```bash
# Download FFmpeg static build
wget https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz

# Or download manually from:
# https://johnvansickle.com/ffmpeg/
# File: ffmpeg-release-amd64-static.tar.xz
```

### Step 0.2: Create Installation Scripts

Create a USB drive or network share with all downloaded packages and transfer to airgapped machines.

### Step 0.3: Prepare PakStream Project for Transfer

**⚠️ IMPORTANT:** The PakStream project codebase must be transferred to the airgapped origin server. Do this on an **internet-connected machine** before deploying.

#### Option 1: Create Project Tarball (Recommended)

```bash
# Navigate to your PakStream project directory
cd /path/to/PakStream

# Create a compressed archive (exclude node_modules and .git to save space)
tar -czf pakstream-project.tar.gz \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='backend/uploads' \
    --exclude='*.log' \
    .

# Verify the archive
ls -lh pakstream-project.tar.gz

# Copy to USB drive or network share location
cp pakstream-project.tar.gz ~/pakstream-offline-packages/
```

#### Option 2: Copy Entire Directory

```bash
# Copy entire project directory to USB drive
# Exclude large directories manually
rsync -av --exclude='node_modules' \
          --exclude='.git' \
          --exclude='backend/uploads' \
          --exclude='*.log' \
          /path/to/PakStream \
          ~/pakstream-offline-packages/
```

#### Option 3: Prepare Offline npm Dependencies

If you need to install npm packages offline:

```bash
# On internet-connected machine, in PakStream/backend directory
cd /path/to/PakStream/backend

# Create package-lock.json if it doesn't exist
npm install --package-lock-only

# Download all dependencies to a local cache
npm cache clean --force
npm install

# Create tarball of node_modules (optional, large file)
cd ..
tar -czf pakstream-node-modules.tar.gz backend/node_modules/
```

**⚠️ NOTE:** 
- The `node_modules` directory can be very large (hundreds of MB to GB)
- You can either transfer it or reinstall dependencies on the airgapped system if you have an offline npm registry
- Configuration files (`.env`, etc.) should be included but may need adjustment for airgapped environment

---

## 🖥️ PART A: ORIGIN SERVER SETUP (Airgapped Ubuntu)

**Location:** Origin Server (Airgapped Ubuntu Machine)  
**Time Required:** 2-3 hours

---

### STEP A1: Get Origin Server IP Address

```bash
# Get IP address
ip a | grep "inet " | grep -v 127.0.0.1

# Or use:
hostname -I

# Example output: 192.168.1.50
```

**Write down your origin IP:** `192.168.1._____`

---

### STEP A2: Install Node.js (Offline)

```bash
# Navigate to directory with downloaded Node.js
cd /path/to/downloaded/packages

# Extract Node.js
tar -xJf node-v20.11.0-linux-x64.tar.xz

# Move to system directory
sudo mv node-v20.11.0-linux-x64 /opt/nodejs

# Create symlinks
sudo ln -s /opt/nodejs/bin/node /usr/local/bin/node
sudo ln -s /opt/nodejs/bin/npm /usr/local/bin/npm
sudo ln -s /opt/nodejs/bin/npx /usr/local/bin/npx

# Verify installation
node --version
npm --version
```

---

### STEP A3: Install FFmpeg (Offline)

```bash
# Navigate to directory with downloaded FFmpeg
cd /path/to/downloaded/packages

# Extract FFmpeg
tar -xJf ffmpeg-release-amd64-static.tar.xz

# Move to system directory
sudo mv ffmpeg-*-amd64-static /opt/ffmpeg

# Create symlinks
sudo ln -s /opt/ffmpeg/ffmpeg /usr/local/bin/ffmpeg
sudo ln -s /opt/ffmpeg/ffprobe /usr/local/bin/ffprobe

# Verify installation
ffmpeg -version
```

---

### STEP A4: Install System Packages (Offline)

If you have .deb packages downloaded:

```bash
# Install from local .deb files
cd /path/to/apt-packages
sudo dpkg -i *.deb

# If dependencies are missing, install them first
sudo apt-get install -f
```

If packages are on a repository mirror:

```bash
# Update package list from local repository
sudo apt-get update

# Install required packages
sudo apt-get install -y lsyncd rsync openssh-server nginx
```

---

### STEP A5: Setup SSH Server

```bash
# Start SSH service
sudo systemctl start ssh
sudo systemctl enable ssh

# Check status
sudo systemctl status ssh

# Allow SSH through firewall (if ufw is active)
sudo ufw allow 22/tcp
sudo ufw reload
```

---

### STEP A6: Create Storage Directories

```bash
# Create directory for edge servers to receive files
sudo mkdir -p /var/www/edge-storage/videos/processed
sudo mkdir -p /var/www/edge-storage/videos/original

# Set ownership (replace 'youruser' with your username)
sudo chown -R $USER:$USER /var/www/edge-storage
sudo chmod -R 755 /var/www/edge-storage

# Verify it exists
ls -la /var/www/edge-storage/videos/
```

---

### STEP A7: Setup SSH Keys (For Passwordless Push)

```bash
# Generate SSH key pair
ssh-keygen -t rsa -b 4096 -f ~/.ssh/edge_push_key -N ""

# View public key (you'll copy this to edge servers)
cat ~/.ssh/edge_push_key.pub

# Output looks like:
# ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQDxxxxxx... user@origin
```

**⚠️ IMPORTANT:** Copy the entire public key output - you'll need it for EACH edge server!

---

### STEP A8: Install and Configure lsyncd

```bash
# Create log directory
sudo mkdir -p /var/log/lsyncd
sudo touch /var/log/lsyncd/lsyncd.log
sudo chmod 777 /var/log/lsyncd/lsyncd.log
```

---

### STEP A9: Create lsyncd Configuration File

```bash
# Create config file
sudo nano /etc/lsyncd/lsyncd.conf.lua
```

Paste this COMPLETE configuration:

```lua
-- lsyncd Configuration for PakStream CDN (Airgapped Ubuntu)
-- This automatically pushes processed videos to edge servers

settings {
    logfile = "/var/log/lsyncd/lsyncd.log",
    statusFile = "/var/log/lsyncd/lsyncd.status",
    statusInterval = 10,
    maxProcesses = 4,
    nodaemon = false
}

-- Edge Server 1
-- REPLACE 192.168.1.101 with your Edge Server #1 IP
-- REPLACE /home/youruser/projects/PakStream with your actual PakStream path
sync {
    default.rsync,
    source = "/home/youruser/projects/PakStream/backend/uploads/videos/processed/",
    target = "edgeuser@192.168.1.101:/var/www/edge-storage/videos/processed/",
    delay = 5,
    rsync = {
        archive = true,
        compress = true,
        perms = true,
        owner = false,
        group = false,
        rsh = "/usr/bin/ssh -i /home/youruser/.ssh/edge_push_key -o StrictHostKeyChecking=no"
    }
}

-- Edge Server 2 (Uncomment and modify when you add second edge server)
--[[
sync {
    default.rsync,
    source = "/home/youruser/projects/PakStream/backend/uploads/videos/processed/",
    target = "edgeuser@192.168.1.102:/var/www/edge-storage/videos/processed/",
    delay = 5,
    rsync = {
        archive = true,
        compress = true,
        perms = true,
        owner = false,
        group = false,
        rsh = "/usr/bin/ssh -i /home/youruser/.ssh/edge_push_key -o StrictHostKeyChecking=no"
    }
}
]]--

-- Edge Server 3
--[[
sync {
    default.rsync,
    source = "/home/youruser/projects/PakStream/backend/uploads/videos/processed/",
    target = "edgeuser@192.168.1.103:/var/www/edge-storage/videos/processed/",
    delay = 5,
    rsync = {
        archive = true,
        compress = true,
        perms = true,
        owner = false,
        group = false,
        rsh = "/usr/bin/ssh -i /home/youruser/.ssh/edge_push_key -o StrictHostKeyChecking=no"
    }
}
]]--

-- Edge Server 4
--[[
sync {
    default.rsync,
    source = "/home/youruser/projects/PakStream/backend/uploads/videos/processed/",
    target = "edgeuser@192.168.1.104:/var/www/edge-storage/videos/processed/",
    delay = 5,
    rsync = {
        archive = true,
        compress = true,
        perms = true,
        owner = false,
        group = false,
        rsh = "/usr/bin/ssh -i /home/youruser/.ssh/edge_push_key -o StrictHostKeyChecking=no"
    }
}
]]--
```

**⚠️ IMPORTANT:** 
- Replace `192.168.1.101` with actual IP of your edge server
- Replace `/home/youruser/projects/PakStream` with your actual PakStream path
- Replace `youruser` with your actual username

Save: Press `Ctrl+O`, `Enter`, then `Ctrl+X`

---

### STEP A10: Update Nginx Configuration

```bash
# Edit Nginx config
sudo nano /etc/nginx/sites-available/pakstream-origin
```

Replace ENTIRE content with this COMPLETE config:

```nginx
# PakStream Origin Server Configuration (Port 8080)
# This serves API and pushes files to edges (users don't access this directly)

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
        return 200 "Origin server is healthy - Push-based CDN active\n";
        add_header Content-Type text/plain;
    }

    # API endpoints - PROXY to backend
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

    # Video files - SERVE FROM LOCAL FILESYSTEM (for testing only)
    # In production, users should access edge servers, not origin
    location /uploads/videos/ {
        alias /home/youruser/projects/PakStream/backend/uploads/videos/;
        
        # If file not found, return 404
        try_files $uri =404;
        
        # CORS headers
        add_header Access-Control-Allow-Origin "*" always;
        add_header Access-Control-Allow-Methods "GET, OPTIONS" always;
        add_header Access-Control-Allow-Headers "*" always;
        
        # Cache control
        expires 7d;
        add_header Cache-Control "public, immutable";
        
        # Custom headers
        add_header X-Served-From "Origin-Server";
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
        
        # Disable access logs for video segments
        access_log off;
    }

    # Other uploads - serve from local
    location /uploads/presentations/ {
        alias /home/youruser/projects/PakStream/backend/uploads/presentations/;
        try_files $uri =404;
        add_header Access-Control-Allow-Origin "*" always;
    }

    location /uploads/documents/ {
        alias /home/youruser/projects/PakStream/backend/uploads/documents/;
        try_files $uri =404;
        add_header Access-Control-Allow-Origin "*" always;
    }

    # Error pages
    error_page 404 /404.html;
    location = /404.html {
        return 404 '{"error": "Resource not found on origin server"}';
        add_header Content-Type application/json;
    }

    error_page 500 502 503 504 /50x.html;
    location = /50x.html {
        return 500 '{"error": "Origin server error"}';
        add_header Content-Type application/json;
    }
}
```

**⚠️ IMPORTANT:** Replace `/home/youruser/projects/PakStream` with your actual PakStream path.

Save: `Ctrl+O`, `Enter`, `Ctrl+X`

Enable site and test:

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/pakstream-origin /etc/nginx/sites-enabled/

# Remove default site (optional)
sudo rm /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# If successful, reload
sudo systemctl reload nginx

# Check if running
curl http://localhost:8080/health
# Should return: "Origin server is healthy - Push-based CDN active"
```

---

### STEP A11: Enable lsyncd Service

```bash
# Enable lsyncd to start on boot
sudo systemctl enable lsyncd

# DON'T start it yet! (We need to setup edge servers first)
# We'll start it after edge servers are ready
```

---

### STEP A11.5: Transfer PakStream Project to Airgapped System

**⚠️ IMPORTANT:** This step transfers the actual PakStream codebase to your airgapped origin server.

#### Method 1: From USB Drive

```bash
# Mount USB drive (if not auto-mounted)
sudo mkdir -p /mnt/usb
sudo mount /dev/sdb1 /mnt/usb  # Adjust device name as needed

# Create project directory
mkdir -p /home/youruser/projects
cd /home/youruser/projects

# Extract project from tarball
tar -xzf /mnt/usb/pakstream-project.tar.gz -C .

# OR if you copied the directory directly
cp -r /mnt/usb/PakStream .

# Unmount USB drive
sudo umount /mnt/usb
```

#### Method 2: From Network Share

```bash
# If you have a network share accessible from airgapped network
# Mount the share (adjust path as needed)
sudo mkdir -p /mnt/shared
sudo mount -t cifs //192.168.1.10/shared /mnt/shared -o username=user,password=pass

# Copy project
mkdir -p /home/youruser/projects
cp -r /mnt/shared/PakStream /home/youruser/projects/

# OR extract from tarball
cd /home/youruser/projects
tar -xzf /mnt/shared/pakstream-project.tar.gz

# Unmount
sudo umount /mnt/shared
```

#### Method 3: From Another Machine via SCP (if SSH is available)

**On internet-connected machine:**
```bash
# Create tarball first (see Step 0.3)
tar -czf pakstream-project.tar.gz --exclude='node_modules' --exclude='.git' /path/to/PakStream

# Transfer via SCP (if you have network bridge)
scp pakstream-project.tar.gz youruser@192.168.1.50:/home/youruser/
```

**On airgapped origin server:**
```bash
# Extract project
cd /home/youruser
tar -xzf pakstream-project.tar.gz
mv PakStream projects/
```

#### Verify Project Transfer

```bash
# Check project structure
cd /home/youruser/projects/PakStream
ls -la

# Should see directories like:
# - backend/
# - frontend/
# - package.json (if root level)
# - README.md
# etc.

# Verify backend directory exists
ls -la backend/

# Should see:
# - src/
# - package.json
# - node_modules/ (if you transferred it)
# etc.
```

**⚠️ IMPORTANT:** 
- Replace `/home/youruser` with your actual username
- Ensure the project path matches what you'll use in later steps
- If you didn't transfer `node_modules`, you'll need to install dependencies (see Step A12)

---

### STEP A12: Install PakStream Backend

**⚠️ PREREQUISITE:** Ensure you've completed STEP A11.5 to transfer the PakStream project to this server.

```bash
# Navigate to PakStream directory (should already be transferred)
cd /home/youruser/projects/PakStream/backend

# If node_modules was NOT transferred, install dependencies
# Option 1: If you have offline npm registry or cached packages
npm install --offline

# Option 2: If you transferred node_modules separately
cd /home/youruser/projects/PakStream
tar -xzf /path/to/pakstream-node-modules.tar.gz

# Option 3: If you have all packages in a local directory
npm install --cache /path/to/npm-cache --prefer-offline

# Verify installation
ls -la node_modules/  # Should show installed packages
```

**If npm install fails (no internet):**
- You need to set up an offline npm registry, OR
- Transfer the complete `node_modules` directory, OR
- Use a tool like `npm-bundle` or `npm-pack-all` to create offline packages

```bash
# Create .env file if it doesn't exist
nano .env
```

Add these configurations to `.env`:

```env
# Server
PORT=5000
NODE_ENV=production

# Database
MONGODB_URI=mongodb://localhost:27017/pakstream

# Security
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
ADMIN_REGISTRATION_KEY=admin123
CORS_ORIGIN=*

# Storage
STORAGE_TYPE=local
FFMPEG_PATH=/usr/local/bin/ffmpeg

# CDN Configuration
CDN_TYPE=push
CDN_ORIGIN_IP=192.168.1.50
CDN_ORIGIN_PORT=8080
CDN_EDGE_SERVERS=192.168.1.101,192.168.1.102,192.168.1.103,192.168.1.104
```

**⚠️ IMPORTANT:** Replace IP addresses with your actual server IPs.

---

### STEP A13: Start Backend Service

```bash
# Test if backend starts
npm start

# If successful, create systemd service (optional but recommended)
sudo nano /etc/systemd/system/pakstream-backend.service
```

Paste this service file:

```ini
[Unit]
Description=PakStream Backend Service
After=network.target mongod.service

[Service]
Type=simple
User=youruser
WorkingDirectory=/home/youruser/projects/PakStream/backend
ExecStart=/usr/local/bin/node src/server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

**⚠️ IMPORTANT:** Replace `youruser` with your actual username.

Enable and start:

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable service
sudo systemctl enable pakstream-backend

# Start service
sudo systemctl start pakstream-backend

# Check status
sudo systemctl status pakstream-backend
```

---

## 🌐 PART B: EDGE SERVER SETUP (Airgapped Ubuntu)

**Location:** Each Edge Server (Airgapped Ubuntu Machine)  
**Time Required:** 1-2 hours PER edge server  
**Repeat this section for EACH edge server**

---

### STEP B1: Get Edge Server IP Address

```bash
# Get IP address
ip a | grep "inet " | grep -v 127.0.0.1

# Or use:
hostname -I

# Example output: 192.168.1.101
```

**Write down this edge server IP:** `192.168.1._____`

---

### STEP B2: Install Node.js (Offline)

Same as Step A2 - install Node.js from offline package.

---

### STEP B3: Install Nginx (Offline)

If using pre-built packages:

```bash
# Install from local .deb files
cd /path/to/apt-packages
sudo dpkg -i nginx*.deb
sudo apt-get install -f
```

If building from source:

```bash
# Extract Nginx source
cd /path/to/downloaded/packages
tar -xzf nginx-1.24.0.tar.gz
cd nginx-1.24.0

# Configure and build
./configure --prefix=/etc/nginx --sbin-path=/usr/sbin/nginx
make
sudo make install
```

---

### STEP B4: Setup SSH Server

```bash
# Start SSH service
sudo systemctl start ssh
sudo systemctl enable ssh

# Check status
sudo systemctl status ssh

# Allow SSH through firewall
sudo ufw allow 22/tcp
sudo ufw reload
```

---

### STEP B5: Create Storage Directory

```bash
# Create storage directory
sudo mkdir -p /var/www/edge-storage/videos/processed
sudo mkdir -p /var/www/edge-storage/videos/original

# Set ownership
sudo chown -R www-data:www-data /var/www/edge-storage
sudo chmod -R 755 /var/www/edge-storage

# Verify
ls -la /var/www/edge-storage/videos/
```

---

### STEP B6: Create User for File Transfer

```bash
# Create user named "edgeuser"
sudo adduser edgeuser

# Set password when prompted (e.g., EdgePass123!)
# Fill in other details or press Enter to skip

# Add to www-data group
sudo usermod -aG www-data edgeuser

# Verify user created
id edgeuser
```

---

### STEP B7: Add Origin Server's SSH Public Key

```bash
# Switch to edgeuser
sudo su - edgeuser

# Create .ssh directory
mkdir -p ~/.ssh
chmod 700 ~/.ssh

# Create authorized_keys file
nano ~/.ssh/authorized_keys
```

In nano:
1. Paste the SSH public key from origin server (from Step A7)
2. It looks like: `ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQDxxxxxx... user@origin`
3. Save: `Ctrl+O`, `Enter`, `Ctrl+X`

```bash
# Set permissions
chmod 600 ~/.ssh/authorized_keys

# Exit back to your user
exit
```

---

### STEP B8: Test SSH Connection from Origin Server

**On your ORIGIN SERVER:**

```bash
# Test connection (replace with your edge server IP)
ssh -i ~/.ssh/edge_push_key edgeuser@192.168.1.101

# If asked "Are you sure you want to continue connecting?", type: yes

# If successful, you'll be logged into edge server!
# Type: exit
```

If connection fails, see Troubleshooting section!

---

### STEP B9: Install and Configure Nginx

```bash
# Create Nginx config
sudo nano /etc/nginx/sites-available/edge-server
```

Paste this COMPLETE configuration:

```nginx
# PakStream Edge Server - Airgapped Ubuntu
# Serves ONLY local files pushed from origin

server {
    listen 80;
    listen [::]:80;
    server_name _;

    # Maximum body size
    client_max_body_size 2G;

    # Health check
    location /health {
        return 200 "Edge server healthy - Airgapped Ubuntu\n";
        add_header Content-Type text/plain;
    }

    # Serve videos from local storage
    location /uploads/videos/ {
        # Serve from edge storage
        alias /var/www/edge-storage/videos/processed/;
        
        # If not found, return 404 (no origin fallback)
        try_files $uri =404;
        
        # CORS headers
        add_header Access-Control-Allow-Origin "*" always;
        add_header Access-Control-Allow-Methods "GET, OPTIONS" always;
        add_header Access-Control-Allow-Headers "*" always;
        
        # Cache control
        expires 7d;
        add_header Cache-Control "public, immutable";
        add_header X-Served-From "Edge-Ubuntu";
        add_header X-CDN-Type "Push-Based";
        
        # Disable access logs for performance
        access_log off;
    }

    # HLS playlists (.m3u8 files)
    location ~ \.m3u8$ {
        root /var/www/edge-storage/videos;
        add_header Content-Type application/vnd.apple.mpegurl;
        add_header Access-Control-Allow-Origin "*" always;
        expires 0;
        access_log off;
    }

    # HLS segments (.ts files)
    location ~ \.ts$ {
        root /var/www/edge-storage/videos;
        add_header Content-Type video/mp2t;
        add_header Access-Control-Allow-Origin "*" always;
        access_log off;
    }

    # Video thumbnails
    location ~ \.(jpg|jpeg|png)$ {
        root /var/www/edge-storage/videos;
        add_header Access-Control-Allow-Origin "*" always;
        expires 30d;
        access_log off;
    }

    # Error handling
    error_page 404 /404.html;
    location = /404.html {
        return 404 '{"error": "File not found on edge server"}';
        add_header Content-Type application/json;
    }

    error_page 500 502 503 504 /50x.html;
    location = /50x.html {
        return 500 '{"error": "Edge server error"}';
        add_header Content-Type application/json;
    }
}
```

Save: `Ctrl+O`, `Enter`, `Ctrl+X`

Enable and test:

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/edge-server /etc/nginx/sites-enabled/

# Remove default site
sudo rm /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# If successful, reload Nginx
sudo systemctl reload nginx

# Enable Nginx to start on boot
sudo systemctl enable nginx

# Test health check
curl http://localhost/health
# Expected: "Edge server healthy - Airgapped Ubuntu"
```

---

### STEP B10: Allow Nginx Through Firewall

```bash
# Allow HTTP through firewall
sudo ufw allow 80/tcp
sudo ufw reload

# Check firewall status
sudo ufw status
```

---

### STEP B11: Verify Edge Server is Ready

**Test from edge server itself:**

```bash
curl http://localhost/health
# Expected: "Edge server healthy - Airgapped Ubuntu"
```

**Test from origin server:**

```bash
# Replace with edge server IP
curl http://192.168.1.101/health
# Expected: "Edge server healthy - Airgapped Ubuntu"
```

✅ **Edge server is ready!**

**Repeat PART B for each additional edge server you have.**

---

## 🔧 PART C: ACTIVATE PUSH-BASED CDN

**Location:** Origin Server  
**Time Required:** 30 minutes

---

### STEP C1: Update lsyncd Configuration

On origin server, edit lsyncd config to include all edge servers:

```bash
sudo nano /etc/lsyncd/lsyncd.conf.lua
```

Uncomment and configure sync blocks for each edge server you've set up.

**⚠️ IMPORTANT:** 
- Replace IP addresses with actual edge server IPs
- Replace username/path with your actual values

---

### STEP C2: Start lsyncd Service

```bash
# Start lsyncd
sudo systemctl start lsyncd

# Check status
sudo systemctl status lsyncd

# View logs
sudo tail -f /var/log/lsyncd/lsyncd.log

# Enable to start on boot
sudo systemctl enable lsyncd
```

---

### STEP C3: Test File Push

```bash
# Create a test file in processed directory
touch /home/youruser/projects/PakStream/backend/uploads/videos/processed/test-file.txt

# Wait 5 seconds (lsyncd delay)

# Check if file appears on edge server
ssh -i ~/.ssh/edge_push_key edgeuser@192.168.1.101 "ls -la /var/www/edge-storage/videos/processed/"

# If test-file.txt appears, push is working!
```

---

### STEP C4: Verify Video Distribution

1. Upload a test video through PakStream frontend
2. Wait for processing to complete
3. Check edge servers for processed video files:

```bash
# On each edge server
ls -la /var/www/edge-storage/videos/processed/

# Should see video directories with HLS files
```

---

## 📝 PART D: BACKEND CODE MODIFICATIONS

**⚠️ NOTE:** These are reference modifications. Apply these changes to your backend code when ready.

### D1: Update Video Model

**File:** `backend/src/models/Video.js`

Add distribution tracking fields to video schema:

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
}
```

Update status enum to include:

```javascript
enum: ['uploading', 'processing', 'processing_complete', 'distributing', 'ready', 'error', 'failed', 'distribution_failed']
```

### D2: Update Video Controller

**File:** `backend/src/controllers/videoController.js`

After video processing completes, trigger distribution to edge servers.

### D3: Create Distribution Service

**File:** `backend/src/services/distributionService.js`

Create service to:
- Track which edge servers have received files
- Verify file distribution
- Handle distribution failures
- Update video status

---

## 🔍 TROUBLESHOOTING

### Issue: SSH Connection Fails

**Symptoms:** `Permission denied` or `Connection refused`

**Solutions:**

```bash
# On edge server, check SSH is running
sudo systemctl status ssh

# Check SSH port is open
sudo ufw status

# Verify authorized_keys permissions
sudo su - edgeuser
ls -la ~/.ssh/
# authorized_keys should be 600
chmod 600 ~/.ssh/authorized_keys

# Check SSH logs
sudo tail -f /var/log/auth.log
```

### Issue: lsyncd Not Pushing Files

**Symptoms:** Files not appearing on edge servers

**Solutions:**

```bash
# Check lsyncd status
sudo systemctl status lsyncd

# View logs
sudo tail -f /var/log/lsyncd/lsyncd.log

# Test SSH connection manually
ssh -i ~/.ssh/edge_push_key edgeuser@EDGE_IP

# Verify source directory exists and is writable
ls -la /home/youruser/projects/PakStream/backend/uploads/videos/processed/

# Restart lsyncd
sudo systemctl restart lsyncd
```

### Issue: Nginx Not Serving Files

**Symptoms:** 404 errors when accessing videos

**Solutions:**

```bash
# Check Nginx status
sudo systemctl status nginx

# Test configuration
sudo nginx -t

# Check file permissions
ls -la /var/www/edge-storage/videos/processed/

# Verify Nginx can read files
sudo -u www-data ls /var/www/edge-storage/videos/processed/

# Check Nginx error logs
sudo tail -f /var/log/nginx/error.log
```

### Issue: Files Not Syncing in Real-Time

**Symptoms:** Files appear on edge servers after long delay

**Solutions:**

```bash
# Reduce lsyncd delay in config
# Edit /etc/lsyncd/lsyncd.conf.lua
# Change: delay = 5  to  delay = 1

# Restart lsyncd
sudo systemctl restart lsyncd
```

### Issue: Permission Denied on File Operations

**Symptoms:** Cannot write/read files

**Solutions:**

```bash
# Fix ownership
sudo chown -R www-data:www-data /var/www/edge-storage

# Fix permissions
sudo chmod -R 755 /var/www/edge-storage

# For origin server
sudo chown -R $USER:$USER /home/youruser/projects/PakStream/backend/uploads
```

---

## ✅ VERIFICATION CHECKLIST

### Origin Server

- [ ] Node.js installed and working
- [ ] FFmpeg installed and working
- [ ] SSH server running
- [ ] SSH keys generated
- [ ] lsyncd installed and configured
- [ ] Nginx installed and configured
- [ ] PakStream backend running
- [ ] Storage directories created
- [ ] Can SSH to edge servers without password

### Edge Servers (Each)

- [ ] Nginx installed and running
- [ ] SSH server running
- [ ] Storage directories created
- [ ] edgeuser created and SSH key added
- [ ] Nginx serving files from storage
- [ ] Health check endpoint working
- [ ] Firewall allows HTTP (port 80)
- [ ] Origin server can SSH to edge server

### Integration

- [ ] lsyncd pushing files to edge servers
- [ ] Files appearing on edge servers within 5-10 seconds
- [ ] Videos accessible via edge server IPs
- [ ] HLS streaming working on edge servers
- [ ] No errors in logs

---

## 📊 MONITORING

### Check lsyncd Status

```bash
# View status file
cat /var/log/lsyncd/lsyncd.status

# View live logs
sudo tail -f /var/log/lsyncd/lsyncd.log
```

### Check Nginx Status

```bash
# Check if running
sudo systemctl status nginx

# View access logs
sudo tail -f /var/log/nginx/access.log

# View error logs
sudo tail -f /var/log/nginx/error.log
```

### Check File Distribution

```bash
# On origin server - count files
find /home/youruser/projects/PakStream/backend/uploads/videos/processed -type f | wc -l

# On edge server - count files
find /var/www/edge-storage/videos/processed -type f | wc -l

# Should match (or edge should have more if multiple videos)
```

---

## 🎯 SUMMARY

### Architecture Flow

1. **User uploads video** → Origin server receives it
2. **Origin processes video** → FFmpeg creates HLS files
3. **lsyncd detects new files** → Automatically pushes to all edge servers
4. **Edge servers receive files** → Store in local storage
5. **Users access videos** → Request goes to edge server (not origin)
6. **Edge server serves files** → From local storage (fast!)

### Key Points

- ✅ Origin server processes and pushes (not accessed by users)
- ✅ Edge servers receive and serve (accessed by users)
- ✅ All communication via SSH (secure)
- ✅ Automatic file synchronization (no manual copying)
- ✅ Works completely offline (airgapped systems)
- ✅ Scalable (add more edge servers easily)

### Next Steps

1. Complete all setup steps
2. Test with a small video file
3. Monitor logs for any issues
4. Scale up by adding more edge servers
5. Implement backend code modifications for distribution tracking

---

**End of Guide**

For questions or issues, refer to Troubleshooting section or check logs on respective servers.

