# Student Management System - PRD

## Original Problem Statement
Build a student management system for a primary school with:
- Student registration & profiles (name, age, grade, parent contacts)
- Class/Grade management
- Attendance tracking
- Grade/Report cards
- Multiple user roles (Admin, Teachers, Parents)
- JWT-based authentication

## User Personas
1. **Administrator**: Full system access - manage students, classes, teachers, users
2. **Teacher**: Class management, attendance marking, grade entry for assigned classes
3. **Parent**: View-only access for their children's profiles, attendance, and grades

## Core Requirements (Static)
- [x] User authentication with JWT
- [x] Role-based access control (Admin, Teacher, Parent)
- [x] Student CRUD operations
- [x] Class/Grade management
- [x] Daily attendance tracking with status (Present/Absent/Late/Excused)
- [x] Grade entry system with subjects, score, term, type
- [x] User management (Admin only)
- [x] Dashboard with statistics

## What's Been Implemented (January 2026)

### Backend (FastAPI + MongoDB)
- JWT authentication with bcrypt password hashing
- Role-based middleware for route protection
- Full CRUD APIs for Students, Classes, Attendance, Grades, Users
- Dashboard statistics endpoint
- Bulk attendance marking endpoint

### Frontend (React + Shadcn UI)
- Beautiful "Sunny Classroom" themed UI with Nunito/Outfit fonts
- Protected routes with role-based access
- Login/Registration with role selection
- Dashboard with stats cards (Bento grid layout)
- Students page with card-based view
- Classes management page
- Attendance marking with calendar picker
- Grades table with filtering
- User management with role editing

### Design Theme
- Primary: Soft Ocean Blue (#00a0dc)
- Secondary: Sunshine Yellow
- Background: Warm Paper (#faf8f5)
- Rounded corners (3xl), smooth animations

## Prioritized Backlog

### P0 (Critical) - All Done ✓
- User authentication
- Student management
- Class management
- Attendance tracking
- Grade entry

### P1 (Important) - Future
- Export reports to PDF
- Email notifications for parents
- Attendance reports/analytics
- Student performance charts

### P2 (Nice to have)
- Dark mode toggle
- Calendar view for schedule
- Bulk student import (CSV)
- Parent-teacher messaging
- Mobile-responsive improvements

## Tech Stack
- Frontend: React 19, Tailwind CSS, Shadcn UI, React Router
- Backend: FastAPI, Motor (async MongoDB), PyJWT
- Database: MongoDB
- Authentication: JWT with bcrypt

## API Endpoints
- POST /api/auth/register, /api/auth/login, GET /api/auth/me
- GET/POST/PUT/DELETE /api/students
- GET/POST/PUT/DELETE /api/classes
- GET/POST /api/attendance, POST /api/attendance/bulk
- GET/POST/PUT/DELETE /api/grades
- GET/PUT/DELETE /api/users (Admin only)
- GET /api/stats/dashboard
