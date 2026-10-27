const $ = s => document.querySelector(s);
const app = $('#app');
let data = [];
let view = 'dashboard';
let selected = [];

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

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

function download(rows, name) {
  const cols = ['date', 'day', 'startTime', 'endTime', 'slot', 'program', 'semester', 'section', 'shift', 'courseCode', 'courseTitle', 'teacher', 'room'];
  const headers = ['Date', 'Day', 'Start Time', 'End Time', 'Slot', 'Program', 'Semester', 'Section', 'Shift', 'Course Code', 'Course Title', 'Invigilator', 'Room'];
  const csvRows = [
    headers.map(h => `"${h}"`).join(','),
    ...rows.map(r => cols.map(k => {
      let val = r[k] ?? '';
      if (k === 'teacher' && (!val || !String(val).trim())) val = 'Not Available';
      return `"${String(val).replaceAll('"', '""')}"`;
    }).join(','))
  ];
  const csvContent = '\ufeff' + csvRows.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
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
    department: 'FACULTY OF COMPUTING AND EMERGING TECHNOLOGIES',
    heading: 'MID-TERM EXAMINATION DATE SHEET',
    subheading: 'FALL SEMESTER 2026',
    period: 'Examination period: 28 October 2026 to 6 November 2026',
    generatedOn: `Date sheet generated: ${generatedAt}`
  };

  if (view === 'teacher' && $('#teacherSelect')?.value) {
    return { ...base, subtitle: 'Teacher-Wise Examination Date Sheet', detail: $('#teacherSelect').value };
  }
  if (view === 'program' && $('#programSelect')?.value) {
    return { ...base, subtitle: 'Program-Wise Examination Date Sheet', detail: $('#programSelect').value };
  }
  if (view === 'class' && $('#classP')?.value) {
    const p = $('#classP').value;
    const s = $('#classS').value;
    const sec = $('#classSec').value;
    const shift = $('#classSh').value;
    const classDetail = `${p} · Semester ${s} · Section ${sec} · ${shift}`;
    return { ...base, subtitle: 'Class-Wise Examination Date Sheet', detail: classDetail };
  }
  if (view === 'calendar') {
    return { ...base, subtitle: 'Examination Calendar', detail: 'Departmental examination schedule' };
  }
  if (view === 'complete') {
    return { ...base, subtitle: 'Complete Examination Date Sheet', detail: `${rows.length} records` };
  }
  return { ...base, subtitle: 'Complete Examination Date Sheet', detail: 'Portal overview' };
}

function buildPrintTable(rows) {
  if (!rows.length) {
    return '<div class="print-empty">No matching records available for printing.</div>';
  }

  const isCalendar = view === 'calendar';
  const columns = isCalendar
    ? ['date', 'day', 'startTime', 'endTime', 'courseCode', 'courseTitle', 'program', 'semester', 'section', 'shift', 'teacher', 'room']
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

  return `<table class="print-table">
    <thead>
      <tr>${columns.map(c => `<th>${heads[c]}</th>`).join('')}</tr>
    </thead>
    <tbody>
      ${rows.map(r => `<tr>${columns.map(c => {
        const safeVal = c === 'teacher' ? (r.teacher && r.teacher.trim() ? r.teacher : 'Not Available') : (r[c] ?? '');
        return `<td>${esc(safeVal)}</td>`;
      }).join('')}</tr>`).join('')}
    </tbody>
  </table>`;
}

