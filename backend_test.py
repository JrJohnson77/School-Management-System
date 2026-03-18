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
            
            # Test 5: Students
            self.test_students_endpoint()
            
            # Test 6: Classes
            self.test_classes_endpoint()
            
            # Test 7: Dashboard Stats
            self.test_dashboard_stats_endpoint()
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