# Process Hub — Deployment Guide

**Target:** Azure VM (Ubuntu 22.04), single-tenant Entra ID auth, HTTPS via Let's Encrypt

---

## Repository structure

Process Hub uses two repositories:

| Repo | Contents | Access |
|------|----------|--------|
| **GitHub** (this repo) | Source code + sample data + docs | Public |
| **Azure DevOps** | `data/processes/` — real process content | Private / team only |

Credentials (`.env`) live only on the server — never in either repo.

---

## Prerequisites

On your local machine:
- [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli) — `az login` done
- [Git](https://git-scm.com/)
- SSH key pair — run `ssh-keygen -t ed25519` if you don't have one
- Node.js 20+ (for local development only)

---

## Step 1 — Azure App Registration

Do this **before** provisioning the VM so you have the IDs ready.

1. Azure Portal → **Entra ID** → **App registrations** → **New registration**
2. Fill in:
   - **Name:** `Process Hub` (or your client's name)
   - **Supported account types:** Accounts in this organisational directory only (Single tenant)
   - **Redirect URI:** Single-page application (SPA) → `http://localhost:5173`
   - Click **Register**
3. Note down:
   - **Application (client) ID**
   - **Directory (tenant) ID**
4. Create the app role:
   - **App roles** → **Create app role**
   - Display name: `Process Admin`
   - Value: `ProcessAdmin` ← must be exactly this
   - Allowed member types: Users/Groups
   - Check **Enable this app role** → Apply
5. Expose an API scope:
   - **Expose an API** → **Add a scope**
   - Accept the default Application ID URI
   - Scope name: `user_impersonation`
   - Who can consent: Admins and users → Save

---

## Step 2 — Provision the Azure VM

**Windows (PowerShell):**
```powershell
# Read SSH public key
$sshKey   = (Get-Content "$env:USERPROFILE\.ssh\id_ed25519.pub" -Raw).Trim()
$clientId = "YOUR-APPLICATION-CLIENT-ID"
$tenantId = "YOUR-DIRECTORY-TENANT-ID"

# Create resource group
az group create --name "process-hub-rg" --location australiaeast

# Deploy Bicep template (~3 minutes)
az deployment group create `
  --resource-group "process-hub-rg" `
  --template-file "deploy/main.bicep" `
  --parameters dnsLabelPrefix="processhub-prod" `
               adminSshKey="$sshKey" `
               entraClientId="$clientId" `
               entraTenantId="$tenantId" `
  --query "properties.outputs" `
  --output table

# Get your FQDN
az network public-ip show `
  --resource-group "process-hub-rg" `
  --name "processhub-ip" `
  --query "{fqdn:dnsSettings.fqdn, ip:ipAddress}" `
  --output table
```

**Mac/Linux (bash):**
```bash
./deploy/deploy.sh \
  process-hub-rg \
  processhub-prod \
  ~/.ssh/id_ed25519.pub \
  <application-client-id> \
  <directory-tenant-id>
```

---

## Step 3 — SSH and verify

```bash
ssh processhub@<your-fqdn>
```

Wait ~2 minutes after VM creation for cloud-init to finish, then verify:
```bash
node --version    # v20.x
nginx -v          # nginx/1.x
npm install -g pm2
```

---

## Step 4 — Clone the repos

**Clone source code from GitHub:**
```bash
cd /opt
sudo mkdir processhub && sudo chown processhub:processhub processhub
cd /opt/processhub
git clone https://github.com/YOUR-ORG/process-hub.git .
```

**Clone content from Azure DevOps** (overlay into the data folder):
```bash
cd /opt/processhub
git clone https://YOUR-ORG@dev.azure.com/YOUR-ORG/process-content/_git/process-content data-live
# Copy real processes into data/ alongside the samples
cp -r data-live/processes/* data/processes/
```

> If you want DevOps content to completely replace the samples, use:
> `rm -rf data/processes && mv data-live/processes data/processes`

---

## Step 5 — Configure environment

```bash
cp .env.example .env
nano .env
```

Fill in your values:
```env
VITE_ENTRA_CLIENT_ID=<your-client-id>
VITE_ENTRA_TENANT_ID=<your-tenant-id>
ENTRA_CLIENT_ID=<your-client-id>
ENTRA_TENANT_ID=<your-tenant-id>
VITE_APP_NAME=Process Hub
VITE_TENANT_NAME=Your Organisation
VITE_PRIMARY_COLOR=#0078d4
VITE_LOGO_URL=https://yoursite.com/logo.png
PORT=3001
CORS_ORIGIN=https://your-domain.com
```

**Critical — copy to frontend before building:**
```bash
cp .env frontend/.env
```

---

## Step 6 — Build and start

```bash
npm install
npm run build
pm2 start backend/dist/index.js --name processhub
pm2 save
pm2 startup    # copy and run the printed sudo command
```

Verify:
```bash
pm2 status
curl http://localhost:3001/api/processes
# Should return JSON with the sample processes
```

---

## Step 7 — Configure nginx

```bash
sudo cp /opt/processhub/deploy/nginx.conf /etc/nginx/sites-available/processhub
sudo ln -s /etc/nginx/sites-available/processhub /etc/nginx/sites-enabled/processhub
sudo rm /etc/nginx/sites-enabled/default
sudo nano /etc/nginx/sites-available/processhub
```

Replace the file contents with:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass         http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
    }
}
```

```bash
sudo nginx -t && sudo systemctl reload nginx
```

---

## Step 8 — HTTPS

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

Then add the HTTPS URL as a redirect URI in the Azure App Registration:
- Authentication → Add URI → `https://your-domain.com`