function renderPrintDocument() {
  const rows = getCurrentPrintRows();
  const meta = getPrintMeta(rows);
  const printDoc = document.getElementById('printDocument') || document.createElement('div');
  printDoc.id = 'printDocument';
  printDoc.className = 'print-sheet';
  printDoc.innerHTML = `
    <div class="print-header">
      <div class="print-title">${esc(meta.title)}</div>
      <div class="print-department">${esc(meta.department)}</div>
      <div class="print-heading">${esc(meta.heading)}</div>
      <div class="print-subheading">${esc(meta.subheading)}</div>
      ${meta.detail ? `<div class="print-context">${esc(meta.detail)}</div>` : ''}
      <div class="print-meta">
        <span>${esc(meta.period)}</span>
        <span>${esc(meta.generatedOn)}</span>
      </div>
      <div class="print-divider"></div>
    </div>
    ${buildPrintTable(rows)}
    <div class="print-footer">
      <div class="print-signature">
        <strong>HOD / Head of Department</strong>
        <div>Signature: <span class="line"></span></div>
        <div>Name: <span class="line"></span></div>
        <div>Date: <span class="line"></span></div>
      </div>
      <div class="print-signature">
        <strong>Examination Coordinator</strong>
        <div>Signature: <span class="line"></span></div>
        <div>Name: <span class="line"></span></div>
        <div>Date: <span class="line"></span></div>
      </div>
    </div>
  `;
  document.body.appendChild(printDoc);
  document.body.classList.add('print-mode');
  return printDoc;
}

function triggerPrint(rows, metaOverride) {
  const rowsToPrint = rows && rows.length ? rows : getCurrentPrintRows();
  if (!rowsToPrint.length) return;
  if (metaOverride) {
    const override = { title: 'EMERSON UNIVERSITY MULTAN', department: 'FACULTY OF COMPUTING AND EMERGING TECHNOLOGIES', heading: 'MID-TERM EXAMINATION DATE SHEET', subheading: 'FALL SEMESTER 2026', ...metaOverride };
    const printDoc = document.getElementById('printDocument') || document.createElement('div');
    printDoc.id = 'printDocument';
    printDoc.className = 'print-sheet';
    printDoc.innerHTML = `
      <div class="print-header">
        <div class="print-title">${esc(override.title)}</div>
        <div class="print-department">${esc(override.department)}</div>
        <div class="print-heading">${esc(override.heading)}</div>
        <div class="print-subheading">${esc(override.subheading)}</div>
        ${override.detail ? `<div class="print-context">${esc(override.detail)}</div>` : ''}
        <div class="print-meta">
          <span>${esc(override.period || 'Examination period: 28 October 2026 to 6 November 2026')}</span>
          <span>${esc(override.generatedOn || `Date sheet generated: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}`)}</span>
        </div>
        <div class="print-divider"></div>
      </div>
      ${buildPrintTable(rowsToPrint)}
      <div class="print-footer">
        <div class="print-signature"><strong>HOD / Head of Department</strong><div>Signature: <span class="line"></span></div><div>Name: <span class="line"></span></div><div>Date: <span class="line"></span></div></div>
        <div class="print-signature"><strong>Examination Coordinator</strong><div>Signature: <span class="line"></span></div><div>Name: <span class="line"></span></div><div>Date: <span class="line"></span></div></div>
      </div>
    `;
    document.body.appendChild(printDoc);
    document.body.classList.add('print-mode');
    window.print();
    return;
  }
  renderPrintDocument();
  window.print();
}

window.addEventListener('afterprint', () => {
  document.body.classList.remove('print-mode');
  const printDoc = document.getElementById('printDocument');
  if (printDoc) printDoc.remove();
});

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
    <button class="secondary" id="csv">Export CSV</button>
    <button class="secondary" id="print">Print results</button>
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
  $('#csv').onclick = () => download(filtered(), 'CSET_Complete_Date_Sheet_Fall_2026.csv');
  $('#print').onclick = () => triggerPrint(filtered(), { subtitle: 'Complete Examination Date Sheet', detail: `${filtered().length} records` });
}

function selector(label, id, values) {
  return `<div class="field"><label>${label}</label><select id="${id}">${opts(values, 'Select ' + label)}</select></div>`;
}

