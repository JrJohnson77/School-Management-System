from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import StreamingResponse
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

ROOT_DIR = Path(__file__).parent
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
    ADMIN = "admin"
    TEACHER = "teacher"
    PARENT = "parent"

class UserBase(BaseModel):
    email: EmailStr
    name: str
    role: str

class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    email: str
    name: str
    role: str
    created_at: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class RoleUpdate(BaseModel):
    role: str

class StudentBase(BaseModel):
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

class StudentCreate(StudentBase):
    pass

class StudentResponse(StudentBase):
    model_config = ConfigDict(extra="ignore")
    id: str
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

class ReportCardData(BaseModel):
    student: dict
    grades: dict
    attendance_summary: dict
    class_info: dict
    term: str
    academic_year: str

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
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

def require_roles(allowed_roles: List[str]):
    async def role_checker(current_user: dict = Depends(get_current_user)):
        if current_user["role"] not in allowed_roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return current_user
    return role_checker

# ==================== AUTH ROUTES ====================

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserCreate):
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    user_doc = {
        "id": user_id,
        "email": user_data.email,
        "name": user_data.name,
        "role": user_data.role,
        "password_hash": hash_password(user_data.password),
        "created_at": now
    }
    await db.users.insert_one(user_doc)
    
    token = create_access_token({"sub": user_id, "role": user_data.role})
    
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user_id,
            email=user_data.email,
            name=user_data.name,
            role=user_data.role,
            created_at=now
        )
    )

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user or not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_access_token({"sub": user["id"], "role": user["role"]})
    
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user["id"],
            email=user["email"],
            name=user["name"],
            role=user["role"],
            created_at=user["created_at"]
        )
    )

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(**current_user)

# ==================== USER ROUTES (Admin Only) ====================

@api_router.get("/users", response_model=List[UserResponse])
async def get_users(current_user: dict = Depends(require_roles([UserRole.ADMIN]))):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
    return [UserResponse(**u) for u in users]

@api_router.post("/users", response_model=UserResponse)
async def create_user(user_data: UserCreate, current_user: dict = Depends(require_roles([UserRole.ADMIN]))):
    """Only admin can create new users"""
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    user_doc = {
        "id": user_id,
        "email": user_data.email,
        "name": user_data.name,
        "role": user_data.role,
        "password_hash": hash_password(user_data.password),
        "created_at": now
    }
    await db.users.insert_one(user_doc)
    
    return UserResponse(
        id=user_id,
        email=user_data.email,
        name=user_data.name,
        role=user_data.role,
        created_at=now
    )

@api_router.put("/users/{user_id}/role")
async def update_user_role(user_id: str, role_data: RoleUpdate, current_user: dict = Depends(require_roles([UserRole.ADMIN]))):
    if role_data.role not in [UserRole.ADMIN, UserRole.TEACHER, UserRole.PARENT]:
        raise HTTPException(status_code=400, detail="Invalid role")
    
    result = await db.users.update_one({"id": user_id}, {"$set": {"role": role_data.role}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "Role updated successfully"}

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user: dict = Depends(require_roles([UserRole.ADMIN]))):
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User deleted successfully"}

# ==================== STUDENT ROUTES ====================

