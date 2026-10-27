# CSET Mid-Term Examination Date Sheet Portal

Live website: https://ranaarifdev.github.io/Date-sheet-portal/

This static HTML/CSS/Vanilla JavaScript portal provides an interactive, searchable, and printable date sheet portal for the Emerson University Multan Faculty of Computing & Emerging Technologies (FCET / CSET) Fall 2026 Mid-Term Examinations, derived from `CSET Mid Term Examination Fall 2026.pdf`.

The schedule dataset contains 364 verified examination records. Six examinations in the official university schedule have unassigned invigilators; these are faithfully preserved as `Not Available`.

## PDF Conversion Files

The complete source PDF was converted to both plain text and Markdown in the project root:

- `CSET_Mid_Term_Examination_Fall_2026.txt`
- `CSET_Mid_Term_Examination_Fall_2026.md`

Both files preserve the original sequence and provide explicit `PAGE 1` through `PAGE 18` separators so each extracted page remains traceable to the source PDF. The conversion and validation details are recorded in `data/verification_report.json`.

## Running Locally

The portal is designed for 100% offline, zero-dependency local operation. You have two convenient options:

1. **Direct File Opening (No Server Required)**:
   - Double-click `index.html` to open it in any modern browser (Chrome, Edge, Firefox).
   - The verified dataset loads instantly via `data/exam_schedule.js` without any browser CORS restrictions.

2. **Local HTTP Server (Optional)**:
   - From this folder, run:
     ```bash
     py -m http.server 8000
     ```
   - Open [http://localhost:8000](http://localhost:8000) in your browser.
   - The application seamlessly reads `data/exam_schedule.json` as a fallback.

## Key Features

- **Dashboard**: High-level statistics across all 364 examinations, 10 programs, courses, teachers, and exam days.
- **Complete Date Sheet**: Multi-attribute filtering across date, day, program, semester, section, shift, teacher/invigilator, course code, and room. Includes instant filter reset, live count, PDF download, and print view.
- **Teacher Date Sheets**: Dedicated invigilator date sheet generator. Filtering returns only the selected teacher's assigned papers. Unassigned papers can be viewed under `Not Available`.
- **Program Sheets**: Comprehensive degree date sheets with optional semester, section, and shift filters.
- **Class Sheets**: Dedicated per-class view distinguishing Program, Semester, Section, and Shift.
- **Calendar Schedule**: Chronologically sorted daily schedule with morning and evening slots, course titles, rooms, and invigilator details.
- **Professional Print Layout**: Clean white A4 landscape print output with the formal university heading block (Emerson University Multan → FCET → MID-TERM EXAMINATION DATE SHEET → FALL SEMESTER 2026), teacher name or class details, examination period, generation date, and an official two-column signature footer (HOD / Head of Department and Examination Coordinator).
- **PDF Download**: Direct A4 PDF downloads (no print dialog) are available for complete, filtered, teacher-wise, program-wise, and class-wise schedules. PDF filenames reflect the selection — e.g. `Teacher_John_Doe_Fall_2026.pdf`, `BS_Cyber_Security_Semester_7_Section_A_Morning_Fall_2026.pdf`. PDF generation uses jsPDF and AutoTable loaded from cdnjs; an internet connection is required for the library scripts unless they are locally bundled.
- **Theme Support**: Seamless light/dark preference toggle.

## Print & PDF Options

Each timetable view (Teacher, Class, Program, Complete) provides exactly two export actions:

| Action | Behaviour |
|---|---|
| **Print** | Opens the browser print dialog. The page switches to a white A4 layout with centred university headings, selected context detail, and signature blocks. |
| **Download PDF** | Directly saves a `.pdf` file via jsPDF — does **not** open the print dialog. Columns are tailored per view (teacher sheet omits the teacher column; class sheet shows only course/time/room). |

> **Note**: CSV Export has been removed. Only Print and Download PDF are available.

## Filename Convention

| View | Example filename |
|---|---|
| Teacher | `Teacher_Muhammad_Ali_Fall_2026.pdf` |
| Class | `BS_Cyber_Security_Semester_7_Section_A_Morning_Fall_2026.pdf` |
| Program | `Program_BS_Computer_Science_Semester_3_Fall_2026.pdf` |
| Complete | `Complete_Examination_Fall_2026.pdf` |

## Print CSS

The print stylesheet (`style.css` `@media print`) ensures:
- White `#fff` background, black `#000` text for official A4 paper output.
- University header text and table headers printed in black.
- Table rows prevented from splitting across pages (`page-break-inside: avoid`).
- `thead` repeats on every page.
- Page numbers appear at the bottom of each PDF page.
- Signature footer lines render in solid black.

## Data Verification & Integrity

All 364 records have been verified against the official text layer of `CSET Mid Term Examination Fall 2026.pdf`. Detailed verification results, documented discrepancies, and extraction summaries are recorded in `data/verification_report.json`.

## Conversion & Print Validation Status

- Conversion status: Verified with documented extraction corrections.
- PDF pages processed: 18/18
- Plain-text output: Present with explicit page boundaries.
- Markdown output: Present with explicit page boundaries.
- Manual review cases: 6 blank teacher/invigilator values preserved intentionally and flagged in the report.
- Print layouts: Complete, teacher-wise, program-wise, class-wise, and calendar views include the required university header, metadata, and signature footer.
- CSV Export: Removed — only Print and Download PDF actions are available.
