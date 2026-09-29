import {
  DEFAULT_GRADE_TABLE,
  DEFAULT_FIVE_LEVEL_TABLE,
  REFERENCE_ALGORITHMS,
  percentToPoints,
  coursePoints,
  computeGpa,
  estimateRequired,
  parseTranscript,
} from './gpa.js';

const STORAGE_KEY = 'uibe-gpa-calculator/v1';

const state = {
  courses: [],            // {name, credits, type:'percent'|'five', score}
  algo: 'uibe',           // uibe | wes | tsinghua5
  gradeTable: structuredClone(DEFAULT_GRADE_TABLE),
  fiveLevelTable: structuredClone(DEFAULT_FIVE_LEVEL_TABLE),
};

const $ = (sel) => document.querySelector(sel);
const el = {
  body: $('#course-body'),
  gpa: $('#stat-gpa'),
  credits: $('#stat-credits'),
  points: $('#stat-points'),
  count: $('#stat-count'),
  gpaLabel: $('#gpa-label'),
  simTarget: $('#sim-target'),
  simExtra: $('#sim-extra'),
  simResult: $('#sim-result'),
  bandGrid: $('#band-grid'),
  toast: $('#toast'),
};

/* ---------- 持久化 ---------- */

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    courses: state.courses,
    algo: state.algo,
    gradeTable: state.gradeTable,
    fiveLevelTable: state.fiveLevelTable,
  }));
}

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!saved) return;
    state.courses = Array.isArray(saved.courses) ? saved.courses : [];
    state.algo = saved.algo || 'uibe';
    if (Array.isArray(saved.gradeTable) && saved.gradeTable.length) state.gradeTable = saved.gradeTable;
    if (Array.isArray(saved.fiveLevelTable) && saved.fiveLevelTable.length) state.fiveLevelTable = saved.fiveLevelTable;
  } catch {
    /* 数据损坏时按全新状态启动 */
  }
}

/* ---------- 工具 ---------- */

let toastTimer;
function toast(msg) {
  el.toast.textContent = msg;
  el.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.remove('show'), 1800);
}

function tables() {
  return { gradeTable: state.gradeTable, fiveLevelTable: state.fiveLevelTable };
}

/** 按当前算法给一门课打分；返回 {points?, error?} */
function pointsFor(course) {
  try {
    if (state.algo === 'tsinghua5' && course.type === 'percent') {
      return { points: REFERENCE_ALGORITHMS.tsinghua5.formula(Number(course.score)) };
    }
    if (state.algo === 'wes' && course.type === 'percent') {
      return { points: percentToPoints(Number(course.score), REFERENCE_ALGORITHMS.wes.bands) };
    }
    return { points: coursePoints(course, tables()) };
  } catch (err) {
    return { error: err.message };
  }
}

/* ---------- 课程表渲染 ---------- */

function addCourse(course = { name: '', credits: '', type: 'percent', score: '' }) {
  state.courses.push(course);
  render();
}

function renderRows() {
  el.body.innerHTML = '';
  state.courses.forEach((course, i) => {
    const tr = document.createElement('tr');
    const { points, error } = course.score === '' || course.score == null
      ? {}
      : pointsFor(course);

    tr.innerHTML = `
      <td><input class="name" placeholder="课程名（选填）" value="${escapeAttr(course.name)}" data-i="${i}" data-field="name" /></td>
      <td><input class="num" type="number" step="0.5" min="0" value="${escapeAttr(course.credits)}" data-i="${i}" data-field="credits" /></td>
      <td>
        <select data-i="${i}" data-field="type">
          <option value="percent" ${course.type === 'percent' ? 'selected' : ''}>百分制</option>
          <option value="five" ${course.type === 'five' ? 'selected' : ''}>五级制</option>
        </select>
      </td>
      <td>${
        course.type === 'five'
          ? `<select data-i="${i}" data-field="score">
              ${course.score === '' || course.score == null ? '<option value="" selected hidden>选择等级</option>' : ''}
              ${state.fiveLevelTable.map((r) =>
                `<option value="${escapeAttr(r.grade)}" ${course.score === r.grade ? 'selected' : ''}>${r.grade}</option>`).join('')}
             </select>`
          : `<input class="score" type="number" min="0" max="100" step="0.5" value="${escapeAttr(course.score)}" data-i="${i}" data-field="score" />`
      }</td>
      <td class="points-cell">${points != null ? points.toFixed(2) : '—'}</td>
      <td><button class="icon" title="删除本行" data-i="${i}" data-field="__del">✕</button></td>
    `;
    if (error) {
      tr.classList.add('row-error');
      tr.querySelector('td.points-cell').innerHTML =
        `<span class="err-msg" title="${escapeAttr(error)}">无效</span>`;
    }
    el.body.appendChild(tr);
  });
}

