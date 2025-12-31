# PakStream Airgapped Installation Commands

**Complete step-by-step commands for installing PakStream on airgapped Ubuntu system**

---

## 📋 Prerequisites Checklist

Before starting, ensure you have:
- [ ] All files transferred from USB to airgapped machine
- [ ] Node.js and FFmpeg already installed (verified earlier)
- [ ] Root/sudo access
- [ ] At least 2GB free disk space

---

## 📦 STEP 1: Transfer Files from USB

```bash
# Mount USB drive (if not auto-mounted)
# Replace /dev/sdb1 with your USB device
sudo mkdir -p /mnt/usb
sudo mount /dev/sdb1 /mnt/usb

# Create working directory
mkdir -p ~/pakstream-install
cd ~/pakstream-install

# Copy files from USB
# Option 1: If you have the single deployment package
cp /mnt/usb/pakstream-deployment-package.tar.gz .
tar -xzf pakstream-deployment-package.tar.gz

# Option 2: If you copied individual files
cp /mnt/usb/*.tar.gz .
cp /mnt/usb/minio .
cp /mnt/usb/mc .

# Verify files are present
ls -lh

# Unmount USB (optional)
sudo umount /mnt/usb
```

**Expected files:**
- `mongodb-linux-x86_64-ubuntu2204-7.0.15.tgz`
- `minio` (binary)
- `mc` (binary)
- `system-packages.tar.gz`
- `backend-node_modules.tar.gz`
- `frontend-node_modules.tar.gz`
- `pakstream-source.tar.gz`

---

## 🔧 STEP 2: Install System Packages

```bash
# Extract system packages
cd ~/pakstream-install
tar -xzf system-packages.tar.gz
cd offline-packages

# Install packages
sudo dpkg -i *.deb

# Fix any missing dependencies
sudo dpkg -i --force-depends *.deb 2>/dev/null || true
sudo apt-get install -f -y 2>/dev/null || echo "Note: Some packages may need manual dependency resolution"

# Verify installations
ffmpeg -version
libreoffice --version
convert -version  # ImageMagick
pdftoppm -v  # Poppler-utils
nginx -v

cd ~/pakstream-install
```

---

## 🗄️ STEP 3: Install MongoDB

```bash
cd ~/pakstream-install

# Extract MongoDB
cd /opt
sudo tar -xzf ~/pakstream-install/mongodb-linux-x86_64-ubuntu2204-7.0.15.tgz
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

---

## 📦 STEP 4: Install MinIO

```bash
cd ~/pakstream-install

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
mc anonymous set download myminio/pakstream-videos
```

---

## 📁 STEP 5: Install Application

```bash
cd ~/pakstream-install

# Extract source code
cd /opt
sudo tar -xzf ~/pakstream-install/pakstream-source.tar.gz
sudo chown -R $USER:$USER PakStream
cd PakStream

# Extract node_modules
cd backend
tar -xzf ~/pakstream-install/backend-node_modules.tar.gz
cd ../frontend
tar -xzf ~/pakstream-install/frontend-node_modules.tar.gz
cd ..

# Create required directories
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

## ⚙️ STEP 6: Configure Environment

### Backend Configuration

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
FFMPEG_PATH=/usr/local/bin/ffmpeg
EOF

# Verify FFmpeg path (adjust if needed)
which ffmpeg
# If FFmpeg is at /usr/local/bin/ffmpeg, the path is correct
# If it's at /usr/bin/ffmpeg, update FFMPEG_PATH in .env
```

### Frontend Configuration

```bash
cd /opt/PakStream/frontend

# Get server IP address
SERVER_IP=$(hostname -I | awk '{print $1}')
echo "Server IP: $SERVER_IP"

# Create .env file
cat > .env <<EOF
REACT_APP_API_URL=http://${SERVER_IP}:5000/api
REACT_APP_SOCKET_URL=http://${SERVER_IP}:5000
EOF

# If you want to use localhost only instead:
# cat > .env <<EOF
# REACT_APP_API_URL=http://localhost:5000/api
# REACT_APP_SOCKET_URL=http://localhost:5000
# EOF
```

### Build Frontend

```bash
cd /opt/PakStream/frontend

