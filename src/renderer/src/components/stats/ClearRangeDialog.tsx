/**
 * 清空指定周期数据弹窗：支持单日 / 单月 / 自定义区间三种粒度。
 * 两步交互：先选择时间范围 → 再二次确认（统一警示文案），确认后回调 [from, to]。
 */
import { useState } from 'react'
import { todayStr } from '../../../../shared/date'
import { ConfirmDialog, CONFIRM_DELETE_TEXT } from './ConfirmDialog'

type RangeMode = 'day' | 'month' | 'custom'

/** YYYY-MM → 该月起止日期（闭区间） */
function monthToRange(ym: string): { from: string; to: string } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(ym)
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2]) // 1-based
  if (month < 1 || month > 12) return null
  const pad = (n: number) => String(n).padStart(2, '0')
  const lastDay = new Date(year, month, 0).getDate()
  return { from: `${year}-${pad(month)}-01`, to: `${year}-${pad(month)}-${pad(lastDay)}` }
}

interface ClearRangeDialogProps {
  busy: boolean
  onConfirm: (from: string, to: string) => void
  onCancel: () => void
}

export function ClearRangeDialog({ busy, onConfirm, onCancel }: ClearRangeDialogProps) {
  const today = todayStr()
  const [mode, setMode] = useState<RangeMode>('day')
  const [day, setDay] = useState(today)
  const [month, setMonth] = useState(today.slice(0, 7))
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)
  const [step, setStep] = useState<'pick' | 'confirm'>('pick')

  const range =
    mode === 'day'
      ? day
        ? { from: day, to: day }
        : null
      : mode === 'month'
        ? monthToRange(month)
        : from && to && from <= to
          ? { from, to }
          : null

  const rangeLabel = range ? (range.from === range.to ? range.from : `${range.from} ~ ${range.to}`) : ''

  if (step === 'confirm' && range) {
    return (
      <ConfirmDialog
        title="清空指定周期数据"
        detail={`将删除 ${rangeLabel} 内的全部专注计时记录。`}
        confirmLabel="清空"
        busy={busy}
        onConfirm={() => onConfirm(range.from, range.to)}
        onCancel={onCancel}
      />
    )
  }

  return (
    <div className="confirm-mask" onClick={busy ? undefined : onCancel}>
      <div className="confirm-panel" onClick={(e) => e.stopPropagation()}>
        <h3 className="confirm-title">清空指定周期数据</h3>
        <div className="view-tabs confirm-mode-tabs">
          <button className={mode === 'day' ? 'active' : ''} onClick={() => setMode('day')}>
            单日
          </button>
          <button className={mode === 'month' ? 'active' : ''} onClick={() => setMode('month')}>
            单月
          </button>
          <button className={mode === 'custom' ? 'active' : ''} onClick={() => setMode('custom')}>
            自定义
          </button>
        </div>

        <div className="confirm-form">
          {mode === 'day' && (
            <label className="confirm-field">
              <span>选择日期</span>
              <input type="date" value={day} onChange={(e) => setDay(e.target.value)} />
            </label>
          )}
          {mode === 'month' && (
            <label className="confirm-field">
              <span>选择月份</span>
              <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
            </label>
          )}
          {mode === 'custom' && (
            <div className="confirm-field">
              <span>日期区间</span>
              <div className="confirm-range-row">
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                <span>至</span>
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
            </div>
          )}
        </div>

        {mode === 'custom' && from > to && (
          <p className="confirm-error">起始日期需不晚于结束日期</p>
        )}

        <p className="confirm-hint">{CONFIRM_DELETE_TEXT}</p>

        <div className="confirm-actions">
          <button className="text-btn" onClick={onCancel} disabled={busy}>
            取消
          </button>
          <button className="danger-btn" disabled={!range || busy} onClick={() => setStep('confirm')}>
            下一步
          </button>
        </div>
      </div>
    </div>
  )
}
