/**
 * 某日时间冲突检测 hook：返回该日存在时间冲突的任务 id 集合。
 */
import { useMemo } from 'react'
import { detectConflicts } from '../../../shared/conflict'
import { useTaskStore } from '../stores/taskStore'

export function useConflictsForDate(date: string): Set<string> {
  const tasks = useTaskStore((s) => s.tasks)

  return useMemo(() => {
    const dayTasks = tasks.filter((t) => t.date === date)
    const pairs = detectConflicts(dayTasks)
    const ids = new Set<string>()
    for (const pair of pairs) {
      ids.add(pair.a.id)
      ids.add(pair.b.id)
    }
    return ids
  }, [tasks, date])
}
