# Student Management System - PRD

## Original Problem Statement
Build a student management system for a primary school with:
- Student registration with first/middle/last name, DOB (system calculates age), address, house, class
- Teacher can add students and enter grades
- Only admin can create users
- Gradebook with multiple subjects and grading scheme (A+ to U)
- Generate final report cards for entire class of 25 students

## User Personas
1. **Administrator**: Full system access - manage users, students, classes
2. **Teacher**: Add/edit students, mark attendance, enter grades, generate report cards
3. **Parent**: View-only access for their children's profiles, attendance, and grades

## Core Requirements (Static)
- [x] User authentication with JWT
- [x] Role-based access control (Admin creates users only)
- [x] Student CRUD with full name fields and age calculation
- [x] House system (Red, Blue, Green, Yellow)
- [x] Class/Grade management
- [x] Attendance tracking
- [x] Gradebook with 10 subjects and subject comments
- [x] Grading scheme: A+ (90-100) to U (0-39) with grade points
- [x] Report card generation for entire class with positions

## What's Been Implemented (January 2026)

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
- /api/auth/* - Authentication
- /api/users - User management (admin only)
- /api/students - Student CRUD with age calculation
- /api/classes - Class management
- /api/attendance - Attendance tracking
- /api/gradebook - Grade entry with subject comments
- /api/report-card/{student_id} - Individual report card
- /api/report-cards/class/{class_id} - Class report cards with positions
- /api/subjects, /api/houses, /api/grading-scheme - Reference data

### Frontend Pages
- Login/Register
- Dashboard (role-based stats)
- Students (with house, address, teacher comments)
- Classes
- Attendance
- Gradebook (enter grades with subject comments)
- Report Cards (generate for entire class, print support)
- Users (admin only)

## Prioritized Backlog

### P1 (Important) - Future
- PDF export for report cards
- Bulk student import from CSV
- Email report cards to parents
- Attendance analytics

### P2 (Nice to have)
- Dark mode
- Parent-teacher messaging
- Academic calendar
- Student photos

## Tech Stack
- Frontend: React 19, Tailwind CSS, Shadcn UI
- Backend: FastAPI, Motor (MongoDB), PyJWT, bcrypt
- Database: MongoDB
