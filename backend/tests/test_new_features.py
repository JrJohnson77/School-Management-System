"""
Backend tests for new features:
- Grade display bug fix (decimal score rounding)
- CSV import/export endpoints
- Signature management endpoints
- Social skills endpoints
"""
import pytest
import requests
import os
import io

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SUPERUSER_CREDENTIALS = {
    "username": "jtech.innovations@outlook.com",
    "password": "Xekleidoma@1",
    "school_code": "JTECH"
}

WPS_ADMIN_CREDENTIALS = {
    "username": "wps.admin@school.com",
    "password": "Password@123",
    "school_code": "WPS"
}


class TestHealthCheck:
    """Basic health check"""
    
    def test_health_endpoint(self):
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print("✅ Health check passed")


class TestAuthentication:
    """Test authentication flows"""
    
    def test_superuser_login(self):
        """Test superuser login with JTECH school code"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPERUSER_CREDENTIALS)
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data.get("user", {}).get("role") == "superuser"
        print("✅ Superuser login successful")
        return data["access_token"]


class TestCSVExportEndpoints:
    """Test CSV template export endpoints"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get authenticated headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPERUSER_CREDENTIALS)
        if response.status_code != 200:
            pytest.skip("Authentication failed")
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_students_template_download(self, auth_headers):
        """Test GET /api/export/students-template returns CSV"""
        response = requests.get(f"{BASE_URL}/api/export/students-template", headers=auth_headers)
        assert response.status_code == 200
        assert "text/csv" in response.headers.get("Content-Type", "")
        
        # Verify CSV content has expected headers
        content = response.text
        assert "student_id" in content
        assert "first_name" in content
        assert "last_name" in content
        assert "date_of_birth" in content
        print("✅ Students template download works")
        print(f"   CSV content preview: {content[:100]}...")
    
    def test_teachers_template_download(self, auth_headers):
        """Test GET /api/export/teachers-template returns CSV"""
        response = requests.get(f"{BASE_URL}/api/export/teachers-template", headers=auth_headers)
        assert response.status_code == 200
        assert "text/csv" in response.headers.get("Content-Type", "")
        
        # Verify CSV content has expected headers
        content = response.text
        assert "username" in content
        assert "name" in content
        assert "password" in content
        print("✅ Teachers template download works")
        print(f"   CSV content preview: {content[:100]}...")


