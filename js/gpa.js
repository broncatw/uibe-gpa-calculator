/**
 * 贸大绩点计算核心逻辑（与页面无关，可独立用于 Node 脚本）
 *
 * 换算标准来源：《对外经济贸易大学本科生学分制管理办法》
 *   百分制/十段制/五级制 → 积点系数，学分积点 = 学分数 × 积点系数，
 *   平均积点（GPA）= 学分总积点 ÷ 总学分数。
 * 如学校规定更新，请在"设置"中修改换算表，或提交 issue。
 */

export const DEFAULT_GRADE_TABLE = [
  { min: 90, max: 100, grade: 'A',  points: 4.0 },
  { min: 85, max: 89,  grade: 'A-', points: 3.7 },
  { min: 82, max: 84,  grade: 'B+', points: 3.3 },
  { min: 78, max: 81,  grade: 'B',  points: 3.0 },
  { min: 75, max: 77,  grade: 'B-', points: 2.7 },
  { min: 72, max: 74,  grade: 'C+', points: 2.3 },
  { min: 68, max: 71,  grade: 'C',  points: 2.0 },
  { min: 64, max: 67,  grade: 'C-', points: 1.5 },
  { min: 60, max: 63,  grade: 'D',  points: 1.0 },
  { min: 0,  max: 59,  grade: 'F',  points: 0.0 },
];

export const DEFAULT_FIVE_LEVEL_TABLE = [
  { grade: '优秀',   points: 4.0 },
  { grade: '良好',   points: 3.3 },
  { grade: '中',     points: 2.3 },
  { grade: '合格',   points: 1.0 },
  { grade: '不合格', points: 0.0 },
];

/**
 * 参考算法（仅供留学申请/横向对比，非贸大官方口径）。
 * WES 常见粗略换算；清华式为「绩点 = 分数/10 - 5」的 5.0 制。
 */
export const REFERENCE_ALGORITHMS = {
  wes: {
    name: 'WES 参考',
    bands: [
      { min: 85, max: 100, grade: 'A',  points: 4.0 },
      { min: 75, max: 84,  grade: 'B',  points: 3.0 },
      { min: 60, max: 74,  grade: 'C',  points: 2.0 },
      { min: 0,  max: 59,  grade: 'F',  points: 0.0 },
    ],
  },
  tsinghua5: {
    name: '5.0 制参考（绩点=分数/10−5）',
    formula(score) {
      if (score >= 60) return Math.round((score / 10 - 5) * 10) / 10;
      return 0;
    },
  },
};

export function percentToPoints(score, table = DEFAULT_GRADE_TABLE) {
  if (typeof score !== 'number' || !Number.isFinite(score)) {
    throw new Error(`成绩不是有效数字: ${score}`);
  }
  if (score < 0 || score > 100) {
    throw new Error(`成绩超出 0-100 范围: ${score}`);
  }
  // 区间按 [min, max] 闭区间匹配
  const hit = table.find((band) => score >= band.min && score <= band.max);
  if (!hit) throw new Error(`换算表中无匹配区间: ${score}`);
  return hit.points;
}

export function fiveLevelToPoints(level, table = DEFAULT_FIVE_LEVEL_TABLE) {
  const hit = table.find((row) => row.grade === level);
  if (!hit) throw new Error(`未知五级制等级: ${level}`);
  return hit.points;
}

/**
 * 计算一门课的积点系数。
 * @param {{type: 'percent'|'five', score: number|string}} course
 */
export function coursePoints(course, tables = {}) {
  const gradeTable = tables.gradeTable || DEFAULT_GRADE_TABLE;
  const fiveTable = tables.fiveLevelTable || DEFAULT_FIVE_LEVEL_TABLE;
  if (course.type === 'five') return fiveLevelToPoints(course.score, fiveTable);
  return percentToPoints(Number(course.score), gradeTable);
}

/**
 * 加权平均积点。
 * @param {Array<{name?:string, credits:number, type:'percent'|'five', score:number|string}>} courses
 * @returns {{gpa:number, totalCredits:number, weightedPoints:number, count:number}}
 */
export function computeGpa(courses, tables = {}) {
  let totalCredits = 0;
  let weightedPoints = 0;
  let count = 0;
  for (const course of courses) {
    const credits = Number(course.credits);
    if (!Number.isFinite(credits) || credits <= 0) {
      throw new Error(`学分无效: ${course.name || '(未命名课程)'} → ${course.credits}`);
    }
    const points = coursePoints(course, tables);
    totalCredits += credits;
    weightedPoints += credits * points;
    count += 1;
  }
  const gpa = totalCredits > 0 ? weightedPoints / totalCredits : 0;
  return {
    gpa: Math.round(gpa * 100) / 100,
    totalCredits: Math.round(totalCredits * 10) / 10,
    weightedPoints: Math.round(weightedPoints * 100) / 100,
    count,
  };
}

/**
 * 成绩模拟：在已有学分积点基础上，再修 extraCredits 学分、平均积点达到
 * requiredPoints 时，总 GPA 恰好为 targetGpa。
 * @returns {{requiredPoints:number, reachable:boolean}}
 */
export function estimateRequired(currentGpa, currentCredits, targetGpa, extraCredits) {
  if (extraCredits <= 0) throw new Error('新增学分必须大于 0');
  const requiredPoints =
    (targetGpa * (currentCredits + extraCredits) - currentGpa * currentCredits) / extraCredits;
  return {
    requiredPoints: Math.round(requiredPoints * 100) / 100,
    reachable: requiredPoints <= 4.0 + 1e-9,
  };
}

/**
 * 解析批量粘贴的成绩文本。每行一条，支持空格/Tab/逗号分隔：
 *   高级会计  3  92
 *   大学英语  4  良好
 * 典型表头行（同时含"课程""学分"且无数字）自动跳过。
 * @returns {{courses: Array, errors: Array<{line:string, reason:string}>}}
 */
export function parseTranscript(text) {
  const courses = [];
  const errors = [];
  for (const rawLine of String(text).split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (/课程/.test(line) && /学分/.test(line) && !/\d/.test(line) && !/优秀|良好|合格|不合格/.test(line)) {
      continue;
    }
    const parts = line.split(/[\t,，]+|\s{1,}/).filter(Boolean);
    if (parts.length < 3) {
      errors.push({ line, reason: '字段不足（需要：课程名 学分 成绩）' });
      continue;
    }
    const score = parts[parts.length - 1];
    const credits = Number(parts[parts.length - 2]);
    const name = parts.slice(0, parts.length - 2).join(' ');
    const isFive = DEFAULT_FIVE_LEVEL_TABLE.some((row) => row.grade === score);
    if (Number.isNaN(credits) || credits <= 0) {
      errors.push({ line, reason: `学分无法识别: ${parts[parts.length - 2]}` });
      continue;
    }
    if (!isFive && Number.isNaN(Number(score))) {
      errors.push({ line, reason: `成绩无法识别: ${score}` });
      continue;
    }
    courses.push({
      name: name || '未命名课程',
      credits,
      type: isFive ? 'five' : 'percent',
      score: isFive ? score : Number(score),
    });
  }
  return { courses, errors };
}
