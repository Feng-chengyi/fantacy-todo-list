/**
 * 使用说明面板：静态分章节展示（helpContent），可常驻打开。
 * Esc / 点遮罩 / 「关闭」按钮关闭。
 */
import { useEffect } from 'react'
import { useUiStore } from '../../stores/uiStore'
import { HELP_SECTIONS } from './helpContent'

export function HelpPanel() {
  const showHelp = useUiStore((s) => s.showHelp)
  const setShowHelp = useUiStore((s) => s.setShowHelp)

  useEffect(() => {
    if (!showHelp) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setShowHelp(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showHelp, setShowHelp])

  if (!showHelp) return null

  return (
    <div className="help-mask" onClick={() => setShowHelp(false)}>
      <div className="help-panel" onClick={(e) => e.stopPropagation()}>
        <div className="help-head">
          <h2>使用说明</h2>
          <button className="text-btn" onClick={() => setShowHelp(false)}>
            关闭
          </button>
        </div>
        <div className="help-body">
          {HELP_SECTIONS.map((section) => (
            <section key={section.title} className="help-section">
              <h3>{section.title}</h3>
              <ul>
                {section.body.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
