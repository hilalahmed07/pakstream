# Push-Based CDN Configuration Guide
## Post-Installation Setup for PakStream

**Origin Server IP:** `x.x.x.111`  
**Edge Servers:** Ubuntu machines on same network  
**Status:** All packages installed (Nginx, Node.js, MongoDB, offline packages)

---

## 🎯 Architecture Overview

```
┌─────────────────────────────────────┐
│ ORIGIN SERVER (x.x.x.111)           │
│ - PakStream Backend (Port 5000)     │
│ - Nginx (Port 80/8080)              │
│ - lsyncd (Auto-push to edges)      │
│ - Processes videos → Pushes to edges │
└──────────────┬──────────────────────┘
               │
               │ SSH + rsync (lsyncd)
               │
    ┌──────────┼──────────┬──────────┐
    ↓          ↓          ↓          ↓
┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
│ Edge 1 │ │ Edge 2 │ │ Edge 3 │ │ Edge 4 │
│ Ubuntu │ │ Ubuntu │ │ Ubuntu │ │ Ubuntu │
│ :80    │ │ :80     │ │ :80    │ │ :80    │
└────────┘ └────────┘ └────────┘ └────────┘
    │          │          │          │
    └──────────┴──────────┴──────────┘
              Users Access
```

**Key Principle:**
- **Origin (x.x.x.111):** Processes videos, pushes to edges (NOT accessed by users)
- **Edge Servers:** Receive files, serve to users (users access these)

---

## 📋 PART 1: ORIGIN SERVER CONFIGURATION (x.x.x.111)

### Step 1.1: Verify Current Setup

```bash
# Check IP address
hostname -I
# Should show: x.x.x.111

# Verify services installed
node --version
nginx -v
mongod --version
ffmpeg -version

# Check PakStream location
ls -la ~/projects/PakStream/backend/
# Or wherever your project is located
```

**Note your PakStream path:** `/home/[username]/projects/PakStream` or `/opt/PakStream`

---

### Step 1.2: Get Edge Server IPs

**On each Edge Server:**
```bash
hostname -I
```

**Write down Edge Server IPs:**
- Edge Server 1: `x.x.x._____`
- Edge Server 2: `x.x.x._____`
- Edge Server 3: `x.x.x._____`
- Edge Server 4: `x.x.x._____`

---

### Step 1.3: Install lsyncd (if not installed)

```bash
# Check if lsyncd is installed
which lsyncd

# If not installed, install from offline packages
cd /path/to/offline-packages
sudo dpkg -i lsyncd*.deb
sudo apt-get install -f

# Or if you have apt access
sudo apt-get update
sudo apt-get install -y lsyncd rsync
```

---

### Step 1.4: Setup SSH Keys for Passwordless Push

**On Origin Server (x.x.x.111):**

```bash
# Generate SSH key pair (if not exists)
ssh-keygen -t rsa -b 4096 -f ~/.ssh/edge_push_key -N ""

# View public key (copy this for edge servers)
cat ~/.ssh/edge_push_key.pub

# Output example:
# ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQDxxxxxx... user@origin
```

**⚠️ IMPORTANT:** Save this public key - you'll add it to each edge server!

---

### Step 1.5: Configure lsyncd

**On Origin Server (x.x.x.111):**

```bash
# Create log directory
sudo mkdir -p /var/log/lsyncd
sudo touch /var/log/lsyncd/lsyncd.log
sudo chmod 666 /var/log/lsyncd/lsyncd.log

# Create config file
sudo nano /etc/lsyncd/lsyncd.conf.lua
```

**Paste this configuration (REPLACE placeholders):**

