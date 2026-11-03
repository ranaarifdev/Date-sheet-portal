const $ = s => document.querySelector(s);
let app = null; // set in initApp after DOM ready
let data = [];
let view = 'dashboard';
let selected = [];
let liveTickerInterval = null;
let activeProgramDate = ''; // selected date in Cyber Security program sheets

const CYBER_SECURITY_PROGRAM = 'BS Cyber Security';
const ALL_CYBER_SECURITY_PROGRAMS = 'All Cyber Security Programs';

function isLegacyCyberSecuritySection(record) {
  return ['BSCS_SPECIALIZATION', 'BSCYB'].includes(record.programCode) &&
    String(record.semester) === '1' &&
    record.section === 'CYB-A' &&
    record.shift === 'Evening';
}

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
    ? records.filter(isValidExamRecord).map(record => {
      const isCyberSecuritySection = isLegacyCyberSecuritySection(record);
      return {
        ...record,
        ...(isCyberSecuritySection ? {
          program: CYBER_SECURITY_PROGRAM,
          programCode: 'BSCYB'
        } : {}),
        courseTitle: decodeHtml(record.courseTitle)
      };
    })
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

function formatLongDate(value) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-GB', {
    day: '2-digit', month: 'long', year: 'numeric'
  });
}

function weekdayScheduleHeading(value) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return 'EXAMINATION SCHEDULE';
  return `${date.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase()} EXAMINATION SCHEDULE`;
}

function isCyberSecurityProgram(programName) {
  return /cyber\s+security/i.test(String(programName || ''));
}

function isCyberSecurityScheduleRecord(record) {
  return isCyberSecurityProgram(record.program);
}

function dateDayGroups(rows) {
  const groups = new Map();
  [...rows].sort(sortBySchedule).forEach(row => {
    const key = `${row.date}|${row.day || ''}`;
    if (!groups.has(key)) {
      groups.set(key, { date: row.date, day: row.day || '', rows: [] });
    }
    groups.get(key).rows.push(row);
  });
  return [...groups.values()];
}

