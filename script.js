const $ = s => document.querySelector(s);
const app = $('#app');
let data = [];
let view = 'dashboard';
let selected = [];

// Keep malformed extraction artifacts out of every view, export, and print path.
const NUMERIC_FILLER = /^\s*1[\s1]*$/;
const REQUIRED_RECORD_FIELDS = ['date', 'courseCode', 'courseTitle', 'room'];

function isValidExamRecord(record) {
  return record && REQUIRED_RECORD_FIELDS.every(field => {
    const value = record[field];
    return value !== null && value !== undefined && String(value).trim() !== '' &&
      !NUMERIC_FILLER.test(String(value));
  });
}

function validatedRecords(records) {
  return Array.isArray(records) ? records.filter(isValidExamRecord) : [];
}

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function formatDate(value) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
}

function periodForRows(rows, fallback = 'Examination period: 28 October 2026 to 6 November 2026') {
  const dates = rows.map(row => row.date).filter(Boolean).sort();
  if (!dates.length) return fallback;
  return `Examination period: ${formatDate(dates[0])} to ${formatDate(dates[dates.length - 1])}`;
}

function safe(s) {
  return String(s || 'schedule').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '');
}

function sortBySchedule(a, b) {
  const dComp = String(a.date).localeCompare(String(b.date));
  if (dComp !== 0) return dComp;
  const sA = Number(a.slot) || 0;
  const sB = Number(b.slot) || 0;
  if (sA !== sB) return sA - sB;
  const tComp = String(a.startTime).localeCompare(String(b.startTime));
  if (tComp !== 0) return tComp;
  const pComp = String(a.program).localeCompare(String(b.program));
  if (pComp !== 0) return pComp;
  const semComp = (Number(a.semester) || 0) - (Number(b.semester) || 0);
  if (semComp !== 0) return semComp;
  return String(a.section).localeCompare(String(b.section));
}

function uniq(k) {
  return [...new Set(data.map(x => x[k]).filter(Boolean))].sort((a, b) =>
    String(a).localeCompare(String(b), undefined, { numeric: true })
  );
}

function getTeachers() {
  const set = new Set();
  data.forEach(r => {
    const t = (r.teacher && r.teacher.trim()) ? r.teacher.trim() : 'Not Available';
    set.add(t);
  });
  return [...set].sort((a, b) => {
    if (a === 'Not Available') return 1;
    if (b === 'Not Available') return -1;
    return a.localeCompare(b, undefined, { numeric: true });
  });
}

function opts(arr, empty = 'All') {
  return `<option value="">${empty}</option>` + arr.map(x => `<option value="${esc(x)}">${esc(x)}</option>`).join('');
}

function layout(title, body) {
  return `<div class="card"><h2>${title}</h2>${body}</div>`;
}

function stats() {
  return `<div class="grid">${[
    ['Examinations', data.length],
    ['Programs', uniq('program').length],
    ['Courses', new Set(data.map(x => x.courseCode)).size],
    ['Teachers', getTeachers().length],
    ['Exam days', new Set(data.map(x => x.date)).size]
  ].map(x => `<div class="card stat"><strong>${x[1]}</strong><span>${x[0]}</span></div>`).join('')}</div>`;
}

