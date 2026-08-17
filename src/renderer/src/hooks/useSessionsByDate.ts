/**
 * 按本地日期分组的专注会话索引（时间轴月/周/日/列表视图共用数据源）。
 */
import { useMemo } from 'react'
import type { FocusSession } from '../../../shared/types'
import { groupSessionsByDate } from '../../../shared/sessionView'
import { useTaskStore } from '../stores/taskStore'

export function useSessionsByDate(): Map<string, FocusSession[]> {
  const sessions = useTaskStore((s) => s.sessions)
  return useMemo(() => groupSessionsByDate(sessions), [sessions])
}
