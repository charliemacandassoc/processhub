import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { ProcessOverview, StepDetail, BpmnStepInfo } from '../types'
import { MarkdownRenderer } from '../components/MarkdownRenderer'

type Tab = 'overview' | 'bpmn' | 'steps'

export function AdminProcessEditor() {
  const { id } = useParams<{ id: string }>()
  const [tab, setTab] = useState<Tab>('overview')
  const [overview, setOverview] = useState<ProcessOverview | null>(null)
  const [bpmnSteps, setBpmnSteps] = useState<BpmnStepInfo[]>([])
  const [activeStepId, setActiveStepId] = useState<string | null>(null)
  const [stepDetail, setStepDetail] = useState<StepDetail | null>(null)
  const [lastSaved, setLastSaved] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [bpmnStatus, setBpmnStatus] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  // Overview form state
  const [fm, setFm] = useState({
    title: '', category: '', department: '', owner: '', owner_email: '',
    status: 'draft' as 'approved' | 'draft', version: '1.0',
  })
  const [overviewBody, setOverviewBody] = useState('')

  // Step editor state
  const [stepFm, setStepFm] = useState({
    sme: '', sme_role: '', sme_email: '',
    status: 'draft' as 'approved' | 'draft', version: '1.0', last_updated: '',
  })
  const [stepBody, setStepBody] = useState('')

  // Load overview + existing BPMN step IDs on mount
  useEffect(() => {
    if (!id) return
    api.get<ProcessOverview>(`/processes/${id}/overview`).then((ov) => {
      setOverview(ov)
      const f = ov.frontmatter
      setFm({
        title: f.title, category: f.category.join(' / '),
        department: f.department, owner: f.owner, owner_email: f.owner_email,
        status: f.status, version: f.version,
      })
      setOverviewBody(ov.content)
    })
    // Load step IDs from stored BPMN — no re-upload needed
    api.get<{ steps: BpmnStepInfo[] }>(`/admin/processes/${id}/bpmn-steps`)
      .then((r) => setBpmnSteps(r.steps))
      .catch(() => {})
  }, [id])

  useEffect(() => {
    if (!id || !activeStepId) return
    api.get<StepDetail>(`/processes/${id}/steps/${activeStepId}`).then((d) => {
      setStepDetail(d)
      setStepFm({ ...d.frontmatter })
      setStepBody(d.content)
      setDirty(false)
    }).catch(() => {})
  }, [id, activeStepId])

  async function saveOverview() {
    if (!id) return
    setSaving(true)
    try {
      await api.put(`/admin/processes/${id}/overview`, { frontmatter: { ...fm, category: fm.category }, content: overviewBody })
      setLastSaved(new Date().toLocaleTimeString())
      setDirty(false)
    } finally { setSaving(false) }
  }

  async function saveStep() {
    if (!id || !activeStepId) return
    setSaving(true)
    try {
      await api.put(`/admin/processes/${id}/steps/${activeStepId}`, { frontmatter: stepFm, content: stepBody })
      setLastSaved(new Date().toLocaleTimeString())
      setDirty(false)
    } finally { setSaving(false) }
  }

  // Upload BPMN file — used by both file input and drag-and-drop
  const uploadBpmn = useCallback(async (file: File) => {
    if (!id) return
    setBpmnStatus('Uploading…')
    const form = new FormData()
    form.append('bpmn', file)
    try {
      const result = await api.postForm<{ steps: BpmnStepInfo[] }>(`/admin/processes/${id}/bpmn`, form)
      setBpmnSteps(result.steps)
      setBpmnStatus(`✓ Uploaded — ${result.steps.length} step${result.steps.length !== 1 ? 's' : ''} found. Stub markdown created for any new steps.`)
    } catch {
      setBpmnStatus('✗ Upload failed — check the file is valid BPMN 2.0 XML.')
    }
  }, [id])

  const fileRef = useRef<HTMLInputElement>(null)

  function handleBpmnInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) uploadBpmn(file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) uploadBpmn(file)
  }

  async function handleChecklistUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !id) return
    const form = new FormData()
    form.append('checklist', file)
    await api.postForm(`/admin/processes/${id}/checklists`, form)
  }

  if (!overview) return <div className="loading">Loading…</div>

  return (
    <div className="admin-editor">
      <div className="admin-editor-header">
        <h2>{fm.title || 'Process editor'}</h2>
        <div className="editor-tabs">
          {(['overview', 'bpmn', 'steps'] as Tab[]).map((t) => (
            <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
              {t === 'steps' && bpmnSteps.length > 0 && (
                <span className="tab-count">{bpmnSteps.length}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {tab === 'overview' && (
        <div className="editor-split">
          <div className="editor-form">
            <FieldRow label="Title">
              <input value={fm.title} onChange={(e) => { setFm({ ...fm, title: e.target.value }); setDirty(true) }} />
            </FieldRow>
            <FieldRow label="Category path">
              <input value={fm.category} onChange={(e) => { setFm({ ...fm, category: e.target.value }); setDirty(true) }} placeholder="Top / Sub" />
            </FieldRow>
            <FieldRow label="Department">
              <input value={fm.department} onChange={(e) => { setFm({ ...fm, department: e.target.value }); setDirty(true) }} />
            </FieldRow>
            <FieldRow label="Owner name">
              <input value={fm.owner} onChange={(e) => { setFm({ ...fm, owner: e.target.value }); setDirty(true) }} />
            </FieldRow>
            <FieldRow label="Owner email">
              <input type="email" value={fm.owner_email} onChange={(e) => { setFm({ ...fm, owner_email: e.target.value }); setDirty(true) }} />
            </FieldRow>
            <FieldRow label="Status">
              <select value={fm.status} onChange={(e) => { setFm({ ...fm, status: e.target.value as 'approved' | 'draft' }); setDirty(true) }}>
                <option value="draft">Draft</option>
                <option value="approved">Approved</option>
              </select>
            </FieldRow>
            <FieldRow label="Version">
              <input value={fm.version} onChange={(e) => { setFm({ ...fm, version: e.target.value }); setDirty(true) }} />
            </FieldRow>
            <label className="field-label">Overview body (markdown)</label>
            <textarea className="md-textarea" value={overviewBody} onChange={(e) => { setOverviewBody(e.target.value); setDirty(true) }} rows={18} />
          </div>
          <div className="editor-preview">
            <h4>Preview</h4>
            <MarkdownRenderer content={overviewBody} processId={id!} />
          </div>
        </div>
      )}

      {tab === 'bpmn' && (
        <div className="editor-bpmn">
          {/* Drag-and-drop upload zone */}
          <div
            className={`bpmn-drop-zone ${dragging ? 'dragging' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
          >
            <input ref={fileRef} type="file" accept=".bpmn" onChange={handleBpmnInputChange} className="file-input-hidden" />
            <div className="drop-zone-icon">⊞</div>
            <p><strong>Drop a .bpmn file here</strong> or click to browse</p>
            <p className="drop-zone-hint">BPMN 2.0 XML — exported from Camunda, Lucidchart, draw.io, etc.</p>
          </div>

          {bpmnStatus && (
            <div className={`bpmn-upload-status ${bpmnStatus.startsWith('✓') ? 'success' : bpmnStatus.startsWith('✗') ? 'error' : ''}`}>
              {bpmnStatus}
            </div>
          )}

          {bpmnSteps.length > 0 && (
            <>
              <h4 className="bpmn-steps-heading">Parsed steps ({bpmnSteps.length})</h4>
              <table className="bpmn-steps-table">
                <thead><tr><th>Element ID</th><th>Label</th><th>Subprocess?</th></tr></thead>
                <tbody>
                  {bpmnSteps.map((s) => (
                    <tr key={s.id}>
                      <td><code>{s.id}</code></td>
                      <td>{s.label}</td>
                      <td>{s.isSubprocess ? '✓' : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          <hr style={{ margin: '24px 0' }} />
          <h4>Checklist files</h4>
          <p className="hint">Upload a <code>.md</code> checklist. Reference it in step markdown with <code>[Download checklist](checklists/filename.md)</code></p>
          <input type="file" accept=".md" onChange={handleChecklistUpload} className="file-input" />
        </div>
      )}

      {tab === 'steps' && (
        <div className="editor-steps-layout">
          <div className="step-id-list">
            <h4>Steps</h4>
            {bpmnSteps.length === 0
              ? <p className="hint">Upload a BPMN file on the BPMN tab first.</p>
              : bpmnSteps.map((s) => (
                <button
                  key={s.id}
                  className={`step-id-btn ${activeStepId === s.id ? 'active' : ''}`}
                  onClick={() => setActiveStepId(s.id)}
                >
                  <span>{s.label}</span>
                  <code>{s.id}</code>
                </button>
              ))
            }
          </div>

          {activeStepId ? (
            <div className="editor-split">
              <div className="editor-form">
                <FieldRow label="SME name">
                  <input value={stepFm.sme} onChange={(e) => { setStepFm({ ...stepFm, sme: e.target.value }); setDirty(true) }} />
                </FieldRow>
                <FieldRow label="SME role">
                  <input value={stepFm.sme_role} onChange={(e) => { setStepFm({ ...stepFm, sme_role: e.target.value }); setDirty(true) }} />
                </FieldRow>
                <FieldRow label="SME email">
                  <input type="email" value={stepFm.sme_email} onChange={(e) => { setStepFm({ ...stepFm, sme_email: e.target.value }); setDirty(true) }} />
                </FieldRow>
                <FieldRow label="Status">
                  <select value={stepFm.status} onChange={(e) => { setStepFm({ ...stepFm, status: e.target.value as 'approved' | 'draft' }); setDirty(true) }}>
                    <option value="draft">Draft</option>
                    <option value="approved">Approved</option>
                  </select>
                </FieldRow>
                <FieldRow label="Version">
                  <input value={stepFm.version} onChange={(e) => { setStepFm({ ...stepFm, version: e.target.value }); setDirty(true) }} />
                </FieldRow>
                <FieldRow label="Last updated">
                  <input type="date" value={stepFm.last_updated} onChange={(e) => { setStepFm({ ...stepFm, last_updated: e.target.value }); setDirty(true) }} />
                </FieldRow>
                <label className="field-label">Step content (markdown)</label>
                <textarea
                  className="md-textarea"
                  value={stepBody}
                  onChange={(e) => { setStepBody(e.target.value); setDirty(true) }}
                  rows={16}
                />
              </div>
              <div className="editor-preview">
                <h4>Preview</h4>
                <MarkdownRenderer content={stepBody} processId={id!} />
              </div>
            </div>
          ) : (
            <div className="editor-no-step">← Select a step to edit its content</div>
          )}
        </div>
      )}

      <div className="editor-footer">
        {lastSaved && <span className="last-saved">Last saved {lastSaved}</span>}
        <button
          className="btn btn-ghost"
          onClick={() => {
            if (tab === 'overview' && overview) {
              setFm({ title: overview.frontmatter.title, category: overview.frontmatter.category.join(' / '), department: overview.frontmatter.department, owner: overview.frontmatter.owner, owner_email: overview.frontmatter.owner_email, status: overview.frontmatter.status, version: overview.frontmatter.version })
              setOverviewBody(overview.content)
            }
            if (tab === 'steps' && stepDetail) {
              setStepFm({ ...stepDetail.frontmatter })
              setStepBody(stepDetail.content)
            }
            setDirty(false)
          }}
          disabled={!dirty}
        >
          Discard
        </button>
        <button
          className="btn btn-primary"
          onClick={tab === 'overview' ? saveOverview : tab === 'steps' ? saveStep : undefined}
          disabled={saving || !dirty || tab === 'bpmn'}
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  )
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field-row">
      <span className="field-label">{label}</span>
      {children}
    </label>
  )
}
