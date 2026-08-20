import { useState, useEffect } from 'react'
import { api } from '../api'
import { PageHead, Spinner, GatedBtn, DecisionToast, Modal } from './kit'

const DEPTS = ['', 'CSE', 'ECE', 'MEC', 'CIV', 'EEE', 'MAT', 'MGT', 'HSS']

export default function Students({ caps }: { caps: any }) {
  const [q, setQ] = useState('')
  const [dept, setDept] = useState('')
  const [view, setView] = useState<any>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [decision, setDecision] = useState<any>(null)
  const [form, setForm] = useState({ name: '', dept_code: 'CSE', batch: '2025', semester: 1, program_level: 'UG' })

  function load() { api.students(q, dept).then(setView).catch(() => {}) }
  useEffect(() => { load() }, [])

  async function submit() {
    try {
      const r = await api.addStudent(form)
      setDecision(r.decision)
      setShowAdd(false)
      setForm({ ...form, name: '' })
      load()
    } catch (e: any) { setDecision({ outcome: 'DENY', reason: e.message }) }
  }

  if (!view) return <Spinner />

  return (
    <div className="fade-in">
      <PageHead title="Student records" sub={`${view?.total ?? 0} students · scope-filtered to your authority`}
        right={<GatedBtn can={!!caps.add} onClick={() => setShowAdd(true)}>+ Admit student</GatedBtn>} />

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input className="inp" style={{ maxWidth: 320 }} placeholder="Search name or roll no…"
          value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && load()} />
        <select className="select" value={dept} onChange={e => { setDept(e.target.value) }}>
          {DEPTS.map(d => <option key={d} value={d}>{d || 'All departments'}</option>)}
        </select>
        <button className="btn btn-out" onClick={load}>Apply</button>
      </div>

      <div className="card">
        <div className="tbl-scroll">
          <table className="tbl">
            <thead><tr>
              <th>Roll No</th><th>Name</th><th>Dept</th><th>Batch</th><th>Sem</th><th>CGPA</th><th>Status</th><th>Flags</th>
            </tr></thead>
            <tbody>
              {(view?.students || []).map((s: any) => (
                <tr key={s.id}>
                  <td className="mono">{s.roll_no}</td>
                  <td><b>{s.name}</b></td>
                  <td>{s.dept}</td>
                  <td>{s.batch}</td>
                  <td>{s.semester}</td>
                  <td><span className={`cgpa ${s.cgpa >= 8 ? 'good' : s.cgpa >= 6.5 ? 'ok' : 'low'}`}>{s.cgpa.toFixed(2)}</span></td>
                  <td><span className={`pill s-${s.status}`}>{s.status}</span></td>
                  <td>
                    {s.hosteller && <span className="tag">Hosteller</span>}
                    {s.scholarship && <span className="tag tag-brass">Scholarship</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showAdd && (
        <Modal title="Admit new student" onClose={() => setShowAdd(false)}
          footer={<>
            <button className="btn btn-out" onClick={() => setShowAdd(false)}>Cancel</button>
            <button className="btn btn-brass" onClick={submit} disabled={!form.name}>Admit</button>
          </>}>
          <div className="form-row"><label>Full name</label>
            <input className="inp" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
          <div className="grid-2">
            <div className="form-row"><label>Department</label>
              <select className="select" value={form.dept_code} onChange={e => setForm({ ...form, dept_code: e.target.value })}>
                {DEPTS.filter(Boolean).map(d => <option key={d}>{d}</option>)}
              </select></div>
            <div className="form-row"><label>Level</label>
              <select className="select" value={form.program_level} onChange={e => setForm({ ...form, program_level: e.target.value })}>
                <option>UG</option><option>PG</option>
              </select></div>
          </div>
          <div className="grid-2">
            <div className="form-row"><label>Batch year</label>
              <input className="inp" value={form.batch} onChange={e => setForm({ ...form, batch: e.target.value })} /></div>
            <div className="form-row"><label>Semester</label>
              <input className="inp" type="number" value={form.semester} onChange={e => setForm({ ...form, semester: Number(e.target.value) })} /></div>
          </div>
          <p className="hint">This action passes through the authority engine and is written to the audit log.</p>
        </Modal>
      )}

      {decision && <DecisionToast decision={decision} onClose={() => setDecision(null)} />}
    </div>
  )
}
