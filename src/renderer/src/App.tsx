/**
 * 主窗口顶层布局：TopBar + (Sidebar + 主视图) + 各类弹层。
 */
import { useCallback, useEffect } from 'react'
import { todayStr } from '../../shared/date'
import { useConfigStore } from './stores/configStore'
import { useTaskStore } from './stores/taskStore'
import { useHabitStore } from './stores/habitStore'
import { useGoalStore } from './stores/goalStore'
import { useUiStore } from './stores/uiStore'
import { TopBar } from './components/layout/TopBar'
import { Sidebar } from './components/layout/Sidebar'
import { SettingsPanel } from './components/layout/SettingsPanel'
import { PetMakerPanel } from './components/petmaker/PetMakerPanel'
import { TodoPanel } from './components/todo/TodoPanel'
import { TimelinePanel } from './components/timeline/TimelinePanel'
import { InboxList } from './components/inbox/InboxList'
import { TaskEditorModal } from './components/task/TaskEditorModal'
import { TaskContextMenu } from './components/task/TaskContextMenu'
import { StatsPanel } from './components/stats/StatsPanel'
import { HabitPanel } from './components/habit/HabitPanel'
import { CountdownPanel } from './components/goals/CountdownPanel'
import { TimerPanel } from './components/timer/TimerPanel'
import { GlobalSearch } from './components/search/GlobalSearch'
import { HelpPanel } from './components/help/HelpPanel'
import * as ipc from './services/ipc'

export default function App(): JSX.Element {
  const loadConfig = useConfigStore((s) => s.load)
  const page = useUiStore((s) => s.page)
  const showPetMaker = useUiStore((s) => s.showPetMaker)

  // 一次 loadData 往返后由三个 store 分发共用，替代原先三路各自 loadData（QA O3）
  const refreshData = useCallback(async (): Promise<void> => {
    const data = await ipc.loadData()
    useTaskStore.getState().applyData(data)
    useHabitStore.getState().applyData(data)
    useGoalStore.getState().applyData(data)
  }, [])

  useEffect(() => {
    void refreshData()
    void loadConfig()
  }, [refreshData, loadConfig])

  // 订阅主进程「数据已变更」推送（桌宠端完成/跳过任务等跨窗口写操作），
  // 触发各 store 重载，保证主窗口勾选状态即时同步。
  useEffect(() => {
    return ipc.onDataChanged(() => {
      void refreshData()
    })
  }, [refreshData])

  // 订阅主进程推送的「打开面板」请求（桌宠右键快捷入口 / 任务提醒点击）
  useEffect(() => {
    return ipc.onOpenPanel((panel) => {
      const ui = useUiStore.getState()
      ui.setShowSettings(false)
      switch (panel) {
        case 'today':
          // 今日待办 → 待办首页（默认首页，聚焦未来任务规划）
          ui.goToday()
          ui.setPage('todo')
          break
        case 'stats':
          ui.setPage('stats')
          break
        case 'habits':
          ui.setPage('habits')
          break
        case 'goals':
          ui.setPage('goals')
          break
        case 'pomodoro':
          ui.openTimerPanel('pomodoro')
          break
        case 'settings':
          ui.setShowSettings(true)
          break
        case 'timer':
          ui.setPage('timer')
          break
      }
    })
  }, [])

  // 订阅主进程推送的全局快捷键动作（T05）
  useEffect(() => {
    return ipc.onShortcut((action) => {
      const ui = useUiStore.getState()
      if (action === 'newTask') ui.openCreate(todayStr())
      else if (action === 'openTimer') ui.openTimerPanel('stopwatch')
      else if (action === 'openSearch') ui.setShowSearch(true)
    })
  }, [])

  const mainView =
    page === 'inbox' ? (
      <InboxList />
    ) : page === 'timeline' ? (
      <TimelinePanel />
    ) : page === 'stats' ? (
      <StatsPanel />
    ) : page === 'habits' ? (
      <HabitPanel />
    ) : page === 'goals' ? (
      <CountdownPanel />
    ) : page === 'timer' ? (
      <TimerPanel />
    ) : (
      <TodoPanel />
    )

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="min-w-0 flex-1 overflow-hidden">{mainView}</main>
      </div>
      <SettingsPanel />
      {showPetMaker && <PetMakerPanel />}
      <TaskEditorModal />
      <TaskContextMenu />
      <GlobalSearch />
      <HelpPanel />
    </div>
  )
}
