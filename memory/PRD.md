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
- [x] MHPS weighted grading (HW 5%, GW 5%, Project 10%, Quiz 10%, Mid-Term 30%, End of Term 40%)
- [x] Social skills assessment (Work Ethics, Respect categories)
- [x] CSV bulk import for students and teachers
- [x] Signature management (teacher/principal) for report cards
- [x] PDF export for report cards
- [x] Student/staff photo uploads

## What's Been Implemented (December 2025)

### Multi-Tenancy Architecture
- Schools identified by unique school_code at login
- All data segregated by school_code
- JWT tokens store school_code for session context
- Superuser can authenticate against any active school
- Superuser credential reset for any user

### Student Management
- Student ID, photo upload, search, auto-calculated age from DOB

### Teacher Permissions
- Teachers can create/manage their own classes
- Default permissions: manage_students, manage_classes, manage_attendance, manage_grades, view_reports, generate_reports

### Reports Module
- **Class List Report** - Student roster with ID, name, gender, age, house, contact
- **Gradebook Report** - All grades for all students in a class
- **Term Reports** - MHPS report cards with weighted grades, social skills, signatures
- **PDF Export** - Client-side PDF generation using html2canvas + jsPDF
- **Print Support** - Legal paper format with page break support

### Grade Bug Fix (December 2025)
- Fixed: Decimal scores (e.g., 89.2) now correctly round before grade lookup
- Applied Math.round()/round() in 4 grade lookup functions (2 backend, 2 frontend)

### Import/Export Module (December 2025)
- CSV import for students (with class assignment) and teachers
- CSV template downloads for both
- Signature management - upload teacher/principal signatures
- Signatures display on MHPS report cards

### Social Skills Assessment (December 2025)
- Work & Personal Ethics: Completes Assignments, Follows Instructions, Punctuality, Deportment, Courteous, Class Participation
- Respect: Respect for Teacher, Respect for Peers
- Ratings: Excellent, Good, Satisfactory, Needs Improvement
- Integrated into Gradebook page and MHPS report card display

### Key Credentials
- **Superuser:** school_code=JTECH, username=jtech.innovations@outlook.com, password=Xekleidoma@1
- **Test Admin (WPS):** school_code=WPS, username=admin@wps.edu, password=WpsAdmin@123

## Prioritized Backlog

### P1 (Important) - Upcoming
- [ ] Email report cards to parents
- [ ] Attendance analytics dashboard

### P2 (Nice to have)
- [ ] Dark mode
- [ ] Parent-teacher messaging
- [ ] Academic calendar
- [ ] Parent portal enhancements

## Tech Stack
- Frontend: React 19, Tailwind CSS, Shadcn UI, html2canvas, jsPDF
- Backend: FastAPI, Motor (MongoDB), PyJWT, bcrypt, fpdf2
- Database: MongoDB