---

## Step 9 — Assign admin users

- Azure Portal → **Entra ID** → **Enterprise applications** → **Process Hub**
- **Users and groups** → **Add user/group**
- Select users → assign the **ProcessAdmin** role
- Users must sign out and back in for the role to take effect

---

## Updating the application

**Code update (from GitHub):**
```bash
cd /opt/processhub
git pull
cp .env frontend/.env   # always re-copy before building
npm install             # only if dependencies changed
npm run build
pm2 restart processhub
```

**Content update (from Azure DevOps):**
```bash
cd /opt/processhub/data-live
git pull
cp -r processes/* /opt/processhub/data/processes/
pm2 restart processhub
```

No rebuild needed for content-only updates.

---

## White-label client deployment

1. Client registers an App in **their** Entra ID (same steps as Step 1)
2. Provision a VM in **their** Azure subscription (Step 2)
3. Clone the same GitHub repo (Step 4)
4. Set client `.env` values — different Entra IDs, client branding, client domain
5. Build and start (Steps 5–8)
6. Clone **their** content repo into `data/processes/`

No source code changes required. Each deployment is fully isolated in the client's own Azure tenant.

---

## Security checklist

- [ ] SSH restricted to your IP only (NSG inbound rule for port 22)
- [ ] `.env` never committed to git
- [ ] `deploy/.env.production` gitignored and stored securely locally
- [ ] ProcessAdmin role assigned only to named individuals
- [ ] certbot auto-renewal active (`sudo certbot renew --dry-run`)

---

## Useful commands

```bash
pm2 logs processhub          # live app logs
pm2 restart processhub       # restart after changes
pm2 status                   # check running status
sudo systemctl status nginx  # nginx status
sudo certbot renew           # manual cert renewal
du -sh /opt/processhub/data/ # check content disk usage
```

---

## Troubleshooting

| Symptom | Check |
|---------|-------|
| Blank page in browser | F12 console — likely MSAL crypto error = needs HTTPS |
| Login redirect error (AADSTS50011) | Redirect URI in App Registration doesn't match exactly |
| Straight through without login | `VITE_ENTRA_CLIENT_ID` not embedded — check `frontend/.env` exists before build |
| API returns empty `[]` | `data/index.json` missing or `DATA_DIR` path wrong |
| 401 on API calls | `ENTRA_CLIENT_ID` / `ENTRA_TENANT_ID` not set in `.env` |
| nginx 502 Bad Gateway | PM2 not running — `pm2 status` then `pm2 restart processhub` |
| certbot fails | Port 80 must be open in NSG and nginx serving HTTP |
| npm error `uv_cwd` | Current directory was deleted — `cd /tmp` first then `cd /opt/processhub` |
| `unzip: cannot find` | File uploaded to `/home/processhub/` not `/root/` — check both paths |
