"""
Backend tests for the new Admissions / Health / Discipline / Re-Enrollment modules,
plus RBAC fixes on /api/schools and /api/report-templates.

Run:
    pytest /app/backend/tests/test_audit_modules.py -v --tb=short \
        --junitxml=/app/test_reports/pytest/audit_modules_results.xml
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # fall back to reading frontend .env directly
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                    break
    except Exception:
        pass

API = f"{BASE_URL}/api"

CREDS = {
    "sunf_admin": {"school_code": "SUNF", "username": "admin", "password": "Admin@123"},
    "rvsd_admin": {"school_code": "RVSD", "username": "admin", "password": "Admin@123"},
    "sunf_teacher": {"school_code": "SUNF", "username": "sarah.thompson.sunf", "password": "Teacher@123"},
    "jtech_super": {"school_code": "JTECH", "username": "jtech.innovations@outlook.com", "password": "Xekleidoma@1"},
}


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=30)
    assert r.status_code == 200, f"Login failed for {creds['username']}: {r.status_code} {r.text}"
    return r.json()["access_token"]


def _hdr(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


# ---------- session-scoped token fixtures ----------

@pytest.fixture(scope="session")
def tok_sunf_admin():
    return _login(CREDS["sunf_admin"])


@pytest.fixture(scope="session")
def tok_rvsd_admin():
    return _login(CREDS["rvsd_admin"])


@pytest.fixture(scope="session")
def tok_sunf_teacher():
    return _login(CREDS["sunf_teacher"])


@pytest.fixture(scope="session")
def tok_super():
    return _login(CREDS["jtech_super"])


@pytest.fixture(scope="session")
def sunf_student_id(tok_sunf_admin):
    r = requests.get(f"{API}/students", headers=_hdr(tok_sunf_admin), timeout=30)
    assert r.status_code == 200, r.text
    arr = r.json()
    assert len(arr) > 0, "SUNF has no students seeded"
    return arr[0]["id"]


@pytest.fixture(scope="session")
def rvsd_student_id(tok_rvsd_admin):
    r = requests.get(f"{API}/students", headers=_hdr(tok_rvsd_admin), timeout=30)
    assert r.status_code == 200, r.text
    arr = r.json()
    assert len(arr) > 0, "RVSD has no students seeded"
    return arr[0]["id"]


# ============================================================
# AUTH
# ============================================================
class TestAuth:
    def test_login_sunf_admin(self):
        r = requests.post(f"{API}/auth/login", json=CREDS["sunf_admin"], timeout=30)
        assert r.status_code == 200
        body = r.json()
        assert "access_token" in body and body["user"]["role"] == "admin"
        assert body["user"]["school_code"] == "SUNF"


# ============================================================
# ADMISSIONS
# ============================================================
class TestAdmissions:
    def test_stats_admin_200(self, tok_sunf_admin):
        r = requests.get(f"{API}/admissions/stats", headers=_hdr(tok_sunf_admin), timeout=30)
        assert r.status_code == 200, r.text
        for k in ["total", "inquiries", "applications", "accepted", "pending", "rejected"]:
            assert k in r.json()

    def test_list_inquiries_admin_200(self, tok_sunf_admin):
        r = requests.get(f"{API}/admissions/inquiries", headers=_hdr(tok_sunf_admin), timeout=30)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_list_applications_admin_200(self, tok_sunf_admin):
        r = requests.get(f"{API}/admissions/applications", headers=_hdr(tok_sunf_admin), timeout=30)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_teacher_inquiries_403(self, tok_sunf_teacher):
        r = requests.get(f"{API}/admissions/inquiries", headers=_hdr(tok_sunf_teacher), timeout=30)
        assert r.status_code == 403, f"Expected 403 got {r.status_code} {r.text}"

    def test_full_crud_admission(self, tok_sunf_admin):
        # CREATE
        payload = {
            "student_first_name": "TEST_Alice",
            "student_last_name": "TEST_Roe",
            "parent_name": "TEST_Parent",
            "parent_email": "test_parent@example.com",
            "parent_phone": "+1-555-0100",
            "grade_level": "Grade 1",
            "status": "inquiry",
            "notes": "auto-test",
            "source": "website",
        }
        r = requests.post(f"{API}/admissions", json=payload, headers=_hdr(tok_sunf_admin), timeout=30)
        assert r.status_code == 200, r.text
        created = r.json()
        assert created["school_code"] == "SUNF"
        assert created["student_first_name"] == "TEST_Alice"
        adm_id = created["id"]

        # PUT
        payload["notes"] = "auto-test-updated"
        payload["status"] = "pending"
        r = requests.put(f"{API}/admissions/{adm_id}", json=payload, headers=_hdr(tok_sunf_admin), timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["notes"] == "auto-test-updated"
        assert r.json()["status"] == "pending"

        # GET single (verify persistence)
        r = requests.get(f"{API}/admissions/{adm_id}", headers=_hdr(tok_sunf_admin), timeout=30)
        assert r.status_code == 200 and r.json()["notes"] == "auto-test-updated"

        # DELETE
        r = requests.delete(f"{API}/admissions/{adm_id}", headers=_hdr(tok_sunf_admin), timeout=30)
        assert r.status_code == 200

        # Confirm 404
        r = requests.get(f"{API}/admissions/{adm_id}", headers=_hdr(tok_sunf_admin), timeout=30)
        assert r.status_code == 404


# ============================================================
# HEALTH
# ============================================================
class TestHealth:
    def test_stats_admin_200(self, tok_sunf_admin):
        r = requests.get(f"{API}/health/stats", headers=_hdr(tok_sunf_admin), timeout=30)
        assert r.status_code == 200
        for k in ["records", "vaccinations", "allergies", "conditions", "medications", "visits"]:
            assert k in r.json()

    def test_stats_teacher_200(self, tok_sunf_teacher):
        r = requests.get(f"{API}/health/stats", headers=_hdr(tok_sunf_teacher), timeout=30)
        assert r.status_code == 200

    def test_get_or_create_record(self, tok_sunf_admin, sunf_student_id):
        r = requests.get(f"{API}/health/{sunf_student_id}", headers=_hdr(tok_sunf_admin), timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["student_id"] == sunf_student_id
        assert body["school_code"] == "SUNF"

    def test_cross_tenant_student_404(self, tok_sunf_admin, rvsd_student_id):
        r = requests.get(f"{API}/health/{rvsd_student_id}", headers=_hdr(tok_sunf_admin), timeout=30)
        assert r.status_code == 404, f"Expected 404, got {r.status_code}: {r.text}"

    def test_append_and_delete_vaccination(self, tok_sunf_admin, sunf_student_id):
        # POST vaccination
        vacc = {"name": f"TEST_Vacc_{uuid.uuid4().hex[:6]}", "date": "2026-01-10", "dose": "1"}
        r = requests.post(
            f"{API}/health/{sunf_student_id}/vaccination", json=vacc,
            headers=_hdr(tok_sunf_admin), timeout=30,
        )
        assert r.status_code == 200, r.text
        rec = r.json()
        match = [v for v in rec["vaccinations"] if v.get("name") == vacc["name"]]
        assert match, "vaccination entry not in returned record"
        entry_id = match[0]["id"]

        # DELETE vaccination
        r = requests.delete(
            f"{API}/health/{sunf_student_id}/vaccination/{entry_id}",
            headers=_hdr(tok_sunf_admin), timeout=30,
        )
        assert r.status_code == 200, r.text

        # confirm removed
        r = requests.get(f"{API}/health/{sunf_student_id}", headers=_hdr(tok_sunf_admin), timeout=30)
        remaining = [v for v in r.json()["vaccinations"] if v.get("id") == entry_id]
        assert not remaining

    def test_append_allergy(self, tok_sunf_admin, sunf_student_id):
        body = {"allergen": f"TEST_Peanut_{uuid.uuid4().hex[:4]}", "reaction": "hives", "severity": "Mild"}
        r = requests.post(
            f"{API}/health/{sunf_student_id}/allergy", json=body,
            headers=_hdr(tok_sunf_admin), timeout=30,
        )
        assert r.status_code == 200, r.text
        assert any(a.get("allergen") == body["allergen"] for a in r.json()["allergies"])

    def test_append_visit(self, tok_sunf_admin, sunf_student_id):
        body = {"date": "2026-01-09", "reason": f"TEST_visit_{uuid.uuid4().hex[:4]}"}
        r = requests.post(
            f"{API}/health/{sunf_student_id}/visit", json=body,
            headers=_hdr(tok_sunf_admin), timeout=30,
        )
        assert r.status_code == 200, r.text
        assert any(v.get("reason") == body["reason"] for v in r.json()["visits"])

    def test_parent_403(self, tok_sunf_admin, sunf_student_id):
        """No parent test creds in /app/memory; verify that the route is not open to non-admin/teacher.
        We re-use teacher (allowed=200) and admin (allowed=200) to verify allowed; skip parent if unavailable."""
        # The spec required PARENT -> 403 but parent creds are not provided. We assert that the
        # role gate exists by checking unauthenticated -> 401/403.
        r = requests.get(f"{API}/health/{sunf_student_id}", timeout=30)
        assert r.status_code in (401, 403)


# ============================================================
# DISCIPLINE
# ============================================================
class TestDiscipline:
    _incident_id = None

    def test_stats_200(self, tok_sunf_admin):
        r = requests.get(f"{API}/discipline/stats", headers=_hdr(tok_sunf_admin), timeout=30)
        assert r.status_code == 200
        for k in ["total", "open", "in_progress", "resolved", "minor", "moderate", "major"]:
            assert k in r.json()

    def test_list_admin_200(self, tok_sunf_admin):
        r = requests.get(f"{API}/discipline", headers=_hdr(tok_sunf_admin), timeout=30)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_list_teacher_200(self, tok_sunf_teacher):
        r = requests.get(f"{API}/discipline", headers=_hdr(tok_sunf_teacher), timeout=30)
        assert r.status_code == 200

    def test_create_with_same_school_student(self, tok_sunf_admin, sunf_student_id):
        body = {
            "student_id": sunf_student_id,
            "date": "2026-01-09",
            "type": "Minor",
            "description": "TEST_incident auto",
            "status": "Open",
        }
        r = requests.post(f"{API}/discipline", json=body, headers=_hdr(tok_sunf_admin), timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["school_code"] == "SUNF"
        assert body["student_id"] == sunf_student_id
        TestDiscipline._incident_id = body["id"]

    def test_create_with_cross_tenant_student_404(self, tok_sunf_admin, rvsd_student_id):
        body = {
            "student_id": rvsd_student_id,
            "date": "2026-01-09",
            "type": "Minor",
            "description": "TEST_cross",
            "status": "Open",
        }
        r = requests.post(f"{API}/discipline", json=body, headers=_hdr(tok_sunf_admin), timeout=30)
        assert r.status_code == 404, f"Expected 404, got {r.status_code}: {r.text}"

    def test_update(self, tok_sunf_admin, sunf_student_id):
        assert TestDiscipline._incident_id, "previous test must have created an incident"
        body = {
            "student_id": sunf_student_id,
            "date": "2026-01-09",
            "type": "Moderate",
            "description": "TEST_incident_updated",
            "status": "In Progress",
        }
        r = requests.put(
            f"{API}/discipline/{TestDiscipline._incident_id}",
            json=body, headers=_hdr(tok_sunf_admin), timeout=30,
        )
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "In Progress"
        assert r.json()["type"] == "Moderate"

    def test_teacher_delete_403(self, tok_sunf_teacher):
        assert TestDiscipline._incident_id
        r = requests.delete(
            f"{API}/discipline/{TestDiscipline._incident_id}",
            headers=_hdr(tok_sunf_teacher), timeout=30,
        )
        assert r.status_code == 403, f"Expected 403, got {r.status_code}: {r.text}"

    def test_admin_delete_200(self, tok_sunf_admin):
        assert TestDiscipline._incident_id
        r = requests.delete(
            f"{API}/discipline/{TestDiscipline._incident_id}",
            headers=_hdr(tok_sunf_admin), timeout=30,
        )
        assert r.status_code == 200, r.text


# ============================================================
# RE-ENROLLMENT
# ============================================================
class TestEnrollment:
    def test_preview_known_year(self, tok_sunf_admin):
        # Try common seeded year
        r = requests.get(
            f"{API}/enrollment/preview",
            params={"from_year": "2025-2026", "to_year": "2026-2027"},
            headers=_hdr(tok_sunf_admin), timeout=30,
        )
        assert r.status_code == 200, r.text
        assert isinstance(r.json(), list)

    def test_preview_empty_year(self, tok_sunf_admin):
        r = requests.get(
            f"{API}/enrollment/preview",
            params={"from_year": "1999-2000", "to_year": "2000-2001"},
            headers=_hdr(tok_sunf_admin), timeout=30,
        )
        assert r.status_code == 200
        assert r.json() == []

    def test_execute_no_change_no_side_effect(self, tok_sunf_admin):
        # First, pull a couple of students for the no_change action - safe (no DB mutation).
        r = requests.get(f"{API}/students", headers=_hdr(tok_sunf_admin), timeout=30)
        students = r.json()[:2]
        payload = {
            "from_year": "2025-2026",
            "to_year": "2026-2027",
            "students": [
                {"student_id": s["id"], "action": "no_change"} for s in students
            ],
        }
        r = requests.post(
            f"{API}/enrollment/execute", json=payload,
            headers=_hdr(tok_sunf_admin), timeout=30,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["unchanged"] == len(students)
        assert body["promoted"] == 0 and body["graduated"] == 0


# ============================================================
# RBAC fixes on schools & report-templates
# ============================================================
class TestSchoolsRBAC:
    def test_admin_lists_only_own_school(self, tok_sunf_admin):
        r = requests.get(f"{API}/schools", headers=_hdr(tok_sunf_admin), timeout=30)
        assert r.status_code == 200
        schools = r.json()
        assert len(schools) == 1
        assert schools[0]["school_code"] == "SUNF"

    def test_superuser_lists_all(self, tok_super):
        r = requests.get(f"{API}/schools", headers=_hdr(tok_super), timeout=30)
        assert r.status_code == 200
        schools = r.json()
        codes = {s["school_code"] for s in schools}
        assert "SUNF" in codes and "RVSD" in codes

    def test_admin_other_school_get_403(self, tok_sunf_admin, tok_rvsd_admin):
        # Get RVSD school id via superuser-less path: use rvsd admin listing
        r = requests.get(f"{API}/schools", headers=_hdr(tok_rvsd_admin), timeout=30)
        assert r.status_code == 200 and len(r.json()) == 1
        rvsd_id = r.json()[0]["id"]
        r = requests.get(
            f"{API}/schools/{rvsd_id}", headers=_hdr(tok_sunf_admin), timeout=30,
        )
        assert r.status_code == 403, f"Expected 403, got {r.status_code}: {r.text}"

    def test_admin_same_school_subjects_200(self, tok_sunf_admin):
        # find SUNF id via /schools
        r = requests.get(f"{API}/schools", headers=_hdr(tok_sunf_admin), timeout=30)
        sunf_id = r.json()[0]["id"]
        r = requests.get(
            f"{API}/schools/{sunf_id}/subjects", headers=_hdr(tok_sunf_admin), timeout=30,
        )
        assert r.status_code == 200, r.text

    def test_admin_cross_school_subjects_403(self, tok_sunf_admin, tok_rvsd_admin):
        r = requests.get(f"{API}/schools", headers=_hdr(tok_rvsd_admin), timeout=30)
        rvsd_id = r.json()[0]["id"]
        r = requests.get(
            f"{API}/schools/{rvsd_id}/subjects", headers=_hdr(tok_sunf_admin), timeout=30,
        )
        assert r.status_code == 403, f"Expected 403, got {r.status_code}: {r.text}"

    def test_report_templates_cross_tenant_403(self, tok_sunf_admin):
        r = requests.get(
            f"{API}/report-templates/RVSD", headers=_hdr(tok_sunf_admin), timeout=30,
        )
        assert r.status_code == 403, f"Expected 403, got {r.status_code}: {r.text}"
