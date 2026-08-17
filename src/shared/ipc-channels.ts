/**
 * IPC channel 常量 —— 全工程唯一来源。
 * preload 与 main 引用同一常量，禁止在业务代码中散落 channel 字符串字面量。
 * 命名规范：领域:动作（小写 kebab-case）。
 */

/** 渲染进程 → 主进程（invoke / handle） */
export const IPC = {
  // 数据
  dataLoad: 'data:load',
  taskCreate: 'task:create',
  taskUpdate: 'task:update',
  taskDelete: 'task:delete',
  taskMove: 'task:move',
  taskSetStatus: 'task:setStatus',
  taskReorderInbox: 'task:reorderInbox',
  overrideSet: 'override:set',
  overrideClear: 'override:clear',
  goalCreate: 'goal:create',
  goalDelete: 'goal:delete',
  /** v3 待办集 CRUD */
  collectionCreate: 'collection:create',
  collectionRename: 'collection:rename',
  collectionDelete: 'collection:delete',
  collectionReorder: 'collection:reorder',
  /** v3 任务批量操作 */
  taskBatchMove: 'task:batch-move',
  taskBatchStatus: 'task:batch-status',
  taskBatchDelete: 'task:batch-delete',
  /** 原子提交一次专注会话（session 追加 + 任务 durationSec 累加，单次落盘） */
  focusCommit: 'focus:commit',
  /** 删除单条专注会话（连带扣减绑定任务 durationSec） */
  statsDeleteSession: 'stats:delete-session',
  /** 清空指定日期区间（闭区间，本地日期口径）内全部专注会话 */
  statsClearRange: 'stats:clear-range',
  /** 重置全部专注统计（清空会话，任务 durationSec 归零） */
  statsResetAll: 'stats:reset-all',
  configGet: 'config:get',
  configSet: 'config:set',
  dataExport: 'data:export',
  dataImport: 'data:import',
  /** v3 主题背景图（选择落盘 / 清除） */
  uiPickBgImage: 'ui:pick-bg-image',
  uiClearBgImage: 'ui:clear-bg-image',
  // 桌宠 / 窗口
  petShowBubble: 'pet:show-bubble',
  petSetVisible: 'pet:set-visible',
  petBeginDrag: 'pet:begin-drag',
  petEndDrag: 'pet:end-drag',
  petSetIgnoreMouse: 'pet:set-ignore-mouse',
  petCompleteTask: 'pet:complete-task',
  petSetSize: 'pet:set-size',
  petGetWorkArea: 'pet:get-work-area',
  /** 主窗口 → 桌宠：联动动画通知（timing / finishing / jumping） */
  petNotifyAnim: 'pet:notify-anim',
  // 自定义宠物包管理（保存 / 列表 / 删除 / 导出导入 .petpack）
  petPackList: 'pet:pack:list',
  petPackSave: 'pet:pack:save',
  petPackDelete: 'pet:pack:delete',
  petPackExport: 'pet:pack:export',
  petPackImport: 'pet:pack:import',
  // 计时器资产（背景图 / BGM）——随独立计时页下线，v3 移除
  windowFocusMain: 'window:focus-main',
  windowOpenPanel: 'window:open-panel',
  /** 桌宠菜单「退出应用」（非窗口控件，程序级退出） */
  appQuit: 'app:quit',
} as const

/** 主进程 → 渲染进程（webContents.send） */
export const IPC_MAIN = {
  petBubble: 'pet:bubble',
  petVisibility: 'pet:visibility',
  petAnim: 'pet:anim',
  petTodayTodos: 'pet:today-todos',
  petGoals: 'pet:goals',
  openPanel: 'window:open-panel-request',
  /** 数据已变更（主窗口订阅后重载 task/habit/goal store） */
  dataChanged: 'data:changed',
  /** 配置已变更（主窗口订阅后同步 configStore，保证桌宠开关等跨入口状态同源） */
  configChanged: 'config:changed',
  /** 全局快捷键动作（主窗口订阅后分发到 newTask / openTimer / openSearch） */
  shortcut: 'app:shortcut',
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]
