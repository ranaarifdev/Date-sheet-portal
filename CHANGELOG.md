# Changelog

## 2026-10-31 — Advanced Program Categorization, Room & Teacher Prominence, Live Paper Status Tracker & Export Consistency

- **Program-Wise Categorization & Navigation:**
  - Added an interactive "Explore by Degree Program" directory on the Dashboard with instant search, program codes (`BSCYB`, `BSDS`, `BSCS`, `BSSE`, `BSAI`, `BSIT`, etc.), paper counters, semester badges, shift pills, and direct 1-click schedule navigation.
  - Implemented dynamic cascading selectors across Program Sheets and Class Sheets: selecting a program dynamically updates available semesters, sections, and shifts without invalid combinations.
  - Added quick-access program chips for instant 1-click program switching.

- **Classroom & Teacher Display Enhancement:**
  - Prominently highlighted examination classrooms with styled high-contrast room badges and venue icons across tabular, calendar, and card views.
  - Clearly featured assigned invigilators and teacher names with distinct styling across all course entries.
  - Explicitly added the Teacher / Invigilator column to Class-Wise tables, white A4 print sheets, and jsPDF downloads.

- **Real-Time Live & Upcoming Paper Status Widget:**
  - Integrated a real-time JavaScript examination tracking engine ticking every second with live clock and timetable status.
  - Highlights currently conducting papers with an animated pulsing `● LIVE NOW` indicator, course title, degree program, room, invigilating teacher, and an elapsed time progress bar.
  - Implemented an upcoming session countdown clock displaying days, hours, minutes, and seconds until the next examination slot, alongside scheduled course previews.
  - Added an interactive Test Mode / Simulator dropdown with pre-configured slots for off-hours and demonstrative evaluation.
  - Added a dedicated "Live Tracker" view and top navigation shortcut.

- **Print & PDF Export Consistency:**
  - Restored and styled official HOD / Head of Department and Examination Coordinator signature blocks across white A4 print layouts and AutoTable PDF exports.
  - Preserved Emerson University Multan header, official logo, room details, and teacher metadata in all export formats.

## 2026-10-29 — Class-wise output hardening

- Added three-pass HTML entity decoding to loaded titles and before escaping screen, print, and PDF output.
- Restored the logo and institutional headers in class-wise print/PDF layouts; emphasized program, semester, section, and shift in every class sheet.
- Removed duplicate PDF headers and page counters, and replaced plain signature lines with styled, bordered signature blocks.
- Confirmed the authoritative PDF and class-sheet reference both list Cyber Security Semester 7 Evening `FLNG-41XX` at 3:30 PM–5:00 PM; the displayed time separator is now PDF-safe, and no unsupported schedule change was made.

## 2026-10-29 — Confirm uploaded source PDF

- Identified the upload as the complete 24-page CSET mid-term examination date sheet, not a regular semester class timetable.
- Normalized its filename to `Final updated CSET Mid Term Examination Fall 2026.pdf` and updated source references in the portal documentation and verification report.
- Verified its SHA-256 matches the previously audited source PDF and checked all 413 records against their assigned PDF pages; the existing schedule datasets and TXT/MD extraction already match, so no schedule values were changed.

## 2026-10-29 — Final PDF refresh

- Rebuilt the schedule datasets and extracted TXT/MD files from `Final CSET Mid Term Examination Fall 2026.pdf`.
- Reconciled 24 source pages and 413 populated examination records, including the updated class and invigilator assignments.
- Updated the verification report to identify the final PDF as the active source of truth.
- Preserved and documented one source-level weekday/date inconsistency (`exam-321`) instead of silently changing the PDF's printed value.

## 2026-10-29

- Added defensive schedule validation before rendering, printing, and PDF export.
- Documented the rejected numeric-filler extraction for `Teacher_Anam_Ashraf_Fall_2026.pdf`.
- Audited the 412-record JSON/JS datasets: no duplicate IDs, invalid required fields, double-escaped course titles, weekday mismatches, or reported garbled strings were found.
