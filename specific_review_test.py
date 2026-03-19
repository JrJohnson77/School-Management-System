#!/usr/bin/env python3
"""
Specific Backend API Testing for Review Request
Tests the exact endpoints and scenarios mentioned in the review request
"""

import requests
import json
import sys

# API base URL from frontend configuration
BASE_URL = "https://github-mhps-test.preview.emergentagent.com/api"

class ReviewRequestTester:
    def __init__(self):
        self.access_token = None
        self.test_results = []
        
    def log_test(self, test_name: str, success: bool, message: str, details=None):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} - {test_name}: {message}")
        if details and not success:
            print(f"   Details: {details}")
        
        self.test_results.append({
            "test": test_name,
            "success": success,
            "message": message
        })
    
    def test_health_endpoint(self):
        """Test GET /api/health - should return 200 with Lumina-SIS message"""
        try:
            response = requests.get(f"{BASE_URL}/health", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "healthy":
                    self.log_test("GET /api/health", True, "Returns 200 with healthy status")
                    return True
                else:
                    self.log_test("GET /api/health", False, f"Unexpected response: {data}")
                    return False
            else:
                self.log_test("GET /api/health", False, f"HTTP {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_test("GET /api/health", False, f"Error: {str(e)}")
            return False
    
    def test_login_with_specific_credentials(self):
        """Test POST /api/auth/login with specific credentials"""
        credentials = {
            "school_code": "JTECH",
            "username": "jtech.innovations@outlook.com",
            "password": "Xekleidoma@1"
        }
        
        try:
            response = requests.post(f"{BASE_URL}/auth/login", json=credentials, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if "access_token" in data:
                    self.access_token = data["access_token"]
                    self.log_test("POST /api/auth/login", True, "Login successful, token received")
                    return True
                else:
                    self.log_test("POST /api/auth/login", False, "No access_token in response", data)
                    return False
            else:
                self.log_test("POST /api/auth/login", False, f"HTTP {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_test("POST /api/auth/login", False, f"Error: {str(e)}")
            return False
    
    def test_create_student_with_exact_data(self):
        """Test POST /api/students with exact data from review request"""
        if not self.access_token:
            self.log_test("POST /api/students", False, "No access token available")
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
                if "id" in data and "family_members" in data and len(data["family_members"]) > 0:
                    # Verify all expected fields are present
                    expected_fields = [
                        "first_name", "last_name", "date_of_birth", "gender", 
                        "student_phone", "student_email", "address_line1", "address_line2",
                        "city_state", "country", "family_members"
                    ]
                    
                    missing_fields = [f for f in expected_fields if f not in data or data[f] is None]
                    if missing_fields:
                        self.log_test("POST /api/students", False, f"Missing fields: {missing_fields}", data)
                        return False, data.get("id")
                    
                    # Verify family member data
                    fm = data["family_members"][0]
                    fm_fields = ["salutation", "first_name", "relationship", "cell_phone", "email"]
                    missing_fm = [f for f in fm_fields if f not in fm]
                    if missing_fm:
                        self.log_test("POST /api/students", False, f"Missing family member fields: {missing_fm}", fm)
                        return False, data.get("id")
                    
                    self.log_test("POST /api/students", True, "Student created with all new fields including family_members")
                    return True, data.get("id")
                else:
                    self.log_test("POST /api/students", False, "Missing ID or family_members in response", data)
                    return False, None
            else:
                self.log_test("POST /api/students", False, f"HTTP {response.status_code}", response.text)
                return False, None
        except Exception as e:
            self.log_test("POST /api/students", False, f"Error: {str(e)}")
            return False, None
    
    def test_get_students_verify_fields(self, expected_student_id):
        """Test GET /api/students and verify new student appears with all fields"""
        if not self.access_token:
            self.log_test("GET /api/students", False, "No access token available")
            return False
        
        try:
            headers = {"Authorization": f"Bearer {self.access_token}"}
            response = requests.get(f"{BASE_URL}/students", headers=headers, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    # Find our test student
                    test_student = next((s for s in data if s.get("id") == expected_student_id), None)
                    if test_student:
                        # Verify all expected fields including family_members
                        has_family = "family_members" in test_student and len(test_student["family_members"]) > 0
                        has_new_fields = all(f in test_student for f in ["student_phone", "student_email", "address_line1"])
                        
                        if has_family and has_new_fields:
                            self.log_test("GET /api/students", True, "Test student found with all new fields including family_members")
                            return True
                        else:
                            self.log_test("GET /api/students", False, "Test student missing some new fields")
                            return False
                    else:
                        self.log_test("GET /api/students", False, "Test student not found in list")
                        return False
                else:
                    self.log_test("GET /api/students", False, "Response is not a list", data)
                    return False
            else:
                self.log_test("GET /api/students", False, f"HTTP {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_test("GET /api/students", False, f"Error: {str(e)}")
            return False
    
    def test_create_teacher_with_exact_data(self):
        """Test POST /api/users with exact teacher data from review request"""
        if not self.access_token:
            self.log_test("POST /api/users (teacher)", False, "No access token available")
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
                    # Verify all expected fields are present
                    expected_fields = [
                        "username", "name", "role", "school_code", "salutation",
                        "first_name", "middle_name", "last_name", "gender",
                        "address_line1", "city_state", "country", "phone", "email"
                    ]
                    
                    missing_fields = [f for f in expected_fields if f not in data]
                    if missing_fields:
                        self.log_test("POST /api/users (teacher)", False, f"Missing fields: {missing_fields}", data)
                        return False, data.get("id")
                    
                    self.log_test("POST /api/users (teacher)", True, "Teacher created with all new fields")
                    return True, data.get("id")
                else:
                    self.log_test("POST /api/users (teacher)", False, "No ID in response", data)
                    return False, None
            else:
                self.log_test("POST /api/users (teacher)", False, f"HTTP {response.status_code}", response.text)
                return False, None
        except Exception as e:
            self.log_test("POST /api/users (teacher)", False, f"Error: {str(e)}")
            return False, None
    
    def cleanup_test_data(self, student_id, teacher_id):
        """Clean up test data"""
        cleanup_success = True
        
        if student_id and self.access_token:
            try:
                headers = {"Authorization": f"Bearer {self.access_token}"}
                response = requests.delete(f"{BASE_URL}/students/{student_id}", headers=headers, timeout=10)
                if response.status_code == 200:
                    self.log_test("DELETE test student", True, "Test student deleted successfully")
                else:
                    self.log_test("DELETE test student", False, f"HTTP {response.status_code}")
                    cleanup_success = False
            except Exception as e:
                self.log_test("DELETE test student", False, f"Error: {str(e)}")
                cleanup_success = False
        
        if teacher_id and self.access_token:
            try:
                headers = {"Authorization": f"Bearer {self.access_token}"}
                response = requests.delete(f"{BASE_URL}/users/{teacher_id}", headers=headers, timeout=10)
                if response.status_code == 200:
                    self.log_test("DELETE test teacher", True, "Test teacher deleted successfully")
                else:
                    self.log_test("DELETE test teacher", False, f"HTTP {response.status_code}")
                    cleanup_success = False
            except Exception as e:
                self.log_test("DELETE test teacher", False, f"Error: {str(e)}")
                cleanup_success = False
        
        return cleanup_success
    
    def run_review_tests(self):
        """Run all tests mentioned in the review request"""
        print("🔍 Testing Exact Review Request Scenarios")
        print("=" * 50)
        print(f"Testing against: {BASE_URL}")
        print()
        
        # 1. GET /api/health - should return 200 with Lumina-SIS message
        health_ok = self.test_health_endpoint()
        
        # 2. POST /api/auth/login - should return token
        login_ok = self.test_login_with_specific_credentials()
        
        if not login_ok:
            print("❌ Login failed - cannot proceed with authenticated tests")
            return False
        
        # 3. POST /api/students - Test creating student WITH new fields
        student_created, student_id = self.test_create_student_with_exact_data()
        
        # 4. GET /api/students - Verify new student appears with all fields
        if student_created:
            self.test_get_students_verify_fields(student_id)
        
        # 5. POST /api/users - Test creating teacher with new fields  
        teacher_created, teacher_id = self.test_create_teacher_with_exact_data()
        
        # 6. Cleanup
        print("\n🧹 Cleaning up test data...")
        self.cleanup_test_data(student_id, teacher_id)
        
        # Summary
        print("\n" + "=" * 50)
        print("📊 Review Request Test Summary:")
        
        passed = sum(1 for r in self.test_results if r["success"])
        total = len(self.test_results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        
        if passed == total:
            print("\n🎉 All review request tests passed!")
            return True
        else:
            print(f"\n⚠️  {total - passed} test(s) failed.")
            return False

def main():
    tester = ReviewRequestTester()
    success = tester.run_review_tests()
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()