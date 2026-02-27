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
from typing import List, Optional, Dict
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
    except:
        return 0

# Create the main app
app = FastAPI(title="Student Management System API")

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

class SchoolBase(BaseModel):
    school_code: str
    name: str
    address: Optional[str] = ""
    phone: Optional[str] = ""
    email: Optional[str] = ""
    logo_url: Optional[str] = ""
    is_active: bool = True

class SchoolCreate(SchoolBase):
    pass

class SchoolResponse(SchoolBase):
    model_config = ConfigDict(extra="ignore")
    id: str
    created_at: str

class UserBase(BaseModel):
    username: str
    name: str
    role: str
    school_code: str
    permissions: List[str] = []
    photo_url: Optional[str] = ""

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
    created_at: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class RoleUpdate(BaseModel):
    role: str
    permissions: Optional[List[str]] = None

class StudentBase(BaseModel):
    student_id: Optional[str] = ""  # School-assigned student ID
    first_name: str
    middle_name: Optional[str] = ""
    last_name: str
    date_of_birth: str
    gender: str
    address: Optional[str] = ""
    house: Optional[str] = ""
    class_id: Optional[str] = None
    parent_id: Optional[str] = None
    emergency_contact: Optional[str] = ""
    teacher_comment: Optional[str] = ""
    photo_url: Optional[str] = ""  # Student photo URL

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

class ReportTemplateGrade(BaseModel):
    min: int
    max: int
    grade: str
    description: str = ""

class ReportTemplateAchievement(BaseModel):
    min: int
    max: int
    band: str
    description: str = ""

class ReportTemplateSocialCategory(BaseModel):
    category_name: str
    skills: List[str]

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
    skill_ratings: List[str] = ["Excellent", "Good", "Satisfactory", "Needs Improvement"]
    achievement_standards: List[ReportTemplateAchievement] = []
    paper_size: str = "legal"
    # WYSIWYG builder fields
    blocks: Optional[List[Dict]] = None
    theme: Optional[Dict] = None

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
async def get_schools(current_user: dict = Depends(require_superuser())):
    schools = await db.schools.find({}, {"_id": 0}).to_list(1000)
    return [SchoolResponse(**s) for s in schools]

@api_router.get("/schools/{school_id}", response_model=SchoolResponse)
async def get_school(school_id: str, current_user: dict = Depends(require_superuser())):
    school = await db.schools.find_one({"id": school_id}, {"_id": 0})
    if not school:
        raise HTTPException(status_code=404, detail="School not found")
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

# ==================== REPORT TEMPLATES (Superuser Only) ====================

@api_router.get("/report-templates/{school_code}")
async def get_report_template(school_code: str, current_user: dict = Depends(get_current_user)):
    """Get report template for a school. Any authenticated user can read their school's template."""
    template = await db.report_templates.find_one(
        {"school_code": school_code.upper()}, {"_id": 0}
    )
    if not template:
        # Auto-create default if missing
        school = await db.schools.find_one({"school_code": school_code.upper()}, {"_id": 0})
        if not school:
            raise HTTPException(status_code=404, detail="School not found")
        template = build_default_template(school_code.upper(), school.get("name", school_code))
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
    doc = {
        "id": student_id,
        "school_code": current_user["school_code"],
        **student.model_dump(),
        "age": age,
        "created_at": now,
        "updated_at": now
    }
    await db.students.insert_one(doc)
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
    update_data = {**student.model_dump(), "age": age, "updated_at": now}
    
    await db.students.update_one(query, {"$set": update_data})
    updated = await db.students.find_one(query, {"_id": 0})
    updated["age"] = age
    return StudentResponse(**updated)

@api_router.delete("/students/{student_id}")
async def delete_student(student_id: str, current_user: dict = Depends(require_permission("manage_students"))):
    query = {"id": student_id, "school_code": current_user["school_code"]}
    result = await db.students.delete_one(query)
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Student not found")
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
    
    report_cards.sort(key=lambda x: x["grades"].get("overall_score", 0) if x["grades"] else 0, reverse=True)
    
    for idx, card in enumerate(report_cards):
        card["position"] = idx + 1
    
    # Get school signatures
    signatures = await db.signatures.find_one({
        "school_code": current_user["school_code"]
    }, {"_id": 0})
    
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

# ==================== SIGNATURES ====================

@api_router.post("/signatures/upload")
async def upload_signature(
    signature_type: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(require_roles([UserRole.SUPERUSER, UserRole.ADMIN]))
):
    """Upload teacher or principal signature"""
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
    
    # Update signatures collection
    await db.signatures.update_one(
        {"school_code": current_user["school_code"]},
        {"$set": {f"{signature_type}_signature": signature_url, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )
    
    return {"signature_url": signature_url, "type": signature_type}

@api_router.get("/signatures")
async def get_signatures(current_user: dict = Depends(get_current_user)):
    """Get school signatures"""
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
    return {"message": "Student Management System API", "status": "healthy"}

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
