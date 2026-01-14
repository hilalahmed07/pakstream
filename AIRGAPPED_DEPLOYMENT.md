# PakStream - Air-Gapped Windows Deployment Guide

This guide provides complete instructions for deploying PakStream on a **fully air-gapped Windows machine** using Docker Desktop.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Phase 1: Online Build (Internet-Connected Machine)](#phase-1-online-build-internet-connected-machine)
3. [Phase 2: Offline Docker Desktop Installation (Windows)](#phase-2-offline-docker-desktop-installation-windows)
4. [Phase 3: Image Export and Transfer](#phase-3-image-export-and-transfer)
5. [Phase 4: Air-Gapped Installation and Run](#phase-4-air-gapped-installation-and-run)
6. [Verification and Troubleshooting](#verification-and-troubleshooting)

---

## Prerequisites

### On Internet-Connected Machine:
- Docker Desktop installed (Windows, macOS, or Linux)
- Git (to clone repository)
- Sufficient disk space (~5GB for images)
- USB drive (minimum 8GB, recommended 16GB+)

### On Air-Gapped Windows Machine:
- Windows 10/11 (64-bit)
- Administrator access
- Minimum 8GB RAM (16GB recommended)
- Hyper-V or WSL2 enabled (required for Docker Desktop)
- USB port for file transfer

---

## Phase 1: Online Build (Internet-Connected Machine)

### Step 1.1: Clone and Prepare Repository

```powershell
# Clone the repository
git clone <repository-url>
cd PakStream

# Verify project structure
dir
# Should see: backend/, frontend/, docker-compose.yml
```

### Step 1.2: Create Environment File

Create a `.env` file in the project root:

```powershell
# Create .env file
@"
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb://mongodb:27017/pakstream
JWT_SECRET=change-this-to-a-secure-random-string-in-production
CORS_ORIGIN=*
"@ | Out-File -FilePath .env -Encoding utf8
```

**⚠️ IMPORTANT:** Change `JWT_SECRET` to a secure random string in production!

### Step 1.3: Build Docker Images

Build all images using docker-compose:

```powershell
# Build all images
docker-compose build

# Verify images were created
docker images
```

Expected output should show:
- `pakstream-frontend` (latest)
- `pakstream-backend` (latest)
- `mongo:6`
- `node:20-alpine` (intermediate)
- `nginx:alpine` (intermediate)

### Step 1.4: Pull Base Images (if not already present)

Ensure all required base images are available:

```powershell
# Pull base images explicitly
docker pull node:20-alpine
docker pull nginx:alpine
docker pull mongo:6

# Verify all images
docker images
```

### Step 1.5: Export All Images to Single Tar File

Export all images into a single tar file for transfer:

```powershell
# Export all images to a single tar file
docker save `
  node:20-alpine `
  nginx:alpine `
  mongo:6 `
  pakstream-frontend:latest `
  pakstream-backend:latest `
  -o pakstream-images.tar

# Verify tar file was created
Get-Item pakstream-images.tar | Select-Object Name, Length, LastWriteTime
```

**Note:** The tar file will be large (approximately 1-3GB). Ensure your USB drive has sufficient space.

### Step 1.6: Prepare Transfer Package

Create a complete transfer package on USB drive:

```powershell
# Create transfer directory structure
$transferDir = "D:\PakStream-Transfer"  # Adjust to your USB drive letter
New-Item -ItemType Directory -Path $transferDir -Force
New-Item -ItemType Directory -Path "$transferDir\DockerDesktop" -Force
New-Item -ItemType Directory -Path "$transferDir\Project" -Force

# Copy project files (excluding node_modules, .git, etc.)
Copy-Item -Path ".\*" -Destination "$transferDir\Project\" -Recurse -Exclude "node_modules",".git","*.log","uploads"

# Copy Docker images tar file
Copy-Item -Path ".\pakstream-images.tar" -Destination "$transferDir\pakstream-images.tar"

# Copy this deployment guide
Copy-Item -Path ".\AIRGAPPED_DEPLOYMENT.md" -Destination "$transferDir\AIRGAPPED_DEPLOYMENT.md"
```

---

## Phase 2: Offline Docker Desktop Installation (Windows)

### Step 2.1: Download Docker Desktop Offline Installer

**On Internet-Connected Machine:**

1. Visit: https://www.docker.com/products/docker-desktop/
2. Navigate to "Download Docker Desktop"
3. Download the **offline installer** for Windows:
   - Direct link (check for latest version): https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe
   - Or search for "Docker Desktop offline installer Windows"
   - File name: `Docker Desktop Installer.exe` (approximately 500MB-1GB)

4. Copy the installer to USB drive:
   ```powershell
   # On internet machine
   Copy-Item -Path ".\Docker Desktop Installer.exe" -Destination "D:\PakStream-Transfer\DockerDesktop\"
   ```

**Alternative:** If offline installer is not available, you can use the online installer but it requires internet during installation. For fully air-gapped systems, you must use the offline installer.

### Step 2.2: Enable Required Windows Features

**On Air-Gapped Windows Machine:**

Docker Desktop requires either **Hyper-V** or **WSL2**. Check which is available:

```powershell
# Run PowerShell as Administrator
# Check if Hyper-V is available
Get-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V-All

# Check if WSL2 is available
wsl --status
```

**Option A: Enable Hyper-V (Recommended for Windows Pro/Enterprise)**

```powershell
# Run as Administrator
Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V-All -NoRestart

# If prompted, restart the computer
Restart-Computer
```

**Option B: Enable WSL2 (Works on Windows Home)**

```powershell
# Run as Administrator
# Enable WSL
dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart

# Enable Virtual Machine Platform
dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart

# Restart computer
Restart-Computer

# After restart, set WSL2 as default
wsl --set-default-version 2
```

### Step 2.3: Install Docker Desktop Offline

**On Air-Gapped Windows Machine:**

1. Copy Docker Desktop installer from USB to local drive:
   ```powershell
   # Copy installer to local drive
   Copy-Item -Path "E:\PakStream-Transfer\DockerDesktop\Docker Desktop Installer.exe" -Destination "C:\Temp\"
   ```

2. Run the installer:
   ```powershell
   # Run installer (right-click and "Run as Administrator")
   Start-Process -FilePath "C:\Temp\Docker Desktop Installer.exe" -Verb RunAs
   ```

3. Follow installation wizard:
   - Accept license agreement
   - Choose installation location (default is fine)
   - **Important:** Uncheck "Use WSL 2 instead of Hyper-V" if you're using Hyper-V
   - Click "Install"
   - Wait for installation to complete

4. **DO NOT** start Docker Desktop yet if it auto-starts (we'll configure it first)

### Step 2.4: Verify Docker Desktop Installation

```powershell
# Verify Docker is installed
docker --version
# Expected: Docker version 24.x.x or similar

docker-compose --version
# Expected: Docker Compose version v2.x.x or similar

# If commands not found, add Docker to PATH or restart PowerShell
```

### Step 2.5: Start Docker Desktop

1. Launch Docker Desktop from Start Menu
2. Wait for Docker to start (whale icon in system tray)
3. Verify Docker is running:

```powershell
# Check Docker daemon
docker info

# Should show Docker system information without errors
```

---

## Phase 3: Image Export and Transfer

### Step 3.1: Transfer Files to Air-Gapped Machine

1. Insert USB drive into air-gapped machine
2. Copy entire `PakStream-Transfer` folder to local drive:

```powershell
# On air-gapped machine
$projectPath = "C:\PakStream"
New-Item -ItemType Directory -Path $projectPath -Force

# Copy project files
Copy-Item -Path "E:\PakStream-Transfer\Project\*" -Destination $projectPath -Recurse

# Copy Docker images tar file
Copy-Item -Path "E:\PakStream-Transfer\pakstream-images.tar" -Destination "$projectPath\pakstream-images.tar"
```

### Step 3.2: Load Docker Images

```powershell
# Navigate to project directory
cd C:\PakStream

# Load all images from tar file
docker load -i pakstream-images.tar

# Verify images were loaded
docker images
```

Expected output:
```
REPOSITORY              TAG       IMAGE ID       CREATED         SIZE
pakstream-frontend      latest    ...            ...             ...
pakstream-backend       latest    ...            ...             ...
mongo                   6         ...            ...             ...
node                    20-alpine ...            ...             ...
nginx                   alpine    ...            ...             ...
```

---

## Phase 4: Air-Gapped Installation and Run

### Step 4.1: Create Environment File

```powershell
# Create .env file in project root
cd C:\PakStream

@"
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb://mongodb:27017/pakstream
JWT_SECRET=change-this-to-a-secure-random-string-in-production
CORS_ORIGIN=*
"@ | Out-File -FilePath .env -Encoding utf8
```

**⚠️ IMPORTANT:** Change `JWT_SECRET` to a secure random string!

### Step 4.2: Start Application with Docker Compose

```powershell
# Ensure you're in project root
cd C:\PakStream

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f
```

### Step 4.3: Verify Services are Running

```powershell
# Check container status
docker-compose ps

# Expected output:
# NAME                    STATUS          PORTS
# pakstream-frontend      Up              0.0.0.0:3000->80/tcp
# pakstream-backend       Up              0.0.0.0:5000->5000/tcp
# pakstream-mongodb       Up              0.0.0.0:27017->27017/tcp
```

### Step 4.4: Check Service Health

```powershell
# Check MongoDB
docker-compose exec mongodb mongosh --eval "db.adminCommand('ping')"

# Check Backend API
Invoke-WebRequest -Uri "http://localhost:5000/api/health" -UseBasicParsing

# Check Frontend
Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing
```

---

## Verification and Troubleshooting

### Access the Application

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:5000/api
- **MongoDB:** localhost:27017

### Common Commands

```powershell
# View logs
docker-compose logs -f                    # All services
docker-compose logs -f backend            # Backend only
docker-compose logs -f frontend           # Frontend only
docker-compose logs -f mongodb            # MongoDB only

# Stop services
docker-compose stop

# Start services
docker-compose start

# Restart services
docker-compose restart

# Stop and remove containers (keeps volumes)
docker-compose down

# Stop and remove everything including volumes
docker-compose down -v

# Rebuild and restart
docker-compose up -d --build
```

### Troubleshooting

#### Issue: Docker Desktop won't start

**Solution:**
1. Ensure Hyper-V or WSL2 is enabled
2. Check Windows features: `Get-WindowsOptionalFeature -Online | Where-Object {$_.State -eq "Enabled"}`
3. Restart computer
4. Run Docker Desktop as Administrator

#### Issue: Port already in use

**Solution:**
```powershell
# Check what's using the port
netstat -ano | findstr :3000
netstat -ano | findstr :5000
netstat -ano | findstr :27017

# Stop the conflicting service or change ports in docker-compose.yml
```

#### Issue: Containers exit immediately

**Solution:**
```powershell
# Check logs for errors
docker-compose logs

# Check container status
docker-compose ps -a

# Restart containers
docker-compose restart
```

#### Issue: MongoDB connection failed

**Solution:**
```powershell
# Check MongoDB container
docker-compose logs mongodb

# Verify MongoDB is healthy
docker-compose exec mongodb mongosh --eval "db.adminCommand('ping')"

# Check environment variable
docker-compose exec backend env | findstr MONGODB_URI
```

#### Issue: Frontend can't connect to backend

**Solution:**
1. Verify backend is running: `docker-compose ps`
2. Check backend logs: `docker-compose logs backend`
3. Test backend directly: `Invoke-WebRequest -Uri "http://localhost:5000/api/health"`
4. Verify network: `docker network inspect pakstream-network`

### Data Persistence

All data is stored in Docker volumes:
- **MongoDB data:** `pakstream-mongodb-data`
- **MongoDB config:** `pakstream-mongodb-config`
- **Backend uploads:** `pakstream-backend-uploads`

To backup data:
```powershell
# Backup MongoDB
docker run --rm -v pakstream-mongodb-data:/data -v ${PWD}:/backup mongo:6 tar czf /backup/mongodb-backup.tar.gz /data

# Backup uploads
docker run --rm -v pakstream-backend-uploads:/data -v ${PWD}:/backup alpine tar czf /backup/uploads-backup.tar.gz /data
```

---

## Summary Checklist

### On Internet Machine:
- [ ] Clone repository
- [ ] Create .env file
- [ ] Build Docker images (`docker-compose build`)
- [ ] Pull base images (node:20-alpine, nginx:alpine, mongo:6)
- [ ] Export images to tar (`docker save ... -o pakstream-images.tar`)
- [ ] Download Docker Desktop offline installer
- [ ] Copy everything to USB drive

### On Air-Gapped Machine:
- [ ] Enable Hyper-V or WSL2
- [ ] Install Docker Desktop offline
- [ ] Verify Docker installation
- [ ] Copy project files from USB
- [ ] Load Docker images (`docker load -i pakstream-images.tar`)
- [ ] Create .env file
- [ ] Start services (`docker-compose up -d`)
- [ ] Verify all services are running
- [ ] Access application at http://localhost:3000

---

## Security Notes

1. **Change JWT_SECRET:** Use a strong random string in production
2. **Change MongoDB default credentials** if needed
3. **Firewall:** Configure Windows Firewall to restrict access if needed
4. **HTTPS:** For production, consider adding reverse proxy with SSL
5. **Backup:** Regularly backup MongoDB data and uploads

---

## Support

For issues or questions:
1. Check Docker logs: `docker-compose logs`
2. Verify container status: `docker-compose ps`
3. Check network connectivity: `docker network inspect pakstream-network`
4. Review this guide's troubleshooting section

---

**Last Updated:** 2024
**Docker Version:** 24.x
**Node Version:** 20
**MongoDB Version:** 6

