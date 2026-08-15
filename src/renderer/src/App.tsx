/**
 * 主窗口顶层布局：TopBar + (Sidebar + 主视图) + 各类弹层。
 */
import { useEffect } from 'react'
import { useConfigStore } from './stores/configStore'
import { useTaskStore } from './stores/taskStore'
import { useHabitStore } from './stores/habitStore'
import { useGoalStore } from './stores/goalStore'
import { useUiStore } from './stores/uiStore'
import { TopBar } from './components/layout/TopBar'
import { Sidebar } from './components/layout/Sidebar'
import { SettingsPanel } from './components/layout/SettingsPanel'
import { MonthCalendar } from './components/calendar/MonthCalendar'
import { WeekView } from './components/calendar/WeekView'
import { DayView } from './components/calendar/DayView'
import { InboxList } from './components/inbox/InboxList'
import { TaskEditorModal } from './components/task/TaskEditorModal'
import { TaskContextMenu } from './components/task/TaskContextMenu'
import { PomodoroTimer } from './components/pomodoro/PomodoroTimer'
import { StatsPanel } from './components/stats/StatsPanel'
import { HabitPanel } from './components/habit/HabitPanel'
import { CountdownPanel } from './components/goals/CountdownPanel'
import * as ipc from './services/ipc'

export default function App(): JSX.Element {
  const loadTasks = useTaskStore((s) => s.load)
  const loadConfig = useConfigStore((s) => s.load)
  const loadHabits = useHabitStore((s) => s.load)
  const loadGoals = useGoalStore((s) => s.load)
  const showInbox = useUiStore((s) => s.showInbox)
  const showStats = useUiStore((s) => s.showStats)
  const showHabits = useUiStore((s) => s.showHabits)
  const showGoals = useUiStore((s) => s.showGoals)
  const view = useUiStore((s) => s.view)

  useEffect(() => {
    void loadTasks()
    void loadConfig()
    void loadHabits()
    void loadGoals()
  }, [loadTasks, loadConfig, loadHabits, loadGoals])

  // 订阅主进程「数据已变更」推送（桌宠端完成/跳过任务等跨窗口写操作），
  // 触发各 store 重载，保证主窗口勾选状态即时同步。
  useEffect(() => {
    return ipc.onDataChanged(() => {
      void loadTasks()
      void loadHabits()
      void loadGoals()
    })
  }, [loadTasks, loadHabits, loadGoals])

  // 订阅主进程推送的「打开面板」请求（桌宠右键快捷入口）
  useEffect(() => {
    return ipc.onOpenPanel((panel) => {
      const ui = useUiStore.getState()
      ui.setShowInbox(false)
      ui.setShowStats(false)
      ui.setShowHabits(false)
      ui.setShowGoals(false)
      ui.setShowSettings(false)
      ui.setShowPomodoro(false)
      switch (panel) {
        case 'today':
          ui.goToday()
          ui.setView('day')
          break
        case 'stats':
          ui.setShowStats(true)
          break
        case 'habits':
          ui.setShowHabits(true)
          break
        case 'goals':
          ui.setShowGoals(true)
          break
        case 'pomodoro':
          ui.setShowPomodoro(true)
          break
        case 'settings':
          ui.setShowSettings(true)
          break
      }
    })
  }, [])

  const mainView = showInbox ? (
    <InboxList />
  ) : showStats ? (
    <StatsPanel />
  ) : showHabits ? (
    <HabitPanel />
  ) : showGoals ? (
    <CountdownPanel />
  ) : view === 'week' ? (
    <WeekView />
  ) : view === 'day' ? (
    <DayView />
  ) : (
    <MonthCalendar />
  )

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="min-w-0 flex-1 overflow-hidden">{mainView}</main>
      </div>
      <SettingsPanel />
      <TaskEditorModal />
      <TaskContextMenu />
      <PomodoroTimer />
    </div>
  )
}
