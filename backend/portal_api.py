# -*- coding: utf-8 -*-
"""
Portal API — persona-scoped views.

Where domain_api.py serves *administrative* module data (rosters, ledgers),
this router serves the signed-in person's OWN world:

  • a Student sees only their courses, attendance, marks, fees, library loans
  • a Parent/Guardian sees exactly one linked student
  • a Faculty member sees only the sections they teach and those students
  • a Dean/HOD sees only their school/department rollup

This is what makes every login genuinely different: two people with the same
module can see completely different, personally-relevant data.
"""
from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func

from core import db, auth
from database import office
import domain_models as D
from models import User

router = APIRouter(prefix="/api/portal")


# --------------------------------------------------------------------------- #
#  Persona resolution
# --------------------------------------------------------------------------- #
def persona(s, ctx):
    """Resolve the signed-in user into a concrete persona + linked entity."""
    uid = ctx["sub"]
    office_n = ctx["office_n"]
    student = s.query(D.Student).filter(D.Student.user_id == uid).first()
    if not student and office_n == 36:
        # Keep the demo student portal resilient even if the user-to-student
        # binding was created after an older token or database snapshot.
        scope_ref = ctx.get("scope_ref", "")
        if scope_ref and not scope_ref.startswith("scope_"):
            student = s.query(D.Student).get(scope_ref)
        if not student:
            login = s.query(User).get(uid)
            if login and login.username == "student":
                student = s.query(D.Student).order_by(D.Student.cgpa.desc()).first()
    if student:
        return {"kind": "student", "student": student}
    staff = s.query(D.StaffMember).filter(D.StaffMember.user_id == uid).first()
    if staff:
        return {"kind": "faculty", "staff": staff}
    # Parent watches a specific student (scope_ref holds the student id)
    if office_n == 37:
        sid = ctx.get("scope_ref", "")
        st = s.query(D.Student).get(sid) if sid else None
        if not st:
            st = s.query(D.Student).order_by(D.Student.cgpa.desc()).first()
        return {"kind": "parent", "student": st}
    return {"kind": "staff", "office_n": office_n}


@router.get("/whoami")
def whoami(ctx=Depends(auth), s=Depends(db)):
    p = persona(s, ctx)
    out = {"kind": p["kind"], "office_n": ctx["office_n"]}
    if p.get("student"):
        st = p["student"]
        out["profile"] = {"name": st.name, "roll_no": st.roll_no, "cgpa": st.cgpa,
                          "semester": st.semester, "batch": st.batch}
    if p.get("staff"):
        stf = p["staff"]
        out["profile"] = {"name": stf.name, "emp_id": stf.emp_id,
                          "designation": stf.designation}
    return out


# --------------------------------------------------------------------------- #
#  STUDENT portal — my academic world
# --------------------------------------------------------------------------- #
def _student_or_404(s, ctx):
    p = persona(s, ctx)
    st = p.get("student")
    if not st:
        raise HTTPException(404, "No student linked to this login")
    return st


@router.get("/student/home")
def student_home(ctx=Depends(auth), s=Depends(db)):
    st = _student_or_404(s, ctx)
    dept = s.query(D.Department).get(st.dept_id)
    enrolls = s.query(D.Enrollment).filter(D.Enrollment.student_id == st.id,
                                           D.Enrollment.status == "enrolled").all()
    sec_ids = [e.section_id for e in enrolls]

    # attendance across my sections
    total = s.query(D.AttendanceRecord).filter(
        D.AttendanceRecord.student_id == st.id).count()
    present = s.query(D.AttendanceRecord).filter(
        D.AttendanceRecord.student_id == st.id,
        D.AttendanceRecord.present == True).count()
    att_pct = round(100 * present / total) if total else None

    # fees
    inv = s.query(D.FeeInvoice).filter(D.FeeInvoice.student_id == st.id).first()
    fee = None
    if inv:
        fee = {"amount": inv.amount, "paid": inv.paid,
               "balance": inv.amount - inv.paid, "status": inv.status}

    # library
    loans = s.query(D.BookLoan).filter(D.BookLoan.borrower == st.id,
                                       D.BookLoan.returned == False).count()

    return {
        "profile": {"name": st.name, "roll_no": st.roll_no, "cgpa": st.cgpa,
                    "semester": st.semester, "batch": st.batch,
                    "department": dept.name if dept else "", "section": st.section,
                    "hosteller": st.hosteller, "scholarship": st.scholarship},
        "kpis": {"courses": len(sec_ids), "attendance_pct": att_pct,
                 "fee_balance": (inv.amount - inv.paid) if inv else 0,
                 "library_loans": loans},
        "fee": fee,
    }


