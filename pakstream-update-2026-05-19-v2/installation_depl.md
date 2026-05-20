# Airgapped Native Deployment Guide (Without Docker)

Complete step-by-step guide for deploying PakStream on an airgapped system without Docker.

---

## ≡ƒôï Table of Contents

1. [Prerequisites (Prepare on Internet-Connected Machine)](#prerequisites-prepare-on-internet-connected-machine)
2. [Installation on Airgapped Machine](#installation-on-airgapped-machine)
3. [Configuration](#configuration)
4. [Service Management](#service-management)
5. [Maintenance](#maintenance)
6. [Troubleshooting](#troubleshooting)

---

## Prerequisites (Prepare on Internet-Connected Machine)

Before deploying in an airgapped environment, prepare all required packages and files on a machine with internet access.

### 1. Download Required Software Packages

#### Node.js (v18+)
```bash
# Download Node.js binary for Linux x64
# Visit: https://nodejs.org/dist/v20.19.2/
# Download: node-v20.19.2-linux-x64.tar.xz
# Or use NVM to prepare offline installation
```

**Direct Download Links:**
- Node.js v20.19.2: `https://nodejs.org/dist/v20.19.2/node-v20.19.2-linux-x64.tar.xz`
- Verify checksum: `https://nodejs.org/dist/v20.19.2/SHASUMS256.txt`

#### MongoDB
```bash
# Download MongoDB Community Server
# Visit: https://www.mongodb.com/try/download/community
# Download: mongodb-linux-x86_64-ubuntu2204-7.0.15.tgz
# Or specific version: mongodb-linux-x86_64-<distro>-<version>.tgz
```

**Direct Download Links:**
- MongoDB 7.0: `https://fastdl.mongodb.org/linux/mongodb-linux-x86_64-ubuntu2204-7.0.15.tgz`
- Check for latest version: `https://www.mongodb.com/try/download/community`

#### MinIO Binary
```bash
# Download MinIO server binary
# Visit: https://dl.min.io/server/minio/release/linux-amd64/
# Download: minio (binary file)
# Also download MinIO client (mc)
# Visit: https://dl.min.io/client/mc/release/linux-amd64/
# Download: mc (binary file)
```

**Direct Download Commands:**
```bash
# MinIO Server
wget https://dl.min.io/server/minio/release/linux-amd64/minio
chmod +x minio

# MinIO Client
wget https://dl.min.io/client/mc/release/linux-amd64/mc
chmod +x mc
```

#### System Packages (Debian/Ubuntu)
```bash
# On internet-connected machine, download packages:
mkdir -p offline-packages
cd offline-packages

# Download FFmpeg and dependencies
apt-get download ffmpeg libavcodec58 libavformat58 libavutil56 libswscale5 libavresample4

# Download LibreOffice (for presentations)
apt-get download libreoffice libreoffice-core libreoffice-writer libreoffice-impress

# Download ImageMagick (for presentation processing)
apt-get download imagemagick libmagickwand-6.q16-6 libmagickcore-6.q16-6

# Download Poppler-utils (alternative PDF converter)
apt-get download poppler-utils

# Download Nginx (web server)
apt-get download nginx

# Download all dependencies recursively
apt-get download $(apt-cache depends ffmpeg libreoffice imagemagick poppler-utils nginx | grep "Depends:" | cut -d: -f2 | tr -d ' ' | sort -u)

# Create a package list
dpkg-scanpackages . /dev/null | gzip -9c > Packages.gz

# Create tar archive
cd ..
tar -czf system-packages.tar.gz offline-packages/
```

#### NPM Packages
```bash
# On internet-connected machine
cd PakStream

# Backend packages
cd backend
npm install --production
tar -czf ../backend-node_modules.tar.gz node_modules/
cd ..

# Frontend packages
cd frontend
npm install
tar -czf ../frontend-node_modules.tar.gz node_modules/
cd ..

# Also create npm cache for offline installation (optional)
npm cache clean --force
npm install --cache ../npm-cache --production
tar -czf npm-cache.tar.gz ../npm-cache/
```

### 2. Prepare Source Code
```bash
# Create deployment package
tar -czf pakstream-source.tar.gz \
  PakStream/ \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='*.log' \
  --exclude='build'
```

### 3. Transfer to Airgapped Machine

Transfer these files to the airgapped machine via USB drive, network share, or other method:

**Required Files:**
- `node-v20.19.2-linux-x64.tar.xz` - Node.js runtime
- `mongodb-linux-x86_64-ubuntu2204-7.0.15.tgz` - MongoDB database
- `minio` - MinIO server binary
- `mc` - MinIO client binary
- `system-packages.tar.gz` - System dependencies
- `backend-node_modules.tar.gz` - Backend npm packages
- `frontend-node_modules.tar.gz` - Frontend npm packages
- `npm-cache.tar.gz` - NPM cache (optional)
- `pakstream-source.tar.gz` - Application source code

**File Size Estimates:**
- Node.js: ~50MB
- MongoDB: ~200MB
- MinIO: ~50MB
- System packages: ~500MB-1GB
- NPM packages: ~200-500MB
- Source code: ~10-50MB
- **Total: ~1-2GB**

---

## Installation on Airgapped Machine

### Step 1: Install System Dependencies

#### Install Node.js
```bash
# Extract Node.js
cd /opt
sudo tar -xf node-v20.19.2-linux-x64.tar.xz
sudo mv node-v20.19.2-linux-x64 nodejs

# Create symlinks
sudo ln -sf /opt/nodejs/bin/node /usr/local/bin/node
sudo ln -sf /opt/nodejs/bin/npm /usr/local/bin/npm
sudo ln -sf /opt/nodejs/bin/npx /usr/local/bin/npx

# Add to PATH for current session
export PATH=/opt/nodejs/bin:$PATH

# Add to PATH permanently (add to ~/.bashrc or /etc/profile)
echo 'export PATH=/opt/nodejs/bin:$PATH' | sudo tee -a /etc/profile
source /etc/profile

# Verify installation
node --version  # Should show v20.19.2
npm --version   # Should show 10.x.x
```

#### Install System Packages
```bash
# Extract packages
cd /tmp
tar -xzf system-packages.tar.gz
cd offline-packages

# Install packages
sudo dpkg -i *.deb

# Fix any missing dependencies (if needed)
sudo dpkg -i --force-depends *.deb 2>/dev/null || true

# Fix broken dependencies
sudo apt-get install -f -y 2>/dev/null || echo "Note: Some packages may need manual dependency resolution"

# Verify installations
ffmpeg -version
libreoffice --version
convert -version  # ImageMagick
pdftoppm -v  # Poppler-utils
nginx -v
```

#### Install MongoDB
```bash
# Extract MongoDB
cd /opt
sudo tar -xzf mongodb-linux-x86_64-ubuntu2204-7.0.15.tgz
sudo mv mongodb-linux-x86_64-ubuntu2204-7.0.15 mongodb

# Create data directory
sudo mkdir -p /data/db
sudo chown -R $USER:$USER /data/db

# Create MongoDB service file
sudo tee /etc/systemd/system/mongod.service > /dev/null <<EOF
[Unit]
Description=MongoDB Database Server
Documentation=https://docs.mongodb.org/manual
After=network.target

[Service]
User=$USER
Group=$USER
ExecStart=/opt/mongodb/bin/mongod --dbpath /data/db --bind_ip 127.0.0.1
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# Start MongoDB
sudo systemctl daemon-reload
sudo systemctl enable mongod
sudo systemctl start mongod

# Wait for MongoDB to start
sleep 5

# Verify MongoDB is running
sudo systemctl status mongod
/opt/mongodb/bin/mongod --version
```

#### Install MinIO
```bash
# Copy MinIO binary
sudo cp minio /usr/local/bin/
sudo chmod +x /usr/local/bin/minio

# Copy MinIO client
sudo cp mc /usr/local/bin/
sudo chmod +x /usr/local/bin/mc

# Create MinIO data directory
sudo mkdir -p /data/minio
sudo chown -R $USER:$USER /data/minio

# Create MinIO service file
sudo tee /etc/systemd/system/minio.service > /dev/null <<EOF
[Unit]
Description=MinIO Object Storage
After=network.target

[Service]
Type=simple
User=$USER
Group=$USER
Environment="MINIO_ROOT_USER=minioadmin"
Environment="MINIO_ROOT_PASSWORD=minioadmin"
ExecStart=/usr/local/bin/minio server /data/minio --console-address ":9001"
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# Start MinIO
sudo systemctl daemon-reload
sudo systemctl enable minio
sudo systemctl start minio

# Wait for MinIO to start
sleep 10

# Verify MinIO is running
sudo systemctl status minio
curl http://localhost:9000/minio/health/live

# Initialize bucket (after MinIO starts)
mc alias set myminio http://localhost:9000 minioadmin minioadmin
mc mb myminio/pakstream-videos
mc anonymous set download myminio/pakstream-videos  # Optional: make bucket public for downloads
```

---

### Step 1b: Time Sync (CRITICAL on airgapped Ubuntu)

Without internet, `systemd-timesyncd` can't reach an NTP server, so the VM
clock drifts. If the server's clock falls behind the clients' clocks, every
**scheduled** premiere appears "starting…" on the client (countdown hits
zero) while the server still thinks it's in the future — viewers get stuck
on a "waiting for the server to go live" screen.

#### Option A: Manual one-shot set (no NTP source available)

```bash
# Verify current drift
timedatectl status

# Set the system clock from a trusted device (use the exact UTC time)
sudo timedatectl set-time '2026-05-19 14:30:00'

# Make sure timezone is right too
sudo timedatectl set-timezone Asia/Karachi   # adjust as needed
```

Re-check daily; expect a few seconds of drift per day on most VMs.

#### Option B: Local NTP peer (recommended for permanent installs)

If there's any host on the airgapped LAN that has a reliable RTC (e.g. a
domain controller, a router, or another server you control), point chrony
at it:

```bash
# Install chrony from your offline package set
sudo dpkg -i chrony_*.deb

# Configure it to use the LAN peer
sudo tee /etc/chrony/chrony.conf > /dev/null <<EOF
# Peer with the LAN time source — replace 192.168.1.10 with your host
server 192.168.1.10 iburst prefer

# Allow the local clock to be a fallback
local stratum 10
makestep 1.0 3
EOF

sudo systemctl enable --now chrony
chronyc tracking   # should show a small offset and "Leap status: Normal"
```

After fixing the clock, restart the backend and refresh any open clients.

---

### Step 2: Install Application

#### Extract Source Code
```bash
cd /opt
sudo tar -xzf pakstream-source.tar.gz
sudo chown -R $USER:$USER PakStream
cd PakStream

# Extract node_modules
cd backend
tar -xzf ../../backend-node_modules.tar.gz
cd ../frontend
tar -xzf ../../frontend-node_modules.tar.gz
cd ..
```

#### Create Required Directories
```bash
# Backend uploads
mkdir -p backend/uploads/videos/original
mkdir -p backend/uploads/videos/processed
mkdir -p backend/uploads/presentations/original
mkdir -p backend/uploads/presentations/processed
mkdir -p backend/uploads/documents/original
mkdir -p backend/uploads/documents/processed
mkdir -p backend/uploads/documents/temp

# Set permissions
chmod -R 755 backend/uploads
```

---

### Step 3: Configure Environment

#### Backend Configuration
```bash
cd /opt/PakStream/backend

# Create .env file
cat > .env <<EOF
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
STORAGE_TYPE=minio
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET_NAME=pakstream-videos

# FFmpeg
FFMPEG_PATH=/usr/bin/ffmpeg
EOF

# Verify FFmpeg path
which ffmpeg  # Should show /usr/bin/ffmpeg
```

**Important:** Change the following values in production:
- `JWT_SECRET` - Use a strong random string
- `MINIO_ROOT_USER` and `MINIO_ACCESS_KEY` - Use secure credentials
- `MINIO_ROOT_PASSWORD` and `MINIO_SECRET_KEY` - Use secure passwords
- `ADMIN_REGISTRATION_KEY` - Use a secure admin registration key

#### Frontend Configuration

**Recommended (production behind Nginx):** leave the API URL unset so the
React bundle uses **same-origin** requests (`/api`, `/socket.io`). Nginx
will proxy these to the backend on `localhost:5000`. This makes the build
portable across any hostname/IP the LAN reaches the box on, and avoids
opening port `5000` directly to clients.

```bash
cd /opt/PakStream/frontend

# Create an empty .env (no REACT_APP_API_URL / REACT_APP_SOCKET_URL).
# The bundle will hit /api on whatever host serves the page.
: > .env
```

**Only if you intentionally bypass Nginx** (e.g. you serve the React build
straight from CRA in development, or you want clients to hit port 5000
directly): set the variables to the absolute backend URL. Remember the
values are baked in at build time; if the URL changes, you must rebuild.

```bash
# Optional: hardcode a backend URL. Bundle won't work on other hostnames.
SERVER_IP=$(hostname -I | awk '{print $1}')
cat > .env <<EOF
REACT_APP_API_URL=http://${SERVER_IP}:5000/api
REACT_APP_SOCKET_URL=http://${SERVER_IP}:5000
EOF
```

#### Build Frontend
```bash
cd /opt/PakStream/frontend

# Build React app (this may take 5-10 minutes)
npm run build

# Verify build
ls -la build/  # Should contain index.html and static/
```

---

### Step 4: Install and Configure Nginx

#### Configure Nginx
```bash
# Create Nginx configuration
sudo tee /etc/nginx/sites-available/pakstream > /dev/null <<EOF
server {
    listen 80;
    server_name _;  # Replace with your domain if available

    # Increase client body size for video uploads
    client_max_body_size 2G;

    # Frontend
    root /opt/PakStream/frontend/build;
    index index.html;

    # Frontend routes
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Backend API proxy
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # Increase timeouts for video uploads
        proxy_read_timeout 300s;
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
    }

    # Socket.IO proxy
    location /socket.io/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }

    # Video files (if using local storage)
    location /uploads/ {
        alias /opt/PakStream/backend/uploads/;
        add_header Access-Control-Allow-Origin *;
        add_header Access-Control-Allow-Methods "GET, HEAD, OPTIONS";
        add_header Cache-Control "public, max-age=31536000, immutable";
    }
}
EOF

# Enable site
sudo ln -sf /etc/nginx/sites-available/pakstream /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default  # Remove default if exists

# Test configuration
sudo nginx -t

# Start Nginx
sudo systemctl enable nginx
sudo systemctl start nginx

# Verify Nginx is running
sudo systemctl status nginx
```

---

### Step 5: Create Systemd Services

#### Backend Service
```bash
sudo tee /etc/systemd/system/pakstream-backend.service > /dev/null <<EOF
[Unit]
Description=PakStream Backend API
After=mongod.service minio.service network.target
Requires=mongod.service

[Service]
Type=simple
User=$USER
Group=$USER
WorkingDirectory=/opt/PakStream/backend
Environment="NODE_ENV=production"
Environment="PATH=/usr/local/bin:/usr/bin:/bin:/opt/nodejs/bin"
ExecStart=/opt/nodejs/bin/node src/server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

# Security settings
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

# Start backend
sudo systemctl daemon-reload
sudo systemctl enable pakstream-backend
sudo systemctl start pakstream-backend

# Check status
sudo systemctl status pakstream-backend
```

---

### Step 6: Verify Deployment

#### Check All Services
```bash
# MongoDB
sudo systemctl status mongod
/opt/mongodb/bin/mongo --eval "db.version()"  # Should show MongoDB version

# MinIO
sudo systemctl status minio
curl http://localhost:9000/minio/health/live  # Should return 200 OK

# Backend
sudo systemctl status pakstream-backend
curl http://localhost:5000/api/videos  # Should return JSON response

# Nginx
sudo systemctl status nginx
curl http://localhost/  # Should return HTML
```

#### Check Logs
```bash
# Backend logs
sudo journalctl -u pakstream-backend -n 50 --no-pager

# MongoDB logs
sudo journalctl -u mongod -n 50 --no-pager

# MinIO logs
sudo journalctl -u minio -n 50 --no-pager

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

#### Test Application
```bash
# Test backend API
curl http://localhost:5000/api/videos

# Test frontend
curl http://localhost/

# Test MinIO console (if accessible)
curl http://localhost:9001
```

---

## Firewall Configuration

```bash
# Allow required ports
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 5000/tcp   # Backend API (if needed externally)
sudo ufw allow 9000/tcp   # MinIO API (if needed externally)
sudo ufw allow 9001/tcp   # MinIO Console (if needed externally)
sudo ufw enable

# Check firewall status
sudo ufw status
```

---

## Service Management

### Start/Stop Services

```bash
# Backend
sudo systemctl start pakstream-backend
sudo systemctl stop pakstream-backend
sudo systemctl restart pakstream-backend
sudo systemctl status pakstream-backend

# MongoDB
sudo systemctl start mongod
sudo systemctl stop mongod
sudo systemctl restart mongod
sudo systemctl status mongod

# MinIO
sudo systemctl start minio
sudo systemctl stop minio
sudo systemctl restart minio
sudo systemctl status minio

# Nginx
sudo systemctl start nginx
sudo systemctl stop nginx
sudo systemctl restart nginx
sudo systemctl status nginx
```

### View Logs

```bash
# Backend logs (real-time)
sudo journalctl -u pakstream-backend -f

# Backend logs (last 100 lines)
sudo journalctl -u pakstream-backend -n 100

# MongoDB logs
sudo journalctl -u mongod -f

# MinIO logs
sudo journalctl -u minio -f

# Nginx access logs
sudo tail -f /var/log/nginx/access.log

# Nginx error logs
sudo tail -f /var/log/nginx/error.log
```

---

## Maintenance

### Backup Procedures

#### MongoDB Backup
```bash
# Create backup directory
mkdir -p /backup/mongodb

# Backup MongoDB
/opt/mongodb/bin/mongodump --out /backup/mongodb/$(date +%Y%m%d-%H%M%S)

# Restore MongoDB (if needed)
# /opt/mongodb/bin/mongorestore /backup/mongodb/YYYYMMDD-HHMMSS
```

#### MinIO Backup
```bash
# Create backup directory
mkdir -p /backup/minio

# Backup MinIO bucket
mc mirror myminio/pakstream-videos /backup/minio/$(date +%Y%m%d-%H%M%S)

# Restore MinIO (if needed)
# mc mirror /backup/minio/YYYYMMDD-HHMMSS myminio/pakstream-videos
```

#### Application Files Backup
```bash
# Backup uploads directory (if using local storage)
mkdir -p /backup/uploads
tar -czf /backup/uploads/uploads-$(date +%Y%m%d-%H%M%S).tar.gz /opt/PakStream/backend/uploads/

# Backup configuration files
mkdir -p /backup/config
cp /opt/PakStream/backend/.env /backup/config/backend.env.$(date +%Y%m%d)
cp /opt/PakStream/frontend/.env /backup/config/frontend.env.$(date +%Y%m%d)
cp /etc/nginx/sites-available/pakstream /backup/config/nginx.$(date +%Y%m%d)
```

#### Automated Backup Script
```bash
# Create backup script
sudo tee /usr/local/bin/pakstream-backup.sh > /dev/null <<'EOF'
#!/bin/bash
BACKUP_DIR="/backup/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

# MongoDB backup
/opt/mongodb/bin/mongodump --out "$BACKUP_DIR/mongodb"

# MinIO backup
mc mirror myminio/pakstream-videos "$BACKUP_DIR/minio"

# Application files backup
tar -czf "$BACKUP_DIR/uploads.tar.gz" /opt/PakStream/backend/uploads/

# Configuration backup
mkdir -p "$BACKUP_DIR/config"
cp /opt/PakStream/backend/.env "$BACKUP_DIR/config/"
cp /opt/PakStream/frontend/.env "$BACKUP_DIR/config/"
cp /etc/nginx/sites-available/pakstream "$BACKUP_DIR/config/"

echo "Backup completed: $BACKUP_DIR"
EOF

sudo chmod +x /usr/local/bin/pakstream-backup.sh

# Add to crontab for daily backups (runs at 2 AM)
(crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/pakstream-backup.sh") | crontab -
```

### Update Application

```bash
# Stop services
sudo systemctl stop pakstream-backend

# Backup current version
sudo cp -r /opt/PakStream /opt/PakStream.backup.$(date +%Y%m%d)

# Extract new version
cd /opt
sudo tar -xzf pakstream-source-new.tar.gz
sudo chown -R $USER:$USER PakStream

# Update node_modules if needed
cd PakStream/backend
tar -xzf ../../backend-node_modules.tar.gz
cd ../frontend
tar -xzf ../../frontend-node_modules.tar.gz
npm run build
cd ..

# Restart services
sudo systemctl start pakstream-backend
sudo systemctl restart nginx

# Verify update
sudo systemctl status pakstream-backend
curl http://localhost:5000/api/videos
```

### Cleanup Old Backups

```bash
# Remove backups older than 30 days
find /backup -type d -mtime +30 -exec rm -rf {} \;
find /backup -type f -mtime +30 -delete
```

---

## Troubleshooting

### Backend "stops abruptly" mid-session (systemd restarts it)

The backend has process-level handlers that log unhandled rejections and
keep running, but `uncaughtException` still triggers a clean exit so
systemd can restart in a known-good state. If you see this happening,
check **why** the process died — the cause is rarely Node-internal:

```bash
# Was it an OOM kill? (most common on small/medium VMs)
journalctl -k --since today | grep -iE 'oom|killed process'
dmesg | grep -iE 'oom|killed process'

# Was it a real exception?
sudo journalctl -u pakstream-backend --since '1 hour ago' | grep -E 'Uncaught|Unhandled' -A 5

# Memory headroom right now
free -h
top -b -n 1 | head -20
```

If OOM keeps killing Node:
- Bump VM RAM to **8 GB minimum** (4 GB is too tight once ffmpeg/LibreOffice
  spawn — both peak at 1–2 GB each per asset processed).
- Or stagger video processing (don't upload multiple large files at once).
- Or run MinIO and Mongo on a second VM if you have one.

If Mongo is the cause (`disconnected` log just before the crash), check:

```bash
sudo systemctl status mongod
sudo journalctl -u mongod -n 100 --no-pager
df -h    # /data/db full?
```

### Backend Won't Start

```bash
# Check logs
sudo journalctl -u pakstream-backend -n 100 --no-pager

# Check Node.js installation
node --version
which node
ls -la /opt/nodejs/bin/node

# Check MongoDB connection
/opt/mongodb/bin/mongo mongodb://localhost:27017/pakstream --eval "db.stats()"

# Check MinIO connection
curl http://localhost:9000/minio/health/live
mc alias list

# Check file permissions
ls -la /opt/PakStream/backend/
ls -la /opt/PakStream/backend/uploads/

# Check environment variables
cat /opt/PakStream/backend/.env

# Test manual start
cd /opt/PakStream/backend
node src/server.js
```

### Frontend Not Loading

```bash
# Check Nginx configuration
sudo nginx -t

# Check Nginx status
sudo systemctl status nginx

# Check build files exist
ls -la /opt/PakStream/frontend/build/

# Check Nginx error log
sudo tail -50 /var/log/nginx/error.log

# Check Nginx access log
sudo tail -50 /var/log/nginx/access.log

# Test Nginx configuration
sudo nginx -T | grep -A 20 "server_name"
```

### MinIO Issues

```bash
# Check MinIO status
sudo systemctl status minio

# Check MinIO logs
sudo journalctl -u minio -n 50 --no-pager

# Check bucket exists
mc ls myminio/

# Recreate bucket if needed
mc mb myminio/pakstream-videos --ignore-existing

# Check MinIO data directory
ls -la /data/minio/

# Test MinIO connection
curl http://localhost:9000/minio/health/live
```

### MongoDB Issues

```bash
# Check MongoDB status
sudo systemctl status mongod

# Check MongoDB logs
sudo journalctl -u mongod -n 50 --no-pager

# Check data directory
ls -la /data/db/

# Test MongoDB connection
/opt/mongodb/bin/mongo --eval "db.version()"

# Check MongoDB process
ps aux | grep mongod
```

### Video Processing Issues

```bash
# Check FFmpeg installation
ffmpeg -version
which ffmpeg

# Test FFmpeg
ffmpeg -f lavfi -i testsrc=duration=1:size=320x240:rate=1 test.mp4

# Check FFmpeg path in environment
grep FFMPEG_PATH /opt/PakStream/backend/.env

# Check video processing logs
sudo journalctl -u pakstream-backend | grep -i ffmpeg
```

### Port Conflicts

```bash
# Check which ports are in use
sudo netstat -tulpn | grep -E ':(80|5000|9000|9001|27017)'

# Check what's using a specific port
sudo lsof -i :5000
sudo lsof -i :80
sudo lsof -i :9000
```

### Permission Issues

```bash
# Fix ownership
sudo chown -R $USER:$USER /opt/PakStream
sudo chown -R $USER:$USER /data/db
sudo chown -R $USER:$USER /data/minio

# Fix permissions
chmod -R 755 /opt/PakStream/backend/uploads
chmod +x /usr/local/bin/minio
chmod +x /usr/local/bin/mc
```

---

## Security Considerations

### Change Default Credentials

```bash
# Change MinIO credentials
sudo systemctl stop minio
sudo nano /etc/systemd/system/minio.service
# Update MINIO_ROOT_USER and MINIO_ROOT_PASSWORD
sudo systemctl daemon-reload
sudo systemctl start minio

# Update backend .env
nano /opt/PakStream/backend/.env
# Update MINIO_ACCESS_KEY and MINIO_SECRET_KEY to match

# Change JWT secret
nano /opt/PakStream/backend/.env
# Update JWT_SECRET to a strong random string

# Change admin registration key
nano /opt/PakStream/backend/.env
# Update ADMIN_REGISTRATION_KEY
```

### Firewall Configuration

```bash
# Only allow necessary ports
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 80/tcp
sudo ufw allow 22/tcp  # SSH
sudo ufw enable
```

### MongoDB Security

```bash
# Enable MongoDB authentication (recommended)
# Edit MongoDB service file
sudo nano /etc/systemd/system/mongod.service
# Add: --auth flag to ExecStart

# Create admin user
/opt/mongodb/bin/mongo admin --eval "db.createUser({user: 'admin', pwd: 'secure-password', roles: ['root']})"

# Update MONGODB_URI in backend/.env
# mongodb://admin:secure-password@localhost:27017/pakstream
```

---

## Performance Optimization

### Increase File Limits

```bash
# Increase file descriptor limits
sudo tee -a /etc/security/limits.conf > /dev/null <<EOF
* soft nofile 65536
* hard nofile 65536
EOF

# Apply limits
ulimit -n 65536
```

### MongoDB Optimization

```bash
# Edit MongoDB service to add performance options
sudo nano /etc/systemd/system/mongod.service
# Add to ExecStart:
# --wiredTigerCacheSizeGB 2 --wiredTigerCollectionBlockCompressor snappy
```

### Nginx Optimization

```bash
# Edit Nginx main configuration
sudo nano /etc/nginx/nginx.conf
# Add:
# worker_processes auto;
# worker_connections 1024;
```

---

## Monitoring

### Health Check Script

```bash
# Create health check script
sudo tee /usr/local/bin/pakstream-health.sh > /dev/null <<'EOF'
#!/bin/bash
echo "=== PakStream Health Check ==="
echo ""

echo "MongoDB:"
sudo systemctl is-active mongod && echo "Γ£ô Running" || echo "Γ£ù Not running"

echo ""
echo "MinIO:"
sudo systemctl is-active minio && echo "Γ£ô Running" || echo "Γ£ù Not running"

echo ""
echo "Backend:"
sudo systemctl is-active pakstream-backend && echo "Γ£ô Running" || echo "Γ£ù Not running"

echo ""
echo "Nginx:"
sudo systemctl is-active nginx && echo "Γ£ô Running" || echo "Γ£ù Not running"

echo ""
echo "API Test:"
curl -s http://localhost:5000/api/videos > /dev/null && echo "Γ£ô API responding" || echo "Γ£ù API not responding"

echo ""
echo "Frontend Test:"
curl -s http://localhost/ > /dev/null && echo "Γ£ô Frontend accessible" || echo "Γ£ù Frontend not accessible"
EOF

sudo chmod +x /usr/local/bin/pakstream-health.sh

# Run health check
/usr/local/bin/pakstream-health.sh
```

---

## Summary

This guide provides a complete native deployment solution for PakStream in an airgapped environment without Docker. The deployment includes:

Γ£à **Node.js Runtime** (v20.19.2)  
Γ£à **MongoDB Database** (v7.0)  
Γ£à **MinIO Object Storage**  
Γ£à **FFmpeg** for video processing  
Γ£à **LibreOffice** for presentations  
Γ£à **Nginx** web server  
Γ£à **Systemd services** for auto-start  
Γ£à **Complete airgapped deployment** (no internet required)

All services run as native system services and start automatically on boot.

---

## Quick Reference

### Service Management
```bash
# Start all services
sudo systemctl start mongod minio pakstream-backend nginx

# Stop all services
sudo systemctl stop pakstream-backend nginx minio mongod

# Restart all services
sudo systemctl restart mongod minio pakstream-backend nginx

# Check all services
sudo systemctl status mongod minio pakstream-backend nginx
```

### Important Directories
- Application: `/opt/PakStream`
- Backend: `/opt/PakStream/backend`
- Frontend: `/opt/PakStream/frontend`
- MongoDB data: `/data/db`
- MinIO data: `/data/minio`
- Backups: `/backup`
- Logs: `journalctl -u <service-name>`

### Important Ports
- `80` - HTTP (Nginx)
- `5000` - Backend API
- `9000` - MinIO API
- `9001` - MinIO Console
- `27017` - MongoDB

---

**Last Updated:** 2025-01-09  
**Version:** 1.0

