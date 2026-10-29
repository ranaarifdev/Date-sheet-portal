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

- Dashboard with overall statistics across the 413 verified examination records across all 24 pages. The displayed total is derived from the loaded, validated dataset.
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

The final PDF contains one source-level weekday/date inconsistency: record `exam-321` is printed as `Friday, 29 Oct 2026`, although 29 October 2026 is Thursday. The PDF's printed weekday is preserved and the discrepancy is documented in the verification report.

At runtime, records with an empty required value (`date`, `courseCode`, `courseTitle`, or `room`) or numeric extraction filler matching `/^\\s*1[\\s1]*$/` are rejected before they reach any view, print layout, or PDF export. The corrupted `Teacher_Anam_Ashraf_Fall_2026.pdf` extraction is documented as rejected in the verification report; its four valid schedule records from the main schedule remain preserved.

## Notes

- The portal is intentionally static and offline-friendly.
- The PDF export relies on the jsPDF and AutoTable libraries from the CDN at runtime.
- The standard workflow is print or PDF export from the selected view; the portal does not use CSV export.