```lua
-- lsyncd Configuration for PakStream Push-Based CDN
-- Origin Server: x.x.x.111

settings {
    logfile = "/var/log/lsyncd/lsyncd.log",
    statusFile = "/var/log/lsyncd/lsyncd.status",
    statusInterval = 10,
    maxProcesses = 4,
    nodaemon = false
}

-- Edge Server 1
-- REPLACE: x.x.x.EDGE1_IP with actual Edge Server 1 IP
-- REPLACE: /home/username/projects/PakStream with your actual path
sync {
    default.rsync,
    source = "/home/username/projects/PakStream/backend/uploads/videos/processed/",
    target = "edgeuser@x.x.x.EDGE1_IP:/var/www/edge-storage/videos/processed/",
    delay = 5,
    rsync = {
        archive = true,
        compress = true,
        perms = true,
        owner = false,
        group = false,
        rsh = "/usr/bin/ssh -i /home/username/.ssh/edge_push_key -o StrictHostKeyChecking=no"
    }
}

-- Edge Server 2 (Uncomment when ready)
--[[
sync {
    default.rsync,
    source = "/home/username/projects/PakStream/backend/uploads/videos/processed/",
    target = "edgeuser@x.x.x.EDGE2_IP:/var/www/edge-storage/videos/processed/",
    delay = 5,
    rsync = {
        archive = true,
        compress = true,
        perms = true,
        owner = false,
        group = false,
        rsh = "/usr/bin/ssh -i /home/username/.ssh/edge_push_key -o StrictHostKeyChecking=no"
    }
}
]]--

-- Edge Server 3 (Uncomment when ready)
--[[
sync {
    default.rsync,
    source = "/home/username/projects/PakStream/backend/uploads/videos/processed/",
    target = "edgeuser@x.x.x.EDGE3_IP:/var/www/edge-storage/videos/processed/",
    delay = 5,
    rsync = {
        archive = true,
        compress = true,
        perms = true,
        owner = false,
        group = false,
        rsh = "/usr/bin/ssh -i /home/username/.ssh/edge_push_key -o StrictHostKeyChecking=no"
    }
}
]]--

-- Edge Server 4 (Uncomment when ready)
--[[
sync {
    default.rsync,
    source = "/home/username/projects/PakStream/backend/uploads/videos/processed/",
    target = "edgeuser@x.x.x.EDGE4_IP:/var/www/edge-storage/videos/processed/",
    delay = 5,
    rsync = {
        archive = true,
        compress = true,
        perms = true,
        owner = false,
        group = false,
        rsh = "/usr/bin/ssh -i /home/username/.ssh/edge_push_key -o StrictHostKeyChecking=no"
    }
}
]]--
```

**⚠️ CRITICAL REPLACEMENTS:**
1. Replace `/home/username/projects/PakStream` with your actual PakStream path
2. Replace `username` with your actual username
3. Replace `x.x.x.EDGE1_IP` with actual edge server IPs
4. Uncomment additional sync blocks as you add edge servers

**Save:** `Ctrl+O`, `Enter`, `Ctrl+X`

---

### Step 1.6: Configure Nginx on Origin Server

**On Origin Server (x.x.x.111):**

```bash
# Create/Edit Nginx config
sudo nano /etc/nginx/sites-available/pakstream-origin
```

**Paste this configuration (REPLACE path):**

```nginx
# PakStream Origin Server Configuration
# Origin IP: x.x.x.111
# Port: 80 (or 8080 if you prefer)

upstream backend_origin {
    server localhost:5000;
    keepalive 32;
}

server {
    listen 80;
    server_name x.x.x.111;  # Your origin IP or hostname

    # Maximum upload size
    client_max_body_size 2G;

    # Health check
    location /health {
        return 200 "Origin server healthy - Push-based CDN active\n";
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

    # Serve static files (for admin/testing only)
    # Users should access edge servers, not origin
    location /uploads/videos/ {
        alias /home/username/projects/PakStream/backend/uploads/videos/;
        try_files $uri =404;
        
        # CORS headers
        add_header Access-Control-Allow-Origin "*" always;
        add_header Access-Control-Allow-Methods "GET, OPTIONS" always;
        
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
    }

    # Frontend (if serving React build)
    location / {
        root /home/username/projects/PakStream/frontend/build;
        try_files $uri $uri/ /index.html;
        index index.html;
    }
}
```

**⚠️ REPLACE:** `/home/username/projects/PakStream` with your actual path

**Enable and test:**

```bash
# Enable site
sudo ln -sf /etc/nginx/sites-available/pakstream-origin /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# If successful, reload
sudo systemctl reload nginx

# Test health check
curl http://localhost/health
# Should return: "Origin server healthy - Push-based CDN active"
```

---

### Step 1.7: Configure Backend Environment

**On Origin Server (x.x.x.111):**

```bash
cd ~/projects/PakStream/backend  # Or your actual path
nano .env
```

**Add/Update these variables:**

