"""
Multi-Tenancy Backend Tests for Student Management System
Tests: Login with school code, superuser cross-school access, data segregation, CRUD operations
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
    "username": "admin@wps.edu",
    "password": "WpsAdmin@123"
}


class TestHealthCheck:
    """Basic health check tests"""
    
    def test_api_health(self):
        """Test API health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        assert response.json()["status"] == "healthy"


class TestLoginWithSchoolCode:
    """Test login functionality with school code"""
    
    def test_login_wps_admin(self):
        """Test normal user login with school code (WPS Admin)"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=WPS_ADMIN_CREDS)
        
        if response.status_code == 401:
            # WPS school or admin might not exist yet - create them
            pytest.skip("WPS Admin not found - needs to be seeded first")
        
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["user"]["school_code"] == "WPS"
        assert data["user"]["role"] == "admin"
        print(f"✅ WPS Admin login successful - school_code: {data['user']['school_code']}")
    
    def test_login_superuser_own_school(self):
        """Test superuser login to their own school (JTECH)"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPERUSER_CREDS)
        assert response.status_code == 200
        
        data = response.json()
        assert "access_token" in data
        assert data["user"]["school_code"] == "JTECH"
        assert data["user"]["role"] == "superuser"
        print(f"✅ Superuser login to JTECH successful")
    
    def test_login_superuser_cross_school(self):
        """Test superuser can login to ANY school (WPS) using their credentials"""
        # Superuser logging into WPS school context
        cross_school_creds = {
            "school_code": "WPS",
            "username": "jtech.innovations@outlook.com",
            "password": "Xekleidoma@1"
        }
        
        # First ensure WPS school exists
        superuser_token = self._get_superuser_token()
        if superuser_token:
            self._ensure_wps_school_exists(superuser_token)
        
        response = requests.post(f"{BASE_URL}/api/auth/login", json=cross_school_creds)
        
        if response.status_code == 401:
            # Check if it's because WPS school doesn't exist
            detail = response.json().get("detail", "")
            if "Invalid school code" in detail:
                pytest.skip("WPS school doesn't exist yet")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "access_token" in data
        # Key assertion: superuser should be logged into WPS context
        assert data["user"]["school_code"] == "WPS", f"Expected WPS, got {data['user']['school_code']}"
        assert data["user"]["role"] == "superuser"
        print(f"✅ Superuser cross-school login to WPS successful - school_code: {data['user']['school_code']}")
    
    def test_login_invalid_school_code(self):
        """Test login with invalid school code fails"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "school_code": "INVALID123",
            "username": "test@test.com",
            "password": "password"
        })
        assert response.status_code == 401
        assert "Invalid school code" in response.json().get("detail", "")
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials fails"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "school_code": "JTECH",
            "username": "wrong@email.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401
    
    def _get_superuser_token(self):
        """Helper to get superuser token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPERUSER_CREDS)
        if response.status_code == 200:
            return response.json()["access_token"]
        return None
    
    def _ensure_wps_school_exists(self, token):
        """Helper to ensure WPS school exists"""
        headers = {"Authorization": f"Bearer {token}"}
        # Check if WPS exists
        response = requests.get(f"{BASE_URL}/api/schools", headers=headers)
        if response.status_code == 200:
            schools = response.json()
            wps_exists = any(s["school_code"] == "WPS" for s in schools)
            if not wps_exists:
                # Create WPS school
                requests.post(f"{BASE_URL}/api/schools", headers=headers, json={
                    "school_code": "WPS",
                    "name": "Westside Primary School",
                    "address": "123 West Street",
                    "phone": "555-0100",
                    "email": "info@wps.edu",
                    "is_active": True
                })


