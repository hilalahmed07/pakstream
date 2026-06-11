# PakStream — Deployment Guide
## Changes: LDAP Auth + Username Login + Patch Visibility Flag + Force-Password Removal

This guide covers deploying all changes from the current release ISO to the air-gapped Ubuntu server.

---

## What changed in this release

| Area | Change |
|------|--------|
| Login | Field changed from **Email** to **Username** (e.g. `pa12343khan`) |
| Auth | **LDAP authentication** added — verify credentials against Active Directory |
| Auth | **Force-change-password on first login** removed entirely |
| Patch | `isPatchVisible` feature flag added — set `false` to hide patch management everywhere |
| Security | All CSO scan vulnerabilities fixed (CORS, XSS header, path disclosure, email disclosure, etc.) |

---

## Before you start

```bash
# 1. Check the backend service name on this server
sudo systemctl list-units | grep pakstream

# 2. Note the install path (assumed /opt/PakStream throughout this guide)
ls /opt/PakStream
```

If your install path is different (e.g. `/home/pakstream/app`), replace `/opt/PakStream` in every command below.

---

## Step 1 — Mount the ISO

```bash
sudo mkdir -p /mnt/pakstream-update
sudo mount -o loop /path/to/pakstream-update.iso /mnt/pakstream-update
ls /mnt/pakstream-update
```

---

## Step 2 — Stop the backend service

```bash
sudo systemctl stop pakstream-backend
```

---

## Step 3 — Copy backend source files

```bash
BACKEND=/opt/PakStream/backend
ISO=/mnt/pakstream-update

# Modified controllers and model
cp $ISO/backend/src/controllers/authController.js   $BACKEND/src/controllers/authController.js
cp $ISO/backend/src/controllers/userController.js   $BACKEND/src/controllers/userController.js
cp $ISO/backend/src/models/User.js                  $BACKEND/src/models/User.js

# New LDAP files
cp $ISO/backend/src/config/ldapConfig.js            $BACKEND/src/config/ldapConfig.js
cp $ISO/backend/src/services/ldapService.js         $BACKEND/src/services/ldapService.js

# Updated package manifests
cp $ISO/backend/package.json                        $BACKEND/package.json
cp $ISO/backend/package-lock.json                   $BACKEND/package-lock.json
```

---

## Step 4 — Install the new npm packages (no internet needed)

The ISO includes the 4 required packages pre-copied from node_modules.

```bash
# Copy ldapjs-client and its 3 dependencies directly into node_modules
cp -r $ISO/backend/node_modules/ldapjs-client   $BACKEND/node_modules/ldapjs-client
cp -r $ISO/backend/node_modules/asn1            $BACKEND/node_modules/asn1
cp -r $ISO/backend/node_modules/assert-plus     $BACKEND/node_modules/assert-plus
cp -r $ISO/backend/node_modules/ldap-filter     $BACKEND/node_modules/ldap-filter
```

---

## Step 5 — Configure LDAP in .env

> **Do NOT overwrite your .env from the ISO** — it contains server-specific settings.  
> Only add/edit the LDAP block manually.

```bash
sudo nano $BACKEND/.env
```

Find and update the LDAP section (or add it if missing):

```env
# Set to true to enable LDAP authentication
LDAP_ENABLED=true

# Your Active Directory / LDAP server IP or hostname
LDAP_URL=ldap://10.33.x.x

# Your domain base DN  (e.g. DC=mil,DC=pk or DC=org,DC=local)
LDAP_BASE_DN=DC=yourdomain,DC=local

# Service account used to search the directory (read-only account is fine)
LDAP_BIND_DN=CN=ldap-service,CN=Users,DC=yourdomain,DC=local
LDAP_BIND_PASSWORD=YourServiceAccountPassword

# For Windows Active Directory use (sAMAccountName={{username}})
# For OpenLDAP use (uid={{username}})
LDAP_SEARCH_FILTER=(sAMAccountName={{username}})

# true = fall back to local password if LDAP server is unreachable
LDAP_FALLBACK=true
```

