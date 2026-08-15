/**
 * 主窗口顶层布局：TopBar + (Sidebar + 月历主体) + 各类弹层。
 */
import { useEffect } from 'react'
import { useConfigStore } from './stores/configStore'
import { useTaskStore } from './stores/taskStore'
import { useUiStore } from './stores/uiStore'
import { TopBar } from './components/layout/TopBar'
import { Sidebar } from './components/layout/Sidebar'
import { SettingsPanel } from './components/layout/SettingsPanel'
import { MonthCalendar } from './components/calendar/MonthCalendar'
import { WeekView } from './components/calendar/WeekView'
import { InboxList } from './components/inbox/InboxList'
import { TaskEditorModal } from './components/task/TaskEditorModal'
import { TaskContextMenu } from './components/task/TaskContextMenu'
import { PomodoroTimer } from './components/pomodoro/PomodoroTimer'

export default function App(): JSX.Element {
  const loadTasks = useTaskStore((s) => s.load)
  const loadConfig = useConfigStore((s) => s.load)
  const showInbox = useUiStore((s) => s.showInbox)
  const view = useUiStore((s) => s.view)

  useEffect(() => {
    void loadTasks()
    void loadConfig()
  }, [loadTasks, loadConfig])

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="min-w-0 flex-1 overflow-hidden">
          {showInbox ? <InboxList /> : view === 'week' ? <WeekView /> : <MonthCalendar />}
        </main>
      </div>
      <SettingsPanel />
      <TaskEditorModal />
      <TaskContextMenu />
      <PomodoroTimer />
    </div>
  )
}