function buildDayWiseTable(rows, printMode = false) {
  const tableClass = printMode ? 'print-table daywise-table' : 'daywise-table';
  return `<div class="table-wrap daywise-table-wrap"><table class="${tableClass}">
    <thead><tr><th>Program &amp; Section</th><th>Time / Slot</th><th>Code</th><th>Course Title</th><th>Room</th><th>Invigilator(s)</th></tr></thead>
    <tbody>${rows.map(row => {
      const program = isLegacyCyberSecuritySection(row) ? 'BS CS (Spec. Cyber Security)' : row.program || '';
      const startTime = String(row.startTime || '').replace(/^(\d):/, '0$1:');
      const endTime = String(row.endTime || '').replace(/^(\d):/, '0$1:');
      const teacher = (row.teacher && row.teacher.trim()) ? row.teacher.trim() : 'Not Available';
      return `<tr>
        <td class="daywise-program-cell"><strong>${esc(program)}</strong><small>Semester ${esc(row.semester || '')} (${esc(row.shift || '')} - Sec ${esc(row.section || '')})</small></td>
        <td class="daywise-time-cell"><strong>${esc(startTime)} - ${esc(endTime)}</strong><small>Slot ${esc(row.slot || '')}</small></td>
        <td class="daywise-code-cell">${esc(row.courseCode || 'N/A')}</td>
        <td>${esc(decodeHtml(row.courseTitle || 'N/A'))}</td>
        <td class="daywise-room-cell">${esc(row.room || 'N/A')}</td>
        <td>${esc(teacher)}</td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>`;
}

function buildCyberSecurityInfoBox({ session = 'Fall 2026', program = '', programCoordinator = 'Program Coordinator: Dr. Hira Nazir', date = '', day = '' } = {}) {
  return `<div class="cyber-security-info-box">
    <div class="cyber-security-info-left">
      <strong>${esc(date ? weekdayScheduleHeading(date) : session)}</strong>
      <strong>${esc(program)}</strong>
    </div>
    <div class="cyber-security-info-right">
      <strong>${esc(programCoordinator)}</strong>
      ${date && day ? `<span><b>Date:</b> ${esc(formatLongDate(date))} <b>Day:</b> ${esc(day)}</span>` : ''}
    </div>
  </div>`;
}

function buildDayWiseGroups(rows, printMode = false, meta = {}) {
  const programName = meta.programContext || meta.programName || CYBER_SECURITY_PROGRAM;
  const isCyberSecurity = meta.isCyberSecurityProgram ?? isCyberSecurityProgram(programName);
  return dateDayGroups(rows).map(group => {
    const dateHeading = `<h3 class="daywise-date-heading"><span>Date:</span> ${esc(formatLongDate(group.date))}<span>Day:</span> ${esc(group.day)}</h3>`;
    const header = isCyberSecurity
      ? buildCyberSecurityInfoBox({
        session: meta.session || 'Fall 2026',
        program: programName,
        programCoordinator: meta.programCoordinator,
        date: group.date,
        day: group.day
      })
      : dateHeading;
    return `<section class="daywise-date-group">${header}${buildDayWiseTable(group.rows, printMode)}</section>`;
  }).join('');
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
  if (view === 'teacher' || view === 'program' || view === 'class') {
    return [...selected].sort(sortBySchedule);
  }
  if (view === 'live') {
    // Export all data or a filtered subset; selected may be empty from live view
    const rows = selected.length ? selected : [...data];
    return rows.sort(sortBySchedule);
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
  if (view === 'program') {
    const p = $('#programName')?.value || CYBER_SECURITY_PROGRAM;
    const sem = $('#programSem')?.value;
    const sec = $('#programSec')?.value;
    const shift = $('#programShift')?.value;
    let detail = p;
    if (sem) detail += ` · Semester ${sem}`;
    if (sec) detail += ` · Section ${sec}`;
    if (shift) detail += ` · ${shift}`;
    if (activeProgramDate) detail += ` · ${formatDate(activeProgramDate)}`;
    return {
      ...base,
      department: 'Department of Cyber Security',
      heading: 'Mid-Term Examination — Fall 2026',
      programCoordinator: 'Program Coordinator: Dr. Hira Nazir',
      programName: p,
      programContext: [
        p === ALL_CYBER_SECURITY_PROGRAMS ? 'BS and MS Cyber Security' : p,
        sem && `Semester ${sem}`,
        sec && `Section ${sec}`,
        shift
      ].filter(Boolean).join(' · '),
      isCyberSecurityProgram: true,
      isDayWise: !!activeProgramDate,
      sheetType: 'Cyber Security Date Sheet',
      detailLabel: 'Program Details',
      detail,
      subtitle: 'Cyber Security Date Sheet'
    };
  }
  if (view === 'class' && $('#classP')?.value) {
    const p = $('#classP').value;
    const s = $('#classS').value;
    const sec = $('#classSec').value;
    const shift = $('#classSh').value;
    const classDetail = `${p} · Semester ${s} · Section ${sec} · ${shift} Shift`;
    const cyberSecurityProgram = isCyberSecurityProgram(p) ||
      rows.length > 0 && rows.every(isCyberSecurityScheduleRecord);
    return {
      ...base,
      ...(cyberSecurityProgram ? {
        department: 'Department of Cyber Security',
        heading: 'Mid-Term Examination — Fall 2026',
        programName: p,
        programContext: classDetail,
        programCoordinator: 'Program Coordinator: Dr. Hira Nazir',
        isCyberSecurityProgram: true
      } : {}),
      sheetType: 'Class-Wise Date Sheet',
      detailLabel: 'Class Details',
      detail: classDetail,
      classContext: { program: p, semester: s, section: sec, shift },
      subtitle: 'Class-Wise Examination Date Sheet'
    };
  }
  if (view === 'live') {
    return {
      ...base,
      sheetType: 'Live Tracker Export',
      detailLabel: 'Export Type',
      detail: 'Real-Time Examination Status',
      subtitle: 'Live Examination Tracker'
    };
  }
  return {
    ...base,
    subtitle: 'Complete Examination Date Sheet',
    detail: 'Complete Examination Date Sheet'
  };
}

function buildPrintHeader(meta) {
  if (meta.isCyberSecurityProgram) {
    return `<div class="print-header cyber-security-print-header">
      <div class="print-brand-row">
        <img class="print-logo" src="university-logo.jpeg" alt="University Logo" />
        <div class="print-titles">
          <div class="print-title">${esc(meta.title)}</div>
          <div class="print-department">${esc(meta.department)}</div>
          <div class="print-heading">${esc(meta.heading)}</div>
        </div>
      </div>
      ${meta.isDayWise ? '' : buildCyberSecurityInfoBox({
        session: meta.session,
        program: meta.programContext || meta.programName,
        programCoordinator: meta.programCoordinator
      })}
      <div class="print-divider"></div>
    </div>`;
  }

  const rawDetail = meta.detail || meta.subtitle || 'Complete Examination Date Sheet';
  const cleanDetail = stripLabelPrefix(rawDetail, meta.detailLabel || '');
  const classContext = meta.classContext;

  const details = [
    ['Date Sheet Type', meta.sheetType || meta.subtitle || 'Examination Date Sheet'],
    [meta.detailLabel || 'Selection', cleanDetail],
    ['Total Papers', String(meta.totalPapers ?? 0)],
    ['Session', meta.session || 'Fall 2026']
  ].filter(([label]) => !(classContext && label === meta.detailLabel));

  const detailHtml = details.map(([label, value]) => `
    <div class="print-detail-item">
      <span>${esc(label)}</span>
      <strong>${esc(value)}</strong>
    </div>
  `).join('');

  return `<div class="print-header">
    <div class="print-brand-row">
      <img class="print-logo" src="university-logo.jpeg" alt="University Logo" />
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
function buildPrintTable(rows, meta = {}) {
  if (!rows.length) {
    return '<div class="print-empty">No matching records available for printing.</div>';
  }

  const isTeacherSheet = view === 'teacher';
  const isClassSheet = view === 'class';
  const isProgramSheet = view === 'program';

  if (isProgramSheet && meta.isDayWise) {
    return buildDayWiseGroups(rows, true, meta);
  }
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
  printDoc.className = `print-sheet${view === 'class' ? ' class-print-sheet' : ''}${meta.isCyberSecurityProgram ? ' cyber-security-print' : ''}`;
  printDoc.innerHTML = buildPrintHeader(meta) + buildPrintTable(rows, meta) + (meta.isCyberSecurityProgram ? '' : buildSignatureFooter());
  document.body.appendChild(printDoc);
  return printDoc;
}

function imageColumns(type) {
  const column = (label, weight, value) => ({ label, weight, value });
  const details = row => (row.teacher && row.teacher.trim()) ? row.teacher.trim() : 'Not Available';
  const time = row => `${row.startTime} – ${row.endTime}`;
  const date = row => formatDate(row.date);

  if (type === 'day') {
    return [
      column('Sr.', 4, (row, index) => index + 1),
      column('Time', 11, time),
      column('Semester', 5, row => row.semester),
      column('Section', 5, row => row.section),
      column('Shift', 8, row => row.shift),
      column('Course Code', 9, row => row.courseCode || 'N/A'),
      column('Course Title', 25, row => row.courseTitle || 'N/A'),
      column('Teacher / Invigilator', 25, details),
      column('Room', 8, row => row.room || 'N/A')
    ];
  }
  if (type === 'class') {
    return [
      column('Sr.', 5, (row, index) => index + 1),
      column('Date', 11, date),
      column('Day', 8, row => row.day),
      column('Time', 11, time),
      column('Course Code', 10, row => row.courseCode || 'N/A'),
      column('Course Title', 26, row => row.courseTitle || 'N/A'),
      column('Teacher / Invigilator', 19, details),
      column('Room', 10, row => row.room || 'N/A')
    ];
  }
  if (type === 'teacher') {
    return [
      column('Sr.', 4, (row, index) => index + 1),
      column('Date', 10, date),
      column('Day', 7, row => row.day),
      column('Time', 10, time),
      column('Program', 15, row => row.program),
      column('Sem.', 5, row => row.semester),
      column('Sec.', 5, row => row.section),
      column('Shift', 8, row => row.shift),
      column('Course Code', 10, row => row.courseCode || 'N/A'),
      column('Course Title', 18, row => row.courseTitle || 'N/A'),
      column('Room', 8, row => row.room || 'N/A')
    ];
  }
  if (type === 'program') {
    return [
      column('Sr.', 4, (row, index) => index + 1),
      column('Date', 10, date),
      column('Day', 7, row => row.day),
      column('Time', 10, time),
      column('Sem.', 5, row => row.semester),
      column('Sec.', 5, row => row.section),
      column('Shift', 8, row => row.shift),
      column('Course Code', 12, row => row.courseCode || 'N/A'),
      column('Course Title', 17, row => row.courseTitle || 'N/A'),
      column('Teacher / Invigilator', 16, details),
      column('Room', 6, row => row.room || 'N/A')
    ];
  }
  return [
    column('Date', 9, date),
    column('Day', 6, row => row.day),
    column('Start', 7, row => row.startTime),
    column('End', 7, row => row.endTime),
    column('Program', 17, row => row.program),
    column('Sem.', 5, row => row.semester),
    column('Sec.', 5, row => row.section),
    column('Shift', 7, row => row.shift),
    column('Code', 8, row => row.courseCode || 'N/A'),
    column('Course Title', 15, row => row.courseTitle || 'N/A'),
    column('Teacher / Invigilator', 10, details),
    column('Room', 4, row => row.room || 'N/A')
  ];
}

function wrapImageText(context, value, maxWidth) {
  const words = String(value ?? '').replace(/\s+/g, ' ').trim().split(' ');
  const lines = [];
  let line = '';
  words.forEach(word => {
    if (!word) return;
    let remaining = word;
    while (context.measureText(remaining).width > maxWidth) {
      let splitAt = 1;
      while (splitAt < remaining.length && context.measureText(remaining.slice(0, splitAt + 1)).width <= maxWidth) splitAt++;
      if (line) {
        lines.push(line);
        line = '';
      }
      lines.push(remaining.slice(0, splitAt));
      remaining = remaining.slice(splitAt);
    }
    const candidate = line ? `${line} ${remaining}` : remaining;
    if (line && context.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = remaining;
    } else {
      line = candidate;
    }
  });
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

function createImageTableLayout(rows, columns, width, context) {
  const columnWidths = columns.map(column => width * column.weight / 100);
  const lineHeight = 10.5;
  context.font = 'bold 8px Arial, sans-serif';
  const headerLines = columns.map((column, index) => wrapImageText(context, column.label, columnWidths[index] - 10));
  const headerHeight = Math.max(25, ...headerLines.map(lines => lines.length * lineHeight + 10));
  context.font = '8.5px Arial, sans-serif';
  const bodyRows = rows.map((row, rowIndex) => {
    const cells = columns.map((column, index) => {
      const value = column.value(row, rowIndex);
      return wrapImageText(context, value == null ? '' : value, columnWidths[index] - 10);
    });
    const height = Math.max(23, ...cells.map(lines => lines.length * lineHeight + 10));
    return { cells, height };
  });
  return { columns, columnWidths, headerLines, headerHeight, bodyRows, height: headerHeight + bodyRows.reduce((sum, row) => sum + row.height, 0) };
}

function drawImageTable(context, layout, left, top, width) {
  let y = top;
  let x = left;
  context.font = 'bold 8px Arial, sans-serif';
  layout.columns.forEach((column, index) => {
    const cellWidth = layout.columnWidths[index];
    context.fillStyle = '#dce8f0';
    context.fillRect(x, y, cellWidth, layout.headerHeight);
    context.strokeStyle = '#718096';
    context.lineWidth = 0.6;
    context.strokeRect(x, y, cellWidth, layout.headerHeight);
    context.fillStyle = '#111827';
    layout.headerLines[index].forEach((line, lineIndex) => {
      context.fillText(line, x + 5, y + 8 + lineIndex * 10.5, cellWidth - 10);
    });
    x += cellWidth;
  });
  y += layout.headerHeight;

  layout.bodyRows.forEach((row, rowIndex) => {
    x = left;
    row.cells.forEach((lines, columnIndex) => {
      const cellWidth = layout.columnWidths[columnIndex];
      context.fillStyle = rowIndex % 2 ? '#f7f9fb' : '#ffffff';
      context.fillRect(x, y, cellWidth, row.height);
      context.strokeStyle = '#aeb8c2';
      context.lineWidth = 0.45;
      context.strokeRect(x, y, cellWidth, row.height);
      context.fillStyle = '#111827';
      context.font = '8.5px Arial, sans-serif';
      lines.forEach((line, lineIndex) => {
        context.fillText(line, x + 5, y + 8 + lineIndex * 10.5, cellWidth - 10);
      });
      x += cellWidth;
    });
    y += row.height;
  });
  return y;
}

function drawImageInstitutionHeader(context, width, logo, meta) {
  const margin = 32;
  const logoBox = 76;
  const logoRatio = logo.naturalWidth / logo.naturalHeight;
  const logoWidth = logoRatio >= 1 ? logoBox : logoBox * logoRatio;
  const logoHeight = logoRatio >= 1 ? logoBox / logoRatio : logoBox;
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, 116);
  context.drawImage(logo, margin, 15 + (logoBox - logoHeight) / 2, logoWidth, logoHeight);
  context.textAlign = 'center';
  context.fillStyle = '#000000';
  context.font = 'bold 15px Arial, sans-serif';
  context.fillText(meta.title || 'EMERSON UNIVERSITY MULTAN', width / 2, 38);
  context.font = 'bold 11px Arial, sans-serif';
  context.fillText(meta.department || 'Faculty of Computing & Emerging Technologies', width / 2, 60);
  context.font = 'bold 10px Arial, sans-serif';
  context.fillText(meta.heading || 'CSET Mid-Term Examination — Fall 2026', width / 2, 80);
  context.strokeStyle = '#111827';
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(margin, 108);
  context.lineTo(width - margin, 108);
  context.stroke();
  context.textAlign = 'left';
}

function drawImageCyberInfo(context, width, meta, group, top) {
  const margin = 32;
  const height = 52;
  context.fillStyle = '#f5f7fa';
  context.strokeStyle = '#aeb8c2';
  context.lineWidth = 0.8;
  context.fillRect(margin, top, width - margin * 2, height);
  context.strokeRect(margin, top, width - margin * 2, height);
  context.fillStyle = '#111827';
  context.font = 'bold 10px Arial, sans-serif';
  const heading = group ? weekdayScheduleHeading(group.date) : (meta.session || 'Fall 2026');
  context.fillText(heading, margin + 10, top + 18);
  context.font = 'bold 9px Arial, sans-serif';
  context.fillText(meta.programContext || meta.programName || '', margin + 10, top + 38, width / 2 - 25);
  context.textAlign = 'right';
  context.font = 'bold 9px Arial, sans-serif';
  context.fillText(meta.programCoordinator || 'Program Coordinator: Dr. Hira Nazir', width - margin - 10, top + 18);
  if (group) {
    context.font = '9px Arial, sans-serif';
    context.fillText(`Date: ${formatLongDate(group.date)}    Day: ${group.day}`, width - margin - 10, top + 38);
  }
  context.textAlign = 'left';
  return top + height + 8;
}

function loadImageElement(image) {
  return new Promise((resolve, reject) => {
    if (!image) {
      reject(new Error('The university logo is not available.'));
      return;
    }
    if (image.complete) {
      if (image.naturalWidth > 0) resolve(image);
      else reject(new Error('The university logo could not be loaded.'));
      return;
    }
    image.addEventListener('load', () => resolve(image), { once: true });
    image.addEventListener('error', () => reject(new Error('The university logo could not be loaded.')), { once: true });
  });
}

async function createScheduleImage(rows, meta, sourceView) {
  const logo = await loadImageElement(document.querySelector('.logo'));
  const layoutType = sourceView === 'dashboard' ? 'complete' : sourceView;
  const isDayWise = layoutType === 'program' && meta.isDayWise;
  const width = layoutType === 'class' ? 794 : 1120;
  const margin = 32;
  const tableWidth = width - margin * 2;
  const measureCanvas = document.createElement('canvas');
  const measureContext = measureCanvas.getContext('2d');
  if (!measureContext) throw new Error('The browser could not measure timetable text.');
  const groups = isDayWise
    ? dateDayGroups(rows).map(group => ({ ...group, layout: createImageTableLayout(group.rows, imageColumns('day'), tableWidth, measureContext) }))
    : [{ rows, layout: createImageTableLayout(rows, imageColumns(layoutType), tableWidth, measureContext) }];
  const cyberSecurity = !!meta.isCyberSecurityProgram;
  const topContentHeight = cyberSecurity
    ? isDayWise ? groups.length * (60 + 12) : 64
    : 95;
  const totalHeight = 116 + topContentHeight + groups.reduce((sum, group) => sum + 24 + group.layout.height, 0) + 32;
  const scale = Math.min(1.5, 32000 / totalHeight);
  if (scale < 1) throw new Error('The selected timetable is too long to render as one high-resolution image.');

  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(width * scale);
  canvas.height = Math.ceil(totalHeight * scale);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('The browser could not create an image canvas.');
  context.scale(scale, scale);
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, totalHeight);
  drawImageInstitutionHeader(context, width, logo, meta);

  let y = 116;
  if (!cyberSecurity) {
    context.fillStyle = '#f5f7fa';
    context.strokeStyle = '#aeb8c2';
    context.lineWidth = 0.8;
    context.fillRect(margin, y, tableWidth, 62);
    context.strokeRect(margin, y, tableWidth, 62);
    context.fillStyle = '#111827';
    context.font = 'bold 10px Arial, sans-serif';
    context.fillText('Date Sheet Details', margin + 10, y + 16);
    context.font = '8.5px Arial, sans-serif';
    context.fillText(`Type: ${meta.sheetType || 'Examination Date Sheet'}`, margin + 10, y + 34, tableWidth / 2 - 16);
    context.fillText(`${meta.detailLabel || 'Selection'}: ${meta.detail || 'Complete Examination Date Sheet'}`, margin + 10, y + 50, tableWidth / 2 - 16);
    context.fillText(`Papers: ${rows.length}`, margin + tableWidth / 2, y + 34);
    y += 72;
    if (meta.subtitle) {
      context.textAlign = 'center';
      context.font = 'bold 12px Arial, sans-serif';
      context.fillText(meta.subtitle, width / 2, y + 12);
      context.textAlign = 'left';
      y += 24;
    }
  }

  for (const group of groups) {
    if (cyberSecurity) {
      y = drawImageCyberInfo(context, width, meta, isDayWise ? group : null, y + 4);
    } else {
      context.strokeStyle = '#b4b4b4';
      context.beginPath();
      context.moveTo(margin, y);
      context.lineTo(width - margin, y);
      context.stroke();
      y += 8;
    }
    y = drawImageTable(context, group.layout, margin, y, tableWidth) + 16;
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error('The browser could not encode the timetable image.'));
    }, 'image/png');
  });
}

