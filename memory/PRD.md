# Student Management System - PRD

## Original Problem Statement
Multi-tenant student management system for primary schools with a canvas-based WYSIWYG report template designer.

## Core Requirements
- [x] JWT Auth & Multi-tenancy
- [x] Superuser, Admin, Teacher, Parent roles
- [x] Student/Class/Attendance management
- [x] Gradebook with weighted/non-weighted grading
- [x] Report card generation with dynamic templates
- [x] **Canvas WYSIWYG Report Template Designer** (free positioning + background upload)
- [x] Social skills, CSV import, signatures, PDF export

## Canvas WYSIWYG Designer (December 2025)
Full canvas-based visual editor replacing the block-based builder:
- **3-panel layout**: Left toolbar | Center canvas | Right properties
- **Free positioning**: Drag elements anywhere on paper-sized canvas
- **Resize handles**: Corner handles for precise resizing
- **Background upload**: Upload a pre-designed PDF/image, overlay data fields on top
- **Element types**: Text, Data Field, Image, Line, Rectangle, Signature, Grades Table, Social Skills Table
- **Properties panel**: Position/Size (X,Y,W,H), Content, Typography (font size/family/weight/style/alignment), Colors (text/background), Border, Padding
- **Data field placeholders**: {{student.first_name}}, {{student.last_name}}, {{term}}, etc.
- **Grades table config**: Subjects with core toggle, weighted grading, grade scale
- **Paper sizes**: Legal, Letter, A4
- **Zoom controls**: Scale canvas view
- **Keyboard shortcuts**: Delete, Ctrl+D (duplicate)
- **Canvas report renderer**: Renders real student data at designed positions

## Architecture
```
backend/server.py — FastAPI, all endpoints
frontend/src/pages/
  ReportTemplateDesigner.js — Canvas WYSIWYG editor
  ReportsPage.js — CanvasReportCard + DynamicReportCard
  GradebookPage.js, ImportExportPage.js, SchoolsPage.js, etc.
```

## Key API Endpoints
- GET/PUT /api/report-templates/{school_code} — Template CRUD
- POST /api/upload/template-background — Background image upload
- GET /api/report-cards/{class_id} — Generate report cards

## Credentials
- Superuser: JTECH / jtech.innovations@outlook.com / Xekleidoma@1
- Test Admin: WPS / wps.admin@school.com / Password@123

## Backlog
### P1
- [ ] Email report cards to parents
- [ ] Attendance analytics dashboard
### P2
- [ ] Dark mode, Parent portal, Academic calendar
