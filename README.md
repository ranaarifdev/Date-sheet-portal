# CSET Mid-Term Examination Date Sheet Portal

Live website: https://ranaarifdev.github.io/Date-sheet-portal/

This static HTML/CSS/Vanilla JavaScript portal provides an interactive, searchable, printable, and exportable date sheet for Emerson University Multan's Faculty of Computing & Emerging Technologies (FCET / CSET) Fall 2026 Mid-Term Examinations.

The project uses the verified schedule data extracted from the official university document and preserves all examination records, including cases where an invigilator is not assigned (`Not Available`).

## Source Data Files

The official source material and extracted records are stored in the project root and data folder:

- `CSET_Mid_Term_Examination_Fall_2026.pdf` (source document)
- `CSET_Mid_Term_Examination_Fall_2026.txt`
- `CSET_Mid_Term_Examination_Fall_2026.md`
- `data/exam_schedule.js`
- `data/exam_schedule.json`
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

- Dashboard with overall statistics across the 412 verified examination records across all 18 pages.
- Complete date sheet with live filtering by date, day, program, semester, section, shift, teacher/invigilator, course code, and room.
- Teacher date sheets with focused invigilator views.
- Program-wise schedules with optional semester, section, and shift filtering.
- Class-wise schedules for specific program, semester, section, and shift combinations.
- Calendar-based view for chronological exam scheduling.
- Print layout using white A4 output with black text and institutional header styling.
- PDF export for filtered complete, teacher-wise, program-wise, and class-wise schedules.
- University branding with the Emerson University Multan logo and official institutional title block.
- Light/dark mode toggle.

## Print and PDF Behavior

Each timetable view includes both print and PDF actions:

- Print: opens the browser print dialog and renders the white A4 schedule sheet.
- Download PDF: saves a PDF directly using jsPDF and AutoTable.

The generated document includes:

- Emerson University Multan
- Department of Computing & Emerging Technology
- CSET Mid Term Examination — Fall 2026
- view-specific context such as teacher name, class, program, or complete schedule
- date-sheet details block with session, type, selection, paper count, and generation date
- repeated column headers on multi-page output where possible
- HOD / Head of Department and Examination Coordinator signature lines

## Data Integrity and Verification

The data set is based on the extracted schedule records and has been checked against the source document structure. The project keeps the original extracted records and the verification notes in `data/verification_report.json`.

## Notes

- The portal is intentionally static and offline-friendly.
- The PDF export relies on the jsPDF and AutoTable libraries from the CDN at runtime.
- The standard workflow is print or PDF export from the selected view; the portal does not use CSV export.
