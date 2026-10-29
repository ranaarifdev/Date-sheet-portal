# Changelog

## 2026-10-29 — Final PDF refresh

- Rebuilt the schedule datasets and extracted TXT/MD files from `Final CSET Mid Term Examination Fall 2026.pdf`.
- Reconciled 24 source pages and 413 populated examination records, including the updated class and invigilator assignments.
- Updated the verification report to identify the final PDF as the active source of truth.
- Preserved and documented one source-level weekday/date inconsistency (`exam-321`) instead of silently changing the PDF's printed value.

## 2026-10-29

- Added defensive schedule validation before rendering, printing, and PDF export.
- Documented the rejected numeric-filler extraction for `Teacher_Anam_Ashraf_Fall_2026.pdf`.
- Audited the 412-record JSON/JS datasets: no duplicate IDs, invalid required fields, double-escaped course titles, weekday mismatches, or reported garbled strings were found.