async function downloadScheduleImage(rows, metaOverride = {}, filename = 'Date-Sheet.png') {
  if (!rows || !rows.length) {
    alert('No records selected. Please make a selection first.');
    return;
  }
  try {
    const sourceView = view;
    const meta = { ...getPrintMeta(rows), ...metaOverride, totalPapers: rows.length };
    const blob = await createScheduleImage(rows, meta, sourceView);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) {
    console.error('Date sheet PNG export failed:', error);
    alert(`Could not generate the timetable image. ${error.message || 'Please try again.'}`);
  }
}

function imageFilename(prefix, parts = []) {
  const details = parts.filter(Boolean).map(part => safe(String(part)).replace(/_/g, '-'));
  return `${[prefix, ...details].join('-')}.png`;
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
   SHARED PDF GENERATION ENGINE
   ============================================================ */
function generatePdfDocContent(doc, rows, resolvedMeta) {
  const isTeacher = view === 'teacher';
  const isClass = view === 'class';
  const isProgram = view === 'program';
  const isCyberSecurity = !!resolvedMeta.isCyberSecurityProgram;
  const isDayWise = !!resolvedMeta.isDayWise;
  const logoImage = document.querySelector('.logo');

  const orientation = isClass ? 'portrait' : 'landscape';
  const pageW = isClass ? 210 : 297;
  const pageH = isClass ? 297 : 210;
  const margin = 14;
  const usableW = pageW - margin * 2;
  const cx = pageW / 2;

  const title   = resolvedMeta.title   || 'EMERSON UNIVERSITY MULTAN';
  const dept    = resolvedMeta.department || 'Faculty of Computing & Emerging Technologies';
  const heading = resolvedMeta.heading  || 'CSET Mid Term Examination — Fall 2026';
  const semLbl  = resolvedMeta.semesterLabel || resolvedMeta.session || 'Fall 2026';
  const subtitle = resolvedMeta.subtitle || resolvedMeta.sheetType || 'Examination Date Sheet';
  const detail  = resolvedMeta.detail   || '';
  const sessionLabel = resolvedMeta.session || semLbl || 'Fall 2026';
  const detailLabel = resolvedMeta.detailLabel || 'Relevant Details';
  const scopeValue = resolvedMeta.detail || detail || subtitle || 'Complete Examination Date Sheet';
  const totalLabel = String(rows.length);
  const classContext = resolvedMeta.classContext;

  let currentDayGroup = null;
  const drawPageHeader = () => {
    doc.setTextColor(0, 0, 0);
    if (logoImage && logoImage.complete && logoImage.naturalWidth) {
      try {
        doc.addImage(logoImage, 'JPEG', margin, 7, 24, 24);
      } catch (err) {
        // Fallback without logo
      }
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text(title, cx, 14, { align: 'center' });
    doc.setFont('helvetica', isCyberSecurity ? 'bold' : 'normal');
    doc.setFontSize(isCyberSecurity ? 11.5 : 9.5);
    doc.text(dept, cx, 20, { align: 'center' });
    doc.setFont('helvetica', isCyberSecurity ? 'normal' : 'bold');
    doc.setFontSize(isCyberSecurity ? 9.5 : 11.5);
    doc.text(heading.replace('—', '-'), cx, 26, { align: 'center' });

    if (isCyberSecurity) {
      const boxY = 34;
      const boxHeight = isDayWise ? 23 : 17;
      doc.setFillColor(245, 248, 251);
      doc.setDrawColor(180);
      doc.setLineWidth(0.25);
      doc.roundedRect(margin, boxY, usableW, boxHeight, 1, 1, 'FD');
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.text(isDayWise && currentDayGroup ? weekdayScheduleHeading(currentDayGroup.date) : sessionLabel, margin + 5, boxY + 7);
      doc.text(resolvedMeta.programContext || resolvedMeta.programName || '', margin + 5, boxY + 14);
      doc.setFontSize(10);
      doc.text(resolvedMeta.programCoordinator || 'Program Coordinator: Dr. Hira Nazir', pageW - margin - 5, boxY + 7, { align: 'right' });
      if (isDayWise && currentDayGroup) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text(`Date: ${formatLongDate(currentDayGroup.date)}    Day: ${currentDayGroup.day}`, pageW - margin - 5, boxY + 15, { align: 'right' });
      }
      doc.setDrawColor(0);
      doc.setLineWidth(0.4);
      doc.line(margin, boxY + boxHeight + 3, pageW - margin, boxY + boxHeight + 3);
      return;
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(sessionLabel, cx, 32, { align: 'center' });

    if (isDayWise && currentDayGroup) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(`Date: ${formatDate(currentDayGroup.date)}    Day: ${currentDayGroup.day}`, cx, 38, { align: 'center' });
    }

    let ruleY = 36;
    if (classContext) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      const contextLine = `Class: ${classContext.program} | Semester: ${classContext.semester} | Section: ${classContext.section} | Shift: ${classContext.shift}`;
      const contextLines = doc.splitTextToSize(contextLine, usableW);
      doc.text(contextLines, cx, 38, { align: 'center' });
      ruleY = 38 + (contextLines.length * 4);
    } else if (isDayWise && currentDayGroup) {
      ruleY = 42;
    }

    doc.setDrawColor(0);
    doc.setLineWidth(0.4);
    doc.line(margin, ruleY, pageW - margin, ruleY);
  };

  let y = isDayWise ? (isCyberSecurity ? 63 : 45) : (isCyberSecurity ? 57 : classContext ? 48 : 42);

  if (!isCyberSecurity) {
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
      `Papers: ${totalLabel}`
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
  }

  doc.setDrawColor(180);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageW - margin, y); y += 3;

  // Table definition per view type
  let head, body;
  const dayWisePdfRow = r => {
    const program = isLegacyCyberSecuritySection(r) ? 'BS CS (Spec. Cyber Security)' : r.program || '';
    const formatTime = value => String(value || '').replace(/^(\d):/, '0$1:');
    return [
      `${program}\nSemester ${r.semester || ''} (${r.shift || ''} - Sec ${r.section || ''})`,
      `${formatTime(r.startTime)} - ${formatTime(r.endTime)}\nSlot ${r.slot || ''}`,
      r.courseCode || 'N/A',
      decodeHtml(r.courseTitle || 'N/A'),
      r.room || 'N/A',
      (r.teacher && r.teacher.trim()) ? r.teacher.trim() : 'Not Available'
    ];
  };

  if (isDayWise) {
    head = [['PROGRAM & SECTION', 'TIME / SLOT', 'CODE', 'COURSE TITLE', 'ROOM', 'INVIGILATOR(S)']];
    body = rows.map(dayWisePdfRow);
  } else if (isClass) {
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

  const pageFooterLeft = isCyberSecurity
    ? 'Emerson University Multan - Department of Cyber Security'
    : 'Emerson University Multan - FCET';

  // Build column styles for better layout control
  let columnStyles = {};
  if (isDayWise) {
    columnStyles = {
      0: { cellWidth: 62, fontStyle: 'bold', textColor: [34, 69, 125] },
      1: { cellWidth: 48, fontStyle: 'bold', textColor: [45, 59, 76] },
      2: { cellWidth: 25, textColor: [22, 111, 153] },
      3: { cellWidth: 60 },
      4: { cellWidth: 27, fontStyle: 'bold', textColor: [180, 43, 43] },
      5: { cellWidth: 47 }
    };
  } else if (isClass) {
    columnStyles = {
      0: { cellWidth: 8 },
      1: { cellWidth: 22 },
      2: { cellWidth: 16 },
      3: { cellWidth: 22 },
      4: { cellWidth: 16 },
      5: { cellWidth: 'auto' },
      6: { cellWidth: 40 },
      7: { cellWidth: 20 }
    };
  } else if (isTeacher) {
    columnStyles = {
      0: { cellWidth: 8 },
      1: { cellWidth: 20 },
      2: { cellWidth: 16 },
      3: { cellWidth: 20 },
      4: { cellWidth: 'auto' },
      5: { cellWidth: 10 },
      6: { cellWidth: 10 },
      7: { cellWidth: 16 },
      8: { cellWidth: 14 },
      9: { cellWidth: 'auto' },
      10: { cellWidth: 18 }
    };
  } else if (isProgram) {
    columnStyles = {
      0: { cellWidth: 8 },
      1: { cellWidth: 20 },
      2: { cellWidth: 16 },
      3: { cellWidth: 20 },
      4: { cellWidth: 10 },
      5: { cellWidth: 10 },
      6: { cellWidth: 16 },
      7: { cellWidth: 14 },
      8: { cellWidth: 'auto' },
      9: { cellWidth: 'auto' },
      10: { cellWidth: 18 }
    };
  } else {
    columnStyles = {
      0: { cellWidth: 8 },
      1: { cellWidth: 20 },
      2: { cellWidth: 16 },
      3: { cellWidth: 20 },
      4: { cellWidth: 'auto' },
      5: { cellWidth: 10 },
      6: { cellWidth: 10 },
      7: { cellWidth: 16 },
      8: { cellWidth: 14 },
      9: { cellWidth: 'auto' },
      10: { cellWidth: 'auto' },
      11: { cellWidth: 18 }
    };
  }

  const autoTableOptions = (tableHead, tableBody) => ({
    startY: y,
    margin: { top: isDayWise ? (isCyberSecurity ? 66 : 45) : isCyberSecurity ? 60 : classContext ? 48 : 42, right: margin, bottom: 14, left: margin },
    head: tableHead,
    body: tableBody,
    theme: 'grid',
    tableWidth: isDayWise ? usableW : 'auto',
    showHead: 'everyPage',
    styles: {
      fontSize: isDayWise ? 8.3 : isClass ? 8.5 : 7.5,
      cellPadding: { top: 2, right: 2.5, bottom: 2, left: 2.5 },
      textColor: [0, 0, 0],
      overflow: 'linebreak',
      minCellHeight: 0
    },
    headStyles: {
      fillColor: [220, 232, 240],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      fontSize: isDayWise ? 7.8 : isClass ? 8 : 7
    },
    columnStyles,
    rowPageBreak: 'avoid',
    didDrawPage: drawPageHeader
  });

  if (isDayWise) {
    dateDayGroups(rows).forEach((group, index) => {
      if (index > 0) doc.addPage();
      currentDayGroup = group;
      const groupBody = group.rows.map(dayWisePdfRow);
      doc.autoTable(autoTableOptions(head, groupBody));
    });
  } else {
    doc.autoTable(autoTableOptions(head, body));
  }

  const totalPages = doc.internal.getNumberOfPages();
  for (let pg = 1; pg <= totalPages; pg++) {
    doc.setPage(pg);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100);
    doc.text(pageFooterLeft, margin, pageH - 6);
    doc.text(`Page ${pg} of ${totalPages}`, pageW - margin, pageH - 6, { align: 'right' });
  }

  return doc;
}

