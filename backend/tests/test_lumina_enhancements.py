"""Lumina-SIS — 20-item enhancement batch backend tests.

Covers: forgot/reset password, audit logs, gradebook lock/unlock + distribution,
report-card lock, attendance summary, admissions convert.
"""
import os
import re
import subprocess
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://repo-rebuild-app.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

SUNF = {"school_code": "SUNF", "username": "admin", "password": "Admin@123"}
SUNF_TEACHER = {"school_code": "SUNF", "username": "sarah.thompson.sunf", "password": "Teacher@123"}
RVSD = {"school_code": "RVSD", "username": "admin", "password": "Admin@123"}


# --------- helpers ---------

def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=30)
    assert r.status_code == 200, f"login failed for {creds['username']}: {r.status_code} {r.text}"
    return r.json()["access_token"]


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="module")
def sunf_admin_token():
    return _login(SUNF)


@pytest.fixture(scope="module")
def sunf_teacher_token():
    return _login(SUNF_TEACHER)


@pytest.fixture(scope="module")
def rvsd_admin_token():
    return _login(RVSD)


# ============ Forgot / Reset Password ============

class TestForgotResetPassword:
    def test_forgot_password_known_user_200(self):
        r = requests.post(f"{API}/auth/forgot-password",
                          json={"school_code": "SUNF", "username": "admin"}, timeout=15)
        assert r.status_code == 200
        assert "message" in r.json()

    def test_forgot_password_unknown_user_same_message(self):
        r = requests.post(f"{API}/auth/forgot-password",
                          json={"school_code": "SUNF", "username": "no_such_user_xyz"}, timeout=15)
        assert r.status_code == 200
        assert "message" in r.json()

    def test_reset_password_invalid_token_400(self):
        r = requests.post(f"{API}/auth/reset-password",
                          json={"token": "deadbeef-invalid", "new_password": "Admin@123"}, timeout=15)
        assert r.status_code == 400

    def test_reset_password_short_400_then_valid_200_then_restore(self):
        # 1) request a token for the SUNF admin
        r = requests.post(f"{API}/auth/forgot-password",
                          json={"school_code": "SUNF", "username": "admin"}, timeout=15)
        assert r.status_code == 200
        time.sleep(0.5)
        # 2) grep token from backend log
        token = None
        for log_path in ("/var/log/supervisor/backend.err.log", "/var/log/supervisor/backend.out.log"):
            try:
                out = subprocess.run(["tail", "-n", "400", log_path], capture_output=True, text=True, timeout=5).stdout
                m = list(re.finditer(r"\[FORGOT PASSWORD\].*?user=admin\s+token=([0-9a-f]+)", out))
                if m:
                    token = m[-1].group(1)
                    break
            except Exception:
                pass
        if not token:
            pytest.skip("Could not capture forgot-password token from backend logs")

        # 3) password < 8 -> 400
        r = requests.post(f"{API}/auth/reset-password",
                          json={"token": token, "new_password": "short"}, timeout=15)
        assert r.status_code == 400

        # 4) valid -> 200
        new_pw = "Reset@" + uuid.uuid4().hex[:6] + "9"
        r = requests.post(f"{API}/auth/reset-password",
                          json={"token": token, "new_password": new_pw}, timeout=15)
        assert r.status_code == 200, r.text

        # 5) login with new password works
        r = requests.post(f"{API}/auth/login",
                          json={"school_code": "SUNF", "username": "admin", "password": new_pw}, timeout=15)
        assert r.status_code == 200

        # 6) restore original
        r = requests.post(f"{API}/auth/forgot-password",
                          json={"school_code": "SUNF", "username": "admin"}, timeout=15)
        time.sleep(0.5)
        restore_token = None
        for log_path in ("/var/log/supervisor/backend.err.log", "/var/log/supervisor/backend.out.log"):
            try:
                out = subprocess.run(["tail", "-n", "400", log_path], capture_output=True, text=True, timeout=5).stdout
                m = list(re.finditer(r"\[FORGOT PASSWORD\].*?user=admin\s+token=([0-9a-f]+)", out))
                if m:
                    restore_token = m[-1].group(1)
                    break
            except Exception:
                pass
        assert restore_token, "Could not find restore token in logs"
        r = requests.post(f"{API}/auth/reset-password",
                          json={"token": restore_token, "new_password": "Admin@123"}, timeout=15)
        assert r.status_code == 200, r.text
        # verify restore
        r = requests.post(f"{API}/auth/login",
                          json={"school_code": "SUNF", "username": "admin", "password": "Admin@123"}, timeout=15)
        assert r.status_code == 200