Save and exit (`Ctrl+O`, `Enter`, `Ctrl+X`).

---

## Step 6 — Copy frontend source files

```bash
FRONTEND=/opt/PakStream/frontend

# Modified files
cp $ISO/frontend/src/App.tsx                                        $FRONTEND/src/App.tsx
cp $ISO/frontend/src/components/Navbar.tsx                          $FRONTEND/src/components/Navbar.tsx
cp $ISO/frontend/src/components/admin/AdminAnalyticsDashboard.tsx   $FRONTEND/src/components/admin/AdminAnalyticsDashboard.tsx
cp $ISO/frontend/src/components/admin/AdminDownloadDashboard.tsx    $FRONTEND/src/components/admin/AdminDownloadDashboard.tsx
cp $ISO/frontend/src/components/admin/AdminSidebar.tsx              $FRONTEND/src/components/admin/AdminSidebar.tsx
cp $ISO/frontend/src/components/auth/LoginModal.tsx                 $FRONTEND/src/components/auth/LoginModal.tsx
cp $ISO/frontend/src/hooks/useAuth.tsx                              $FRONTEND/src/hooks/useAuth.tsx
cp $ISO/frontend/src/pages/user/UserHomePage.tsx                    $FRONTEND/src/pages/user/UserHomePage.tsx
cp $ISO/frontend/src/types/auth.ts                                  $FRONTEND/src/types/auth.ts

# New file — feature flags
mkdir -p $FRONTEND/src/config
cp $ISO/frontend/src/config/features.ts                             $FRONTEND/src/config/features.ts
```

---

## Step 7 — Delete the removed file

```bash
# ForceChangePasswordModal was removed — delete it from the server
rm -f $FRONTEND/src/components/auth/ForceChangePasswordModal.tsx
```

---

## Step 8 — Rebuild the frontend

```bash
cd $FRONTEND
npm run build
```

This produces a fresh `build/` folder that nginx serves. It takes 1–3 minutes.

If it fails due to missing node_modules on the frontend:

```bash
# Only run if npm run build says "cannot find module"
npm install --offline 2>/dev/null || npm install
npm run build
```

---

## Step 9 — Start the backend service

```bash
sudo systemctl start pakstream-backend
sudo systemctl status pakstream-backend
```

You should see `Active: active (running)`.

---

## Step 10 — Unmount the ISO

```bash
sudo umount /mnt/pakstream-update
```

---

## Step 11 — Verify the deployment

Open the browser and go to `http://10.33.100.70`.

| Test | Expected result |
|------|----------------|
| Login page | Field says **Username** (not Email) |
| Login with `pa12343khan` + AD password | Logs in successfully (if LDAP enabled) |
| Admin sidebar | No "Patch Management" link (if `isPatchVisible = false`) |
| `/api/videos/featured/` | Returns 404, not a 500 crash |
| Response headers | `X-XSS-Protection: 1; mode=block` visible in browser dev tools |

---

## Optional — Toggle patch visibility

To show or hide patch management without redeploying:

1. Edit `$FRONTEND/src/config/features.ts`
2. Change `isPatchVisible = true` or `isPatchVisible = false`
3. Run `cd $FRONTEND && npm run build`
4. No backend restart needed

---

## Troubleshooting

**Backend won't start after update**
```bash
# Check logs
sudo journalctl -u pakstream-backend -n 50 --no-pager
```

**LDAP login fails with "User not found"**
- Confirm the user's `username` in PakStream matches their `sAMAccountName` in Active Directory exactly
- Test LDAP connectivity: `nc -zv <LDAP_URL_IP> 389`

**LDAP login fails with "LDAP server unreachable"**
- If `LDAP_FALLBACK=true`, the system automatically tries the local password stored in MongoDB
- Check network connectivity to the AD server

**Frontend build fails**
```bash
# Check Node.js version
node --version   # should be 16+ 
# Check for TypeScript errors
cd $FRONTEND && npx tsc --noEmit
```