@api_router.post("/students", response_model=StudentResponse)
async def create_student(student: StudentCreate, current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.TEACHER]))):
    student_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    age = calculate_age(student.date_of_birth)
    doc = {
        "id": student_id,
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
    query = {}
    if class_id:
        query["class_id"] = class_id
    
    if current_user["role"] == UserRole.PARENT:
        query["parent_id"] = current_user["id"]
    
    students = await db.students.find(query, {"_id": 0}).to_list(1000)
    
    # Calculate age for each student
    for s in students:
        s["age"] = calculate_age(s.get("date_of_birth", ""))
    
    return [StudentResponse(**s) for s in students]

@api_router.get("/students/{student_id}", response_model=StudentResponse)
async def get_student(student_id: str, current_user: dict = Depends(get_current_user)):
    student = await db.students.find_one({"id": student_id}, {"_id": 0})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    if current_user["role"] == UserRole.PARENT and student.get("parent_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    student["age"] = calculate_age(student.get("date_of_birth", ""))
    return StudentResponse(**student)

@api_router.put("/students/{student_id}", response_model=StudentResponse)
async def update_student(student_id: str, student: StudentCreate, current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.TEACHER]))):
    now = datetime.now(timezone.utc).isoformat()
    age = calculate_age(student.date_of_birth)
    update_data = {**student.model_dump(), "age": age, "updated_at": now}
    
    result = await db.students.update_one({"id": student_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Student not found")
    
    updated = await db.students.find_one({"id": student_id}, {"_id": 0})
    updated["age"] = age
    return StudentResponse(**updated)

@api_router.delete("/students/{student_id}")
async def delete_student(student_id: str, current_user: dict = Depends(require_roles([UserRole.ADMIN]))):
    result = await db.students.delete_one({"id": student_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Student not found")
    return {"message": "Student deleted successfully"}

# ==================== CLASS ROUTES ====================

@api_router.post("/classes", response_model=ClassResponse)
async def create_class(class_data: ClassCreate, current_user: dict = Depends(require_roles([UserRole.ADMIN]))):
    class_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": class_id,
        **class_data.model_dump(),
        "created_at": now
    }
    await db.classes.insert_one(doc)
    return ClassResponse(**doc)

@api_router.get("/classes", response_model=List[ClassResponse])
async def get_classes(current_user: dict = Depends(get_current_user)):
    query = {}
    if current_user["role"] == UserRole.TEACHER:
        query["teacher_id"] = current_user["id"]
    
    classes = await db.classes.find(query, {"_id": 0}).to_list(1000)
    return [ClassResponse(**c) for c in classes]

@api_router.get("/classes/{class_id}", response_model=ClassResponse)
async def get_class(class_id: str, current_user: dict = Depends(get_current_user)):
    cls = await db.classes.find_one({"id": class_id}, {"_id": 0})
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")
    return ClassResponse(**cls)

@api_router.put("/classes/{class_id}", response_model=ClassResponse)
async def update_class(class_id: str, class_data: ClassCreate, current_user: dict = Depends(require_roles([UserRole.ADMIN]))):
    result = await db.classes.update_one({"id": class_id}, {"$set": class_data.model_dump()})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Class not found")
    
    updated = await db.classes.find_one({"id": class_id}, {"_id": 0})
    return ClassResponse(**updated)

@api_router.delete("/classes/{class_id}")
async def delete_class(class_id: str, current_user: dict = Depends(require_roles([UserRole.ADMIN]))):
    result = await db.classes.delete_one({"id": class_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Class not found")
    return {"message": "Class deleted successfully"}

# ==================== ATTENDANCE ROUTES ====================

@api_router.post("/attendance", response_model=AttendanceResponse)
async def mark_attendance(attendance: AttendanceCreate, current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.TEACHER]))):
    existing = await db.attendance.find_one({
        "student_id": attendance.student_id,
        "date": attendance.date
    })
    
    attendance_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": attendance_id,
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
async def mark_bulk_attendance(data: AttendanceBulkCreate, current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.TEACHER]))):
    now = datetime.now(timezone.utc).isoformat()
    created_count = 0
    updated_count = 0
    
    for record in data.records:
        existing = await db.attendance.find_one({
            "student_id": record["student_id"],
            "date": data.date
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
    query = {}
    if student_id:
        query["student_id"] = student_id
    if class_id:
        query["class_id"] = class_id
    if date:
        query["date"] = date
    if start_date and end_date:
        query["date"] = {"$gte": start_date, "$lte": end_date}
    
    if current_user["role"] == UserRole.PARENT:
        children = await db.students.find({"parent_id": current_user["id"]}, {"_id": 0, "id": 1}).to_list(100)
        child_ids = [c["id"] for c in children]
        query["student_id"] = {"$in": child_ids}
    
    attendance = await db.attendance.find(query, {"_id": 0}).to_list(10000)
    return [AttendanceResponse(**a) for a in attendance]

# ==================== GRADEBOOK ROUTES ====================

@api_router.post("/gradebook", response_model=GradebookResponse)
async def save_gradebook(entry: GradebookEntry, current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.TEACHER]))):
    """Save or update gradebook entry for a student"""
    
    # Calculate grades for each subject
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
    
    # Calculate overall
    overall_score = total_score / len(entry.subjects) if entry.subjects else 0
    overall_info = get_grade_info(overall_score)
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Check if entry exists
    existing = await db.gradebook.find_one({
        "student_id": entry.student_id,
        "term": entry.term,
        "academic_year": entry.academic_year
    })
    
    doc = {
        "student_id": entry.student_id,
        "class_id": entry.class_id,
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
    query = {}
    if student_id:
        query["student_id"] = student_id
    if class_id:
        query["class_id"] = class_id
    if term:
        query["term"] = term
    if academic_year:
        query["academic_year"] = academic_year
    
    if current_user["role"] == UserRole.PARENT:
        children = await db.students.find({"parent_id": current_user["id"]}, {"_id": 0, "id": 1}).to_list(100)
        child_ids = [c["id"] for c in children]
        query["student_id"] = {"$in": child_ids}
    
    entries = await db.gradebook.find(query, {"_id": 0}).to_list(1000)
    return [GradebookResponse(**e) for e in entries]

@api_router.get("/gradebook/{gradebook_id}", response_model=GradebookResponse)
async def get_gradebook_entry(gradebook_id: str, current_user: dict = Depends(get_current_user)):
    entry = await db.gradebook.find_one({"id": gradebook_id}, {"_id": 0})
    if not entry:
        raise HTTPException(status_code=404, detail="Gradebook entry not found")
    return GradebookResponse(**entry)

@api_router.delete("/gradebook/{gradebook_id}")
async def delete_gradebook(gradebook_id: str, current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.TEACHER]))):
    result = await db.gradebook.delete_one({"id": gradebook_id})
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
    """Get report card data for a single student"""
    student = await db.students.find_one({"id": student_id}, {"_id": 0})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    if current_user["role"] == UserRole.PARENT and student.get("parent_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get gradebook entry
    gradebook = await db.gradebook.find_one({
        "student_id": student_id,
        "term": term,
        "academic_year": academic_year
    }, {"_id": 0})
    
    # Get class info
    class_info = {}
    if student.get("class_id"):
        cls = await db.classes.find_one({"id": student["class_id"]}, {"_id": 0})
        if cls:
            class_info = cls
    
    # Get attendance summary
    attendance_records = await db.attendance.find({
        "student_id": student_id,
        "class_id": student.get("class_id")
    }, {"_id": 0}).to_list(1000)
    
    attendance_summary = {
        "total_days": len(attendance_records),
        "present": len([a for a in attendance_records if a["status"] == "present"]),
        "absent": len([a for a in attendance_records if a["status"] == "absent"]),
        "late": len([a for a in attendance_records if a["status"] == "late"]),
        "excused": len([a for a in attendance_records if a["status"] == "excused"])
    }
    
    # Calculate age
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
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.TEACHER]))
):
    """Get report cards for all students in a class"""
    
    # Get class info
    class_info = await db.classes.find_one({"id": class_id}, {"_id": 0})
    if not class_info:
        raise HTTPException(status_code=404, detail="Class not found")
    
    # Get all students in class
    students = await db.students.find({"class_id": class_id}, {"_id": 0}).to_list(100)
    
    report_cards = []
    for student in students:
        student["age"] = calculate_age(student.get("date_of_birth", ""))
        
        # Get gradebook
        gradebook = await db.gradebook.find_one({
            "student_id": student["id"],
            "term": term,
            "academic_year": academic_year
        }, {"_id": 0})
        
        # Get attendance
        attendance_records = await db.attendance.find({
            "student_id": student["id"],
            "class_id": class_id
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
    
    # Sort by overall score (highest first)
    report_cards.sort(key=lambda x: x["grades"].get("overall_score", 0) if x["grades"] else 0, reverse=True)
    
    # Add position/rank
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

# ==================== DASHBOARD STATS ====================

@api_router.get("/stats/dashboard")
async def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    stats = {}
    
    if current_user["role"] in [UserRole.ADMIN, UserRole.TEACHER]:
        stats["total_students"] = await db.students.count_documents({})
        stats["total_classes"] = await db.classes.count_documents({})
        stats["total_teachers"] = await db.users.count_documents({"role": UserRole.TEACHER})
        
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        today_attendance = await db.attendance.find({"date": today}, {"_id": 0}).to_list(10000)
        stats["today_present"] = len([a for a in today_attendance if a["status"] == "present"])
        stats["today_absent"] = len([a for a in today_attendance if a["status"] == "absent"])
        stats["today_late"] = len([a for a in today_attendance if a["status"] == "late"])
        
        recent_grades = await db.gradebook.find({}, {"_id": 0, "overall_score": 1}).to_list(100)
        if recent_grades:
            avg = sum(g.get("overall_score", 0) for g in recent_grades) / len(recent_grades)
            stats["average_grade"] = round(avg, 1)
        else:
            stats["average_grade"] = 0
            
    elif current_user["role"] == UserRole.PARENT:
        children = await db.students.find({"parent_id": current_user["id"]}, {"_id": 0}).to_list(100)
        stats["children_count"] = len(children)
        
        child_ids = [c["id"] for c in children]
        
        month_start = datetime.now(timezone.utc).replace(day=1).strftime("%Y-%m-%d")
        attendance = await db.attendance.find({
            "student_id": {"$in": child_ids},
            "date": {"$gte": month_start}
        }, {"_id": 0}).to_list(1000)
        
        stats["attendance_present"] = len([a for a in attendance if a["status"] == "present"])
        stats["attendance_absent"] = len([a for a in attendance if a["status"] == "absent"])
        
        grades = await db.gradebook.find({"student_id": {"$in": child_ids}}, {"_id": 0, "overall_score": 1}).to_list(100)
        if grades:
            avg = sum(g.get("overall_score", 0) for g in grades) / len(grades)
            stats["average_grade"] = round(avg, 1)
        else:
            stats["average_grade"] = 0
    
    return stats

# ==================== TEACHER/PARENT LISTS ====================

@api_router.get("/teachers", response_model=List[UserResponse])
async def get_teachers(current_user: dict = Depends(require_roles([UserRole.ADMIN]))):
    teachers = await db.users.find({"role": UserRole.TEACHER}, {"_id": 0, "password_hash": 0}).to_list(1000)
    return [UserResponse(**t) for t in teachers]

@api_router.get("/parents", response_model=List[UserResponse])
async def get_parents(current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.TEACHER]))):
    parents = await db.users.find({"role": UserRole.PARENT}, {"_id": 0, "password_hash": 0}).to_list(1000)
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