function escapeAttr(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/* ---------- 统计 ---------- */

function renderStats() {
  const valid = state.courses.filter((c) => {
    try {
      if (c.score === '' || c.score == null) return false;
      pointsFor(c);
      return Number(c.credits) > 0;
    } catch { return false; }
  });

  let result = { gpa: 0, totalCredits: 0, weightedPoints: 0, count: 0 };
  try {
    if (valid.length) result = computeGpa(valid, tables());
  } catch { /* 过滤后不会出现，保险起见吞掉 */ }

  if (state.algo === 'tsinghua5') {
    // 5.0 制参考算法：百分制走「分数/10−5」公式，五级制仍按贸大五级制表
    let credits = 0;
    let pts = 0;
    for (const c of valid) {
      const p = pointsFor(c).points;
      credits += Number(c.credits);
      pts += Number(c.credits) * p;
    }
    result = {
      gpa: credits ? Math.round((pts / credits) * 100) / 100 : 0,
      totalCredits: Math.round(credits * 10) / 10,
      weightedPoints: Math.round(pts * 100) / 100,
      count: valid.length,
    };
  }

  el.gpa.textContent = result.gpa.toFixed(2);
  el.credits.innerHTML = `${result.totalCredits}<small>学分</small>`;
  el.points.textContent = result.weightedPoints.toFixed(1);
  el.count.innerHTML = `${state.courses.length}<small>门</small>`;
  el.gpaLabel.textContent =
    state.algo === 'uibe' ? '平均积点（GPA）' : `平均积点（${REFERENCE_ALGORITHMS[state.algo]?.name || state.algo}）`;
  return result;
}

function renderSimulator(base) {
  const target = Number(el.simTarget.value);
  const extra = Number(el.simExtra.value);
  if (!Number.isFinite(target) || !Number.isFinite(extra) || extra <= 0 || base.totalCredits <= 0) {
    el.simResult.textContent = '—';
    return;
  }
  try {
    const { requiredPoints, reachable } = estimateRequired(base.gpa, base.totalCredits, target, extra);
    el.simResult.innerHTML = reachable
      ? `再修 <b>${extra}</b> 学分需平均积点 <b>${requiredPoints.toFixed(2)}</b> 才能到 ${target.toFixed(2)}`
      : `要达到 ${target.toFixed(2)} 需平均积点 <b class="no">${requiredPoints.toFixed(2)}</b>（超过满分，达不到 😢）`;
  } catch {
    el.simResult.textContent = '—';
  }
}

function render() {
  renderRows();
  const base = renderStats();
  renderSimulator(base);
  renderBands();
  save();
}

/* ---------- 换算标准设置 ---------- */

function renderBands() {
  if (state.algo !== 'uibe') {
    el.bandGrid.innerHTML = '<span class="hint">参考算法使用内置换算，不可编辑。切回「贸大标准 4.0」可修改。</span>';
    return;
  }
  el.bandGrid.innerHTML = state.gradeTable.map((band, i) => `
    <label class="band-item">
      <input type="number" data-band="${i}" data-field="min" value="${band.min}" />–
      <input type="number" data-band="${i}" data-field="max" value="${band.max}" />
      <input type="text" data-band="${i}" data-field="grade" value="${escapeAttr(band.grade)}" style="width:44px" />
      <input type="number" step="0.1" data-band="${i}" data-field="points" value="${band.points}" />
    </label>
  `).join('');
}

/* ---------- 事件 ---------- */

/** 更新某一行的积点单元格与错误高亮（不重建 DOM，避免输入时失焦） */
function updateRowPoints(tr, course) {
  const cell = tr?.querySelector('td.points-cell');
  if (!cell) return;
  if (course.score === '' || course.score == null) {
    cell.textContent = '—';
    tr.classList.remove('row-error');
    return;
  }
  const { points, error } = pointsFor(course);
  if (error) {
    cell.innerHTML = `<span class="err-msg" title="${escapeAttr(error)}">无效</span>`;
    tr.classList.add('row-error');
  } else {
    cell.textContent = points.toFixed(2);
    tr.classList.remove('row-error');
  }
}

el.body.addEventListener('input', (e) => {
  const { i, field } = e.target.dataset;
  if (field == null || i == null) return;
  const idx = Number(i);
  if (field === 'name') state.courses[idx].name = e.target.value;
  if (field === 'credits') state.courses[idx].credits = e.target.value;
  if (field === 'score' && state.courses[idx].type === 'percent') state.courses[idx].score = e.target.value;
  const base = renderStats();
  renderSimulator(base);
  updateRowPoints(e.target.closest('tr'), state.courses[idx]);
  save();
});

el.body.addEventListener('click', (e) => {
  const { i, field } = e.target.dataset;
  if (field === '__del') {
    state.courses.splice(Number(i), 1);
    render();
  }
});

el.body.addEventListener('change', (e) => {
  const { i, field } = e.target.dataset;
  if (field === 'type') {
    state.courses[Number(i)].type = e.target.value;
    state.courses[Number(i)].score = '';
    render();
  }
  if (field === 'score') { // 五级制下拉
    state.courses[Number(i)].score = e.target.value;
    render();
  }
});

$('#btn-add').addEventListener('click', () => {
  addCourse();
  el.body.querySelector('tr:last-child input.name')?.focus();
});

$('#btn-clear').addEventListener('click', () => {
  if (state.courses.length && confirm('确定清空所有课程？')) {
    state.courses = [];
    render();
  }
});

document.getElementById('algo-tabs').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-algo]');
  if (!btn) return;
  state.algo = btn.dataset.algo;
  document.querySelectorAll('#algo-tabs button').forEach((b) =>
    b.classList.toggle('active', b === btn));
  render();
});