function table(rows, isTeacherView = false) {
  if (!rows.length) {
    return '<div class="empty">No matching examination records found.</div>';
  }
  const cols = isTeacherView
    ? ['date', 'day', 'startTime', 'endTime', 'courseCode', 'courseTitle', 'program', 'semester', 'section', 'shift', 'room']
    : ['date', 'day', 'startTime', 'endTime', 'program', 'semester', 'section', 'shift', 'courseCode', 'courseTitle', 'teacher', 'room'];

  const heads = {
    date: 'Date',
    day: 'Day',
    startTime: 'Start',
    endTime: 'End',
    program: 'Program',
    semester: 'Sem.',
    section: 'Sec.',
    shift: 'Shift',
    courseCode: 'Code',
    courseTitle: 'Course Title',
    teacher: 'Teacher / Invigilator',
    room: 'Room'
  };

  return `<div class="table-wrap"><table>
    <thead><tr>${cols.map(c => `<th>${heads[c]}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(r => `<tr>${cols.map(c => {
      if (c === 'shift') return `<td><span class="badge">${esc(r[c])}</span></td>`;
      if (c === 'teacher') return `<td>${esc(r.teacher && r.teacher.trim() ? r.teacher : 'Not Available')}</td>`;
      return `<td>${esc(r[c] ?? '')}</td>`;
    }).join('')}</tr>`).join('')}</tbody>
  </table></div>`;
}

function stripLabelPrefix(value, label) {
  if (typeof value !== 'string' || !label) return value;
  const prefix = `${label}: `;
  return value.startsWith(prefix) ? value.slice(prefix.length) : value;
}

function getCurrentPrintRows() {
  if (view === 'teacher' || view === 'program' || view === 'class' || view === 'calendar') {
    return [...selected].sort(sortBySchedule);
  }
  if (view === 'complete') {
    return filtered().sort(sortBySchedule);
  }
  return [...data].sort(sortBySchedule);
}

function getPrintMeta(rows) {
  const generatedAt = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  const base = {
    title: 'EMERSON UNIVERSITY MULTAN',
    department: 'Faculty of Computing & Emerging Technologies',
    heading: 'CSET Mid Term Examination — Fall 2026',
    semesterLabel: 'Fall 2026',
    session: 'Fall 2026',
    period: periodForRows(rows),
    generatedOn: `Generated: ${generatedAt}`,
    totalPapers: rows.length,
    sheetType: 'Complete Examination Date Sheet',
    detailLabel: 'Selection',
    detail: 'Complete Examination Date Sheet'
  };

  if (view === 'teacher' && $('#teacherSelect')?.value) {
    const teacherName = $('#teacherSelect').value;
    return {
      ...base,
      sheetType: 'Teacher-Wise Date Sheet',
      detailLabel: 'Teacher / Invigilator',
      detail: teacherName,
      subtitle: 'Teacher-Wise Examination Date Sheet'
    };
  }
  if (view === 'program' && $('#programSelect')?.value) {
    const p = $('#programSelect').value;
    const sem = $('#programSem').value;
    const sec = $('#programSec').value;
    const shift = $('#programShift').value;
    let detail = p;
    if (sem) detail += ` · Semester ${sem}`;
    if (sec) detail += ` · Section ${sec}`;
    if (shift) detail += ` · ${shift}`;
    return {
      ...base,
      sheetType: 'Program-Wise Date Sheet',
      detailLabel: 'Program Details',
      detail,
      subtitle: 'Program-Wise Examination Date Sheet'
    };
  }
  if (view === 'class' && $('#classP')?.value) {
    const p = $('#classP').value;
    const s = $('#classS').value;
    const sec = $('#classSec').value;
    const shift = $('#classSh').value;
    const classDetail = `${p} · Semester ${s} · Section ${sec} · ${shift} Shift`;
    return {
      ...base,
      sheetType: 'Class-Wise Date Sheet',
      detailLabel: 'Class Details',
      detail: classDetail,
      subtitle: 'Class-Wise Examination Date Sheet'
    };
  }
  if (view === 'calendar') {
    return {
      ...base,
      sheetType: 'Examination Calendar',
      detailLabel: 'Calendar Scope',
      detail: 'Departmental Examination Schedule',
      subtitle: 'Examination Calendar'
    };
  }
  return {
    ...base,
    subtitle: 'Complete Examination Date Sheet',
    detail: 'Complete Examination Date Sheet'
  };
}

function buildPrintHeader(meta) {
  const rawDetail = meta.detail || meta.subtitle || 'Complete Examination Date Sheet';
  const cleanDetail = stripLabelPrefix(rawDetail, meta.detailLabel || '');
  const cleanGeneratedOn = stripLabelPrefix(meta.generatedOn || 'Generated: —', 'Generated');
  const cleanPeriod = (meta.period || '').replace(/^Examination period:\s*/i, '');

  const details = [
    ['Date Sheet Type', meta.sheetType || meta.subtitle || 'Examination Date Sheet'],
    [meta.detailLabel || 'Selection', cleanDetail],
    ['Examination Period', cleanPeriod],
    ['Total Papers', String(meta.totalPapers ?? 0)],
    ['Session', meta.session || 'Fall 2026'],
    ['Date Generated', cleanGeneratedOn]
  ];

  const detailHtml = details.map(([label, value]) => `
    <div class="print-detail-item">
      <span>${esc(label)}</span>
      <strong>${esc(value)}</strong>
    </div>
  `).join('');

  return `<div class="print-header">
    <div class="print-brand-row">
      <img class="print-logo" src="university logo .png" alt="University Logo" />
      <div class="print-titles">
        <div class="print-title">${esc(meta.title)}</div>
        <div class="print-department">${esc(meta.department)}</div>
        <div class="print-heading">${esc(meta.heading)}</div>
      </div>
    </div>
    <div class="print-divider"></div>
    <div class="print-details">
      <div class="print-detail-grid">${detailHtml}</div>
    </div>
    <div class="print-divider"></div>
  </div>`;
}

/* Build the print-ready HTML table */
function buildPrintTable(rows) {
  if (!rows.length) {
    return '<div class="print-empty">No matching records available for printing.</div>';
  }

  const isTeacherSheet = view === 'teacher';
  const isClassSheet = view === 'class';

  if (isClassSheet) {
    return `<table class="print-table class-print-table">
      <thead><tr>
        <th>Sr.</th><th>Date</th><th>Day</th><th>Time</th>
        <th>Course Code</th><th>Course Title</th><th>Room</th>
      </tr></thead>
      <tbody>${rows.map((r, i) => `<tr>
        <td>${i + 1}</td>
        <td>${esc(formatDate(r.date))}</td>
        <td>${esc(r.day)}</td>
        <td>${esc(r.startTime)} – ${esc(r.endTime)}</td>
        <td>${esc(r.courseCode || 'N/A')}</td>
        <td>${esc(r.courseTitle || 'N/A')}</td>
        <td>${esc(r.room || 'N/A')}</td>
      </tr>`).join('')}</tbody>
    </table>`;
  }

  if (isTeacherSheet) {
    return `<table class="print-table teacher-print-table">
      <thead><tr>
        <th>Sr.</th><th>Date</th><th>Day</th><th>Time</th>
        <th>Program</th><th>Sem.</th><th>Sec.</th><th>Shift</th>
        <th>Course Code</th><th>Course Title</th><th>Room</th>
      </tr></thead>
      <tbody>${rows.map((r, i) => `<tr>
        <td>${i + 1}</td>
        <td>${esc(formatDate(r.date))}</td>
        <td>${esc(r.day)}</td>
        <td>${esc(r.startTime)} – ${esc(r.endTime)}</td>
        <td>${esc(r.program)}</td>
        <td>${esc(r.semester)}</td>
        <td>${esc(r.section)}</td>
        <td>${esc(r.shift)}</td>
        <td>${esc(r.courseCode || 'N/A')}</td>
        <td>${esc(r.courseTitle || 'N/A')}</td>
        <td>${esc(r.room || 'N/A')}</td>
      </tr>`).join('')}</tbody>
    </table>`;
  }

  /* Calendar / Complete / Program views */
  const isCalendar = view === 'calendar';
  const columns = isCalendar
    ? ['date', 'day', 'startTime', 'endTime', 'courseCode', 'courseTitle', 'program', 'semester', 'section', 'shift', 'teacher', 'room']
    : ['date', 'day', 'startTime', 'endTime', 'program', 'semester', 'section', 'shift', 'courseCode', 'courseTitle', 'teacher', 'room'];

  const heads = {
    date: 'Date', day: 'Day', startTime: 'Start', endTime: 'End',
    program: 'Program', semester: 'Sem.', section: 'Sec.', shift: 'Shift',
    courseCode: 'Code', courseTitle: 'Course Title',
    teacher: 'Teacher / Invigilator', room: 'Room'
  };

  return `<table class="print-table">
    <thead>
      <tr>${columns.map(c => `<th>${heads[c]}</th>`).join('')}</tr>
    </thead>
    <tbody>
      ${rows.map(r => `<tr>${columns.map(c => {
        const safeVal = c === 'teacher'
          ? (r.teacher && r.teacher.trim() ? r.teacher : 'Not Available')
          : (r[c] ?? '');
        return `<td>${esc(safeVal)}</td>`;
      }).join('')}</tr>`).join('')}
    </tbody>
  </table>`;
}

/* Build the full signature footer HTML */
function buildSignatureFooter() {
  return `<div class="print-footer">
    <div class="print-signature">
      <strong>HOD / Head of Department</strong>
      <div class="sig-row"><span class="sig-label">Signature:</span><span class="line"></span></div>
      <div class="sig-row"><span class="sig-label">Name:</span><span class="line"></span></div>
      <div class="sig-row"><span class="sig-label">Date:</span><span class="line"></span></div>
    </div>
    <div class="print-signature">
      <strong>Examination Coordinator</strong>
      <div class="sig-row"><span class="sig-label">Signature:</span><span class="line"></span></div>
      <div class="sig-row"><span class="sig-label">Name:</span><span class="line"></span></div>
      <div class="sig-row"><span class="sig-label">Date:</span><span class="line"></span></div>
    </div>
  </div>`;
}

/* Assemble or refresh the hidden #printDocument element */
function buildPrintDocument(rows, meta) {
  // Remove any stale print document first
  const stale = document.getElementById('printDocument');
  if (stale) stale.remove();

  const printDoc = document.createElement('div');
  printDoc.id = 'printDocument';
  printDoc.className = 'print-sheet';
  printDoc.innerHTML = buildPrintHeader(meta) + buildPrintTable(rows) + buildSignatureFooter();
  document.body.appendChild(printDoc);
  return printDoc;
}

/* Open browser print dialog */
function triggerPrint(rows, metaOverride) {
  const rowsToPrint = (rows && rows.length) ? rows : getCurrentPrintRows();
  if (!rowsToPrint.length) {
    alert('No records selected. Please select a teacher or class first.');
    return;
  }

  const meta = { ...getPrintMeta(rowsToPrint), ...metaOverride };
  meta.detail = stripLabelPrefix(meta.detail || '', meta.detailLabel || '');
  meta.generatedOn = stripLabelPrefix(meta.generatedOn || '', 'Generated');

  buildPrintDocument(rowsToPrint, meta);
  document.body.classList.add('print-mode');
  window.print();
}

/* Clean up after printing */
window.addEventListener('afterprint', () => {
  document.body.classList.remove('print-mode');
  const printDoc = document.getElementById('printDocument');
  if (printDoc) printDoc.remove();
});

/* ============================================================
   PDF DOWNLOAD  — directly saves a .pdf file via jsPDF
   ============================================================ */
function downloadPdf(rows, meta = {}, filename = 'CSET_Date_Sheet_Fall_2026.pdf') {
  if (!rows || !rows.length) {
    alert('No records to export. Please make a selection first.');
    return;
  }

  const resolvedMeta = { ...getPrintMeta(rows), ...meta, totalPapers: rows.length };
  resolvedMeta.detail = stripLabelPrefix(resolvedMeta.detail || '', resolvedMeta.detailLabel || '');
  resolvedMeta.generatedOn = stripLabelPrefix(resolvedMeta.generatedOn || '', 'Generated');

  const JspdfCtor = window.jspdf?.jsPDF;
  const hasPdfTablePlugin = !!(JspdfCtor && (
    typeof JspdfCtor.prototype?.autoTable === 'function' ||
    typeof JspdfCtor.API?.autoTable === 'function'
  ));

  if (!JspdfCtor || !hasPdfTablePlugin) {
    alert('PDF library is still loading. Please wait a moment and try again.');
    return;
  }

  const isTeacher = view === 'teacher';
  const isClass = view === 'class';

  // Use landscape for most, portrait for class (fewer columns)
  const orientation = isClass ? 'portrait' : 'landscape';
  const pageW = isClass ? 210 : 297;
  const pageH = isClass ? 297 : 210;
  const margin = 14;
  const usableW = pageW - margin * 2;

  const doc = new window.jspdf.jsPDF({ orientation, unit: 'mm', format: 'a4' });
  const cx = pageW / 2;

  const title   = resolvedMeta.title   || 'EMERSON UNIVERSITY MULTAN';
  const dept    = resolvedMeta.department || 'Department of Computing & Emerging Technology';
  const heading = resolvedMeta.heading  || 'CSET Mid Term Examination — Fall 2026';
  const semLbl  = resolvedMeta.semesterLabel || resolvedMeta.session || 'Fall 2026';
  const subtitle = resolvedMeta.subtitle || resolvedMeta.sheetType || 'Examination Date Sheet';
  const detail  = resolvedMeta.detail   || '';
  const period  = resolvedMeta.period   || periodForRows(rows);
  const genDate = `Generated: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}`;

  let y = 14;

  // Title block
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);

  const sessionLabel = resolvedMeta.session || semLbl || 'Fall 2026';
  const detailLabel = resolvedMeta.detailLabel || 'Relevant Details';
  const scopeValue = resolvedMeta.detail || detail || subtitle || 'Complete Examination Date Sheet';
  const totalLabel = String(rows.length);

  doc.setFontSize(15);
  doc.text(title, cx, y, { align: 'center' }); y += 6.5;

  doc.setFontSize(9.5);
  doc.text(dept, cx, y, { align: 'center' }); y += 5.5;

  doc.setFontSize(11.5);
  doc.text(heading, cx, y, { align: 'center' }); y += 5.5;

  doc.setFontSize(10);
  doc.text(sessionLabel, cx, y, { align: 'center' }); y += 5;

  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageW - margin, y); y += 5;

  doc.setFillColor(245, 248, 251);
  doc.roundedRect(margin, y, usableW, 18, 1.5, 1.5, 'F');
  doc.setDrawColor(180);
  doc.setLineWidth(0.2);
  doc.roundedRect(margin, y, usableW, 18, 1.5, 1.5, 'S');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('Date Sheet Details', margin + 5, y + 6.5);

  const detailItems = [
    `Type: ${resolvedMeta.sheetType || subtitle || 'Examination Date Sheet'}`,
    `${detailLabel}: ${stripLabelPrefix(scopeValue || '', detailLabel || '')}`,
    `Papers: ${totalLabel}`,
    `Generated: ${stripLabelPrefix(genDate || '', 'Generated')}`
  ];
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.4);
  detailItems.forEach((item, idx) => {
    const x = margin + 5 + (idx % 2) * (usableW / 2.1);
    const yy = y + 11 + (idx >= 2 ? 5 : 0);
    doc.text(item, x, yy);
  });
  y += 24;

  doc.setFontSize(10.5);
  doc.text(subtitle, cx, y, { align: 'center' }); y += 5.5;

  if (detail) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.text(detail, cx, y, { align: 'center' }); y += 5;
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(60, 60, 60);
  doc.text(period, margin, y);
  doc.text(genDate, pageW - margin, y, { align: 'right' }); y += 5;

  doc.setDrawColor(180);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageW - margin, y); y += 3;

  // Table definition per view type
  let head, body;

  if (isClass) {
    head = [['Sr.', 'Date', 'Day', 'Time', 'Course Code', 'Course Title', 'Room']];
    body = rows.map((r, i) => [
      i + 1,
      formatDate(r.date),
      r.day || '',
      `${r.startTime} – ${r.endTime}`,
      r.courseCode || 'N/A',
      r.courseTitle || 'N/A',
      r.room || 'N/A'
    ]);
  } else if (isTeacher) {
    head = [['Sr.', 'Date', 'Day', 'Time', 'Program', 'Sem.', 'Sec.', 'Shift', 'Course Code', 'Course Title', 'Room']];
    body = rows.map((r, i) => [
      i + 1,
      formatDate(r.date),
      r.day || '',
      `${r.startTime} – ${r.endTime}`,
      r.program || '',
      r.semester || '',
      r.section || '',
      r.shift || '',
      r.courseCode || 'N/A',
      r.courseTitle || 'N/A',
      r.room || 'N/A'
    ]);
  } else {
    head = [['Sr.', 'Date', 'Day', 'Time', 'Program', 'Sem.', 'Sec.', 'Shift', 'Course Code', 'Course Title', 'Teacher / Invigilator', 'Room']];
    body = rows.map((r, i) => [
      i + 1,
      formatDate(r.date),
      r.day || '',
      `${r.startTime} – ${r.endTime}`,
      r.program || '',
      r.semester || '',
      r.section || '',
      r.shift || '',
      r.courseCode || 'N/A',
      r.courseTitle || 'N/A',
      (r.teacher && r.teacher.trim()) ? r.teacher.trim() : 'Not Available',
      r.room || 'N/A'
    ]);
  }

  const pageFooterLeft = 'Emerson University Multan — FCET';

  doc.autoTable({
    startY: y,
    margin: { left: margin, right: margin },
    head,
    body,
    theme: 'grid',
    showHead: 'everyPage',
    styles: {
      fontSize: isClass ? 8.5 : 7.2,
      cellPadding: 2,
      textColor: [0, 0, 0],
      overflow: 'linebreak'
    },
    headStyles: {
      fillColor: [220, 232, 240],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      fontSize: isClass ? 8 : 6.8
    },
    rowPageBreak: 'avoid',
    didDrawPage: (hookData) => {
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(0);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      doc.text(title, cx, 14, { align: 'center' });
      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'normal');
      doc.text(dept, cx, 20, { align: 'center' });
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11.5);
      doc.text(heading, cx, 26, { align: 'center' });
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`${detailLabel}: ${scopeValue}`, cx, 32, { align: 'center' });
      doc.setDrawColor(180);
      doc.setLineWidth(0.4);
      doc.line(margin, 35, pageW - margin, 35);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100);
      doc.text(pageFooterLeft, margin, pageH - 6);
      doc.text(`Page ${hookData.pageNumber} of ?`, pageW - margin, pageH - 6, { align: 'right' });
    }
  });

  // Second pass: replace placeholder with real total page count
  const totalPages = doc.internal.getNumberOfPages();
  for (let pg = 1; pg <= totalPages; pg++) {
    doc.setPage(pg);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100);
    // Overwrite the footer area with correct text (white box first to clear placeholder)
    doc.setFillColor(255, 255, 255);
    doc.rect(pageW - margin - 35, pageH - 9, 35, 5, 'F');
    doc.text(
      `Page ${pg} of ${totalPages}`,
      pageW - margin, pageH - 6, { align: 'right' }
    );
  }

  // Keep signatures below the table and never overlap the last table row.
  const finalY = doc.lastAutoTable?.finalY || y;
  const signatureHeight = 36;
  let footerY = finalY + 12;
  if (footerY + signatureHeight > pageH - 8) {
    doc.addPage();
    footerY = 18;
  }

  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(0);

  // HOD signature block (left)
  const col1x = margin;
  const col2x = pageW / 2 + 10;
  const lineLen = usableW / 2 - 30;

  doc.line(col1x, footerY, col1x + lineLen, footerY);
  doc.line(col2x, footerY, col2x + lineLen, footerY);

  doc.text('HOD / Head of Department', col1x + lineLen / 2, footerY + 5, { align: 'center' });
  doc.text('Examination Coordinator', col2x + lineLen / 2, footerY + 5, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  const sigLabels = ['Signature:', 'Name:', 'Date:'];
  sigLabels.forEach((label, idx) => {
    const rowY = footerY + 13 + idx * 8;
    doc.text(`${label}`, col1x, rowY);
    doc.line(col1x + 18, rowY + 0.5, col1x + lineLen, rowY + 0.5);
    doc.text(`${label}`, col2x, rowY);
    doc.line(col2x + 18, rowY + 0.5, col2x + lineLen, rowY + 0.5);
  });

  doc.save(filename);
}

/* Generate a clean filename */
function pdfFilename(prefix, parts) {
  return `${prefix}_${parts.filter(Boolean).map(s => safe(String(s))).join('_')}_Fall_2026.pdf`;
}

/* ============================================================
   FILTER PANEL  (Complete date sheet)
   ============================================================ */
function filters() {
  return `<div class="filters">
    <div class="field"><label>Date</label><input id="f-date" type="date"></div>
    <div class="field"><label>Day</label><select id="f-day">${opts(uniq('day'))}</select></div>
    <div class="field"><label>Program</label><select id="f-program">${opts(uniq('program'))}</select></div>
    <div class="field"><label>Semester</label><select id="f-semester">${opts(uniq('semester'))}</select></div>
    <div class="field"><label>Section</label><select id="f-section">${opts(uniq('section'))}</select></div>
    <div class="field"><label>Shift</label><select id="f-shift">${opts(uniq('shift'))}</select></div>
    <div class="field"><label>Teacher</label><select id="f-teacher">${opts(getTeachers())}</select></div>
    <div class="field"><label>Course Code</label><select id="f-courseCode">${opts(uniq('courseCode'))}</select></div>
    <div class="field"><label>Room</label><select id="f-room">${opts(uniq('room'))}</select></div>
  </div>
  <div class="toolbar no-print" style="margin-top:14px">
    <button class="primary" id="apply">Apply filters</button>
    <button class="secondary" id="reset">Reset filters</button>
    <button class="secondary" id="print">Print results</button>
    <button class="secondary" id="pdfDownload">Download PDF</button>
  </div>`;
}

function filtered() {
  return data.filter(r => {
    const fDate = $('#f-date')?.value;
    if (fDate && r.date !== fDate) return false;

    const fDay = $('#f-day')?.value;
    if (fDay && r.day !== fDay) return false;

    const fProg = $('#f-program')?.value;
    if (fProg && r.program !== fProg) return false;

    const fSem = $('#f-semester')?.value;
    if (fSem && String(r.semester) !== fSem) return false;

    const fSec = $('#f-section')?.value;
    if (fSec && r.section !== fSec) return false;

    const fShift = $('#f-shift')?.value;
    if (fShift && r.shift !== fShift) return false;

    const fTeacher = $('#f-teacher')?.value;
    if (fTeacher) {
      const t = (r.teacher && r.teacher.trim()) ? r.teacher.trim() : 'Not Available';
      if (t !== fTeacher) return false;
    }

    const fCode = $('#f-courseCode')?.value;
    if (fCode && r.courseCode !== fCode) return false;

    const fRoom = $('#f-room')?.value;
    if (fRoom && r.room !== fRoom) return false;

    return true;
  }).sort(sortBySchedule);
}

/* ============================================================
   VIEW: Complete date sheet
   ============================================================ */
function complete() {
  app.innerHTML = layout(
    'Complete date sheet',
    `<p class="muted">Search and filter across the verified CSET examination schedule. <b id="count">${data.length}</b> records displayed.</p>
    ${filters()}
    <div id="results" style="margin-top:18px">${table([...data].sort(sortBySchedule))}</div>`
  );
  bindComplete();
}

function bindComplete() {
  const render = () => {
    const res = filtered();
    $('#results').innerHTML = table(res);
    $('#count').textContent = res.length;
  };
  $('#apply').onclick = render;
  $('#reset').onclick = () => {
    document.querySelectorAll('.filters input, .filters select').forEach(e => { e.value = ''; });
    render();
  };
  $('#print').onclick = () => {
    const res = filtered();
    triggerPrint(res, {
      subtitle: 'Complete Examination Date Sheet',
      detail: `Total records: ${res.length}`
    });
  };
  $('#pdfDownload').onclick = () => {
    const res = filtered();
    downloadPdf(
      res,
      { subtitle: 'Complete Examination Date Sheet', detail: `Total records: ${res.length}` },
      pdfFilename('Complete_Examination', [])
    );
  };
}

function selector(label, id, values) {
  return `<div class="field"><label>${label}</label><select id="${id}">${opts(values, 'Select ' + label)}</select></div>`;
}

/* ============================================================
   VIEW: Teacher date sheets
   ============================================================ */
function teacher() {
  app.innerHTML = layout(
    'Teacher date sheets',
    `<p class="muted">Select an invigilator or "Not Available" to view all assigned papers.</p>
    <div class="toolbar">
      ${selector('Teacher', 'teacherSelect', getTeachers())}
      <button class="primary" id="viewTeacher">View schedule</button>
      <button class="secondary" id="teacherPrint">Print</button>
      <button class="secondary" id="teacherPdf">Download PDF</button>
    </div>
    <div id="teacherResult" style="margin-top:18px"></div>`
  );
  $('#viewTeacher').onclick = renderTeacher;
  $('#teacherSelect').onchange = renderTeacher;

  $('#teacherPrint').onclick = () => {
    if (!selected.length) {
      alert('Please select a teacher first.');
      return;
    }
    const teacherName = $('#teacherSelect').value;
    triggerPrint(selected, {
      subtitle: 'Teacher-Wise Examination Date Sheet',
      detail: `Teacher / Invigilator: ${teacherName}`
    });
  };

  $('#teacherPdf').onclick = () => {
    if (!selected.length) {
      alert('Please select a teacher first.');
      return;
    }
    const teacherName = $('#teacherSelect').value;
    downloadPdf(
      selected,
      {
        subtitle: 'Teacher-Wise Examination Date Sheet',
        detail: `Teacher / Invigilator: ${teacherName}`
      },
      pdfFilename('Teacher', [teacherName])
    );
  };
}

function renderTeacher() {
  const t = $('#teacherSelect').value;
  if (!t) {
    selected = [];
    $('#teacherResult').innerHTML = '<div class="empty">Please select a teacher from the list above.</div>';
    return;
  }
  selected = data.filter(x => {
    const actualTeacher = (x.teacher && x.teacher.trim()) ? x.teacher.trim() : 'Not Available';
    return actualTeacher === t;
  }).sort(sortBySchedule);

  $('#teacherResult').innerHTML = `<h3>${esc(t)} · ${selected.length} paper${selected.length === 1 ? '' : 's'}</h3>${table(selected, true)}`;
}

/* ============================================================
   VIEW: Program-wise date sheets
   ============================================================ */
function program() {
  app.innerHTML = layout(
    'Program-wise date sheets',
    `<p class="muted">Select a program to generate the full degree schedule. Filter optionally by semester, section, or shift.</p>
    <div class="toolbar">
      ${selector('Program', 'programSelect', uniq('program'))}
      ${selector('Semester', 'programSem', uniq('semester'))}
      ${selector('Section', 'programSec', uniq('section'))}
      ${selector('Shift', 'programShift', uniq('shift'))}
      <button class="primary" id="programView">View date sheet</button>
      <button class="secondary" id="programPrint">Print</button>
      <button class="secondary" id="programPdf">Download PDF</button>
    </div>
    <div id="programResult" style="margin-top:18px"></div>`
  );
  $('#programView').onclick = renderProgram;
  $('#programSelect').onchange = renderProgram;
  $('#programSem').onchange = renderProgram;
  $('#programSec').onchange = renderProgram;
  $('#programShift').onchange = renderProgram;

  $('#programPrint').onclick = () => {
    if (!selected.length) {
      alert('Please select a program first.');
      return;
    }
    const p = $('#programSelect').value;
    const sem = $('#programSem').value;
    const sec = $('#programSec').value;
    const shift = $('#programShift').value;
    let detail = p;
    if (sem) detail += ` · Semester ${sem}`;
    if (sec) detail += ` · Section ${sec}`;
    if (shift) detail += ` · ${shift}`;
    triggerPrint(selected, { subtitle: 'Program-Wise Examination Date Sheet', detail });
  };

  $('#programPdf').onclick = () => {
    if (!selected.length) {
      alert('Please select a program first.');
      return;
    }
    const p = $('#programSelect').value;
    const sem = $('#programSem').value;
    const sec = $('#programSec').value;
    const shift = $('#programShift').value;
    let detail = p;
    if (sem) detail += ` · Semester ${sem}`;
    if (sec) detail += ` · Section ${sec}`;
    if (shift) detail += ` · ${shift}`;
    downloadPdf(
      selected,
      { subtitle: 'Program-Wise Examination Date Sheet', detail },
      pdfFilename('Program', [p, sem, sec, shift])
    );
  };
}

function renderProgram() {
  const p = $('#programSelect').value;
  if (!p) {
    selected = [];
    $('#programResult').innerHTML = '<div class="empty">Please select a degree program to continue.</div>';
    return;
  }
  const sem = $('#programSem').value;
  const sec = $('#programSec').value;
  const shift = $('#programShift').value;

  selected = data.filter(x => {
    if (x.program !== p) return false;
    if (sem && String(x.semester) !== sem) return false;
    if (sec && x.section !== sec) return false;
    if (shift && x.shift !== shift) return false;
    return true;
  }).sort(sortBySchedule);

  let subtitle = esc(p);
  if (sem) subtitle += ` · Semester ${esc(sem)}`;
  if (sec) subtitle += ` · Section ${esc(sec)}`;
  if (shift) subtitle += ` · ${esc(shift)}`;

  $('#programResult').innerHTML = `<h3>${subtitle} · ${selected.length} paper${selected.length === 1 ? '' : 's'}</h3>${table(selected)}`;
}

/* ============================================================
   VIEW: Class-wise date sheets
   ============================================================ */
function classView() {
  app.innerHTML = layout(
    'Class-wise date sheets',
    `<p class="muted">Select all four class attributes (Program, Semester, Section, Shift) to view the class date sheet.</p>
    <div class="toolbar">
      ${selector('Program', 'classP', uniq('program'))}
      ${selector('Semester', 'classS', uniq('semester'))}
      ${selector('Section', 'classSec', uniq('section'))}
      ${selector('Shift', 'classSh', uniq('shift'))}
      <button class="primary" id="classSubmit">View class sheet</button>
      <button class="secondary" id="classPrint">Print</button>
      <button class="secondary" id="classPdf" title="Download selected class as PDF">Download PDF</button>
    </div>
    <div id="classResult" style="margin-top:18px"></div>`
  );

  const renderClass = () => {
    const p = $('#classP').value;
    const s = $('#classS').value;
    const sec = $('#classSec').value;
    const sh = $('#classSh').value;

    if (!p || !s || !sec || !sh) {
      selected = [];
      $('#classResult').innerHTML = '<div class="empty">Please select all four class attributes (Program, Semester, Section, and Shift).</div>';
      return;
    }

    selected = data.filter(x =>
      x.program === p &&
      String(x.semester) === s &&
      x.section === sec &&
      x.shift === sh
    ).sort(sortBySchedule);

    if (!selected.length) {
      $('#classResult').innerHTML = `<div class="empty">No examination records found for ${esc(p)} Semester ${esc(s)} Section ${esc(sec)} (${esc(sh)}).</div>`;
      return;
    }

    $('#classResult').innerHTML = `<h3>${esc(p)} · Semester ${esc(s)} · Section ${esc(sec)} · ${esc(sh)} · ${selected.length} papers</h3>${table(selected)}`;
  };

  $('#classSubmit').onclick = renderClass;
  $('#classP').onchange = renderClass;
  $('#classS').onchange = renderClass;
  $('#classSec').onchange = renderClass;
  $('#classSh').onchange = renderClass;

  $('#classPrint').onclick = () => {
    if (!selected.length) {
      alert('Please select all four class attributes first.');
      return;
    }
    const p = $('#classP').value;
    const s = $('#classS').value;
    const sec = $('#classSec').value;
    const sh = $('#classSh').value;
    triggerPrint(selected, {
      subtitle: 'Class-Wise Examination Date Sheet',
      detail: `${p} · Semester ${s} · Section ${sec} · ${sh} Shift`
    });
  };

  $('#classPdf').onclick = () => {
    if (!selected.length) {
      alert('Please select all four class attributes first.');
      return;
    }
    const p = $('#classP').value;
    const s = $('#classS').value;
    const sec = $('#classSec').value;
    const sh = $('#classSh').value;
    downloadPdf(
      selected,
      {
        subtitle: 'Class-Wise Examination Date Sheet',
        detail: `${p} · Semester ${s} · Section ${sec} · ${sh} Shift`
      },
      pdfFilename(safe(p), [`Semester_${s}`, `Section_${sec}`, sh])
    );
  };
}

/* ============================================================
   VIEW: Examination calendar
   ============================================================ */
function calendar() {
  const groups = {};
  const tFilter = $('#calTeacher')?.value || '';
  const pFilter = $('#calProgram')?.value || '';

  const matched = data.filter(x => {
    if (tFilter) {
      const actualTeacher = (x.teacher && x.teacher.trim()) ? x.teacher.trim() : 'Not Available';
      if (actualTeacher !== tFilter) return false;
    }
    if (pFilter && x.program !== pFilter) return false;
    return true;
  }).sort(sortBySchedule);

  matched.forEach(x => {
    (groups[x.date] ??= []).push(x);
  });

  const datesSorted = Object.keys(groups).sort();

  app.innerHTML = layout(
    'Examination calendar',
    `<div class="toolbar no-print">
      ${selector('Teacher', 'calTeacher', getTeachers())}
      ${selector('Program', 'calProgram', uniq('program'))}
      <button class="primary" id="calApply">Filter calendar</button>
      <button class="secondary" id="calPrint">Print calendar</button>
      <button class="secondary" id="calPdf">Download PDF</button>
    </div>
    <div id="calContent" style="margin-top:14px">
      ${datesSorted.length ? datesSorted.map(d => {
        const rs = groups[d];
        const dateObj = new Date(d + 'T00:00:00');
        const formattedDate = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
        return `<div class="calendar-day">
          <h3>${formattedDate} · ${rs.length} examination${rs.length === 1 ? '' : 's'}</h3>
          ${rs.map(x => `<div class="event">
            <b>${esc(x.startTime)} – ${esc(x.endTime)}<br><small style="color:var(--muted)">Slot ${esc(x.slot)}</small></b>
            <span><b>${esc(x.courseCode)}: ${esc(x.courseTitle)}</b><br><small>${esc(x.program)} · Sem ${esc(x.semester)} · Sec ${esc(x.section)} · ${esc(x.shift)}</small></span>
            <span><b>${esc(x.room)}</b><br><small>${esc(x.teacher && x.teacher.trim() ? x.teacher : 'Not Available')}</small></span>
          </div>`).join('')}
        </div>`;
      }).join('') : '<div class="empty">No matching calendar records for the selected filters.</div>'}
    </div>`
  );

  if (tFilter && $('#calTeacher')) $('#calTeacher').value = tFilter;
  if (pFilter && $('#calProgram')) $('#calProgram').value = pFilter;

  $('#calApply').onclick = calendar;
  $('#calTeacher').onchange = calendar;
  $('#calProgram').onchange = calendar;
  $('#calPrint').onclick = () => {
    triggerPrint(matched, {
      subtitle: 'Examination Calendar',
      detail: `${tFilter || 'All teachers'} · ${pFilter || 'All programs'}`
    });
  };
  $('#calPdf').onclick = () => downloadPdf(matched, {
    subtitle: 'Examination Calendar',
    detail: `${tFilter || 'All teachers'} · ${pFilter || 'All programs'}`
  }, pdfFilename('Examination_Calendar', [tFilter, pFilter]));
}

/* ============================================================
   VIEW: Dashboard
   ============================================================ */
function dashboard() {
  app.innerHTML = stats() + layout(
    'Portal overview',
    `<p class="muted">Explore Emerson University Multan FCET examination date sheets by complete list, teacher/invigilator, program, individual class, or calendar schedule.</p>
    <div class="toolbar">
      <button class="primary" onclick="show('complete')">Complete date sheet</button>
      <button class="secondary" onclick="show('teacher')">Teacher sheets</button>
      <button class="secondary" onclick="show('program')">Program sheets</button>
      <button class="secondary" onclick="show('class')">Class sheets</button>
      <button class="secondary" onclick="show('calendar')">Calendar view</button>
    </div>`
  );
}

/* ============================================================
   ROUTING
   ============================================================ */
function show(v) {
  view = v;
  document.querySelectorAll('nav button').forEach(b => b.classList.toggle('active', b.dataset.view === v));
  const views = {
    dashboard,
    complete,
    teacher,
    program,
    class: classView,
    calendar
  };
  (views[v] || dashboard)();
}

document.querySelectorAll('nav button').forEach(b => {
  b.onclick = () => show(b.dataset.view);
});

$('#theme').onclick = () => {
  document.body.classList.toggle('dark');
};

/* ============================================================
   INIT
   ============================================================ */
function initApp() {
  if (window.EXAM_DATA && Array.isArray(window.EXAM_DATA) && window.EXAM_DATA.length > 0) {
    data = validatedRecords(window.EXAM_DATA);
    dashboard();
  } else {
    fetch('data/exam_schedule.json')
      .then(r => {
        if (!r.ok) throw new Error('Network error');
        return r.json();
      })
      .then(x => {
        data = validatedRecords(x);
        dashboard();
      })
      .catch(() => {
        app.innerHTML = '<div class="card empty">Could not load the schedule. If opened via file://, a local static server like <b>py -m http.server</b> is recommended, then open http://localhost:8000.</div>';
      });
  }
}

initApp();
