/**
 * window.api 的强类型二次封装。
 * 约定：store 只经 services/ipc 访问 IPC，绝不直接触碰 window.api。
 */
import type {
  AppConfig,
  CountdownGoal,
  CreateTaskInput,
  ExportResult,
  FullData,
  Habit,
  ImportResult,
  MainPanel,
  OverrideAction,
  PomodoroState,
  RepeatOverride,
  Task,
  TaskStatus,
} from '../../../shared/types'

export function loadData(): Promise<FullData> {
  return window.api.loadData()
}

export function createTask(input: CreateTaskInput): Promise<Task> {
  return window.api.createTask(input)
}

export function updateTask(id: string, patch: Partial<Task>): Promise<Task> {
  return window.api.updateTask(id, patch)
}

export function deleteTask(id: string): Promise<void> {
  return window.api.deleteTask(id)
}

export function moveTask(id: string, date: string | null): Promise<Task> {
  return window.api.moveTask(id, date)
}

export function setTaskStatus(id: string, status: TaskStatus): Promise<Task> {
  return window.api.setTaskStatus(id, status)
}

export function reorderInbox(orderedIds: string[]): Promise<void> {
  return window.api.reorderInbox(orderedIds)
}

export function setOverride(
  taskId: string,
  occurrenceDate: string,
  action: OverrideAction,
): Promise<RepeatOverride> {
  return window.api.setOverride(taskId, occurrenceDate, action)
}

export function clearOverride(taskId: string, occurrenceDate: string): Promise<void> {
  return window.api.clearOverride(taskId, occurrenceDate)
}

export function createGoal(input: {
  title: string
  targetDate: string
  category?: string
  color?: string
}): Promise<CountdownGoal> {
  return window.api.createGoal(input)
}

export function deleteGoal(id: string): Promise<void> {
  return window.api.deleteGoal(id)
}

export function createHabit(input: { title: string }): Promise<Habit> {
  return window.api.createHabit(input)
}

export function deleteHabit(id: string): Promise<void> {
  return window.api.deleteHabit(id)
}

export function toggleHabit(id: string, date: string): Promise<Habit> {
  return window.api.toggleHabit(id, date)
}

export function setHabitArchived(id: string, archived: boolean): Promise<Habit> {
  return window.api.setHabitArchived(id, archived)
}

export function onOpenPanel(cb: (panel: MainPanel) => void): () => void {
  return window.api.onOpenPanel(cb)
}

export function onDataChanged(cb: () => void): () => void {
  return window.api.onDataChanged(cb)
}

export function getConfig(): Promise<AppConfig> {
  return window.api.getConfig()
}

export function setConfig(patch: Partial<AppConfig>): Promise<AppConfig> {
  return window.api.setConfig(patch)
}

export function showBubble(text: string): Promise<void> {
  return window.api.showBubble(text)
}

export function setPetVisible(visible: boolean): Promise<void> {
  return window.api.setPetVisible(visible)
}

export function notifyPomodoro(state: PomodoroState): Promise<void> {
  return window.api.notifyPomodoro(state)
}

export function exportData(): Promise<ExportResult> {
  return window.api.exportData()
}

export function importData(): Promise<ImportResult> {
  return window.api.importData()
}

export function minimize(): Promise<void> {
  return window.api.minimize()
}

export function close(): Promise<void> {
  return window.api.close()
}