```env
# Server
PORT=5000
NODE_ENV=production

# Database
MONGODB_URI=mongodb://localhost:27017/pakstream

# Security
JWT_SECRET=your-super-secret-jwt-key-change-this
ADMIN_REGISTRATION_KEY=your-admin-key
CORS_ORIGIN=*

# Storage
STORAGE_TYPE=local
FFMPEG_PATH=/usr/local/bin/ffmpeg

# CDN Configuration
CDN_TYPE=push
CDN_ORIGIN_IP=x.x.x.111
CDN_EDGE_SERVERS=x.x.x.EDGE1,x.x.x.EDGE2,x.x.x.EDGE3,x.x.x.EDGE4
```

**⚠️ REPLACE:** Edge server IPs with actual IPs (comma-separated)

---

### Step 1.8: Start Backend Service

```bash
# Check if backend is running
sudo systemctl status pakstream-backend

# If not running, start it
cd ~/projects/PakStream/backend
npm start

# Or if using systemd service
sudo systemctl start pakstream-backend
sudo systemctl enable pakstream-backend
```

---

## 📋 PART 2: EDGE SERVER CONFIGURATION

**Repeat these steps on EACH edge server**

---

### Step 2.1: Get Edge Server IP

**On Edge Server:**

```bash
hostname -I
# Write down this IP: x.x.x._____
```

---

### Step 2.2: Install Nginx (if not installed)

```bash
# Check if installed
nginx -v

# If not, install from offline packages or apt
sudo apt-get update
sudo apt-get install -y nginx
```

---

### Step 2.3: Setup SSH Server

**On Edge Server:**

```bash
# Install SSH server (if not installed)
sudo apt-get install -y openssh-server

# Start and enable SSH
sudo systemctl start ssh
sudo systemctl enable ssh

# Allow SSH through firewall
sudo ufw allow 22/tcp
sudo ufw reload

# Check status
sudo systemctl status ssh
```

---

### Step 2.4: Create Storage Directory

**On Edge Server:**

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

### Step 2.5: Create User for File Transfer

**On Edge Server:**

```bash
# Create user named "edgeuser"
sudo adduser edgeuser
# Set password when prompted (e.g., EdgePass123!)

# Add to www-data group
sudo usermod -aG www-data edgeuser

# Verify
id edgeuser
```

---

### Step 2.6: Add Origin Server's SSH Public Key

**On Edge Server:**

```bash
# Switch to edgeuser
sudo su - edgeuser

# Create .ssh directory
mkdir -p ~/.ssh
chmod 700 ~/.ssh

# Create authorized_keys file
nano ~/.ssh/authorized_keys
```

**Paste the public key from Origin Server (from Step 1.4):**
```
ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQDxxxxxx... user@origin
```

**Save:** `Ctrl+O`, `Enter`, `Ctrl+X`

```bash
# Set permissions
chmod 600 ~/.ssh/authorized_keys

# Exit back to your user
exit
```

---

### Step 2.7: Test SSH Connection from Origin

**On Origin Server (x.x.x.111):**

```bash
# Test SSH connection (replace with edge server IP)
ssh -i ~/.ssh/edge_push_key edgeuser@x.x.x.EDGE_IP

# If asked "Are you sure you want to continue connecting?", type: yes

# If successful, you'll be logged into edge server
# Type: exit
```

**✅ If connection works, proceed. If not, check:**
- SSH service running on edge server
- Firewall allows port 22
- Public key correctly added to authorized_keys
- Permissions on ~/.ssh/authorized_keys (should be 600)

---

### Step 2.8: Configure Nginx on Edge Server

**On Edge Server:**

```bash
# Create Nginx config
sudo nano /etc/nginx/sites-available/edge-server
```

**Paste this configuration:**

```nginx
# PakStream Edge Server Configuration
# Edge Server IP: x.x.x.EDGE_IP

server {
    listen 80;
    listen [::]:80;
    server_name _;

    # Maximum body size
    client_max_body_size 2G;

    # Health check
    location /health {
        return 200 "Edge server healthy - Push-based CDN\n";
        add_header Content-Type text/plain;
    }

    # Serve videos from local storage (pushed from origin)
    location /uploads/videos/ {
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
        add_header X-Served-From "Edge-Server";
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

**Enable and test:**

```bash
# Enable site
sudo ln -sf /etc/nginx/sites-available/edge-server /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# If successful, reload
sudo systemctl reload nginx
sudo systemctl enable nginx

# Test health check
curl http://localhost/health
# Should return: "Edge server healthy - Push-based CDN"
```

---

### Step 2.9: Configure Firewall

**On Edge Server:**

```bash
# Allow HTTP through firewall
sudo ufw allow 80/tcp
sudo ufw reload

