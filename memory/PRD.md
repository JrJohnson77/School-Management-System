# Student Management System - PRD

## Original Problem Statement
Build a multi-tenant student management system for primary schools with student/class management, attendance, gradebook, report cards, and a WYSIWYG report template designer for superusers.

## Core Requirements
- [x] JWT Authentication & Multi-tenant architecture
- [x] Superuser, Admin, Teacher, Parent roles
- [x] Student CRUD with auto-age, photo uploads
- [x] Class/Grade management with teacher permissions
- [x] Attendance tracking
- [x] Gradebook with weighted/non-weighted grading
- [x] Report card generation with dynamic templates
- [x] **WYSIWYG Report Template Designer** - Full visual editor with drag-and-drop
- [x] Social skills assessment
- [x] CSV bulk import (students & teachers)
- [x] Signature management for report cards
- [x] PDF export for report cards

## WYSIWYG Report Template Designer (December 2025)
Full visual editor replacing the structured form. Features:
- **Split-screen layout**: Block editor (left) + Live preview (right)
- **Drag-and-drop**: Reorder any section via @dnd-kit
- **Block types**: School Header, Student Info, Term Info, Grades Table, Grade Key, Weight Key, Achievement Standards, Social Skills, Comments, Signatures, Footer
- **Custom blocks**: Text, Image, Spacer — add/delete freely
- **Theme presets**: Classic Blue, Emerald Green, Royal Purple, Professional Gray, Warm Burgundy
- **Per-block styling**: Background color, text color, font family overrides
- **Global theme controls**: Header BG/text colors, accent, font family
- **Paper size**: Legal, Letter, A4
- **Backward compatible**: Flat fields auto-derived from blocks for report rendering
- **Auto-migration**: Old templates converted to blocks format on load

## Architecture
```
/app/
├── backend/
│   ├── server.py
│   ├── requirements.txt
│   └── tests/
└── frontend/
    └── src/
        ├── pages/
        │   ├── ReportTemplateDesigner.js  # WYSIWYG builder
        │   ├── ReportsPage.js             # Dynamic template-driven
        │   ├── GradebookPage.js           # Dynamic template-driven
        │   ├── ImportExportPage.js
        │   ├── SchoolsPage.js             # Template button per school
        │   └── ... (Login, Students, Classes, Attendance, Users)
        └── components/
```

## Key DB Collections
schools, users, students, classes, attendance, gradebook, report_templates, social_skills, signatures

## Credentials
- **Superuser:** JTECH / jtech.innovations@outlook.com / Xekleidoma@1
- **Test Admin (WPS):** WPS / wps.admin@school.com / Password@123

## Prioritized Backlog
### P1
- [ ] Email report cards to parents
- [ ] Attendance analytics dashboard

### P2
- [ ] Dark mode
- [ ] Parent portal enhancements
- [ ] Academic calendar

## Tech Stack
Frontend: React 19, Tailwind, Shadcn UI, @dnd-kit, html2canvas, jsPDF
Backend: FastAPI, Motor (MongoDB), PyJWT, bcrypt, fpdf2
Database: MongoDB
