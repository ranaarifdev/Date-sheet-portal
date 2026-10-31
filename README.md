# CSET Mid-Term Examination Date Sheet Portal

Live website: https://ranaarifdev.github.io/Date-sheet-portal/

This static HTML/CSS/Vanilla JavaScript portal provides an interactive, searchable, printable, and exportable date sheet for Emerson University Multan's Faculty of Computing & Emerging Technologies (FCET / CSET) Fall 2026 Mid-Term Examinations.

The project uses the verified schedule data extracted from the official university document and preserves all examination records, including cases where an invigilator is not assigned (`Not Available`).

## Source Data Files

The official source PDF used for verification is `Final updated CSET Mid Term Examination Fall 2026.pdf` (24 pages, 413 populated examination records). Its SHA-256 is `72c04b32bb495977ccc1359c8a7821d038db3cf37bd254ba72e5eb6ee3de0d70`; the file and record-level verification are documented in `data/verification_report.json`. The extracted source material and schedule records are stored in the project root and data folder:

- `CSET_Mid_Term_Examination_Fall_2026.txt`
- `CSET_Mid_Term_Examination_Fall_2026.md`
- `Final updated CSET Mid Term Examination Fall 2026.pdf`
- `data/exam_schedule.js`
- `data/exam_schedule.jsonsa
- `data/verification_report.json`

The text and Markdown files preserve the original page ordering and document structure so each extracted schedule page can be traced back to the original source.

## Running Locally

The portal works as a static site and does not require a backend or build step.

1. Direct file opening:
   - Open `index.html` directly in a browser.
   - The application loads the bundled schedule data from `data/exam_schedule.js`.

2. Local web server (optional):
   ```bash
   py -m http.server 8000
   ```
   Then open http://localhost:8000 in the browser.

## Key Features

- **Dashboard with Program Directory & Live Status:** Overall statistics across the 413 verified examination records, an embedded real-time paper status tracker, and an interactive "Explore by Degree Program" directory with instant search and 1-click schedule navigation.
- **Dynamic Cascading Program Navigation:** Program-wise schedules with quick-access program chips and dynamic cascading dropdowns (Program → Semester → Section → Shift) ensuring users only see available options.
- **Real-Time Live & Upcoming Paper Tracker:** Live ticker widget checking system time against the timetable; highlights exams conducting *right now* with an animated pulsing `● LIVE NOW` indicator, classroom location, invigilator, and elapsed time progress bar, plus countdown clocks for upcoming sessions and a simulation test mode.
- **Enhanced Classroom & Teacher Display:** Prominently highlights exact classrooms with high-contrast venue badges, and clearly features assigned teachers and invigilators across all tabular, card, calendar, print, and PDF layouts (including class-wise sheets).
- **Class-Wise Date Sheets:** Focused class schedules for specific program, semester, section, and shift combinations with dynamic cascading selectors and invigilator details.
- **Complete Date Sheet:** Global searchable and filterable view across all 413 records with multi-attribute filtering.
- **Teacher Date Sheets:** Dedicated invigilation duty schedules for individual faculty members.
- **Calendar-Based View:** Chronological date-by-date exam schedules with venue and invigilator indicators.
- **White A4 Print & PDF Export Consistency:** Clean print view and jsPDF/AutoTable exports with the official Emerson University Multan header, university logo, classroom context, teacher metadata, and clean full-page timetable formatting.
- **University Branding:** Official Emerson University Multan crest and institutional title blocks.
- **Light / Dark Mode:** Toggleable color themes across the entire portal.

## Print and PDF Behavior

Each timetable view includes both print and PDF actions:

- Print: opens the browser print dialog and renders the white A4 schedule sheet.
- Download PDF: saves a PDF directly using jsPDF and AutoTable.

The generated document includes:

- Emerson University Multan
- Department of Computing & Emerging Technology
- CSET Mid Term Examination — Fall 2026
- view-specific context such as teacher name, class, program, or complete schedule; class sheets prominently identify the program, semester, section, and shift
- date-sheet details block with session, type, selection, paper count, and generation date
- repeated column headers on multi-page output where possible
- official departmental footer and page numbering
- a single, clear institutional header and correct page numbering in downloaded PDFs

## Data Integrity and Verification

The data set is based on the extracted schedule records and has been checked against the source document structure. The project keeps the original extracted records and the verification notes in `data/verification_report.json`.

The final PDF contains one source-level weekday/date inconsistency: record `exam-321` is printed as `Friday, 29 Oct 2026`, although 29 October 2026 is Thursday. The PDF's printed weekday is preserved and the discrepancy is documented in the verification report.

At runtime, records with an empty required value (`date`, `courseCode`, `courseTitle`, or `room`) or numeric extraction filler matching `/^\\s*1[\\s1]*$/` are rejected before they reach any view, print layout, or PDF export. The corrupted `Teacher_Anam_Ashraf_Fall_2026.pdf` extraction is documented as rejected in the verification report; its four valid schedule records from the main schedule remain preserved.

## Notes

- The portal is intentionally static and offline-friendly.
- The PDF export relies on the jsPDF and AutoTable libraries from the CDN at runtime.
- The standard workflow is print or PDF export from the selected view; the portal does not use CSV export.
