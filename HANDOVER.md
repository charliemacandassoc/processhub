# Process Hub — Handover Document
**Version:** 2.0 — Post-build update  
**Original spec:** Charlie Mac and Associates v1.0  
**Updated:** May 2025 — reflects all design decisions made during implementation  
**Status:** Built, verified, ready for production deployment

---

## 1. Purpose and scope

Process Hub is a web application that allows staff to view, navigate, and understand business process flows defined in BPMN. An admin interface allows process owners to manage process content. Access is controlled via Microsoft Entra ID single sign-on — only users within your Microsoft 365 tenant can authenticate.

The app is designed for **white-label re-deployment**: all branding is driven by environment variables so a client can run their own branded instance in their own Azure tenant without touching source code.

---

## 2. Technology stack

### 2.1 Frontend
| Package | Version | Purpose |
|---------|---------|---------|
| Vite + React | Latest | Build tooling and UI framework |
| TypeScript | 5.x | Type safety |
| React Router | v6 | Client-side routing |
| @azure/msal-react | Latest | Entra ID SSO |
| bpmn-js | Latest | Zoomable, pannable BPMN canvas |
| react-markdown | Latest | Markdown rendering |
| remark-gfm | Latest | GFM tables, strikethrough |
| flexsearch | Latest | Client-side full-text search |
| Zustand | Latest | Global app state |

### 2.2 Backend
| Package | Version | Purpose |
|---------|---------|---------|
| Node.js + Express | 18+ LTS | API server |
| TypeScript | 5.x | Shared types |
| jsonwebtoken | Latest | Validate Entra JWT |
| jwks-rsa | Latest | Fetch Microsoft public keys |
| multer | Latest | File upload (.bpmn, .md) |
| gray-matter | Latest | Parse YAML frontmatter |
| cors | Latest | CORS headers for dev |

---

## 3. Project structure

```
process-hub/
├── frontend/                  # Vite + React app
│   ├── public/
│   │   └── logo.svg           # Default dummy logo (replace for white-label)
│   └── src/
│       ├── main.tsx            # MSAL provider wraps app
│       ├── App.tsx             # Router root + dev-mode bypass
│       ├── authConfig.ts       # MSAL configuration
│       ├── config.ts           # White-label + Entra env vars
│       ├── pages/
│       │   ├── LoginPage.tsx
│       │   ├── Inventory.tsx
│       │   ├── ProcessViewer.tsx
│       │   ├── Admin.tsx
│       │   └── AdminProcessEditor.tsx
│       ├── components/
│       │   ├── AppLayout.tsx   # Persistent sidebar wrapper
│       │   ├── NavBar.tsx
│       │   ├── BpmnCanvas.tsx
│       │   ├── StepList.tsx
│       │   ├── DetailPanel.tsx
│       │   ├── OverviewCard.tsx
│       │   ├── Breadcrumb.tsx
│       │   ├── ProcessInventoryTable.tsx
│       │   ├── ProcessTreeNav.tsx
│       │   ├── MarkdownRenderer.tsx
│       │   └── RequireAdmin.tsx
│       ├── store/
│       │   └── useProcessStore.ts
│       ├── hooks/
│       │   └── useSearch.ts
│       ├── lib/
│       │   ├── api.ts          # fetch wrapper (get, getText, put, post, postForm, del)
│       │   └── markdown.ts     # extractSection / stripSections helpers
│       └── types/
│           └── index.ts
├── backend/
│   └── src/
│       ├── index.ts            # Express entry — serves built frontend in prod
│       ├── auth.ts             # JWT validation + dev bypass
│       └── routes/
│           ├── processes.ts    # Public read endpoints
│           ├── admin.ts        # ProcessAdmin write endpoints
│           └── lib/
│               └── indexBuilder.ts  # Rebuilds index.json after writes
├── data/                       # Flat-file content store
│   ├── index.json              # Auto-maintained — do not edit manually
│   └── processes/
│       └── <process-id>/
│           ├── overview.md
│           ├── process.bpmn
│           ├── steps/
│           │   └── <bpmn-element-id>.md
│           └── checklists/
│               └── *.md
└── deploy/
    ├── main.bicep              # Azure VM + networking IaC
    ├── deploy.sh               # One-shot deployment script
    └── nginx.conf              # Reverse proxy config
```

---

## 4. Application routes

| Route | Auth required | Description |
|-------|--------------|-------------|
| `/` | Viewer | Redirects to `/inventory` |
| `/inventory` | Viewer | Process inventory + sidebar nav |
| `/process/:id` | Viewer | BPMN viewer for a specific process |
| `/admin` | ProcessAdmin | Process list and management |
| `/admin/process/:id` | ProcessAdmin | Edit overview, BPMN, steps |

