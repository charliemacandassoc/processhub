import { useEffect, useRef } from 'react'
import BpmnViewer from 'bpmn-js/lib/NavigatedViewer'
import { BpmnStepInfo } from '../types'

interface Props {
  xml: string
  activeStepId: string | null
  onStepSelect: (id: string) => void
  onSubprocessNavigate: (subprocessId: string) => void
  onStepsLoaded: (steps: BpmnStepInfo[]) => void
}

// bpmn-js canvas has an overloaded zoom() — use a loose type to avoid TS2300
type BpmnCanvas = {
  zoom: (...args: unknown[]) => unknown
  addMarker: (id: string, cls: string) => void
  removeMarker: (id: string, cls: string) => void
}

export function BpmnCanvas({ xml, activeStepId, onStepSelect, onSubprocessNavigate, onStepsLoaded }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<InstanceType<typeof BpmnViewer> | null>(null)

  // Keep callback refs so the viewer effect only depends on `xml`,
  // not on the inline function objects (which change every render).
  const onStepSelectRef = useRef(onStepSelect)
  const onSubprocessNavigateRef = useRef(onSubprocessNavigate)
  const onStepsLoadedRef = useRef(onStepsLoaded)
  useEffect(() => { onStepSelectRef.current = onStepSelect })
  useEffect(() => { onSubprocessNavigateRef.current = onSubprocessNavigate })
  useEffect(() => { onStepsLoadedRef.current = onStepsLoaded })

  // Only re-mount the viewer when xml changes
  useEffect(() => {
    if (!containerRef.current || !xml) return

    const viewer = new BpmnViewer({ container: containerRef.current })
    viewerRef.current = viewer

    viewer.importXML(xml).then(() => {
      const canvas = viewer.get('canvas') as BpmnCanvas
      canvas.zoom('fit-viewport', 'auto')

      const elementRegistry = viewer.get('elementRegistry') as {
        filter: (fn: (el: { type: string; id: string; businessObject: { name?: string; $attrs?: Record<string, string> } }) => boolean) => Array<{ type: string; id: string; businessObject: { name?: string; $attrs?: Record<string, string> } }>
      }

      const allStepTypes = [
        'bpmn:StartEvent', 'bpmn:EndEvent',
        'bpmn:Task', 'bpmn:UserTask', 'bpmn:ServiceTask', 'bpmn:ManualTask',
        'bpmn:SubProcess', 'bpmn:CallActivity',
      ]
      const subprocessTypes = ['bpmn:SubProcess', 'bpmn:CallActivity']

      const taskElements = elementRegistry.filter(
        (el) => allStepTypes.includes(el.type) && !el.id.endsWith('_plane')
      )

      const stepInfos: BpmnStepInfo[] = taskElements.map((el) => ({
        id: el.id,
        label: el.businessObject.name ?? el.id,
        elementType:
          el.type === 'bpmn:StartEvent' ? 'startEvent'
          : el.type === 'bpmn:EndEvent' ? 'endEvent'
          : subprocessTypes.includes(el.type) ? 'subprocess'
          : 'task',
        isSubprocess: subprocessTypes.includes(el.type),
        subprocessId: el.businessObject.$attrs?.['data-subprocess-id'],
      }))

      onStepsLoadedRef.current(stepInfos)

      const eventBus = viewer.get('eventBus') as {
        on: (event: string, handler: (e: { element: { id: string; type: string; businessObject: { $attrs?: Record<string, string> } } }) => void) => void
      }

      eventBus.on('element.click', (e) => {
        const el = e.element
        if (!allStepTypes.includes(el.type)) return

        if (
          subprocessTypes.includes(el.type) &&
          el.businessObject.$attrs?.['data-subprocess-id']
        ) {
          onSubprocessNavigateRef.current(el.businessObject.$attrs['data-subprocess-id'])
        } else {
          onStepSelectRef.current(el.id)
        }
      })
    })

    return () => { viewer.destroy() }
  }, [xml])

  // Highlight selected step using canvas markers (fills the exact shape bounds)
  const prevActiveStepIdRef = useRef<string | null>(null)
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer) return
    const canvas = viewer.get('canvas') as BpmnCanvas
    if (prevActiveStepIdRef.current) {
      try { canvas.removeMarker(prevActiveStepIdRef.current, 'bpmn-selected') } catch { /* ignore */ }
    }
    prevActiveStepIdRef.current = activeStepId
    if (!activeStepId) return
    try { canvas.addMarker(activeStepId, 'bpmn-selected') } catch { /* ignore */ }
  }, [activeStepId])

  function fitView() {
    const canvas = viewerRef.current?.get('canvas') as BpmnCanvas | undefined
    canvas?.zoom('fit-viewport', 'auto')
  }

  function zoom(delta: number) {
    const canvas = viewerRef.current?.get('canvas') as BpmnCanvas | undefined
    if (!canvas) return
    const current = canvas.zoom() as number
    canvas.zoom(current + delta)
  }

  return (
    <div className="bpmn-canvas-wrapper">
      <div ref={containerRef} className="bpmn-canvas" />
      <div className="bpmn-controls">
        <button className="bpmn-btn" onClick={fitView} title="Fit to screen">⊡</button>
        <button className="bpmn-btn" onClick={() => zoom(0.1)} title="Zoom in">+</button>
        <button className="bpmn-btn" onClick={() => zoom(-0.1)} title="Zoom out">−</button>
      </div>
    </div>
  )
}