# ============ Audit Logs ============

class TestAuditLogs:
    def test_audit_log_admin_200(self, sunf_admin_token):
        r = requests.get(f"{API}/audit-logs", headers=_h(sunf_admin_token), timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_audit_log_teacher_403(self, sunf_teacher_token):
        r = requests.get(f"{API}/audit-logs", headers=_h(sunf_teacher_token), timeout=15)
        assert r.status_code == 403

    def test_student_create_update_delete_audit_rows(self, sunf_admin_token):
        # create
        payload = {
            "first_name": "TEST_Audit",
            "last_name": "Student",
            "date_of_birth": "2012-05-01",
            "gender": "male",
            "enrollment_status": "enrolled",
        }
        r = requests.post(f"{API}/students", headers=_h(sunf_admin_token), json=payload, timeout=15)
        assert r.status_code == 200, r.text
        sid = r.json()["id"]

        # update
        r = requests.put(f"{API}/students/{sid}", headers=_h(sunf_admin_token),
                         json={**payload, "first_name": "TEST_Audit2"}, timeout=15)
        assert r.status_code == 200, r.text

        # delete
        r = requests.delete(f"{API}/students/{sid}", headers=_h(sunf_admin_token), timeout=15)
        assert r.status_code == 200, r.text

        # fetch audit logs filtered by entity_id
        r = requests.get(f"{API}/audit-logs", headers=_h(sunf_admin_token),
                         params={"entity_type": "student", "entity_id": sid}, timeout=15)
        assert r.status_code == 200
        actions = {row["action"] for row in r.json()}
        assert "create" in actions, f"missing create in {actions}"
        assert "update" in actions, f"missing update in {actions}"
        assert "delete" in actions, f"missing delete in {actions}"


# ============ Gradebook Lock / Unlock / Distribution ============

@pytest.fixture(scope="module")
def gradebook_seed(sunf_admin_token):
    """Find an existing gradebook entry to lock or create one."""
    # find a class taught by sarah
    rt = _login(SUNF_TEACHER)
    r = requests.get(f"{API}/classes", headers=_h(rt), timeout=15)
    assert r.status_code == 200
    teacher_classes = r.json()
    if not teacher_classes:
        pytest.skip("teacher has no classes")
    class_id = teacher_classes[0]["id"]

    # get a student in that class
    r = requests.get(f"{API}/students", headers=_h(sunf_admin_token),
                     params={"class_id": class_id}, timeout=15)
    students = r.json()
    if not students:
        pytest.skip("no students in teacher class")
    student_id = students[0]["id"]

    # upsert a gradebook entry as teacher
    gpayload = {
        "student_id": student_id,
        "class_id": class_id,
        "term": "Term 1",
        "academic_year": "2025-2026",
        "subjects": [{"subject": "Math", "grade": "A", "score": 95}],
        "overall_grade": "A",
        "overall_score": 95,
    }
    r = requests.post(f"{API}/gradebook", headers=_h(rt), json=gpayload, timeout=15)
    assert r.status_code in (200, 201), r.text
    gb_id = r.json()["id"]
    return {"gb_id": gb_id, "class_id": class_id, "student_id": student_id,
            "teacher_token": rt, "payload": gpayload}


class TestGradebookLock:
    def test_teacher_can_lock(self, gradebook_seed):
        r = requests.post(f"{API}/gradebook/{gradebook_seed['gb_id']}/lock",
                          headers=_h(gradebook_seed["teacher_token"]), timeout=15)
        assert r.status_code == 200, r.text

    def test_upsert_after_lock_403(self, gradebook_seed):
        r = requests.post(f"{API}/gradebook",
                          headers=_h(gradebook_seed["teacher_token"]),
                          json=gradebook_seed["payload"], timeout=15)
        assert r.status_code == 403, f"expected 403 (locked), got {r.status_code} {r.text}"

    def test_teacher_unlock_403(self, gradebook_seed):
        r = requests.post(f"{API}/gradebook/{gradebook_seed['gb_id']}/unlock",
                          headers=_h(gradebook_seed["teacher_token"]), timeout=15)
        assert r.status_code == 403

    def test_admin_unlock_then_upsert_works(self, sunf_admin_token, gradebook_seed):
        r = requests.post(f"{API}/gradebook/{gradebook_seed['gb_id']}/unlock",
                          headers=_h(sunf_admin_token), timeout=15)
        assert r.status_code == 200, r.text
        r = requests.post(f"{API}/gradebook",
                          headers=_h(gradebook_seed["teacher_token"]),
                          json=gradebook_seed["payload"], timeout=15)
        assert r.status_code in (200, 201), r.text


class TestGradebookDistribution:
    def test_distribution_200(self, sunf_admin_token, gradebook_seed):
        r = requests.get(
            f"{API}/gradebook/{gradebook_seed['class_id']}/distribution",
            headers=_h(sunf_admin_token),
            params={"term": "Term 1", "academic_year": "2025-2026"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert set(data["buckets"].keys()) == {"A", "B", "C", "D", "E", "U"}

    def test_distribution_teacher_other_class_403(self, sunf_teacher_token, rvsd_admin_token):
        # find a class teacher doesn't teach -> use a RVSD class? Cross-tenant won't return 403, but a SUNF class not in scope will.
        # Get all SUNF classes (via admin), then pick one not in teacher's set
        admin_tok = _login(SUNF)
        all_classes = requests.get(f"{API}/classes", headers=_h(admin_tok), timeout=15).json()
        teacher_classes = requests.get(f"{API}/classes", headers=_h(sunf_teacher_token), timeout=15).json()
        teacher_ids = {c["id"] for c in teacher_classes}
        not_my = next((c["id"] for c in all_classes if c["id"] not in teacher_ids), None)
        if not not_my:
            pytest.skip("teacher teaches all classes; cannot test 403")
        r = requests.get(
            f"{API}/gradebook/{not_my}/distribution",
            headers=_h(sunf_teacher_token),
            params={"term": "Term 1", "academic_year": "2025-2026"},
            timeout=15,
        )
        assert r.status_code == 403, f"expected 403 got {r.status_code}"


# ============ Report Card Lock ============

class TestReportCardLock:
    def test_admin_lock_unlock_and_list(self, sunf_admin_token):
        # find a SUNF student
        r = requests.get(f"{API}/students", headers=_h(sunf_admin_token), timeout=15)
        sid = r.json()[0]["id"]

        params = {"term": "Term 1", "academic_year": "2025-2026"}
        r = requests.post(f"{API}/report-cards/{sid}/lock", headers=_h(sunf_admin_token),
                          params=params, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json()["locked"] is True

        # list shows it
        r = requests.get(f"{API}/report-cards/locks", headers=_h(sunf_admin_token),
                         params=params, timeout=15)
        assert r.status_code == 200
        assert any(d["student_id"] == sid for d in r.json())

        # delete
        r = requests.delete(f"{API}/report-cards/{sid}/lock", headers=_h(sunf_admin_token),
                            params=params, timeout=15)
        assert r.status_code == 200

    def test_teacher_lock_403(self, sunf_teacher_token, sunf_admin_token):
        r = requests.get(f"{API}/students", headers=_h(sunf_admin_token), timeout=15)
        sid = r.json()[0]["id"]
        r = requests.post(f"{API}/report-cards/{sid}/lock", headers=_h(sunf_teacher_token),
                          params={"term": "Term 1", "academic_year": "2025-2026"}, timeout=15)
        assert r.status_code == 403


# ============ Attendance Summary ============

class TestAttendanceSummary:
    def test_summary_admin(self, sunf_admin_token):
        r = requests.get(f"{API}/students", headers=_h(sunf_admin_token), timeout=15)
        sid = r.json()[0]["id"]
        r = requests.get(f"{API}/students/{sid}/attendance/summary",
                         headers=_h(sunf_admin_token),
                         params={"month": "2025-10"}, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ("present", "absent", "late", "excused", "total", "percent_present",
                  "threshold", "below_threshold"):
            assert k in data, f"missing key {k}"

    def test_summary_bad_month_400(self, sunf_admin_token):
        r = requests.get(f"{API}/students", headers=_h(sunf_admin_token), timeout=15)
        sid = r.json()[0]["id"]
        r = requests.get(f"{API}/students/{sid}/attendance/summary",
                         headers=_h(sunf_admin_token),
                         params={"month": "not-a-month"}, timeout=15)
        assert r.status_code == 400

    def test_cross_tenant_404(self, sunf_admin_token, rvsd_admin_token):
        r = requests.get(f"{API}/students", headers=_h(rvsd_admin_token), timeout=15)
        rvsd_sid = r.json()[0]["id"]
        r = requests.get(f"{API}/students/{rvsd_sid}/attendance/summary",
                         headers=_h(sunf_admin_token), timeout=15)
        assert r.status_code == 404

    def test_teacher_other_class_403(self, sunf_admin_token, sunf_teacher_token):
        # find a student NOT in any of teacher's classes
        all_students = requests.get(f"{API}/students", headers=_h(sunf_admin_token), timeout=15).json()
        teacher_classes = requests.get(f"{API}/classes", headers=_h(sunf_teacher_token), timeout=15).json()
        teacher_ids = {c["id"] for c in teacher_classes}
        target = next((s for s in all_students if s.get("class_id") and s["class_id"] not in teacher_ids), None)
        if not target:
            pytest.skip("Couldn't find a SUNF student outside teacher's classes")
        r = requests.get(f"{API}/students/{target['id']}/attendance/summary",
                         headers=_h(sunf_teacher_token), timeout=15)
        assert r.status_code == 403, f"expected 403, got {r.status_code}"


# ============ Admissions Convert ============

class TestAdmissionsConvert:
    def test_convert_and_idempotent(self, sunf_admin_token):
        # Create an admission
        adm_payload = {
            "type": "application",
            "status": "accepted",
            "student_first_name": "TEST_Convert",
            "student_last_name": "Kid",
            "student_dob": "2014-03-10",
            "student_gender": "female",
            "parent_name": "TEST_Parent",
            "parent_email": "test_convert@example.com",
            "parent_phone": "555-0123",
            "grade_level": "Grade 5",
        }
        r = requests.post(f"{API}/admissions", headers=_h(sunf_admin_token), json=adm_payload, timeout=15)
        assert r.status_code in (200, 201), r.text
        adm_id = r.json()["id"]

        # convert
        r = requests.post(f"{API}/admissions/{adm_id}/convert", headers=_h(sunf_admin_token), timeout=15)
        assert r.status_code == 200, r.text
        student = r.json()
        sid1 = student["id"]
        assert student["enrollment_status"] == "enrolled"

        # admission row should now show enrolled. NOTE: AdmissionResponse model
        # doesn't expose converted_student_id (minor backend issue – see report).
        r = requests.get(f"{API}/admissions/{adm_id}", headers=_h(sunf_admin_token), timeout=15)
        adm_row = r.json()
        assert adm_row.get("status") == "enrolled"

        # idempotent
        r = requests.post(f"{API}/admissions/{adm_id}/convert", headers=_h(sunf_admin_token), timeout=15)
        assert r.status_code == 200
        assert r.json()["id"] == sid1

        # audit log row with action=convert
        r = requests.get(f"{API}/audit-logs", headers=_h(sunf_admin_token),
                         params={"entity_type": "admission", "entity_id": adm_id}, timeout=15)
        assert r.status_code == 200
        assert any(row["action"] == "convert" for row in r.json())

        # cleanup
        requests.delete(f"{API}/students/{sid1}", headers=_h(sunf_admin_token), timeout=15)
        requests.delete(f"{API}/admissions/{adm_id}", headers=_h(sunf_admin_token), timeout=15)


# ============ Regression Smoke ============

class TestRegression:
    @pytest.mark.parametrize("path", [
        "/health", "/students", "/classes", "/attendance", "/gradebook",
        "/discipline", "/enrollment/preview?from_year=2025-2026&to_year=2026-2027",
    ])
    def test_existing_endpoints_still_work(self, sunf_admin_token, path):
        r = requests.get(f"{API}{path}", headers=_h(sunf_admin_token), timeout=20)
        assert r.status_code == 200, f"{path} -> {r.status_code} {r.text[:200]}"