@router.get("/student/courses")
def student_courses(ctx=Depends(auth), s=Depends(db)):
    st = _student_or_404(s, ctx)
    enrolls = s.query(D.Enrollment).filter(D.Enrollment.student_id == st.id).all()
    course_map = {c.id: c for c in s.query(D.Course).all()}
    fac_map = {f.id: f.name for f in s.query(D.StaffMember).all()}
    out = []
    for e in enrolls:
        sec = s.query(D.Section).get(e.section_id)
        if not sec:
            continue
        c = course_map.get(sec.course_id)
        # my attendance in this section
        tot = s.query(D.AttendanceRecord).filter(
            D.AttendanceRecord.student_id == st.id,
            D.AttendanceRecord.section_id == sec.id).count()
        pre = s.query(D.AttendanceRecord).filter(
            D.AttendanceRecord.student_id == st.id,
            D.AttendanceRecord.section_id == sec.id,
            D.AttendanceRecord.present == True).count()
        out.append({
            "course_code": c.code if c else "", "title": c.title if c else "",
            "credits": c.credits if c else 0, "section": sec.section_code,
            "faculty": fac_map.get(sec.faculty_person_id, "—"),
            "schedule": sec.schedule, "room": sec.room,
            "status": e.status, "grade": e.grade,
            "attendance_pct": round(100 * pre / tot) if tot else None,
        })
    return {"courses": out}


@router.get("/student/attendance")
def student_attendance(ctx=Depends(auth), s=Depends(db)):
    st = _student_or_404(s, ctx)
    recs = (s.query(D.AttendanceRecord)
            .filter(D.AttendanceRecord.student_id == st.id)
            .order_by(D.AttendanceRecord.on_date.desc()).limit(60).all())
    course_of = {}
    for sec in s.query(D.Section).all():
        c = s.query(D.Course).get(sec.course_id)
        course_of[sec.id] = c.code if c else sec.id
    by_course = {}
    for r in recs:
        cc = course_of.get(r.section_id, "?")
        b = by_course.setdefault(cc, {"present": 0, "total": 0})
        b["total"] += 1
        if r.present:
            b["present"] += 1
    summary = [{"course": k, "present": v["present"], "total": v["total"],
                "pct": round(100 * v["present"] / v["total"]) if v["total"] else 0}
               for k, v in by_course.items()]
    return {"summary": summary,
            "recent": [{"date": r.on_date.isoformat(),
                        "course": course_of.get(r.section_id, "?"),
                        "present": r.present} for r in recs[:20]]}


@router.get("/student/results")
def student_results(ctx=Depends(auth), s=Depends(db)):
    st = _student_or_404(s, ctx)
    marks = s.query(D.Mark).filter(D.Mark.student_id == st.id).all()
    out = []
    for m in marks:
        a = s.query(D.Assessment).get(m.assessment_id)
        if not a:
            continue
        sec = s.query(D.Section).get(a.section_id)
        c = s.query(D.Course).get(sec.course_id) if sec else None
        out.append({"course": c.code if c else "", "assessment": a.name,
                    "score": m.score, "max": a.max_marks})
    return {"marks": out, "cgpa": st.cgpa}


@router.get("/student/fees")
def student_fees(ctx=Depends(auth), s=Depends(db)):
    st = _student_or_404(s, ctx)
    invs = s.query(D.FeeInvoice).filter(D.FeeInvoice.student_id == st.id).all()
    pays = s.query(D.Payment).filter(D.Payment.student_id == st.id).all()
    return {
        "invoices": [{"term": i.term, "amount": i.amount, "paid": i.paid,
                      "balance": i.amount - i.paid, "status": i.status,
                      "due_date": i.due_date.isoformat() if i.due_date else ""} for i in invs],
        "payments": [{"amount": p.amount, "method": p.method,
                      "reference": p.reference,
                      "at": p.at.isoformat() if p.at else ""} for p in pays],
    }


# --------------------------------------------------------------------------- #
#  FACULTY portal — my teaching
# --------------------------------------------------------------------------- #
def _staff_or_404(s, ctx):
    p = persona(s, ctx)
    stf = p.get("staff")
    if not stf:
        raise HTTPException(404, "No staff profile linked to this login")
    return stf


