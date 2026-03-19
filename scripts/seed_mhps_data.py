#!/usr/bin/env python3
"""
Seed script to create MHPS school with comprehensive dummy data for testing.
This script creates:
- MHPS School
- Admin user for MHPS
- Teachers
- Students with family members
- Classes
- Attendance records
- Gradebook entries
"""

import asyncio
import os
import sys
from datetime import datetime, timezone, timedelta, date
import random
import uuid

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import bcrypt

# Load environment
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'backend', '.env'))

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
db_name = os.environ.get('DB_NAME', 'school_management')
client = AsyncIOMotorClient(mongo_url)
db = client[db_name]

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def random_date(start_year=2010, end_year=2018):
    """Generate a random date for student DOB"""
    year = random.randint(start_year, end_year)
    month = random.randint(1, 12)
    day = random.randint(1, 28)
    return f"{year}-{month:02d}-{day:02d}"

# Sample data
FIRST_NAMES_MALE = ["James", "Michael", "David", "John", "Daniel", "William", "Alexander", "Benjamin", "Samuel", "Nathan", "Emmanuel", "Kofi", "Kwame", "Yaw", "Kweku"]
FIRST_NAMES_FEMALE = ["Emma", "Olivia", "Sophia", "Ava", "Isabella", "Grace", "Abigail", "Victoria", "Elizabeth", "Sarah", "Akosua", "Ama", "Efua", "Yaa", "Adwoa"]
LAST_NAMES = ["Johnson", "Williams", "Brown", "Jones", "Davis", "Miller", "Wilson", "Moore", "Taylor", "Anderson", "Mensah", "Owusu", "Asante", "Boateng", "Osei", "Agyemang", "Appiah", "Bonsu", "Frimpong", "Darko"]
MIDDLE_NAMES = ["", "Anne", "Marie", "Lee", "Jay", "Ray", "John", "Paul", "Grace", "Hope", "Faith", "Kofi", "Kwame", "Akua", "Ama"]

HOUSES = ["Red House", "Blue House", "Green House", "Yellow House"]
GENDERS = ["Male", "Female"]
RELATIONSHIPS = ["Mother", "Father", "Guardian", "Aunt", "Uncle", "Grandparent"]
SALUTATIONS = ["Mr.", "Mrs.", "Ms.", "Dr."]

SUBJECTS = [
    "English Language", "Mathematics", "Science", "Social Studies",
    "Religious Education", "Physical Education", "Creative Arts",
    "Music", "ICT", "French"
]

GRADE_LEVELS = ["Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6"]

async def create_mhps_school():
    """Create the MHPS school"""
    existing = await db.schools.find_one({"school_code": "MHPS"})
    if existing:
        print("MHPS school already exists, skipping...")
        return existing["id"]
    
    school_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    school_doc = {
        "id": school_id,
        "school_code": "MHPS",
        "name": "Methodist High Primary School",
        "address": "123 Education Lane, Accra, Ghana",
        "phone": "+233 20 123 4567",
        "email": "info@mhps.edu.gh",
        "logo_url": "",
        "is_active": True,
        "created_at": now
    }
    await db.schools.insert_one(school_doc)
    print(f"✅ Created MHPS school: {school_id}")
    return school_id

