import { useEffect, useState } from 'react'
import { BpmnStepInfo, StepDetail } from '../types'
import { api } from '../lib/api'
import { extractSection } from '../lib/markdown'
import { DetailPanel } from './DetailPanel'
import { MarkdownRenderer } from './MarkdownRenderer'

interface Props {
  steps: BpmnStepInfo[]
  activeStepId: string | null
  processId: string
  overviewContent: string
  onStepSelect: (id: string) => void
  onSubprocessNavigate?: (subprocessId: string) => void
}

export function StepList({ steps, activeStepId, processId, overviewContent, onStepSelect, onSubprocessNavigate }: Props) {
  const [detailCache, setDetailCache] = useState<Map<string, StepDetail>>(new Map())
  const [loading, setLoading] = useState<string | null>(null)

  const activeStep = steps.find((s) => s.id === activeStepId)

  useEffect(() => {
    if (!activeStepId || !activeStep) return
    // Start/end events use overview content — no API fetch needed
    if (activeStep.elementType === 'startEvent' || activeStep.elementType === 'endEvent') return
    if (detailCache.has(activeStepId)) return

    setLoading(activeStepId)
    api
      .get<StepDetail>(`/processes/${processId}/steps/${activeStepId}`)
      .then((d) => setDetailCache((prev) => new Map(prev).set(activeStepId, d)))
      .catch(() => {})
      .finally(() => setLoading(null))
  }, [activeStepId, activeStep, processId, detailCache])

  return (
    <div className="step-list">
      <h3 className="step-list-heading">Steps</h3>
      {steps.map((step, i) => {
        const isOpen = step.id === activeStepId
        const isLoading = loading === step.id

        return (
          <div key={step.id} className={`step-row step-row-${step.elementType} ${isOpen ? 'step-row-active' : ''}`}>
            <div
              className="step-row-header"
              onClick={() => onStepSelect(step.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && onStepSelect(step.id)}
            >
              <StepIcon type={step.elementType} index={i} />
              <span className="step-name">{step.label}</span>
              {step.isSubprocess && <span className="badge badge-subprocess">subprocess</span>}
              <span className="step-chevron">{isOpen ? '▲' : '▼'}</span>
            </div>

            {isOpen && (
              <div className="step-accordion">
                {isLoading && <div className="step-loading">Loading…</div>}

                {/* Start event — show Triggers from overview */}
                {step.elementType === 'startEvent' && (
                  <div className="step-event-content">
                    <h4 className="step-event-heading">Triggers</h4>
                    <MarkdownRenderer
                      content={extractSection(overviewContent, 'Triggers') || '_No triggers defined._'}
                      processId={processId}
                    />
                  </div>
                )}

                {/* End event — show Outcomes from overview */}
                {step.elementType === 'endEvent' && (
                  <div className="step-event-content">
                    <h4 className="step-event-heading">Outcomes</h4>
                    <MarkdownRenderer
                      content={extractSection(overviewContent, 'Outcomes') || '_No outcomes defined._'}
                      processId={processId}
                    />
                  </div>
                )}

                {/* Regular task / subprocess */}
                {(step.elementType === 'task' || step.elementType === 'subprocess') && detailCache.has(step.id) && (
                  <>
                    <DetailPanel
                      stepId={step.id}
                      totalSteps={steps.length}
                      stepIndex={i}
                      stepLabel={step.label}
                      detail={detailCache.get(step.id)!}
                      processId={processId}
                    />
                    {step.isSubprocess && step.subprocessId && (
                      <div className="subprocess-nav">
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => onSubprocessNavigate?.(step.subprocessId!)}
                        >
                          ↳ Dive into subprocess
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )
      })}
      {steps.length === 0 && (
        <p className="step-list-empty">No steps found in this process diagram.</p>
      )}
    </div>
  )
}

function StepIcon({ type, index }: { type: string; index: number }) {
  if (type === 'startEvent') {
    return <span className="step-icon step-icon-start" title="Start">●</span>
  }
  if (type === 'endEvent') {
    return <span className="step-icon step-icon-end" title="End">◉</span>
  }
  // Task number (exclude start/end from count visually — count only tasks)
  return <span className="step-number">{index + 1}</span>
}
