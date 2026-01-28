from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import jwt
from passlib.context import CryptContext

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

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

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
    role: str = UserRole.PARENT

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

class StudentBase(BaseModel):
    first_name: str
    last_name: str
    date_of_birth: str
    gender: str
    grade_level: str
    class_id: Optional[str] = None
    parent_id: Optional[str] = None
    address: Optional[str] = None
    emergency_contact: Optional[str] = None
    notes: Optional[str] = None

class StudentCreate(StudentBase):
    pass

class StudentResponse(StudentBase):
    model_config = ConfigDict(extra="ignore")
    id: str
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
    status: str  # present, absent, late, excused

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
    records: List[dict]  # [{student_id: str, status: str}]

class GradeBase(BaseModel):
    student_id: str
    class_id: str
    subject: str
    grade_type: str  # exam, quiz, assignment, homework
    score: float
    max_score: float
    date: str
    term: str
    comments: Optional[str] = None

class GradeCreate(GradeBase):
    pass

class GradeResponse(GradeBase):
    model_config = ConfigDict(extra="ignore")
    id: str
    graded_by: str
    created_at: str

# ==================== AUTH HELPERS ====================

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

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
    # Check if user exists
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
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
    
    # Generate token
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

@api_router.put("/users/{user_id}/role")
async def update_user_role(user_id: str, role: str, current_user: dict = Depends(require_roles([UserRole.ADMIN]))):
    if role not in [UserRole.ADMIN, UserRole.TEACHER, UserRole.PARENT]:
        raise HTTPException(status_code=400, detail="Invalid role")
    
    result = await db.users.update_one({"id": user_id}, {"$set": {"role": role}})
    if result.modified_count == 0:
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
    doc = {
        "id": student_id,
        **student.model_dump(),
        "created_at": now,
        "updated_at": now
    }
    await db.students.insert_one(doc)
    return StudentResponse(**doc)

@api_router.get("/students", response_model=List[StudentResponse])
async def get_students(
    class_id: Optional[str] = None,
    grade_level: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if class_id:
        query["class_id"] = class_id
    if grade_level:
        query["grade_level"] = grade_level
    
    # Parents can only see their children
    if current_user["role"] == UserRole.PARENT:
        query["parent_id"] = current_user["id"]
    
    students = await db.students.find(query, {"_id": 0}).to_list(1000)
    return [StudentResponse(**s) for s in students]

@api_router.get("/students/{student_id}", response_model=StudentResponse)
async def get_student(student_id: str, current_user: dict = Depends(get_current_user)):
    student = await db.students.find_one({"id": student_id}, {"_id": 0})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    # Parents can only view their children
    if current_user["role"] == UserRole.PARENT and student.get("parent_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return StudentResponse(**student)

@api_router.put("/students/{student_id}", response_model=StudentResponse)
async def update_student(student_id: str, student: StudentCreate, current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.TEACHER]))):
    now = datetime.now(timezone.utc).isoformat()
    update_data = {**student.model_dump(), "updated_at": now}
    
    result = await db.students.update_one({"id": student_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Student not found")
    
    updated = await db.students.find_one({"id": student_id}, {"_id": 0})
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
    # Teachers only see their classes
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
    # Check if attendance already exists for this student/date
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
        # Update existing
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
    
    # Parents can only see their children's attendance
    if current_user["role"] == UserRole.PARENT:
        children = await db.students.find({"parent_id": current_user["id"]}, {"_id": 0}).to_list(100)
        child_ids = [c["id"] for c in children]
        query["student_id"] = {"$in": child_ids}
    
    attendance = await db.attendance.find(query, {"_id": 0}).to_list(10000)
    return [AttendanceResponse(**a) for a in attendance]

# ==================== GRADE ROUTES ====================

@api_router.post("/grades", response_model=GradeResponse)
async def create_grade(grade: GradeCreate, current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.TEACHER]))):
    grade_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": grade_id,
        **grade.model_dump(),
        "graded_by": current_user["id"],
        "created_at": now
    }
    await db.grades.insert_one(doc)
    return GradeResponse(**doc)

