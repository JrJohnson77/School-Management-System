from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone, timedelta, date
import jwt
import bcrypt
import io
import shutil

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
    for scheme in GRADING_SCHEME:
        if scheme["min"] <= score <= scheme["max"]:
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
    score: float
    comment: Optional[str] = ""

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
    doc = {
        "id": class_id,
        "school_code": current_user["school_code"],
        **class_data.model_dump(),
        "created_at": now
    }
    await db.classes.insert_one(doc)
    return ClassResponse(**doc)

@api_router.get("/classes", response_model=List[ClassResponse])
async def get_classes(current_user: dict = Depends(get_current_user)):
    query = {"school_code": current_user["school_code"]}
    if current_user["role"] == UserRole.TEACHER:
        query["teacher_id"] = current_user["id"]
    
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

@api_router.post("/gradebook", response_model=GradebookResponse)
async def save_gradebook(entry: GradebookEntry, current_user: dict = Depends(require_permission("manage_grades"))):
    subjects_with_grades = []
    total_score = 0
    for subj in entry.subjects:
        grade_info = get_grade_info(subj.score)
        subjects_with_grades.append({
            "subject": subj.subject,
            "score": subj.score,
            "grade": grade_info["grade"],
            "points": grade_info["points"],
            "domain": grade_info["domain"],
            "comment": subj.comment or ""
        })
        total_score += subj.score
    
    overall_score = total_score / len(entry.subjects) if entry.subjects else 0
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
        
        report_cards.append({
            "student": student,
            "grades": gradebook or {},
            "attendance_summary": attendance_summary
        })
    
    report_cards.sort(key=lambda x: x["grades"].get("overall_score", 0) if x["grades"] else 0, reverse=True)
    
    for idx, card in enumerate(report_cards):
        card["position"] = idx + 1
    
    return {
        "class_info": class_info,
        "term": term,
        "academic_year": academic_year,
        "total_students": len(students),
        "report_cards": report_cards,
        "grading_scheme": GRADING_SCHEME
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
