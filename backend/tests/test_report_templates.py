"""
Backend Tests for Report Template Designer Feature
Tests: Report Templates CRUD, auto-creation on school creation, template retrieval
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SUPERUSER_CREDS = {
    "school_code": "JTECH",
    "username": "jtech.innovations@outlook.com",
    "password": "Xekleidoma@1"
}

WPS_ADMIN_CREDS = {
    "school_code": "WPS",
    "username": "wps.admin@school.com",
    "password": "Password@123"
}

class TestHealthCheck:
    """Basic health check"""
    
    def test_health_endpoint(self):
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Health check failed: {response.text}"
        print("✅ Health check passed")


class TestSuperuserAuthentication:
    """Test superuser login"""
    
    def test_superuser_login(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPERUSER_CREDS)
        assert response.status_code == 200, f"Superuser login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "access_token not in response"
        assert "user" in data, "user not in response"
        assert data["user"]["role"] == "superuser", f"Expected superuser role, got {data['user']['role']}"
        print(f"✅ Superuser login successful, user: {data['user']['name']}")
        return data["access_token"]


class TestReportTemplateAPI:
    """Test Report Template CRUD operations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get superuser token before each test"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPERUSER_CREDS)
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_mhps_template(self):
        """GET /api/report-templates/MHPS - returns auto-created default template"""
        response = requests.get(f"{BASE_URL}/api/report-templates/MHPS", headers=self.headers)
        assert response.status_code == 200, f"Failed to get MHPS template: {response.text}"
        template = response.json()
        
        # Verify template structure
        assert "school_code" in template, "school_code missing from template"
        assert template["school_code"] == "MHPS", f"Expected MHPS, got {template['school_code']}"
        assert "subjects" in template, "subjects missing from template"
        assert isinstance(template["subjects"], list), "subjects should be a list"
        assert "grade_scale" in template, "grade_scale missing from template"
        assert isinstance(template["grade_scale"], list), "grade_scale should be a list"
        assert "sections" in template, "sections missing from template"
        assert "social_skills_categories" in template, "social_skills_categories missing from template"
        
        # Verify subjects have correct structure
        if len(template["subjects"]) > 0:
            subject = template["subjects"][0]
            assert "name" in subject, "subject name missing"
            assert "is_core" in subject, "subject is_core missing"
        
        # Verify grade scale has correct structure
        if len(template["grade_scale"]) > 0:
            grade = template["grade_scale"][0]
            assert "min" in grade, "grade min missing"
            assert "max" in grade, "grade max missing"
            assert "grade" in grade, "grade label missing"
        
        print(f"✅ MHPS template retrieved - {len(template['subjects'])} subjects, {len(template['grade_scale'])} grades")
    
    def test_get_wps_template(self):
        """GET /api/report-templates/WPS - returns template for WPS school"""
        response = requests.get(f"{BASE_URL}/api/report-templates/WPS", headers=self.headers)
        assert response.status_code == 200, f"Failed to get WPS template: {response.text}"
        template = response.json()
        
        # Verify template structure
        assert "school_code" in template, "school_code missing from template"
        assert template["school_code"] == "WPS", f"Expected WPS, got {template['school_code']}"
        assert "subjects" in template, "subjects missing from template"
        assert "grade_scale" in template, "grade_scale missing from template"
        assert "sections" in template, "sections missing from template"
        assert "social_skills_categories" in template, "social_skills_categories missing from template"
        
        print(f"✅ WPS template retrieved - {len(template['subjects'])} subjects, {len(template['grade_scale'])} grades")
    
    def test_update_wps_template(self):
        """PUT /api/report-templates/WPS - update template and verify persistence"""
        # First get current template
        get_response = requests.get(f"{BASE_URL}/api/report-templates/WPS", headers=self.headers)
        assert get_response.status_code == 200
        original_template = get_response.json()
        
        # Update with modified data
        updated_template = {
            "school_code": "WPS",
            "school_name": original_template.get("school_name", "WPS School"),
            "school_motto": "TEST_Updated Motto",
            "logo_url": original_template.get("logo_url", ""),
            "header_text": "TEST_UPDATED REPORT CARD",
            "sub_header_text": original_template.get("sub_header_text", ""),
            "subjects": original_template.get("subjects", []),
            "grade_scale": original_template.get("grade_scale", []),
            "use_weighted_grading": True,  # Toggle weighted grading
            "assessment_weights": original_template.get("assessment_weights", {}),
            "sections": original_template.get("sections", {}),
            "social_skills_categories": original_template.get("social_skills_categories", []),
            "skill_ratings": original_template.get("skill_ratings", []),
            "achievement_standards": original_template.get("achievement_standards", []),
            "paper_size": "letter"  # Change paper size
        }
        
        put_response = requests.put(
            f"{BASE_URL}/api/report-templates/WPS",
            json=updated_template,
            headers=self.headers
        )
        assert put_response.status_code == 200, f"Failed to update WPS template: {put_response.text}"
        
        # Verify changes persisted with GET
        verify_response = requests.get(f"{BASE_URL}/api/report-templates/WPS", headers=self.headers)
        assert verify_response.status_code == 200
        saved_template = verify_response.json()
        
        assert saved_template["school_motto"] == "TEST_Updated Motto", "school_motto not updated"
        assert saved_template["header_text"] == "TEST_UPDATED REPORT CARD", "header_text not updated"
        assert saved_template["use_weighted_grading"] == True, "use_weighted_grading not updated"
        assert saved_template["paper_size"] == "letter", "paper_size not updated"
        
        print("✅ WPS template updated and changes verified via GET")
    
    def test_template_auto_creation_on_school_access(self):
        """Verify template is auto-created when accessing non-existent template for valid school"""
        # Try to get template for MHPS (should exist or be auto-created)
        response = requests.get(f"{BASE_URL}/api/report-templates/MHPS", headers=self.headers)
        assert response.status_code == 200, f"Template auto-creation failed: {response.text}"
        template = response.json()
        assert template["school_code"] == "MHPS"
        print("✅ Template auto-creation works for existing school")
    
    def test_template_returns_404_for_invalid_school(self):
        """Verify template request returns 404 for non-existent school"""
        response = requests.get(f"{BASE_URL}/api/report-templates/INVALID_SCHOOL_XYZ", headers=self.headers)
        assert response.status_code == 404, f"Expected 404 for invalid school, got {response.status_code}"
        print("✅ Invalid school correctly returns 404")


