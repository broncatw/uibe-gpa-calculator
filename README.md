# 贸大绩点计算器 · UIBE GPA Calculator

[![tests](https://github.com/broncatw/uibe-gpa-calculator/actions/workflows/test.yml/badge.svg)](./../../actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./../../pulls)

**在线使用：[broncatw.github.io/uibe-gpa-calculator](https://broncatw.github.io/uibe-gpa-calculator/)**

一个专为对外经济贸易大学（UIBE）同学做的绩点计算器。没有后端、没有登录、没有广告——打开网页就能用，成绩数据只存在你自己的浏览器里。

> 姊妹项目：[uibe-booker](https://github.com/broncatw/uibe-booker)（图书馆座位/研讨间预约 + 定时抢座 + 捡漏监控） · [uibe-course-planner](https://github.com/broncatw/uibe-course-planner)（选课助手）

## 功能

- **按贸大官方标准换算**：内置《对外经济贸易大学本科生学分制管理办法》的十段制/五级制积点系数，自动把百分制成绩落段
- **支持五级制课程**：优秀 / 良好 / 中 / 合格 / 不合格，和百分制课程混在一起加权
- **成绩模拟器**：想知道「再修 30 学分把 GPA 拉到 3.7 需要平均多少分」？输入目标即可，达不到会直接告诉你
- **多算法对比**：除贸大标准外，附带 WES 参考、5.0 制参考换算，方便出国申请时横向比较
- **批量导入**：从教务系统复制成绩单直接粘贴，自动识别 `课程名 学分 成绩`，支持百分制与五级制混排
- **数据自持**：自动保存在浏览器 localStorage，可导出/导入 JSON；全程不上传任何数据
- **换算表可编辑**：学校若调整标准，在设置里改一下就能继续用

## 贸大绩点换算标准

依据《对外经济贸易大学本科生学分制管理办法》：**学分积点 = 学分数 × 积点系数**，**平均积点（GPA）= 学分总积点 ÷ 总学分数**。

| 百分制 | 等级 | 积点系数 | 五级制 | 积点系数 |
|---|---|---|---|---|
| 90–100 | A  | 4.0 | 优秀 | 4.0 |
| 85–89  | A- | 3.7 | | |
| 82–84  | B+ | 3.3 | 良好 | 3.3 |
| 78–81  | B  | 3.0 | | |
| 75–77  | B- | 2.7 | | |
| 72–74  | C+ | 2.3 | 中 | 2.3 |
| 68–71  | C  | 2.0 | | |
| 64–67  | C- | 1.5 | | |
| 60–63  | D  | 1.0 | 合格 | 1.0 |
| 60 以下 | F  | 0   | 不合格 | 0 |

> ⚠️ 免责声明：本工具仅供参考。成绩认定、保研排名、出国换算请以学校官方成绩单和教务处最新规定为准。若发现标准有出入，欢迎 [提 issue](https://github.com/broncatw/uibe-gpa-calculator/issues) 或在设置面板中自行修改换算表。

## 本地开发

纯静态页面，无需构建：

```bash
# 直接用浏览器打开 index.html，或起个静态服务
python -m http.server 8000
# 访问 http://localhost:8000
```

运行测试（Node ≥ 18，零依赖）：

```bash
npm test        # 即 node --test
```

测试覆盖：十段制各段边界、五级制换算、加权平均手算对照、成绩模拟可达性、批量粘贴解析（含表头/脏行容错）、自定义换算表。

## 项目结构

```
├── index.html          # 单页应用入口（GitHub Pages 直接托管）
├── style.css
├── js/
│   ├── gpa.js          # 核心计算逻辑（纯 ESM，浏览器/Node 通用）
│   └── app.js          # 页面交互
└── tests/
    └── gpa.test.mjs    # node:test 单元测试
```

## License

[MIT](./LICENSE)