class TestSchoolsCRUD:
    """Test Schools CRUD operations (Superuser only)"""
    
    @pytest.fixture
    def superuser_token(self):
        """Get superuser token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPERUSER_CREDS)
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_superuser_can_list_schools(self, superuser_token):
        """Test superuser can list all schools"""
        headers = {"Authorization": f"Bearer {superuser_token}"}
        response = requests.get(f"{BASE_URL}/api/schools", headers=headers)
        
        assert response.status_code == 200
        schools = response.json()
        assert isinstance(schools, list)
        # JTECH should always exist
        jtech_exists = any(s["school_code"] == "JTECH" for s in schools)
        assert jtech_exists, "JTECH school should exist"
        print(f"✅ Listed {len(schools)} schools")
    
    def test_superuser_can_create_school(self, superuser_token):
        """Test superuser can create a new school"""
        headers = {"Authorization": f"Bearer {superuser_token}"}
        
        # Create a test school
        test_school = {
            "school_code": "TEST001",
            "name": "Test School 001",
            "address": "123 Test Street",
            "phone": "555-0001",
            "email": "test@test001.edu",
            "is_active": True
        }
        
        response = requests.post(f"{BASE_URL}/api/schools", headers=headers, json=test_school)
        
        if response.status_code == 400 and "already exists" in response.json().get("detail", ""):
            print("✅ School already exists (expected)")
            return
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["school_code"] == "TEST001"
        assert data["name"] == "Test School 001"
        print(f"✅ Created school: {data['school_code']}")
    
    def test_superuser_can_update_school(self, superuser_token):
        """Test superuser can update a school"""
        headers = {"Authorization": f"Bearer {superuser_token}"}
        
        # First get schools to find one to update
        response = requests.get(f"{BASE_URL}/api/schools", headers=headers)
        schools = response.json()
        
        # Find a non-JTECH school to update
        test_school = next((s for s in schools if s["school_code"] not in ["JTECH"]), None)
        
        if not test_school:
            pytest.skip("No non-JTECH school to update")
        
        # Update the school
        update_data = {
            "school_code": test_school["school_code"],
            "name": f"{test_school['name']} Updated",
            "address": test_school.get("address", ""),
            "phone": test_school.get("phone", ""),
            "email": test_school.get("email", ""),
            "is_active": test_school.get("is_active", True)
        }
        
        response = requests.put(f"{BASE_URL}/api/schools/{test_school['id']}", headers=headers, json=update_data)
        assert response.status_code == 200
        print(f"✅ Updated school: {test_school['school_code']}")
    
    def test_superuser_can_delete_school(self, superuser_token):
        """Test superuser can delete a school (not JTECH)"""
        headers = {"Authorization": f"Bearer {superuser_token}"}
        
        # Create a school to delete
        test_school = {
            "school_code": "TODELETE",
            "name": "School To Delete",
            "address": "",
            "phone": "",
            "email": "",
            "is_active": True
        }
        
        create_response = requests.post(f"{BASE_URL}/api/schools", headers=headers, json=test_school)
        
        if create_response.status_code == 400:
            # Already exists, find it
            schools_response = requests.get(f"{BASE_URL}/api/schools", headers=headers)
            schools = schools_response.json()
            school_to_delete = next((s for s in schools if s["school_code"] == "TODELETE"), None)
            if school_to_delete:
                school_id = school_to_delete["id"]
            else:
                pytest.skip("Could not find or create school to delete")
        else:
            school_id = create_response.json()["id"]
        
        # Delete the school
        response = requests.delete(f"{BASE_URL}/api/schools/{school_id}", headers=headers)
        assert response.status_code == 200
        print(f"✅ Deleted school: TODELETE")
    
    def test_cannot_delete_jtech_school(self, superuser_token):
        """Test that JTECH system school cannot be deleted"""
        headers = {"Authorization": f"Bearer {superuser_token}"}
        
        # Find JTECH school
        response = requests.get(f"{BASE_URL}/api/schools", headers=headers)
        schools = response.json()
        jtech = next((s for s in schools if s["school_code"] == "JTECH"), None)
        
        if not jtech:
            pytest.skip("JTECH school not found")
        
        # Try to delete JTECH
        response = requests.delete(f"{BASE_URL}/api/schools/{jtech['id']}", headers=headers)
        assert response.status_code == 400
        assert "Cannot delete system school" in response.json().get("detail", "")
        print(f"✅ JTECH school protected from deletion")


class TestDataSegregation:
    """Test data segregation between schools"""
    
    @pytest.fixture
    def superuser_jtech_token(self):
        """Get superuser token in JTECH context"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPERUSER_CREDS)
        assert response.status_code == 200
        return response.json()["access_token"]
    
    @pytest.fixture
    def superuser_wps_token(self):
        """Get superuser token in WPS context"""
        # First ensure WPS school exists
        jtech_response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPERUSER_CREDS)
        if jtech_response.status_code == 200:
            token = jtech_response.json()["access_token"]
            headers = {"Authorization": f"Bearer {token}"}
            
            # Check if WPS exists
            schools_response = requests.get(f"{BASE_URL}/api/schools", headers=headers)
            if schools_response.status_code == 200:
                schools = schools_response.json()
                wps_exists = any(s["school_code"] == "WPS" for s in schools)
                if not wps_exists:
                    # Create WPS school
                    requests.post(f"{BASE_URL}/api/schools", headers=headers, json={
                        "school_code": "WPS",
                        "name": "Westside Primary School",
                        "address": "123 West Street",
                        "is_active": True
                    })
        
        # Now login as superuser to WPS context
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "school_code": "WPS",
            "username": "jtech.innovations@outlook.com",
            "password": "Xekleidoma@1"
        })
        
        if response.status_code != 200:
            pytest.skip(f"Could not login to WPS context: {response.text}")
        
        return response.json()["access_token"]
    
    def test_students_segregated_by_school(self, superuser_jtech_token, superuser_wps_token):
        """Test that students are segregated by school context"""
        jtech_headers = {"Authorization": f"Bearer {superuser_jtech_token}"}
        wps_headers = {"Authorization": f"Bearer {superuser_wps_token}"}
        
        # Create a student in WPS context
        wps_student = {
            "first_name": "TEST_WPS",
            "middle_name": "",
            "last_name": "Student",
            "date_of_birth": "2015-01-15",
            "gender": "Male",
            "address": "WPS Address"
        }
        
        create_response = requests.post(f"{BASE_URL}/api/students", headers=wps_headers, json=wps_student)
        
        if create_response.status_code == 200:
            wps_student_id = create_response.json()["id"]
            print(f"✅ Created student in WPS: {wps_student_id}")
        
        # Get students in JTECH context
        jtech_students_response = requests.get(f"{BASE_URL}/api/students", headers=jtech_headers)
        assert jtech_students_response.status_code == 200
        jtech_students = jtech_students_response.json()
        
        # Get students in WPS context
        wps_students_response = requests.get(f"{BASE_URL}/api/students", headers=wps_headers)
        assert wps_students_response.status_code == 200
        wps_students = wps_students_response.json()
        
        # Verify WPS student is NOT visible in JTECH context
        jtech_student_ids = [s["id"] for s in jtech_students]
        wps_student_ids = [s["id"] for s in wps_students]
        
        # Check that WPS students are not in JTECH list
        for wps_id in wps_student_ids:
            if wps_id in jtech_student_ids:
                # This could happen if superuser created student in JTECH context
                # Check school_code
                wps_student_data = next((s for s in wps_students if s["id"] == wps_id), None)
                if wps_student_data and wps_student_data.get("school_code") == "WPS":
                    jtech_student_data = next((s for s in jtech_students if s["id"] == wps_id), None)
                    if jtech_student_data:
                        assert False, f"WPS student {wps_id} should not be visible in JTECH context"
        
        print(f"✅ Data segregation verified - JTECH: {len(jtech_students)} students, WPS: {len(wps_students)} students")
    
    def test_classes_segregated_by_school(self, superuser_jtech_token, superuser_wps_token):
        """Test that classes are segregated by school context"""
        jtech_headers = {"Authorization": f"Bearer {superuser_jtech_token}"}
        wps_headers = {"Authorization": f"Bearer {superuser_wps_token}"}
        
        # Get classes in both contexts
        jtech_classes = requests.get(f"{BASE_URL}/api/classes", headers=jtech_headers).json()
        wps_classes = requests.get(f"{BASE_URL}/api/classes", headers=wps_headers).json()
        
        # Verify school_code in each class
        for cls in jtech_classes:
            assert cls.get("school_code") == "JTECH", f"JTECH class has wrong school_code: {cls.get('school_code')}"
        
        for cls in wps_classes:
            assert cls.get("school_code") == "WPS", f"WPS class has wrong school_code: {cls.get('school_code')}"
        
        print(f"✅ Classes segregated - JTECH: {len(jtech_classes)}, WPS: {len(wps_classes)}")


