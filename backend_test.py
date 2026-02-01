import requests
import sys
from datetime import datetime, date
import json

class StudentManagementTester:
    def __init__(self, base_url="https://schoolplus-13.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.admin_token = None
        self.teacher_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.created_resources = {
            'users': [],
            'students': [],
            'classes': [],
            'gradebook': []
        }

    def run_test(self, name, method, endpoint, expected_status, data=None, token=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if token:
            headers['Authorization'] = f'Bearer {token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=data)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return True, response.json() if response.content else {}
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    print(f"   Response: {response.json()}")
                except:
                    print(f"   Response: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_admin_registration_and_login(self):
        """Test admin user registration and login"""
        print("\n=== ADMIN AUTHENTICATION TESTS ===")
        
        # Register admin user
        admin_data = {
            "email": f"admin_{datetime.now().strftime('%H%M%S')}@test.com",
            "name": "Test Admin",
            "role": "admin",
            "password": "AdminPass123!"
        }
        
        success, response = self.run_test(
            "Admin Registration",
            "POST",
            "auth/register",
            200,
            data=admin_data
        )
        
        if success and 'access_token' in response:
            self.admin_token = response['access_token']
            self.created_resources['users'].append(response['user']['id'])
            print(f"   Admin ID: {response['user']['id']}")
            print(f"   Admin Role: {response['user']['role']}")
            return True
        return False

    def test_teacher_registration(self):
        """Test teacher user creation by admin"""
        print("\n=== TEACHER CREATION TEST ===")
        
        teacher_data = {
            "email": f"teacher_{datetime.now().strftime('%H%M%S')}@test.com",
            "name": "Test Teacher",
            "role": "teacher",
            "password": "TeacherPass123!"
        }
        
        success, response = self.run_test(
            "Teacher Creation by Admin",
            "POST",
            "users",
            200,
            data=teacher_data,
            token=self.admin_token
        )
        
        if success:
            self.created_resources['users'].append(response['id'])
            
            # Login as teacher to get token
            login_success, login_response = self.run_test(
                "Teacher Login",
                "POST",
                "auth/login",
                200,
                data={"email": teacher_data["email"], "password": teacher_data["password"]}
            )
            
            if login_success and 'access_token' in login_response:
                self.teacher_token = login_response['access_token']
                return True
        return False

    def test_navigation_access(self):
        """Test admin can access all navigation endpoints"""
        print("\n=== NAVIGATION ACCESS TESTS ===")
        
        endpoints = [
            ("Dashboard Stats", "stats/dashboard"),
            ("Students List", "students"),
            ("Classes List", "classes"),
            ("Attendance List", "attendance"),
            ("Gradebook List", "gradebook"),
            ("Users List", "users"),
            ("Subjects List", "subjects"),
            ("Houses List", "houses"),
            ("Grading Scheme", "grading-scheme")
        ]
        
        all_passed = True
        for name, endpoint in endpoints:
            success, _ = self.run_test(
                f"Admin Access to {name}",
                "GET",
                endpoint,
                200,
                token=self.admin_token
            )
            if not success:
                all_passed = False
        
        return all_passed

    def test_student_management(self):
        """Test student creation with full details and age calculation"""
        print("\n=== STUDENT MANAGEMENT TESTS ===")
        
        # First create a class
        class_data = {
            "name": "Grade 5A",
            "grade_level": "Grade 5",
            "academic_year": "2024/2025",
            "room_number": "101"
        }
        
        success, class_response = self.run_test(
            "Create Class",
            "POST",
            "classes",
            200,
            data=class_data,
            token=self.admin_token
        )
        
        if not success:
            return False
        
        class_id = class_response['id']
        self.created_resources['classes'].append(class_id)
        
        # Create student with full details
        student_data = {
            "first_name": "John",
            "middle_name": "Michael",
            "last_name": "Doe",
            "date_of_birth": "2010-05-15",  # Should calculate age as ~14
            "gender": "Male",
            "address": "123 Main Street, Test City",
            "house": "Red House",
            "class_id": class_id,
            "emergency_contact": "+1234567890",
            "teacher_comment": "Excellent student with great potential"
        }
        
        success, student_response = self.run_test(
            "Create Student with Full Details",
            "POST",
            "students",
            200,
            data=student_data,
            token=self.admin_token
        )
        
        if success:
            self.created_resources['students'].append(student_response['id'])
            
            # Verify age calculation
            expected_age = date.today().year - 2010
            if student_response.get('age') == expected_age:
                print(f"✅ Age calculation correct: {student_response['age']} years")
                self.tests_passed += 1
            else:
                print(f"❌ Age calculation incorrect: got {student_response.get('age')}, expected {expected_age}")
            
            self.tests_run += 1
            return student_response['id']
        
        return None

    def test_gradebook_functionality(self):
        """Test gradebook with multiple subjects and grading scheme"""
        print("\n=== GRADEBOOK TESTS ===")
        
        # Get subjects first
        success, subjects_response = self.run_test(
            "Get Subjects List",
            "GET",
            "subjects",
            200,
            token=self.admin_token
        )
        
        if not success or not subjects_response.get('subjects'):
            return False
        
        subjects = subjects_response['subjects'][:5]  # Use first 5 subjects
        
        # Create gradebook entry
        if not self.created_resources['students'] or not self.created_resources['classes']:
            print("❌ No students or classes available for gradebook test")
            return False
        
        student_id = self.created_resources['students'][0]
        class_id = self.created_resources['classes'][0]
        
        # Create grades for multiple subjects
        subject_grades = []
        test_scores = [85, 92, 78, 88, 95]  # Different grades to test scheme
        
        for i, subject in enumerate(subjects):
            subject_grades.append({
                "subject": subject,
                "score": test_scores[i % len(test_scores)],
                "comment": f"Good performance in {subject}"
            })
        
        gradebook_data = {
            "student_id": student_id,
            "class_id": class_id,
            "term": "Term 1",
            "academic_year": "2024/2025",
            "subjects": subject_grades
        }
        
        success, gradebook_response = self.run_test(
            "Create Gradebook Entry",
            "POST",
            "gradebook",
            200,
            data=gradebook_data,
            token=self.admin_token
        )
        
        if success:
            self.created_resources['gradebook'].append(gradebook_response['id'])
            
            # Verify grading scheme application
            if 'overall_grade' in gradebook_response and 'overall_score' in gradebook_response:
                print(f"✅ Overall grade calculated: {gradebook_response['overall_grade']} ({gradebook_response['overall_score']}%)")
                self.tests_passed += 1
            else:
                print("❌ Overall grade not calculated")
            
            self.tests_run += 1
            return gradebook_response['id']
        
        return None

    def test_grading_scheme_endpoint(self):
        """Test grading scheme endpoint returns correct grades A+ through U"""
        print("\n=== GRADING SCHEME TESTS ===")
        
        success, response = self.run_test(
            "Get Grading Scheme",
            "GET",
            "grading-scheme",
            200,
            token=self.admin_token
        )
        
        if success and 'grading_scheme' in response:
            scheme = response['grading_scheme']
            
            # Check for expected grades
            expected_grades = ['A+', 'A', 'A-', 'B', 'B-', 'C', 'C-', 'D', 'D-', 'E', 'U']
            found_grades = [grade['grade'] for grade in scheme]
            
            all_grades_found = all(grade in found_grades for grade in expected_grades)
            
            if all_grades_found:
                print(f"✅ All expected grades found: {found_grades}")
                self.tests_passed += 1
            else:
                print(f"❌ Missing grades. Found: {found_grades}, Expected: {expected_grades}")
            
            self.tests_run += 1
            return True
        
        return False

    def test_report_cards_generation(self):
        """Test report card generation for entire class"""
        print("\n=== REPORT CARDS TESTS ===")
        
        if not self.created_resources['classes']:
            print("❌ No classes available for report card test")
            return False
        
        class_id = self.created_resources['classes'][0]
        
        success, response = self.run_test(
            "Generate Class Report Cards",
            "GET",
            f"report-cards/class/{class_id}",
            200,
            data={"term": "Term 1", "academic_year": "2024/2025"},
            token=self.admin_token
        )
        
        if success:
            if 'report_cards' in response and 'total_students' in response:
                print(f"✅ Report cards generated for {response['total_students']} students")
                
                # Check if report cards have required data
                if response['report_cards']:
                    sample_card = response['report_cards'][0]
                    required_fields = ['student', 'grades', 'attendance_summary', 'position']
                    
                    has_all_fields = all(field in sample_card for field in required_fields)
                    if has_all_fields:
                        print("✅ Report cards contain all required fields")
                        self.tests_passed += 1
                    else:
                        print("❌ Report cards missing required fields")
                
                self.tests_passed += 1
            else:
                print("❌ Report cards response missing required data")
            
            self.tests_run += 1
            return True
        
        return False

    def cleanup_resources(self):
        """Clean up created test resources"""
        print("\n=== CLEANUP ===")
        
        # Delete gradebook entries
        for gradebook_id in self.created_resources['gradebook']:
            self.run_test(
                f"Delete Gradebook {gradebook_id}",
                "DELETE",
                f"gradebook/{gradebook_id}",
                200,
                token=self.admin_token
            )
        
        # Delete students
        for student_id in self.created_resources['students']:
            self.run_test(
                f"Delete Student {student_id}",
                "DELETE",
                f"students/{student_id}",
                200,
                token=self.admin_token
            )
        
        # Delete classes
        for class_id in self.created_resources['classes']:
            self.run_test(
                f"Delete Class {class_id}",
                "DELETE",
                f"classes/{class_id}",
                200,
                token=self.admin_token
            )
        
        # Delete users
        for user_id in self.created_resources['users']:
            self.run_test(
                f"Delete User {user_id}",
                "DELETE",
                f"users/{user_id}",
                200,
                token=self.admin_token
            )

def main():
    print("🚀 Starting Student Management System Backend Tests")
    print("=" * 60)
    
    tester = StudentManagementTester()
    
    # Run all tests
    try:
        # Authentication tests
        if not tester.test_admin_registration_and_login():
            print("❌ Admin authentication failed, stopping tests")
            return 1
        
        if not tester.test_teacher_registration():
            print("❌ Teacher creation failed, stopping tests")
            return 1
        
        # Navigation access tests
        tester.test_navigation_access()
        
        # Student management tests
        student_id = tester.test_student_management()
        if not student_id:
            print("❌ Student management tests failed")
        
        # Gradebook tests
        gradebook_id = tester.test_gradebook_functionality()
        if not gradebook_id:
            print("❌ Gradebook tests failed")
        
        # Grading scheme tests
        tester.test_grading_scheme_endpoint()
        
        # Report cards tests
        tester.test_report_cards_generation()
        
        # Cleanup
        tester.cleanup_resources()
        
    except Exception as e:
        print(f"❌ Test execution failed: {str(e)}")
        return 1
    
    # Print results
    print("\n" + "=" * 60)
    print(f"📊 FINAL RESULTS")
    print(f"Tests Run: {tester.tests_run}")
    print(f"Tests Passed: {tester.tests_passed}")
    print(f"Success Rate: {(tester.tests_passed/tester.tests_run*100):.1f}%")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 ALL TESTS PASSED!")
        return 0
    else:
        print(f"⚠️  {tester.tests_run - tester.tests_passed} tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())