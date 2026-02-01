# Student Management System - PRD

## Original Problem Statement
Build a multi-tenant student management system for primary schools with:
- Student registration with first/middle/last name, DOB (system calculates age), address, house, class
- Teacher can add students and enter grades
- Only admin can create users
- Gradebook with multiple subjects and grading scheme (A+ to U)
- Generate final report cards for entire class
- **Multi-tenancy:** Support multiple schools with data segregation by school_code
- **Superuser:** Administrative role with access to all schools

## User Personas
1. **Superuser**: Platform administrator - manage schools, can access any school context
2. **Administrator**: School-level admin - manage users, students, classes within their school
3. **Teacher**: Add/edit students, mark attendance, enter grades, generate report cards
4. **Parent**: View-only access for their children's profiles, attendance, and grades

## Core Requirements
- [x] User authentication with JWT
- [x] Multi-tenant architecture with school_code segregation
- [x] Superuser can login to ANY school context for support
- [x] Role-based access control (Admin creates users only)
- [x] Student CRUD with full name fields and age calculation
- [x] House system (Red, Blue, Green, Yellow)
- [x] Class/Grade management
- [x] Attendance tracking
- [x] Gradebook with 10 subjects and subject comments
- [x] Grading scheme: A+ (90-100) to U (0-39) with grade points
- [x] Report card generation for entire class with positions

## What's Been Implemented (December 2025)

### Multi-Tenancy Architecture
- Schools identified by unique school_code at login
- All data (students, classes, users, grades, attendance) segregated by school_code
- JWT tokens store school_code for session context
- Superuser can authenticate against any active school
- Users filtered by school - admins only see their school's users

### Student Management
- Student ID field for school-assigned identification
- Photo URL field for student photos
- Search by name or student ID
- Auto-calculated age from date of birth

### Key Credentials
- **Superuser:** school_code=JTECH, username=jtech.innovations@outlook.com, password=Xekleidoma@1
- **Test Admin:** school_code=WPS, username=admin@wps.edu, password=WpsAdmin@123

### Grading Scheme
| Grade | Score Range | Domain | Points |
|-------|-------------|--------|--------|
| A+ | 90-100 | Expert performance | 4.0 |
| A | 85-89 | Highly Proficient | 3.8 |
| A- | 80-84 | Proficient | 3.7 |
| B | 75-79 | Satisfactory | 3.5 |
| B- | 70-74 | Developing | 3.3 |
| C | 65-69 | Passing | 3.2 |
| C- | 60-64 | Passing | 2.8 |
| D | 55-59 | Marginal | 2.6 |
| D- | 50-54 | Below Average | 2.4 |
| E | 40-49 | Frustration | 1.0 |
| U | 0-39 | No participation | 0 |

### Subjects
English Language, Mathematics, Science, Social Studies, Religious Education, Physical Education, Creative Arts, Music, ICT, French

### Houses
Red House, Blue House, Green House, Yellow House

### Backend Endpoints
- /api/auth/* - Authentication (login with school_code)
- /api/schools - School CRUD (superuser only)
- /api/users - User management (admin only)
- /api/students - Student CRUD with age calculation
- /api/classes - Class management
- /api/attendance - Attendance tracking
- /api/gradebook - Grade entry with subject comments
- /api/report-card/{student_id} - Individual report card
- /api/report-cards/class/{class_id} - Class report cards with positions
- /api/subjects, /api/houses, /api/grading-scheme - Reference data
- /api/stats/dashboard - Role-based statistics

### Frontend Pages
- Login (with school code field)
- Dashboard (role-based stats)
- Schools (superuser only)
- Students (with house, address, teacher comments)
- Classes
- Attendance
- Gradebook (enter grades with subject comments)
- Report Cards (generate for entire class, print support)
- Users (admin only)

## Prioritized Backlog

### P1 (Important) - Upcoming
- [ ] PDF export for report cards
- [ ] Bulk student/teacher import from CSV
- [ ] Email report cards to parents

### P2 (Nice to have)
- [ ] Attendance analytics
- [ ] Dark mode
- [ ] Parent-teacher messaging
- [ ] Academic calendar
- [ ] Student photos

## Tech Stack
- Frontend: React 19, Tailwind CSS, Shadcn UI
- Backend: FastAPI, Motor (MongoDB), PyJWT, bcrypt
- Database: MongoDB