function createPdfDocument(rows, meta = {}) {
  if (!rows || !rows.length) {
    alert('No records to display. Please make a selection first.');
    return null;
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
    return null;
  }

  const isClass = view === 'class';
  const orientation = isClass ? 'portrait' : 'landscape';
  const doc = new window.jspdf.jsPDF({ orientation, unit: 'mm', format: 'a4' });

  generatePdfDocContent(doc, rows, resolvedMeta);

  return {
    doc,
    filename: resolvedMeta.filename || 'CSET_Date_Sheet_Fall_2026.pdf',
    title: resolvedMeta.subtitle || resolvedMeta.sheetType || 'Examination Date Sheet',
    detail: resolvedMeta.detail || ''
  };
}

function downloadPdf(rows, meta = {}, filename = 'CSET_Date_Sheet_Fall_2026.pdf') {
  const result = createPdfDocument(rows, { ...meta, filename });
  if (!result) return;
  result.doc.save(filename || result.filename);
}

/* ============================================================
   INTERACTIVE PDF PREVIEW MODAL CONTROLLER
   ============================================================ */
let currentPdfBlobUrl = null;
let currentPreviewDoc = null;
let currentPreviewFilename = '';

function openPdfModal(blobUrl, filename, title, detail) {
  const modal = document.getElementById('pdf-preview-modal');
  if (!modal) return;

  const titleEl = document.getElementById('modal-pdf-title');
  const subtitleEl = document.getElementById('modal-pdf-subtitle');
  const iframe = document.getElementById('pdf-preview-frame');

  if (titleEl) titleEl.textContent = title || 'PDF Timetable Preview';
  if (subtitleEl) subtitleEl.textContent = detail ? `${detail} · ${filename}` : filename;
  if (iframe) iframe.src = blobUrl;

  modal.style.display = 'flex';
  document.body.classList.add('modal-open');
}