# Build React app (this may take 5-10 minutes)
npm run build

# Verify build
ls -la build/  # Should contain index.html and static/
```

---

## 🌐 STEP 7: Configure Nginx

```bash
# Create Nginx configuration
sudo tee /etc/nginx/sites-available/pakstream > /dev/null <<EOF
server {
    listen 80;
    server_name _;

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
sudo rm -f /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# Start Nginx
sudo systemctl enable nginx
sudo systemctl start nginx

# Verify Nginx is running
sudo systemctl status nginx
```

---

## 🚀 STEP 8: Create Backend Service

```bash
# Create backend systemd service
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

## ✅ STEP 9: Verify Deployment

### Check All Services

```bash
# MongoDB
sudo systemctl status mongod
/opt/mongodb/bin/mongod --version

# MinIO
sudo systemctl status minio
curl http://localhost:9000/minio/health/live

# Backend
sudo systemctl status pakstream-backend
curl http://localhost:5000/api/videos

# Nginx
sudo systemctl status nginx
curl http://localhost/
```

### Check Logs

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

### Test Application

```bash
# Test backend API
curl http://localhost:5000/api/videos

# Test frontend
curl http://localhost/

# Test MinIO console (if accessible)
curl http://localhost:9001
```

---

## 🔥 STEP 10: Configure Firewall (Optional)

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

## 📝 Quick Service Management Commands

### Start All Services
```bash
sudo systemctl start mongod minio pakstream-backend nginx
```

### Stop All Services
```bash
sudo systemctl stop pakstream-backend nginx minio mongod
```

### Restart All Services
```bash
sudo systemctl restart mongod minio pakstream-backend nginx
```

### Check All Services Status
```bash
sudo systemctl status mongod minio pakstream-backend nginx
```

### View Real-time Logs
```bash
# Backend logs
sudo journalctl -u pakstream-backend -f

# MongoDB logs
sudo journalctl -u mongod -f

# MinIO logs
sudo journalctl -u minio -f

# Nginx error logs
sudo tail -f /var/log/nginx/error.log
```

---

## 🔍 Troubleshooting Commands

### Backend Won't Start
```bash
# Check logs
sudo journalctl -u pakstream-backend -n 100 --no-pager

# Check Node.js installation
node --version
which node

# Check MongoDB connection
/opt/mongodb/bin/mongod --version

# Check MinIO connection
curl http://localhost:9000/minio/health/live

# Check file permissions
ls -la /opt/PakStream/backend/

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
```

### Port Conflicts
```bash
# Check which ports are in use
sudo netstat -tulpn | grep -E ':(80|5000|9000|9001|27017)'

# Check what's using a specific port
sudo lsof -i :5000
sudo lsof -i :80
```

### Permission Issues
```bash
# Fix ownership
sudo chown -R $USER:$USER /opt/PakStream
sudo chown -R $USER:$USER /data/db
sudo chown -R $USER:$USER /data/minio

# Fix permissions
chmod -R 755 /opt/PakStream/backend/uploads
```

---

## 📊 Important Directories

- **Application:** `/opt/PakStream`
- **Backend:** `/opt/PakStream/backend`
- **Frontend:** `/opt/PakStream/frontend`
- **MongoDB data:** `/data/db`
- **MinIO data:** `/data/minio`
- **Logs:** `journalctl -u <service-name>`

## 🔌 Important Ports

- **80** - HTTP (Nginx)
- **5000** - Backend API
- **9000** - MinIO API
- **9001** - MinIO Console
- **27017** - MongoDB

---

## ✅ Installation Complete!

After completing all steps, your PakStream application should be running at:
- **Frontend:** `http://<your-server-ip>/`
- **Backend API:** `http://<your-server-ip>:5000/api`
- **MinIO Console:** `http://<your-server-ip>:9001`

**Default MinIO Credentials:**
- Username: `minioadmin`
- Password: `minioadmin`

**⚠️ IMPORTANT:** Change default credentials in production!

---

**Last Updated:** 2025-12-23  
**Version:** 1.0

