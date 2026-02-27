"""
Test WYSIWYG Report Template Designer Features
Tests the new blocks-based template structure with theme support
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


@pytest.fixture(scope="module")
def auth_token():
    """Get superuser auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPERUSER_CREDS)
    assert response.status_code == 200, f"Login failed: {response.text}"
    data = response.json()
    assert "access_token" in data, "No access_token in login response"
    return data["access_token"]


@pytest.fixture(scope="module")
def api_client(auth_token):
    """Create authenticated API client"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {auth_token}"
    })
    return session


class TestWYSIWYGTemplateAPI:
    """Test WYSIWYG Report Template Designer API endpoints"""

    def test_health_check(self):
        """Test API health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        assert response.json()["status"] == "healthy"
        print("✅ Health check passed")

    def test_get_template_returns_blocks_and_theme(self, api_client):
        """Test GET template returns blocks array and theme object"""
        response = api_client.get(f"{BASE_URL}/api/report-templates/MHPS")
        assert response.status_code == 200
        data = response.json()
        
        # Verify blocks exist
        assert "blocks" in data, "Missing blocks field in template response"
        assert isinstance(data["blocks"], list), "blocks should be a list"
        assert len(data["blocks"]) >= 10, f"Expected at least 10 blocks, got {len(data['blocks'])}"
        
        # Verify theme exists
        assert "theme" in data, "Missing theme field in template response"
        assert isinstance(data["theme"], dict), "theme should be a dict"
        assert "headerBg" in data["theme"], "Missing headerBg in theme"
        assert "fontFamily" in data["theme"], "Missing fontFamily in theme"
        
        print(f"✅ Template has {len(data['blocks'])} blocks and theme settings")

    def test_blocks_structure(self, api_client):
        """Test each block has required fields"""
        response = api_client.get(f"{BASE_URL}/api/report-templates/MHPS")
        assert response.status_code == 200
        data = response.json()
        
        required_block_fields = ["id", "type", "order", "visible", "config", "styles"]
        
        for block in data["blocks"]:
            for field in required_block_fields:
                assert field in block, f"Block {block.get('id', 'unknown')} missing field: {field}"
        
        print(f"✅ All {len(data['blocks'])} blocks have required structure")

    def test_block_types_present(self, api_client):
        """Test all expected block types are present"""
        response = api_client.get(f"{BASE_URL}/api/report-templates/MHPS")
        assert response.status_code == 200
        data = response.json()
        
        expected_types = [
            "school-header", "student-info", "term-info", "grades-table",
            "grade-key", "weight-key", "achievement-standards", 
            "social-skills", "comments", "signatures", "footer"
        ]
        
        actual_types = [block["type"] for block in data["blocks"]]
        
        for expected in expected_types:
            assert expected in actual_types, f"Missing block type: {expected}"
        
        print(f"✅ All {len(expected_types)} expected block types present")

    def test_grades_table_block_config(self, api_client):
        """Test grades-table block has subjects, grade_scale, weights"""
        response = api_client.get(f"{BASE_URL}/api/report-templates/MHPS")
        assert response.status_code == 200
        data = response.json()
        
        grades_block = next((b for b in data["blocks"] if b["type"] == "grades-table"), None)
        assert grades_block is not None, "grades-table block not found"
        
        config = grades_block["config"]
        assert "subjects" in config, "Missing subjects in grades-table config"
        assert "grade_scale" in config, "Missing grade_scale in grades-table config"
        assert "weights" in config, "Missing weights in grades-table config"
        
        # Verify subjects have is_core flag
        assert len(config["subjects"]) > 0, "No subjects defined"
        for subject in config["subjects"]:
            assert "name" in subject, "Subject missing name"
            assert "is_core" in subject, "Subject missing is_core flag"
        
        print(f"✅ grades-table block has {len(config['subjects'])} subjects, {len(config['grade_scale'])} grades")

    def test_social_skills_block_config(self, api_client):
        """Test social-skills block has categories and ratings"""
        response = api_client.get(f"{BASE_URL}/api/report-templates/MHPS")
        assert response.status_code == 200
        data = response.json()
        
        skills_block = next((b for b in data["blocks"] if b["type"] == "social-skills"), None)
        assert skills_block is not None, "social-skills block not found"
        
        config = skills_block["config"]
        assert "categories" in config, "Missing categories in social-skills config"
        assert "ratings" in config, "Missing ratings in social-skills config"
        
        # Verify categories have skills
        assert len(config["categories"]) > 0, "No categories defined"
        for cat in config["categories"]:
            assert "category_name" in cat, "Category missing category_name"
            assert "skills" in cat, "Category missing skills"
        
        print(f"✅ social-skills block has {len(config['categories'])} categories, {len(config['ratings'])} ratings")

    def test_school_header_block_config(self, api_client):
        """Test school-header block has school branding fields"""
        response = api_client.get(f"{BASE_URL}/api/report-templates/MHPS")
        assert response.status_code == 200
        data = response.json()
        
        header_block = next((b for b in data["blocks"] if b["type"] == "school-header"), None)
        assert header_block is not None, "school-header block not found"
        
        config = header_block["config"]
        assert "school_name" in config, "Missing school_name in header config"
        assert "header_text" in config, "Missing header_text in header config"
        
        print(f"✅ school-header block has school_name='{config['school_name']}'")

    def test_theme_presets_colors(self, api_client):
        """Test theme has correct color fields"""
        response = api_client.get(f"{BASE_URL}/api/report-templates/MHPS")
        assert response.status_code == 200
        data = response.json()
        
        theme = data["theme"]
        expected_colors = ["primaryColor", "accentColor", "headerBg", "headerText", "bodyBg", "bodyText"]
        
        for color in expected_colors:
            assert color in theme, f"Missing {color} in theme"
            # Verify it's a valid hex color
            if theme[color]:
                assert theme[color].startswith("#"), f"{color} should be hex color"
        
        print(f"✅ Theme has all color fields: {list(theme.keys())}")

    def test_save_template_with_blocks_and_theme(self, api_client):
        """Test PUT template saves blocks and theme correctly"""
        # First get current template
        response = api_client.get(f"{BASE_URL}/api/report-templates/MHPS")
        assert response.status_code == 200
        current = response.json()
        
        # Prepare update payload with modified theme
        payload = {
            "school_code": "MHPS",
            "school_name": current.get("school_name", "MHPS"),
            "blocks": current["blocks"],
            "theme": {
                **current["theme"],
                "headerBg": "#065f46",  # Change to emerald green
                "primaryColor": "#065f46",
                "preset": "custom"
            },
            "paper_size": "letter",
            # Include flat fields for backward compatibility
            "subjects": current.get("subjects", []),
            "grade_scale": current.get("grade_scale", []),
            "social_skills_categories": current.get("social_skills_categories", []),
            "skill_ratings": current.get("skill_ratings", []),
            "achievement_standards": current.get("achievement_standards", [])
        }
        
        # Save template
        response = api_client.put(f"{BASE_URL}/api/report-templates/MHPS", json=payload)
        assert response.status_code == 200, f"Save failed: {response.text}"
        
        # Verify changes persisted
        response = api_client.get(f"{BASE_URL}/api/report-templates/MHPS")
        assert response.status_code == 200
        updated = response.json()
        
        assert updated["theme"]["headerBg"] == "#065f46", "Theme color not saved"
        assert updated["paper_size"] == "letter", "Paper size not saved"
        
        # Restore original theme
        payload["theme"] = current["theme"]
        payload["paper_size"] = current.get("paper_size", "legal")
        api_client.put(f"{BASE_URL}/api/report-templates/MHPS", json=payload)
        
        print("✅ Template save with blocks and theme works correctly")

    def test_block_visibility_toggle(self, api_client):
        """Test block visibility can be toggled and persisted"""
        response = api_client.get(f"{BASE_URL}/api/report-templates/MHPS")
        assert response.status_code == 200
        current = response.json()
        
        # Toggle grade-key visibility
        blocks = current["blocks"]
        original_visibility = None
        for block in blocks:
            if block["type"] == "grade-key":
                original_visibility = block["visible"]
                block["visible"] = not block["visible"]
                break
        
        # Save
        payload = {
            "school_code": "MHPS",
            "school_name": current.get("school_name", "MHPS"),
            "blocks": blocks,
            "theme": current.get("theme", {}),
            "subjects": current.get("subjects", []),
            "grade_scale": current.get("grade_scale", []),
            "social_skills_categories": current.get("social_skills_categories", []),
            "skill_ratings": current.get("skill_ratings", []),
            "achievement_standards": current.get("achievement_standards", [])
        }
        
        response = api_client.put(f"{BASE_URL}/api/report-templates/MHPS", json=payload)
        assert response.status_code == 200
        
        # Verify
        response = api_client.get(f"{BASE_URL}/api/report-templates/MHPS")
        assert response.status_code == 200
        updated = response.json()
        
        grade_key_block = next((b for b in updated["blocks"] if b["type"] == "grade-key"), None)
        assert grade_key_block["visible"] == (not original_visibility), "Visibility toggle not persisted"
        
        # Restore
        grade_key_block["visible"] = original_visibility
        payload["blocks"] = updated["blocks"]
        api_client.put(f"{BASE_URL}/api/report-templates/MHPS", json=payload)
        
        print("✅ Block visibility toggle works correctly")

    def test_custom_block_can_be_added(self, api_client):
        """Test custom blocks can be added to template"""
        response = api_client.get(f"{BASE_URL}/api/report-templates/MHPS")
        assert response.status_code == 200
        current = response.json()
        
        # Add custom text block
        new_block = {
            "id": f"custom-text-{os.urandom(4).hex()}",
            "type": "custom-text",
            "order": len(current["blocks"]),
            "visible": True,
            "config": {
                "title": "Test Custom Block",
                "content": "This is test content"
            },
            "styles": {}
        }
        
        blocks = current["blocks"] + [new_block]
        
        payload = {
            "school_code": "MHPS",
            "school_name": current.get("school_name", "MHPS"),
            "blocks": blocks,
            "theme": current.get("theme", {}),
            "subjects": current.get("subjects", []),
            "grade_scale": current.get("grade_scale", []),
        }
        
        response = api_client.put(f"{BASE_URL}/api/report-templates/MHPS", json=payload)
        assert response.status_code == 200
        
        # Verify custom block added
        response = api_client.get(f"{BASE_URL}/api/report-templates/MHPS")
        assert response.status_code == 200
        updated = response.json()
        
        custom_blocks = [b for b in updated["blocks"] if b["type"] == "custom-text"]
        assert len(custom_blocks) >= 1, "Custom block not added"
        
        # Remove custom block
        blocks_without_custom = [b for b in updated["blocks"] if not b["id"].startswith("custom-text-")]
        payload["blocks"] = blocks_without_custom
        api_client.put(f"{BASE_URL}/api/report-templates/MHPS", json=payload)
        
        print("✅ Custom blocks can be added and saved")

    def test_backward_compatibility_flat_fields(self, api_client):
        """Test flat fields (subjects, grade_scale) are still returned"""
        response = api_client.get(f"{BASE_URL}/api/report-templates/MHPS")
        assert response.status_code == 200
        data = response.json()
        
        # These flat fields should still be present for backward compatibility
        assert "subjects" in data, "Missing subjects flat field"
        assert "grade_scale" in data, "Missing grade_scale flat field"
        assert "social_skills_categories" in data, "Missing social_skills_categories flat field"
        assert "paper_size" in data, "Missing paper_size field"
        
        print("✅ Backward compatibility flat fields present")

    def test_template_requires_auth(self):
        """Test template endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/report-templates/MHPS")
        assert response.status_code == 401 or response.status_code == 403
        print("✅ Template endpoint requires authentication")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
