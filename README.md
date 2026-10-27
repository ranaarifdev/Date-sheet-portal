# CSET Mid-Term Examination Date Sheet Portal

This static HTML/CSS/Vanilla JavaScript portal provides an interactive, searchable, and printable date sheet portal for the Emerson University Multan Faculty of Computing & Emerging Technologies (FCET / CSET) Fall 2026 Mid-Term Examinations, derived from `CSET Mid Term Examination Fall 2026.pdf`.

The schedule dataset contains 364 verified examination records. Six examinations in the official university schedule have unassigned invigilators; these are faithfully preserved as `Not Available`.

## Running Locally

The portal is designed for 100% offline, zero-dependency local operation. You have two convenient options:

1. **Direct File Opening (No Server Required)**:
   - Double-click `index.html` to open it in any modern browser (Chrome, Edge, Firefox).
   - The verified dataset loads instantly via `data/exam_schedule.js` without any browser CORS restrictions on `file://`.

2. **Local HTTP Server (Optional)**:
   - From this folder, run:
     ```bash
     py -m http.server 8000
     ```
   - Open [http://localhost:8000](http://localhost:8000) in your browser.
   - The application seamlessly reads `data/exam_schedule.json`.

## Key Features

- **Dashboard**: High-level statistics across all 364 examinations, 10 programs, courses, teachers, and exam days.
- **Complete Date Sheet**: Multi-attribute filtering across date, day, program, semester, section, shift, teacher/invigilator, course code, and room. Includes instant filter reset, live count, CSV export, and print view.
- **Teacher Date Sheets**: Dedicated invigilator date sheet generator. Filtering returns only the selected teacher's assigned papers. Unassigned papers can be viewed under `Not Available`.
- **Program Sheets**: Comprehensive degree date sheets with optional semester, section, and shift filters.
- **Class Sheets**: Dedicated per-class view distinguishing Program, Semester, Section, and Shift.
- **Calendar Schedule**: Chronologically sorted daily schedule with morning and evening slots, course titles, rooms, and invigilator details.
- **Print & PDF Export**: Clean A4 print styling with Emerson University header; all interactive toolbars and buttons are automatically hidden in print mode.
- **CSV Export**: Standard UTF-8 encoded with BOM, full RFC 4180 quote escaping, and sanitized descriptive filenames.
- **Theme Support**: Seamless light/dark preference toggle.

## Data Verification & Integrity

All 364 records have been verified against the official text layer of `CSET Mid Term Examination Fall 2026.pdf`. Detailed verification results, documented discrepancies, and extraction summaries are recorded in `data/verification_report.json`.