# Check firewall status
sudo ufw status
```

---

### Step 2.10: Verify Edge Server Ready

**Test from edge server itself:**
```bash
curl http://localhost/health
# Expected: "Edge server healthy - Push-based CDN"
```

**Test from origin server:**
```bash
curl http://x.x.x.EDGE_IP/health
# Expected: "Edge server healthy - Push-based CDN"
```

**✅ Edge server is ready!**

**Repeat Steps 2.1-2.10 for each additional edge server.**

---

## 📋 PART 3: ACTIVATE PUSH-BASED CDN

### Step 3.1: Update lsyncd Configuration

**On Origin Server (x.x.x.111):**

```bash
# Edit lsyncd config
sudo nano /etc/lsyncd/lsyncd.conf.lua
```

**Uncomment sync blocks for each edge server you've configured.**

**Example for 2 edge servers:**
```lua
-- Edge Server 1
sync {
    default.rsync,
    source = "/home/username/projects/PakStream/backend/uploads/videos/processed/",
    target = "edgeuser@x.x.x.EDGE1:/var/www/edge-storage/videos/processed/",
    delay = 5,
    rsync = {
        archive = true,
        compress = true,
        perms = true,
        owner = false,
        group = false,
        rsh = "/usr/bin/ssh -i /home/username/.ssh/edge_push_key -o StrictHostKeyChecking=no"
    }
}

-- Edge Server 2
sync {
    default.rsync,
    source = "/home/username/projects/PakStream/backend/uploads/videos/processed/",
    target = "edgeuser@x.x.x.EDGE2:/var/www/edge-storage/videos/processed/",
    delay = 5,
    rsync = {
        archive = true,
        compress = true,
        perms = true,
        owner = false,
        group = false,
        rsh = "/usr/bin/ssh -i /home/username/.ssh/edge_push_key -o StrictHostKeyChecking=no"
    }
}
```

---

### Step 3.2: Start lsyncd Service

**On Origin Server (x.x.x.111):**

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

### Step 3.3: Test File Push

**On Origin Server (x.x.x.111):**

```bash
# Create a test file
touch ~/projects/PakStream/backend/uploads/videos/processed/test-file.txt

# Wait 5-10 seconds (lsyncd delay)

# Check if file appears on edge server
ssh -i ~/.ssh/edge_push_key edgeuser@x.x.x.EDGE_IP "ls -la /var/www/edge-storage/videos/processed/"

# If test-file.txt appears, push is working! ✅
```

---

### Step 3.4: Test Video Distribution

1. **Upload a test video** through PakStream frontend (on origin server)
2. **Wait for processing** to complete
3. **Check edge servers** for processed video files:

```bash
# On each edge server
ls -la /var/www/edge-storage/videos/processed/

# Should see video directories with HLS files
# Example: 6966135dfd2c90a8d20a1c53/hls/master.m3u8
```

---

## 📋 PART 4: FRONTEND CONFIGURATION

### Step 4.1: Update Frontend to Use Edge Servers

**On Origin Server (x.x.x.111):**

```bash
cd ~/projects/PakStream/frontend
nano .env
```

**Configure for edge server access:**

```env
# Use edge server IPs for video serving
# Users will access edge servers, not origin

# For API calls (still goes to origin)
REACT_APP_API_URL=http://x.x.x.111:5000/api
REACT_APP_SOCKET_URL=http://x.x.x.111:5000

# Edge server IPs (comma-separated)
REACT_APP_EDGE_SERVERS=x.x.x.EDGE1,x.x.x.EDGE2,x.x.x.EDGE3,x.x.x.EDGE4
```

**Rebuild frontend:**

```bash
npm run build
```

---

## 🔍 VERIFICATION & TESTING

### Test 1: Health Checks

```bash
# Origin server
curl http://x.x.x.111/health
# Expected: "Origin server healthy - Push-based CDN active"

# Edge servers
curl http://x.x.x.EDGE1/health
curl http://x.x.x.EDGE2/health
# Expected: "Edge server healthy - Push-based CDN"
```

### Test 2: File Push

```bash
# On origin: Create test file
echo "test" > ~/projects/PakStream/backend/uploads/videos/processed/test.txt

# Wait 5 seconds

# On edge: Check if file exists
ssh -i ~/.ssh/edge_push_key edgeuser@x.x.x.EDGE_IP "cat /var/www/edge-storage/videos/processed/test.txt"
# Expected: "test"
```

### Test 3: Video Access

```bash
# Upload video through PakStream
# Wait for processing