**Viewer** = any authenticated Entra user in your tenant.  
**ProcessAdmin** = users with the `ProcessAdmin` app role assigned in the Azure App Registration.

---

## 5. Authentication — Entra ID

### 5.1 Frontend (MSAL)

The entire app is wrapped in `MsalProvider`. Unauthenticated users see only a login redirect — no app content is visible.

**Design decision — dev bypass:** When `VITE_ENTRA_CLIENT_ID` is not set (local development without a real Entra registration), the app auto-authenticates as a local admin user named "Dev User". This mirrors the backend's dev bypass. Set the env var to activate real Entra auth.

- Uses `loginRedirect()` (not popup) for SSO compatibility
- Token stored in Zustand alongside user claims
- `roles` claim checked for `ProcessAdmin` — admin nav items shown if present
- Bearer token attached to every API call via the `api` lib

### 5.2 Backend (JWT validation)

Every endpoint uses `requireAuth` middleware. Admin-mutating endpoints use `requireAdmin`.

**Design decision — dev bypass:** When `ENTRA_TENANT_ID` / `ENTRA_CLIENT_ID` env vars are not set, JWT validation is skipped and all requests are treated as ProcessAdmin. Set both env vars to activate real validation.

JWKS endpoint: `https://login.microsoftonline.com/{tenantId}/discovery/v2.0/keys`

Validation checks: signature, issuer, audience (client ID), expiry, and `ProcessAdmin` in roles claim for write operations.

### 5.3 Azure App Registration config

| Setting | Value |
|---------|-------|
| Supported account types | Single tenant (your organisation only) |
| Redirect URI | `http://localhost:5173` (dev), `https://yourdomain.com` (prod) |
| Token type | Access token + ID token |
| App roles | `ProcessAdmin` — value: `ProcessAdmin`, allowed member types: Users/Groups |

### 5.4 Environment variables

```env
# Entra ID
VITE_ENTRA_CLIENT_ID=<app-registration-client-id>
VITE_ENTRA_TENANT_ID=<your-tenant-id>
ENTRA_CLIENT_ID=<same-client-id>
ENTRA_TENANT_ID=<same-tenant-id>

# White-label branding (all optional)
VITE_APP_NAME=Process Hub
VITE_TENANT_NAME=Your Organisation
VITE_PRIMARY_COLOR=#0078d4
VITE_LOGO_URL=                  # URL to logo image; falls back to /logo.svg

# Server
PORT=3001
CORS_ORIGIN=http://localhost:5173
```

---

## 6. Data model

### 6.1 index.json

Auto-rebuilt by the backend after every write. Do not edit manually — run `indexBuilder.rebuild()` or make any admin save to regenerate.

```json
{
  "processes": [
    {
      "id": "customer-onboarding",
      "title": "Customer onboarding",
      "category": ["Customer management", "Onboarding"],
      "department": "Customer Experience",
      "owner": "Sarah Chen",
      "owner_email": "s.chen@yourcompany.com",
      "status": "approved",
      "version": "1.2",
      "last_updated": "2025-04-12",
      "objective": "First paragraph of overview body (for search indexing)"
    }
  ]
}
```

`category` is split from the frontmatter `category` field on ` / `. Max 3 levels.  
Draft processes are visible in the inventory table but the Open link is disabled for non-admin viewers.

### 6.2 overview.md frontmatter and sections

```markdown
---
title: Customer onboarding
category: Customer management / Onboarding
department: Customer Experience
owner: Sarah Chen
owner_email: s.chen@yourcompany.com
status: approved
version: "1.2"
last_updated: "2025-04-12"
---

## Objective
...

## Performance measures
...

## Triggers
...

## Outcomes
...
```

**Design decision — Triggers and Outcomes sections:** These two sections are stripped from the Overview card. Instead, they surface in the step list:
- `## Triggers` → displayed when the user expands the BPMN **start event** step row
- `## Outcomes` → displayed when the user expands a BPMN **end event** step row

The Overview card shows only Objective and Performance measures.

### 6.3 Step markdown frontmatter

File must be named exactly after the BPMN element ID (e.g. `task_submit_application.md`).

```markdown
---
sme: Jamie Walsh
sme_role: Onboarding Lead
sme_email: j.walsh@yourcompany.com
status: approved
version: "1.2"
last_updated: "2025-04-12"
---

Step detail content here. Supports GFM, mermaid blocks, video embeds, checklist download links.

![video](https://youtu.be/xxxx)
[Download checklist](checklists/onboarding-checklist.md)
```

