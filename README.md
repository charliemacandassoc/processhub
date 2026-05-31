# Process Hub

A web application for viewing, navigating, and managing business process flows defined in BPMN. Access is controlled via Microsoft Entra ID SSO — only users in your Microsoft 365 tenant can sign in.

## Tech stack

| Layer | Tech |
|-------|------|
| Frontend | Vite + React + TypeScript, MSAL, bpmn-js, Zustand |
| Backend | Node.js + Express + TypeScript |
| Auth | Azure Entra ID (single-tenant, `ProcessAdmin` app role for write access) |
| Storage | Flat files (`/data`) — no database required |

---

## Local development

### 1. Register an Azure App

1. Azure Portal → Entra ID → **App registrations** → New registration
2. Name: `Process Hub (Dev)`
3. Supported account types: **Accounts in this organisational directory only (Single tenant)**
4. Redirect URI: `http://localhost:5173` (SPA)
5. After creation: **App roles** → Create role:
   - Display name: `Process Admin`
   - Value: `ProcessAdmin`
   - Allowed member types: Users/Groups

### 2. Configure env vars

```bash
cp .env.example .env
# Fill in VITE_ENTRA_CLIENT_ID, VITE_ENTRA_TENANT_ID (same for ENTRA_* backend vars)
```

### 3. Install and run

```bash
npm install
npm run dev        # starts backend (port 3001) + frontend (port 5173) concurrently
```

Open http://localhost:5173 — sign in with your M365 account.

---

## White-labelling for client deployment

All branding is env-var driven. To deploy for a client:

| Env var | Default | Description |
|---------|---------|-------------|
| `VITE_APP_NAME` | `Process Hub` | App name shown in nav and login |
| `VITE_TENANT_NAME` | `Your Organisation` | Shown on login page |
| `VITE_PRIMARY_COLOR` | `#0078d4` | Brand colour (CSS hex) |
| `VITE_LOGO_URL` | _(none)_ | URL to logo image |

The client registers their **own** App Registration in their Azure tenant and provides `VITE_ENTRA_CLIENT_ID` + `VITE_ENTRA_TENANT_ID`. No source code changes required.

---

## Azure VM deployment

```bash
# Prerequisites: az CLI logged in, SSH key pair generated
chmod +x deploy/deploy.sh
./deploy/deploy.sh my-resource-group processhub-prod ~/.ssh/id_rsa.pub <client-id> <tenant-id>
```

After deployment:

1. SSH to the VM
2. Clone this repo to `/opt/processhub`
3. Copy `.env.example` to `/opt/processhub/.env` and fill in all values
4. Build and start:
   ```bash
   npm install
   npm run build
   pm2 start backend/dist/index.js --name processhub
   pm2 save && pm2 startup
   ```
5. Configure nginx: `sudo cp deploy/nginx.conf /etc/nginx/sites-available/processhub && sudo ln -s ... && sudo nginx -t && sudo systemctl reload nginx`
6. TLS: `sudo certbot --nginx -d your.domain.com`
7. Add `https://your.domain.com` as a redirect URI in the Entra App Registration

---

## Data structure

All content is stored as flat files under `/data`:

```
data/
├── index.json                  ← auto-rebuilt by backend after every write
└── processes/
    └── <process-id>/
        ├── overview.md         ← YAML frontmatter + markdown body
        ├── process.bpmn        ← BPMN 2.0 XML
        ├── steps/
        │   └── <bpmn-element-id>.md
        └── checklists/
            └── *.md
```

## User roles

| Role | Access |
|------|--------|
| Any authenticated M365 user | View approved processes |
| `ProcessAdmin` app role | View drafts + all admin write operations |

Assign the `ProcessAdmin` role in Azure Portal → Entra ID → Enterprise Applications → Process Hub → Users and groups.
