# Student Management System - PRD

## Original Problem Statement
Build a multi-tenant student management system for primary schools with:
- Student registration with first/middle/last name, DOB (system calculates age), address, house, class
- Teacher can add students and enter grades
- Only admin can create users
- Gradebook with multiple subjects and grading scheme (A+ to U)
- Generate final report cards for entire class
- Multi-tenancy: Support multiple schools with data segregation by school_code
- Superuser: Administrative role with access to all schools
- Report Template Designer: Superuser can design and edit custom report templates per school

## Core Requirements
- [x] JWT Authentication
- [x] Multi-tenant architecture with school_code segregation
- [x] Superuser can login to ANY school context
- [x] Role-based access control
- [x] Student CRUD with auto-calculated age, photo uploads
- [x] Class/Grade management
- [x] Attendance tracking
- [x] Gradebook with weighted and non-weighted grading
- [x] Report card generation with dynamic templates
- [x] **Report Template Designer (Superuser Only)** - NEW
- [x] Social skills assessment
- [x] CSV bulk import (students & teachers)
- [x] Signature management (teacher/principal)
- [x] PDF export for report cards
- [x] Grade display bug fix (decimal rounding)

## What's Been Implemented

### Report Template Designer (December 2025) - NEW
- Superuser-only page accessible from Schools page "Template" button
- Each school gets its own customizable report template
- Auto-creates default template when school is created or first accessed
- Configurable sections:
  - School Branding (name, motto, logo, header/sub-header, paper size)
  - Subjects (add/remove, mark as core for ranking averages)
  - Grade Scale (customizable ranges, labels, descriptions)
  - Assessment Weights (toggle weighted grading, configure component percentages)
  - Report Sections (toggle social skills, attendance, comments, signatures, etc.)
  - Social Skills Categories (custom categories with skills, custom ratings)
  - Achievement Standards (custom bands with score ranges)
- Template drives all report card rendering and gradebook entry dynamically
- Replaced hardcoded MHPS constants with dynamic template data

### Previous Features (all working)
- Multi-tenancy architecture with school-code-based data segregation
- Superuser role with full administrative access across schools
- Student management with photo uploads and auto-age calculation
- User management with password reset
- Class management with teacher permissions
- Attendance tracking
- Gradebook with weighted assessments
- MHPS-style report card generation
- Import/Export page (CSV import, signature management)
- PDF export for report cards
- Social skills assessment

## Credentials
- **Superuser:** school_code=JTECH, username=jtech.innovations@outlook.com, password=Xekleidoma@1
- **Test Admin (WPS):** school_code=WPS, username=wps.admin@school.com, password=Password@123

## Architecture
```
/app/
├── backend/
│   ├── server.py              # FastAPI app, all API logic
│   ├── requirements.txt
│   ├── tests/
│   │   └── test_report_templates.py
│   └── .env
└── frontend/
    ├── src/
    │   ├── context/AuthContext.js
    │   ├── components/Layout.js
    │   ├── pages/
    │   │   ├── LoginPage.js
    │   │   ├── SchoolsPage.js          # Template button per school
    │   │   ├── ReportTemplateDesigner.js # NEW - Template editor
    │   │   ├── StudentsPage.js
    │   │   ├── ClassesPage.js
    │   │   ├── AttendancePage.js
    │   │   ├── GradebookPage.js        # Dynamic template-driven
    │   │   ├── ReportsPage.js          # Dynamic template-driven
    │   │   ├── ImportExportPage.js
    │   │   └── UsersPage.js
    │   ├── App.js
    │   └── index.css
    └── .env
```

## Key DB Collections
- schools, users, students, classes, attendance, gradebook
- report_templates (NEW), social_skills, signatures

## Prioritized Backlog
### P1 (Important)
- [ ] Email report cards to parents
- [ ] Attendance analytics dashboard

### P2 (Nice to have)
- [ ] Dark mode
- [ ] Parent portal enhancements
- [ ] Academic calendar
