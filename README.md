# Fantacy Todo List

一款简洁高效的 Windows 桌面**日历待办清单**应用，内置 **Live2D 桌宠陪伴**。所有数据保存在本地电脑，无需注册账号、无云端同步、无广告、无遥测。

## ✨ 核心功能

### 日历待办
- **月历视图**：无限滚动翻月，今日任务一目了然
- **优先级**：高 / 中 / 低三档，颜色区分（红 / 琥珀 / 灰）
- **重复任务**：每天 / 每周 / 每月 / 每年 / 自定义间隔（每隔 N 天），支持结束日期与次数
- **单日独立操作**：重复任务的某一天可单独完成或单独跳过，不影响其他日期
- **拖拽改期**：把任务拖到其他日期快速调整安排
- **完成动画**：勾选完成触发撒花效果（可在设置中关闭）
- **放弃状态**：可标记放弃，保留记录但不占注意力

### 收集箱
- 未确定日期的任务先放进收集箱
- 收集箱内支持拖拽排序
- 想清楚后可随时安排到日历的具体日期

### Live2D 桌宠
- 常驻桌面的小桌宠（默认「Haru 春」），陪伴完成待办
- 点击随机触发可爱反应动作
- 支持拖拽摆放位置、滚轮调整大小、右键菜单隐藏、托盘唤回

### 数据安全
- 任务数据以 JSON 完整保存在本地：`%APPDATA%\fantacy-todo-list-react\fantacy-todo-list\`
- 不联网、不上传、无遥测
- **卸载应用不会删除数据**（数据与安装目录隔离）

## 🆕 增强功能（P1）

- **桌宠气泡提醒**：桌宠窗口弹出气泡提示「今日待办」，点击气泡唤回主窗口
- **番茄专注计时**：内置番茄钟（默认 25 分钟专注 + 5 分钟休息，时长可调），专注时桌宠显示陪伴徽标
- **周视图**：顶部栏「月 / 周」一键切换，周视图按 7 天分列展示
- **数据备份 / 导入导出**：一键导出完整数据（任务 + 配置）到指定路径，导入时校验后恢复

## 🛠 技术栈

Electron · React 18 · Vite · TypeScript · Tailwind CSS · Zustand · @dnd-kit · canvas-confetti · date-fns · PIXI.js v6 · pixi-live2d-display

## 🚀 快速开始

> 环境要求：Node.js ≥ 18（推荐 20+）

```bash
# 1. 安装依赖（已配置国内镜像加速）
npm install

# 2. 开发模式运行（启动日历主窗口 + Live2D 桌宠窗口）
npm run dev
```

## 📦 打包安装包

```bash
# 生成 Windows NSIS 安装包（输出到 dist/ 目录）
npm run build:win
```

安装包为 `dist/Fantacy Todo List Setup *.exe`，双击安装即可。卸载时应用数据保留在 `%APPDATA%` 中。

## 🧪 测试与检查

```bash
npm run typecheck   # TypeScript 类型检查（node + web）
npm test            # 运行单元测试（repeatEngine 重复引擎等）
npm run build       # 构建三端产物（main / preload / renderer）
```

## 📂 项目结构

```
fantacy-todo-list/
├── electron.vite.config.ts    # electron-vite 三端构建配置
├── electron-builder.yml       # 打包配置（nsis）
├── resources/                 # 应用图标
├── src/
│   ├── shared/                # 跨进程共享类型 + IPC 常量 + 默认值
│   ├── main/                  # Electron 主进程（窗口/托盘/数据存储/IPC）
│   ├── preload/               # 预加载脚本（contextBridge 白名单）
│   ├── renderer/              # 主窗口（日历待办 UI）
│   └── pet/                   # 桌宠窗口（Live2D 渲染 + 交互）
│       └── public/live2d/     # Haru 模型 + Cubism Core（本地打包，离线）
└── docs/                      # 需求与设计文档
```

## ⚖️ 开源许可与第三方声明

- **源代码**：以 [MIT 许可](./LICENSE) 发布。
- **Live2D 资源**：桌宠使用的 Live2D 官方示例模型「Haru（春）」及 Cubism Core 为 © Live2D Inc. 专有资源，**不适用 MIT 许可**，详见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

## 📝 设计文档

- 需求文档：[docs/01-PRD.md](./docs/01-PRD.md)
- 架构设计：[docs/02-Architecture.md](./docs/02-Architecture.md)
- P1 增量设计：[docs/03-增量设计-P1.md](./docs/03-增量设计-P1.md)