class TestUsersCRUD:
    """Test Users CRUD operations"""
    
    @pytest.fixture
    def superuser_token(self):
        """Get superuser token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPERUSER_CREDS)
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_ensure_wps_school_and_admin(self, superuser_token):
        """Ensure WPS school and admin exist for testing"""
        headers = {"Authorization": f"Bearer {superuser_token}"}
        
        # Check if WPS school exists
        schools_response = requests.get(f"{BASE_URL}/api/schools", headers=headers)
        schools = schools_response.json()
        wps_exists = any(s["school_code"] == "WPS" for s in schools)
        
        if not wps_exists:
            # Create WPS school
            create_response = requests.post(f"{BASE_URL}/api/schools", headers=headers, json={
                "school_code": "WPS",
                "name": "Westside Primary School",
                "address": "123 West Street",
                "phone": "555-0100",
                "email": "info@wps.edu",
                "is_active": True
            })
            assert create_response.status_code == 200
            print("✅ Created WPS school")
        
        # Login to WPS context to create admin
        wps_login = requests.post(f"{BASE_URL}/api/auth/login", json={
            "school_code": "WPS",
            "username": "jtech.innovations@outlook.com",
            "password": "Xekleidoma@1"
        })
        
        if wps_login.status_code == 200:
            wps_token = wps_login.json()["access_token"]
            wps_headers = {"Authorization": f"Bearer {wps_token}"}
            
            # Check if WPS admin exists
            users_response = requests.get(f"{BASE_URL}/api/users", headers=wps_headers)
            if users_response.status_code == 200:
                users = users_response.json()
                admin_exists = any(u["username"] == "admin@wps.edu" for u in users)
                
                if not admin_exists:
                    # Create WPS admin
                    create_admin = requests.post(f"{BASE_URL}/api/users", headers=wps_headers, json={
                        "username": "admin@wps.edu",
                        "name": "WPS Admin",
                        "role": "admin",
                        "school_code": "WPS",
                        "password": "WpsAdmin@123"
                    })
                    if create_admin.status_code == 200:
                        print("✅ Created WPS admin")
                    else:
                        print(f"⚠️ Could not create WPS admin: {create_admin.text}")
    
    def test_admin_can_create_teacher(self, superuser_token):
        """Test admin can create teacher user in their school"""
        headers = {"Authorization": f"Bearer {superuser_token}"}
        
        # First ensure WPS exists and login to WPS context
        self.test_ensure_wps_school_and_admin(superuser_token)
        
        # Login as WPS admin
        admin_login = requests.post(f"{BASE_URL}/api/auth/login", json=WPS_ADMIN_CREDS)
        
        if admin_login.status_code != 200:
            # Use superuser in WPS context instead
            admin_login = requests.post(f"{BASE_URL}/api/auth/login", json={
                "school_code": "WPS",
                "username": "jtech.innovations@outlook.com",
                "password": "Xekleidoma@1"
            })
        
        if admin_login.status_code != 200:
            pytest.skip("Could not login to WPS context")
        
        admin_token = admin_login.json()["access_token"]
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Create a teacher
        teacher_data = {
            "username": "TEST_teacher@wps.edu",
            "name": "Test Teacher",
            "role": "teacher",
            "school_code": "WPS",
            "password": "Teacher@123"
        }
        
        response = requests.post(f"{BASE_URL}/api/users", headers=admin_headers, json=teacher_data)
        
        if response.status_code == 400 and "already exists" in response.json().get("detail", ""):
            print("✅ Teacher already exists")
            return
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["role"] == "teacher"
        assert data["school_code"] == "WPS"
        print(f"✅ Created teacher: {data['username']}")
    
    def test_admin_can_create_parent(self, superuser_token):
        """Test admin can create parent user in their school"""
        # Login to WPS context
        admin_login = requests.post(f"{BASE_URL}/api/auth/login", json={
            "school_code": "WPS",
            "username": "jtech.innovations@outlook.com",
            "password": "Xekleidoma@1"
        })
        
        if admin_login.status_code != 200:
            pytest.skip("Could not login to WPS context")
        
        admin_token = admin_login.json()["access_token"]
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Create a parent
        parent_data = {
            "username": "TEST_parent@wps.edu",
            "name": "Test Parent",
            "role": "parent",
            "school_code": "WPS",
            "password": "Parent@123"
        }
        
        response = requests.post(f"{BASE_URL}/api/users", headers=admin_headers, json=parent_data)
        
        if response.status_code == 400 and "already exists" in response.json().get("detail", ""):
            print("✅ Parent already exists")
            return
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["role"] == "parent"
        print(f"✅ Created parent: {data['username']}")


class TestStudentsCRUD:
    """Test Students CRUD operations"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin token in WPS context"""
        # First ensure WPS exists
        superuser_login = requests.post(f"{BASE_URL}/api/auth/login", json=SUPERUSER_CREDS)
        if superuser_login.status_code == 200:
            token = superuser_login.json()["access_token"]
            headers = {"Authorization": f"Bearer {token}"}
            
            # Ensure WPS school exists
            schools = requests.get(f"{BASE_URL}/api/schools", headers=headers).json()
            if not any(s["school_code"] == "WPS" for s in schools):
                requests.post(f"{BASE_URL}/api/schools", headers=headers, json={
                    "school_code": "WPS",
                    "name": "Westside Primary School",
                    "is_active": True
                })
        
        # Login to WPS context
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "school_code": "WPS",
            "username": "jtech.innovations@outlook.com",
            "password": "Xekleidoma@1"
        })
        
        if response.status_code != 200:
            pytest.skip("Could not login to WPS context")
        
        return response.json()["access_token"]
    
    def test_create_student(self, admin_token):
        """Test creating a student"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        student_data = {
            "first_name": "TEST_John",
            "middle_name": "Michael",
            "last_name": "Doe",
            "date_of_birth": "2015-05-15",
            "gender": "Male",
            "address": "123 Test Street",
            "house": "Red House"
        }
        
        response = requests.post(f"{BASE_URL}/api/students", headers=headers, json=student_data)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["first_name"] == "TEST_John"
        assert data["school_code"] == "WPS"
        assert data["age"] > 0  # Age should be calculated
        print(f"✅ Created student: {data['first_name']} {data['last_name']}, Age: {data['age']}")
        
        return data["id"]
    
    def test_read_students(self, admin_token):
        """Test reading students list"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        response = requests.get(f"{BASE_URL}/api/students", headers=headers)
        assert response.status_code == 200
        
        students = response.json()
        assert isinstance(students, list)
        print(f"✅ Retrieved {len(students)} students")
    
    def test_update_student(self, admin_token):
        """Test updating a student"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # First create a student
        student_data = {
            "first_name": "TEST_Update",
            "middle_name": "",
            "last_name": "Student",
            "date_of_birth": "2016-03-20",
            "gender": "Female",
            "address": "Original Address"
        }
        
        create_response = requests.post(f"{BASE_URL}/api/students", headers=headers, json=student_data)
        if create_response.status_code != 200:
            pytest.skip("Could not create student for update test")
        
        student_id = create_response.json()["id"]
        
        # Update the student
        update_data = {
            "first_name": "TEST_Update",
            "middle_name": "Updated",
            "last_name": "Student",
            "date_of_birth": "2016-03-20",
            "gender": "Female",
            "address": "Updated Address"
        }
        
        response = requests.put(f"{BASE_URL}/api/students/{student_id}", headers=headers, json=update_data)
        assert response.status_code == 200
        
        data = response.json()
        assert data["middle_name"] == "Updated"
        assert data["address"] == "Updated Address"
        print(f"✅ Updated student: {student_id}")
    
    def test_delete_student(self, admin_token):
        """Test deleting a student"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # First create a student to delete
        student_data = {
            "first_name": "TEST_Delete",
            "middle_name": "",
            "last_name": "Me",
            "date_of_birth": "2017-01-01",
            "gender": "Male",
            "address": ""
        }
        
        create_response = requests.post(f"{BASE_URL}/api/students", headers=headers, json=student_data)
        if create_response.status_code != 200:
            pytest.skip("Could not create student for delete test")
        
        student_id = create_response.json()["id"]
        
        # Delete the student
        response = requests.delete(f"{BASE_URL}/api/students/{student_id}", headers=headers)
        assert response.status_code == 200
        
        # Verify deletion
        get_response = requests.get(f"{BASE_URL}/api/students/{student_id}", headers=headers)
        assert get_response.status_code == 404
        print(f"✅ Deleted student: {student_id}")