function closePdfModal() {
  const modal = document.getElementById('pdf-preview-modal');
  if (modal) {
    modal.style.display = 'none';
  }
  document.body.classList.remove('modal-open');

  const iframe = document.getElementById('pdf-preview-frame');
  if (iframe) {
    iframe.src = 'about:blank';
  }

  if (currentPdfBlobUrl) {
    URL.revokeObjectURL(currentPdfBlobUrl);
    currentPdfBlobUrl = null;
  }
  currentPreviewDoc = null;
}

function viewPdf(rows, meta = {}, filename = 'CSET_Date_Sheet_Fall_2026.pdf') {
  const rowsToView = (rows && rows.length) ? rows : getCurrentPrintRows();
  if (!rowsToView || !rowsToView.length) {
    alert('No records selected. Please make a selection first.');
    return;
  }

  const result = createPdfDocument(rowsToView, { ...meta, filename });
  if (!result) return;

  const { doc, filename: resolvedFilename, title, detail } = result;
  currentPreviewDoc = doc;
  currentPreviewFilename = filename || resolvedFilename;

  if (currentPdfBlobUrl) {
    URL.revokeObjectURL(currentPdfBlobUrl);
    currentPdfBlobUrl = null;
  }

  const blob = doc.output('blob');
  currentPdfBlobUrl = URL.createObjectURL(blob);

  openPdfModal(currentPdfBlobUrl, currentPreviewFilename, title, detail);
}

function triggerPrint(rows, metaOverride) {
  // Routes to interactive PDF preview modal
  viewPdf(rows, metaOverride);
}

function pdfFilename(prefix, parts) {
  return `${prefix}_${parts.filter(Boolean).map(s => safe(String(s))).join('_')}_Fall_2026.pdf`;
}

/* ============================================================
   REAL-TIME TIME & PAPER STATUS ENGINE
   ============================================================ */
const PAKISTAN_UTC_OFFSET_HOURS = 5;

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
  return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], hours - PAKISTAN_UTC_OFFSET_HOURS, minutes, 0, 0));
}

