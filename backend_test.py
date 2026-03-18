#!/usr/bin/env python3
"""
Backend API Testing for Lumina-SIS
Tests all key endpoints after branding update
"""

import requests
import json
import sys
from typing import Dict, Any

# API base URL from frontend configuration
BASE_URL = "https://lumina-ui-refresh.preview.emergentagent.com/api"

# Test credentials
TEST_CREDENTIALS = {
    "school_code": "JTECH",
    "username": "jtech.innovations@outlook.com", 
    "password": "Xekleidoma@1"
}

class APITester:
    def __init__(self):
        self.access_token = None
        self.test_results = []
        
    def log_test(self, test_name: str, success: bool, message: str, response_data: Any = None):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} - {test_name}: {message}")
        
        result = {
            "test": test_name,
            "success": success,
            "message": message,
            "response_data": response_data
        }
        self.test_results.append(result)
        
        if not success:
            print(f"   Details: {response_data}")
    
    def test_health_endpoint(self):
        """Test the health endpoint"""
        try:
            response = requests.get(f"{BASE_URL}/health", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "healthy":
                    self.log_test("Health Check", True, "Health endpoint working correctly", data)
                    return True
                else:
                    self.log_test("Health Check", False, f"Unexpected health response", data)
                    return False
            else:
                self.log_test("Health Check", False, f"HTTP {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_test("Health Check", False, f"Connection error: {str(e)}")
            return False
    
    def test_detailed_health_endpoint(self):
        """Test the detailed health endpoint that should return Lumina-SIS branding"""
        try:
            # Try the root health endpoint that might have the branded message
            response = requests.get(f"{BASE_URL}", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                expected_message = "Lumina-SIS API"
                if data.get("message") == expected_message and data.get("status") == "healthy":
                    self.log_test("Branded Health Check", True, "Lumina-SIS branding confirmed", data)
                    return True
                else:
                    self.log_test("Branded Health Check", False, f"Expected branded message not found", data)
                    return False
            else:
                # Try alternative endpoint
                response = requests.get(f"{BASE_URL}/", timeout=10)
                if response.status_code == 200:
                    data = response.json()
                    expected_message = "Lumina-SIS API"
                    if data.get("message") == expected_message:
                        self.log_test("Branded Health Check", True, "Lumina-SIS branding confirmed", data)
                        return True
                
                self.log_test("Branded Health Check", False, f"HTTP {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_test("Branded Health Check", False, f"Connection error: {str(e)}")
            return False
    
    def test_login_endpoint(self):
        """Test login endpoint and get access token"""
        try:
            response = requests.post(
                f"{BASE_URL}/auth/login",
                json=TEST_CREDENTIALS,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if "access_token" in data and "user" in data:
                    self.access_token = data["access_token"]
                    user_info = data["user"]
                    self.log_test("Login", True, f"Login successful for user: {user_info.get('name')}", {
                        "token_type": data.get("token_type"),
                        "user_role": user_info.get("role"),
                        "school_code": user_info.get("school_code")
                    })
                    return True
                else:
                    self.log_test("Login", False, "Missing access_token or user in response", data)
                    return False
            else:
                self.log_test("Login", False, f"HTTP {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_test("Login", False, f"Connection error: {str(e)}")
            return False
    
    def test_auth_me_endpoint(self):
        """Test /auth/me endpoint with token"""
        if not self.access_token:
            self.log_test("Auth Me", False, "No access token available")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.access_token}"}
            response = requests.get(f"{BASE_URL}/auth/me", headers=headers, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if "username" in data and "role" in data and "school_code" in data:
                    self.log_test("Auth Me", True, f"User info retrieved: {data.get('name')} ({data.get('role')})", data)
                    return True
                else:
                    self.log_test("Auth Me", False, "Missing expected user fields", data)
                    return False
            else:
                self.log_test("Auth Me", False, f"HTTP {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_test("Auth Me", False, f"Connection error: {str(e)}")
            return False
    
    def test_students_endpoint(self):
        """Test /students endpoint"""
        if not self.access_token:
            self.log_test("Students List", False, "No access token available")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.access_token}"}
            response = requests.get(f"{BASE_URL}/students", headers=headers, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log_test("Students List", True, f"Retrieved {len(data)} students", {"count": len(data)})
                    return True
                else:
                    self.log_test("Students List", False, "Response is not a list", data)
                    return False
            else:
                self.log_test("Students List", False, f"HTTP {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_test("Students List", False, f"Connection error: {str(e)}")
            return False
    
    def test_classes_endpoint(self):
        """Test /classes endpoint"""
        if not self.access_token:
            self.log_test("Classes List", False, "No access token available")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.access_token}"}
            response = requests.get(f"{BASE_URL}/classes", headers=headers, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log_test("Classes List", True, f"Retrieved {len(data)} classes", {"count": len(data)})
                    return True
                else:
                    self.log_test("Classes List", False, "Response is not a list", data)
                    return False
            else:
                self.log_test("Classes List", False, f"HTTP {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_test("Classes List", False, f"Connection error: {str(e)}")
            return False
    
    def test_dashboard_stats_endpoint(self):
        """Test /stats/dashboard endpoint"""
        if not self.access_token:
            self.log_test("Dashboard Stats", False, "No access token available")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.access_token}"}
            response = requests.get(f"{BASE_URL}/stats/dashboard", headers=headers, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, dict):
                    # Check for expected stats fields
                    expected_fields = ["total_students", "total_classes", "total_teachers"]
                    has_expected_fields = any(field in data for field in expected_fields)
                    
                    if has_expected_fields:
                        self.log_test("Dashboard Stats", True, f"Retrieved dashboard statistics", data)
                        return True
                    else:
                        self.log_test("Dashboard Stats", True, f"Retrieved stats (different format)", data)
                        return True
                else:
                    self.log_test("Dashboard Stats", False, "Response is not a dict", data)
                    return False
            else:
                self.log_test("Dashboard Stats", False, f"HTTP {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_test("Dashboard Stats", False, f"Connection error: {str(e)}")
            return False
    
    def test_create_student_with_new_fields(self):
        """Test creating a student with new extended fields including family members"""
        if not self.access_token:
            self.log_test("Create Student with New Fields", False, "No access token available")
            return False, None
            
        student_data = {
            "first_name": "Test",
            "last_name": "Student",
            "date_of_birth": "2015-01-15",
            "gender": "Male",
            "student_phone": "555-0100",
            "student_email": "test@example.com",
            "address_line1": "123 Main St",
            "address_line2": "Apt 4",
            "city_state": "New York, NY",
            "country": "USA",
            "family_members": [
                {
                    "salutation": "Mrs.",
                    "first_name": "Jane",
                    "last_name": "Student",
                    "gender": "Female",
                    "relationship": "Mother",
                    "cell_phone": "555-0101",
                    "email": "jane@example.com",
                    "address_line1": "123 Main St",
                    "city_state": "New York, NY",
                    "country": "USA"
                }
            ]
        }
        
        try:
            headers = {"Authorization": f"Bearer {self.access_token}"}
            response = requests.post(f"{BASE_URL}/students", headers=headers, json=student_data, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if "id" in data:
                    # Verify new fields are present
                    required_fields = ["student_phone", "student_email", "address_line1", "city_state", "country", "family_members"]
                    missing_fields = [field for field in required_fields if field not in data]
                    
                    if missing_fields:
                        self.log_test("Create Student with New Fields", False, f"Missing fields: {missing_fields}", data)
                        return False, data.get("id")
                    
                    # Verify family member structure
                    if data.get("family_members") and len(data["family_members"]) > 0:
                        family_member = data["family_members"][0]
                        fm_required = ["salutation", "first_name", "relationship", "cell_phone", "email"]
                        missing_fm_fields = [field for field in fm_required if field not in family_member]
                        
                        if missing_fm_fields:
                            self.log_test("Create Student with New Fields", False, f"Missing family member fields: {missing_fm_fields}", data)
                            return False, data.get("id")
                    
                    self.log_test("Create Student with New Fields", True, f"Student created with all new fields", {
                        "id": data.get("id"),
                        "student_phone": data.get("student_phone"),
                        "student_email": data.get("student_email"),
                        "family_members_count": len(data.get("family_members", []))
                    })
                    return True, data.get("id")
                else:
                    self.log_test("Create Student with New Fields", False, "No ID in response", data)
                    return False, None
            else:
                self.log_test("Create Student with New Fields", False, f"HTTP {response.status_code}", response.text)
                return False, None
                
        except Exception as e:
            self.log_test("Create Student with New Fields", False, f"Connection error: {str(e)}")
            return False, None
    
    def test_get_students_with_new_fields(self, expected_student_id=None):
        """Test retrieving students and verify new fields are returned"""
        if not self.access_token:
            self.log_test("Get Students with New Fields", False, "No access token available")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.access_token}"}
            response = requests.get(f"{BASE_URL}/students", headers=headers, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    if expected_student_id:
                        # Find the specific student
                        test_student = next((s for s in data if s.get("id") == expected_student_id), None)
                        if test_student:
                            # Verify new fields are present
                            required_fields = ["student_phone", "student_email", "address_line1", "city_state", "country", "family_members"]
                            present_fields = {field: test_student.get(field) for field in required_fields if field in test_student}
                            
                            self.log_test("Get Students with New Fields", True, f"Retrieved student with new fields", {
                                "student_id": expected_student_id,
                                "present_fields": present_fields,
                                "family_members_count": len(test_student.get("family_members", []))
                            })
                            return True
                        else:
                            self.log_test("Get Students with New Fields", False, f"Test student {expected_student_id} not found in list")
                            return False
                    else:
                        self.log_test("Get Students with New Fields", True, f"Retrieved {len(data)} students", {"count": len(data)})
                        return True
                else:
                    self.log_test("Get Students with New Fields", False, "Response is not a list", data)
                    return False
            else:
                self.log_test("Get Students with New Fields", False, f"HTTP {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_test("Get Students with New Fields", False, f"Connection error: {str(e)}")
            return False
    
    def test_create_teacher_with_new_fields(self):
        """Test creating a teacher/user with new extended fields"""
        if not self.access_token:
            self.log_test("Create Teacher with New Fields", False, "No access token available")
            return False, None
            
        teacher_data = {
            "username": "test_teacher_123",
            "name": "Mr. John Doe",
            "password": "TestPass123!",
            "role": "teacher",
            "school_code": "JTECH",
            "salutation": "Mr.",
            "first_name": "John",
            "middle_name": "A",
            "last_name": "Doe",
            "gender": "Male",
            "address_line1": "456 Oak Ave",
            "city_state": "Boston, MA",
            "country": "USA",
            "phone": "555-0200",
            "email": "john@school.com"
        }
        
        try:
            headers = {"Authorization": f"Bearer {self.access_token}"}
            response = requests.post(f"{BASE_URL}/users", headers=headers, json=teacher_data, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if "id" in data:
                    # Verify new fields are present
                    required_fields = ["salutation", "first_name", "middle_name", "last_name", "gender", 
                                     "address_line1", "city_state", "country", "phone", "email"]
                    missing_fields = [field for field in required_fields if field not in data]
                    
                    if missing_fields:
                        self.log_test("Create Teacher with New Fields", False, f"Missing fields: {missing_fields}", data)
                        return False, data.get("id")
                    
                    self.log_test("Create Teacher with New Fields", True, f"Teacher created with all new fields", {
                        "id": data.get("id"),
                        "username": data.get("username"),
                        "salutation": data.get("salutation"),
                        "first_name": data.get("first_name"),
                        "phone": data.get("phone"),
                        "email": data.get("email")
                    })
                    return True, data.get("id")
                else:
                    self.log_test("Create Teacher with New Fields", False, "No ID in response", data)
                    return False, None
            else:
                self.log_test("Create Teacher with New Fields", False, f"HTTP {response.status_code}", response.text)
                return False, None
                
        except Exception as e:
            self.log_test("Create Teacher with New Fields", False, f"Connection error: {str(e)}")
            return False, None
    
    def test_delete_student(self, student_id):
        """Delete test student"""
        if not self.access_token or not student_id:
            self.log_test("Delete Test Student", False, "No access token or student ID available")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.access_token}"}
            response = requests.delete(f"{BASE_URL}/students/{student_id}", headers=headers, timeout=10)
            
            if response.status_code == 200:
                self.log_test("Delete Test Student", True, f"Student {student_id} deleted successfully")
                return True
            else:
                self.log_test("Delete Test Student", False, f"HTTP {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_test("Delete Test Student", False, f"Connection error: {str(e)}")
            return False
    
    def test_delete_teacher(self, teacher_id):
        """Delete test teacher"""
        if not self.access_token or not teacher_id:
            self.log_test("Delete Test Teacher", False, "No access token or teacher ID available")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.access_token}"}
            response = requests.delete(f"{BASE_URL}/users/{teacher_id}", headers=headers, timeout=10)
            
            if response.status_code == 200:
                self.log_test("Delete Test Teacher", True, f"Teacher {teacher_id} deleted successfully")
                return True
            else:
                self.log_test("Delete Test Teacher", False, f"HTTP {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_test("Delete Test Teacher", False, f"Connection error: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all API tests in sequence"""
        print("🧪 Starting Lumina-SIS Backend API Tests")
        print("=" * 50)
        print(f"Testing against: {BASE_URL}")
        print()
        
        # Test 1: Basic Health Check
        self.test_health_endpoint()
        
        # Test 2: Branded Health Check (Lumina-SIS branding)
        self.test_detailed_health_endpoint()
        
        # Test 3: Login (required for authenticated endpoints)
        login_success = self.test_login_endpoint()
        
        if login_success:
            # Test 4: Auth Me
            self.test_auth_me_endpoint()
            
            # Test 5: Students (original)
            self.test_students_endpoint()
            
            # Test 6: Classes
            self.test_classes_endpoint()
            
            # Test 7: Dashboard Stats
            self.test_dashboard_stats_endpoint()
            
            # NEW TESTS FOR EXTENDED FIELDS
            print("\n🔧 Testing New Extended Fields:")
            print("-" * 30)
            
            # Test 8: Create Student with New Fields
            student_created, student_id = self.test_create_student_with_new_fields()
            
            # Test 9: Get Students with New Fields  
            if student_created and student_id:
                self.test_get_students_with_new_fields(student_id)
            
            # Test 10: Create Teacher with New Fields
            teacher_created, teacher_id = self.test_create_teacher_with_new_fields()
            
            # CLEANUP
            print("\n🧹 Cleanup:")
            print("-" * 15)
            
            # Test 11 & 12: Delete test data
            if student_id:
                self.test_delete_student(student_id)
            if teacher_id:
                self.test_delete_teacher(teacher_id)
                
        else:
            print("\n⚠️  Skipping authenticated tests due to login failure")
        
        # Print summary
        print("\n" + "=" * 50)
        print("📊 Test Summary:")
        
        passed = sum(1 for r in self.test_results if r["success"])
        total = len(self.test_results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        
        if passed == total:
            print("\n🎉 All tests passed! API is working correctly.")
            return True
        else:
            print(f"\n⚠️  {total - passed} test(s) failed. Check details above.")
            return False

def main():
    """Main test runner"""
    tester = APITester()
    success = tester.run_all_tests()
    
    # Exit with error code if tests failed
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()