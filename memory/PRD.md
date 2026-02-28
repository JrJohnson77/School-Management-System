# Student Management System - PRD

## Original Problem Statement
Multi-tenant student management system for primary schools with a canvas-based WYSIWYG report template designer.

## Core Requirements
- [x] JWT Auth & Multi-tenancy (Superuser, Admin, Teacher, Parent)
- [x] Student/Class/Attendance management
- [x] Gradebook with weighted/non-weighted grading
- [x] Report card generation with dynamic templates
- [x] **Canvas WYSIWYG Report Template Designer** with background upload
- [x] Social skills, CSV import, signatures, PDF export

## Canvas WYSIWYG Designer
- **Background Upload**: Upload existing report card design as background image via "Background" button
- **Free positioning**: Drag elements anywhere on paper-sized canvas
- **Resize handles**: Corner handles for precise element sizing
- **Element types**: Text, Data Field, Image, Line, Rectangle, Signature, Grades Table, Social Skills
- **Properties panel**: Position/Size, Content, Typography, Colors, Border, Padding
- **Data field placeholders**: Auto-filled with real student data when rendering
- **Paper sizes**: Legal, Letter, A4 with zoom controls
- **[NEW] Visible Grid**: Toggle-able blue grid lines (10px intervals) for alignment reference
- **[NEW] Snap-to-Grid**: Elements snap to 10px grid positions when dragging
- **[NEW] Alignment Guides**: Red lines appear when elements align with other elements (edges/center within 5px threshold)
- **[NEW] Undo (Ctrl+Z)**: Undo last action (up to 50 steps)
- **[NEW] Copy/Paste (Ctrl+C/Ctrl+V)**: Copy and paste elements with 30px offset
- **[NEW] Clean Template Loading**: Templates load cleanly without duplicate/stale elements

## Credentials
- Superuser: JTECH / jtech.innovations@outlook.com / Xekleidoma@1
- Test Admin: WPS / wps.admin@school.com / Password@123

## Backlog
- [ ] P1: Email report cards to parents
- [ ] P1: Attendance analytics dashboard
- [ ] P2: Dark mode, Parent portal, Academic calendar

## Changelog
- **Dec 2025 (Session 2)**: Added Ctrl+C (Copy), Ctrl+V (Paste), Ctrl+Z (Undo) functionality. Fixed template persistence to ensure clean loading without duplicate elements. Added Undo/Copy/Paste buttons to toolbar.
- **Dec 2025 (Session 1)**: Added snap-to-grid and alignment guides to canvas editor. Removed prominent "Upload Template" buttons, replaced with simpler "Background" button. Added Grid and Snap toggle buttons.