function formatPakistanDateTime(date, options) {
  return new Intl.DateTimeFormat('en-PK', {
    timeZone: 'Asia/Karachi',
    ...options
  }).format(date);
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

function getLiveScheduleStatus(now) {
  const active = [];
  const future = [];
  const completed = [];
  const nowMs = now.getTime();

  data.filter(isCyberSecurityScheduleRecord).forEach(r => {
    const start = parseExamDateTime(r.date, r.startTime);
    const end = parseExamDateTime(r.date, r.endTime);
    if (!start || !end) return;

    const startMs = start.getTime();
    const endMs = end.getTime();

    if (nowMs >= startMs && nowMs < endMs) {
      active.push({ ...r, start, end });
    } else if (startMs > nowMs) {
      future.push({ ...r, start, end, msUntil: startMs - nowMs });
    } else if (endMs <= nowMs) {
      completed.push({ ...r, start, end });
    }
  });

  active.sort(sortBySchedule);
  future.sort((a, b) => a.start - b.start || sortBySchedule(a, b));
  completed.sort((a, b) => b.end - a.end || sortBySchedule(a, b));
  const nextStart = future.length ? future[0].start.getTime() : null;
  const nextSession = nextStart === null ? null : {
    time: future[0].start,
    msUntil: future[0].msUntil,
    exams: future.filter(exam => exam.start.getTime() === nextStart)
  };
  return { active, future, nextSession, completed };
}

function liveExamCard(exam) {
  const teacher = (exam.teacher && exam.teacher.trim()) ? exam.teacher.trim() : 'Not Available';
  const examDate = formatPakistanDateTime(exam.start, {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
  });
  return `<article class="tracker-exam-card">
    <h4>${esc(decodeHtml(exam.courseTitle))}</h4>
    <p class="tracker-course-code">${esc(exam.courseCode)}</p>
    <dl class="tracker-exam-details">
      <div><dt>Semester</dt><dd>${esc(exam.semester)}</dd></div>
      <div><dt>Program</dt><dd>${esc(exam.program)}</dd></div>
      <div><dt>Section</dt><dd>${esc(exam.section)}</dd></div>
      <div><dt>Shift</dt><dd>${esc(exam.shift)}</dd></div>
      <div><dt>Exam Date / Time</dt><dd>${esc(examDate)} · ${esc(exam.startTime)} – ${esc(exam.endTime)}</dd></div>
      <div><dt>Room</dt><dd>${esc(exam.room)}</dd></div>
      <div><dt>Teacher / Invigilator</dt><dd>${esc(teacher)}</dd></div>
    </dl>
  </article>`;
}

/* Render Cyber Security Live Tracker */
function renderLiveTrackerWidget(container) {
  if (!container) return;

  const now = new Date();
  const { active, future, nextSession, completed } = getLiveScheduleStatus(now);
  const formattedNow = formatPakistanDateTime(now, {
    weekday: 'long', day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
  });
  const completedOpen = container.querySelector('#completedExams')?.open || false;
  const countdown = nextSession ? formatCountdown(nextSession.msUntil) : null;
  const dateFormat = { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' };
  const timeFormat = { hour: 'numeric', minute: '2-digit', hour12: true };

  const liveContent = active.length
    ? active.map(liveExamCard).join('')
    : '<p class="tracker-empty">No Cyber Security paper is currently being conducted.</p>';

  const upcomingContent = nextSession
    ? `<div class="tracker-section-heading">
        <div>
          <strong>${esc(formatPakistanDateTime(nextSession.time, dateFormat))} · ${esc(formatPakistanDateTime(nextSession.time, timeFormat))}</strong>
          <span>${nextSession.exams.length} paper${nextSession.exams.length === 1 ? '' : 's'} scheduled simultaneously</span>
        </div>
        <div class="countdown-strip" aria-label="Time until next examination">
          <div class="countdown-unit"><span class="num">${countdown.days}</span><span class="lbl">Days</span></div>
          <div class="countdown-unit"><span class="num">${countdown.hours}</span><span class="lbl">Hours</span></div>
          <div class="countdown-unit"><span class="num">${countdown.mins}</span><span class="lbl">Minutes</span></div>
          <div class="countdown-unit"><span class="num">${countdown.secs}</span><span class="lbl">Seconds</span></div>
        </div>
      </div>
      <p class="tracker-upcoming-count">${future.length} upcoming paper${future.length === 1 ? '' : 's'} across BS and MS Cyber Security</p>
      <div class="tracker-exam-grid">${future.map(liveExamCard).join('')}</div>`
    : '<p class="tracker-empty">No upcoming Cyber Security papers are scheduled.</p>';

  const completedContent = completed.length
    ? `<details class="completed-exams" id="completedExams"${completedOpen ? ' open' : ''}>
        <summary><span class="tracker-status completed-status">COMPLETED</span> ${completed.length} paper${completed.length === 1 ? '' : 's'} have ended</summary>
        <div class="tracker-exam-grid">${completed.map(liveExamCard).join('')}</div>
      </details>`
    : '<p class="tracker-empty">No Cyber Security papers have completed yet.</p>';

  const noActiveOrFuture = !active.length && !nextSession
    ? '<p class="tracker-no-current">No Cyber Security paper is currently conducting or upcoming.</p>'
    : '';

  container.innerHTML = `<div class="live-widget-card">
    <div class="live-topbar">
      <div>
        <h3 class="tracker-title">Cyber Security Live Examination Tracker</h3>
        <p class="tracker-subtitle">Status is based on the current Pakistan time.</p>
      </div>
      <div class="live-clock-display"><span aria-hidden="true">🕒</span><time id="liveClockText">${esc(formattedNow)}</time></div>
    </div>
    ${noActiveOrFuture}
    <section class="tracker-section" aria-labelledby="liveNowHeading">
      <h4 id="liveNowHeading"><span class="tracker-status live-status">LIVE NOW</span> ${active.length} paper${active.length === 1 ? '' : 's'}</h4>
      <div class="tracker-exam-grid">${liveContent}</div>
    </section>
    <section class="tracker-section" aria-labelledby="upcomingHeading">
      <h4 id="upcomingHeading"><span class="tracker-status upcoming-status">UPCOMING</span> All scheduled papers</h4>
      ${upcomingContent}
    </section>
    <section class="tracker-section" aria-label="Completed Cyber Security examinations">
      ${completedContent}
    </section>
  </div>`;
}

/* Real-time ticker to keep clock and countdowns live */
function startLiveTicker() {
  // Always clear any existing interval first to prevent stacking
  if (liveTickerInterval) {
    clearInterval(liveTickerInterval);
    liveTickerInterval = null;
  }
  liveTickerInterval = setInterval(() => {
    const container = document.getElementById('liveWidgetContainer') || document.getElementById('dedicatedLiveContainer');
    if (container) renderLiveTrackerWidget(container);
  }, 1000);
}

/* ============================================================
   VIEW: Dedicated Live Tracker
   ============================================================ */
function live() {
  app.innerHTML = layout(
    '⚡ Cyber Security Live Examination Tracker',
    `<p class="muted">Live, upcoming, and completed BS and MS Cyber Security examinations, updated using Pakistan local time.</p>
    <div id="dedicatedLiveContainer" style="margin-top:14px"></div>`
  );
  renderLiveTrackerWidget($('#dedicatedLiveContainer'));
}

const VIEW_PDF_BTN_HTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style="vertical-align:-2px;margin-right:4px"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>View PDF`;

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
      <button class="secondary" id="teacherPrint">${VIEW_PDF_BTN_HTML}</button>
      <button class="secondary" id="teacherPdf">Download PDF</button>
      <button class="secondary" id="teacherImage">Download Image (PNG)</button>
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
    viewPdf(selected, {
      subtitle: 'Teacher-Wise Examination Date Sheet',
      detail: `Teacher / Invigilator: ${teacherName}`
    }, pdfFilename('Teacher', [teacherName]));
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
  $('#teacherImage').onclick = () => {
    if (!selected.length) {
      alert('Please select a teacher first.');
      return;
    }
    const teacherName = $('#teacherSelect').value;
    downloadScheduleImage(
      selected,
      { subtitle: 'Teacher-Wise Examination Date Sheet', detail: `Teacher / Invigilator: ${teacherName}` },
      imageFilename('Teacher-Wise', [teacherName])
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
   VIEW: Cyber Security date sheets (Dynamic Cascading)
   ============================================================ */
function program(initialProgram = ALL_CYBER_SECURITY_PROGRAMS) {
  const cyberPrograms = [ALL_CYBER_SECURITY_PROGRAMS, ...uniq('program').filter(isCyberSecurityProgram)];
  const initialProg = cyberPrograms.includes(initialProgram) ? initialProgram : ALL_CYBER_SECURITY_PROGRAMS;

  app.innerHTML = layout(
    'Cyber Security Date Sheets',
    `<p class="muted">View BS and MS Cyber Security schedules together, or select one program. Choose a date to create a day-wise sheet.</p>
    <div class="toolbar">
      ${selector('Program', 'programName', cyberPrograms, 'Select Program')}
      ${selector('Semester', 'programSem', [])}
      ${selector('Section', 'programSec', [])}
      ${selector('Shift', 'programShift', [])}
      <button class="primary" id="programView">View date sheet</button>
      <button class="secondary" id="programPrint">${VIEW_PDF_BTN_HTML}</button>
      <button class="secondary" id="programPdf">Download PDF</button>
      <button class="secondary" id="programImage">Download Image (PNG)</button>
    </div>
    <div id="programResult" style="margin-top:18px"></div>`
  );

  const programSelect = $('#programName');
  const semSelect = $('#programSem');
  const secSelect = $('#programSec');
  const shiftSelect = $('#programShift');
  programSelect.value = initialProg;

  // Dynamic cascading updates
  function updateCascade(changedLevel) {
    const p = programSelect.value;
    let pRecords = data.filter(x => isCyberSecurityScheduleRecord(x) &&
      (p === ALL_CYBER_SECURITY_PROGRAMS || x.program === p));

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

  programSelect.onchange = () => {
    semSelect.value = '';
    secSelect.value = '';
    shiftSelect.value = '';
    activeProgramDate = '';
    updateCascade('program');
  };

  semSelect.onchange = () => {
    secSelect.value = '';
    shiftSelect.value = '';
    activeProgramDate = '';
    updateCascade('semester');
  };

  secSelect.onchange = () => {
    shiftSelect.value = '';
    activeProgramDate = '';
    updateCascade('section');
  };

  shiftSelect.onchange = () => {
    renderProgram();
  };

  $('#programView').onclick = renderProgram;

  $('#programPrint').onclick = () => {
    if (!selected.length) {
      alert('No Cyber Security records match the selected filters.');
      return;
    }
    const p = programSelect.value;
    const sem = $('#programSem').value;
    const sec = $('#programSec').value;
    const shift = $('#programShift').value;
    let detail = p;
    if (sem) detail += ` · Semester ${sem}`;
    if (sec) detail += ` · Section ${sec}`;
    if (shift) detail += ` · ${shift}`;
    if (activeProgramDate) detail += ` · ${formatDate(activeProgramDate)}`;
    viewPdf(
      selected,
      { subtitle: 'Cyber Security Date Sheet', detail },
      pdfFilename('Cyber_Security', [p, sem ? `Sem_${sem}` : '', sec ? `Sec_${sec}` : '', shift, activeProgramDate])
    );
  };

  $('#programPdf').onclick = () => {
    if (!selected.length) {
      alert('No Cyber Security records match the selected filters.');
      return;
    }
    const p = programSelect.value;
    const sem = $('#programSem').value;
    const sec = $('#programSec').value;
    const shift = $('#programShift').value;
    let detail = p;
    if (sem) detail += ` · Semester ${sem}`;
    if (sec) detail += ` · Section ${sec}`;
    if (shift) detail += ` · ${shift}`;
    if (activeProgramDate) detail += ` · ${formatDate(activeProgramDate)}`;
    downloadPdf(
      selected,
      { subtitle: 'Cyber Security Date Sheet', detail },
      pdfFilename('Cyber_Security', [p, sem ? `Sem_${sem}` : '', sec ? `Sec_${sec}` : '', shift, activeProgramDate])
    );
  };

  $('#programImage').onclick = () => {
    if (!selected.length) {
      alert('No Cyber Security records match the selected filters.');
      return;
    }
    const isDayWise = !!activeProgramDate;
    downloadScheduleImage(
      selected,
      { subtitle: 'Cyber Security Date Sheet' },
      isDayWise
        ? imageFilename('Cyber-Security-Day-Wise', [formatDate(activeProgramDate)])
        : imageFilename('Cyber-Security-Class-Wise', [
          $('#programSem').value && `Semester-${$('#programSem').value}`,
          $('#programSec').value && `Section-${$('#programSec').value}`,
          $('#programShift').value
        ])
    );
  };

  // Initial trigger
  updateCascade('init');
}

/* ============================================================
   DATE FILTER HELPERS (Cyber Security Sheets)
   ============================================================ */
function buildDateChips(availableDates, selectedDate) {
  const sorted = [...availableDates].sort((a, b) => a.localeCompare(b));
  if (!sorted.length) return '';
  return `<div class="day-chip-container no-print" id="programDateChipsBar">
    <span class="day-chip-label">Filter by Date:</span>
    <button class="chip-btn${!selectedDate ? ' active' : ''}" onclick="setProgramDateFilter('')">All Dates</button>
    ${sorted.map(date => {
      const exam = data.find(row => row.date === date && isCyberSecurityScheduleRecord(row));
      return `<button class="chip-btn${date === selectedDate ? ' active' : ''}" onclick="setProgramDateFilter('${esc(date)}')">${esc(formatLongDate(date))}${exam?.day ? ` · ${esc(exam.day)}` : ''}</button>`;
    }).join('')}
  </div>`;
}

window.setProgramDateFilter = function(date) {
  activeProgramDate = date;
  renderProgram();
};

function renderProgram() {
  const p = $('#programName')?.value || ALL_CYBER_SECURITY_PROGRAMS;
  const sem = $('#programSem')?.value;
  const sec = $('#programSec')?.value;
  const shift = $('#programShift')?.value;

  // Base filtered set before the date filter, used to derive available dates.
  const baseFiltered = data.filter(x => {
    if (!isCyberSecurityScheduleRecord(x) || (p !== ALL_CYBER_SECURITY_PROGRAMS && x.program !== p)) return false;
    if (sem && String(x.semester) !== sem) return false;
    if (sec && x.section !== sec) return false;
    if (shift && x.shift !== shift) return false;
    return true;
  });

  // Derive date choices from the class-filtered Cyber Security records.
  const availableDates = [...new Set(baseFiltered.map(x => x.date).filter(Boolean))];

  if (activeProgramDate && !availableDates.includes(activeProgramDate)) {
    activeProgramDate = '';
  }

  // Apply the selected date after the class filters.
  selected = baseFiltered.filter(x => {
    if (activeProgramDate && x.date !== activeProgramDate) return false;
    return true;
  }).sort(sortBySchedule);

  const existingChipsBar = document.getElementById('programDateChipsBar');
  const chipsHtml = buildDateChips(availableDates, activeProgramDate);
  const resultDiv = $('#programResult');
  if (existingChipsBar) {
    existingChipsBar.outerHTML = chipsHtml || '';
  } else if (chipsHtml && resultDiv) {
    resultDiv.insertAdjacentHTML('beforebegin', chipsHtml);
  }

  const resultHeading = `<h3>Department of Cyber Security · ${selected.length} paper${selected.length === 1 ? '' : 's'}</h3>`;
  const programContext = [
    p === ALL_CYBER_SECURITY_PROGRAMS ? 'BS and MS Cyber Security' : p,
    sem && `Semester ${sem}`,
    sec && `Section ${sec}`,
    shift
  ].filter(Boolean).join(' · ');
  const printMeta = {
    isCyberSecurityProgram: true,
    programName: p,
    programContext,
    programCoordinator: 'Program Coordinator: Dr. Hira Nazir'
  };
  const dayTables = activeProgramDate ? buildDayWiseGroups(selected, false, printMeta) : '';
  const cyberInfo = !activeProgramDate
    ? buildCyberSecurityInfoBox({ session: 'Fall 2026', program: programContext })
    : '';
  resultDiv.innerHTML = `${resultHeading}${activeProgramDate ? dayTables : `${cyberInfo}${table(selected, 'program')}`}`;
}

/* ============================================================
   VIEW: Class-wise date sheets (Dynamic Cascading)
   ============================================================ */
function classView(initialProgram = '') {
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
      <button class="secondary" id="classPrint">${VIEW_PDF_BTN_HTML}</button>
      <button class="secondary" id="classPdf" title="Download selected class as PDF">Download PDF</button>
      <button class="secondary" id="classImage">Download Image (PNG)</button>
    </div>
    <div id="classResult" style="margin-top:18px"></div>`
  );

  const pSel = $('#classP');
  const sSel = $('#classS');
  const secSel = $('#classSec');
  const shSel = $('#classSh');
  if (initialProgram) pSel.value = initialProgram;

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

    const cyberMeta = isCyberSecurityProgram(p) ? buildCyberSecurityInfoBox({
      session: 'Fall 2026',
      program: `${p} · Semester ${s} · Section ${sec} · ${sh} Shift`,
      programCoordinator: 'Program Coordinator: Dr. Hira Nazir'
    }) : '';
    $('#classResult').innerHTML = `${isCyberSecurityProgram(p) ? '<h3>Department of Cyber Security</h3>' : ''}${cyberMeta}<h3>${esc(p)} · Semester ${esc(s)} · Section ${esc(sec)} · ${esc(sh)} · ${selected.length} papers</h3>${table(selected, 'class')}`;
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
  if (initialProgram) updateClassCascade('program');

  $('#classPrint').onclick = () => {
    if (!selected.length) {
      alert('Please select all four class attributes first.');
      return;
    }
    const p = pSel.value;
    const s = sSel.value;
    const sec = secSel.value;
    const sh = shSel.value;
    viewPdf(selected, {
      subtitle: 'Class-Wise Examination Date Sheet',
      detail: `${p} · Semester ${s} · Section ${sec} · ${sh} Shift`
    }, pdfFilename(safe(p), [`Semester_${s}`, `Section_${sec}`, sh]));
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

  $('#classImage').onclick = () => {
    if (!selected.length) {
      alert('Please select all four class attributes first.');
      return;
    }
    const p = pSel.value;
    const s = sSel.value;
    const sec = secSel.value;
    const sh = shSel.value;
    downloadScheduleImage(
      selected,
      { subtitle: 'Class-Wise Examination Date Sheet', detail: `${p} · Semester ${s} · Section ${sec} · ${sh} Shift` },
      imageFilename(isCyberSecurityProgram(p) || selected.every(isCyberSecurityScheduleRecord) ? 'Cyber-Security-Class-Wise' : 'Class-Wise', [p, `Semester-${s}`, `Section-${sec}`, sh])
    );
  };
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
  if (isCyberSecurityProgram(progName)) show('program');
  else show('class', progName);
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
          <p class="muted" style="margin:0;font-size:12.5px">Select any academic program to instantly browse, view PDF preview, or download its official Mid-Term schedule.</p>
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
      <p class="muted">Access Cyber Security schedules, class timetables, live status, or teacher duty sheets.</p>
      <div class="toolbar">
        <button class="primary" onclick="show('program')">Cyber Security Date Sheets</button>
        <button class="secondary" onclick="show('class')">Class Sheets</button>
        <button class="secondary" onclick="show('live')">⚡ Live Tracker</button>
        <button class="secondary" onclick="show('teacher')">Teacher Duty Sheets</button>
        <button class="secondary" id="completeImage">Download Complete Date Sheet Image (PNG)</button>
      </div>
    </div>
  `;

  renderLiveTrackerWidget($('#liveWidgetContainer'));
  $('#completeImage').onclick = () => {
    const rows = [...data].sort(sortBySchedule);
    downloadScheduleImage(
      rows,
      {
        sheetType: 'Complete Examination Date Sheet',
        subtitle: 'Complete Examination Date Sheet',
        detailLabel: 'Selection',
        detail: 'Complete Examination Date Sheet'
      },
      imageFilename('Complete-Date-Sheet')
    );
  };

  app.insertAdjacentHTML('beforeend', `
    <section class="card exam-notice" aria-labelledby="examNoticeTitle">
      <div>
        <p class="notice-label">IMPORTANT FOR ALL STUDENTS</p>
        <h3 id="examNoticeTitle">Examination Notice / Important Instructions</h3>
        <p>Arrive at least 15 minutes before your examination, bring your valid university ID, and follow the approved date sheet and invigilation staff instructions.</p>
      </div>
      <a class="notice-link" href="#instructions" onclick="show('instructions'); return false;">Read Full Instructions</a>
    </section>
  `);
}

function instructionsView() {
  app.innerHTML = layout(
    'Mid-Term Examination Guidelines',
    `<p class="muted instructions-intro">Please read and follow the examination instructions and notices below.</p>
    <div class="instructions-list">
      <section class="instruction-card">
        <h3>1. Mid-Term Examination Instructions</h3>
        <p>Dear Students,</p>
        <p>All students are instructed to strictly follow these guidelines during the Mid-Term Examinations:</p>
        <ol>
          <li>Follow the approved date sheet and arrive at the examination room at least 15 minutes before the scheduled time.</li>
          <li>Bring your valid university ID card.</li>
          <li>Late arrival will be dealt with according to university rules.</li>
          <li>Bring your own stationery. Mobile phones, smartwatches, and other unauthorized electronic devices are strictly prohibited.</li>
          <li>Maintain silence and discipline throughout the examination.</li>
          <li>Cheating, copying, impersonation, and the use of unauthorized material are strictly prohibited.</li>
          <li>Write your name, roll number, and other required information correctly on the answer sheet.</li>
          <li>Do not leave the examination hall without the invigilator’s permission.</li>
          <li>Follow all instructions issued by the invigilation staff and the Incharge Examination.</li>
        </ol>
        <p class="instruction-important"><strong>Important:</strong> Any violation of these instructions may result in disciplinary action under university rules.</p>
        <p>Your cooperation is expected to ensure the smooth and fair conduct of examinations.</p>
        <p class="instruction-signature"><strong>Incharge Examination</strong><br>Faculty of Computing &amp; Emerging Technologies</p>
      </section>

      <section class="instruction-card">
        <h3>2. Soft Reminder: Fees and Examination Eligibility</h3>
        <p>Aslam o alaikum</p>
        <ol>
          <li>All Repeaters are informed to bring a paid voucher of supplementary exam worth 6025/- during exam.</li>
          <li>All students mentioned in the above fee defaulter list will bring paid fee voucher of semester otherwise they will not be allowed to sit in the exam. Thanks</li>
        </ol>
        <p>Aslam o alaikum</p>
        <p>All CRs and GRs are informed that an excel sheet has been shared below in which all those students are mentioned who have not paid their semester dues.</p>
        <p>If any one student claims that he or she has paid semester dues then he / she is informed to show paid voucher at admin office.</p>
        <p>All these student names will be excluded from the exam attendance sheet and will not be allowed to sit in exam.</p>
        <p>To avoid any inconveniences during mid term exams, pay your current semester dues and pending dues before exams. thanks</p>
      </section>

      <section class="instruction-card">
        <h3>3. Mid-Term Examination Classroom Instructions</h3>
        <p>Assalam-o-Alaikum Everyone,</p>
        <p>As instructed by the department, Mid-Term Examinations will start from Monday, 02 November 2026, in four different slots.</p>
        <p>All students are requested to cooperate and follow these instructions:</p>
        <ol>
          <li>Do not leave question papers behind after completing your exam.</li>
          <li>Do not throw any wrappers or litter in the classrooms.</li>
          <li>Every classroom has been assigned a specific room number. Please make sure you enter the correct room.</li>
          <li>Do not disturb or change the seating arrangements, as chairs have been arranged according to examination SOPs.</li>
        </ol>
        <p>There will be very little time between exam slots for classroom cleaning and preparation. Therefore, everyone is requested to act responsibly and keep the classrooms clean.</p>
        <p>Your cooperation will be appreciated.</p>
      </section>

      <section class="instruction-card">
        <h3>4. Exam Notice: Repeaters and Paper Clashes</h3>
        <p>All repeaters are hereby informed that if there is any clash between regular and repeater paper then immediately report to Admin office (Mr. Irfan Ajmal) today so that your problem could resolved before time. Kindly follow following instructions.</p>
        <ol>
          <li>Kindly pay your fee vouchers of supplementary exam before Mid Term Exam. No one repeater will be allowed to sit in exam without paid fee voucher worth 6025/-.</li>
          <li>All those students who have not paid semester fee voucher, will not be allowed to sit in the exam.</li>
          <li>If any one student claim clash in paper timing without any clash then their paper will be cancelled directly and he / she will not be allowed to sit in exam.</li>
          <li>If any one student have applied for repeat subject and still there is any error in their voucher then visit admin office on immediate basis.</li>
        </ol>
      </section>
    </div>`
  );
}

function aboutContact() {
  app.innerHTML = `
    <section class="about-contact-page" aria-labelledby="about-contact-title">
      <div class="about-contact-intro">
        <p class="eyebrow">EMERSON UNIVERSITY MULTAN · DEPARTMENT OF CYBER SECURITY</p>
        <h2 id="about-contact-title">About the Portal &amp; Developer</h2>
        <p class="muted">About this examination resource, its developer, and how to get in touch.</p>
      </div>

      <section class="card portal-overview" aria-labelledby="portal-overview-title">
        <h3 id="portal-overview-title">The Date Sheet Portal</h3>
        <p>This portal provides students and staff with a clear, accessible way to consult the Fall 2026 Mid-Term Examination schedule. It brings verified examination information together in one place to make schedules easier to find, review, and share.</p>
        <div class="portal-feature-grid">
          <div><strong>Verified schedule</strong><span>413 examination records, with examination details retained from the source schedule.</span></div>
          <div><strong>Useful views</strong><span>Cyber Security day-wise and class-wise schedules, class sheets for programs, teacher duty sheets, and a live tracker.</span></div>
          <div><strong>Practical tools</strong><span>Search, filters, browser print, PDF preview and download, and PNG timetable downloads.</span></div>
          <div><strong>Built with</strong><span>HTML, CSS, and vanilla JavaScript, with jsPDF and AutoTable for PDF exports.</span></div>
        </div>
      </section>

      <div class="about-contact-grid">
        <section class="card developer-card" aria-labelledby="developer-name">
          <div class="developer-heading">
            <div class="developer-avatar" aria-hidden="true">MA</div>
            <div>
              <p class="developer-label">Portal Developer</p>
              <h3 id="developer-name">Muhammad Arif</h3>
              <p class="muted">BS Cyber Security · 7th Semester (Evening)</p>
            </div>
          </div>
          <p class="developer-description">I developed this examination portal to make verified schedules easier to access and use. My interests include cybersecurity and web development, especially building useful, straightforward digital tools.</p>
          <div class="developer-details">
            <div class="developer-detail">
              <span>Degree</span>
              <strong>BS Cyber Security</strong>
            </div>
            <div class="developer-detail">
              <span>Semester</span>
              <strong>7th Semester (Evening)</strong>
            </div>
            <div class="developer-detail">
              <span>Session</span>
              <strong>2023–2027</strong>
            </div>
            <div class="developer-detail">
              <span>Institution</span>
              <strong>Emerson University Multan</strong>
            </div>
            <div class="developer-detail">
              <span>Department</span>
              <strong>Cyber Security</strong>
            </div>
            <div class="developer-detail">
              <span>Role</span>
              <strong>Portal Developer</strong>
            </div>
          </div>
        </section>

        <section class="card contact-card" aria-labelledby="contact-title">
          <p class="eyebrow">GET IN TOUCH</p>
          <h3 id="contact-title">Contact the Developer</h3>
          <p class="muted">For questions, schedule corrections, or feedback about the portal.</p>
          <div class="contact-actions">
            <a class="contact-action contact-call" href="tel:03060830941">Call: 03060830941</a>
            <a class="contact-action contact-whatsapp" href="https://wa.me/923060830941" target="_blank" rel="noopener noreferrer">WhatsApp</a>
            <a class="contact-action contact-email" href="mailto:ranaarifnoon66@gmail.com">Email</a>
          </div>

          <form id="contactEmailForm" class="contact-form">
            <h4>Send a Message</h4>
            <div class="contact-form-grid">
              <div class="field">
                <label for="contactName">Your Name</label>
                <input id="contactName" name="name" type="text" autocomplete="name" required>
              </div>
              <div class="field">
                <label for="contactEmail">Your Email</label>
                <input id="contactEmail" name="email" type="email" autocomplete="email" required>
              </div>
              <div class="field contact-form-full">
                <label for="contactSubject">Subject</label>
                <input id="contactSubject" name="subject" type="text" required>
              </div>
              <div class="field contact-form-full">
                <label for="contactMessage">Message</label>
                <textarea id="contactMessage" name="message" rows="5" required></textarea>
              </div>
            </div>
            <button class="primary" type="submit">Send Message</button>
            <p class="muted contact-form-note">Your default email application will open with your message prepared. You can review and send it there.</p>
          </form>
        </section>
      </div>
    </section>
  `;

  $('#contactEmailForm').onsubmit = event => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const name = $('#contactName').value.trim();
    const email = $('#contactEmail').value.trim();
    const subject = $('#contactSubject').value.trim();
    const message = $('#contactMessage').value.trim();
    const body = `Name: ${name}\nEmail: ${email}\n\n${message}`;
    window.location.href = `mailto:ranaarifnoon66@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };
}

