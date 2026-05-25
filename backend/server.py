from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, UploadFile, File, BackgroundTasks
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import StreamingResponse, FileResponse, Response
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import csv
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta, date
import jwt
import bcrypt
import io
import shutil
import json

ROOT_DIR = Path(__file__).parent
UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Settings
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key-change-in-production')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# Grading Scheme
GRADING_SCHEME = [
    {"min": 90, "max": 100, "grade": "A+", "domain": "Expert performance", "points": 4.0},
    {"min": 85, "max": 89, "grade": "A", "domain": "Highly Proficient performance", "points": 3.8},
    {"min": 80, "max": 84, "grade": "A-", "domain": "Proficient performance", "points": 3.7},
    {"min": 75, "max": 79, "grade": "B", "domain": "Satisfactory performance", "points": 3.5},
    {"min": 70, "max": 74, "grade": "B-", "domain": "Developing performance", "points": 3.3},
    {"min": 65, "max": 69, "grade": "C", "domain": "Passing performance", "points": 3.2},
    {"min": 60, "max": 64, "grade": "C-", "domain": "Passing performance", "points": 2.8},
    {"min": 55, "max": 59, "grade": "D", "domain": "Marginal performance", "points": 2.6},
    {"min": 50, "max": 54, "grade": "D-", "domain": "Below Average performance", "points": 2.4},
    {"min": 40, "max": 49, "grade": "E", "domain": "Frustration", "points": 1.0},
    {"min": 0, "max": 39, "grade": "U", "domain": "No participation", "points": 0},
]

SUBJECTS = [
    "English Language",
    "Mathematics", 
    "Science",
    "Social Studies",
    "Religious Education",
    "Physical Education",
    "Creative Arts",
    "Music",
    "ICT",
    "French"
]

HOUSES = ["Red House", "Blue House", "Green House", "Yellow House"]

# Permission constants
PERMISSIONS = {
    "manage_schools": "manage_schools",
    "manage_users": "manage_users",
    "manage_students": "manage_students",
    "manage_classes": "manage_classes",
    "manage_attendance": "manage_attendance",
    "manage_grades": "manage_grades",
    "view_reports": "view_reports",
    "generate_reports": "generate_reports",
}

ALL_PERMISSIONS = list(PERMISSIONS.values())

def get_grade_info(score: float) -> dict:
    """Get grade, domain and points for a given score"""
    rounded = round(score)
    for scheme in GRADING_SCHEME:
        if scheme["min"] <= rounded <= scheme["max"]:
            return {"grade": scheme["grade"], "domain": scheme["domain"], "points": scheme["points"]}
    return {"grade": "U", "domain": "No participation", "points": 0}

def calculate_age(dob_str: str) -> int:
    """Calculate age from date of birth string"""
    try:
        dob = datetime.strptime(dob_str, "%Y-%m-%d").date()
        today = date.today()
        age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
        return age
    except (ValueError, AttributeError):
        return 0