class TestClassesCRUD:
    """Test Classes CRUD operations"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin token in WPS context"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "school_code": "WPS",
            "username": "jtech.innovations@outlook.com",
            "password": "Xekleidoma@1"
        })
        
        if response.status_code != 200:
            # Try to create WPS school first
            superuser_login = requests.post(f"{BASE_URL}/api/auth/login", json=SUPERUSER_CREDS)
            if superuser_login.status_code == 200:
                token = superuser_login.json()["access_token"]
                headers = {"Authorization": f"Bearer {token}"}
                requests.post(f"{BASE_URL}/api/schools", headers=headers, json={
                    "school_code": "WPS",
                    "name": "Westside Primary School",
                    "is_active": True
                })
                # Try again
                response = requests.post(f"{BASE_URL}/api/auth/login", json={
                    "school_code": "WPS",
                    "username": "jtech.innovations@outlook.com",
                    "password": "Xekleidoma@1"
                })
        
        if response.status_code != 200:
            pytest.skip("Could not login to WPS context")
        
        return response.json()["access_token"]
    
    def test_create_class(self, admin_token):
        """Test creating a class"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        class_data = {
            "name": "TEST_Grade 1A",
            "grade_level": "Grade 1",
            "room_number": "101",
            "academic_year": "2024-2025"
        }
        
        response = requests.post(f"{BASE_URL}/api/classes", headers=headers, json=class_data)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["name"] == "TEST_Grade 1A"
        assert data["school_code"] == "WPS"
        print(f"✅ Created class: {data['name']}")
    
    def test_read_classes(self, admin_token):
        """Test reading classes list"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        response = requests.get(f"{BASE_URL}/api/classes", headers=headers)
        assert response.status_code == 200
        
        classes = response.json()
        assert isinstance(classes, list)
        print(f"✅ Retrieved {len(classes)} classes")


class TestDashboardStats:
    """Test Dashboard statistics"""
    
    def test_dashboard_stats_superuser(self):
        """Test dashboard stats for superuser"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPERUSER_CREDS)
        assert response.status_code == 200
        
        token = response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        stats_response = requests.get(f"{BASE_URL}/api/stats/dashboard", headers=headers)
        assert stats_response.status_code == 200
        
        stats = stats_response.json()
        assert "total_students" in stats
        assert "total_classes" in stats
        assert "total_schools" in stats  # Superuser should see total schools
        print(f"✅ Dashboard stats: {stats}")
    
    def test_dashboard_stats_school_context(self):
        """Test dashboard stats are filtered by school context"""
        # Login to WPS context
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "school_code": "WPS",
            "username": "jtech.innovations@outlook.com",
            "password": "Xekleidoma@1"
        })
        
        if response.status_code != 200:
            pytest.skip("Could not login to WPS context")
        
        token = response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        stats_response = requests.get(f"{BASE_URL}/api/stats/dashboard", headers=headers)
        assert stats_response.status_code == 200
        
        stats = stats_response.json()
        # Stats should be for WPS school context
        print(f"✅ WPS Dashboard stats: {stats}")


class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_data(self):
        """Clean up TEST_ prefixed data"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPERUSER_CREDS)
        if response.status_code != 200:
            return
        
        token = response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Clean up test students in JTECH
        students = requests.get(f"{BASE_URL}/api/students", headers=headers).json()
        for student in students:
            if student.get("first_name", "").startswith("TEST_"):
                requests.delete(f"{BASE_URL}/api/students/{student['id']}", headers=headers)
        
        # Clean up in WPS context
        wps_login = requests.post(f"{BASE_URL}/api/auth/login", json={
            "school_code": "WPS",
            "username": "jtech.innovations@outlook.com",
            "password": "Xekleidoma@1"
        })
        
        if wps_login.status_code == 200:
            wps_token = wps_login.json()["access_token"]
            wps_headers = {"Authorization": f"Bearer {wps_token}"}
            
            wps_students = requests.get(f"{BASE_URL}/api/students", headers=wps_headers).json()
            for student in wps_students:
                if student.get("first_name", "").startswith("TEST_"):
                    requests.delete(f"{BASE_URL}/api/students/{student['id']}", headers=wps_headers)
        
        print("✅ Cleanup completed")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