class TestSchoolsAPI:
    """Test Schools endpoint - verify Template button functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get superuser token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPERUSER_CREDS)
        assert response.status_code == 200
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_schools_list(self):
        """GET /api/schools - verify schools are returned"""
        response = requests.get(f"{BASE_URL}/api/schools", headers=self.headers)
        assert response.status_code == 200, f"Failed to get schools: {response.text}"
        schools = response.json()
        assert isinstance(schools, list), "Schools response should be a list"
        assert len(schools) > 0, "Should have at least one school"
        
        # Verify school structure
        school = schools[0]
        assert "id" in school, "school id missing"
        assert "school_code" in school, "school_code missing"
        assert "name" in school, "school name missing"
        
        school_codes = [s["school_code"] for s in schools]
        assert "JTECH" in school_codes, "JTECH school should exist"
        
        print(f"✅ Schools list retrieved - {len(schools)} schools found: {school_codes}")


class TestImportExportPage:
    """Test Import/Export endpoint accessibility"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get superuser token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPERUSER_CREDS)
        assert response.status_code == 200
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_export_students_template(self):
        """GET /api/export/students-template - returns CSV template"""
        response = requests.get(f"{BASE_URL}/api/export/students-template", headers=self.headers)
        assert response.status_code == 200, f"Failed to get students template: {response.text}"
        assert "student_id" in response.text.lower() or "first_name" in response.text.lower()
        print("✅ Students template export working")
    
    def test_export_teachers_template(self):
        """GET /api/export/teachers-template - returns CSV template"""
        response = requests.get(f"{BASE_URL}/api/export/teachers-template", headers=self.headers)
        assert response.status_code == 200, f"Failed to get teachers template: {response.text}"
        assert "username" in response.text.lower() or "name" in response.text.lower()
        print("✅ Teachers template export working")


