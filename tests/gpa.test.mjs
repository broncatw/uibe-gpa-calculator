import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_GRADE_TABLE,
  DEFAULT_FIVE_LEVEL_TABLE,
  percentToPoints,
  fiveLevelToPoints,
  coursePoints,
  computeGpa,
  estimateRequired,
  parseTranscript,
} from '../js/gpa.js';

test('百分制 → 积点：各段边界', () => {
  assert.equal(percentToPoints(100), 4.0);
  assert.equal(percentToPoints(90), 4.0);
  assert.equal(percentToPoints(89), 3.7);
  assert.equal(percentToPoints(85), 3.7);
  assert.equal(percentToPoints(84), 3.3);
  assert.equal(percentToPoints(82), 3.3);
  assert.equal(percentToPoints(81), 3.0);
  assert.equal(percentToPoints(78), 3.0);
  assert.equal(percentToPoints(77), 2.7);
  assert.equal(percentToPoints(75), 2.7);
  assert.equal(percentToPoints(74), 2.3);
  assert.equal(percentToPoints(72), 2.3);
  assert.equal(percentToPoints(71), 2.0);
  assert.equal(percentToPoints(68), 2.0);
  assert.equal(percentToPoints(67), 1.5);
  assert.equal(percentToPoints(64), 1.5);
  assert.equal(percentToPoints(63), 1.0);
  assert.equal(percentToPoints(60), 1.0);
  assert.equal(percentToPoints(59), 0);
  assert.equal(percentToPoints(0), 0);
});

test('百分制非法输入抛错', () => {
  assert.throws(() => percentToPoints(-1));
  assert.throws(() => percentToPoints(101));
  assert.throws(() => percentToPoints('abc'));
  assert.throws(() => percentToPoints(NaN));
});

test('五级制 → 积点', () => {
  assert.equal(fiveLevelToPoints('优秀'), 4.0);
  assert.equal(fiveLevelToPoints('良好'), 3.3);
  assert.equal(fiveLevelToPoints('中'), 2.3);
  assert.equal(fiveLevelToPoints('合格'), 1.0);
  assert.equal(fiveLevelToPoints('不合格'), 0);
  assert.throws(() => fiveLevelToPoints('极好'));
});

test('coursePoints 按类型分发', () => {
  assert.equal(coursePoints({ type: 'percent', score: 92 }), 4.0);
  assert.equal(coursePoints({ type: 'five', score: '良好' }), 3.3);
});

test('加权平均积点：手算对照', () => {
  // 微积分 4 学分 92(A=4.0)，大学英语 2 学分 84(B+=3.3)
  // GPA = (4*4 + 2*3.3) / 6 = 22.6 / 6 = 3.766…→ 3.77
  const result = computeGpa([
    { name: '微积分', credits: 4, type: 'percent', score: 92 },
    { name: '大学英语', credits: 2, type: 'percent', score: 84 },
  ]);
  assert.equal(result.gpa, 3.77);
  assert.equal(result.totalCredits, 6);
  assert.equal(result.weightedPoints, 22.6);
  assert.equal(result.count, 2);
});

test('加权平均积点：混入五级制课程', () => {
  const result = computeGpa([
    { name: '体育', credits: 1, type: 'five', score: '优秀' },
    { name: '高数', credits: 3, type: 'percent', score: 60 },
  ]);
  // (1*4.0 + 3*1.0) / 4 = 1.75
  assert.equal(result.gpa, 1.75);
});

test('学分无效时抛错', () => {
  assert.throws(() =>
    computeGpa([{ name: '坏数据', credits: 0, type: 'percent', score: 90 }])
  );
  assert.throws(() =>
    computeGpa([{ name: '坏数据', credits: -2, type: 'percent', score: 90 }])
  );
});

test('空课程列表 GPA 为 0', () => {
  const result = computeGpa([]);
  assert.equal(result.gpa, 0);
  assert.equal(result.totalCredits, 0);
});

test('成绩模拟：达到目标 GPA 所需平均积点', () => {
  // 已修 3.5 GPA / 100 学分，再修 20 学分想拉到 3.7：
  // required = (3.7*120 - 3.5*100)/20 = (444-350)/20 = 4.7 → 不可达
  const hard = estimateRequired(3.5, 100, 3.7, 20);
  assert.equal(hard.requiredPoints, 4.7);
  assert.equal(hard.reachable, false);
  // 已修 3.5/100，再修 50 学分拉到 3.6：required = (3.6*150-350)/50 = 3.8 → 可达
  const ok = estimateRequired(3.5, 100, 3.6, 50);
  assert.equal(ok.requiredPoints, 3.8);
  assert.equal(ok.reachable, true);
});

test('批量粘贴解析：百分制 + 五级制 + 表头 + 脏行', () => {
  const text = [
    '课程名称 学分 成绩',
    '高级会计 3 92',
    '大学英语,4,良好',
    '体育　　1　　优秀',
    '只有两个字段',
    '坏学分课 abc 90',
    '',
  ].join('\n');
  const { courses, errors } = parseTranscript(text);
  assert.equal(courses.length, 3);
  assert.deepEqual(courses[0], { name: '高级会计', credits: 3, type: 'percent', score: 92 });
  assert.deepEqual(courses[1], { name: '大学英语', credits: 4, type: 'five', score: '良好' });
  assert.equal(courses[2].name, '体育');
  assert.equal(errors.length, 2);
});

test('换算表可自定义（设置面板场景）', () => {
  const custom = [
    { min: 95, max: 100, grade: 'A+', points: 4.3 },
    { min: 0, max: 94, grade: 'A', points: 4.0 },
  ];
  assert.equal(percentToPoints(96, custom), 4.3);
  assert.equal(percentToPoints(70, custom), 4.0);
});

test('默认换算表为十段且覆盖 0-100 无缝隙', () => {
  assert.equal(DEFAULT_GRADE_TABLE.length, 10);
  const sorted = [...DEFAULT_GRADE_TABLE].sort((a, b) => a.min - b.min);
  let expected = 0;
  for (const band of sorted) {
    assert.equal(band.min, expected, `区间无缝，期望起点 ${expected}`);
    expected = band.max + 1;
  }
  assert.equal(expected, 101);
});

test('五级制默认表五档齐全', () => {
  assert.deepEqual(
    DEFAULT_FIVE_LEVEL_TABLE.map((r) => r.grade),
    ['优秀', '良好', '中', '合格', '不合格']
  );
});
