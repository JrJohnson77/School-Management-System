# Lumina-SIS (Student Information System) - PRD

## Original Problem Statement
Multi-tenant student management system for primary schools with a canvas-based WYSIWYG report template designer.
Rebranded from "EduManager" to "Lumina-SIS" with a modern, sleek UI redesign.

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
- **Element types**: Text, Data Field, Image (with fit mode, opacity, rotation), H-Line, V-Line, Rectangle, Signature, Grades Table, Social Skills
- **Properties panel**: Position/Size, Content, Typography (incl. Line Height), Colors, Border, Padding
- **Data field placeholders**: Auto-filled with real student data when rendering
- **[NEW] Line Height**: Adjustable line spacing for text elements (Normal, 1.0, 1.2, 1.4, 1.5, 1.6, 1.8, 2.0, 2.5)
- **[NEW] Pan & Zoom**: Ctrl+scroll to zoom towards pointer, Alt+drag to pan, double-click to reset, presets (50/100/200/Reset), slider (25%-400%)
- **WYSIWYG Rendering**: Report generation uses exact pixel positioning matching the designer
- **[NEW] Visible Grid**: Toggle-able blue grid lines (10px intervals) for alignment reference
- **[NEW] Snap-to-Grid**: Elements snap to 10px grid positions when dragging
- **[NEW] Alignment Guides**: Red lines appear when elements align with other elements (edges/center within 5px threshold)
- **[NEW] Undo (Ctrl+Z)**: Undo last action (up to 50 steps)
- **[NEW] Copy/Paste (Ctrl+C/Ctrl+V)**: Copy and paste elements with 30px offset
- **[NEW] Clean Template Loading**: Templates load cleanly without duplicate/stale elements

## Gradebook & Grading
- **MHPS Assessment Entry Table**: Full weighted entry with columns for each component
- **Subjects**: English Language, Mathematics, Science, Social Studies, Religious Education, Physical Education, Creative Arts, Music, ICT, French
- **Grade Weights**: HW 5% | GW 5% | Project 10% | Quiz 10% | Mid-Term 30% | End of Term 40%
- **Auto-calculation**: Weighted score and grade letter calculated automatically from entered scores
- **Core Subjects** (for average/ranking): English Language, Mathematics, Science, Social Studies
- **Achievement Standards** (based on final exam):
  - HP (86-100) = Highly Proficient
  - P (75-85) = Proficient
  - AP (60-74) = Approaching Proficiency
  - D (50-59) = Developing
  - B (0-49) = Beginning
- **Social Skills Tab**: Direct assessment of student skills:
  - Completes Assignments
  - Follows Instructions
  - Punctuality
  - Deportment
  - Courteous in Speech and Action
  - Respect for Teacher
  - Respect for Peers
- **Rating Options**: EX (Excellent), VG (Very Good), G (Good), NI (Needs Improvement)
- **Settings Tab** (Admin/Superuser only): Configure all grading settings from the Gradebook page

## Credentials
- Superuser: JTECH / jtech.innovations@outlook.com / Xekleidoma@1
- Test Admin: WPS / wps.admin@school.com / Password@123

## Backlog
- [ ] P1: Email report cards to parents
- [ ] P1: Attendance analytics dashboard
- [ ] P1: Class Schedule / Timetable
- [ ] P1: Lesson Plans / Assignments / Homework
- [ ] P1: Communication / Announcements
- [ ] P1: Academic Calendar / Events
- [ ] P2: Parent Portal
- [ ] P2: Teacher Dashboard
- [ ] P2: Student Documents
- [ ] P2: Dark mode
- [ ] P3: Transportation & Library integrations
- [ ] Tech-debt: split server.py (~3k lines) into routers by module

