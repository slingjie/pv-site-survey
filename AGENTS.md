# Repository Guidelines

本文件为本仓库贡献者与智能代理提供统一协作规范，请保持更新。

## 项目结构与模块组织

- 前端源代码位于根目录：`App.tsx`、`index.tsx`、`types.ts`。
- 业务组件：
  - `components/views/`：页面级组件（`HomePage.tsx`、`NewProjectPage.tsx`、`ReportEditor.tsx`）。
  - `components/editor/`：踏勘编辑模块（厂区概况、屋顶、电气设施、资料清单等）。
  - `components/common/`：通用表单组件、弹窗、Toast 等。
- 配置与数据：
  - `services/formConfigs.ts`：表单字段与枚举配置（唯一真源）。
  - `services/mockData.ts`：示例数据与初始化逻辑。

## 构建、测试与本地开发

- 安装依赖：`npm install`
- 启动开发服务器：`npm run dev`（默认 `http://localhost:5173`）
- 生产构建：`npm run build`
- 预览构建产物：`npm run preview`

当前仓库未配置自动化测试命令，如需添加请保持脚本命名简洁（例如：`npm test`、`npm run lint`）。

## 代码风格与命名约定

- 使用 TypeScript + React 函数组件，避免使用 `any`。
- 组件文件名采用大驼峰：`ReportEditor.tsx`，普通工具模块用小驼峰：`formConfigs.ts`。
- 使用 2 空格缩进或保持现有缩进风格一致。
- UI 类名沿用 Tailwind 风格原子类（如 `bg-gray-50`, `rounded-full`），勿混入内联样式。
- 所有新增中文文案与注释须使用简体中文，保持术语统一。

## 测试与验证建议

- 修改核心流程（如 `ReportEditor`、`mockData`、`formConfigs`）后，应手动在浏览器中验证：
  - 新建项目、编辑各模块、生成报告、打印/导出流程能正常完成。
- 如引入测试框架（推荐 Jest + React Testing Library），测试文件命名建议为：`*.test.ts(x)` 并与被测文件同目录。

## 提交与合并请求规范

- 提交信息建议遵循简洁动词开头风格，例如：
  - `feat: add roof satellite map editor`
  - `fix: preserve report data when switching tabs`
  - `chore: update README and metadata`
- 在提交或发起 PR 前请：
  - 确保项目能成功构建并通过基础手动验证。
  - 在描述中简要说明改动目的、主要影响范围，如涉及 UI 变更可附截图。

