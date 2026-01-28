import requests
import sys
import json
from datetime import datetime, timedelta

class StudentManagementAPITester:
    def __init__(self, base_url="https://primary-scholar.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.admin_token = None
        self.teacher_token = None
        self.parent_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        
        # Store created IDs for cleanup and testing
        self.created_users = []
        self.created_students = []
        self.created_classes = []
        self.created_grades = []
        self.created_attendance = []

    def log_test(self, name, success, details="", error=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}")
        else:
            print(f"❌ {name} - {error}")
        
        self.test_results.append({
            "name": name,
            "success": success,
            "details": details,
            "error": error
        })

    def make_request(self, method, endpoint, data=None, token=None, params=None):
        """Make HTTP request with proper headers"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if token:
            headers['Authorization'] = f'Bearer {token}'

        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)
            
            return response
        except Exception as e:
            return None

    def test_health_check(self):
        """Test API health endpoints"""
        print("\n🔍 Testing Health Endpoints...")
        
        # Test root endpoint
        response = self.make_request('GET', '')
        success = response and response.status_code == 200
        self.log_test("Root endpoint", success, 
                     response.json() if success else "", 
                     f"Status: {response.status_code if response else 'No response'}")
        
        # Test health endpoint
        response = self.make_request('GET', 'health')
        success = response and response.status_code == 200
        self.log_test("Health check", success,
                     response.json() if success else "",
                     f"Status: {response.status_code if response else 'No response'}")

    def test_user_registration_and_login(self):
        """Test user registration and login for all roles"""
        print("\n🔍 Testing User Registration & Login...")
        
        timestamp = datetime.now().strftime("%H%M%S")
        
        # Test Admin Registration
        admin_data = {
            "name": f"Test Admin {timestamp}",
            "email": f"admin{timestamp}@test.com",
            "password": "TestPass123!",
            "role": "admin"
        }
        
        response = self.make_request('POST', 'auth/register', admin_data)
        success = response and response.status_code == 200
        if success:
            result = response.json()
            self.admin_token = result['access_token']
            self.created_users.append(result['user']['id'])
        self.log_test("Admin registration", success, 
                     "Token received" if success else "",
                     f"Status: {response.status_code if response else 'No response'}")

        # Test Teacher Registration
        teacher_data = {
            "name": f"Test Teacher {timestamp}",
            "email": f"teacher{timestamp}@test.com", 
            "password": "TestPass123!",
            "role": "teacher"
        }
        
        response = self.make_request('POST', 'auth/register', teacher_data)
        success = response and response.status_code == 200
        if success:
            result = response.json()
            self.teacher_token = result['access_token']
            self.created_users.append(result['user']['id'])
        self.log_test("Teacher registration", success,
                     "Token received" if success else "",
                     f"Status: {response.status_code if response else 'No response'}")

        # Test Parent Registration
        parent_data = {
            "name": f"Test Parent {timestamp}",
            "email": f"parent{timestamp}@test.com",
            "password": "TestPass123!",
            "role": "parent"
        }
        
        response = self.make_request('POST', 'auth/register', parent_data)
        success = response and response.status_code == 200
        if success:
            result = response.json()
            self.parent_token = result['access_token']
            self.created_users.append(result['user']['id'])
        self.log_test("Parent registration", success,
                     "Token received" if success else "",
                     f"Status: {response.status_code if response else 'No response'}")

        # Test Login
        login_data = {
            "email": admin_data["email"],
            "password": admin_data["password"]
        }
        
        response = self.make_request('POST', 'auth/login', login_data)
        success = response and response.status_code == 200
        self.log_test("Admin login", success,
                     "Login successful" if success else "",
                     f"Status: {response.status_code if response else 'No response'}")

        # Test /auth/me endpoint
        response = self.make_request('GET', 'auth/me', token=self.admin_token)
        success = response and response.status_code == 200
        self.log_test("Get current user", success,
                     "User info retrieved" if success else "",
                     f"Status: {response.status_code if response else 'No response'}")

    def test_class_management(self):
        """Test class CRUD operations"""
        print("\n🔍 Testing Class Management...")
        
        if not self.admin_token:
            self.log_test("Class management", False, "", "No admin token available")
            return

        # Create class
        class_data = {
            "name": "Test Class 1A",
            "grade_level": "1",
            "teacher_id": "",
            "room_number": "101",
            "academic_year": "2025"
        }
        
        response = self.make_request('POST', 'classes', class_data, self.admin_token)
        success = response and response.status_code == 200
        class_id = None
        if success:
            result = response.json()
            class_id = result['id']
            self.created_classes.append(class_id)
        self.log_test("Create class", success,
                     f"Class ID: {class_id}" if success else "",
                     f"Status: {response.status_code if response else 'No response'}")

        # Get classes
        response = self.make_request('GET', 'classes', token=self.admin_token)
        success = response and response.status_code == 200
        self.log_test("Get classes", success,
                     f"Found {len(response.json()) if success else 0} classes" if success else "",
                     f"Status: {response.status_code if response else 'No response'}")

        # Update class
        if class_id:
            update_data = {**class_data, "room_number": "102"}
            response = self.make_request('PUT', f'classes/{class_id}', update_data, self.admin_token)
            success = response and response.status_code == 200
            self.log_test("Update class", success,
                         "Class updated" if success else "",
                         f"Status: {response.status_code if response else 'No response'}")

        # Test teacher access (should see only their classes)
        response = self.make_request('GET', 'classes', token=self.teacher_token)
        success = response and response.status_code == 200
        self.log_test("Teacher get classes", success,
                     "Teacher can access classes" if success else "",
                     f"Status: {response.status_code if response else 'No response'}")

    def test_student_management(self):
        """Test student CRUD operations"""
        print("\n🔍 Testing Student Management...")
        
        if not self.admin_token:
            self.log_test("Student management", False, "", "No admin token available")
            return

        # Create student
        student_data = {
            "first_name": "John",
            "last_name": "Doe",
            "date_of_birth": "2015-05-15",
            "gender": "Male",
            "grade_level": "1",
            "class_id": self.created_classes[0] if self.created_classes else "",
            "parent_id": self.created_users[2] if len(self.created_users) > 2 else "",
            "address": "123 Test Street",
            "emergency_contact": "555-0123",
            "notes": "Test student"
        }
        
        response = self.make_request('POST', 'students', student_data, self.admin_token)
        success = response and response.status_code == 200
        student_id = None
        if success:
            result = response.json()
            student_id = result['id']
            self.created_students.append(student_id)
        self.log_test("Create student", success,
                     f"Student ID: {student_id}" if success else "",
                     f"Status: {response.status_code if response else 'No response'}")

        # Get students
        response = self.make_request('GET', 'students', token=self.admin_token)
        success = response and response.status_code == 200
        self.log_test("Get students (admin)", success,
                     f"Found {len(response.json()) if success else 0} students" if success else "",
                     f"Status: {response.status_code if response else 'No response'}")

        # Test teacher access
        response = self.make_request('GET', 'students', token=self.teacher_token)
        success = response and response.status_code == 200
        self.log_test("Get students (teacher)", success,
                     "Teacher can access students" if success else "",
                     f"Status: {response.status_code if response else 'No response'}")

        # Test parent access (should only see their children)
        response = self.make_request('GET', 'students', token=self.parent_token)
        success = response and response.status_code == 200
        self.log_test("Get students (parent)", success,
                     "Parent can access students" if success else "",
                     f"Status: {response.status_code if response else 'No response'}")

        # Update student
        if student_id:
            update_data = {**student_data, "notes": "Updated test student"}
            response = self.make_request('PUT', f'students/{student_id}', update_data, self.admin_token)
            success = response and response.status_code == 200
            self.log_test("Update student", success,
                         "Student updated" if success else "",
                         f"Status: {response.status_code if response else 'No response'}")

    def test_attendance_management(self):
        """Test attendance tracking"""
        print("\n🔍 Testing Attendance Management...")
        
        if not self.teacher_token or not self.created_students:
            self.log_test("Attendance management", False, "", "No teacher token or students available")
            return

        # Mark individual attendance
        attendance_data = {
            "student_id": self.created_students[0],
            "class_id": self.created_classes[0] if self.created_classes else "",
            "date": datetime.now().strftime("%Y-%m-%d"),
            "status": "present"
        }
        
        response = self.make_request('POST', 'attendance', attendance_data, self.teacher_token)
        success = response and response.status_code == 200
        if success:
            result = response.json()
            self.created_attendance.append(result['id'])
        self.log_test("Mark attendance", success,
                     "Attendance marked" if success else "",
                     f"Status: {response.status_code if response else 'No response'}")

        # Bulk attendance
        bulk_data = {
            "class_id": self.created_classes[0] if self.created_classes else "",
            "date": datetime.now().strftime("%Y-%m-%d"),
            "records": [
                {"student_id": self.created_students[0], "status": "present"}
            ]
        }
        
        response = self.make_request('POST', 'attendance/bulk', bulk_data, self.teacher_token)
        success = response and response.status_code == 200
        self.log_test("Bulk attendance", success,
                     "Bulk attendance recorded" if success else "",
                     f"Status: {response.status_code if response else 'No response'}")

        # Get attendance
        params = {"class_id": self.created_classes[0] if self.created_classes else ""}
        response = self.make_request('GET', 'attendance', token=self.teacher_token, params=params)
        success = response and response.status_code == 200
        self.log_test("Get attendance", success,
                     f"Found {len(response.json()) if success else 0} records" if success else "",
                     f"Status: {response.status_code if response else 'No response'}")

    def test_grade_management(self):
        """Test grade management"""
        print("\n🔍 Testing Grade Management...")
        
        if not self.teacher_token or not self.created_students:
            self.log_test("Grade management", False, "", "No teacher token or students available")
            return

        # Create grade
        grade_data = {
            "student_id": self.created_students[0],
            "class_id": self.created_classes[0] if self.created_classes else "",
            "subject": "Math",
            "grade_type": "exam",
            "score": 85.5,
            "max_score": 100.0,
            "date": datetime.now().strftime("%Y-%m-%d"),
            "term": "Term 1",
            "comments": "Good work"
        }
        
        response = self.make_request('POST', 'grades', grade_data, self.teacher_token)
        success = response and response.status_code == 200
        grade_id = None
        if success:
            result = response.json()
            grade_id = result['id']
            self.created_grades.append(grade_id)
        self.log_test("Create grade", success,
                     f"Grade ID: {grade_id}" if success else "",
                     f"Status: {response.status_code if response else 'No response'}")

        # Get grades
        response = self.make_request('GET', 'grades', token=self.teacher_token)
        success = response and response.status_code == 200
        self.log_test("Get grades", success,
                     f"Found {len(response.json()) if success else 0} grades" if success else "",
                     f"Status: {response.status_code if response else 'No response'}")

        # Update grade
        if grade_id:
            update_data = {**grade_data, "score": 90.0, "comments": "Excellent work"}
            response = self.make_request('PUT', f'grades/{grade_id}', update_data, self.teacher_token)
            success = response and response.status_code == 200
            self.log_test("Update grade", success,
                         "Grade updated" if success else "",
                         f"Status: {response.status_code if response else 'No response'}")

    def test_user_management(self):
        """Test user management (admin only)"""
        print("\n🔍 Testing User Management...")
        
        if not self.admin_token:
            self.log_test("User management", False, "", "No admin token available")
            return

        # Get all users
        response = self.make_request('GET', 'users', token=self.admin_token)
        success = response and response.status_code == 200
        self.log_test("Get users", success,
                     f"Found {len(response.json()) if success else 0} users" if success else "",
                     f"Status: {response.status_code if response else 'No response'}")

        # Test role update
        if self.created_users:
            user_id = self.created_users[1]  # Teacher user
            role_data = {"role": "teacher"}
            response = self.make_request('PUT', f'users/{user_id}/role', role_data, self.admin_token)
            success = response and response.status_code == 200
            self.log_test("Update user role", success,
                         "Role updated" if success else "",
                         f"Status: {response.status_code if response else 'No response'}")

        # Test non-admin access (should fail)
        response = self.make_request('GET', 'users', token=self.teacher_token)
        success = response and response.status_code == 403
        self.log_test("Teacher access to users (should fail)", success,
                     "Access denied as expected" if success else "",
                     f"Status: {response.status_code if response else 'No response'}")

    def test_dashboard_stats(self):
        """Test dashboard statistics"""
        print("\n🔍 Testing Dashboard Stats...")
        
        # Test admin dashboard
        response = self.make_request('GET', 'stats/dashboard', token=self.admin_token)
        success = response and response.status_code == 200
        self.log_test("Admin dashboard stats", success,
                     "Stats retrieved" if success else "",
                     f"Status: {response.status_code if response else 'No response'}")

        # Test teacher dashboard
        response = self.make_request('GET', 'stats/dashboard', token=self.teacher_token)
        success = response and response.status_code == 200
        self.log_test("Teacher dashboard stats", success,
                     "Stats retrieved" if success else "",
                     f"Status: {response.status_code if response else 'No response'}")

        # Test parent dashboard
        response = self.make_request('GET', 'stats/dashboard', token=self.parent_token)
        success = response and response.status_code == 200
        self.log_test("Parent dashboard stats", success,
                     "Stats retrieved" if success else "",
                     f"Status: {response.status_code if response else 'No response'}")

    def test_helper_endpoints(self):
        """Test helper endpoints"""
        print("\n🔍 Testing Helper Endpoints...")
        
        # Get teachers (admin only)
        response = self.make_request('GET', 'teachers', token=self.admin_token)
        success = response and response.status_code == 200
        self.log_test("Get teachers list", success,
                     f"Found {len(response.json()) if success else 0} teachers" if success else "",
                     f"Status: {response.status_code if response else 'No response'}")

        # Get parents (admin/teacher)
        response = self.make_request('GET', 'parents', token=self.admin_token)
        success = response and response.status_code == 200
        self.log_test("Get parents list", success,
                     f"Found {len(response.json()) if success else 0} parents" if success else "",
                     f"Status: {response.status_code if response else 'No response'}")

    def run_all_tests(self):
        """Run all test suites"""
        print("🚀 Starting Student Management System API Tests")
        print(f"📍 Testing against: {self.base_url}")
        
        try:
            self.test_health_check()
            self.test_user_registration_and_login()
            self.test_class_management()
            self.test_student_management()
            self.test_attendance_management()
            self.test_grade_management()
            self.test_user_management()
            self.test_dashboard_stats()
            self.test_helper_endpoints()
            
        except Exception as e:
            print(f"❌ Test suite failed with error: {str(e)}")
            return False

        # Print summary
        print(f"\n📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return True
        else:
            print("⚠️  Some tests failed")
            return False

def main():
    tester = StudentManagementAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())