# Create the main app
app = FastAPI(title="Lumina-SIS API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Security
security = HTTPBearer()

# ==================== MODELS ====================

class UserRole:
    SUPERUSER = "superuser"
    ADMIN = "admin"
    TEACHER = "teacher"
    PARENT = "parent"

class SchoolSubject(BaseModel):
    name: str
    is_core: bool = False
    order: int = 0

class AcademicYear(BaseModel):
    year: str  # e.g., "2025-2026"
    terms: List[str] = ["Term 1", "Term 2", "Term 3"]
    is_enabled: bool = True
    is_current: bool = False

class SchoolBase(BaseModel):
    school_code: str
    name: str
    address: Optional[str] = ""
    phone: Optional[str] = ""
    email: Optional[str] = ""
    logo_url: Optional[str] = ""
    is_active: bool = True
    current_academic_year: Optional[str] = "2025-2026"
    principal_signature: Optional[str] = ""
    teacher_signature: Optional[str] = ""
    academic_years: List[AcademicYear] = []
    subjects: List[SchoolSubject] = []
    attendance_threshold: int = 85  # Percent below which students are flagged

class SchoolCreate(SchoolBase):
    pass

class SchoolResponse(SchoolBase):
    model_config = ConfigDict(extra="ignore")
    id: str
    created_at: str
    
class AcademicYearUpdate(BaseModel):
    year: str
    is_enabled: bool

class UserBase(BaseModel):
    username: str
    name: str
    role: str
    school_code: str
    permissions: List[str] = []
    photo_url: Optional[str] = ""
    # Extended teacher/staff fields
    salutation: Optional[str] = ""
    first_name: Optional[str] = ""
    middle_name: Optional[str] = ""
    last_name: Optional[str] = ""
    gender: Optional[str] = ""
    address_line1: Optional[str] = ""
    address_line2: Optional[str] = ""
    city_state: Optional[str] = ""
    country: Optional[str] = ""
    phone: Optional[str] = ""
    email: Optional[str] = ""

class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    school_code: str
    username: str
    password: str

class UserResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    username: str
    name: str
    role: str
    school_code: str
    permissions: List[str] = []
    photo_url: Optional[str] = ""
    salutation: Optional[str] = ""
    first_name: Optional[str] = ""
    middle_name: Optional[str] = ""
    last_name: Optional[str] = ""
    gender: Optional[str] = ""
    address_line1: Optional[str] = ""
    address_line2: Optional[str] = ""
    city_state: Optional[str] = ""
    country: Optional[str] = ""
    phone: Optional[str] = ""
    email: Optional[str] = ""
    created_at: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class RoleUpdate(BaseModel):
    role: str
    permissions: Optional[List[str]] = None

class FamilyMember(BaseModel):
    id: Optional[str] = ""
    salutation: Optional[str] = ""
    first_name: str = ""
    middle_name: Optional[str] = ""
    last_name: str = ""
    gender: Optional[str] = ""
    relationship: str = ""  # Mother, Father, Aunt, Uncle, Brother, Sister, Stepmother, Stepfather, Grandparent, Guardian, Other
    address_line1: Optional[str] = ""
    address_line2: Optional[str] = ""
    city_state: Optional[str] = ""
    country: Optional[str] = ""
    home_phone: Optional[str] = ""
    cell_phone: Optional[str] = ""
    work_phone: Optional[str] = ""
    email: Optional[str] = ""

class StudentBase(BaseModel):
    student_id: Optional[str] = ""  # School-assigned student ID
    first_name: str
    middle_name: Optional[str] = ""
    last_name: str
    date_of_birth: str
    gender: str
    student_phone: Optional[str] = ""
    student_email: Optional[str] = ""
    address_line1: Optional[str] = ""
    address_line2: Optional[str] = ""
    city_state: Optional[str] = ""
    country: Optional[str] = ""
    house: Optional[str] = ""
    class_id: Optional[str] = None
    emergency_contact: Optional[str] = ""
    teacher_comment: Optional[str] = ""
    photo_url: Optional[str] = ""
    family_members: Optional[List[FamilyMember]] = []
    # Keep old fields for backward compat
    address: Optional[str] = ""
    parent_id: Optional[str] = None
    enrollment_status: Optional[str] = "enrolled"

class StudentCreate(StudentBase):
    pass

class StudentResponse(StudentBase):
    model_config = ConfigDict(extra="ignore")
    id: str
    school_code: str
    age: int = 0
    created_at: str
    updated_at: str

class ClassBase(BaseModel):
    name: str
    grade_level: str
    teacher_id: Optional[str] = None
    room_number: Optional[str] = None
    academic_year: str

class ClassCreate(ClassBase):
    pass

class ClassResponse(ClassBase):
    model_config = ConfigDict(extra="ignore")
    id: str
    school_code: str
    created_by: Optional[str] = None
    created_at: str

class AttendanceBase(BaseModel):
    student_id: str
    class_id: str
    date: str
    status: str

class AttendanceCreate(AttendanceBase):
    pass

class AttendanceResponse(AttendanceBase):
    model_config = ConfigDict(extra="ignore")
    id: str
    school_code: str
    marked_by: str
    created_at: str

class AttendanceBulkCreate(BaseModel):
    class_id: str
    date: str
    records: List[dict]

class SubjectGrade(BaseModel):
    subject: str
    score: Optional[float] = None  # Weighted score (calculated)
    grade: Optional[str] = None    # Letter grade
    comment: Optional[str] = ""
    # MHPS Assessment Components
    homework: Optional[float] = None      # 5%
    groupWork: Optional[float] = None     # 5%
    project: Optional[float] = None       # 10%
    quiz: Optional[float] = None          # 10%
    midTerm: Optional[float] = None       # 30%
    endOfTerm: Optional[float] = None     # 40%

class GradebookEntry(BaseModel):
    student_id: str
    class_id: str
    term: str
    academic_year: str
    subjects: List[SubjectGrade]

class GradebookResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    student_id: str
    class_id: str
    school_code: str
    term: str
    academic_year: str
    subjects: List[dict]
    overall_score: float
    overall_grade: str
    overall_points: float
    overall_domain: str
    graded_by: str
    is_locked: bool = False
    locked_at: Optional[str] = ""
    locked_by: Optional[str] = ""
    created_at: str
    updated_at: str

# Social Skills Model
class SocialSkillsEntry(BaseModel):
    student_id: str
    term: str
    academic_year: str
    skills: Dict[str, str] = {}  # skill_name -> rating (Excellent, Good, Satisfactory, Needs Improvement)

# CSV Import Models
class StudentCSVRow(BaseModel):
    student_id: Optional[str] = ""
    first_name: str
    middle_name: Optional[str] = ""
    last_name: str
    date_of_birth: str
    gender: str
    address: Optional[str] = ""
    house: Optional[str] = ""
    emergency_contact: Optional[str] = ""

class TeacherCSVRow(BaseModel):
    username: str
    name: str
    password: Optional[str] = "Teacher@123"  # Default password

# Signature Model
class SignatureUpload(BaseModel):
    type: str  # "teacher" or "principal"
    school_code: str

# Report Template Model
class ReportTemplateSubject(BaseModel):
    name: str
    is_core: bool = False
    weights: Optional[Dict[str, float]] = None

class ReportTemplateGrade(BaseModel):
    min: int
    max: int
    grade: str
    description: str = ""

class ReportTemplateAchievement(BaseModel):
    min: int
    max: int
    band: str = ""
    grade: str = ""
    description: str = ""

class ReportTemplateSocialCategory(BaseModel):
    category_name: str
    skills: List[str]

class ReportTemplateSkillRating(BaseModel):
    code: str
    label: str

class ReportTemplateCreate(BaseModel):
    school_code: str
    school_name: str
    school_motto: Optional[str] = ""
    logo_url: Optional[str] = ""
    header_text: Optional[str] = "REPORT CARD"
    sub_header_text: Optional[str] = ""
    subjects: List[ReportTemplateSubject] = []
    grade_scale: List[ReportTemplateGrade] = []
    use_weighted_grading: bool = False
    assessment_weights: Dict[str, float] = {}
    sections: Dict[str, bool] = {}
    social_skills_categories: List[ReportTemplateSocialCategory] = []
    skill_ratings: Optional[List[Any]] = None  # Can be List[str] or List[ReportTemplateSkillRating]
    achievement_standards: List[ReportTemplateAchievement] = []
    paper_size: str = "legal"
    # WYSIWYG builder fields
    blocks: Optional[List[Dict]] = None
    theme: Optional[Dict] = None
    # Canvas designer fields
    design_mode: Optional[str] = "canvas"
    canvas_elements: Optional[List[Dict]] = None
    background_url: Optional[str] = None

DEFAULT_SUBJECTS = [
    {"name": "English Language", "is_core": True},
    {"name": "Mathematics", "is_core": True},
    {"name": "Science", "is_core": True},
    {"name": "Social Studies", "is_core": True},
    {"name": "Religious Education", "is_core": False},
    {"name": "Physical Education", "is_core": False},
    {"name": "Creative Arts", "is_core": False},
    {"name": "Music", "is_core": False},
    {"name": "ICT", "is_core": False},
    {"name": "French", "is_core": False},
]

DEFAULT_GRADE_SCALE = [
    {"min": 90, "max": 100, "grade": "A+", "description": "Excellent"},
    {"min": 85, "max": 89, "grade": "A", "description": "Very Good"},
    {"min": 80, "max": 84, "grade": "A-", "description": "Good"},
    {"min": 75, "max": 79, "grade": "B", "description": "Satisfactory"},
    {"min": 70, "max": 74, "grade": "B-", "description": "Developing"},
    {"min": 65, "max": 69, "grade": "C", "description": "Passing"},
    {"min": 60, "max": 64, "grade": "C-", "description": "Passing"},
    {"min": 55, "max": 59, "grade": "D", "description": "Marginal"},
    {"min": 50, "max": 54, "grade": "D-", "description": "Below Average"},
    {"min": 40, "max": 49, "grade": "E", "description": "Frustration"},
    {"min": 0, "max": 39, "grade": "U", "description": "No participation"},
]

DEFAULT_SECTIONS = {
    "social_skills": True,
    "attendance_summary": True,
    "teacher_comments": True,
    "signatures": True,
    "achievement_standards": True,
    "grade_key": True,
    "weight_key": True,
}

DEFAULT_SOCIAL_SKILLS = [
    {"category_name": "Work and Personal Ethics", "skills": [
        "Completes Assignments", "Follows Instructions", "Punctuality",
        "Deportment", "Courteous in Speech and Action", "Class Participation"
    ]},
    {"category_name": "Respect", "skills": [
        "Respect for Teacher", "Respect for Peers"
    ]},
]

DEFAULT_ACHIEVEMENT_STANDARDS = [
    {"min": 85, "max": 100, "band": "Highly Proficient", "description": "Student demonstrates excellent understanding and consistently produces outstanding work."},
    {"min": 70, "max": 84, "band": "Proficient", "description": "Student shows good understanding and produces quality work."},
    {"min": 50, "max": 69, "band": "Developing", "description": "Student shows basic understanding and is making progress."},
    {"min": 0, "max": 49, "band": "Beginning", "description": "Student needs additional support and practice."},
]

DEFAULT_WEIGHTS = {
    "homework": 5,
    "groupWork": 5,
    "project": 10,
    "quiz": 10,
    "midTerm": 30,
    "endOfTerm": 40,
}

def build_default_template(school_code: str, school_name: str) -> dict:
    """Build a default report template for a new school"""
    return {
        "id": str(uuid.uuid4()),
        "school_code": school_code,
        "school_name": school_name,
        "school_motto": "",
        "logo_url": "",
        "header_text": "REPORT CARD",
        "sub_header_text": "",
        "subjects": DEFAULT_SUBJECTS,
        "grade_scale": DEFAULT_GRADE_SCALE,
        "use_weighted_grading": False,
        "assessment_weights": DEFAULT_WEIGHTS,
        "sections": DEFAULT_SECTIONS,
        "social_skills_categories": DEFAULT_SOCIAL_SKILLS,
        "skill_ratings": ["Excellent", "Good", "Satisfactory", "Needs Improvement"],
        "achievement_standards": DEFAULT_ACHIEVEMENT_STANDARDS,
        "paper_size": "legal",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

# ==================== AUTH HELPERS ====================

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception:
        return False

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        
        # Override school_code from token if present (for superuser context switching)
        token_school_code = payload.get("school_code")
        if token_school_code:
            user = {**user, "school_code": token_school_code}
        
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

def require_roles(allowed_roles: List[str]):
    async def role_checker(current_user: dict = Depends(get_current_user)):
        # Superuser has access to everything
        if current_user["role"] == UserRole.SUPERUSER:
            return current_user
        if current_user["role"] not in allowed_roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return current_user
    return role_checker

def require_permission(permission: str):
    async def permission_checker(current_user: dict = Depends(get_current_user)):
        # Superuser has all permissions
        if current_user["role"] == UserRole.SUPERUSER:
            return current_user
        user_permissions = current_user.get("permissions", [])
        if permission not in user_permissions:
            raise HTTPException(status_code=403, detail=f"Permission denied: {permission}")
        return current_user
    return permission_checker

def require_superuser():
    async def superuser_checker(current_user: dict = Depends(get_current_user)):
        if current_user["role"] != UserRole.SUPERUSER:
            raise HTTPException(status_code=403, detail="Superuser access required")
        return current_user
    return superuser_checker


async def assert_school_tenant(school_id: str, current_user: dict) -> dict:
    """Look up a school by id and assert the current user has tenant access.
    Returns the school document. Raises 404 if not found, 403 if cross-tenant."""
    school = await db.schools.find_one({"id": school_id}, {"_id": 0})
    if not school:
        raise HTTPException(status_code=404, detail="School not found")
    if current_user["role"] != UserRole.SUPERUSER and school.get("school_code") != current_user["school_code"]:
        raise HTTPException(status_code=403, detail="Cross-tenant access denied")
    return school


async def get_teacher_class_ids(current_user: dict) -> List[str]:
    """Return all class ids the teacher teaches OR created within their school."""
    classes = await db.classes.find(
        {
            "school_code": current_user["school_code"],
            "$or": [
                {"teacher_id": current_user["id"]},
                {"created_by": current_user["id"]},
            ],
        },
        {"_id": 0, "id": 1},
    ).to_list(1000)
    return [c["id"] for c in classes]


async def get_teacher_student_ids(current_user: dict) -> List[str]:
    """Return ids of students assigned to any class this teacher teaches."""
    class_ids = await get_teacher_class_ids(current_user)
    if not class_ids:
        return []
    students = await db.students.find(
        {"school_code": current_user["school_code"], "class_id": {"$in": class_ids}},
        {"_id": 0, "id": 1},
    ).to_list(5000)
    return [s["id"] for s in students]

# ==================== STARTUP - Create Superuser ====================

@app.on_event("startup")
async def create_superuser():
    """Create the default superuser account if it doesn't exist"""
    # Check if JTECH school exists
    jtech_school = await db.schools.find_one({"school_code": "JTECH"})
    if not jtech_school:
        await db.schools.insert_one({
            "id": str(uuid.uuid4()),
            "school_code": "JTECH",
            "name": "JTECH Innovations",
            "address": "System Administration",
            "phone": "",
            "email": "jtech.innovations@outlook.com",
            "logo_url": "",
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    # Check if superuser exists
    superuser = await db.users.find_one({"username": "jtech.innovations@outlook.com", "school_code": "JTECH"})
    if not superuser:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "username": "jtech.innovations@outlook.com",
            "name": "JTECH Super Admin",
            "role": UserRole.SUPERUSER,
            "school_code": "JTECH",
            "permissions": ALL_PERMISSIONS,
            "password_hash": hash_password("Xekleidoma@1"),
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        print("Superuser account created successfully")

# ==================== AUTH ROUTES ====================

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    # Normalize school code to uppercase
    school_code = credentials.school_code.upper()
    
    # Check if school exists and is active
    school = await db.schools.find_one({"school_code": school_code, "is_active": True})
    if not school:
        raise HTTPException(status_code=401, detail="Invalid school code")
    
    # First, try to find the user in the requested school
    user = await db.users.find_one({
        "username": credentials.username,
        "school_code": school_code
    }, {"_id": 0})
    
    # If not found, check if user is a superuser trying to access another school
    if not user:
        # Look for a superuser with this username
        superuser = await db.users.find_one({
            "username": credentials.username,
            "role": UserRole.SUPERUSER
        }, {"_id": 0})
        
        if superuser and verify_password(credentials.password, superuser["password_hash"]):
            # Superuser can log into any school - use the requested school_code for this session
            token = create_access_token({
                "sub": superuser["id"], 
                "role": superuser["role"],
                "school_code": school_code  # Use the requested school context
            })
            
            return TokenResponse(
                access_token=token,
                user=UserResponse(
                    id=superuser["id"],
                    username=superuser["username"],
                    name=superuser["name"],
                    role=superuser["role"],
                    school_code=school_code,  # Return the school they're logging into
                    permissions=superuser.get("permissions", []),
                    created_at=superuser["created_at"]
                )
            )
    
    if not user or not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_access_token({
        "sub": user["id"], 
        "role": user["role"],
        "school_code": school_code
    })
    
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user["id"],
            username=user["username"],
            name=user["name"],
            role=user["role"],
            school_code=user["school_code"],
            permissions=user.get("permissions", []),
            created_at=user["created_at"]
        )
    )

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(**{k: v for k, v in current_user.items() if k != "password_hash"})

# ==================== SCHOOL MANAGEMENT (Superuser Only) ====================

@api_router.post("/schools", response_model=SchoolResponse)
async def create_school(school: SchoolCreate, current_user: dict = Depends(require_superuser())):
    # Check if school code already exists
    existing = await db.schools.find_one({"school_code": school.school_code.upper()})
    if existing:
        raise HTTPException(status_code=400, detail="School code already exists")
    
    school_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    # Set default academic years if not provided
    if not school.academic_years:
        school.academic_years = [
            AcademicYear(year="2025-2026", terms=["Term 1", "Term 2", "Term 3"], is_enabled=True, is_current=True),
            AcademicYear(year="2024-2025", terms=["Term 1", "Term 2", "Term 3"], is_enabled=False, is_current=False)
        ]
    
    # Set default subjects if not provided
    if not school.subjects:
        school.subjects = [
            SchoolSubject(name="English Language", is_core=True, order=1),
            SchoolSubject(name="Mathematics", is_core=True, order=2),
            SchoolSubject(name="Science", is_core=True, order=3),
            SchoolSubject(name="Social Studies", is_core=True, order=4),
            SchoolSubject(name="Religious Education", is_core=False, order=5),
            SchoolSubject(name="Physical Education", is_core=False, order=6),
            SchoolSubject(name="Creative Arts", is_core=False, order=7),
            SchoolSubject(name="Music", is_core=False, order=8),
            SchoolSubject(name="ICT", is_core=False, order=9),
            SchoolSubject(name="French", is_core=False, order=10)
        ]
    
    doc = {
        "id": school_id,
        **school.model_dump(),
        "school_code": school.school_code.upper(),
        "created_at": now
    }
    await db.schools.insert_one(doc)
    
    # Auto-create default report template for the new school
    template = build_default_template(school.school_code.upper(), school.name)
    await db.report_templates.insert_one(template)
    
    return SchoolResponse(**doc)

@api_router.get("/schools", response_model=List[SchoolResponse])
async def get_schools(current_user: dict = Depends(get_current_user)):
    """List schools. Superuser sees all; everyone else only sees their own school."""
    if current_user["role"] == UserRole.SUPERUSER:
        schools = await db.schools.find({}, {"_id": 0}).to_list(1000)
    else:
        schools = await db.schools.find({"school_code": current_user["school_code"]}, {"_id": 0}).to_list(1)
    return [SchoolResponse(**s) for s in schools]

@api_router.get("/schools/{school_id}", response_model=SchoolResponse)
async def get_school(school_id: str, current_user: dict = Depends(get_current_user)):
    school = await db.schools.find_one({"id": school_id}, {"_id": 0})
    if not school:
        raise HTTPException(status_code=404, detail="School not found")
    if current_user["role"] != UserRole.SUPERUSER and school.get("school_code") != current_user["school_code"]:
        raise HTTPException(status_code=403, detail="Access to this school is denied")
    return SchoolResponse(**school)

@api_router.put("/schools/{school_id}", response_model=SchoolResponse)
async def update_school(school_id: str, school: SchoolCreate, current_user: dict = Depends(require_superuser())):
    # Don't allow changing school_code of existing school
    existing = await db.schools.find_one({"id": school_id})
    if not existing:
        raise HTTPException(status_code=404, detail="School not found")
    
    update_data = school.model_dump()
    update_data["school_code"] = existing["school_code"]  # Keep original code
    
    await db.schools.update_one({"id": school_id}, {"$set": update_data})
    updated = await db.schools.find_one({"id": school_id}, {"_id": 0})
    return SchoolResponse(**updated)

@api_router.delete("/schools/{school_id}")
async def delete_school(school_id: str, current_user: dict = Depends(require_superuser())):
    school = await db.schools.find_one({"id": school_id})
    if not school:
        raise HTTPException(status_code=404, detail="School not found")
    
    # Don't allow deleting JTECH school
    if school["school_code"] == "JTECH":
        raise HTTPException(status_code=400, detail="Cannot delete system school")
    
    await db.schools.delete_one({"id": school_id})
    return {"message": "School deleted successfully"}


# ==================== ACADEMIC YEAR MANAGEMENT ====================

@api_router.post("/schools/{school_id}/academic-years")
async def add_academic_year(
    school_id: str,
    year: str,
    current_user: dict = Depends(require_roles([UserRole.SUPERUSER, UserRole.ADMIN]))
):
    """Add a new academic year to a school"""
    school = await assert_school_tenant(school_id, current_user)
    
    # Check if year already exists
    academic_years = school.get("academic_years", [])
    if any(ay.get("year") == year for ay in academic_years):
        raise HTTPException(status_code=400, detail="Academic year already exists")
    
    new_year = {
        "year": year,
        "terms": ["Term 1", "Term 2", "Term 3"],
        "is_enabled": True,
        "is_current": False
    }
    
    academic_years.append(new_year)
    
    await db.schools.update_one(
        {"id": school_id},
        {"$set": {"academic_years": academic_years}}
    )
    
    return {"message": "Academic year added", "academic_year": new_year}

@api_router.put("/schools/{school_id}/academic-years/{year}/toggle")
async def toggle_academic_year(
    school_id: str,
    year: str,
    is_enabled: bool,
    current_user: dict = Depends(require_roles([UserRole.SUPERUSER, UserRole.ADMIN]))
):
    """Enable or disable an academic year"""
    school = await assert_school_tenant(school_id, current_user)
    
    academic_years = school.get("academic_years", [])
    found = False
    
    for ay in academic_years:
        if ay.get("year") == year:
            ay["is_enabled"] = is_enabled
            found = True
            break
    
    if not found:
        raise HTTPException(status_code=404, detail="Academic year not found")
    
    await db.schools.update_one(
        {"id": school_id},
        {"$set": {"academic_years": academic_years}}
    )
    
    return {"message": f"Academic year {year} {'enabled' if is_enabled else 'disabled'}"}

@api_router.put("/schools/{school_id}/academic-years/{year}/set-current")
async def set_current_academic_year(
    school_id: str,
    year: str,
    current_user: dict = Depends(require_roles([UserRole.SUPERUSER, UserRole.ADMIN]))
):
    """Set the current academic year"""
    school = await assert_school_tenant(school_id, current_user)
    
    academic_years = school.get("academic_years", [])
    found = False
    
    # Set all to not current, then set the selected one
    for ay in academic_years:
        ay["is_current"] = False
        if ay.get("year") == year:
            ay["is_current"] = True
            found = True
    
    if not found:
        raise HTTPException(status_code=404, detail="Academic year not found")
    
    await db.schools.update_one(
        {"id": school_id},
        {"$set": {
            "academic_years": academic_years,
            "current_academic_year": year
        }}
    )
    
    return {"message": f"Current academic year set to {year}"}

# ==================== SCHOOL SIGNATURE MANAGEMENT ====================

@api_router.post("/schools/{school_id}/signatures/upload")
async def upload_school_signature(
    school_id: str,
    signature_type: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(require_roles([UserRole.SUPERUSER, UserRole.ADMIN]))
):
    """Upload principal or teacher signature for a school"""
    if signature_type not in ["principal", "teacher"]:
        raise HTTPException(status_code=400, detail="Invalid signature type. Must be 'principal' or 'teacher'")
    
    school = await assert_school_tenant(school_id, current_user)
    
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Invalid file type")
    
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large")
    
    file_id = str(uuid.uuid4())
    filename = f"signature_{signature_type}_{school['school_code']}_{file_id}{ext}"
    file_path = UPLOAD_DIR / filename
    
    with open(file_path, "wb") as f:
        f.write(content)
    
    signature_url = f"/api/uploads/{filename}"
    
    # Update school with signature
    field_name = f"{signature_type}_signature"
    await db.schools.update_one(
        {"id": school_id},
        {"$set": {field_name: signature_url}}
    )
    
    return {"signature_url": signature_url, "type": signature_type}

@api_router.get("/schools/{school_id}/signatures")
async def get_school_signatures(
    school_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get school signatures"""
    school = await assert_school_tenant(school_id, current_user)
    
    return {
        "principal_signature": school.get("principal_signature", ""),
        "teacher_signature": school.get("teacher_signature", "")
    }


# ==================== SCHOOL SUBJECTS MANAGEMENT ====================

@api_router.get("/schools/{school_id}/subjects")
async def get_school_subjects(
    school_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get subjects for a school"""
    school = await assert_school_tenant(school_id, current_user)
    return {"subjects": school.get("subjects", [])}

@api_router.put("/schools/{school_id}/subjects")
async def update_school_subjects(
    school_id: str,
    subjects: List[SchoolSubject],
    current_user: dict = Depends(require_roles([UserRole.SUPERUSER, UserRole.ADMIN]))
):
    """Update subjects for a school"""
    school = await assert_school_tenant(school_id, current_user)
    
    # Convert subjects to dict format
    subjects_data = [subj.model_dump() for subj in subjects]
    
    await db.schools.update_one(
        {"id": school_id},
        {"$set": {"subjects": subjects_data}}
    )
    
    # Also update the report template for this school
    await db.report_templates.update_one(
        {"school_code": school["school_code"]},
        {"$set": {"subjects": [{"name": s["name"], "is_core": s["is_core"]} for s in subjects_data]}}
    )
    
    return {"message": "Subjects updated successfully", "subjects": subjects_data}

@api_router.post("/schools/{school_id}/subjects")
async def add_school_subject(
    school_id: str,
    subject: SchoolSubject,
    current_user: dict = Depends(require_roles([UserRole.SUPERUSER, UserRole.ADMIN]))
):
    """Add a new subject to a school"""
    school = await assert_school_tenant(school_id, current_user)
    
    subjects = school.get("subjects", [])
    
    # Check if subject already exists
    if any(s.get("name") == subject.name for s in subjects):
        raise HTTPException(status_code=400, detail="Subject already exists")
    
    # Add new subject
    subject_data = subject.model_dump()
    subjects.append(subject_data)
    
    await db.schools.update_one(
        {"id": school_id},
        {"$set": {"subjects": subjects}}
    )
    
    return {"message": "Subject added", "subject": subject_data}

@api_router.delete("/schools/{school_id}/subjects/{subject_name}")
async def delete_school_subject(
    school_id: str,
    subject_name: str,
    current_user: dict = Depends(require_roles([UserRole.SUPERUSER, UserRole.ADMIN]))
):
    """Delete a subject from a school"""
    school = await assert_school_tenant(school_id, current_user)
    
    subjects = school.get("subjects", [])
    subjects = [s for s in subjects if s.get("name") != subject_name]
    
    await db.schools.update_one(
        {"id": school_id},
        {"$set": {"subjects": subjects}}
    )
    
    return {"message": f"Subject '{subject_name}' deleted"}


# ==================== REPORT TEMPLATES (Superuser Only) ====================

@api_router.get("/report-templates/{school_code}")
async def get_report_template(school_code: str, current_user: dict = Depends(get_current_user)):
    """Get report template for a school. Any authenticated user can read their own school's template."""
    sc = school_code.upper()
    if current_user["role"] != UserRole.SUPERUSER and current_user["school_code"] != sc:
        raise HTTPException(status_code=403, detail="Cannot access template of another school")
    template = await db.report_templates.find_one(
        {"school_code": sc}, {"_id": 0}
    )
    if not template:
        # Auto-create default if missing
        school = await db.schools.find_one({"school_code": sc}, {"_id": 0})
        if not school:
            raise HTTPException(status_code=404, detail="School not found")
        template = build_default_template(sc, school.get("name", school_code))
        await db.report_templates.insert_one(template)
        template.pop("_id", None)
    return template

@api_router.put("/report-templates/{school_code}")
async def update_report_template(
    school_code: str,
    template_data: ReportTemplateCreate,
    current_user: dict = Depends(require_superuser())
):
    """Update report template for a school (superuser only)"""
    sc = school_code.upper()
    existing = await db.report_templates.find_one({"school_code": sc})
    
    now = datetime.now(timezone.utc).isoformat()
    update_doc = template_data.model_dump()
    update_doc["school_code"] = sc
    update_doc["updated_at"] = now
    
    if existing:
        await db.report_templates.update_one(
            {"school_code": sc},
            {"$set": update_doc}
        )
        updated = await db.report_templates.find_one({"school_code": sc}, {"_id": 0})
        return updated
    else:
        update_doc["id"] = str(uuid.uuid4())
        update_doc["created_at"] = now
        await db.report_templates.insert_one(update_doc)
        update_doc.pop("_id", None)
        return update_doc

# ==================== USER MANAGEMENT ====================

@api_router.get("/users", response_model=List[UserResponse])
async def get_users(current_user: dict = Depends(require_roles([UserRole.ADMIN]))):
    query = {}
    # Non-superusers can only see users in their school
    if current_user["role"] != UserRole.SUPERUSER:
        query["school_code"] = current_user["school_code"]
    
    users = await db.users.find(query, {"_id": 0, "password_hash": 0}).to_list(1000)
    return [UserResponse(**u) for u in users]

@api_router.post("/users", response_model=UserResponse)
async def create_user(user_data: UserCreate, current_user: dict = Depends(require_roles([UserRole.ADMIN]))):
    """Admin can create users in their school, superuser can create in any school"""
    
    # Non-superusers can only create users in their school
    school_code = user_data.school_code.upper()
    if current_user["role"] != UserRole.SUPERUSER:
        school_code = current_user["school_code"]
    
    # Check school exists
    school = await db.schools.find_one({"school_code": school_code})
    if not school:
        raise HTTPException(status_code=400, detail="Invalid school code")
    
    # Check if username exists in this school
    existing = await db.users.find_one({
        "username": user_data.username,
        "school_code": school_code
    })
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists in this school")
    
    # Non-superusers cannot create superusers
    if user_data.role == UserRole.SUPERUSER and current_user["role"] != UserRole.SUPERUSER:
        raise HTTPException(status_code=403, detail="Cannot create superuser account")
    
    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    # Set default permissions based on role
    permissions = user_data.permissions
    if not permissions:
        if user_data.role == UserRole.ADMIN:
            permissions = ALL_PERMISSIONS.copy()
            permissions.remove("manage_schools")  # Admins can't manage schools
        elif user_data.role == UserRole.TEACHER:
            permissions = ["manage_students", "manage_classes", "manage_attendance", "manage_grades", "view_reports", "generate_reports"]
        elif user_data.role == UserRole.PARENT:
            permissions = ["view_reports"]
    
    user_doc = {
        "id": user_id,
        "username": user_data.username,
        "name": user_data.name,
        "role": user_data.role,
        "school_code": school_code,
        "permissions": permissions,
        "photo_url": user_data.photo_url or "",
        "salutation": user_data.salutation or "",
        "first_name": user_data.first_name or "",
        "middle_name": user_data.middle_name or "",
        "last_name": user_data.last_name or "",
        "gender": user_data.gender or "",
        "address_line1": user_data.address_line1 or "",
        "address_line2": user_data.address_line2 or "",
        "city_state": user_data.city_state or "",
        "country": user_data.country or "",
        "phone": user_data.phone or "",
        "email": user_data.email or "",
        "password_hash": hash_password(user_data.password),
        "created_at": now
    }
    await db.users.insert_one(user_doc)
    
    return UserResponse(
        id=user_id,
        username=user_data.username,
        name=user_data.name,
        role=user_data.role,
        school_code=school_code,
        permissions=permissions,
        photo_url=user_data.photo_url or "",
        created_at=now
    )

@api_router.put("/users/{user_id}/role")
async def update_user_role(user_id: str, role_data: RoleUpdate, current_user: dict = Depends(require_roles([UserRole.ADMIN]))):
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Non-superusers can only modify users in their school
    if current_user["role"] != UserRole.SUPERUSER and user["school_code"] != current_user["school_code"]:
        raise HTTPException(status_code=403, detail="Cannot modify users from other schools")
    
    # Cannot modify superuser unless you are superuser
    if user["role"] == UserRole.SUPERUSER and current_user["role"] != UserRole.SUPERUSER:
        raise HTTPException(status_code=403, detail="Cannot modify superuser account")
    
    # Cannot create superuser unless you are superuser
    if role_data.role == UserRole.SUPERUSER and current_user["role"] != UserRole.SUPERUSER:
        raise HTTPException(status_code=403, detail="Cannot assign superuser role")
    
    update_data = {"role": role_data.role}
    if role_data.permissions is not None:
        update_data["permissions"] = role_data.permissions
    
    await db.users.update_one({"id": user_id}, {"$set": update_data})
    return {"message": "User updated successfully"}

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user: dict = Depends(require_roles([UserRole.ADMIN]))):
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Non-superusers can only delete users in their school
    if current_user["role"] != UserRole.SUPERUSER and user["school_code"] != current_user["school_code"]:
        raise HTTPException(status_code=403, detail="Cannot delete users from other schools")
    
    # Cannot delete superuser
    if user["role"] == UserRole.SUPERUSER:
        raise HTTPException(status_code=403, detail="Cannot delete superuser account")
    
    # Cannot delete yourself
    if user["id"] == current_user["id"]:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    
    await db.users.delete_one({"id": user_id})
    return {"message": "User deleted successfully"}

class ResetCredentials(BaseModel):
    username: Optional[str] = None
    password: Optional[str] = None

@api_router.put("/users/{user_id}/credentials")
async def reset_user_credentials(
    user_id: str, 
    credentials: ResetCredentials, 
    current_user: dict = Depends(require_roles([UserRole.SUPERUSER, UserRole.ADMIN]))
):
    """Reset user's username and/or password - Superuser can reset any user, Admin can reset users in their school"""
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Admins can only reset users in their school
    if current_user["role"] != UserRole.SUPERUSER:
        if user["school_code"] != current_user["school_code"]:
            raise HTTPException(status_code=403, detail="Cannot reset credentials for users in other schools")
    
    # Cannot reset superuser credentials unless you are a superuser
    if user["role"] == UserRole.SUPERUSER and current_user["role"] != UserRole.SUPERUSER:
        raise HTTPException(status_code=403, detail="Only superuser can reset superuser credentials")
    
    update_data = {}
    if credentials.username:
        # Check if username already exists
        existing = await db.users.find_one({
            "username": credentials.username, 
            "school_code": user["school_code"],
            "id": {"$ne": user_id}
        })
        if existing:
            raise HTTPException(status_code=400, detail="Username already exists")
        update_data["username"] = credentials.username
    
    if credentials.password:
        update_data["password_hash"] = hash_password(credentials.password)
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No credentials provided to update")
    
    await db.users.update_one({"id": user_id}, {"$set": update_data})
    
    return {"message": "Credentials updated successfully"}

# ==================== STUDENT ROUTES ====================

@api_router.post("/students", response_model=StudentResponse)
async def create_student(student: StudentCreate, current_user: dict = Depends(require_permission("manage_students"))):
    student_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    age = calculate_age(student.date_of_birth)
    student_data = student.model_dump()
    # Generate IDs for family members
    for fm in student_data.get("family_members", []):
        if not fm.get("id"):
            fm["id"] = str(uuid.uuid4())
    doc = {
        "id": student_id,
        "school_code": current_user["school_code"],
        **student_data,
        "age": age,
        "created_at": now,
        "updated_at": now
    }
    await db.students.insert_one(doc)
    await write_audit(current_user, "create", "student", student_id, f"{doc.get('first_name','')} {doc.get('last_name','')}")
    return StudentResponse(**doc)

@api_router.get("/students", response_model=List[StudentResponse])
async def get_students(
    class_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {"school_code": current_user["school_code"]}
    if class_id:
        query["class_id"] = class_id
    
    if current_user["role"] == UserRole.PARENT:
        query["parent_id"] = current_user["id"]
    elif current_user["role"] == UserRole.TEACHER:
        # Teachers can only see students assigned to classes they teach/created
        teacher_class_ids = await get_teacher_class_ids(current_user)
        if not teacher_class_ids:
            return []
        if class_id:
            # If filtering by class_id, ensure it's one of the teacher's classes
            if class_id not in teacher_class_ids:
                return []
        else:
            query["class_id"] = {"$in": teacher_class_ids}
    
    students = await db.students.find(query, {"_id": 0}).to_list(1000)
    
    for s in students:
        s["age"] = calculate_age(s.get("date_of_birth", ""))
    
    return [StudentResponse(**s) for s in students]

@api_router.get("/students/{student_id}", response_model=StudentResponse)
async def get_student(student_id: str, current_user: dict = Depends(get_current_user)):
    query = {"id": student_id, "school_code": current_user["school_code"]}
    student = await db.students.find_one(query, {"_id": 0})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    if current_user["role"] == UserRole.PARENT and student.get("parent_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if current_user["role"] == UserRole.TEACHER:
        teacher_class_ids = await get_teacher_class_ids(current_user)
        if student.get("class_id") not in teacher_class_ids:
            raise HTTPException(status_code=403, detail="Student is not in your class")
    
    student["age"] = calculate_age(student.get("date_of_birth", ""))
    return StudentResponse(**student)

@api_router.put("/students/{student_id}", response_model=StudentResponse)
async def update_student(student_id: str, student: StudentCreate, current_user: dict = Depends(require_permission("manage_students"))):
    query = {"id": student_id, "school_code": current_user["school_code"]}
    existing = await db.students.find_one(query)
    if not existing:
        raise HTTPException(status_code=404, detail="Student not found")
    
    now = datetime.now(timezone.utc).isoformat()
    age = calculate_age(student.date_of_birth)
    student_data = student.model_dump()
    # Generate IDs for new family members
    for fm in student_data.get("family_members", []):
        if not fm.get("id"):
            fm["id"] = str(uuid.uuid4())
    update_data = {**student_data, "age": age, "updated_at": now}
    
    await db.students.update_one(query, {"$set": update_data})
    updated = await db.students.find_one(query, {"_id": 0})
    updated["age"] = age
    await write_audit(current_user, "update", "student", student_id, f"{updated.get('first_name','')} {updated.get('last_name','')}")
    return StudentResponse(**updated)

@api_router.delete("/students/{student_id}")
async def delete_student(student_id: str, current_user: dict = Depends(require_permission("manage_students"))):
    query = {"id": student_id, "school_code": current_user["school_code"]}
    existing = await db.students.find_one(query, {"_id": 0})
    result = await db.students.delete_one(query)
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Student not found")
    if existing:
        await write_audit(
            current_user, "delete", "student", student_id,
            f"{existing.get('first_name','')} {existing.get('last_name','')}"
        )
    return {"message": "Student deleted successfully"}

# ==================== CLASS ROUTES ====================

@api_router.post("/classes", response_model=ClassResponse)
async def create_class(class_data: ClassCreate, current_user: dict = Depends(require_permission("manage_classes"))):
    class_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    class_dict = class_data.model_dump()
    
    # If teacher creates a class, auto-assign them as the teacher
    if current_user["role"] == UserRole.TEACHER and not class_dict.get("teacher_id"):
        class_dict["teacher_id"] = current_user["id"]
    
    doc = {
        "id": class_id,
        "school_code": current_user["school_code"],
        "created_by": current_user["id"],  # Track who created the class
        **class_dict,
        "created_at": now
    }
    await db.classes.insert_one(doc)
    return ClassResponse(**doc)

@api_router.get("/classes", response_model=List[ClassResponse])
async def get_classes(current_user: dict = Depends(get_current_user)):
    query = {"school_code": current_user["school_code"]}
    
    # Teachers can see classes they teach OR classes they created
    if current_user["role"] == UserRole.TEACHER:
        query["$or"] = [
            {"teacher_id": current_user["id"]},
            {"created_by": current_user["id"]}
        ]
    
    classes = await db.classes.find(query, {"_id": 0}).to_list(1000)
    return [ClassResponse(**c) for c in classes]

@api_router.get("/classes/{class_id}", response_model=ClassResponse)
async def get_class(class_id: str, current_user: dict = Depends(get_current_user)):
    query = {"id": class_id, "school_code": current_user["school_code"]}
    cls = await db.classes.find_one(query, {"_id": 0})
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")
    return ClassResponse(**cls)

@api_router.put("/classes/{class_id}", response_model=ClassResponse)
async def update_class(class_id: str, class_data: ClassCreate, current_user: dict = Depends(require_permission("manage_classes"))):
    query = {"id": class_id, "school_code": current_user["school_code"]}
    result = await db.classes.update_one(query, {"$set": class_data.model_dump()})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Class not found")
    
    updated = await db.classes.find_one(query, {"_id": 0})
    return ClassResponse(**updated)

@api_router.delete("/classes/{class_id}")
async def delete_class(class_id: str, current_user: dict = Depends(require_permission("manage_classes"))):
    query = {"id": class_id, "school_code": current_user["school_code"]}
    result = await db.classes.delete_one(query)
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Class not found")
    return {"message": "Class deleted successfully"}

# ==================== ATTENDANCE ROUTES ====================

@api_router.post("/attendance", response_model=AttendanceResponse)
async def mark_attendance(attendance: AttendanceCreate, current_user: dict = Depends(require_permission("manage_attendance"))):
    existing = await db.attendance.find_one({
        "student_id": attendance.student_id,
        "date": attendance.date,
        "school_code": current_user["school_code"]
    })
    
    attendance_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": attendance_id,
        "school_code": current_user["school_code"],
        **attendance.model_dump(),
        "marked_by": current_user["id"],
        "created_at": now
    }
    
    if existing:
        await db.attendance.update_one(
            {"id": existing["id"]},
            {"$set": {**attendance.model_dump(), "marked_by": current_user["id"]}}
        )
        doc["id"] = existing["id"]
    else:
        await db.attendance.insert_one(doc)
    
    return AttendanceResponse(**doc)

@api_router.post("/attendance/bulk")
async def mark_bulk_attendance(data: AttendanceBulkCreate, current_user: dict = Depends(require_permission("manage_attendance"))):
    now = datetime.now(timezone.utc).isoformat()
    created_count = 0
    updated_count = 0
    
    for record in data.records:
        existing = await db.attendance.find_one({
            "student_id": record["student_id"],
            "date": data.date,
            "school_code": current_user["school_code"]
        })
        
        if existing:
            await db.attendance.update_one(
                {"id": existing["id"]},
                {"$set": {"status": record["status"], "marked_by": current_user["id"]}}
            )
            updated_count += 1
        else:
            doc = {
                "id": str(uuid.uuid4()),
                "school_code": current_user["school_code"],
                "student_id": record["student_id"],
                "class_id": data.class_id,
                "date": data.date,
                "status": record["status"],
                "marked_by": current_user["id"],
                "created_at": now
            }
            await db.attendance.insert_one(doc)
            created_count += 1
    
    return {"message": f"Attendance recorded: {created_count} new, {updated_count} updated"}

@api_router.get("/attendance", response_model=List[AttendanceResponse])
async def get_attendance(
    student_id: Optional[str] = None,
    class_id: Optional[str] = None,
    date: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {"school_code": current_user["school_code"]}
    if student_id:
        query["student_id"] = student_id
    if class_id:
        query["class_id"] = class_id
    if date:
        query["date"] = date
    if start_date and end_date:
        query["date"] = {"$gte": start_date, "$lte": end_date}
    
    if current_user["role"] == UserRole.PARENT:
        children = await db.students.find(
            {"parent_id": current_user["id"], "school_code": current_user["school_code"]}, 
            {"_id": 0, "id": 1}
        ).to_list(100)
        child_ids = [c["id"] for c in children]
        query["student_id"] = {"$in": child_ids}
    elif current_user["role"] == UserRole.TEACHER:
        teacher_class_ids = await get_teacher_class_ids(current_user)
        if not teacher_class_ids:
            return []
        # If a specific class was requested, ensure it's one of the teacher's
        if class_id and class_id not in teacher_class_ids:
            return []
        # If no class specified, restrict to all teacher classes
        if not class_id:
            query["class_id"] = {"$in": teacher_class_ids}
    
    attendance = await db.attendance.find(query, {"_id": 0}).to_list(10000)
    return [AttendanceResponse(**a) for a in attendance]

# ==================== GRADEBOOK ROUTES ====================

# MHPS Assessment Weights
MHPS_WEIGHTS = {
    "homework": 0.05,
    "groupWork": 0.05, 
    "project": 0.10,
    "quiz": 0.10,
    "midTerm": 0.30,
    "endOfTerm": 0.40
}

# MHPS Grade Scale
MHPS_GRADE_SCALE = [
    {"min": 95, "max": 100, "grade": "A+", "description": "Excellent"},
    {"min": 90, "max": 94, "grade": "A", "description": "Very Good"},
    {"min": 80, "max": 89, "grade": "B+", "description": "Good"},
    {"min": 70, "max": 79, "grade": "B", "description": "Satisfactory"},
    {"min": 60, "max": 69, "grade": "C+", "description": "Satisfactory"},
    {"min": 50, "max": 59, "grade": "C", "description": "Needs Improvement"},
    {"min": 40, "max": 49, "grade": "D", "description": "Unsatisfactory"},
    {"min": 0, "max": 39, "grade": "E", "description": "Poor"}
]

def get_mhps_grade(score):
    """Get MHPS grade from score"""
    if score is None:
        return {"grade": "-", "description": "-"}
    rounded = round(score)
    for g in MHPS_GRADE_SCALE:
        if g["min"] <= rounded <= g["max"]:
            return g
    return {"grade": "E", "description": "Poor"}

def calculate_mhps_weighted_score(subj):
    """Calculate weighted score using MHPS formula"""
    homework = subj.homework or 0
    groupWork = subj.groupWork or 0
    project = subj.project or 0
    quiz = subj.quiz or 0
    midTerm = subj.midTerm or 0
    endOfTerm = subj.endOfTerm or 0
    
    weighted = (
        homework * MHPS_WEIGHTS["homework"] +
        groupWork * MHPS_WEIGHTS["groupWork"] +
        project * MHPS_WEIGHTS["project"] +
        quiz * MHPS_WEIGHTS["quiz"] +
        midTerm * MHPS_WEIGHTS["midTerm"] +
        endOfTerm * MHPS_WEIGHTS["endOfTerm"]
    )
    return round(weighted, 2)

@api_router.post("/gradebook", response_model=GradebookResponse)
async def save_gradebook(entry: GradebookEntry, current_user: dict = Depends(require_permission("manage_grades"))):
    subjects_with_grades = []
    total_score = 0
    subject_count = 0
    
    for subj in entry.subjects:
        # Check if MHPS assessment components are provided
        has_mhps_components = any([
            subj.homework is not None,
            subj.groupWork is not None,
            subj.project is not None,
            subj.quiz is not None,
            subj.midTerm is not None,
            subj.endOfTerm is not None
        ])
        
        if has_mhps_components:
            # Calculate weighted score using MHPS formula
            weighted_score = calculate_mhps_weighted_score(subj)
            mhps_grade = get_mhps_grade(weighted_score)
            
            subjects_with_grades.append({
                "subject": subj.subject,
                "score": weighted_score,
                "grade": mhps_grade["grade"],
                "comment": subj.comment or "",
                # MHPS components
                "homework": subj.homework,
                "groupWork": subj.groupWork,
                "project": subj.project,
                "quiz": subj.quiz,
                "midTerm": subj.midTerm,
                "endOfTerm": subj.endOfTerm
            })
            total_score += weighted_score
        else:
            # Use simple score
            score = subj.score or 0
            grade_info = get_grade_info(score)
            subjects_with_grades.append({
                "subject": subj.subject,
                "score": score,
                "grade": grade_info["grade"],
                "points": grade_info["points"],
                "domain": grade_info["domain"],
                "comment": subj.comment or ""
            })
            total_score += score
        
        subject_count += 1
    
    overall_score = total_score / subject_count if subject_count > 0 else 0
    overall_info = get_grade_info(overall_score)
    
    now = datetime.now(timezone.utc).isoformat()
    
    existing = await db.gradebook.find_one({
        "student_id": entry.student_id,
        "term": entry.term,
        "academic_year": entry.academic_year,
        "school_code": current_user["school_code"]
    })
    
    # Block edits when the existing entry is locked (only admin/superuser can unlock)
    if existing and existing.get("is_locked"):
        raise HTTPException(status_code=403, detail="Gradebook entry is locked. Ask an admin to unlock.")
    
    doc = {
        "student_id": entry.student_id,
        "class_id": entry.class_id,
        "school_code": current_user["school_code"],
        "term": entry.term,
        "academic_year": entry.academic_year,
        "subjects": subjects_with_grades,
        "overall_score": round(overall_score, 2),
        "overall_grade": overall_info["grade"],
        "overall_points": overall_info["points"],
        "overall_domain": overall_info["domain"],
        "graded_by": current_user["id"],
        "updated_at": now
    }
    
    if existing:
        await db.gradebook.update_one({"id": existing["id"]}, {"$set": doc})
        doc["id"] = existing["id"]
        doc["created_at"] = existing["created_at"]
    else:
        doc["id"] = str(uuid.uuid4())
        doc["created_at"] = now
        await db.gradebook.insert_one(doc)
    
    return GradebookResponse(**doc)

@api_router.get("/gradebook", response_model=List[GradebookResponse])
async def get_gradebook(
    student_id: Optional[str] = None,
    class_id: Optional[str] = None,
    term: Optional[str] = None,
    academic_year: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {"school_code": current_user["school_code"]}
    if student_id:
        query["student_id"] = student_id
    if class_id:
        query["class_id"] = class_id
    if term:
        query["term"] = term
    if academic_year:
        query["academic_year"] = academic_year
    
    if current_user["role"] == UserRole.PARENT:
        children = await db.students.find(
            {"parent_id": current_user["id"], "school_code": current_user["school_code"]}, 
            {"_id": 0, "id": 1}
        ).to_list(100)
        child_ids = [c["id"] for c in children]
        query["student_id"] = {"$in": child_ids}
    elif current_user["role"] == UserRole.TEACHER:
        teacher_class_ids = await get_teacher_class_ids(current_user)
        if not teacher_class_ids:
            return []
        if class_id and class_id not in teacher_class_ids:
            return []
        if not class_id:
            query["class_id"] = {"$in": teacher_class_ids}
    
    entries = await db.gradebook.find(query, {"_id": 0}).to_list(1000)
    return [GradebookResponse(**e) for e in entries]

@api_router.delete("/gradebook/{gradebook_id}")
async def delete_gradebook(gradebook_id: str, current_user: dict = Depends(require_permission("manage_grades"))):
    query = {"id": gradebook_id, "school_code": current_user["school_code"]}
    result = await db.gradebook.delete_one(query)
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Gradebook entry not found")
    return {"message": "Gradebook entry deleted"}

# ==================== REPORT CARD ROUTES ====================

@api_router.get("/report-card/{student_id}")
async def get_student_report_card(
    student_id: str,
    term: str,
    academic_year: str,
    current_user: dict = Depends(get_current_user)
):
    query = {"id": student_id, "school_code": current_user["school_code"]}
    student = await db.students.find_one(query, {"_id": 0})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    if current_user["role"] == UserRole.PARENT and student.get("parent_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    gradebook = await db.gradebook.find_one({
        "student_id": student_id,
        "term": term,
        "academic_year": academic_year,
        "school_code": current_user["school_code"]
    }, {"_id": 0})
    
    class_info = {}
    if student.get("class_id"):
        cls = await db.classes.find_one({"id": student["class_id"], "school_code": current_user["school_code"]}, {"_id": 0})
        if cls:
            class_info = cls
    
    attendance_records = await db.attendance.find({
        "student_id": student_id,
        "school_code": current_user["school_code"]
    }, {"_id": 0}).to_list(1000)
    
    attendance_summary = {
        "total_days": len(attendance_records),
        "present": len([a for a in attendance_records if a["status"] == "present"]),
        "absent": len([a for a in attendance_records if a["status"] == "absent"]),
        "late": len([a for a in attendance_records if a["status"] == "late"]),
        "excused": len([a for a in attendance_records if a["status"] == "excused"])
    }
    
    student["age"] = calculate_age(student.get("date_of_birth", ""))
    
    return {
        "student": student,
        "grades": gradebook or {},
        "attendance_summary": attendance_summary,
        "class_info": class_info,
        "term": term,
        "academic_year": academic_year,
        "grading_scheme": GRADING_SCHEME
    }

@api_router.get("/report-cards/class/{class_id}")
async def get_class_report_cards(
    class_id: str,
    term: str,
    academic_year: str,
    current_user: dict = Depends(require_permission("generate_reports"))
):
    query = {"id": class_id, "school_code": current_user["school_code"]}
    class_info = await db.classes.find_one(query, {"_id": 0})
    if not class_info:
        raise HTTPException(status_code=404, detail="Class not found")
    
    students = await db.students.find(
        {"class_id": class_id, "school_code": current_user["school_code"]}, 
        {"_id": 0}
    ).to_list(100)
    
    report_cards = []
    for student in students:
        student["age"] = calculate_age(student.get("date_of_birth", ""))
        
        gradebook = await db.gradebook.find_one({
            "student_id": student["id"],
            "term": term,
            "academic_year": academic_year,
            "school_code": current_user["school_code"]
        }, {"_id": 0})
        
        attendance_records = await db.attendance.find({
            "student_id": student["id"],
            "school_code": current_user["school_code"]
        }, {"_id": 0}).to_list(1000)
        
        attendance_summary = {
            "total_days": len(attendance_records),
            "present": len([a for a in attendance_records if a["status"] == "present"]),
            "absent": len([a for a in attendance_records if a["status"] == "absent"]),
            "late": len([a for a in attendance_records if a["status"] == "late"]),
            "excused": len([a for a in attendance_records if a["status"] == "excused"])
        }
        
        # Get social skills
        social_skills = await db.social_skills.find_one({
            "student_id": student["id"],
            "term": term,
            "academic_year": academic_year,
            "school_code": current_user["school_code"]
        }, {"_id": 0})
        
        report_cards.append({
            "student": student,
            "grades": gradebook or {},
            "attendance_summary": attendance_summary,
            "social_skills": social_skills.get("skills", {}) if social_skills else {}
        })
    
    # Sort students alphabetically by LastName, FirstName MiddleName
    def get_student_sort_key(card):
        student = card["student"]
        last_name = student.get("last_name", "").strip()
        first_name = student.get("first_name", "").strip()
        middle_name = student.get("middle_name", "").strip()
        return (last_name.lower(), first_name.lower(), middle_name.lower())
    
    report_cards.sort(key=get_student_sort_key)
    
    for idx, card in enumerate(report_cards):
        card["position"] = idx + 1
    
    # Get school info with signatures
    school = await db.schools.find_one({
        "school_code": current_user["school_code"]
    }, {"_id": 0})
    
    signatures = {
        "principal_signature": school.get("principal_signature", "") if school else "",
        "teacher_signature": school.get("teacher_signature", "") if school else ""
    }
    
    return {
        "class_info": class_info,
        "term": term,
        "academic_year": academic_year,
        "total_students": len(students),
        "report_cards": report_cards,
        "grading_scheme": GRADING_SCHEME,
        "signatures": signatures or {}
    }

# ==================== REFERENCE DATA ====================

@api_router.get("/subjects")
async def get_subjects():
    return {"subjects": SUBJECTS}

@api_router.get("/houses")
async def get_houses():
    return {"houses": HOUSES}

@api_router.get("/grading-scheme")
async def get_grading_scheme():
    return {"grading_scheme": GRADING_SCHEME}

@api_router.get("/permissions")
async def get_permissions():
    return {"permissions": ALL_PERMISSIONS}

# ==================== PHOTO UPLOAD ====================

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB

@api_router.post("/upload/photo")
async def upload_photo(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload a photo for student or user profile"""
    # Validate file extension
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Invalid file type. Allowed: {', '.join(ALLOWED_EXTENSIONS)}")
    
    # Read file content
    content = await file.read()
    
    # Check file size
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 5MB")
    
    # Generate unique filename
    file_id = str(uuid.uuid4())
    filename = f"{file_id}{ext}"
    file_path = UPLOAD_DIR / filename
    
    # Save file
    with open(file_path, "wb") as f:
        f.write(content)
    
    # Return the URL to access the photo
    photo_url = f"/api/uploads/{filename}"
    
    return {"photo_url": photo_url, "filename": filename}

@api_router.post("/upload/template-background")
async def upload_template_background(
    file: UploadFile = File(...),
    current_user: dict = Depends(require_superuser())
):
    """Upload a background image for report template (superuser only)"""
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Invalid file type. Allowed: {', '.join(ALLOWED_EXTENSIONS)}")
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 10MB")
    file_id = str(uuid.uuid4())
    filename = f"bg_{file_id}{ext}"
    file_path = UPLOAD_DIR / filename
    with open(file_path, "wb") as f:
        f.write(content)
    return {"background_url": f"/api/uploads/{filename}", "filename": filename}

@api_router.get("/uploads/{filename}")
async def get_upload(filename: str):
    """Serve uploaded files"""
    file_path = UPLOAD_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    # Determine content type
    ext = Path(filename).suffix.lower()
    content_types = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".webp": "image/webp"
    }
    content_type = content_types.get(ext, "application/octet-stream")
    
    return FileResponse(file_path, media_type=content_type)

# ==================== SOCIAL SKILLS ====================

@api_router.post("/social-skills")
async def save_social_skills(entry: SocialSkillsEntry, current_user: dict = Depends(require_permission("manage_grades"))):
    """Save social skills assessment for a student"""
    now = datetime.now(timezone.utc).isoformat()
    
    existing = await db.social_skills.find_one({
        "student_id": entry.student_id,
        "term": entry.term,
        "academic_year": entry.academic_year,
        "school_code": current_user["school_code"]
    })
    
    if existing:
        await db.social_skills.update_one(
            {"_id": existing["_id"]},
            {"$set": {"skills": entry.skills, "updated_at": now}}
        )
        return {"message": "Social skills updated", "id": existing["id"]}
    else:
        doc = {
            "id": str(uuid.uuid4()),
            "student_id": entry.student_id,
            "term": entry.term,
            "academic_year": entry.academic_year,
            "school_code": current_user["school_code"],
            "skills": entry.skills,
            "created_at": now,
            "updated_at": now
        }
        await db.social_skills.insert_one(doc)
        return {"message": "Social skills saved", "id": doc["id"]}

@api_router.get("/social-skills/{student_id}")
async def get_social_skills(
    student_id: str,
    term: str,
    academic_year: str,
    current_user: dict = Depends(get_current_user)
):
    """Get social skills for a student"""
    entry = await db.social_skills.find_one({
        "student_id": student_id,
        "term": term,
        "academic_year": academic_year,
        "school_code": current_user["school_code"]
    }, {"_id": 0})
    
    return entry or {"skills": {}}

# ==================== SIGNATURES (DEPRECATED - Use School Signatures Instead) ====================

@api_router.post("/signatures/upload")
async def upload_signature(
    signature_type: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(require_roles([UserRole.SUPERUSER, UserRole.ADMIN]))
):
    """DEPRECATED: Upload teacher or principal signature. Use /schools/{school_id}/signatures/upload instead"""
    if signature_type not in ["teacher", "principal"]:
        raise HTTPException(status_code=400, detail="Invalid signature type")
    
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Invalid file type")
    
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large")
    
    file_id = str(uuid.uuid4())
    filename = f"signature_{signature_type}_{file_id}{ext}"
    file_path = UPLOAD_DIR / filename
    
    with open(file_path, "wb") as f:
        f.write(content)
    
    signature_url = f"/api/uploads/{filename}"
    
    # Update signatures collection (legacy)
    await db.signatures.update_one(
        {"school_code": current_user["school_code"]},
        {"$set": {f"{signature_type}_signature": signature_url, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )
    
    # Also update school document (new way)
    field_name = f"{signature_type}_signature"
    await db.schools.update_one(
        {"school_code": current_user["school_code"]},
        {"$set": {field_name: signature_url}}
    )
    
    return {"signature_url": signature_url, "type": signature_type}

@api_router.get("/signatures")
async def get_signatures(current_user: dict = Depends(get_current_user)):
    """DEPRECATED: Get school signatures. Use /schools/{school_id}/signatures instead"""
    # Try to get from school first (new way)
    school = await db.schools.find_one(
        {"school_code": current_user["school_code"]},
        {"_id": 0}
    )
    
    if school and (school.get("principal_signature") or school.get("teacher_signature")):
        return {
            "principal_signature": school.get("principal_signature", ""),
            "teacher_signature": school.get("teacher_signature", "")
        }
    
    # Fall back to legacy collection
    signatures = await db.signatures.find_one(
        {"school_code": current_user["school_code"]},
        {"_id": 0}
    )
    return signatures or {}

# ==================== CSV IMPORT ====================

@api_router.post("/import/students")
async def import_students_csv(
    class_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(require_roles([UserRole.SUPERUSER, UserRole.ADMIN]))
):
    """Import students from CSV file"""
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="File must be a CSV")
    
    content = await file.read()
    decoded = content.decode('utf-8')
    reader = csv.DictReader(io.StringIO(decoded))
    
    imported = 0
    errors = []
    now = datetime.now(timezone.utc).isoformat()
    
    for row_num, row in enumerate(reader, start=2):
        try:
            student_doc = {
                "id": str(uuid.uuid4()),
                "student_id": row.get("student_id", ""),
                "first_name": row.get("first_name", ""),
                "middle_name": row.get("middle_name", ""),
                "last_name": row.get("last_name", ""),
                "date_of_birth": row.get("date_of_birth", ""),
                "gender": row.get("gender", ""),
                "address": row.get("address", ""),
                "house": row.get("house", ""),
                "emergency_contact": row.get("emergency_contact", ""),
                "class_id": class_id,
                "school_code": current_user["school_code"],
                "created_at": now,
                "updated_at": now
            }
            
            if not student_doc["first_name"] or not student_doc["last_name"]:
                errors.append(f"Row {row_num}: Missing first_name or last_name")
                continue
            
            await db.students.insert_one(student_doc)
            imported += 1
        except Exception as e:
            errors.append(f"Row {row_num}: {str(e)}")
    
    return {
        "imported": imported,
        "errors": errors,
        "message": f"Successfully imported {imported} students"
    }

@api_router.post("/import/teachers")
async def import_teachers_csv(
    file: UploadFile = File(...),
    current_user: dict = Depends(require_roles([UserRole.SUPERUSER, UserRole.ADMIN]))
):
    """Import teachers from CSV file"""
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="File must be a CSV")
    
    content = await file.read()
    decoded = content.decode('utf-8')
    reader = csv.DictReader(io.StringIO(decoded))
    
    imported = 0
    errors = []
    now = datetime.now(timezone.utc).isoformat()
    default_permissions = ["manage_students", "manage_classes", "manage_attendance", "manage_grades", "view_reports", "generate_reports"]
    
    for row_num, row in enumerate(reader, start=2):
        try:
            username = row.get("username", "")
            name = row.get("name", "")
            password = row.get("password", "Teacher@123")
            
            if not username or not name:
                errors.append(f"Row {row_num}: Missing username or name")
                continue
            
            # Check if username exists
            existing = await db.users.find_one({
                "username": username,
                "school_code": current_user["school_code"]
            })
            if existing:
                errors.append(f"Row {row_num}: Username '{username}' already exists")
                continue
            
            user_doc = {
                "id": str(uuid.uuid4()),
                "username": username,
                "name": name,
                "role": UserRole.TEACHER,
                "school_code": current_user["school_code"],
                "permissions": default_permissions,
                "photo_url": "",
                "password_hash": hash_password(password),
                "created_at": now
            }
            
            await db.users.insert_one(user_doc)
            imported += 1
        except Exception as e:
            errors.append(f"Row {row_num}: {str(e)}")
    
    return {
        "imported": imported,
        "errors": errors,
        "message": f"Successfully imported {imported} teachers"
    }

@api_router.get("/export/students-template")
async def get_students_csv_template():
    """Get CSV template for student import"""
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["student_id", "first_name", "middle_name", "last_name", "date_of_birth", "gender", "address", "house", "emergency_contact"])
    writer.writerow(["STU001", "John", "Michael", "Doe", "2015-05-15", "Male", "123 Main St", "Red House", "555-1234"])
    
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=students_template.csv"}
    )

@api_router.get("/export/teachers-template")
async def get_teachers_csv_template():
    """Get CSV template for teacher import"""
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["username", "name", "password"])
    writer.writerow(["john.smith@school.edu", "John Smith", "Teacher@123"])
    
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=teachers_template.csv"}
    )

# ==================== DASHBOARD STATS ====================

@api_router.get("/stats/dashboard")
async def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    stats = {}
    school_code = current_user["school_code"]
    
    if current_user["role"] in [UserRole.SUPERUSER, UserRole.ADMIN, UserRole.TEACHER]:
        stats["total_students"] = await db.students.count_documents({"school_code": school_code})
        stats["total_classes"] = await db.classes.count_documents({"school_code": school_code})
        stats["total_teachers"] = await db.users.count_documents({"school_code": school_code, "role": UserRole.TEACHER})
        
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        today_attendance = await db.attendance.find({"date": today, "school_code": school_code}, {"_id": 0}).to_list(10000)
        stats["today_present"] = len([a for a in today_attendance if a["status"] == "present"])
        stats["today_absent"] = len([a for a in today_attendance if a["status"] == "absent"])
        stats["today_late"] = len([a for a in today_attendance if a["status"] == "late"])
        
        recent_grades = await db.gradebook.find({"school_code": school_code}, {"_id": 0, "overall_score": 1}).to_list(100)
        if recent_grades:
            avg = sum(g.get("overall_score", 0) for g in recent_grades) / len(recent_grades)
            stats["average_grade"] = round(avg, 1)
        else:
            stats["average_grade"] = 0
        
        # Superuser stats
        if current_user["role"] == UserRole.SUPERUSER:
            stats["total_schools"] = await db.schools.count_documents({})
            
    elif current_user["role"] == UserRole.PARENT:
        children = await db.students.find({"parent_id": current_user["id"], "school_code": school_code}, {"_id": 0}).to_list(100)
        stats["children_count"] = len(children)
        
        child_ids = [c["id"] for c in children]
        
        month_start = datetime.now(timezone.utc).replace(day=1).strftime("%Y-%m-%d")
        attendance = await db.attendance.find({
            "student_id": {"$in": child_ids},
            "date": {"$gte": month_start},
            "school_code": school_code
        }, {"_id": 0}).to_list(1000)
        
        stats["attendance_present"] = len([a for a in attendance if a["status"] == "present"])
        stats["attendance_absent"] = len([a for a in attendance if a["status"] == "absent"])
        
        grades = await db.gradebook.find({"student_id": {"$in": child_ids}, "school_code": school_code}, {"_id": 0, "overall_score": 1}).to_list(100)
        if grades:
            avg = sum(g.get("overall_score", 0) for g in grades) / len(grades)
            stats["average_grade"] = round(avg, 1)
        else:
            stats["average_grade"] = 0
    
    return stats

# ==================== ADMISSIONS MODULE ====================
# Models for Admissions

class AdmissionBase(BaseModel):
    student_first_name: str
    student_last_name: str
    student_middle_name: Optional[str] = ""
    student_dob: Optional[str] = ""
    student_gender: Optional[str] = ""
    parent_name: str
    parent_email: str
    parent_phone: str
    grade_level: str
    status: str = "inquiry"  # inquiry, application, pending, accepted, rejected
    notes: Optional[str] = ""
    source: Optional[str] = ""  # website, walk-in, referral

class AdmissionCreate(AdmissionBase):
    pass

class AdmissionResponse(AdmissionBase):
    model_config = ConfigDict(extra="ignore")
    id: str
    school_code: str
    created_by: Optional[str] = ""
    created_at: str
    updated_at: str


def _admissions_query(current_user: dict, extra: Optional[Dict] = None) -> Dict:
    q = {"school_code": current_user["school_code"]}
    if extra:
        q.update(extra)
    return q


@api_router.get("/admissions/stats")
async def admissions_stats(current_user: dict = Depends(require_roles([UserRole.ADMIN]))):
    """GET /api/admissions/stats — counts by status. Role: superuser/admin."""
    q_base = {"school_code": current_user["school_code"]}
    total = await db.admissions.count_documents(q_base)
    inquiries = await db.admissions.count_documents({**q_base, "status": "inquiry"})
    applications = await db.admissions.count_documents({**q_base, "status": {"$in": ["application", "pending", "accepted", "rejected"]}})
    accepted = await db.admissions.count_documents({**q_base, "status": "accepted"})
    pending = await db.admissions.count_documents({**q_base, "status": "pending"})
    rejected = await db.admissions.count_documents({**q_base, "status": "rejected"})
    return {
        "total": total,
        "inquiries": inquiries,
        "applications": applications,
        "accepted": accepted,
        "pending": pending,
        "rejected": rejected,
    }


@api_router.get("/admissions/inquiries", response_model=List[AdmissionResponse])
async def list_admissions_inquiries(current_user: dict = Depends(require_roles([UserRole.ADMIN]))):
    """GET /api/admissions/inquiries — list of inquiries. Role: superuser/admin."""
    docs = await db.admissions.find(
        _admissions_query(current_user, {"status": "inquiry"}), {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    return [AdmissionResponse(**d) for d in docs]


@api_router.get("/admissions/applications", response_model=List[AdmissionResponse])
async def list_admissions_applications(current_user: dict = Depends(require_roles([UserRole.ADMIN]))):
    """GET /api/admissions/applications — list of applications. Role: superuser/admin."""
    docs = await db.admissions.find(
        _admissions_query(
            current_user,
            {"status": {"$in": ["application", "pending", "accepted", "rejected"]}},
        ),
        {"_id": 0},
    ).sort("created_at", -1).to_list(1000)
    return [AdmissionResponse(**d) for d in docs]


@api_router.get("/admissions", response_model=List[AdmissionResponse])
async def list_admissions(current_user: dict = Depends(require_roles([UserRole.ADMIN]))):
    """GET /api/admissions — full list, school-scoped. Role: superuser/admin."""
    docs = await db.admissions.find(_admissions_query(current_user), {"_id": 0}).sort("created_at", -1).to_list(2000)
    return [AdmissionResponse(**d) for d in docs]


@api_router.get("/admissions/{admission_id}", response_model=AdmissionResponse)
async def get_admission(admission_id: str, current_user: dict = Depends(require_roles([UserRole.ADMIN]))):
    """GET /api/admissions/{id} — fetch one (school-scoped). Role: superuser/admin. 404 if not in school."""
    doc = await db.admissions.find_one(
        {"id": admission_id, "school_code": current_user["school_code"]}, {"_id": 0}
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Admission record not found")
    return AdmissionResponse(**doc)


@api_router.post("/admissions", response_model=AdmissionResponse)
async def create_admission(
    payload: AdmissionCreate, current_user: dict = Depends(require_roles([UserRole.ADMIN]))
):
    """POST /api/admissions — create an inquiry/application. Role: superuser/admin."""
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": str(uuid.uuid4()),
        "school_code": current_user["school_code"],
        "created_by": current_user["id"],
        **payload.model_dump(),
        "created_at": now,
        "updated_at": now,
    }
    await db.admissions.insert_one(doc)
    doc.pop("_id", None)
    return AdmissionResponse(**doc)


@api_router.put("/admissions/{admission_id}", response_model=AdmissionResponse)
async def update_admission(
    admission_id: str,
    payload: AdmissionCreate,
    current_user: dict = Depends(require_roles([UserRole.ADMIN])),
):
    """PUT /api/admissions/{id} — update record. Role: superuser/admin. 404 outside tenant."""
    query = {"id": admission_id, "school_code": current_user["school_code"]}
    existing = await db.admissions.find_one(query, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Admission record not found")
    now = datetime.now(timezone.utc).isoformat()
    update = {**payload.model_dump(), "updated_at": now}
    await db.admissions.update_one(query, {"$set": update})
    updated = await db.admissions.find_one(query, {"_id": 0})
    return AdmissionResponse(**updated)


@api_router.delete("/admissions/{admission_id}")
async def delete_admission(
    admission_id: str, current_user: dict = Depends(require_roles([UserRole.ADMIN]))
):
    """DELETE /api/admissions/{id} — delete record. Role: superuser/admin."""
    query = {"id": admission_id, "school_code": current_user["school_code"]}
    result = await db.admissions.delete_one(query)
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Admission record not found")
    return {"message": "Admission record deleted"}


# ==================== HEALTH RECORDS MODULE ====================
# Models for Health

class HealthVaccination(BaseModel):
    name: str
    date: str
    dose: Optional[str] = ""
    notes: Optional[str] = ""

class HealthAllergy(BaseModel):
    allergen: str
    reaction: str
    severity: Optional[str] = ""  # Mild/Moderate/Severe
    notes: Optional[str] = ""

class HealthCondition(BaseModel):
    name: str
    diagnosis_date: Optional[str] = ""
    notes: Optional[str] = ""

class HealthMedication(BaseModel):
    name: str
    dosage: Optional[str] = ""
    frequency: Optional[str] = ""
    start_date: Optional[str] = ""
    end_date: Optional[str] = ""
    notes: Optional[str] = ""

class HealthVisit(BaseModel):
    date: str
    reason: str
    notes: Optional[str] = ""
    handled_by: Optional[str] = ""

class HealthRecordResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    student_id: str
    school_code: str
    vaccinations: List[Dict] = []
    allergies: List[Dict] = []
    conditions: List[Dict] = []
    medications: List[Dict] = []
    visits: List[Dict] = []
    created_at: str
    updated_at: str


HEALTH_LIST_KEYS = {
    "vaccination": "vaccinations",
    "allergy": "allergies",
    "condition": "conditions",
    "medication": "medications",
    "visit": "visits",
}

HEALTH_ROLES = [UserRole.ADMIN, UserRole.TEACHER]


async def _ensure_student_in_school(student_id: str, school_code: str) -> dict:
    student = await db.students.find_one({"id": student_id, "school_code": school_code}, {"_id": 0})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found in this school")
    return student


async def _ensure_teacher_can_access_student(student_id: str, current_user: dict) -> dict:
    """Same as _ensure_student_in_school but additionally enforces that, for teachers,
    the student belongs to one of their classes. Admins/superusers bypass the class check."""
    student = await _ensure_student_in_school(student_id, current_user["school_code"])
    if current_user["role"] == UserRole.TEACHER:
        teacher_class_ids = await get_teacher_class_ids(current_user)
        if student.get("class_id") not in teacher_class_ids:
            raise HTTPException(status_code=403, detail="Student is not in your class")
    return student


async def _get_or_create_health_record(student_id: str, school_code: str) -> dict:
    rec = await db.health_records.find_one({"student_id": student_id, "school_code": school_code}, {"_id": 0})
    if rec:
        return rec
    now = datetime.now(timezone.utc).isoformat()
    rec = {
        "id": str(uuid.uuid4()),
        "student_id": student_id,
        "school_code": school_code,
        "vaccinations": [],
        "allergies": [],
        "conditions": [],
        "medications": [],
        "visits": [],
        "created_at": now,
        "updated_at": now,
    }
    await db.health_records.insert_one(dict(rec))
    return rec


@api_router.get("/health/stats")
async def health_stats(current_user: dict = Depends(require_roles(HEALTH_ROLES))):
    """GET /api/health/stats — aggregated counts for school. Role: admin/teacher."""
    school_code = current_user["school_code"]
    pipeline = [
        {"$match": {"school_code": school_code}},
        {"$project": {
            "_id": 0,
            "vac": {"$size": {"$ifNull": ["$vaccinations", []]}},
            "alg": {"$size": {"$ifNull": ["$allergies", []]}},
            "cnd": {"$size": {"$ifNull": ["$conditions", []]}},
            "med": {"$size": {"$ifNull": ["$medications", []]}},
            "vis": {"$size": {"$ifNull": ["$visits", []]}},
        }},
        {"$group": {
            "_id": None,
            "vaccinations": {"$sum": "$vac"},
            "allergies": {"$sum": "$alg"},
            "conditions": {"$sum": "$cnd"},
            "medications": {"$sum": "$med"},
            "visits": {"$sum": "$vis"},
            "records": {"$sum": 1},
        }}
    ]
    cur = db.health_records.aggregate(pipeline)
    result = await cur.to_list(1)
    if not result:
        return {"records": 0, "vaccinations": 0, "allergies": 0, "conditions": 0, "medications": 0, "visits": 0}
    r = result[0]
    r.pop("_id", None)
    return r


@api_router.get("/health/{student_id}", response_model=HealthRecordResponse)
async def get_health_record(
    student_id: str, current_user: dict = Depends(require_roles(HEALTH_ROLES))
):
    """GET /api/health/{student_id} — fetch (creates empty record if missing). Role: admin/teacher.
    Teachers may only access students assigned to their classes."""
    await _ensure_teacher_can_access_student(student_id, current_user)
    rec = await _get_or_create_health_record(student_id, current_user["school_code"])
    rec.pop("_id", None)
    return HealthRecordResponse(**rec)


async def _append_health_entry(student_id: str, school_code: str, list_key: str, entry: dict) -> dict:
    """Append one entry to a list within the student's health record."""
    await _get_or_create_health_record(student_id, school_code)
    entry = {"id": str(uuid.uuid4()), **entry}
    now = datetime.now(timezone.utc).isoformat()
    await db.health_records.update_one(
        {"student_id": student_id, "school_code": school_code},
        {"$push": {list_key: entry}, "$set": {"updated_at": now}},
    )
    updated = await db.health_records.find_one(
        {"student_id": student_id, "school_code": school_code}, {"_id": 0}
    )
    return updated


@api_router.post("/health/{student_id}/vaccination", response_model=HealthRecordResponse)
async def add_vaccination(
    student_id: str,
    payload: HealthVaccination,
    current_user: dict = Depends(require_roles(HEALTH_ROLES)),
):
    """POST /api/health/{student_id}/vaccination — append a vaccination. Role: admin/teacher.
    Teachers may only modify records for students in their classes."""
    await _ensure_teacher_can_access_student(student_id, current_user)
    updated = await _append_health_entry(
        student_id, current_user["school_code"], "vaccinations", payload.model_dump()
    )
    return HealthRecordResponse(**updated)


@api_router.post("/health/{student_id}/allergy", response_model=HealthRecordResponse)
async def add_allergy(
    student_id: str,
    payload: HealthAllergy,
    current_user: dict = Depends(require_roles(HEALTH_ROLES)),
):
    """POST /api/health/{student_id}/allergy — append an allergy. Role: admin/teacher."""
    await _ensure_teacher_can_access_student(student_id, current_user)
    updated = await _append_health_entry(
        student_id, current_user["school_code"], "allergies", payload.model_dump()
    )
    return HealthRecordResponse(**updated)


@api_router.post("/health/{student_id}/condition", response_model=HealthRecordResponse)
async def add_condition(
    student_id: str,
    payload: HealthCondition,
    current_user: dict = Depends(require_roles(HEALTH_ROLES)),
):
    """POST /api/health/{student_id}/condition — append a condition. Role: admin/teacher."""
    await _ensure_teacher_can_access_student(student_id, current_user)
    updated = await _append_health_entry(
        student_id, current_user["school_code"], "conditions", payload.model_dump()
    )
    return HealthRecordResponse(**updated)


@api_router.post("/health/{student_id}/medication", response_model=HealthRecordResponse)
async def add_medication(
    student_id: str,
    payload: HealthMedication,
    current_user: dict = Depends(require_roles(HEALTH_ROLES)),
):
    """POST /api/health/{student_id}/medication — append a medication. Role: admin/teacher."""
    await _ensure_teacher_can_access_student(student_id, current_user)
    updated = await _append_health_entry(
        student_id, current_user["school_code"], "medications", payload.model_dump()
    )
    return HealthRecordResponse(**updated)


@api_router.post("/health/{student_id}/visit", response_model=HealthRecordResponse)
async def add_visit(
    student_id: str,
    payload: HealthVisit,
    current_user: dict = Depends(require_roles(HEALTH_ROLES)),
):
    """POST /api/health/{student_id}/visit — append a clinic visit. Role: admin/teacher."""
    await _ensure_teacher_can_access_student(student_id, current_user)
    updated = await _append_health_entry(
        student_id, current_user["school_code"], "visits", payload.model_dump()
    )
    return HealthRecordResponse(**updated)


@api_router.delete("/health/{student_id}/{entry_type}/{entry_id}")
async def delete_health_entry(
    student_id: str,
    entry_type: str,
    entry_id: str,
    current_user: dict = Depends(require_roles(HEALTH_ROLES)),
):
    """DELETE /api/health/{student_id}/{entry_type}/{entry_id} — remove a single entry. Role: admin/teacher."""
    list_key = HEALTH_LIST_KEYS.get(entry_type)
    if not list_key:
        raise HTTPException(status_code=400, detail="Invalid entry type")
    await _ensure_teacher_can_access_student(student_id, current_user)
    now = datetime.now(timezone.utc).isoformat()
    result = await db.health_records.update_one(
        {"student_id": student_id, "school_code": current_user["school_code"]},
        {"$pull": {list_key: {"id": entry_id}}, "$set": {"updated_at": now}},
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Entry not found")
    return {"message": "Entry deleted"}


# ==================== DISCIPLINE MODULE ====================
# Models for Discipline

class DisciplineBase(BaseModel):
    student_id: str
    date: str
    type: str = "Minor"  # Minor, Moderate, Major
    description: str
    action_taken: Optional[str] = ""
    status: str = "Open"  # Open, In Progress, Resolved
    follow_up: Optional[str] = ""
    reported_by_name: Optional[str] = ""

class DisciplineCreate(DisciplineBase):
    pass

class DisciplineResponse(DisciplineBase):
    model_config = ConfigDict(extra="ignore")
    id: str
    school_code: str
    reported_by: str
    created_at: str
    updated_at: str


DISCIPLINE_ROLES = [UserRole.ADMIN, UserRole.TEACHER]


@api_router.get("/discipline/stats")
async def discipline_stats(current_user: dict = Depends(require_roles(DISCIPLINE_ROLES))):
    """GET /api/discipline/stats — counts by status/type. Role: admin/teacher."""
    school_code = current_user["school_code"]
    q = {"school_code": school_code}
    total = await db.discipline_incidents.count_documents(q)
    open_count = await db.discipline_incidents.count_documents({**q, "status": "Open"})
    in_progress = await db.discipline_incidents.count_documents({**q, "status": "In Progress"})
    resolved = await db.discipline_incidents.count_documents({**q, "status": "Resolved"})
    minor = await db.discipline_incidents.count_documents({**q, "type": "Minor"})
    moderate = await db.discipline_incidents.count_documents({**q, "type": "Moderate"})
    major = await db.discipline_incidents.count_documents({**q, "type": "Major"})
    return {
        "total": total,
        "open": open_count,
        "in_progress": in_progress,
        "resolved": resolved,
        "minor": minor,
        "moderate": moderate,
        "major": major,
    }


@api_router.get("/discipline", response_model=List[DisciplineResponse])
async def list_discipline(current_user: dict = Depends(require_roles(DISCIPLINE_ROLES))):
    """GET /api/discipline — list incidents (school-scoped). Role: admin/teacher.
    Teachers only see incidents they reported or that involve students in their classes."""
    q = {"school_code": current_user["school_code"]}
    if current_user["role"] == UserRole.TEACHER:
        student_ids = await get_teacher_student_ids(current_user)
        q["$or"] = [{"reported_by": current_user["id"]}, {"student_id": {"$in": student_ids}}]
    docs = await db.discipline_incidents.find(q, {"_id": 0}).sort("date", -1).to_list(2000)
    return [DisciplineResponse(**d) for d in docs]


@api_router.get("/discipline/{incident_id}", response_model=DisciplineResponse)
async def get_discipline(
    incident_id: str, current_user: dict = Depends(require_roles(DISCIPLINE_ROLES))
):
    """GET /api/discipline/{id} — fetch one. Role: admin/teacher.
    Teachers can only fetch incidents involving students in their classes (or that they reported)."""
    doc = await db.discipline_incidents.find_one(
        {"id": incident_id, "school_code": current_user["school_code"]}, {"_id": 0}
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Incident not found")
    if current_user["role"] == UserRole.TEACHER and doc.get("reported_by") != current_user["id"]:
        teacher_class_ids = await get_teacher_class_ids(current_user)
        student = await db.students.find_one(
            {"id": doc.get("student_id"), "school_code": current_user["school_code"]},
            {"_id": 0, "class_id": 1},
        )
        if not student or student.get("class_id") not in teacher_class_ids:
            raise HTTPException(status_code=403, detail="Incident is not in your scope")
    return DisciplineResponse(**doc)


@api_router.post("/discipline", response_model=DisciplineResponse)
async def create_discipline(
    payload: DisciplineCreate, current_user: dict = Depends(require_roles(DISCIPLINE_ROLES))
):
    """POST /api/discipline — create an incident. Role: admin/teacher.
    Validates the referenced student belongs to the same school.
    Teachers may only file incidents for students in their classes."""
    await _ensure_teacher_can_access_student(payload.student_id, current_user)
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": str(uuid.uuid4()),
        "school_code": current_user["school_code"],
        "reported_by": current_user["id"],
        **payload.model_dump(),
        "created_at": now,
        "updated_at": now,
    }
    if not doc.get("reported_by_name"):
        doc["reported_by_name"] = current_user.get("name", "")
    await db.discipline_incidents.insert_one(dict(doc))
    return DisciplineResponse(**doc)


@api_router.put("/discipline/{incident_id}", response_model=DisciplineResponse)
async def update_discipline(
    incident_id: str,
    payload: DisciplineCreate,
    current_user: dict = Depends(require_roles(DISCIPLINE_ROLES)),
):
    """PUT /api/discipline/{id} — update incident. Role: admin/teacher.
    Teachers may only update incidents for students in their classes."""
    query = {"id": incident_id, "school_code": current_user["school_code"]}
    existing = await db.discipline_incidents.find_one(query, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Incident not found")
    await _ensure_teacher_can_access_student(payload.student_id, current_user)
    now = datetime.now(timezone.utc).isoformat()
    await db.discipline_incidents.update_one(
        query, {"$set": {**payload.model_dump(), "updated_at": now}}
    )
    updated = await db.discipline_incidents.find_one(query, {"_id": 0})
    return DisciplineResponse(**updated)


@api_router.delete("/discipline/{incident_id}")
async def delete_discipline(
    incident_id: str, current_user: dict = Depends(require_roles([UserRole.ADMIN]))
):
    """DELETE /api/discipline/{id} — delete incident. Role: superuser/admin only."""
    query = {"id": incident_id, "school_code": current_user["school_code"]}
    result = await db.discipline_incidents.delete_one(query)
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Incident not found")
    return {"message": "Incident deleted"}


# ==================== RE-ENROLLMENT MODULE ====================
# Models for Re-Enrollment / Promotion

class EnrollmentExecuteStudent(BaseModel):
    student_id: str
    action: str  # promote, retain, graduate, withdraw, no_change
    target_class_id: Optional[str] = None

class EnrollmentExecuteRequest(BaseModel):
    from_year: str
    to_year: str
    students: List[EnrollmentExecuteStudent]


def _extract_grade_number(grade_level: str) -> Optional[int]:
    """Extract a numeric grade level (e.g. 'Grade 3' -> 3, '3' -> 3)."""
    if not grade_level:
        return None
    import re
    m = re.search(r"\d+", str(grade_level))
    if m:
        try:
            return int(m.group(0))
        except ValueError:
            return None
    return None


@api_router.get("/enrollment/preview")
async def enrollment_preview(
    from_year: str,
    to_year: str,
    current_user: dict = Depends(require_roles([UserRole.ADMIN])),
):
    """GET /api/enrollment/preview?from_year=&to_year= — returns a list of students
    with their current class and a suggested target class for to_year.
    Role: superuser/admin."""
    school_code = current_user["school_code"]
    from_classes = await db.classes.find(
        {"school_code": school_code, "academic_year": from_year}, {"_id": 0}
    ).to_list(2000)
    to_classes = await db.classes.find(
        {"school_code": school_code, "academic_year": to_year}, {"_id": 0}
    ).to_list(2000)
    from_class_map = {c["id"]: c for c in from_classes}
    if not from_class_map:
        return []
    students = await db.students.find(
        {
            "school_code": school_code,
            "class_id": {"$in": list(from_class_map.keys())},
            "$or": [
                {"enrollment_status": {"$exists": False}},
                {"enrollment_status": {"$nin": ["graduated", "withdrawn"]}},
            ],
        },
        {"_id": 0},
    ).to_list(5000)

    def _suggest(current_class: dict):
        cur_num = _extract_grade_number(current_class.get("grade_level", ""))
        if cur_num is None:
            return None, "no_change"
        next_num = cur_num + 1
        # find a to_year class with the next grade number
        for c in to_classes:
            if _extract_grade_number(c.get("grade_level", "")) == next_num:
                return c, "promote"
        # if nothing higher, assume graduate
        return None, "graduate"

    out = []
    for s in students:
        cls = from_class_map.get(s.get("class_id"))
        if not cls:
            continue
        suggest_cls, suggested_action = _suggest(cls)
        out.append({
            "student_id": s["id"],
            "student_name": f"{s.get('first_name','')} {s.get('last_name','')}".strip(),
            "student_external_id": s.get("student_id", ""),
            "current_class_id": cls["id"],
            "current_class": f"{cls.get('name','')} ({cls.get('grade_level','')})",
            "suggested_class_id": suggest_cls["id"] if suggest_cls else None,
            "suggested_class": (
                f"{suggest_cls.get('name','')} ({suggest_cls.get('grade_level','')})"
                if suggest_cls
                else None
            ),
            "target_class_id": suggest_cls["id"] if suggest_cls else None,
            "action": suggested_action,
        })
    return out


@api_router.post("/enrollment/execute")
async def enrollment_execute(
    payload: EnrollmentExecuteRequest,
    current_user: dict = Depends(require_roles([UserRole.ADMIN])),
):
    """POST /api/enrollment/execute — apply promotion actions in bulk.
    Body: { from_year, to_year, students:[{student_id, action, target_class_id}] }.
    Role: superuser/admin."""
    school_code = current_user["school_code"]
    now = datetime.now(timezone.utc).isoformat()
    counts = {"promoted": 0, "retained": 0, "graduated": 0, "withdrawn": 0, "unchanged": 0}

    for item in payload.students:
        update: Dict[str, Any] = {"updated_at": now}
        if item.action == "promote":
            if not item.target_class_id:
                continue
            target = await db.classes.find_one(
                {"id": item.target_class_id, "school_code": school_code, "academic_year": payload.to_year},
                {"_id": 0},
            )
            if not target:
                continue
            update["class_id"] = item.target_class_id
            update["enrollment_status"] = "enrolled"
            counts["promoted"] += 1
        elif item.action == "retain":
            update["enrollment_status"] = "retained"
            counts["retained"] += 1
        elif item.action == "graduate":
            update["enrollment_status"] = "graduated"
            update["class_id"] = None
            counts["graduated"] += 1
        elif item.action == "withdraw":
            update["enrollment_status"] = "withdrawn"
            update["class_id"] = None
            counts["withdrawn"] += 1
        elif item.action == "no_change":
            counts["unchanged"] += 1
            continue
        else:
            continue
        await db.students.update_one(
            {"id": item.student_id, "school_code": school_code},
            {"$set": update},
        )
    # Log the run
    await db.enrollment_runs.insert_one({
        "id": str(uuid.uuid4()),
        "school_code": school_code,
        "from_year": payload.from_year,
        "to_year": payload.to_year,
        "executed_by": current_user["id"],
        "counts": counts,
        "created_at": now,
    })
    return {
        "from_year": payload.from_year,
        "to_year": payload.to_year,
        "promoted": counts["promoted"],
        "retained": counts["retained"],
        "graduated": counts["graduated"],
        "withdrew": counts["withdrawn"],
        "unchanged": counts["unchanged"],
        # legacy alias used by frontend
        "withdrawn": counts["withdrawn"],
    }


# ==================== AUDIT LOG MODULE ====================

class AuditLogEntry(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    school_code: str
    actor_id: str
    actor_name: str
    actor_role: str
    action: str  # create, update, delete, lock, unlock, convert, login_fail, etc.
    entity_type: str  # student, gradebook, enrollment, admission, discipline, health, user, school
    entity_id: str
    entity_label: str
    details: Dict[str, Any] = {}
    created_at: str


async def write_audit(
    actor: dict,
    action: str,
    entity_type: str,
    entity_id: str,
    entity_label: str = "",
    details: Optional[Dict[str, Any]] = None,
) -> None:
    """Append an audit-log row. Best-effort: never raises (so it can't break the parent op)."""
    try:
        await db.audit_logs.insert_one({
            "id": str(uuid.uuid4()),
            "school_code": actor.get("school_code", ""),
            "actor_id": actor.get("id", ""),
            "actor_name": actor.get("name", ""),
            "actor_role": actor.get("role", ""),
            "action": action,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "entity_label": entity_label or "",
            "details": details or {},
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    except Exception as e:
        logging.getLogger(__name__).warning(f"audit-log failed: {e}")


@api_router.get("/audit-logs", response_model=List[AuditLogEntry])
async def list_audit_logs(
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    actor_id: Optional[str] = None,
    limit: int = 200,
    current_user: dict = Depends(require_roles([UserRole.ADMIN])),
):
    """GET /api/audit-logs — paginated audit trail (school-scoped). Role: superuser/admin."""
    q = {"school_code": current_user["school_code"]}
    if entity_type:
        q["entity_type"] = entity_type
    if entity_id:
        q["entity_id"] = entity_id
    if actor_id:
        q["actor_id"] = actor_id
    docs = await db.audit_logs.find(q, {"_id": 0}).sort("created_at", -1).to_list(max(1, min(limit, 1000)))
    return [AuditLogEntry(**d) for d in docs]


# ==================== PASSWORD RESET MODULE ====================
# Mock email transport: tokens are printed to the backend log.

class ForgotPasswordRequest(BaseModel):
    school_code: str
    username: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


@api_router.post("/auth/forgot-password")
async def forgot_password(req: ForgotPasswordRequest):
    """POST /api/auth/forgot-password — issue a one-time reset token. Response is the same
    whether the user exists or not (to avoid account enumeration). In dev, the token is
    logged to the backend console — wire to real SMTP in prod."""
    user = await db.users.find_one(
        {"school_code": req.school_code.upper(), "username": req.username.lower()},
        {"_id": 0, "id": 1, "name": 1, "username": 1},
    )
    if user:
        token = uuid.uuid4().hex
        now = datetime.now(timezone.utc)
        await db.password_resets.insert_one({
            "id": str(uuid.uuid4()),
            "token": token,
            "user_id": user["id"],
            "school_code": req.school_code.upper(),
            "created_at": now.isoformat(),
            "expires_at": (now + timedelta(hours=1)).isoformat(),
            "used": False,
        })
        logging.getLogger(__name__).info(
            f"[FORGOT PASSWORD] school={req.school_code} user={req.username} token={token} (valid 1h)"
        )
    # Always 200 — no enumeration
    return {"message": "If the account exists, a reset link has been generated."}


@api_router.post("/auth/reset-password")
async def reset_password(req: ResetPasswordRequest):
    """POST /api/auth/reset-password — exchange a valid token for a new password."""
    record = await db.password_resets.find_one({"token": req.token, "used": False}, {"_id": 0})
    if not record:
        raise HTTPException(status_code=400, detail="Invalid or used token")
    try:
        expires = datetime.fromisoformat(record["expires_at"])
    except (KeyError, ValueError):
        raise HTTPException(status_code=400, detail="Invalid token")
    if datetime.now(timezone.utc) > expires:
        raise HTTPException(status_code=400, detail="Token expired")
    if not req.new_password or len(req.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    new_hash = hash_password(req.new_password)
    await db.users.update_one({"id": record["user_id"]}, {"$set": {"password_hash": new_hash}})
    await db.password_resets.update_one({"token": req.token}, {"$set": {"used": True}})
    return {"message": "Password reset successful"}


# ==================== GRADEBOOK LOCK ====================

@api_router.post("/gradebook/{gradebook_id}/lock")
async def lock_gradebook(
    gradebook_id: str, current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.TEACHER]))
):
    """POST /api/gradebook/{id}/lock — lock an entry from further edits. Role: admin/teacher.
    Teachers can lock entries for their classes."""
    query = {"id": gradebook_id, "school_code": current_user["school_code"]}
    entry = await db.gradebook.find_one(query, {"_id": 0})
    if not entry:
        raise HTTPException(status_code=404, detail="Gradebook entry not found")
    if current_user["role"] == UserRole.TEACHER:
        class_ids = await get_teacher_class_ids(current_user)
        if entry.get("class_id") not in class_ids:
            raise HTTPException(status_code=403, detail="Gradebook entry is not in your class")
    now = datetime.now(timezone.utc).isoformat()
    await db.gradebook.update_one(
        query, {"$set": {"is_locked": True, "locked_at": now, "locked_by": current_user["id"]}}
    )
    await write_audit(current_user, "lock", "gradebook", gradebook_id, "")
    return {"message": "Gradebook entry locked"}


@api_router.post("/gradebook/{gradebook_id}/unlock")
async def unlock_gradebook(
    gradebook_id: str, current_user: dict = Depends(require_roles([UserRole.ADMIN]))
):
    """POST /api/gradebook/{id}/unlock — unlock an entry. Role: superuser/admin only."""
    query = {"id": gradebook_id, "school_code": current_user["school_code"]}
    result = await db.gradebook.update_one(
        query, {"$set": {"is_locked": False, "locked_at": "", "locked_by": ""}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Gradebook entry not found")
    await write_audit(current_user, "unlock", "gradebook", gradebook_id, "")
    return {"message": "Gradebook entry unlocked"}


@api_router.get("/gradebook/{class_id}/distribution")
async def gradebook_distribution(
    class_id: str,
    term: str,
    academic_year: str,
    current_user: dict = Depends(get_current_user),
):
    """GET /api/gradebook/{class_id}/distribution — count of overall grades (A/B/C/D/E/U)
    for a class+term+year. Role: any authenticated user with scope on that class."""
    if current_user["role"] == UserRole.TEACHER:
        class_ids = await get_teacher_class_ids(current_user)
        if class_id not in class_ids:
            raise HTTPException(status_code=403, detail="Class is not in your scope")
    q = {
        "school_code": current_user["school_code"],
        "class_id": class_id,
        "term": term,
        "academic_year": academic_year,
    }
    entries = await db.gradebook.find(q, {"_id": 0, "overall_grade": 1}).to_list(1000)
    buckets = {"A": 0, "B": 0, "C": 0, "D": 0, "E": 0, "U": 0}
    for e in entries:
        g = (e.get("overall_grade") or "").upper()
        # collapse +/- to letter
        letter = g[0] if g else "U"
        if letter not in buckets:
            letter = "U"
        buckets[letter] += 1
    return {"class_id": class_id, "term": term, "academic_year": academic_year, "total": len(entries), "buckets": buckets}


# ==================== REPORT CARD LOCK ====================
# Report cards are generated dynamically; we record locks in a separate collection.

class ReportCardLockResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    school_code: str
    student_id: str
    term: str
    academic_year: str
    locked: bool
    locked_at: str
    locked_by: str
    locked_by_name: str


@api_router.post("/report-cards/{student_id}/lock", response_model=ReportCardLockResponse)
async def lock_report_card(
    student_id: str,
    term: str,
    academic_year: str,
    current_user: dict = Depends(require_roles([UserRole.ADMIN])),
):
    """POST /api/report-cards/{student_id}/lock?term=&academic_year= — lock a report card.
    Role: superuser/admin."""
    await _ensure_student_in_school(student_id, current_user["school_code"])
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": str(uuid.uuid4()),
        "school_code": current_user["school_code"],
        "student_id": student_id,
        "term": term,
        "academic_year": academic_year,
        "locked": True,
        "locked_at": now,
        "locked_by": current_user["id"],
        "locked_by_name": current_user.get("name", ""),
    }
    await db.report_card_locks.update_one(
        {"school_code": doc["school_code"], "student_id": student_id, "term": term, "academic_year": academic_year},
        {"$set": doc},
        upsert=True,
    )
    await write_audit(current_user, "lock", "report_card", student_id, f"{term} {academic_year}")
    return ReportCardLockResponse(**doc)


@api_router.delete("/report-cards/{student_id}/lock")
async def unlock_report_card(
    student_id: str,
    term: str,
    academic_year: str,
    current_user: dict = Depends(require_roles([UserRole.ADMIN])),
):
    """DELETE /api/report-cards/{student_id}/lock?term=&academic_year= — unlock. Admin only."""
    result = await db.report_card_locks.delete_one(
        {
            "school_code": current_user["school_code"],
            "student_id": student_id,
            "term": term,
            "academic_year": academic_year,
        }
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="No lock found")
    await write_audit(current_user, "unlock", "report_card", student_id, f"{term} {academic_year}")
    return {"message": "Report card unlocked"}


@api_router.get("/report-cards/locks", response_model=List[ReportCardLockResponse])
async def list_report_card_locks(
    term: Optional[str] = None,
    academic_year: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    """GET /api/report-cards/locks — list current locks for a term/year."""
    q = {"school_code": current_user["school_code"]}
    if term:
        q["term"] = term
    if academic_year:
        q["academic_year"] = academic_year
    docs = await db.report_card_locks.find(q, {"_id": 0}).to_list(2000)
    return [ReportCardLockResponse(**d) for d in docs]


# ==================== ATTENDANCE SUMMARY ====================

@api_router.get("/students/{student_id}/attendance/summary")
async def attendance_summary(
    student_id: str,
    month: Optional[str] = None,  # YYYY-MM
    current_user: dict = Depends(get_current_user),
):
    """GET /api/students/{student_id}/attendance/summary?month=YYYY-MM
    Returns counts and percent-present. Parents may only query their own children;
    teachers only students in their classes."""
    student = await db.students.find_one(
        {"id": student_id, "school_code": current_user["school_code"]}, {"_id": 0}
    )
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    if current_user["role"] == UserRole.PARENT and student.get("parent_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    if current_user["role"] == UserRole.TEACHER:
        class_ids = await get_teacher_class_ids(current_user)
        if student.get("class_id") not in class_ids:
            raise HTTPException(status_code=403, detail="Student is not in your class")

    if month:
        try:
            datetime.strptime(month + "-01", "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="month must be YYYY-MM")
        date_q = {"$gte": f"{month}-01", "$lt": f"{month}-32"}
    else:
        date_q = None

    q = {"student_id": student_id, "school_code": current_user["school_code"]}
    if date_q:
        q["date"] = date_q
    rows = await db.attendance.find(q, {"_id": 0, "status": 1, "date": 1}).to_list(10000)
    present = sum(1 for r in rows if r.get("status") == "present")
    absent = sum(1 for r in rows if r.get("status") == "absent")
    late = sum(1 for r in rows if r.get("status") == "late")
    excused = sum(1 for r in rows if r.get("status") == "excused")
    total = present + absent + late + excused
    # Late counts as 0.5 present for the % calculation; excused counts as full present
    percent_present = round(((present + 0.5 * late + excused) / total) * 100, 1) if total else 0.0

    # threshold from school
    school = await db.schools.find_one({"school_code": current_user["school_code"]}, {"_id": 0, "attendance_threshold": 1})
    threshold = (school or {}).get("attendance_threshold", 85)
    return {
        "student_id": student_id,
        "month": month or "all-time",
        "present": present,
        "absent": absent,
        "late": late,
        "excused": excused,
        "total": total,
        "percent_present": percent_present,
        "threshold": threshold,
        "below_threshold": total > 0 and percent_present < threshold,
    }


# ==================== ADMISSIONS PIPELINE ====================

@api_router.post("/admissions/{admission_id}/convert", response_model=StudentResponse)
async def convert_admission_to_student(
    admission_id: str, current_user: dict = Depends(require_roles([UserRole.ADMIN]))
):
    """POST /api/admissions/{id}/convert — create a Student row from an accepted Admission.
    Marks the admission status='enrolled' and links it. Role: superuser/admin."""
    query = {"id": admission_id, "school_code": current_user["school_code"]}
    adm = await db.admissions.find_one(query, {"_id": 0})
    if not adm:
        raise HTTPException(status_code=404, detail="Admission record not found")
    if adm.get("converted_student_id"):
        existing = await db.students.find_one({"id": adm["converted_student_id"]}, {"_id": 0})
        if existing:
            existing["age"] = calculate_age(existing.get("date_of_birth", ""))
            return StudentResponse(**existing)

    now = datetime.now(timezone.utc).isoformat()
    student_id = str(uuid.uuid4())
    student_doc = {
        "id": student_id,
        "school_code": current_user["school_code"],
        "student_id": "",  # admin can fill later
        "first_name": adm.get("student_first_name", ""),
        "middle_name": adm.get("student_middle_name", ""),
        "last_name": adm.get("student_last_name", ""),
        "date_of_birth": adm.get("student_dob", ""),
        "gender": adm.get("student_gender", ""),
        "student_phone": "",
        "student_email": "",
        "address_line1": "",
        "address_line2": "",
        "city_state": "",
        "country": "",
        "house": "",
        "class_id": None,
        "emergency_contact": adm.get("parent_phone", ""),
        "teacher_comment": "",
        "photo_url": "",
        "family_members": [
            {
                "id": str(uuid.uuid4()),
                "first_name": adm.get("parent_name", ""),
                "last_name": "",
                "relationship": "Guardian",
                "email": adm.get("parent_email", ""),
                "cell_phone": adm.get("parent_phone", ""),
            }
        ],
        "address": "",
        "parent_id": None,
        "enrollment_status": "enrolled",
        "age": calculate_age(adm.get("student_dob", "")),
        "created_at": now,
        "updated_at": now,
    }
    await db.students.insert_one(dict(student_doc))
    await db.admissions.update_one(
        query, {"$set": {"status": "enrolled", "converted_student_id": student_id, "updated_at": now}}
    )
    await write_audit(
        current_user,
        "convert",
        "admission",
        admission_id,
        f"{adm.get('student_first_name','')} {adm.get('student_last_name','')}",
        {"new_student_id": student_id},
    )
    return StudentResponse(**student_doc)


# ==================== TEACHER/PARENT LISTS ====================

@api_router.get("/teachers", response_model=List[UserResponse])
async def get_teachers(current_user: dict = Depends(require_roles([UserRole.ADMIN]))):
    query = {"role": UserRole.TEACHER, "school_code": current_user["school_code"]}
    teachers = await db.users.find(query, {"_id": 0, "password_hash": 0}).to_list(1000)
    return [UserResponse(**t) for t in teachers]

@api_router.get("/parents", response_model=List[UserResponse])
async def get_parents(current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.TEACHER]))):
    query = {"role": UserRole.PARENT, "school_code": current_user["school_code"]}
    parents = await db.users.find(query, {"_id": 0, "password_hash": 0}).to_list(1000)
    return [UserResponse(**p) for p in parents]

# ==================== HEALTH CHECK ====================

@api_router.get("/")
async def root():
    return {"message": "Lumina-SIS API", "status": "healthy"}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy"}

# Include the router
app.include_router(api_router)

# Root-level health endpoint for Kubernetes/deployment health checks
@app.get("/health")
async def root_health_check():
    return {"status": "healthy"}

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