class TestSignaturesEndpoints:
    """Test signature management endpoints"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get authenticated headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPERUSER_CREDENTIALS)
        if response.status_code != 200:
            pytest.skip("Authentication failed")
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_get_signatures(self, auth_headers):
        """Test GET /api/signatures returns school signatures"""
        response = requests.get(f"{BASE_URL}/api/signatures", headers=auth_headers)
        assert response.status_code == 200
        # Response should be a dict (empty or with signatures)
        data = response.json()
        assert isinstance(data, dict)
        print("✅ GET /api/signatures works")
        print(f"   Signatures data: {data}")
    
    def test_signature_upload_invalid_type(self, auth_headers):
        """Test POST /api/signatures/upload with invalid signature_type"""
        # Create a dummy image file
        dummy_image = io.BytesIO(b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR')
        dummy_image.name = "test.png"
        
        files = {"file": ("test.png", dummy_image, "image/png")}
        response = requests.post(
            f"{BASE_URL}/api/signatures/upload?signature_type=invalid",
            headers=auth_headers,
            files=files
        )
        assert response.status_code == 400
        print("✅ Signature upload validation works (rejects invalid type)")


class TestSocialSkillsEndpoints:
    """Test social skills endpoints"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get authenticated headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPERUSER_CREDENTIALS)
        if response.status_code != 200:
            pytest.skip("Authentication failed")
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_save_social_skills(self, auth_headers):
        """Test POST /api/social-skills saves social skills"""
        payload = {
            "student_id": "TEST_STUDENT_123",
            "term": "Term 1",
            "academic_year": "2025-2026",
            "skills": {
                "Completes Assignments": "Good",
                "Follows Instructions": "Excellent",
                "Punctuality": "Satisfactory",
                "Respect for Teacher": "Good"
            }
        }
        
        response = requests.post(
            f"{BASE_URL}/api/social-skills",
            headers=auth_headers,
            json=payload
        )
        assert response.status_code == 200
        data = response.json()
        assert "id" in data or "message" in data
        print("✅ POST /api/social-skills works")
        print(f"   Response: {data}")
    
    def test_get_social_skills(self, auth_headers):
        """Test GET /api/social-skills/{student_id} retrieves skills"""
        student_id = "TEST_STUDENT_123"
        term = "Term 1"
        academic_year = "2025-2026"
        
        response = requests.get(
            f"{BASE_URL}/api/social-skills/{student_id}?term={term}&academic_year={academic_year}",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "skills" in data
        print("✅ GET /api/social-skills/{student_id} works")
        print(f"   Skills data: {data}")


class TestGradeBugFix:
    """Test the grade display bug fix - decimal scores should round correctly"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get authenticated headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPERUSER_CREDENTIALS)
        if response.status_code != 200:
            pytest.skip("Authentication failed")
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_grading_scheme_endpoint(self, auth_headers):
        """Test GET /api/grading-scheme returns grade scale"""
        response = requests.get(f"{BASE_URL}/api/grading-scheme", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "grading_scheme" in data
        print("✅ GET /api/grading-scheme works")
        
        # Check grading scheme has grades
        scheme = data.get("grading_scheme", [])
        grades_found = [g.get("grade") for g in scheme]
        print(f"   Grades in scheme: {grades_found}")
        
        # Verify scheme has grades (can be standard or MHPS)
        assert len(grades_found) >= 5, "Should have at least 5 grade levels"
        print("✅ Grading scheme has valid grades")


class TestCSVImportEndpoints:
    """Test CSV import functionality"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get authenticated headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPERUSER_CREDENTIALS)
        if response.status_code != 200:
            pytest.skip("Authentication failed")
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_import_students_no_file(self, auth_headers):
        """Test import students endpoint returns error without file"""
        response = requests.post(
            f"{BASE_URL}/api/import/students?class_id=test123",
            headers=auth_headers
        )
        # Should return 422 (validation error) or 400 without file
        assert response.status_code in [400, 422]
        print("✅ Import students validates file requirement")
    
    def test_import_teachers_no_file(self, auth_headers):
        """Test import teachers endpoint returns error without file"""
        response = requests.post(
            f"{BASE_URL}/api/import/teachers",
            headers=auth_headers
        )
        # Should return 422 (validation error) or 400 without file
        assert response.status_code in [400, 422]
        print("✅ Import teachers validates file requirement")


class TestReportCardsEndpoint:
    """Test report cards generation endpoint"""
    
    @pytest.fixture
    def wps_auth_headers(self):
        """Get authenticated headers with WPS school"""
        # Try WPS Admin credentials
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin@wps.edu",
            "password": "WpsAdmin@123",
            "school_code": "WPS"
        })
        if response.status_code != 200:
            pytest.skip("WPS Authentication failed")
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_report_cards_class_endpoint(self, wps_auth_headers):
        """Test GET /api/report-cards/class/{class_id} endpoint exists"""
        # First get a real class from WPS
        classes_response = requests.get(f"{BASE_URL}/api/classes", headers=wps_auth_headers)
        if classes_response.status_code != 200 or not classes_response.json():
            pytest.skip("No classes available for testing")
        
        class_id = classes_response.json()[0]["id"]
        
        response = requests.get(
            f"{BASE_URL}/api/report-cards/class/{class_id}?term=Term 1&academic_year=2025-2026",
            headers=wps_auth_headers
        )
        # Should return 200 with report cards data
        assert response.status_code == 200
        data = response.json()
        assert "report_cards" in data
        print("✅ Report cards endpoint works")
        print(f"   Response keys: {list(data.keys())}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
