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
  habitCreate: 'habit:create',
  habitDelete: 'habit:delete',
  habitToggle: 'habit:toggle',
  habitSetArchived: 'habit:setArchived',
  configGet: 'config:get',
  configSet: 'config:set',
  dataExport: 'data:export',
  dataImport: 'data:import',
  // 桌宠 / 窗口
  petShowBubble: 'pet:show-bubble',
  petSetVisible: 'pet:set-visible',
  petMoveWindow: 'pet:move-window',
  petSetIgnoreMouse: 'pet:set-ignore-mouse',
  petNotifyPomodoro: 'pet:notify-pomodoro',
  petCompleteTask: 'pet:complete-task',
  windowFocusMain: 'window:focus-main',
  windowOpenPanel: 'window:open-panel',
  windowMinimize: 'window:minimize',
  windowClose: 'window:close',
} as const

/** 主进程 → 渲染进程（webContents.send） */
export const IPC_MAIN = {
  petBubble: 'pet:bubble',
  petVisibility: 'pet:visibility',
  petPomodoro: 'pet:pomodoro',
  petTodayTodos: 'pet:today-todos',
  petGoals: 'pet:goals',
  openPanel: 'window:open-panel-request',
  /** 数据已变更（主窗口订阅后重载 task/habit/goal store） */
  dataChanged: 'data:changed',
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]
