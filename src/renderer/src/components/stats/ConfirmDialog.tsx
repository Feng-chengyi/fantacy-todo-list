/**
 * 统计数据清除确认弹窗（通用）：
 * 危险操作二次确认，文案统一「删除后数据将永久清除，无法恢复，是否确认继续？」。
 */
interface ConfirmDialogProps {
  title: string
  /** 补充说明（如将被删除的范围/记录摘要），置于警示文案之前 */
  detail?: string
  confirmLabel?: string
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export const CONFIRM_DELETE_TEXT = '删除后数据将永久清除，无法恢复，是否确认继续？'

export function ConfirmDialog({
  title,
  detail,
  confirmLabel = '确认删除',
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <div className="confirm-mask" onClick={busy ? undefined : onCancel}>
      <div className="confirm-panel" onClick={(e) => e.stopPropagation()}>
        <h3 className="confirm-title">{title}</h3>
        {detail && <p className="confirm-detail">{detail}</p>}
        <p className="confirm-warning">{CONFIRM_DELETE_TEXT}</p>
        <div className="confirm-actions">
          <button className="text-btn" onClick={onCancel} disabled={busy}>
            取消
          </button>
          <button className="danger-btn" onClick={onConfirm} disabled={busy}>
            {busy ? '删除中…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