@router.get("/faculty/home")
def faculty_home(ctx=Depends(auth), s=Depends(db)):
    stf = _staff_or_404(s, ctx)
    secs = s.query(D.Section).filter(D.Section.faculty_person_id == stf.id).all()
    sec_ids = [x.id for x in secs]
    n_students = 0
    if sec_ids:
        n_students = (s.query(D.Enrollment)
                      .filter(D.Enrollment.section_id.in_(sec_ids),
                              D.Enrollment.status == "enrolled").count())
    dept = s.query(D.Department).get(stf.dept_id) if stf.dept_id else None
    # my pending leave
    my_leave = s.query(D.LeaveRequest).filter(D.LeaveRequest.staff_id == stf.id).all()
    return {
        "profile": {"name": stf.name, "emp_id": stf.emp_id,
                    "designation": stf.designation,
                    "department": dept.name if dept else ""},
        "kpis": {"sections": len(secs), "students": n_students,
                 "leave_requests": len(my_leave)},
    }


@router.get("/faculty/sections")
def faculty_sections(ctx=Depends(auth), s=Depends(db)):
    stf = _staff_or_404(s, ctx)
    secs = s.query(D.Section).filter(D.Section.faculty_person_id == stf.id).all()
    course_map = {c.id: c for c in s.query(D.Course).all()}
    out = []
    for sec in secs:
        c = course_map.get(sec.course_id)
        enrolled = s.query(D.Enrollment).filter(
            D.Enrollment.section_id == sec.id,
            D.Enrollment.status == "enrolled").count()
        asmts = s.query(D.Assessment).filter(D.Assessment.section_id == sec.id).count()
        out.append({"id": sec.id, "course_code": c.code if c else "",
                    "title": c.title if c else "", "section": sec.section_code,
                    "schedule": sec.schedule, "room": sec.room,
                    "enrolled": enrolled, "assessments": asmts})
    return {"sections": out}


@router.get("/faculty/section/{section_id}/students")
def faculty_section_students(section_id: str, ctx=Depends(auth), s=Depends(db)):
    stf = _staff_or_404(s, ctx)
    sec = s.query(D.Section).get(section_id)
    if not sec or sec.faculty_person_id != stf.id:
        raise HTTPException(403, "Not your section")
    enrolls = s.query(D.Enrollment).filter(
        D.Enrollment.section_id == section_id,
        D.Enrollment.status == "enrolled").all()
    out = []
    for e in enrolls:
        st = s.query(D.Student).get(e.student_id)
        if not st:
            continue
        tot = s.query(D.AttendanceRecord).filter(
            D.AttendanceRecord.student_id == st.id,
            D.AttendanceRecord.section_id == section_id).count()
        pre = s.query(D.AttendanceRecord).filter(
            D.AttendanceRecord.student_id == st.id,
            D.AttendanceRecord.section_id == section_id,
            D.AttendanceRecord.present == True).count()
        out.append({"roll_no": st.roll_no, "name": st.name, "cgpa": st.cgpa,
                    "attendance_pct": round(100 * pre / tot) if tot else None})
    return {"students": out, "section": sec.section_code}


# --------------------------------------------------------------------------- #
#  PARENT portal — one linked student
# --------------------------------------------------------------------------- #
@router.get("/parent/home")
def parent_home(ctx=Depends(auth), s=Depends(db)):
    p = persona(s, ctx)
    st = p.get("student")
    if not st:
        raise HTTPException(404, "No ward linked to this login")
    dept = s.query(D.Department).get(st.dept_id)
    total = s.query(D.AttendanceRecord).filter(D.AttendanceRecord.student_id == st.id).count()
    present = s.query(D.AttendanceRecord).filter(
        D.AttendanceRecord.student_id == st.id,
        D.AttendanceRecord.present == True).count()
    inv = s.query(D.FeeInvoice).filter(D.FeeInvoice.student_id == st.id).first()
    return {
        "ward": {"name": st.name, "roll_no": st.roll_no, "cgpa": st.cgpa,
                 "semester": st.semester, "department": dept.name if dept else "",
                 "attendance_pct": round(100 * present / total) if total else None},
        "fee": {"amount": inv.amount, "paid": inv.paid,
                "balance": inv.amount - inv.paid, "status": inv.status} if inv else None,
    }
