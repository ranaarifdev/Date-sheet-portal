# Changelog

## 2026-10-29 — Class-wise output hardening

- Added three-pass HTML entity decoding before escaping titles for screen, print, and PDF output.
- Confirmed the authoritative PDF's Cyber Security Semester 7 Evening `FLNG-41XX` time remains 3:30 PM–5:00 PM; no unsupported data change was made.

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