**Design decision — version field:** Uses step-level frontmatter version, not the parent process version. This allows steps to be updated independently.

**Design decision — owner_email:** Must be an Entra ID UPN (user@domain.com) — these are real M365 accounts displayed as mailto links.

### 6.4 BPMN-to-step linking

The BPMN element `id` attribute is the link key. Clicking a shape in bpmn-js reads `element.id` and fetches `/api/processes/:processId/steps/:stepId`.

---

## 7. UI design decisions

### 7.1 Layout

- **Persistent sidebar:** `AppLayout` wraps all pages. The `ProcessTreeNav` sidebar is always visible on desktop regardless of which page is open (inventory or process viewer).
- **No right detail panel:** Step detail is shown as an **exclusive accordion** inline under each step row, on all screen sizes. Only one step can be open at a time.
- **Hamburger on mobile:** Sidebar slides in as a drawer on screens < 768px with a backdrop overlay.

### 7.2 Step list — start and end events

**Design decision:** `bpmn:StartEvent` and `bpmn:EndEvent` elements are included in the step list alongside tasks.

- Start events show a **green ●** icon and expand to show the **Triggers** section from overview.md
- End events show a **green ◉** icon and expand to show the **Outcomes** section from overview.md
- Task steps show a numbered badge
- Subprocess steps show a purple **SUBPROCESS** badge and a "Dive into subprocess" button when expanded

**Implementation note:** bpmn-js creates internal `_plane` elements for collapsed SubProcesses (e.g. `task_verify_identity_plane`). These are filtered out by checking `!el.id.endsWith('_plane')`.

### 7.3 BpmnCanvas — callback refs pattern

**Design decision:** The BpmnCanvas viewer is only re-mounted when the BPMN XML changes. Callbacks (`onStepSelect`, `onSubprocessNavigate`, `onStepsLoaded`) are stored in refs so the viewer `useEffect` dependency array only contains `xml`. Without this, every step click causes a state update → new function references → viewer teardown → infinite loop.

### 7.4 BPMN canvas controls

- Zoom controls (fit / + / −) positioned **top-right** of the canvas
- `bjs-powered-by` watermark hidden via CSS (`display: none`)
- Selected element highlighted using `canvas.addMarker(id, 'bpmn-selected')` with CSS fill override — this correctly fills the shape bounds rather than using a fixed-size overlay div

### 7.5 Breadcrumb

