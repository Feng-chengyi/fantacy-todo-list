/**
 * 主窗口顶层布局：TopBar + (Sidebar + 主视图) + 各类弹层 + 悬浮计时器 + 背景层。
 * v3：一级导航仅 待办/待办集/时间轴/统计/倒数日；计时无独立页面（悬浮窗常驻）；
 * 主题（明暗/主题色/背景/透明度）由 configStore 驱动 theme.ts 实时应用。
 */
import { useCallback, useEffect } from 'react'
import { todayStr } from '../../shared/date'
import type { TimerState } from '../../shared/types'
import { useConfigStore } from './stores/configStore'
import { useTaskStore } from './stores/taskStore'
import { useGoalStore } from './stores/goalStore'
import { useUiStore } from './stores/uiStore'
import { TopBar } from './components/layout/TopBar'
import { Sidebar } from './components/layout/Sidebar'
import { StatusBar } from './components/layout/StatusBar'
import { SettingsPanel } from './components/layout/SettingsPanel'
import { PetMakerPanel } from './components/petmaker/PetMakerPanel'
import { TodoPanel } from './components/todo/TodoPanel'
import { CollectionsPanel } from './components/collections/CollectionsPanel'
import { TimelinePanel } from './components/timeline/TimelinePanel'
import { TaskEditorModal } from './components/task/TaskEditorModal'
import { TaskContextMenu } from './components/task/TaskContextMenu'
import { StatsPanel } from './components/stats/StatsPanel'
import { CountdownPanel } from './components/goals/CountdownPanel'
import { FloatingTimer } from './components/timer/FloatingTimer'
import { GlobalSearch } from './components/search/GlobalSearch'
import { HelpPanel } from './components/help/HelpPanel'
import { applyTheme, watchSystemTheme } from './theme'
import { quickTimer } from './services/focus'
import * as ipc from './services/ipc'

export default function App(): JSX.Element {
  const page = useUiStore((s) => s.page)
  const showPetMaker = useUiStore((s) => s.showPetMaker)

  // 一次 loadData 往返后由各 store 分发共用，替代原先多路各自 loadData（QA O3）
  const refreshData = useCallback(async (): Promise<void> => {
    const data = await ipc.loadData()
    useTaskStore.getState().applyData(data)
    useGoalStore.getState().applyData(data)
  }, [])

  // 配置加载后：应用主题 + 恢复持久化的计时快照
  useEffect(() => {
    void (async () => {
      const cfg = await ipc.getConfig()
      useConfigStore.getState().applyConfig(cfg)
      useUiStore.getState().restoreTimer((cfg.activeTimer as TimerState | null) ?? null)
    })()
  }, [])

  useEffect(() => {
    void refreshData()
  }, [refreshData])

  // 主题实时应用：配置变化（含跨入口广播）或系统明暗变化时重刷 CSS 变量
  useEffect(() => {
    const cfg = useConfigStore.getState()
    applyTheme({
      ...cfg,
    })
    const unsubConfig = useConfigStore.subscribe((state) => {
      applyTheme({
        ...state,
      })
    })
    const unsubSystem = watchSystemTheme(() => {
      applyTheme({ ...useConfigStore.getState() })
    })
    return () => {
      unsubConfig()
      unsubSystem()
    }
  }, [])

  // 计时快照持久化：timer 状态每次变化（开始/暂停/继续/停止）写回主进程，
  // 页面刷新/应用重启后恢复进度（PRD 边界场景 3）
  useEffect(() => {
    return useUiStore.subscribe((state, prev) => {
      if (state.timer !== prev.timer) {
        void ipc.setConfig({ activeTimer: state.timer })
      }
    })
  }, [])

  // 订阅主进程「数据已变更」推送（桌宠端完成/跳过任务等跨窗口写操作），
  // 触发各 store 重载，保证主窗口勾选状态即时同步。
  useEffect(() => {
    return ipc.onDataChanged(() => {
      void refreshData()
    })
  }, [refreshData])

  // 订阅主进程「配置已变更」推送（桌宠右键隐藏/托盘开关等跨入口写配置），
  // 同步 configStore，保证设置页「显示桌宠」勾选框与桌宠实际状态永远一致。
  useEffect(() => {
    return ipc.onConfigChanged((cfg) => {
      useConfigStore.getState().applyConfig(cfg)
    })
  }, [])

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
        case 'collections':
          ui.setPage('collections')
          break
        case 'timeline':
          ui.setPage('timeline')
          break
        case 'stats':
          ui.setPage('stats')
          break
        case 'goals':
          ui.setPage('goals')
          break
        case 'settings':
          ui.setShowSettings(true)
          break
      }
    })
  }, [])

  // 订阅主进程推送的全局快捷键动作（T05）
  useEffect(() => {
    return ipc.onShortcut((action) => {
      const ui = useUiStore.getState()
      if (action === 'newTask') ui.openCreate(todayStr())
      else if (action === 'quickTimer') void quickTimer()
      else if (action === 'openSearch') ui.setShowSearch(true)
    })
  }, [])

  const mainView =
    page === 'collections' ? (
      <CollectionsPanel />
    ) : page === 'timeline' ? (
      <TimelinePanel />
    ) : page === 'stats' ? (
      <StatsPanel />
    ) : page === 'goals' ? (
      <CountdownPanel />
    ) : (
      <TodoPanel />
    )

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="app-bg-layer" />
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        {/* key=page：切换页面时重挂载触发统一入场过渡（N1.1，180ms） */}
        <main className="min-w-0 flex-1 overflow-hidden">
          <div key={page} className="page-transition">
            {mainView}
          </div>
        </main>
      </div>
      <StatusBar />
      <FloatingTimer />
      <SettingsPanel />
      {showPetMaker && <PetMakerPanel />}
      <TaskEditorModal />
      <TaskContextMenu />
      <GlobalSearch />
      <HelpPanel />
    </div>
  )
}