## Changelog
- **Feb 2026 (Session 15 — 6-step audit)**: 
  - **Backend APIs**: Full CRUD + Stats for Admissions (`/api/admissions`), Health (`/api/health/{student_id}/...` for vaccinations/allergies/conditions/medications/visits) and Discipline (`/api/discipline`). Re-Enrollment endpoints (`/api/enrollment/preview`, `/api/enrollment/execute`) with promote/retain/graduate/withdraw flow. All endpoints documented inline (method, path, required role).
  - **RBAC Audit**: Added `assert_school_tenant()` helper; closed cross-tenant gaps on `/api/schools`, `/api/schools/{id}/{academic-years,signatures,subjects}`, and `/api/report-templates/{code}`. `/api/schools` now returns the admin's own school only (was superuser-only). All role violations return **403** (not 401).
  - **Sidebar**: FACTS-style grouped collapsible navigation (Overview / Admissions / People / Academics / Student Services / Administration), persisted to `localStorage[lumina_sidebar_open_groups]`, auto-expand parent group on route change.
  - **Frontend State**: loading/empty/error states added to AdmissionsPage, HealthPage, DisciplinePage, ReEnrollmentPage. `overflow-x-auto` on every table. Re-Enrollment falls back gracefully when no academic years are configured.
  - **Design Consistency**: All new dialogs use `rounded-2xl p-6` with a close-X (lucide `X`). Cancel/Save buttons standardized with `Loader2` spinner while saving. Toasts on every CRUD action (success + error from `response.data.detail`). Added `DialogDescription` for a11y.
  - **Health page**: added missing TabsContent for Conditions and Medications + dialog forms.
  - **API base fix**: Admissions/Health/Discipline/Re-Enrollment pages were calling endpoints without the `/api` prefix; corrected.
  - **Date/Time**: Backend uniformly stores `datetime.now(timezone.utc).isoformat()`. Frontend renders with `toLocaleDateString()`.
  - **Testing**: Backend 31/31 (100%) — see `/app/test_reports/iteration_11.json`; Frontend ~95% — see `/app/test_reports/iteration_12.json`.
- **Jul 2025 (Session 14)**: Rebranded from "EduManager" to "Lumina-SIS". Complete UI redesign with indigo/violet color palette, dark sidebar, Inter + Plus Jakarta Sans fonts, refined login page (split layout with dark branding panel), polished dashboard with accent-strip stat cards, consistent styling across all pages (rounded-2xl cards, subtle borders, clean animations).
- **Dec 2025 (Session 13)**: Added custom weighting configuration in Settings tab. Fixed backend validation errors for skill_ratings and subject weights. Settings now save successfully.
- **Dec 2025 (Session 12)**: Updated Academic Grades tab to MHPS Assessment Entry format with columns for each weighted component (HW 5%, GW 5%, Project 10%, Quiz 10%, Mid-Term 30%, End of Term 40%). Added all 10 subjects with auto-calculated weighted scores and grades.
- **Dec 2025 (Session 11)**: Simplified Social Skills tab to show 7 specific skills (Completes Assignments, Follows Instructions, Punctuality, Deportment, Courteous in Speech and Action, Respect for Teacher, Respect for Peers) with EX/VG/G/NI rating dropdowns.
- **Dec 2025 (Session 10)**: Complete overhaul of Gradebook Settings tab with Quick Setup, Achievement Standards, Social Skills Categories configuration. Added defaults: Core subjects (Maths, Language Arts, Science, Social Studies), weights (HW 5%, GW 5%, Project 10%, Quiz 10%, Mid 30%, Final 40%), achievement bands (HP/P/AP/D/B), and social skills (Completes Assignments, Follows Instructions, Punctuality, Deportment, Courteous in Speech and Action, Respect for Teacher, Respect for Peers).
- **Dec 2025 (Session 9)**: Added Settings tab to Gradebook page for Admin/Superuser to configure subjects, per-subject grade weights, and social skills rating scale directly from Gradebook.
- **Dec 2025 (Session 8)**: Added per-subject customizable grade weights with settings icon. Added customizable social skills rating scale (code/label format: EX=Excellent, VG=Very Good, G=Good, NI=Needs Improvement).
- **Dec 2025 (Session 7)**: Added free image adjustment - Fit Mode (fill/contain/cover/none), Opacity (0-100%), and Rotation (-360 to 360°) controls for image elements.
- **Dec 2025 (Session 6)**: Added Line Height control for text elements. Removed PDF download button from Reports. Fixed WYSIWYG rendering to use exact pixel positions. Fixed vertical lines appearing in report generation.
- **Dec 2025 (Session 5)**: Improved zoom to pan-and-zoom (Ctrl+scroll zooms to pointer, Alt+drag pans, double-click resets). Fixed vertical lines not appearing in report generation.
- **Dec 2025 (Session 4)**: Added free zoom with slider (25%-400%), direct input, preset buttons (50/100/200%), and Ctrl+scroll wheel zoom.
- **Dec 2025 (Session 3)**: Added vertical line (V-Line) element type to canvas editor. Renamed "Line" to "H-Line" for clarity.
- **Dec 2025 (Session 2)**: Added Ctrl+C (Copy), Ctrl+V (Paste), Ctrl+Z (Undo) functionality. Fixed template persistence to ensure clean loading without duplicate elements. Added Undo/Copy/Paste buttons to toolbar.
- **Dec 2025 (Session 1)**: Added snap-to-grid and alignment guides to canvas editor. Removed prominent "Upload Template" buttons, replaced with simpler "Background" button. Added Grid and Snap toggle buttons.