- Category segments link back to `/inventory`
- Subprocess ancestor chain is clickable — clicking an ancestor pops the Zustand breadcrumb stack and navigates back to that process
- Current process name is non-interactive (it's the current page)

### 7.6 White-labelling

All branding is env-var driven at build time:

| Env var | Effect |
|---------|--------|
| `VITE_APP_NAME` | App name in navbar (fallback when no logo) and login page |
| `VITE_TENANT_NAME` | "Sign in with your **X** Microsoft 365 account" on login page |
| `VITE_PRIMARY_COLOR` | CSS `--primary` variable (buttons, links, highlights, nav) |
| `VITE_LOGO_URL` | Logo in navbar; if set, the text app name is hidden |

A default SVG logo (`/public/logo.svg`) ships with the repo for demo purposes. Replace `VITE_LOGO_URL` or drop a new file into `public/` for client deployments.

---

## 8. Backend API

### 8.1 Public endpoints (any authenticated user)

| Endpoint | Description |
|----------|-------------|
| `GET /api/processes` | Returns index.json (drafts filtered for non-admins) |
| `GET /api/processes/:id/overview` | Returns `{ frontmatter, content }` |
| `GET /api/processes/:id/bpmn` | Returns raw BPMN XML (Content-Type: application/xml) |
| `GET /api/processes/:id/steps/:stepId` | Returns `{ frontmatter, content }` |
| `GET /api/processes/:id/checklists/:file` | Returns .md with Content-Disposition: attachment |

**Note:** The BPMN endpoint returns XML, not JSON. Use `api.getText()` on the frontend — not `api.get()` — for this endpoint.

### 8.2 Admin endpoints (ProcessAdmin role required)

| Endpoint | Description |
|----------|-------------|
| `POST /api/admin/processes` | Create process folder + overview.md skeleton |
| `PUT /api/admin/processes/:id/overview` | Save overview.md; rebuilds index.json |
| `POST /api/admin/processes/:id/bpmn` | Upload .bpmn; parses and returns step IDs |
| `PUT /api/admin/processes/:id/steps/:stepId` | Save step markdown |
| `POST /api/admin/processes/:id/checklists` | Upload checklist .md |
| `DELETE /api/admin/processes/:id` | Delete process folder; rebuilds index.json |

After every metadata-affecting write, `indexBuilder.rebuild()` regenerates `index.json` from all `overview.md` files.

### 8.3 Data path

**Critical implementation note:** Route files are at `backend/src/routes/`. The data directory is at the repo root. From `routes/`, the relative path is `../../../data` (3 levels up). Using `../../../../data` resolves to the parent of the repo root and causes silent empty responses.

---

## 9. Zustand store

```typescript
interface ProcessStore {
  // Auth
  user: { name: string; email: string; isAdmin: boolean } | null
  token: string | null
  setUser: (user, token) => void

  // Inventory
  processes: ProcessSummary[]
  setProcesses: (processes) => void
  searchQuery: string
  setSearchQuery: (q) => void

  // Process viewer
  activeProcessId: string | null
  activeStepId: string | null          // null = no step open
  breadcrumbStack: BreadcrumbEntry[]
  setActiveProcess: (id) => void       // resets activeStepId and breadcrumbStack
  setActiveStep: (id | null) => void   // null closes the accordion
  pushSubprocess: (entry) => void
  popToLevel: (index) => void
  clearProcess: () => void
}
```

**Design decision — toggle behaviour:** Calling `setActiveStep` with the currently active step ID closes it (sets to null). This gives the accordion toggle behaviour without needing separate open/closed state.

---

## 10. Admin interface

### 10.1 Process list (`/admin`)

Lists all processes including drafts. New process modal collects: title, category path, department, owner name, owner email. On submit, calls `POST /api/admin/processes` and navigates to the editor.

### 10.2 Process editor (`/admin/process/:id`)

Three tabs:

**Overview tab:** Structured fields (title, category, department, owner, owner_email, status dropdown, version) + full-width markdown textarea for the body. Live preview panel on the right.

**BPMN file tab:** Upload `.bpmn` file. Backend parses element IDs and returns them in a read-only table. Also allows uploading checklist `.md` files.

**Steps tab:** List of step IDs from the uploaded BPMN. Clicking a step ID opens a split editor: structured frontmatter fields + markdown textarea + live preview.

**Design decision — save behaviour:** Changes are not auto-saved. Save/Discard buttons in the footer. Last saved timestamp shown after each save.

---

## 11. Responsive behaviour

| Breakpoint | Changes |
|-----------|---------|
| Desktop (>1024px) | Full layout: sidebar + BPMN + overview + step list accordion |
| Tablet (768–1024px) | Smaller detail widths; sidebar remains visible |
| Mobile (<768px) | Sidebar becomes hamburger drawer with backdrop; BPMN canvas height 200px; overview auto-collapsed |

Step detail accordion is **always inline under each step row** on all screen sizes. There is no separate right-side detail panel.

---

## 12. Resolved open items from v1.0 spec

| Item | Resolution |
|------|-----------|
| Step version = step or process? | **Step-level** frontmatter version — steps update independently |
| Step IDs — manual or auto? | **Auto-parsed** from BPMN upload; returned to frontend as a read-only list |
| Draft/publish workflow | Deferred — not in scope for v1 |
| Process versioning history | Deferred — not in scope for v1 |
| Email notifications | Deferred — not in scope for v1 |

---

## 13. Known issues and future work

- **Multiple end events:** A process with two end events (e.g. "Customer active" and "Application rejected") both show the same Outcomes content. A future improvement would allow per-end-event outcome markdown files.
- **Admin steps tab:** Requires a BPMN to be uploaded first to populate the step ID list. If no BPMN is uploaded, the list is empty with a hint message.
- **FlexSearch index refresh:** The client-side search index rebuilds on app load and after admin saves. It does not auto-refresh if content changes in another browser tab.

---

## 14. Sample data

The repo ships with two sample processes:

**customer-onboarding** (approved, v1.2)
- 3 task steps: Submit application, Verify identity (subprocess), Account setup
- Start event: Application received (Triggers)
- End events: Customer active (Outcomes), Application rejected (Outcomes)
- Checklist: `onboarding-checklist.md`

**identity-verification** (approved, v1.1)
- 4 task steps: OCR document check, Watchlist & sanctions screening, Manual review, Log outcome & notify
- Referenced as subprocess from customer-onboarding via `data-subprocess-id="identity-verification"` on the Verify identity shape