/* ============================================================
   ROUTING
   ============================================================ */
function show(v, param = '') {
  // Clear live ticker interval when leaving live/dashboard views;
  // it will be re-started only when dashboard or live view loads.
  if (liveTickerInterval && v !== 'live' && v !== 'dashboard') {
    clearInterval(liveTickerInterval);
    liveTickerInterval = null;
  }
  view = v;
  document.querySelectorAll('nav button').forEach(b => b.classList.toggle('active', b.dataset.view === v));
  const views = {
    dashboard,
    live,
    teacher,
    program: () => program(param),
    class: () => classView(param),
    instructions: instructionsView,
    about: aboutContact
  };
  (views[v] || dashboard)();
  if (v === 'dashboard' || v === 'live') startLiveTicker();
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
  // Resolve app element here — guarantees DOM is ready
  app = document.getElementById('app');
  if (!app) {
    console.error('CSET Portal: #app element not found in DOM.');
    return;
  }

  // Bind PDF Preview Modal listeners
  const modal = document.getElementById('pdf-preview-modal');
  const modalCloseBtn = document.getElementById('modal-close-btn');
  const modalDownloadBtn = document.getElementById('modal-download-btn');

  if (modalCloseBtn) {
    modalCloseBtn.onclick = closePdfModal;
  }
  if (modalDownloadBtn) {
    modalDownloadBtn.onclick = () => {
      if (currentPreviewDoc) {
        currentPreviewDoc.save(currentPreviewFilename || 'CSET_Date_Sheet_Fall_2026.pdf');
      }
    };
  }
  if (modal) {
    modal.onclick = (e) => {
      if (e.target === modal) {
        closePdfModal();
      }
    };
  }
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal && modal.style.display !== 'none') {
      closePdfModal();
    }
  });

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
