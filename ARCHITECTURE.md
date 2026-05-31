# Process Hub — Architecture Overview

## Summary

Process Hub is a single-tenant web application that allows staff to view and navigate business process flows defined in BPMN 2.0. Access is controlled via Microsoft Entra ID — only users within the configured Microsoft 365 tenant can sign in. An admin interface allows process owners to manage content without touching files directly.

The application is designed for **white-label re-deployment**: all branding is environment-variable driven so a client can run their own branded instance in their own Azure tenant without modifying source code.

---

## High-level architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Azure VM (Ubuntu)                    │
│                                                          │
│   ┌─────────────┐     ┌──────────────────────────────┐  │
│   │    nginx    │────▶│   Node.js / Express (PM2)    │  │
│   │  port 443   │     │         port 3001             │  │
│   └─────────────┘     │                              │  │
│         ▲             │  ┌────────────┐              │  │
│         │             │  │  /api/*    │ JWT validate  │  │
│    HTTPS request      │  │  routes    │◀─ Entra ID   │  │
│    from browser       │  └─────┬──────┘              │  │
│                       │        │                     │  │
│                       │  ┌─────▼──────┐              │  │
│                       │  │  /data/*   │ flat files   │  │
│                       │  │  (content) │              │  │
│                       │  └────────────┘              │  │
│                       │                              │  │
│                       │  ┌────────────┐              │  │
│                       │  │ /dist/*    │ built React  │  │
│                       │  │ (frontend) │ app          │  │
│                       │  └────────────┘              │  │
│                       └──────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
         │                          │
         ▼                          ▼
┌─────────────────┐      ┌─────────────────────┐
│  Microsoft      │      │   Azure DevOps       │
│  Entra ID       │      │   (content repo)     │
│  (auth)         │      │   data/processes/    │
└─────────────────┘      └─────────────────────┘
```

---

## Component breakdown

### Frontend — Vite + React (TypeScript)

The frontend is a single-page application built with Vite and React. It is compiled at deploy time and served as static files by the Express backend in production.

**Key libraries:**
- `@azure/msal-react` — wraps the entire app in an MSAL provider; unauthenticated users see only a login redirect
- `bpmn-js` — renders BPMN 2.0 XML as a zoomable, pannable, interactive diagram
- `zustand` — global state store (auth, active process, breadcrumb stack)
- `flexsearch` — client-side full-text search index built from `index.json` on load
- `react-markdown` + `remark-gfm` — renders step detail content including GFM tables and task lists

**Dev mode bypass:** When `VITE_ENTRA_CLIENT_ID` is not set, the app auto-authenticates as a local admin. This allows development without a real Entra registration.

### Backend — Node.js + Express (TypeScript)

The backend serves two purposes:
1. **API** — read and write process content from the flat-file data store
2. **Static file server** — serves the built frontend in production

**Authentication middleware:**
- `requireAuth` — validates the Entra JWT on every request. Uses `jwks-rsa` to fetch Microsoft's public signing keys and `jsonwebtoken` to verify signature, issuer, audience, and expiry.
- `requireAdmin` — extends `requireAuth` by also checking that the `roles` claim contains `ProcessAdmin`.

**Dev mode bypass:** When `ENTRA_TENANT_ID` / `ENTRA_CLIENT_ID` are not set, all requests are treated as authenticated admins. Set both env vars to activate real validation.

### Data store — flat files

There is no database. All process content is stored as files on disk under `/data/`:

```
data/
├── index.json                    ← auto-generated; do not edit manually
└── processes/
    └── <process-id>/
        ├── overview.md           ← YAML frontmatter + markdown body
        ├── process.bpmn          ← BPMN 2.0 XML
        ├── steps/
        │   └── <element-id>.md   ← one file per BPMN task element
        └── checklists/
            └── *.md
```

`index.json` is rebuilt automatically by the backend after every admin write. It powers the inventory table and the client-side search index.

### Infrastructure — Azure

| Resource | Purpose |
|----------|---------|
| Azure VM (`Standard_B2s`) | Hosts the Node.js app and nginx |
| Public IP + DNS | `<name>.australiaeast.cloudapp.azure.com` or custom domain |
| NSG | Allows ports 443 (HTTPS), 80 (HTTP→redirect), 22 (SSH) |
| Let's Encrypt (certbot) | Free TLS certificate, auto-renews |
| nginx | Reverse proxy: terminates HTTPS, proxies to Node on port 3001 |
| PM2 | Process manager: keeps Node running, restarts on crash, starts on reboot |
| Azure Entra ID | Identity provider — single-tenant SSO, `ProcessAdmin` app role |

---

## Authentication and authorisation flow

```
Browser                    MSAL / Entra ID              Express backend
   │                             │                            │
   │──── load app ──────────────▶│                            │
   │◀─── redirect to login ──────│                            │
   │──── M365 credentials ──────▶│                            │
   │◀─── access token (JWT) ─────│                            │
   │                             │                            │
   │──── GET /api/processes ─────────────────────────────────▶│
   │       Authorization: Bearer <JWT>                        │
   │                                                jwks-rsa fetches
   │                                                Microsoft public keys
   │                                                jsonwebtoken verifies:
   │                                                  - signature
   │                                                  - issuer (tenant)
   │                                                  - audience (client ID)
   │                                                  - expiry
   │◀─── 200 JSON ───────────────────────────────────────────│
   │                             │                            │
   │──── PUT /api/admin/... ─────────────────────────────────▶│
   │       (write operation)                        also checks:
   │                                                  - roles claim
   │                                                  - contains 'ProcessAdmin'
   │◀─── 200 / 403 ──────────────────────────────────────────│
```

**User roles:**

| Role | How assigned | Access |
|------|-------------|--------|
| Viewer | Any authenticated M365 user | Read approved processes |
| ProcessAdmin | Azure Portal → Enterprise Apps → Users and groups | Read all (including drafts) + all write operations |

---

## Content management

Process content is managed through two channels:

**1. Admin UI** (`/admin`)
- Create processes, upload BPMN files, edit step markdown
- Drag-and-drop BPMN upload with auto-stub generation for new steps
- Live markdown preview
- Only accessible to users with the `ProcessAdmin` role

**2. Direct file editing** (for technical users)
- Edit files in `data/processes/` directly
- Trigger an index rebuild by making any admin save via the UI, or restart PM2

---

## Data flow — process viewer

```
1. User navigates to /process/customer-onboarding
2. Frontend fetches:
   - GET /api/processes/customer-onboarding/overview  → frontmatter + markdown body
   - GET /api/processes/customer-onboarding/bpmn      → raw BPMN XML
3. bpmn-js renders the BPMN diagram
4. Element registry is scanned for start events, tasks, subprocesses, end events
5. Step list is built from the registry
6. User clicks a step → GET /api/processes/customer-onboarding/steps/<id>
7. Markdown rendered in the accordion panel
8. Start event → Triggers section extracted from overview.md
9. End event → Outcomes section extracted from overview.md
```

---

## Deployment model

### Single deployment (own use)

```
GitHub repo  ──clone──▶  Azure VM  ◀──overlay──  Azure DevOps (content)
(source code)            /opt/processhub          (real processes)
```

### White-label client deployment

Each client gets their own isolated instance:

```
GitHub repo ──clone──▶ Client Azure VM  ◀── Client DevOps (their content)
                       Client Entra tenant
                       Client branding (.env)
```

No source code changes required between deployments. The only differences are the `.env` values (Entra IDs, branding) and the content in `data/processes/`.

---

## Repository structure

| Repo | Contents | Access |
|------|----------|--------|
| GitHub (public) | Source code, sample data, docs | Public |
| Azure DevOps (private) | `data/processes/` real content | Team only |
| Server `.env` | Credentials, branding config | Server only, never in git |

---

## Key design decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Database | None — flat files | Simple to operate, easy to back up, content editable without a DB client |
| Auth | Entra ID only | Single-tenant — no external users, no password management |
| Frontend serving | Express serves built frontend | Single process, no separate static host needed |
| Step detail UI | Inline accordion | Works on all screen sizes without a separate panel |
| BPMN rendering | bpmn-js NavigatedViewer (read-only) | Zoom/pan without edit capability for viewers |
| Subprocess navigation | `data-subprocess-id` attribute on BPMN element | Links subprocess shapes to other process folders |
| Index rebuild | On every admin write | index.json always reflects current state; no cache invalidation needed |
