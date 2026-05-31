import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProcessStore } from '../store/useProcessStore'
import { api } from '../lib/api'
import { ProcessSummary } from '../types'

interface NewProcessForm {
  title: string
  category: string
  department: string
  owner: string
  owner_email: string
}

const emptyForm: NewProcessForm = { title: '', category: '', department: '', owner: '', owner_email: '' }

export function Admin() {
  const navigate = useNavigate()
  const { processes, setProcesses } = useProcessStore()
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<NewProcessForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.get<ProcessSummary[]>('/processes').then(setProcesses)
  }, [setProcesses])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const created = await api.post<{ id: string }>('/admin/processes', form)
      await api.get<ProcessSummary[]>('/processes').then(setProcesses)
      setShowModal(false)
      setForm(emptyForm)
      navigate(`/admin/process/${created.id}`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create process')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return
    await api.del(`/admin/processes/${id}`)
    setProcesses(processes.filter((p) => p.id !== id))
  }

  return (
    <div className="admin-layout">
      <div className="admin-header">
        <h2>Processes</h2>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + New process
        </button>
      </div>

      <table className="admin-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Status</th>
            <th>Version</th>
            <th>Last updated</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {processes.map((p) => (
            <tr key={p.id}>
              <td>{p.title}</td>
              <td><span className={`badge badge-${p.status}`}>{p.status}</span></td>
              <td>{p.version}</td>
              <td>{p.last_updated}</td>
              <td className="admin-row-actions">
                <button
                  className="btn btn-sm btn-outline"
                  onClick={() => navigate(`/admin/process/${p.id}`)}
                >
                  Edit
                </button>
                <button
                  className="btn btn-sm btn-danger"
                  onClick={() => handleDelete(p.id, p.title)}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>New process</h3>
            <form onSubmit={handleCreate}>
              <label>
                Title
                <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </label>
              <label>
                Category path <small>(e.g. Customer management / Onboarding)</small>
                <input required value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
              </label>
              <label>
                Department
                <input required value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
              </label>
              <label>
                Owner name
                <input required value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} />
              </label>
              <label>
                Owner email
                <input required type="email" value={form.owner_email} onChange={(e) => setForm({ ...form, owner_email: e.target.value })} />
              </label>
              {error && <div className="form-error">{error}</div>}
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Creating…' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