async def create_default_report_template():
    """Create default report template for MHPS"""
    existing = await db.report_templates.find_one({"school_code": "MHPS"})
    if existing:
        print("MHPS report template already exists, skipping...")
        return
    
    template = {
        "id": str(uuid.uuid4()),
        "school_code": "MHPS",
        "school_name": "Methodist High Primary School",
        "school_motto": "Excellence Through Faith and Learning",
        "logo_url": "",
        "header_text": "REPORT CARD",
        "sub_header_text": "Academic Progress Report",
        "subjects": [
            {"name": "English Language", "is_core": True},
            {"name": "Mathematics", "is_core": True},
            {"name": "Science", "is_core": True},
            {"name": "Social Studies", "is_core": True},
            {"name": "Religious Education", "is_core": False},
            {"name": "Physical Education", "is_core": False},
            {"name": "Creative Arts", "is_core": False},
            {"name": "Music", "is_core": False},
            {"name": "ICT", "is_core": False},
            {"name": "French", "is_core": False}
        ],
        "grade_scale": [
            {"min": 90, "max": 100, "grade": "A+", "description": "Expert performance"},
            {"min": 85, "max": 89, "grade": "A", "description": "Highly Proficient"},
            {"min": 80, "max": 84, "grade": "A-", "description": "Proficient"},
            {"min": 75, "max": 79, "grade": "B", "description": "Satisfactory"},
            {"min": 70, "max": 74, "grade": "B-", "description": "Developing"},
            {"min": 65, "max": 69, "grade": "C", "description": "Passing"},
            {"min": 60, "max": 64, "grade": "C-", "description": "Passing"},
            {"min": 55, "max": 59, "grade": "D", "description": "Marginal"},
            {"min": 50, "max": 54, "grade": "D-", "description": "Below Average"},
            {"min": 40, "max": 49, "grade": "E", "description": "Frustration"},
            {"min": 0, "max": 39, "grade": "U", "description": "No participation"}
        ],
        "use_weighted_grading": True,
        "assessment_weights": {
            "homework": 5,
            "groupWork": 5,
            "project": 10,
            "quiz": 10,
            "midTerm": 30,
            "endOfTerm": 40
        },
        "sections": {
            "attendance": True,
            "teacher_remarks": True,
            "principal_remarks": True,
            "social_skills": True
        },
        "social_skills_categories": [
            {"category_name": "Attitude to Work", "skills": ["Punctuality", "Neatness", "Attentiveness", "Participation"]},
            {"category_name": "Social Development", "skills": ["Cooperation", "Leadership", "Respect for Others", "Responsibility"]},
            {"category_name": "Personal Development", "skills": ["Self-Confidence", "Creativity", "Initiative", "Emotional Control"]}
        ],
        "skill_ratings": [
            {"code": "EX", "label": "Excellent"},
            {"code": "VG", "label": "Very Good"},
            {"code": "G", "label": "Good"},
            {"code": "NI", "label": "Needs Improvement"}
        ],
        "achievement_standards": [
            {"min": 90, "max": 100, "band": "HP", "grade": "Highly Proficient", "description": "Exceeds expectations"},
            {"min": 70, "max": 89, "band": "P", "grade": "Proficient", "description": "Meets expectations"},
            {"min": 50, "max": 69, "band": "AP", "grade": "Approaching Proficiency", "description": "Approaching expectations"},
            {"min": 30, "max": 49, "band": "D", "grade": "Developing", "description": "Below expectations"},
            {"min": 0, "max": 29, "band": "B", "grade": "Beginning", "description": "Needs significant support"}
        ],
        "paper_size": "legal",
        "design_mode": "canvas",
        "blocks": [],
        "canvas_elements": [],
        "theme": {"primaryColor": "#1e40af", "secondaryColor": "#3b82f6"},
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    await db.report_templates.insert_one(template)
    print("✅ Created MHPS report template")

async def create_admin_user():
    """Create admin user for MHPS"""
    existing = await db.users.find_one({"username": "admin", "school_code": "MHPS"})
    if existing:
        print("MHPS admin already exists, skipping...")
        return existing["id"]
    
    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    user_doc = {
        "id": user_id,
        "username": "admin",
        "name": "MHPS Administrator",
        "role": "admin",
        "school_code": "MHPS",
        "permissions": [
            "manage_schools", "manage_users", "manage_students", "manage_classes",
            "manage_attendance", "manage_grades", "view_reports", "generate_reports"
        ],
        "password_hash": hash_password("Admin@123"),
        "photo_url": "",
        "salutation": "Mr.",
        "first_name": "Admin",
        "middle_name": "",
        "last_name": "User",
        "gender": "Male",
        "address_line1": "MHPS Campus",
        "address_line2": "",
        "city_state": "Accra, Greater Accra",
        "country": "Ghana",
        "phone": "+233 20 111 2222",
        "email": "admin@mhps.edu.gh",
        "created_at": now
    }
    await db.users.insert_one(user_doc)
    print(f"✅ Created MHPS admin: {user_id}")
    return user_id

async def create_teachers():
    """Create teachers for MHPS"""
    teachers = []
    teacher_data = [
        ("Mrs.", "Akua", "Grace", "Mensah", "Female", "English Language, Social Studies"),
        ("Mr.", "Kwame", "", "Boateng", "Male", "Mathematics, Science"),
        ("Ms.", "Abigail", "Faith", "Owusu", "Female", "Religious Education, Music"),
        ("Mr.", "Emmanuel", "John", "Asante", "Male", "ICT, French"),
        ("Mrs.", "Victoria", "Hope", "Darko", "Female", "Creative Arts, Physical Education"),
        ("Dr.", "Samuel", "Paul", "Frimpong", "Male", "Science, Mathematics"),
    ]
    
    for i, (salutation, first, middle, last, gender, subjects) in enumerate(teacher_data):
        username = f"{first.lower()}.{last.lower()}"
        existing = await db.users.find_one({"username": username, "school_code": "MHPS"})
        if existing:
            teachers.append(existing["id"])
            continue
        
        user_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        
        user_doc = {
            "id": user_id,
            "username": username,
            "name": f"{first} {last}",
            "role": "teacher",
            "school_code": "MHPS",
            "permissions": ["manage_students", "manage_attendance", "manage_grades", "view_reports"],
            "password_hash": hash_password("Teacher@123"),
            "photo_url": "",
            "salutation": salutation,
            "first_name": first,
            "middle_name": middle,
            "last_name": last,
            "gender": gender,
            "address_line1": f"{i+10} Teacher's Quarters",
            "address_line2": "MHPS Campus",
            "city_state": "Accra, Greater Accra",
            "country": "Ghana",
            "phone": f"+233 24 {random.randint(100,999)} {random.randint(1000,9999)}",
            "email": f"{username}@mhps.edu.gh",
            "created_at": now
        }
        await db.users.insert_one(user_doc)
        teachers.append(user_id)
        print(f"✅ Created teacher: {first} {last}")
    
    return teachers

async def create_classes(teacher_ids):
    """Create classes for MHPS"""
    classes = []
    class_data = [
        ("Grade 1A", "Grade 1", "Room 101", 0),
        ("Grade 1B", "Grade 1", "Room 102", 1),
        ("Grade 2A", "Grade 2", "Room 201", 2),
        ("Grade 2B", "Grade 2", "Room 202", 3),
        ("Grade 3A", "Grade 3", "Room 301", 4),
        ("Grade 3B", "Grade 3", "Room 302", 5),
        ("Grade 4A", "Grade 4", "Room 401", 0),
        ("Grade 4B", "Grade 4", "Room 402", 1),
        ("Grade 5A", "Grade 5", "Room 501", 2),
        ("Grade 5B", "Grade 5", "Room 502", 3),
        ("Grade 6A", "Grade 6", "Room 601", 4),
        ("Grade 6B", "Grade 6", "Room 602", 5),
    ]
    
    for name, grade_level, room, teacher_idx in class_data:
        existing = await db.classes.find_one({"name": name, "school_code": "MHPS"})
        if existing:
            classes.append(existing["id"])
            continue
        
        class_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        
        class_doc = {
            "id": class_id,
            "name": name,
            "grade_level": grade_level,
            "teacher_id": teacher_ids[teacher_idx % len(teacher_ids)] if teacher_ids else None,
            "room_number": room,
            "academic_year": "2024-2025",
            "school_code": "MHPS",
            "created_by": teacher_ids[teacher_idx % len(teacher_ids)] if teacher_ids else None,
            "created_at": now
        }
        await db.classes.insert_one(class_doc)
        classes.append(class_id)
        print(f"✅ Created class: {name}")
    
    return classes

def generate_family_member(relationship):
    """Generate a family member with full details"""
    is_male = relationship in ["Father", "Uncle", "Grandparent"] or (relationship == "Guardian" and random.random() > 0.5)
    
    first_name = random.choice(FIRST_NAMES_MALE if is_male else FIRST_NAMES_FEMALE)
    last_name = random.choice(LAST_NAMES)
    
    return {
        "id": str(uuid.uuid4()),
        "salutation": random.choice(["Mr.", "Dr."] if is_male else ["Mrs.", "Ms.", "Dr."]),
        "first_name": first_name,
        "middle_name": random.choice(MIDDLE_NAMES),
        "last_name": last_name,
        "gender": "Male" if is_male else "Female",
        "relationship": relationship,
        "address_line1": f"{random.randint(1, 500)} {random.choice(['Main Street', 'Church Road', 'Market Lane', 'School Avenue', 'Palm Drive'])}",
        "address_line2": random.choice(["", "Apt 2", "Block B", "Suite 101"]),
        "city_state": random.choice(["Accra, Greater Accra", "Kumasi, Ashanti", "Tema, Greater Accra", "Cape Coast, Central"]),
        "country": "Ghana",
        "home_phone": f"+233 30 {random.randint(100,999)} {random.randint(1000,9999)}",
        "cell_phone": f"+233 {random.choice(['20', '24', '27', '54', '55'])} {random.randint(100,999)} {random.randint(1000,9999)}",
        "work_phone": f"+233 30 {random.randint(100,999)} {random.randint(1000,9999)}" if random.random() > 0.5 else "",
        "email": f"{first_name.lower()}.{last_name.lower()}@{random.choice(['gmail.com', 'yahoo.com', 'outlook.com'])}"
    }

async def create_students(class_ids):
    """Create students for MHPS"""
    students = []
    student_count = 0
    
    for class_id in class_ids:
        # Get class info
        class_info = await db.classes.find_one({"id": class_id})
        if not class_info:
            continue
        
        grade_level = class_info["grade_level"]
        
        # Determine age range based on grade (ages 6-12 for primary school)
        grade_num = int(grade_level.replace("Grade ", ""))
        # Students are roughly age = grade + 5 (Grade 1 = ~6 years old)
        # For birth year: 2025 - age = birth year
        # So Grade 1 students born around 2019, Grade 6 around 2013
        start_year = 2019 - grade_num
        end_year = 2020 - grade_num  # Small range for age variation
        
        # Create 8-12 students per class
        num_students = random.randint(8, 12)
        
        for i in range(num_students):
            is_male = random.random() > 0.5
            first_name = random.choice(FIRST_NAMES_MALE if is_male else FIRST_NAMES_FEMALE)
            last_name = random.choice(LAST_NAMES)
            
            # Check if student already exists
            student_id_str = f"MHPS-{2024000 + student_count + 1}"
            existing = await db.students.find_one({"student_id": student_id_str, "school_code": "MHPS"})
            if existing:
                students.append(existing["id"])
                student_count += 1
                continue
            
            student_id = str(uuid.uuid4())
            now = datetime.now(timezone.utc).isoformat()
            
            # Generate 1-2 family members
            family_members = []
            relationships_used = []
            num_family = random.randint(1, 2)
            for _ in range(num_family):
                available_rels = [r for r in RELATIONSHIPS if r not in relationships_used]
                if available_rels:
                    rel = random.choice(available_rels)
                    relationships_used.append(rel)
                    family_members.append(generate_family_member(rel))
            
            student_doc = {
                "id": student_id,
                "student_id": student_id_str,
                "first_name": first_name,
                "middle_name": random.choice(MIDDLE_NAMES),
                "last_name": last_name,
                "date_of_birth": random_date(start_year, end_year),
                "gender": "Male" if is_male else "Female",
                "student_phone": "",  # Most primary students don't have phones
                "student_email": "",
                "address_line1": f"{random.randint(1, 500)} {random.choice(['Main Street', 'Church Road', 'Market Lane', 'School Avenue', 'Palm Drive'])}",
                "address_line2": random.choice(["", "Apt 2", "Block B"]),
                "city_state": random.choice(["Accra, Greater Accra", "Kumasi, Ashanti", "Tema, Greater Accra"]),
                "country": "Ghana",
                "house": random.choice(HOUSES),
                "class_id": class_id,
                "emergency_contact": family_members[0]["cell_phone"] if family_members else "",
                "teacher_comment": "",
                "photo_url": "",
                "family_members": family_members,
                "address": "",
                "parent_id": None,
                "school_code": "MHPS",
                "created_at": now,
                "updated_at": now
            }
            await db.students.insert_one(student_doc)
            students.append(student_id)
            student_count += 1
        
        print(f"✅ Created {num_students} students for {class_info['name']}")
    
    print(f"✅ Total students created: {student_count}")
    return students

async def create_attendance(student_ids, class_ids):
    """Create attendance records for the past 2 weeks"""
    attendance_count = 0
    
    # Get student-class mapping
    students = await db.students.find({"school_code": "MHPS"}, {"id": 1, "class_id": 1}).to_list(1000)
    
    # Create attendance for past 10 school days
    today = date.today()
    school_days = []
    d = today
    while len(school_days) < 10:
        d = d - timedelta(days=1)
        if d.weekday() < 5:  # Monday to Friday
            school_days.append(d)
    
    for school_date in school_days:
        date_str = school_date.strftime("%Y-%m-%d")
        
        for student in students:
            # Check if attendance already exists
            existing = await db.attendance.find_one({
                "student_id": student["id"],
                "date": date_str,
                "school_code": "MHPS"
            })
            if existing:
                continue
            
            # Random attendance status (95% present, 3% absent, 2% late)
            rand = random.random()
            if rand < 0.95:
                status = "present"
            elif rand < 0.98:
                status = "absent"
            else:
                status = "late"
            
            attendance_doc = {
                "id": str(uuid.uuid4()),
                "student_id": student["id"],
                "class_id": student.get("class_id", ""),
                "date": date_str,
                "status": status,
                "school_code": "MHPS",
                "marked_by": "system",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.attendance.insert_one(attendance_doc)
            attendance_count += 1
    
    print(f"✅ Created {attendance_count} attendance records")

def get_grade_info(score):
    """Get grade info from score"""
    GRADING_SCHEME = [
        {"min": 90, "max": 100, "grade": "A+", "domain": "Expert performance", "points": 4.0},
        {"min": 85, "max": 89, "grade": "A", "domain": "Highly Proficient", "points": 3.8},
        {"min": 80, "max": 84, "grade": "A-", "domain": "Proficient", "points": 3.7},
        {"min": 75, "max": 79, "grade": "B", "domain": "Satisfactory", "points": 3.5},
        {"min": 70, "max": 74, "grade": "B-", "domain": "Developing", "points": 3.3},
        {"min": 65, "max": 69, "grade": "C", "domain": "Passing", "points": 3.2},
        {"min": 60, "max": 64, "grade": "C-", "domain": "Passing", "points": 2.8},
        {"min": 55, "max": 59, "grade": "D", "domain": "Marginal", "points": 2.6},
        {"min": 50, "max": 54, "grade": "D-", "domain": "Below Average", "points": 2.4},
        {"min": 40, "max": 49, "grade": "E", "domain": "Frustration", "points": 1.0},
        {"min": 0, "max": 39, "grade": "U", "domain": "No participation", "points": 0},
    ]
    rounded = round(score)
    for scheme in GRADING_SCHEME:
        if scheme["min"] <= rounded <= scheme["max"]:
            return {"grade": scheme["grade"], "domain": scheme["domain"], "points": scheme["points"]}
    return {"grade": "U", "domain": "No participation", "points": 0}

async def create_gradebook_entries(student_ids):
    """Create gradebook entries with MHPS assessment components"""
    gradebook_count = 0
    
    # Get all students
    students = await db.students.find({"school_code": "MHPS"}, {"id": 1, "class_id": 1}).to_list(1000)
    
    # Assessment weights
    WEIGHTS = {
        "homework": 0.05,
        "groupWork": 0.05,
        "project": 0.10,
        "quiz": 0.10,
        "midTerm": 0.30,
        "endOfTerm": 0.40
    }
    
    for student in students:
        # Check if gradebook already exists
        existing = await db.gradebook.find_one({
            "student_id": student["id"],
            "term": "Term 1",
            "academic_year": "2024-2025",
            "school_code": "MHPS"
        })
        if existing:
            gradebook_count += 1
            continue
        
        subjects_data = []
        total_score = 0
        
        for subject in SUBJECTS:
            # Generate component scores (vary by subject difficulty for realism)
            base = random.randint(55, 85)
            variance = random.randint(-15, 15)
            
            homework = max(0, min(100, base + random.randint(-10, 20)))
            group_work = max(0, min(100, base + random.randint(-10, 15)))
            project = max(0, min(100, base + random.randint(-15, 20)))
            quiz = max(0, min(100, base + variance + random.randint(-10, 10)))
            mid_term = max(0, min(100, base + variance + random.randint(-10, 10)))
            end_of_term = max(0, min(100, base + variance + random.randint(-10, 10)))
            
            # Calculate weighted score
            weighted_score = (
                homework * WEIGHTS["homework"] +
                group_work * WEIGHTS["groupWork"] +
                project * WEIGHTS["project"] +
                quiz * WEIGHTS["quiz"] +
                mid_term * WEIGHTS["midTerm"] +
                end_of_term * WEIGHTS["endOfTerm"]
            )
            
            grade_info = get_grade_info(weighted_score)
            
            subjects_data.append({
                "subject": subject,
                "homework": homework,
                "groupWork": group_work,
                "project": project,
                "quiz": quiz,
                "midTerm": mid_term,
                "endOfTerm": end_of_term,
                "score": round(weighted_score, 2),
                "grade": grade_info["grade"],
                "comment": ""
            })
            total_score += weighted_score
        
        overall_score = total_score / len(SUBJECTS)
        overall_info = get_grade_info(overall_score)
        
        gradebook_doc = {
            "id": str(uuid.uuid4()),
            "student_id": student["id"],
            "class_id": student.get("class_id", ""),
            "school_code": "MHPS",
            "term": "Term 1",
            "academic_year": "2024-2025",
            "subjects": subjects_data,
            "overall_score": round(overall_score, 2),
            "overall_grade": overall_info["grade"],
            "overall_points": overall_info["points"],
            "overall_domain": overall_info["domain"],
            "graded_by": "system",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db.gradebook.insert_one(gradebook_doc)
        gradebook_count += 1
    
    print(f"✅ Created {gradebook_count} gradebook entries")

async def create_social_skills(student_ids):
    """Create social skills entries for students"""
    skills_count = 0
    
    students = await db.students.find({"school_code": "MHPS"}, {"id": 1}).to_list(1000)
    
    SKILL_CATEGORIES = {
        "Attitude to Work": ["Punctuality", "Neatness", "Attentiveness", "Participation"],
        "Social Development": ["Cooperation", "Leadership", "Respect for Others", "Responsibility"],
        "Personal Development": ["Self-Confidence", "Creativity", "Initiative", "Emotional Control"]
    }
    
    RATINGS = ["Excellent", "Very Good", "Good", "Needs Improvement"]
    
    for student in students:
        existing = await db.social_skills.find_one({
            "student_id": student["id"],
            "term": "Term 1",
            "academic_year": "2024-2025",
            "school_code": "MHPS"
        })
        if existing:
            skills_count += 1
            continue
        
        # Generate random skill ratings
        skills = {}
        for category, skill_list in SKILL_CATEGORIES.items():
            for skill in skill_list:
                # Weight towards positive ratings
                weights = [0.25, 0.35, 0.30, 0.10]
                skills[skill] = random.choices(RATINGS, weights=weights)[0]
        
        skills_doc = {
            "id": str(uuid.uuid4()),
            "student_id": student["id"],
            "school_code": "MHPS",
            "term": "Term 1",
            "academic_year": "2024-2025",
            "skills": skills,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db.social_skills.insert_one(skills_doc)
        skills_count += 1
    
    print(f"✅ Created {skills_count} social skills entries")

async def main():
    """Main function to seed all MHPS data"""
    print("\n" + "="*60)
    print("🏫 MHPS Data Seeding Script")
    print("="*60 + "\n")
    
    try:
        # 1. Create school
        print("📚 Creating MHPS School...")
        await create_mhps_school()
        
        # 2. Create report template
        print("\n📋 Creating Report Template...")
        await create_default_report_template()
        
        # 3. Create admin
        print("\n👤 Creating Admin User...")
        await create_admin_user()
        
        # 4. Create teachers
        print("\n👨‍🏫 Creating Teachers...")
        teacher_ids = await create_teachers()
        
        # 5. Create classes
        print("\n🏫 Creating Classes...")
        class_ids = await create_classes(teacher_ids)
        
        # 6. Create students
        print("\n👨‍🎓 Creating Students...")
        student_ids = await create_students(class_ids)
        
        # 7. Create attendance
        print("\n📅 Creating Attendance Records...")
        await create_attendance(student_ids, class_ids)
        
        # 8. Create gradebook
        print("\n📊 Creating Gradebook Entries...")
        await create_gradebook_entries(student_ids)
        
        # 9. Create social skills
        print("\n🌟 Creating Social Skills Records...")
        await create_social_skills(student_ids)
        
        print("\n" + "="*60)
        print("✅ MHPS Data Seeding Complete!")
        print("="*60)
        print("\n📝 Login Credentials:")
        print("   School Code: MHPS")
        print("   Admin Username: admin")
        print("   Admin Password: Admin@123")
        print("\n   Teacher Username: akua.mensah (or any teacher)")
        print("   Teacher Password: Teacher@123")
        print("="*60 + "\n")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        raise

if __name__ == "__main__":
    asyncio.run(main())
