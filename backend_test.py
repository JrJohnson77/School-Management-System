#!/usr/bin/env python3
"""
Backend API Testing for Lumina-SIS
Tests all key endpoints with focus on report template dynamic weight keys
"""

import requests
import json
import sys
from typing import Dict, Any

# API base URL from frontend configuration
BASE_URL = "https://github-mhps-test.preview.emergentagent.com/api"

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
                    self.log_test("Health Check", True, "API is healthy")
                else:
                    self.log_test("Health Check", False, f"Unexpected response: {data}")
            else:
                self.log_test("Health Check", False, f"Status code {response.status_code}")
                
        except Exception as e:
            self.log_test("Health Check", False, f"Exception: {str(e)}")
    
    def test_login(self):
        """Test login and get access token"""
        try:
            response = requests.post(f"{BASE_URL}/auth/login", json=TEST_CREDENTIALS, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if "access_token" in data:
                    self.access_token = data["access_token"]
                    self.log_test("Login", True, "Login successful, token received")
                    return True
                else:
                    self.log_test("Login", False, "No access token in response", data)
                    return False
            else:
                self.log_test("Login", False, f"Status code {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_test("Login", False, f"Exception: {str(e)}")
            return False

    def test_report_template_get(self):
        """Test GET report template endpoint"""
        try:
            headers = {"Authorization": f"Bearer {self.access_token}"}
            response = requests.get(f"{BASE_URL}/report-templates/JTECH", headers=headers, timeout=10)
            
            if response.status_code == 200:
                template_data = response.json()
                
                # Check if assessment_weights exists
                if "assessment_weights" in template_data:
                    weights = template_data["assessment_weights"]
                    self.log_test("GET Report Template", True, 
                                f"Template retrieved with assessment_weights: {json.dumps(weights)}")
                    return template_data
                else:
                    self.log_test("GET Report Template", False, "Template missing assessment_weights object")
                    return None
            else:
                self.log_test("GET Report Template", False, 
                            f"Failed with status {response.status_code}", response.text)
                return None
                
        except Exception as e:
            self.log_test("GET Report Template", False, f"Exception occurred: {str(e)}")
            return None
    
    def test_report_template_update_custom_weights(self, current_template):
        """Test PUT report template with custom dynamic weight keys"""
        try:
            headers = {"Authorization": f"Bearer {self.access_token}"}
            
            # Custom assessment weights with NEW dynamic keys + required fields
            custom_update = {
                "school_code": "JTECH",
                "school_name": current_template.get("school_name", "JTECH Academy"),
                "assessment_weights": {
                    "homework": 10,
                    "classwork": 15,
                    "midTermExam": 35,
                    "finalExam": 40
                },
                "use_weighted_grading": True
            }
            
            print(f"   Sending custom update with required fields...")
            
            response = requests.put(f"{BASE_URL}/report-templates/JTECH", 
                                  headers=headers, json=custom_update, timeout=10)
            
            if response.status_code == 200:
                updated_template = response.json()
                
                # Verify the new weights were saved
                if "assessment_weights" in updated_template:
                    saved_weights = updated_template["assessment_weights"]
                    
                    # Check if all custom keys are present
                    expected_keys = ["homework", "classwork", "midTermExam", "finalExam"]
                    missing_keys = [key for key in expected_keys if key not in saved_weights]
                    
                    if not missing_keys:
                        self.log_test("PUT Report Template - Custom Weights", True,
                                    f"Updated with custom weights: {json.dumps(saved_weights)}")
                        return True
                    else:
                        self.log_test("PUT Report Template - Custom Weights", False,
                                    f"Missing custom keys: {missing_keys}")
                        return False
                else:
                    self.log_test("PUT Report Template - Custom Weights", False,
                                "Updated template missing assessment_weights")
                    return False
            else:
                self.log_test("PUT Report Template - Custom Weights", False,
                            f"Failed with status {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_test("PUT Report Template - Custom Weights", False, f"Exception occurred: {str(e)}")
            return False
    
    def test_report_template_verify_persistence(self):
        """Test that custom weights persist by getting template again"""
        try:
            headers = {"Authorization": f"Bearer {self.access_token}"}
            response = requests.get(f"{BASE_URL}/report-templates/JTECH", headers=headers, timeout=10)
            
            if response.status_code == 200:
                template_data = response.json()
                
                if "assessment_weights" in template_data:
                    saved_weights = template_data["assessment_weights"]
                    
                    # Check for the custom keys we set
                    expected_custom_weights = {
                        "homework": 10,
                        "classwork": 15,
                        "midTermExam": 35,
                        "finalExam": 40
                    }
                    
                    # Verify each custom key and value
                    all_correct = True
                    missing_or_wrong = []
                    for key, expected_value in expected_custom_weights.items():
                        if key not in saved_weights:
                            all_correct = False
                            missing_or_wrong.append(f"{key} (missing)")
                        elif saved_weights[key] != expected_value:
                            all_correct = False
                            missing_or_wrong.append(f"{key} ({saved_weights[key]} != {expected_value})")
                    
                    if all_correct:
                        self.log_test("Verify Custom Weights Persistence", True,
                                    f"Custom weights persisted: {json.dumps(saved_weights)}")
                        return True
                    else:
                        self.log_test("Verify Custom Weights Persistence", False,
                                    f"Issues: {', '.join(missing_or_wrong)} in {json.dumps(saved_weights)}")
                        return False
                else:
                    self.log_test("Verify Custom Weights Persistence", False,
                                "Template missing assessment_weights")
                    return False
            else:
                self.log_test("Verify Custom Weights Persistence", False,
                            f"Failed with status {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_test("Verify Custom Weights Persistence", False, f"Exception occurred: {str(e)}")
            return False
    
    def test_report_template_restore_original(self, current_template):
        """Test restoring original weights"""
        try:
            headers = {"Authorization": f"Bearer {self.access_token}"}
            
            # Restore original weights + required fields
            original_update = {
                "school_code": "JTECH",
                "school_name": current_template.get("school_name", "JTECH Academy"),
                "assessment_weights": {
                    "homework": 5,
                    "groupWork": 5,
                    "project": 10,
                    "quiz": 10,
                    "midTerm": 30,
                    "endOfTerm": 40
                },
                "use_weighted_grading": True
            }
            
            print(f"   Restoring original weights with required fields...")
            
            response = requests.put(f"{BASE_URL}/report-templates/JTECH", 
                                  headers=headers, json=original_update, timeout=10)
            
            if response.status_code == 200:
                restored_template = response.json()
                
                if "assessment_weights" in restored_template:
                    restored_weights = restored_template["assessment_weights"]
                    
                    # Verify restoration
                    expected_original = original_update["assessment_weights"]
                    all_restored = True
                    missing_or_wrong = []
                    
                    for key, expected_value in expected_original.items():
                        if key not in restored_weights:
                            all_restored = False
                            missing_or_wrong.append(f"{key} (missing)")
                        elif restored_weights[key] != expected_value:
                            all_restored = False
                            missing_or_wrong.append(f"{key} ({restored_weights[key]} != {expected_value})")
                    
                    if all_restored:
                        self.log_test("Restore Original Weights", True,
                                    f"Original weights restored: {json.dumps(restored_weights)}")
                        return True
                    else:
                        self.log_test("Restore Original Weights", False,
                                    f"Issues: {', '.join(missing_or_wrong)} in {json.dumps(restored_weights)}")
                        return False
                else:
                    self.log_test("Restore Original Weights", False,
                                "Restored template missing assessment_weights")
                    return False
            else:
                self.log_test("Restore Original Weights", False,
                            f"Failed with status {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_test("Restore Original Weights", False, f"Exception occurred: {str(e)}")
            return False

    def run_focused_report_template_tests(self):
        """Run focused test suite for report template endpoints"""
        print("=== Lumina-SIS Report Template API Test Suite ===")
        print("Testing dynamic weight keys functionality")
        print()
        
        # Test 1: Health check
        print("1. Testing health endpoint...")
        self.test_health_endpoint()
        
        # Test 2: Login
        print("\n2. Testing authentication...")
        if not self.test_login():
            print("❌ Cannot proceed without authentication")
            return self.print_summary()
        
        # Test 3: Get initial report template
        print("\n3. Testing GET report template...")
        initial_template = self.test_report_template_get()
        if not initial_template:
            print("❌ Cannot proceed without initial template")
            return self.print_summary()
        
        # Test 4: Update with custom dynamic weight keys
        print("\n4. Testing PUT report template with CUSTOM dynamic weight keys...")
        print("   Expected: homework=10, classwork=15, midTermExam=35, finalExam=40")
        custom_success = self.test_report_template_update_custom_weights(initial_template)
        
        # Test 5: Verify persistence 
        print("\n5. Testing persistence of custom weights...")
        if custom_success:
            self.test_report_template_verify_persistence()
        else:
            print("   ⚠️  Skipping persistence test due to update failure")
        
        # Test 6: Restore original weights
        print("\n6. Testing restore original weights...")
        print("   Expected: homework=5, groupWork=5, project=10, quiz=10, midTerm=30, endOfTerm=40")
        self.test_report_template_restore_original(initial_template)
        
        return self.print_summary()
    
    def print_summary(self):
        """Print test results summary"""
        print("\n" + "=" * 60)
        print("📊 TEST RESULTS SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for result in self.test_results if result["success"])
        total = len(self.test_results)
        
        # Show individual results
        for result in self.test_results:
            status = "✅" if result["success"] else "❌"
            print(f"{status} {result['test']}")
            if not result["success"]:
                print(f"    └─ {result['message']}")
        
        print(f"\nResults: {passed}/{total} tests passed")
        
        if passed == total:
            print("🎉 ALL TESTS PASSED! Report template dynamic weight keys are working correctly.")
            return True
        else:
            print("⚠️  Some tests failed. See details above.")
            return False

def main():
    """Main test runner"""
    tester = APITester()
    success = tester.run_focused_report_template_tests()
    
    # Exit with error code if tests failed  
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()