@api_router.get("/grades", response_model=List[GradeResponse])
async def get_grades(
    student_id: Optional[str] = None,
    class_id: Optional[str] = None,
    subject: Optional[str] = None,
    term: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if student_id:
        query["student_id"] = student_id
    if class_id:
        query["class_id"] = class_id
    if subject:
        query["subject"] = subject
    if term:
        query["term"] = term
    
    # Parents can only see their children's grades
    if current_user["role"] == UserRole.PARENT:
        children = await db.students.find({"parent_id": current_user["id"]}, {"_id": 0}).to_list(100)
        child_ids = [c["id"] for c in children]
        query["student_id"] = {"$in": child_ids}
    
    grades = await db.grades.find(query, {"_id": 0}).to_list(10000)
    return [GradeResponse(**g) for g in grades]

@api_router.put("/grades/{grade_id}", response_model=GradeResponse)
async def update_grade(grade_id: str, grade: GradeCreate, current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.TEACHER]))):
    result = await db.grades.update_one({"id": grade_id}, {"$set": grade.model_dump()})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Grade not found")
    
    updated = await db.grades.find_one({"id": grade_id}, {"_id": 0})
    return GradeResponse(**updated)

@api_router.delete("/grades/{grade_id}")
async def delete_grade(grade_id: str, current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.TEACHER]))):
    result = await db.grades.delete_one({"id": grade_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Grade not found")
    return {"message": "Grade deleted successfully"}

# ==================== DASHBOARD STATS ====================

@api_router.get("/stats/dashboard")
async def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    stats = {}
    
    if current_user["role"] in [UserRole.ADMIN, UserRole.TEACHER]:
        # Get counts
        stats["total_students"] = await db.students.count_documents({})
        stats["total_classes"] = await db.classes.count_documents({})
        stats["total_teachers"] = await db.users.count_documents({"role": UserRole.TEACHER})
        
        # Today's attendance
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        today_attendance = await db.attendance.find({"date": today}, {"_id": 0}).to_list(10000)
        stats["today_present"] = len([a for a in today_attendance if a["status"] == "present"])
        stats["today_absent"] = len([a for a in today_attendance if a["status"] == "absent"])
        stats["today_late"] = len([a for a in today_attendance if a["status"] == "late"])
        
        # Recent grades average
        recent_grades = await db.grades.find({}, {"_id": 0}).sort("created_at", -1).limit(100).to_list(100)
        if recent_grades:
            avg = sum(g["score"] / g["max_score"] * 100 for g in recent_grades) / len(recent_grades)
            stats["average_grade"] = round(avg, 1)
        else:
            stats["average_grade"] = 0
            
    elif current_user["role"] == UserRole.PARENT:
        # Get children stats
        children = await db.students.find({"parent_id": current_user["id"]}, {"_id": 0}).to_list(100)
        stats["children_count"] = len(children)
        
        child_ids = [c["id"] for c in children]
        
        # Children's attendance this month
        month_start = datetime.now(timezone.utc).replace(day=1).strftime("%Y-%m-%d")
        attendance = await db.attendance.find({
            "student_id": {"$in": child_ids},
            "date": {"$gte": month_start}
        }, {"_id": 0}).to_list(1000)
        
        stats["attendance_present"] = len([a for a in attendance if a["status"] == "present"])
        stats["attendance_absent"] = len([a for a in attendance if a["status"] == "absent"])
        
        # Children's grades
        grades = await db.grades.find({"student_id": {"$in": child_ids}}, {"_id": 0}).to_list(1000)
        if grades:
            avg = sum(g["score"] / g["max_score"] * 100 for g in grades) / len(grades)
            stats["average_grade"] = round(avg, 1)
        else:
            stats["average_grade"] = 0
    
    return stats

# ==================== TEACHER LIST FOR ASSIGNMENTS ====================

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
