# Nginx Security Hardening Guide

Two security findings from the CSO scan that require changes on the deployed server (cannot be fixed in application code):

1. **Version Disclosure** — Nginx reveals its version number in HTTP response headers and error pages
2. **SSL/TLS Not Implemented** — The site runs over plain HTTP; traffic is unencrypted

---

## 1. Hide Nginx Version (`server_tokens off`)

### Why this matters

By default, Nginx includes its version number in:
- The `Server` response header (e.g. `Server: nginx/1.18.0`)
- HTML error pages (404, 500, etc.)

An attacker who knows the exact version can look up known CVEs for that version and target the server directly.

### Steps

**1. Connect to the server and open the main Nginx config file:**

```bash
sudo nano /etc/nginx/nginx.conf
```

**2. Add `server_tokens off;` inside the `http {}` block:**

```nginx
http {
    ##
    # Basic Settings
    ##
    server_tokens off;        # <-- add this line

    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    ...
}
```

> If the line already exists and is set to `on`, change it to `off`.

**3. Test the config and reload Nginx:**

```bash
sudo nginx -t
sudo systemctl reload nginx
```

**4. Verify the fix:**

```bash
curl -I http://10.33.100.70/
```

The `Server:` header should now show `nginx` with no version number.

---

## 2. Enable HTTPS with a Self-Signed Certificate

### Why this matters

Without SSL/TLS, all traffic between users and the server (including login credentials and JWT tokens) travels as plain text. Anyone on the same network segment can intercept it with a packet sniffer. This is especially relevant in a controlled air-gapped environment where the network may still carry sensitive data.

### Overview

Because this server is air-gapped (no internet access), a certificate from a public CA (e.g. Let's Encrypt) is not possible. A **self-signed certificate** is the correct solution — it encrypts the traffic, but users will see a browser warning the first time they visit. They can accept it once (or it can be installed as a trusted CA on each workstation).

---

### Step 1 — Generate the self-signed certificate

SSH into the server and run:

```bash
sudo mkdir -p /etc/nginx/ssl

sudo openssl req -x509 -nodes -days 3650 \
  -newkey rsa:2048 \
  -keyout /etc/nginx/ssl/pakstream.key \
  -out    /etc/nginx/ssl/pakstream.crt \
  -subj "/C=PK/ST=Punjab/L=Lahore/O=PakStream/OU=IT/CN=10.33.100.70" \
  -addext "subjectAltName=IP:10.33.100.70"
```

| Flag | Meaning |
|------|---------|
| `-x509` | Output a self-signed certificate (not a CSR) |
| `-nodes` | Do not encrypt the private key (so Nginx can read it without a password prompt) |
| `-days 3650` | Certificate valid for 10 years |
| `-newkey rsa:2048` | Generate a new 2048-bit RSA key |
| `-subj ...` | Certificate subject — adjust C/ST/L/O as needed |
| `-addext subjectAltName=IP:...` | Required by modern browsers to avoid SAN warnings |

**Set secure permissions on the private key:**

```bash
sudo chmod 600 /etc/nginx/ssl/pakstream.key
sudo chmod 644 /etc/nginx/ssl/pakstream.crt
```

---

### Step 2 — Update the Nginx server block

Open the PakStream site config (usually at `/etc/nginx/sites-available/pakstream` or `/etc/nginx/conf.d/pakstream.conf`):

```bash
sudo nano /etc/nginx/sites-available/pakstream
```

Replace the existing config with the following (adjust paths and port numbers to match your deployment):

```nginx
# Redirect all plain HTTP to HTTPS
server {
    listen 80;
    server_name 10.33.100.70;
    return 301 https://$host$request_uri;
}

# HTTPS server
server {
    listen 443 ssl;
    server_name 10.33.100.70;

    server_tokens off;

    ssl_certificate     /etc/nginx/ssl/pakstream.crt;
    ssl_certificate_key /etc/nginx/ssl/pakstream.key;

    # Modern TLS only — disable old protocols
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
    ssl_session_timeout 1d;
    ssl_session_cache shared:MozSSL:10m;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Serve React frontend
    root /opt/PakStream/frontend/build;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API requests to Node.js backend
    location /api/ {
        proxy_pass         http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Proxy Socket.IO
    location /socket.io/ {
        proxy_pass         http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }

    # Serve uploaded files
    location /uploads/ {
        alias /opt/PakStream/backend/uploads/;
        expires 7d;
        add_header Cache-Control "public";
    }
}
```

---

### Step 3 — Update `CORS_ORIGIN` in the backend `.env`

Now that the site runs on HTTPS, update the backend environment file so CORS allows the HTTPS origin:

```bash
sudo nano /opt/PakStream/backend/.env
```

Change:
```
CORS_ORIGIN=http://10.33.100.70
```

To:
```
CORS_ORIGIN=https://10.33.100.70
```

---

### Step 4 — Test, enable, and reload

```bash
# Test the Nginx config for syntax errors
sudo nginx -t

# If the site config is in sites-available, enable it
sudo ln -sf /etc/nginx/sites-available/pakstream /etc/nginx/sites-enabled/pakstream

# Reload Nginx (no downtime)
sudo systemctl reload nginx

# Restart the Node.js backend to pick up the new .env
sudo systemctl restart pakstream-backend   # adjust service name as needed
```

---

### Step 5 — Install the certificate as trusted on workstations (optional but recommended)

Users will see a browser security warning on first visit because the certificate is self-signed. To remove the warning, install the certificate as a trusted CA on each workstation:

**Windows (run as Administrator):**

```powershell
# Copy pakstream.crt to the workstation first, then:
certutil -addstore "Root" C:\path\to\pakstream.crt
```

**Linux:**

```bash
sudo cp pakstream.crt /usr/local/share/ca-certificates/pakstream.crt
sudo update-ca-certificates
```

After installing, restart the browser. The warning will not appear again.

---

### Verification

After all steps, check the following:

```bash
# Should redirect to HTTPS
curl -I http://10.33.100.70/

# Should return 200 with ssl details (-k ignores self-signed cert warning)
curl -Ik https://10.33.100.70/

# Check which TLS version and cipher are used
openssl s_client -connect 10.33.100.70:443 -tls1_2
```

The `Server:` header should show `nginx` with no version, and the connection should be over TLS 1.2 or 1.3.