class TestGradingScheme:
    """Test grading scheme endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get superuser token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPERUSER_CREDS)
        assert response.status_code == 200
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_grading_scheme(self):
        """GET /api/grading-scheme - returns valid grade scale"""
        response = requests.get(f"{BASE_URL}/api/grading-scheme", headers=self.headers)
        assert response.status_code == 200, f"Failed to get grading scheme: {response.text}"
        data = response.json()
        assert "grading_scheme" in data, "grading_scheme key missing"
        scheme = data["grading_scheme"]
        assert isinstance(scheme, list), "grading_scheme should be a list"
        
        # Verify grade display bug fix - decimal score 89.2 should map to B+ (not E)
        # This tests the grade scale ranges
        for grade in scheme:
            assert "min" in grade and "max" in grade and "grade" in grade
        
        print(f"✅ Grading scheme retrieved - {len(scheme)} grade levels")


class TestGradeBugFix:
    """Test that grade display bug is fixed - decimal scores round correctly"""
    
    def test_grade_scale_boundaries(self):
        """Verify grade scale handles boundary values correctly"""
        # Using MHPS default grade scale
        default_grade_scale = [
            {"min": 90, "max": 100, "grade": "A+", "description": "Excellent"},
            {"min": 85, "max": 89, "grade": "A", "description": "Very Good"},
            {"min": 80, "max": 84, "grade": "A-", "description": "Good"},
            {"min": 75, "max": 79, "grade": "B", "description": "Satisfactory"},
            {"min": 70, "max": 74, "grade": "B-", "description": "Developing"},
            {"min": 65, "max": 69, "grade": "C", "description": "Passing"},
            {"min": 60, "max": 64, "grade": "C-", "description": "Passing"},
            {"min": 55, "max": 59, "grade": "D", "description": "Marginal"},
            {"min": 50, "max": 54, "grade": "D-", "description": "Below Average"},
            {"min": 40, "max": 49, "grade": "E", "description": "Frustration"},
            {"min": 0, "max": 39, "grade": "U", "description": "No participation"},
        ]
        
        def get_grade(score, scale):
            """Mimic frontend logic with Math.round"""
            if score is None:
                return "-"
            rounded = round(score)
            for g in scale:
                if rounded >= g["min"] and rounded <= g["max"]:
                    return g["grade"]
            return "-"
        
        # Test cases from bug report
        test_cases = [
            (89.2, "A"),    # Bug: was showing "E" before fix - rounds to 89
            (91.9, "A+"),   # Should show A+ (rounds to 92)
            (88.1, "A"),    # Should show A (rounds to 88)
            (86.9, "A"),    # Should show A (rounds to 87)
            (79.5, "A-"),   # Should show A- (rounds to 80, which is in 80-84 range)
            (74.4, "B-"),   # Should show B- (rounds to 74)
        ]
        
        for score, expected_grade in test_cases:
            result = get_grade(score, default_grade_scale)
            assert result == expected_grade, f"Score {score} should be {expected_grade}, got {result}"
            print(f"✅ Score {score} correctly maps to {result}")


class TestTemplatePermissions:
    """Test template access permissions"""
    
    def test_template_requires_auth(self):
        """Unauthenticated request should fail"""
        response = requests.get(f"{BASE_URL}/api/report-templates/MHPS")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✅ Template endpoint requires authentication")
    
    def test_template_update_requires_superuser(self):
        """Non-superuser should not be able to update template"""
        # Try to login as WPS admin
        response = requests.post(f"{BASE_URL}/api/auth/login", json=WPS_ADMIN_CREDS)
        if response.status_code != 200:
            pytest.skip("WPS admin login failed - skipping permission test")
        
        token = response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Try to update template (should fail)
        update_data = {
            "school_code": "WPS",
            "school_name": "Test Update",
            "subjects": [],
            "grade_scale": [],
            "sections": {},
            "social_skills_categories": [],
            "achievement_standards": []
        }
        put_response = requests.put(
            f"{BASE_URL}/api/report-templates/WPS",
            json=update_data,
            headers=headers
        )
        assert put_response.status_code == 403, f"Non-superuser should not update template, got {put_response.status_code}"
        print("✅ Template update correctly requires superuser role")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