# Check origin has files
ls -la ~/projects/PakStream/backend/uploads/videos/processed/[VIDEO_ID]/hls/

# Check edge has files
ssh -i ~/.ssh/edge_push_key edgeuser@x.x.x.EDGE_IP "ls -la /var/www/edge-storage/videos/processed/[VIDEO_ID]/hls/"

# Access video from edge server
curl -I http://x.x.x.EDGE_IP/uploads/videos/processed/[VIDEO_ID]/hls/master.m3u8
# Expected: HTTP 200 OK
```

### Test 4: HLS Streaming

```bash
# Test HLS playlist access
curl http://x.x.x.EDGE_IP/uploads/videos/processed/[VIDEO_ID]/hls/master.m3u8

# Should return HLS playlist content
```

---

## 🐛 TROUBLESHOOTING

### Issue: SSH Connection Fails

**Symptoms:** `Permission denied` or `Connection refused`

**Solutions:**
```bash
# On edge server
sudo systemctl status ssh
sudo ufw status
sudo tail -f /var/log/auth.log

# Check authorized_keys permissions
sudo su - edgeuser
ls -la ~/.ssh/
chmod 600 ~/.ssh/authorized_keys
```

### Issue: lsyncd Not Pushing Files

**Symptoms:** Files not appearing on edge servers

**Solutions:**
```bash
# Check lsyncd status
sudo systemctl status lsyncd
sudo tail -f /var/log/lsyncd/lsyncd.log

# Test SSH manually
ssh -i ~/.ssh/edge_push_key edgeuser@x.x.x.EDGE_IP

# Verify source directory
ls -la ~/projects/PakStream/backend/uploads/videos/processed/

# Restart lsyncd
sudo systemctl restart lsyncd
```

### Issue: Nginx Not Serving Files

**Symptoms:** 404 errors when accessing videos

**Solutions:**
```bash
# Check Nginx status
sudo systemctl status nginx
sudo nginx -t

# Check file permissions
ls -la /var/www/edge-storage/videos/processed/

# Verify Nginx can read files
sudo -u www-data ls /var/www/edge-storage/videos/processed/

# Check Nginx error logs
sudo tail -f /var/log/nginx/error.log
```

### Issue: Files Not Syncing in Real-Time

**Solutions:**
```bash
# Reduce lsyncd delay
sudo nano /etc/lsyncd/lsyncd.conf.lua
# Change: delay = 5  to  delay = 1

# Restart lsyncd
sudo systemctl restart lsyncd
```

---

## ✅ CHECKLIST

### Origin Server (x.x.x.111)
- [ ] lsyncd installed and configured
- [ ] SSH keys generated and public key copied to edge servers
- [ ] Nginx configured and running
- [ ] Backend running on port 5000
- [ ] Can SSH to edge servers without password
- [ ] lsyncd service running and pushing files

### Edge Servers (Each)
- [ ] Nginx installed and configured
- [ ] SSH server running
- [ ] Storage directories created (`/var/www/edge-storage/`)
- [ ] `edgeuser` created and SSH key added
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

### Check File Distribution

```bash
# On origin: Count files
find ~/projects/PakStream/backend/uploads/videos/processed -type f | wc -l

# On edge: Count files
find /var/www/edge-storage/videos/processed -type f | wc -l

# Should match (or edge should have more if multiple videos)
```

### Check Nginx Logs

```bash
# Origin server
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Edge server
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

---

## 🎯 SUMMARY

### How It Works

1. **User uploads video** → Origin server (x.x.x.111) receives it
2. **Origin processes video** → FFmpeg creates HLS files
3. **lsyncd detects new files** → Automatically pushes to all edge servers via SSH
4. **Edge servers receive files** → Store in `/var/www/edge-storage/`
5. **Users access videos** → Request goes to edge server (not origin)
6. **Edge server serves files** → From local storage (fast!)

### Key Points

- ✅ Origin server processes and pushes (NOT accessed by users)
- ✅ Edge servers receive and serve (accessed by users)
- ✅ All communication via SSH (secure)
- ✅ Automatic file synchronization (no manual copying)
- ✅ Works completely offline (airgapped systems)
- ✅ Scalable (add more edge servers easily)

---

**Configuration Complete!** 🎉

Your push-based CDN is now configured and ready to distribute videos to edge servers automatically.