/* 批量粘贴 */
const pasteDialog = $('#paste-dialog');
$('#btn-paste').addEventListener('click', () => {
  $('#paste-feedback').textContent = '';
  pasteDialog.showModal();
});
$('#btn-paste-cancel').addEventListener('click', () => pasteDialog.close());
$('#btn-paste-ok').addEventListener('click', () => {
  const { courses, errors } = parseTranscript($('#paste-text').value);
  if (errors.length) {
    $('#paste-feedback').textContent = `${courses.length} 条可导入，${errors.length} 行无法识别（首行：${errors[0].line.slice(0, 24)}…）`;
    return;
  }
  state.courses.push(...courses);
  $('#paste-text').value = '';
  pasteDialog.close();
  render();
  toast(`已导入 ${courses.length} 门课程`);
});

/* JSON 导入导出 */
$('#btn-export').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify({ courses: state.courses }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `uibe-gpa-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
});
$('#btn-import').addEventListener('click', () => $('#file-import').click());
$('#file-import').addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const courses = Array.isArray(data) ? data : data.courses;
    if (!Array.isArray(courses)) throw new Error('格式不对');
    state.courses.push(...courses);
    render();
    toast(`已导入 ${courses.length} 门课程`);
  } catch (err) {
    alert(`导入失败：${err.message}`);
  }
  e.target.value = '';
});

/* 换算标准编辑 */
el.bandGrid.addEventListener('change', (e) => {
  const { band, field } = e.target.dataset;
  if (band == null) return;
  const b = state.gradeTable[Number(band)];
  if (field === 'min' || field === 'max') b[field] = Number(e.target.value);
  if (field === 'grade') b.grade = e.target.value;
  if (field === 'points') b.points = Number(e.target.value);
  render();
});
$('#btn-bands-reset').addEventListener('click', () => {
  state.gradeTable = structuredClone(DEFAULT_GRADE_TABLE);
  render();
  toast('已恢复默认换算标准');
});

/* 模拟器 */
[el.simTarget, el.simExtra].forEach((input) => input.addEventListener('input', render));

/* 深浅色切换：在系统偏好上再翻一档 */
let themeOverride = localStorage.getItem(`${STORAGE_KEY}/theme`) || '';
function applyTheme() {
  const dark = themeOverride ? themeOverride === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
}
$('#btn-theme').addEventListener('click', () => {
  const dark = themeOverride ? themeOverride === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  themeOverride = dark ? 'light' : 'dark';
  localStorage.setItem(`${STORAGE_KEY}/theme`, themeOverride);
  applyTheme();
});

/* ---------- 启动 ---------- */
load();
if (!state.courses.length) {
  // 首次使用放两行示例数据，直接看到效果
  state.courses.push(
    { name: '微观经济学（示例）', credits: 3, type: 'percent', score: 87 },
    { name: '大学英语（示例）', credits: 4, type: 'five', score: '良好' },
  );
}
applyTheme();
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);
render();