function teacher() {
  app.innerHTML = layout(
    'Teacher date sheets',
    `<p class="muted">Select an invigilator or "Not Available" to view all assigned papers.</p>
    <div class="toolbar">
      ${selector('Teacher', 'teacherSelect', getTeachers())}
      <button class="primary" id="viewTeacher">View schedule</button>
      <button class="secondary" id="teacherCsv">Download CSV</button>
      <button class="secondary" id="teacherPrint">Print</button>
    </div>
    <div id="teacherResult" style="margin-top:18px"></div>`
  );
  $('#viewTeacher').onclick = renderTeacher;
  $('#teacherSelect').onchange = renderTeacher;
  $('#teacherPrint').onclick = () => {
    if (selected.length) {
      triggerPrint(selected, {
        subtitle: 'Teacher-Wise Examination Date Sheet',
        detail: `${$('#teacherSelect').value} · ${selected.length} papers`
      });
    }
  };
  $('#teacherCsv').onclick = () => {
    if (selected.length) {
      const t = $('#teacherSelect').value;
      download(selected, `Teacher_${safe(t)}_Fall_2026.csv`);
    }
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
      <button class="secondary" id="programCsv">Export CSV</button>
      <button class="secondary" id="programPrint">Print</button>
    </div>
    <div id="programResult" style="margin-top:18px"></div>`
  );
  $('#programView').onclick = renderProgram;
  $('#programSelect').onchange = renderProgram;
  $('#programSem').onchange = renderProgram;
  $('#programSec').onchange = renderProgram;
  $('#programShift').onchange = renderProgram;
  $('#programPrint').onclick = () => {
    if (selected.length) {
      triggerPrint(selected, {
        subtitle: 'Program-Wise Examination Date Sheet',
        detail: `${$('#programSelect').value}${$('#programSem').value ? ` · Semester ${$('#programSem').value}` : ''}${$('#programSec').value ? ` · Section ${$('#programSec').value}` : ''}${$('#programShift').value ? ` · ${$('#programShift').value}` : ''}`
      });
    }
  };
  $('#programCsv').onclick = () => {
    if (selected.length) {
      const p = $('#programSelect').value;
      download(selected, `Program_${safe(p)}_Date_Sheet.csv`);
    }
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
      <button class="secondary" id="classCsv">Export CSV</button>
      <button class="secondary" id="classPrint">Print</button>
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
    if (selected.length) {
      triggerPrint(selected, {
        subtitle: 'Class-Wise Examination Date Sheet',
        detail: `${$('#classP').value} · Semester ${$('#classS').value} · Section ${$('#classSec').value} · ${$('#classSh').value}`
      });
    }
  };
  $('#classCsv').onclick = () => {
    if (selected.length) {
      const p = $('#classP').value;
      const s = $('#classS').value;
      const sec = $('#classSec').value;
      const sh = $('#classSh').value;
      download(selected, `Class_${safe(p)}_Sem_${s}_Sec_${sec}_${safe(sh)}_Date_Sheet.csv`);
    }
  };
}

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
    const rows = matched;
    triggerPrint(rows, {
      subtitle: 'Examination Calendar',
      detail: `${tFilter || 'All teachers'} · ${pFilter || 'All programs'}`
    });
  };
}

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

function show(v) {
  view = v;
  document.querySelectorAll('nav button').forEach(b => b.classList.toggle('active', b.dataset.view === v));
  const views = {
    dashboard,
    complete,
    teacher,
    program,
    class: classView,
    calendar,
    print: complete
  };
  (views[v] || dashboard)();
}

document.querySelectorAll('nav button').forEach(b => {
  b.onclick = () => show(b.dataset.view);
});

$('#theme').onclick = () => {
  document.body.classList.toggle('dark');
};

function initApp() {
  if (window.EXAM_DATA && Array.isArray(window.EXAM_DATA) && window.EXAM_DATA.length > 0) {
    data = window.EXAM_DATA;
    dashboard();
  } else {
    fetch('data/exam_schedule.json')
      .then(r => {
        if (!r.ok) throw new Error('Network error');
        return r.json();
      })
      .then(x => {
        data = x;
        dashboard();
      })
      .catch(() => {
        app.innerHTML = '<div class="card empty">Could not load the schedule. If opened via file://, a local static server like <b>py -m http.server</b> is recommended, then open http://localhost:8000.</div>';
      });
  }
}

initApp();
