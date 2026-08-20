import { useState, useEffect } from 'react'
import { api } from '../api'
import { PageHead, Spinner, GatedBtn, DecisionToast, Modal } from './kit'

export default function Academics({ caps }: { caps: any }) {
  const [tab, setTab] = useState<'sections' | 'courses'>('sections')
  const [sections, setSections] = useState<any>(null)
  const [courses, setCourses] = useState<any>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [decision, setDecision] = useState<any>(null)
  const [form, setForm] = useState({ course_id: '', section_code: 'B', room: 'LH-5', schedule: 'Mon/Wed 10:00' })

  function load() {
    api.sections().then(setSections).catch(() => {})
    api.courses().then(setCourses).catch(() => {})
  }
  useEffect(() => { load() }, [])

  async function submit() {
    try {
      const r = await api.createSection(form)
      setDecision(r.decision); setShowAdd(false); load()
    } catch (e: any) { setDecision({ outcome: 'DENY', reason: e.message }) }
  }

  if (!sections || !courses) return <Spinner />

  return (
    <div className="fade-in">
      <PageHead title="Academics" sub="Course catalog and running sections for the current term"
        right={<GatedBtn can={!!caps.create_section} onClick={() => { setForm({ ...form, course_id: courses.courses[0]?.id }); setShowAdd(true) }}>+ Create section</GatedBtn>} />

      <div className="tabs">
        <button className={`tab ${tab === 'sections' ? 'on' : ''}`} onClick={() => setTab('sections')}>Sections ({sections.sections.length})</button>
        <button className={`tab ${tab === 'courses' ? 'on' : ''}`} onClick={() => setTab('courses')}>Course catalog ({courses.courses.length})</button>
      </div>

      {tab === 'sections' && (
        <div className="card">
          <div className="tbl-scroll">
            <table className="tbl">
              <thead><tr><th>Course</th><th>Sec</th><th>Faculty</th><th>Schedule</th><th>Room</th><th>Enrolled</th></tr></thead>
              <tbody>
                {sections.sections.map((s: any) => (
                  <tr key={s.id}>
                    <td><b className="mono">{s.course_code}</b> · {s.course_title}</td>
                    <td>{s.section}</td>
                    <td>{s.faculty}</td>
                    <td>{s.schedule}</td>
                    <td>{s.room}</td>
                    <td><span className="fill-bar"><span style={{ width: `${(s.enrolled / s.capacity) * 100}%` }} /></span> {s.enrolled}/{s.capacity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'courses' && (
        <div className="card">
          <div className="tbl-scroll">
            <table className="tbl">
              <thead><tr><th>Code</th><th>Title</th><th>Dept</th><th>Credits</th><th>Semester</th></tr></thead>
              <tbody>
                {courses.courses.map((c: any) => (
                  <tr key={c.id}>
                    <td className="mono"><b>{c.code}</b></td>
                    <td>{c.title}</td>
                    <td>{c.dept}</td>
                    <td>{c.credits}</td>
                    <td>Sem {c.semester}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showAdd && (
        <Modal title="Create a new section" onClose={() => setShowAdd(false)}
          footer={<><button className="btn btn-out" onClick={() => setShowAdd(false)}>Cancel</button>
            <button className="btn btn-brass" onClick={submit}>Create</button></>}>
          <div className="form-row"><label>Course</label>
            <select className="select" value={form.course_id} onChange={e => setForm({ ...form, course_id: e.target.value })}>
              {courses.courses.map((c: any) => <option key={c.id} value={c.id}>{c.code} — {c.title}</option>)}
            </select></div>
          <div className="grid-2">
            <div className="form-row"><label>Section code</label>
              <input className="inp" value={form.section_code} onChange={e => setForm({ ...form, section_code: e.target.value })} /></div>
            <div className="form-row"><label>Room</label>
              <input className="inp" value={form.room} onChange={e => setForm({ ...form, room: e.target.value })} /></div>
          </div>
          <div className="form-row"><label>Schedule</label>
            <input className="inp" value={form.schedule} onChange={e => setForm({ ...form, schedule: e.target.value })} /></div>
        </Modal>
      )}

      {decision && <DecisionToast decision={decision} onClose={() => setDecision(null)} />}
    </div>
  )
}
