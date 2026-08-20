import { useState, useEffect } from 'react'
import { api } from '../api'
import { Spinner, Empty } from '../modules/kit'

export default function FacultyHome({ user, go }: { user: any; go: (v: string) => void }) {
  const [home, setHome] = useState<any>(null)
  const [sections, setSections] = useState<any>(null)
  const [sel, setSel] = useState<any>(null)
  const [students, setStudents] = useState<any>(null)

  useEffect(() => {
    api.facultyHome().then(setHome).catch(() => {})
    api.facultySections().then(setSections).catch(() => {})
  }, [])

  function openSection(sec: any) {
    setSel(sec); setStudents(null)
    api.facultySectionStudents(sec.id).then(setStudents).catch(() => {})
  }

  if (!home) return <Spinner />
  const p = home.profile
  const k = home.kpis
  const initials = (p.name || 'F').split(' ').map((x: string) => x[0]).slice(0, 2).join('')

  return (
    <div className="fade-in">
      <div className="profile-band">
        <div className="pb-avatar">{initials}</div>
        <div>
          <div className="pb-name">{p.name}</div>
          <div className="pb-meta"><span className="mono">{p.emp_id}</span> · {p.designation} · {p.department}</div>
        </div>
        <div className="pb-stats">
          <div className="pb-stat"><div className="pb-stat-v">{k.sections}</div><div className="pb-stat-l">Sections</div></div>
          <div className="pb-stat"><div className="pb-stat-v">{k.students}</div><div className="pb-stat-l">Students</div></div>
        </div>
      </div>

      <div className="split">
        <div className="card" style={{ flex: '0 0 340px' }}>
          <div className="card-h"><h3>My sections</h3><span className="hint">{sections?.sections.length || 0} this term</span></div>
          <div className="list">
            {(sections?.sections || []).map((s: any) => (
              <button key={s.id} className={`list-item ${sel?.id === s.id ? 'on' : ''}`} onClick={() => openSection(s)}>
                <div>
                  <div className="li-title mono">{s.course_code} · {s.section}</div>
                  <div className="li-sub">{s.title}</div>
                </div>
                <div className="li-metric">{s.enrolled}</div>
              </button>
            ))}
            {(!sections || sections.sections.length === 0) && <Empty icon="📚" text="No sections assigned" />}
          </div>
        </div>

        <div className="card" style={{ flex: 1 }}>
          {!sel && <Empty icon="🎓" text="Select a section to see your class roster" />}
          {sel && !students && <Spinner />}
          {sel && students && (
            <>
              <div className="card-h">
                <h3>{sel.course_code} · Section {sel.section} — {students.students.length} students</h3>
                <div className="row-actions">
                  <button className="btn btn-sm btn-out" onClick={() => go('attendance')}>Mark attendance</button>
                  <button className="btn btn-sm btn-crimson" onClick={() => go('examinations')}>Enter marks</button>
                </div>
              </div>
              <div className="tbl-scroll">
                <table className="tbl">
                  <thead><tr><th>Roll No</th><th>Name</th><th>CGPA</th><th>Attendance</th></tr></thead>
                  <tbody>
                    {students.students.map((st: any, i: number) => (
                      <tr key={i}>
                        <td className="mono">{st.roll_no}</td>
                        <td><b>{st.name}</b></td>
                        <td><span className={`cgpa ${st.cgpa >= 8 ? 'good' : st.cgpa >= 6.5 ? 'ok' : 'low'}`}>{st.cgpa?.toFixed(2)}</span></td>
                        <td>{st.attendance_pct != null ? `${st.attendance_pct}%` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
