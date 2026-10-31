const $ = s => document.querySelector(s);
const app = $('#app');
let data = [];
let view = 'dashboard';
let selected = [];
let liveTickerInterval = null;
let simulationMode = 'real';
let simulatedTime = null;
let currentLiveProgFilter = '';
let activeProgramTab = '';

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
  return Array.isArray(records)
    ? records.filter(isValidExamRecord).map(record => ({
      ...record,
      courseTitle: decodeHtml(record.courseTitle)
    }))
    : [];
}

function decodeHtml(str) {
  if (!str) return '';
  str = String(str);
  for (let i = 0; i < 3; i++) {
    str = str
      .replace(/&amp;amp;/g, '&amp;')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }
  return str.replace(/\s{2,}/g, ' ').trim();
}

const esc = s => decodeHtml(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

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

function uniq(k, subset = null) {
  const source = Array.isArray(subset) ? subset : data;
  return [...new Set(source.map(x => x[k]).filter(v => v !== null && v !== undefined && String(v).trim() !== ''))].sort((a, b) =>
    String(a).localeCompare(String(b), undefined, { numeric: true })
  );
}

function getTeachers(subset = null) {
  const source = Array.isArray(subset) ? subset : data;
  const set = new Set();
  source.forEach(r => {
    const t = (r.teacher && r.teacher.trim()) ? r.teacher.trim() : 'Not Available';
    set.add(t);
  });
  return [...set].sort((a, b) => {
    if (a === 'Not Available') return 1;
    if (b === 'Not Available') return -1;
    return a.localeCompare(b, undefined, { numeric: true });
  });
}

function opts(arr, empty = 'All', selectedVal = '') {
  return `<option value="">${empty}</option>` + arr.map(x => {
    const isSel = String(x) === String(selectedVal) ? ' selected' : '';
    return `<option value="${esc(x)}"${isSel}>${esc(x)}</option>`;
  }).join('');
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

/* Enhanced Room Badge & Teacher Cell */
function roomBadge(room) {
  if (!room) return '<span class="room-badge">N/A</span>';
  return `<span class="room-badge"><svg viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>${esc(room)}</span>`;
}

function teacherCell(teacher) {
  const t = teacher && teacher.trim();
  if (t && t !== 'Not Available') {
    return `<span class="teacher-cell"><span>👤</span><span>${esc(t)}</span></span>`;
  }
  return '<span class="teacher-badge-none">Not Assigned</span>';
}

function table(rows, mode = 'default') {
  if (!rows || !rows.length) {
    return '<div class="empty">No matching examination records found.</div>';
  }

  let cols;
  if (mode === true || mode === 'teacher') {
    cols = ['date', 'day', 'startTime', 'endTime', 'courseCode', 'courseTitle', 'program', 'semester', 'section', 'shift', 'room'];
  } else if (mode === 'class') {
    cols = ['date', 'day', 'startTime', 'endTime', 'courseCode', 'courseTitle', 'teacher', 'room'];
  } else if (mode === 'program') {
    cols = ['date', 'day', 'startTime', 'endTime', 'semester', 'section', 'shift', 'courseCode', 'courseTitle', 'teacher', 'room'];
  } else {
    cols = ['date', 'day', 'startTime', 'endTime', 'program', 'semester', 'section', 'shift', 'courseCode', 'courseTitle', 'teacher', 'room'];
  }

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
    room: 'Room / Venue'
  };

  return `<div class="table-wrap"><table>
    <thead><tr>${cols.map(c => `<th>${heads[c]}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(r => `<tr>${cols.map(c => {
      if (c === 'shift') return `<td><span class="badge">${esc(r[c] || '')}</span></td>`;
      if (c === 'teacher') return `<td>${teacherCell(r.teacher)}</td>`;
      if (c === 'room') return `<td>${roomBadge(r.room)}</td>`;
      if (c === 'courseTitle') return `<td><b>${esc(r.courseTitle)}</b></td>`;
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
    const sem = $('#programSem')?.value;
    const sec = $('#programSec')?.value;
    const shift = $('#programShift')?.value;
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
      classContext: { program: p, semester: s, section: sec, shift },
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
  const classContext = meta.classContext;

  const details = [
    ['Date Sheet Type', meta.sheetType || meta.subtitle || 'Examination Date Sheet'],
    [meta.detailLabel || 'Selection', cleanDetail],
    ['Examination Period', cleanPeriod],
    ['Total Papers', String(meta.totalPapers ?? 0)],
    ['Session', meta.session || 'Fall 2026'],
    ['Date Generated', cleanGeneratedOn]
  ].filter(([label]) => !(classContext && label === meta.detailLabel));

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
    ${classContext ? `<div class="print-context-line"><span>Class:</span> ${esc(classContext.program)} · Semester ${esc(classContext.semester)} · Section ${esc(classContext.section)} · ${esc(classContext.shift)} Shift</div>` : ''}
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
  const isProgramSheet = view === 'program';

  if (isClassSheet) {
    return `<table class="print-table class-print-table">
      <thead><tr>
        <th>Sr.</th><th>Date</th><th>Day</th><th>Time</th>
        <th>Course Code</th><th>Course Title</th><th>Teacher / Invigilator</th><th>Room</th>
      </tr></thead>
      <tbody>${rows.map((r, i) => `<tr>
        <td>${i + 1}</td>
        <td>${esc(formatDate(r.date))}</td>
        <td>${esc(r.day)}</td>
        <td>${esc(r.startTime)} – ${esc(r.endTime)}</td>
        <td>${esc(r.courseCode || 'N/A')}</td>
        <td>${esc(r.courseTitle || 'N/A')}</td>
        <td>${esc((r.teacher && r.teacher.trim()) ? r.teacher.trim() : 'Not Available')}</td>
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

  if (isProgramSheet) {
    return `<table class="print-table program-print-table">
      <thead><tr>
        <th>Sr.</th><th>Date</th><th>Day</th><th>Time</th>
        <th>Sem.</th><th>Sec.</th><th>Shift</th>
        <th>Course Code</th><th>Course Title</th><th>Teacher / Invigilator</th><th>Room</th>
      </tr></thead>
      <tbody>${rows.map((r, i) => `<tr>
        <td>${i + 1}</td>
        <td>${esc(formatDate(r.date))}</td>
        <td>${esc(r.day)}</td>
        <td>${esc(r.startTime)} – ${esc(r.endTime)}</td>
        <td>${esc(r.semester)}</td>
        <td>${esc(r.section)}</td>
        <td>${esc(r.shift)}</td>
        <td>${esc(r.courseCode || 'N/A')}</td>
        <td>${esc(r.courseTitle || 'N/A')}</td>
        <td>${esc((r.teacher && r.teacher.trim()) ? r.teacher.trim() : 'Not Available')}</td>
        <td>${esc(r.room || 'N/A')}</td>
      </tr>`).join('')}</tbody>
    </table>`;
  }

  /* Calendar / Complete views */
  const columns = ['date', 'day', 'startTime', 'endTime', 'program', 'semester', 'section', 'shift', 'courseCode', 'courseTitle', 'teacher', 'room'];
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

/* Official Signature Footer */
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
  const stale = document.getElementById('printDocument');
  if (stale) stale.remove();

  const printDoc = document.createElement('div');
  printDoc.id = 'printDocument';
  printDoc.className = `print-sheet${view === 'class' ? ' class-print-sheet' : ''}`;
  printDoc.innerHTML = buildPrintHeader(meta) + buildPrintTable(rows) + buildSignatureFooter();
  document.body.appendChild(printDoc);
  return printDoc;
}

/* Open browser print dialog */
function triggerPrint(rows, metaOverride) {
  const rowsToPrint = (rows && rows.length) ? rows : getCurrentPrintRows();
  if (!rowsToPrint.length) {
    alert('No records selected. Please make a selection first.');
    return;
  }

  const meta = { ...getPrintMeta(rowsToPrint), ...metaOverride };
  meta.detail = stripLabelPrefix(meta.detail || '', meta.detailLabel || '');
  meta.generatedOn = stripLabelPrefix(meta.generatedOn || '', 'Generated');

  buildPrintDocument(rowsToPrint, meta);
  document.body.classList.add('print-mode');
  window.print();
}

window.addEventListener('afterprint', () => {
  document.body.classList.remove('print-mode');
  const printDoc = document.getElementById('printDocument');
  if (printDoc) printDoc.remove();
});

/* ============================================================
   PDF DOWNLOAD — directly saves a .pdf file via jsPDF
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
  const isProgram = view === 'program';
  const logoImage = document.querySelector('.logo');

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
  const sessionLabel = resolvedMeta.session || semLbl || 'Fall 2026';
  const detailLabel = resolvedMeta.detailLabel || 'Relevant Details';
  const scopeValue = resolvedMeta.detail || detail || subtitle || 'Complete Examination Date Sheet';
  const totalLabel = String(rows.length);
  const classContext = resolvedMeta.classContext;

  const drawPageHeader = () => {
    doc.setTextColor(0, 0, 0);
    if (logoImage && logoImage.complete && logoImage.naturalWidth) {
      try {
        doc.addImage(logoImage, 'PNG', margin, 7, 20, 20);
      } catch (err) {
        // Fallback without logo
      }
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text(title, cx, 14, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.text(dept, cx, 20, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    doc.text(heading.replace('—', '-'), cx, 26, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(sessionLabel, cx, 32, { align: 'center' });

    let ruleY = 36;
    if (classContext) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      const contextLine = `Class: ${classContext.program} | Semester: ${classContext.semester} | Section: ${classContext.section} | Shift: ${classContext.shift}`;
      const contextLines = doc.splitTextToSize(contextLine, usableW);
      doc.text(contextLines, cx, 38, { align: 'center' });
      ruleY = 38 + (contextLines.length * 4);
    }

    doc.setDrawColor(0);
    doc.setLineWidth(0.4);
    doc.line(margin, ruleY, pageW - margin, ruleY);
  };

  let y = classContext ? 48 : 42;

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
    ...(classContext ? [] : [`${detailLabel}: ${stripLabelPrefix(scopeValue || '', detailLabel || '')}`]),
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

  if (!classContext) {
    doc.setFontSize(10.5);
    doc.setFont('helvetica', 'bold');
    doc.text(subtitle, cx, y, { align: 'center' }); y += 5.5;

    if (detail) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.text(detail, cx, y, { align: 'center' }); y += 5;
    }
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(60, 60, 60);
  doc.text(period.replace(/[–—]/g, '-'), margin, y);
  doc.text(genDate, pageW - margin, y, { align: 'right' }); y += 5;

  doc.setDrawColor(180);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageW - margin, y); y += 3;

  // Table definition per view type
  let head, body;

  if (isClass) {
    head = [['Sr.', 'Date', 'Day', 'Time', 'Course Code', 'Course Title', 'Teacher / Invigilator', 'Room']];
    body = rows.map((r, i) => [
      i + 1,
      formatDate(r.date),
      r.day || '',
      `${r.startTime} - ${r.endTime}`,
      r.courseCode || 'N/A',
      decodeHtml(r.courseTitle || 'N/A'),
      (r.teacher && r.teacher.trim()) ? r.teacher.trim() : 'Not Available',
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
      decodeHtml(r.courseTitle || 'N/A'),
      r.room || 'N/A'
    ]);
  } else if (isProgram) {
    head = [['Sr.', 'Date', 'Day', 'Time', 'Sem.', 'Sec.', 'Shift', 'Course Code', 'Course Title', 'Teacher / Invigilator', 'Room']];
    body = rows.map((r, i) => [
      i + 1,
      formatDate(r.date),
      r.day || '',
      `${r.startTime} – ${r.endTime}`,
      r.semester || '',
      r.section || '',
      r.shift || '',
      r.courseCode || 'N/A',
      decodeHtml(r.courseTitle || 'N/A'),
      (r.teacher && r.teacher.trim()) ? r.teacher.trim() : 'Not Available',
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
      decodeHtml(r.courseTitle || 'N/A'),
      (r.teacher && r.teacher.trim()) ? r.teacher.trim() : 'Not Available',
      r.room || 'N/A'
    ]);
  }

  const pageFooterLeft = 'Emerson University Multan - FCET';

  doc.autoTable({
    startY: y,
    margin: { top: classContext ? 48 : 42, right: margin, bottom: 14, left: margin },
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
    didDrawPage: () => {
      drawPageHeader();
    }
  });

  // Keep signatures below the table and never overlap the last table row.
  const finalY = doc.lastAutoTable?.finalY || y;
  const signatureHeight = 36;
  const bottomSignatureY = pageH - 14 - signatureHeight;
  let footerY = Math.max(finalY + 10, bottomSignatureY);
  if (footerY > bottomSignatureY) {
    doc.addPage();
    drawPageHeader();
    footerY = bottomSignatureY;
  }

  const signatureGap = 8;
  const signatureWidth = (usableW - signatureGap) / 2;
  const signatureLabels = ['HOD / Head of Department', 'Examination Coordinator'];
  doc.setFontSize(8);
  doc.setLineWidth(0.25);
  signatureLabels.forEach((label, index) => {
    const x = margin + index * (signatureWidth + signatureGap);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(150, 165, 180);
    doc.roundedRect(x, footerY, signatureWidth, signatureHeight, 2, 2, 'FD');
    doc.setFillColor(15, 76, 129);
    doc.roundedRect(x, footerY, signatureWidth, 8, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text(label, x + signatureWidth / 2, footerY + 5.5, { align: 'center' });
    doc.setTextColor(0, 0, 0);
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const sigLabels = ['Signature:', 'Name:', 'Date:'];
  sigLabels.forEach((label, idx) => {
    const rowY = footerY + 15 + idx * 7;
    for (let index = 0; index < signatureLabels.length; index++) {
      const x = margin + index * (signatureWidth + signatureGap);
      doc.text(label, x + 5, rowY);
      doc.setDrawColor(80, 95, 110);
      doc.line(x + 24, rowY + 0.5, x + signatureWidth - 5, rowY + 0.5);
    }
  });

  const totalPages = doc.internal.getNumberOfPages();
  for (let pg = 1; pg <= totalPages; pg++) {
    doc.setPage(pg);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100);
    doc.text(pageFooterLeft, margin, pageH - 6);
    doc.text(`Page ${pg} of ${totalPages}`, pageW - margin, pageH - 6, { align: 'right' });
  }

  doc.save(filename);
}

function pdfFilename(prefix, parts) {
  return `${prefix}_${parts.filter(Boolean).map(s => safe(String(s))).join('_')}_Fall_2026.pdf`;
}

/* ============================================================
   REAL-TIME TIME & PAPER STATUS ENGINE
   ============================================================ */
function parseExamDateTime(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null;
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3) return null;
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const meridiem = match[3].toUpperCase();
  if (meridiem === 'PM' && hours < 12) hours += 12;
  if (meridiem === 'AM' && hours === 12) hours = 0;
  return new Date(parts[0], parts[1] - 1, parts[2], hours, minutes, 0, 0);
}

function getEffectiveNow() {
  if (simulationMode === 'demo1') {
    // Thu Oct 29, 1:30 PM (Mid-exam Slot 3)
    return new Date(2026, 9, 29, 13, 30, 0);
  } else if (simulationMode === 'demo2') {
    // Thu Oct 29, 8:45 AM (15m before Slot 1)
    return new Date(2026, 9, 29, 8, 45, 0);
  } else if (simulationMode === 'demo3') {
    // Fri Oct 30, 2:15 PM (Friday afternoon Slot 3)
    return new Date(2026, 9, 30, 14, 15, 0);
  } else if (simulationMode === 'demo4') {
    // Mon Nov 02, 9:15 AM (Monday Slot 1)
    return new Date(2026, 10, 2, 9, 15, 0);
  } else if (simulationMode === 'custom' && simulatedTime) {
    return new Date(simulatedTime);
  }
  return new Date();
}

function formatCountdown(ms) {
  if (ms <= 0) return { days: '00', hours: '00', mins: '00', secs: '00', totalSecs: 0, text: 'Starting now' };
  const totalSecs = Math.floor(ms / 1000);
  const days = Math.floor(totalSecs / 86400);
  const hours = Math.floor((totalSecs % 86400) / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;

  let text = '';
  if (days > 0) text += `${days}d `;
  if (days > 0 || hours > 0) text += `${hours}h `;
  text += `${mins}m ${secs}s`;

  return {
    days: String(days).padStart(2, '0'),
    hours: String(hours).padStart(2, '0'),
    mins: String(mins).padStart(2, '0'),
    secs: String(secs).padStart(2, '0'),
    totalSecs,
    text: text.trim()
  };
}

function formatMinutesRemaining(ms) {
  if (ms <= 0) return '0 min';
  const totalMins = Math.round(ms / 60000);
  if (totalMins >= 60) {
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    return `${h}h ${m}m`;
  }
  return `${totalMins} min`;
}

function getLiveScheduleStatus(now, progFilter = '') {
  let records = data;
  if (progFilter) {
    records = records.filter(r => r.program === progFilter);
  }

  const active = [];
  const upcomingToday = [];
  const allFuture = [];

  const nowMs = now.getTime();
  const todayYMD = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  records.forEach(r => {
    const start = parseExamDateTime(r.date, r.startTime);
    const end = parseExamDateTime(r.date, r.endTime);
    if (!start || !end) return;

    const startMs = start.getTime();
    const endMs = end.getTime();

    if (nowMs >= startMs && nowMs <= endMs) {
      const progress = Math.min(100, Math.max(0, ((nowMs - startMs) / (endMs - startMs)) * 100));
      active.push({ ...r, start, end, progress, msRemaining: endMs - nowMs });
    } else if (r.date === todayYMD && startMs > nowMs) {
      upcomingToday.push({ ...r, start, end, msUntil: startMs - nowMs });
    } else if (startMs > nowMs) {
      allFuture.push({ ...r, start, end, msUntil: startMs - nowMs });
    }
  });

  active.sort(sortBySchedule);
  upcomingToday.sort((a, b) => a.start - b.start || sortBySchedule(a, b));
  allFuture.sort((a, b) => a.start - b.start || sortBySchedule(a, b));

  let nextSession = null;
  if (upcomingToday.length > 0) {
    const earliestTime = upcomingToday[0].start.getTime();
    nextSession = {
      isToday: true,
      time: upcomingToday[0].start,
      endTime: upcomingToday[0].end,
      msUntil: upcomingToday[0].msUntil,
      exams: upcomingToday.filter(x => x.start.getTime() === earliestTime)
    };
  } else if (allFuture.length > 0) {
    const earliestTime = allFuture[0].start.getTime();
    nextSession = {
      isToday: false,
      time: allFuture[0].start,
      endTime: allFuture[0].end,
      msUntil: allFuture[0].msUntil,
      exams: allFuture.filter(x => x.start.getTime() === earliestTime)
    };
  }

  return { active, upcomingToday, nextSession, allFuture };
}

/* Render Live Tracker Widget */
function renderLiveTrackerWidget(container, isDedicatedView = false) {
  if (!container) return;

  const now = getEffectiveNow();
  const { active, upcomingToday, nextSession } = getLiveScheduleStatus(now, currentLiveProgFilter);

  const formattedNow = now.toLocaleDateString('en-GB', {
    weekday: 'long', day: '2-digit', month: 'short', year: 'numeric'
  }) + ' · ' + now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const progOptions = opts(uniq('program'), 'All Programs', currentLiveProgFilter);

  let statusContent = '';

  // 1. ACTIVE EXAMS (LIVE NOW)
  if (active.length > 0) {
    const slotEndTime = active[0].endTime;
    const timeRemainingStr = formatMinutesRemaining(active[0].msRemaining);
    statusContent += `
      <div class="active-exams-container">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
          <div class="live-badge-now">
            <span class="live-dot-pulse"></span> LIVE NOW: ${active.length} PAPER${active.length === 1 ? '' : 'S'} IN PROGRESS
          </div>
          <span style="font-size:12.5px;color:var(--muted);font-weight:700">
            Slot ends at ${esc(slotEndTime)} (${timeRemainingStr} remaining)
          </span>
        </div>
        <div class="active-exams-grid">
          ${active.map(x => `
            <div class="active-exam-card">
              <div>
                <div class="active-exam-title">${esc(x.courseCode)}: ${esc(x.courseTitle)}</div>
                <div class="active-exam-meta">
                  <b>${esc(x.program)}</b><br>
                  Semester ${esc(x.semester)} · Section ${esc(x.section)} · <span class="badge">${esc(x.shift)}</span>
                </div>
              </div>
              <div class="time-progress-bar-bg" title="${Math.round(x.progress)}% elapsed">
                <div class="time-progress-bar-fill" style="width: ${Math.round(x.progress)}%"></div>
              </div>
              <div class="active-exam-footer">
                <div>
                  <small style="color:var(--muted);display:block;font-size:10px;text-transform:uppercase;font-weight:700">Classroom / Room</small>
                  ${roomBadge(x.room)}
                </div>
                <div style="text-align:right">
                  <small style="color:var(--muted);display:block;font-size:10px;text-transform:uppercase;font-weight:700">Teacher / Invigilator</small>
                  ${teacherCell(x.teacher)}
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // 2. UPCOMING EXAMS & NEXT SESSION COUNTDOWN
  if (nextSession) {
    const cd = formatCountdown(nextSession.msUntil);
    const sessionDateStr = nextSession.time.toLocaleDateString('en-GB', {
      weekday: 'long', day: '2-digit', month: 'short', year: 'numeric'
    });
    const sessionTimeStr = nextSession.time.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) +
      ' – ' + nextSession.endTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

    statusContent += `
      <div class="upcoming-box">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
          <h4>${nextSession.isToday ? '⏳ Upcoming Today' : '📅 Next Examination Session'}: ${esc(sessionDateStr)} (${esc(sessionTimeStr)})</h4>
          <span style="font-size:12.5px;font-weight:700;color:var(--blue)">${nextSession.exams.length} Paper${nextSession.exams.length === 1 ? '' : 's'} Scheduled</span>
        </div>
        <div class="countdown-strip">
          <div class="countdown-unit"><span class="num">${cd.days}</span><span class="lbl">Days</span></div>
          <div class="countdown-unit"><span class="num">${cd.hours}</span><span class="lbl">Hours</span></div>
          <div class="countdown-unit"><span class="num">${cd.mins}</span><span class="lbl">Mins</span></div>
          <div class="countdown-unit"><span class="num">${cd.secs}</span><span class="lbl">Secs</span></div>
          <span style="margin-left:8px;font-size:13px;font-weight:700;color:var(--muted)">Countdown to session start</span>
        </div>
        <div style="margin-top:10px">
          ${table(nextSession.exams.slice(0, 8), 'default')}
        </div>
        ${nextSession.exams.length > 8 ? `<p style="font-size:12px;color:var(--muted);margin-top:8px;margin-bottom:0">+ ${nextSession.exams.length - 8} additional papers scheduled for this session.</p>` : ''}
      </div>
    `;
  } else if (!active.length) {
    statusContent += `
      <div class="upcoming-box" style="text-align:center;padding:26px">
        <div style="font-size:28px;margin-bottom:6px">🎓</div>
        <h4 style="margin:0 0 6px">All Mid-Term Examination Sessions Have Concluded</h4>
        <p class="muted" style="margin:0">All 413 examination sessions for Fall 2026 have completed according to the verified schedule. You can test live slots using the Test Mode selector above.</p>
      </div>
    `;
  }

  container.innerHTML = `
    <div class="live-widget-card">
      <div class="live-topbar">
        <div class="live-clock-display">
          <span>🕒</span>
          <span id="liveClockText">${esc(formattedNow)}</span>
        </div>
        <div class="time-sim-wrapper">
          <label class="time-sim-label" for="liveProgFilter">Program:</label>
          <select id="liveProgFilter" class="time-sim-select">${progOptions}</select>
          <label class="time-sim-label" for="timeSimSelect" style="margin-left:8px">Test Mode:</label>
          <select id="timeSimSelect" class="time-sim-select">
            <option value="real"${simulationMode === 'real' ? ' selected' : ''}>System Clock (Real Time)</option>
            <option value="demo1"${simulationMode === 'demo1' ? ' selected' : ''}>Demo: Thu 29 Oct, 1:30 PM (Mid-Exam Live)</option>
            <option value="demo2"${simulationMode === 'demo2' ? ' selected' : ''}>Demo: Thu 29 Oct, 8:45 AM (Upcoming 15m)</option>
            <option value="demo3"${simulationMode === 'demo3' ? ' selected' : ''}>Demo: Fri 30 Oct, 2:15 PM (Friday Live Slot)</option>
            <option value="demo4"${simulationMode === 'demo4' ? ' selected' : ''}>Demo: Mon 02 Nov, 9:15 AM (Monday Live Slot)</option>
          </select>
        </div>
      </div>
      ${statusContent}
    </div>
  `;

  // Bind change events
  const simSelect = container.querySelector('#timeSimSelect');
  if (simSelect) {
    simSelect.onchange = e => {
      simulationMode = e.target.value;
      renderLiveTrackerWidget(container, isDedicatedView);
    };
  }

  const progSelect = container.querySelector('#liveProgFilter');
  if (progSelect) {
    progSelect.onchange = e => {
      currentLiveProgFilter = e.target.value;
      renderLiveTrackerWidget(container, isDedicatedView);
    };
  }
}

/* Real-time ticker to keep clock and countdowns live */
function startLiveTicker() {
  if (liveTickerInterval) clearInterval(liveTickerInterval);
  liveTickerInterval = setInterval(() => {
    const clockEl = document.getElementById('liveClockText');
    if (clockEl) {
      const now = getEffectiveNow();
      clockEl.textContent = now.toLocaleDateString('en-GB', {
        weekday: 'long', day: '2-digit', month: 'short', year: 'numeric'
      }) + ' · ' + now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }

    // Refresh active/countdown state
    const container = document.getElementById('liveWidgetContainer') || document.getElementById('dedicatedLiveContainer');
    if (container) {
      // Re-evaluate every 10 seconds or when minute rolls over
      const now = getEffectiveNow();
      if (now.getSeconds() % 5 === 0) {
        renderLiveTrackerWidget(container, view === 'live');
      }
    }
  }, 1000);
}

/* ============================================================
   VIEW: Dedicated Live Tracker
   ============================================================ */
function live() {
  app.innerHTML = layout(
    '⚡ Real-Time Mid-Term Examination Tracker',
    `<p class="muted">Live status monitor checking current time against the verified timetable. Displays active papers in session, assigned invigilators, exact classrooms, and countdowns to upcoming sessions.</p>
    <div id="dedicatedLiveContainer" style="margin-top:14px"></div>`
  );
  renderLiveTrackerWidget($('#dedicatedLiveContainer'), true);
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

function selector(label, id, values, empty = 'Select ' + label) {
  return `<div class="field"><label>${label}</label><select id="${id}">${opts(values, empty)}</select></div>`;
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

  $('#teacherResult').innerHTML = `<h3>${esc(t)} · ${selected.length} paper${selected.length === 1 ? '' : 's'}</h3>${table(selected, 'teacher')}`;
}

/* ============================================================
   VIEW: Program-wise date sheets (Dynamic Cascading)
   ============================================================ */
const MAJOR_PROGRAMS = [
  'BS Cyber Security',
  'BS Data Science',
  'BS Computer Science',
  'BS Software Engineering',
  'BS Artificial Intelligence',
  'BS Information Technology'
];

function program(targetProgram = '') {
  const allPrograms = uniq('program');
  const initialProg = targetProgram || activeProgramTab || (allPrograms.includes('BS Cyber Security') ? 'BS Cyber Security' : allPrograms[0] || '');
  activeProgramTab = initialProg;

  const chipsHtml = `
    <div class="chip-container">
      ${allPrograms.map(p => `
        <button class="chip-btn${p === initialProg ? ' active' : ''}" onclick="selectProgramChip('${esc(p)}')">${esc(p)}</button>
      `).join('')}
    </div>
  `;

  app.innerHTML = layout(
    'Program-wise date sheets',
    `<p class="muted">Select a degree program to generate its comprehensive timetable. The semester, section, and shift selectors automatically adapt to show only available options.</p>
    ${chipsHtml}
    <div class="toolbar">
      ${selector('Program', 'programSelect', allPrograms)}
      ${selector('Semester', 'programSem', [])}
      ${selector('Section', 'programSec', [])}
      ${selector('Shift', 'programShift', [])}
      <button class="primary" id="programView">View date sheet</button>
      <button class="secondary" id="programPrint">Print</button>
      <button class="secondary" id="programPdf">Download PDF</button>
    </div>
    <div id="programResult" style="margin-top:18px"></div>`
  );

  const progSelect = $('#programSelect');
  const semSelect = $('#programSem');
  const secSelect = $('#programSec');
  const shiftSelect = $('#programShift');

  if (initialProg && progSelect) {
    progSelect.value = initialProg;
  }

  // Dynamic cascading updates
  function updateCascade(changedLevel) {
    const p = progSelect.value;
    let pRecords = data.filter(x => x.program === p);

    // Update Semesters
    const sems = uniq('semester', pRecords);
    const currSem = semSelect.value;
    semSelect.innerHTML = opts(sems, 'All Semesters', sems.includes(Number(currSem)) || sems.includes(currSem) ? currSem : '');

    // Update Sections
    if (semSelect.value) {
      pRecords = pRecords.filter(x => String(x.semester) === semSelect.value);
    }
    const secs = uniq('section', pRecords);
    const currSec = secSelect.value;
    secSelect.innerHTML = opts(secs, 'All Sections', secs.includes(currSec) ? currSec : '');

    // Update Shifts
    if (secSelect.value) {
      pRecords = pRecords.filter(x => x.section === secSelect.value);
    }
    const shifts = uniq('shift', pRecords);
    const currShift = shiftSelect.value;
    shiftSelect.innerHTML = opts(shifts, 'All Shifts', shifts.includes(currShift) ? currShift : '');

    renderProgram();
  }

  progSelect.onchange = () => {
    activeProgramTab = progSelect.value;
    document.querySelectorAll('.chip-btn').forEach(btn => {
      btn.classList.toggle('active', btn.textContent.trim() === progSelect.value);
    });
    semSelect.value = '';
    secSelect.value = '';
    shiftSelect.value = '';
    updateCascade('program');
  };

  semSelect.onchange = () => {
    secSelect.value = '';
    shiftSelect.value = '';
    updateCascade('semester');
  };

  secSelect.onchange = () => {
    shiftSelect.value = '';
    updateCascade('section');
  };

  shiftSelect.onchange = () => {
    renderProgram();
  };

  $('#programView').onclick = renderProgram;

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
      pdfFilename('Program', [p, sem ? `Sem_${sem}` : '', sec ? `Sec_${sec}` : '', shift])
    );
  };

  // Initial trigger
  updateCascade('init');
}

window.selectProgramChip = function(progName) {
  const progSelect = $('#programSelect');
  if (progSelect) {
    progSelect.value = progName;
    progSelect.dispatchEvent(new Event('change'));
  }
};

function renderProgram() {
  const p = $('#programSelect')?.value;
  if (!p) {
    selected = [];
    $('#programResult').innerHTML = '<div class="empty">Please select a degree program to continue.</div>';
    return;
  }
  const sem = $('#programSem')?.value;
  const sec = $('#programSec')?.value;
  const shift = $('#programShift')?.value;

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

  $('#programResult').innerHTML = `<h3>${subtitle} · ${selected.length} paper${selected.length === 1 ? '' : 's'}</h3>${table(selected, 'program')}`;
}

/* ============================================================
   VIEW: Class-wise date sheets (Dynamic Cascading)
   ============================================================ */
function classView() {
  const allPrograms = uniq('program');

  app.innerHTML = layout(
    'Class-wise date sheets',
    `<p class="muted">Select all four class attributes (Program, Semester, Section, Shift) to view the class date sheet. Dropdowns update dynamically to show only available combinations.</p>
    <div class="toolbar">
      ${selector('Program', 'classP', allPrograms, 'Select Program')}
      ${selector('Semester', 'classS', [], 'Select Semester')}
      ${selector('Section', 'classSec', [], 'Select Section')}
      ${selector('Shift', 'classSh', [], 'Select Shift')}
      <button class="primary" id="classSubmit">View class sheet</button>
      <button class="secondary" id="classPrint">Print</button>
      <button class="secondary" id="classPdf" title="Download selected class as PDF">Download PDF</button>
    </div>
    <div id="classResult" style="margin-top:18px"></div>`
  );

  const pSel = $('#classP');
  const sSel = $('#classS');
  const secSel = $('#classSec');
  const shSel = $('#classSh');

  function updateClassCascade(changed) {
    const p = pSel.value;
    if (!p) {
      sSel.innerHTML = opts([], 'Select Semester');
      secSel.innerHTML = opts([], 'Select Section');
      shSel.innerHTML = opts([], 'Select Shift');
      $('#classResult').innerHTML = '<div class="empty">Please select a program first.</div>';
      return;
    }

    let pRecords = data.filter(x => x.program === p);
    const sems = uniq('semester', pRecords);
    const prevSem = sSel.value;
    sSel.innerHTML = opts(sems, 'Select Semester', sems.includes(Number(prevSem)) || sems.includes(prevSem) ? prevSem : '');

    const currSem = sSel.value;
    if (currSem) {
      pRecords = pRecords.filter(x => String(x.semester) === currSem);
    }
    const secs = uniq('section', pRecords);
    const prevSec = secSel.value;
    secSel.innerHTML = opts(secs, 'Select Section', secs.includes(prevSec) ? prevSec : '');

    const currSec = secSel.value;
    if (currSec) {
      pRecords = pRecords.filter(x => x.section === currSec);
    }
    const shifts = uniq('shift', pRecords);
    const prevShift = shSel.value;
    shSel.innerHTML = opts(shifts, 'Select Shift', shifts.includes(prevShift) ? prevShift : '');

    renderClass();
  }

  const renderClass = () => {
    const p = pSel.value;
    const s = sSel.value;
    const sec = secSel.value;
    const sh = shSel.value;

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

    $('#classResult').innerHTML = `<h3>${esc(p)} · Semester ${esc(s)} · Section ${esc(sec)} · ${esc(sh)} · ${selected.length} papers</h3>${table(selected, 'class')}`;
  };

  pSel.onchange = () => {
    sSel.value = '';
    secSel.value = '';
    shSel.value = '';
    updateClassCascade('program');
  };

  sSel.onchange = () => {
    secSel.value = '';
    shSel.value = '';
    updateClassCascade('semester');
  };

  secSel.onchange = () => {
    shSel.value = '';
    updateClassCascade('section');
  };

  shSel.onchange = renderClass;
  $('#classSubmit').onclick = renderClass;

  $('#classPrint').onclick = () => {
    if (!selected.length) {
      alert('Please select all four class attributes first.');
      return;
    }
    const p = pSel.value;
    const s = sSel.value;
    const sec = secSel.value;
    const sh = shSel.value;
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
    const p = pSel.value;
    const s = sSel.value;
    const sec = secSel.value;
    const sh = shSel.value;
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
            <span>
              ${roomBadge(x.room)}<br>
              <small style="margin-top:4px;display:inline-block">${teacherCell(x.teacher)}</small>
            </span>
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
   VIEW: Dashboard (with Program Grid & Live Status Widget)
   ============================================================ */
function getProgramSummary() {
  const map = {};
  data.forEach(r => {
    const p = r.program;
    if (!p) return;
    if (!map[p]) {
      map[p] = {
        name: p,
        code: r.programCode || p.replace(/[^A-Z0-9]/g, '').slice(0, 6),
        semesters: new Set(),
        shifts: new Set(),
        papers: 0
      };
    }
    map[p].semesters.add(r.semester);
    map[p].shifts.add(r.shift);
    map[p].papers++;
  });

  return Object.values(map).sort((a, b) => {
    return a.name.localeCompare(b.name);
  });
}

function renderProgramCards(filterText = '') {
  const summaries = getProgramSummary();
  const query = filterText.toLowerCase().trim();

  const filtered = query
    ? summaries.filter(s => s.name.toLowerCase().includes(query) || s.code.toLowerCase().includes(query))
    : summaries;

  if (!filtered.length) {
    return `<div class="empty" style="grid-column: 1 / -1">No degree programs matched "${esc(filterText)}".</div>`;
  }

  return filtered.map(prog => {
    const sems = [...prog.semesters].sort((a, b) => Number(a) - Number(b));
    const shifts = [...prog.shifts].sort();
    return `
      <div class="program-card" onclick="openProgramSheet('${esc(prog.name)}')">
        <div>
          <div class="program-card-top">
            <span class="program-code-badge">${esc(prog.code)}</span>
            <span class="program-count-badge">${prog.papers} Papers</span>
          </div>
          <h4>${esc(prog.name)}</h4>
          <div class="program-pills">
            <span class="pill-tag" title="Semesters offered">Semesters: ${sems.join(', ')}</span>
            ${shifts.map(s => `<span class="pill-tag">${esc(s)}</span>`).join('')}
          </div>
        </div>
        <button class="program-view-btn">
          <span>View Program Schedule</span>
          <span>→</span>
        </button>
      </div>
    `;
  }).join('');
}

window.openProgramSheet = function(progName) {
  show('program');
  setTimeout(() => {
    selectProgramChip(progName);
  }, 10);
};

window.filterProgramCards = function(val) {
  const grid = document.getElementById('programGrid');
  if (grid) {
    grid.innerHTML = renderProgramCards(val);
  }
};

function dashboard() {
  const programs = getProgramSummary();

  app.innerHTML = stats() + `
    <!-- Live Examination Status Widget -->
    <div id="liveWidgetContainer"></div>

    <!-- Degree Program Categorization Directory -->
    <div class="card" style="margin-top:20px">
      <div class="section-title-row">
        <div>
          <h3 style="margin:0 0 4px">Explore by Degree Program (${programs.length})</h3>
          <p class="muted" style="margin:0;font-size:12.5px">Select any academic program to instantly browse, print, or download its official Mid-Term schedule.</p>
        </div>
        <div class="program-search-box">
          <input type="text" id="progSearchInput" placeholder="Search program (e.g. Cyber, AI)..." oninput="filterProgramCards(this.value)">
        </div>
      </div>
      <div class="program-grid" id="programGrid">
        ${renderProgramCards()}
      </div>
    </div>

    <!-- Quick Navigation Actions -->
    <div class="card" style="margin-top:20px">
      <h3>Quick Actions</h3>
      <p class="muted">Access complete date sheets, invigilation duties, class timetables, or the chronological calendar.</p>
      <div class="toolbar">
        <button class="primary" onclick="show('program')">Browse Program Sheets</button>
        <button class="secondary" onclick="show('class')">Class Sheets</button>
        <button class="secondary" onclick="show('live')">⚡ Live Tracker</button>
        <button class="secondary" onclick="show('teacher')">Teacher Duty Sheets</button>
        <button class="secondary" onclick="show('complete')">Complete Date Sheet</button>
        <button class="secondary" onclick="show('calendar')">Calendar Schedule</button>
      </div>
    </div>
  `;

  renderLiveTrackerWidget($('#liveWidgetContainer'), false);
}

/* ============================================================
   ROUTING
   ============================================================ */
function show(v, param = '') {
  view = v;
  document.querySelectorAll('nav button').forEach(b => b.classList.toggle('active', b.dataset.view === v));
  const views = {
    dashboard,
    live,
    complete,
    teacher,
    program: () => program(param),
    class: classView,
    calendar
  };
  (views[v] || dashboard)();
  window.scrollTo({ top: 0, behavior: 'smooth' });
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
    startLiveTicker();
  } else {
    fetch('data/exam_schedule.json')
      .then(r => {
        if (!r.ok) throw new Error('Network error');
        return r.json();
      })
      .then(x => {
        data = validatedRecords(x);
        dashboard();
        startLiveTicker();
      })
      .catch(() => {
        app.innerHTML = '<div class="card empty">Could not load the schedule. If opened via file://, a local static server like <b>py -m http.server</b> is recommended, then open http://localhost:8000.</div>';
      });
  }
}

initApp();
