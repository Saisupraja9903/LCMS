import { useEffect, useState } from 'react'
import { api } from '../api'
import { Spinner, money } from '../modules/kit'

type StudentTab = 'overview' | 'courses' | 'attendance' | 'results' | 'fees'

export default function StudentHome({ user, go }: { user: any; go: (v: string) => void }) {
  const [tab, setTab] = useState<StudentTab>('overview')
  const [home, setHome] = useState<any>(null)
  const [courses, setCourses] = useState<any>({ courses: [] })
  const [attendance, setAttendance] = useState<any>({ summary: [], recent: [] })
  const [results, setResults] = useState<any>({ marks: [], cgpa: null })
  const [fees, setFees] = useState<any>({ invoices: [], payments: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true

    async function load() {
      setLoading(true)
      setError('')

      const [homeRes, coursesRes, attendanceRes, resultsRes, feesRes] = await Promise.allSettled([
        api.studentHome(),
        api.studentCourses(),
        api.studentAttendance(),
        api.studentResults(),
        api.studentFees(),
      ])

      if (!active) return

      if (homeRes.status !== 'fulfilled') {
        setError('We could not load the student overview right now.')
        setHome(null)
        setLoading(false)
        return
      }

      setHome(homeRes.value)
      setCourses(coursesRes.status === 'fulfilled' ? coursesRes.value : { courses: [] })
      setAttendance(attendanceRes.status === 'fulfilled' ? attendanceRes.value : { summary: [], recent: [] })
      setResults(resultsRes.status === 'fulfilled' ? resultsRes.value : { marks: [], cgpa: homeRes.value?.profile?.cgpa ?? null })
      setFees(feesRes.status === 'fulfilled' ? feesRes.value : { invoices: [], payments: [] })
      setLoading(false)
    }

    load()
    return () => {
      active = false
    }
  }, [reloadKey])

  if (loading) return <Spinner />

  if (error || !home) {
    return (
      <div className="card fade-in">
        <div className="card-h"><h3>Student overview unavailable</h3></div>
        <div className="card-pad">
          <p style={{ color: 'var(--txt-soft)', lineHeight: 1.7 }}>
            {error || 'The student portal could not resolve a linked profile for this session.'}
          </p>
          <button className="btn btn-crimson" onClick={() => setReloadKey(key => key + 1)} type="button">
            Try again
          </button>
        </div>
      </div>
    )
  }

  const profile = home.profile
  const kpis = home.kpis
  const initials = (profile.name || user.name || 'S')
    .split(' ')
    .map((part: string) => part[0])
    .slice(0, 2)
    .join('')

  return (
    <div className="fade-in">
      <div className="profile-band">
        <div className="pb-avatar">{initials}</div>
        <div>
          <div className="pb-name">{profile.name}</div>
          <div className="pb-meta">
            <span className="mono">{profile.roll_no}</span> - {profile.department} - Semester {profile.semester} - Batch {profile.batch}
            {profile.hosteller && <span className="tag" style={{ marginLeft: 8 }}>Hosteller</span>}
            {profile.scholarship && <span className="tag tag-brass">Scholarship</span>}
          </div>
        </div>
        <div className="pb-stats">
          <div className="pb-stat">
            <div className="pb-stat-v">{profile.cgpa?.toFixed(2)}</div>
            <div className="pb-stat-l">CGPA</div>
          </div>
          <div className="pb-stat">
            <div className="pb-stat-v">{kpis.attendance_pct ?? '-' }%</div>
            <div className="pb-stat-l">Attendance</div>
          </div>
          <div className="pb-stat">
            <div className="pb-stat-v">{kpis.courses}</div>
            <div className="pb-stat-l">Courses</div>
          </div>
        </div>
      </div>

      <div className="tabs">
        {(['overview', 'courses', 'attendance', 'results', 'fees'] as StudentTab[]).map(nextTab => (
          <button
            key={nextTab}
            className={`tab ${tab === nextTab ? 'on' : ''}`}
            onClick={() => setTab(nextTab)}
            type="button"
          >
            {nextTab[0].toUpperCase() + nextTab.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <>
          <div className="stat-grid" style={{ marginBottom: 22 }}>
            <PortalStatCard accent="var(--crimson)" value={kpis.courses} label="Enrolled courses" icon="courses" />
            <PortalStatCard accent="var(--teal)" value={`${kpis.attendance_pct ?? '-'}%`} label="Overall attendance" icon="attendance" />
            <PortalStatCard accent="var(--amber)" value={money(kpis.fee_balance)} label="Fee balance" icon="fees" />
            <PortalStatCard accent="var(--blue)" value={kpis.library_loans} label="Library loans" icon="library" />
          </div>

          <div className="grid-2">
            <div className="card">
              <div className="card-h"><h3>Today's classes</h3><span className="hint">this week</span></div>
              <div className="card-pad">
                {(courses.courses || []).slice(0, 4).map((course: any, index: number) => (
                  <div className="snap" key={`${course.course_code}-${index}`}>
                    <span><b>{course.course_code}</b> - {course.title}</span>
                    <span className="mono hint">{course.schedule} - {course.room}</span>
                  </div>
                ))}
                {(courses.courses || []).length === 0 && <div className="empty">No classes assigned yet</div>}
              </div>
            </div>

            <div className="card">
              <div className="card-h"><h3>Quick actions</h3></div>
              <div className="card-pad">
                <div className="quick-links">
                  <button className="ql" onClick={() => setTab('attendance')} type="button">
                    <span className="ql-ico"><PortalGlyph kind="attendance" /></span>
                    <div><div className="ql-t">Attendance</div><div className="ql-s">View by course</div></div>
                  </button>
                  <button className="ql" onClick={() => setTab('results')} type="button">
                    <span className="ql-ico"><PortalGlyph kind="results" /></span>
                    <div><div className="ql-t">Results</div><div className="ql-s">Marks and grades</div></div>
                  </button>
                  <button className="ql" onClick={() => setTab('fees')} type="button">
                    <span className="ql-ico"><PortalGlyph kind="fees" /></span>
                    <div><div className="ql-t">Fees</div><div className="ql-s">Invoices and payments</div></div>
                  </button>
                  <button className="ql" onClick={() => go('grievance')} type="button">
                    <span className="ql-ico"><PortalGlyph kind="support" /></span>
                    <div><div className="ql-t">Grievance</div><div className="ql-s">Raise a ticket</div></div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {tab === 'courses' && (
        <div className="card">
          <div className="tbl-scroll">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Course</th>
                  <th>Credits</th>
                  <th>Faculty</th>
                  <th>Schedule</th>
                  <th>My attendance</th>
                </tr>
              </thead>
              <tbody>
                {(courses.courses || []).map((course: any, index: number) => (
                  <tr key={`${course.course_code}-${index}`}>
                    <td className="mono"><b>{course.course_code}</b></td>
                    <td>{course.title}</td>
                    <td>{course.credits}</td>
                    <td>{course.faculty}</td>
                    <td className="hint">{course.schedule}</td>
                    <td>
                      {course.attendance_pct != null ? (
                        <span className={`cgpa ${course.attendance_pct >= 75 ? 'good' : 'low'}`}>{course.attendance_pct}%</span>
                      ) : '-'}
                    </td>
                  </tr>
                ))}
                {(courses.courses || []).length === 0 && (
                  <tr><td colSpan={6}><div className="empty">No course registrations found</div></td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'attendance' && (
        <div className="grid-2">
          <div className="card">
            <div className="card-h"><h3>Attendance by course</h3></div>
            <div className="card-pad">
              {(attendance.summary || []).map((row: any, index: number) => (
                <div className="bar-row" key={`${row.course}-${index}`}>
                  <div className="bar-label">{row.course}</div>
                  <div className="bar-track">
                    <div
                      className="bar-fill"
                      style={{ width: `${row.pct}%`, background: row.pct >= 75 ? 'var(--teal)' : 'var(--red)' }}
                    />
                  </div>
                  <div className="bar-val">{row.pct}%</div>
                </div>
              ))}
              {(attendance.summary || []).length === 0 && <div className="empty">No attendance published yet</div>}
            </div>
          </div>

          <div className="card">
            <div className="card-h"><h3>Recent sessions</h3></div>
            <div className="card-pad">
              {(attendance.recent || []).slice(0, 10).map((row: any, index: number) => (
                <div className="snap" key={`${row.course}-${row.date}-${index}`}>
                  <span>{row.course}</span>
                  <span>
                    {row.present ? <span className="pill s-active">present</span> : <span className="pill s-rejected">absent</span>}
                    <span className="hint mono" style={{ marginLeft: 8 }}>{row.date}</span>
                  </span>
                </div>
              ))}
              {(attendance.recent || []).length === 0 && <div className="empty">No recent attendance sessions</div>}
            </div>
          </div>
        </div>
      )}

      {tab === 'results' && (
        <div className="card">
          <div className="card-h"><h3>Marks and assessments</h3><span className="hint">CGPA {results.cgpa?.toFixed(2)}</span></div>
          <div className="tbl-scroll">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Assessment</th>
                  <th>Score</th>
                  <th>Max</th>
                  <th>%</th>
                </tr>
              </thead>
              <tbody>
                {(results.marks || []).map((mark: any, index: number) => (
                  <tr key={`${mark.course}-${mark.assessment}-${index}`}>
                    <td className="mono">{mark.course}</td>
                    <td>{mark.assessment}</td>
                    <td><b>{mark.score}</b></td>
                    <td>{mark.max}</td>
                    <td>
                      <span className={`cgpa ${(mark.score / mark.max) >= 0.75 ? 'good' : (mark.score / mark.max) >= 0.5 ? 'ok' : 'low'}`}>
                        {Math.round((100 * mark.score) / mark.max)}%
                      </span>
                    </td>
                  </tr>
                ))}
                {(results.marks || []).length === 0 && <tr><td colSpan={5}><div className="empty">No marks published yet</div></td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'fees' && (
        <div className="grid-2">
          <div className="card">
            <div className="card-h"><h3>Fee invoices</h3></div>
            <div className="tbl-scroll">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Term</th>
                    <th>Amount</th>
                    <th>Paid</th>
                    <th>Balance</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(fees.invoices || []).map((invoice: any, index: number) => (
                    <tr key={`${invoice.term}-${index}`}>
                      <td>{invoice.term}</td>
                      <td>{money(invoice.amount)}</td>
                      <td>{money(invoice.paid)}</td>
                      <td><b style={{ color: invoice.balance > 0 ? 'var(--red)' : 'var(--teal-dk)' }}>{money(invoice.balance)}</b></td>
                      <td><span className={`pill s-${invoice.status}`}>{invoice.status}</span></td>
                    </tr>
                  ))}
                  {(fees.invoices || []).length === 0 && <tr><td colSpan={5}><div className="empty">No fee invoices found</div></td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="card-h"><h3>Payment history</h3></div>
            <div className="card-pad">
              {(fees.payments || []).map((payment: any, index: number) => (
                <div className="snap" key={`${payment.reference}-${index}`}>
                  <span className="mono">{payment.reference}</span>
                  <span><b>{money(payment.amount)}</b> - {payment.method}</span>
                </div>
              ))}
              {(fees.payments || []).length === 0 && <div className="empty">No payments yet</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function PortalStatCard({ accent, value, label, icon }: { accent: string; value: string | number; label: string; icon: string }) {
  return (
    <div className="stat">
      <div className="stat-ico" style={{ background: `color-mix(in srgb, ${accent} 12%, white)`, color: accent }}>
        <PortalGlyph kind={icon} />
      </div>
      <div className="stat-v">{value}</div>
      <div className="stat-l">{label}</div>
    </div>
  )
}

function PortalGlyph({ kind }: { kind: string }) {
  switch (kind) {
    case 'courses':
      return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v18H6.5A2.5 2.5 0 0 0 4 23V5.5Z" /><path d="M12 3v18" /></svg>
    case 'attendance':
      return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m5 12 4 4 10-10" /></svg>
    case 'fees':
      return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M7 5h9" /><path d="M7 9h7" /><path d="M9 5c0 6 5 4 5 9 0 2-2 4-5 4" /></svg>
    case 'library':
      return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 4h12v16H6z" /><path d="M9 4v16" /></svg>
    case 'results':
      return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M7 4h10l3 3v13H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" /><path d="M15 4v3h3M9 13h6M9 17h4" /></svg>
    case 'support':
      return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3 4 7v6c0 5 3.4 7.8 8 9 4.6-1.2 8-4 8-9V7l-8-4Z" /><path d="M9 12h6M12 9v6" /></svg>
    default:
      return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="8" /></svg>
  }
}
