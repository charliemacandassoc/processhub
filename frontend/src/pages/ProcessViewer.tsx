import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useProcessStore } from '../store/useProcessStore'
import { api } from '../lib/api'
import { ProcessOverview } from '../types'
import { BpmnCanvas } from '../components/BpmnCanvas'
import { OverviewCard } from '../components/OverviewCard'
import { StepList } from '../components/StepList'
import { Breadcrumb } from '../components/Breadcrumb'
import { BpmnStepInfo } from '../types'

export function ProcessViewer() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { setActiveProcess, setActiveStep, activeStepId, pushSubprocess } = useProcessStore()

  const [overview, setOverview] = useState<ProcessOverview | null>(null)
  const [bpmnXml, setBpmnXml] = useState<string | null>(null)
  const [steps, setSteps] = useState<BpmnStepInfo[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    setActiveProcess(id)
    setActiveStep(null)
    setError(null)
    setSteps([])
    setBpmnXml(null)
    setOverview(null)

    Promise.all([
      api.get<ProcessOverview>(`/processes/${id}/overview`),
      api.getText(`/processes/${id}/bpmn`),
    ])
      .then(([ov, xml]) => {
        setOverview(ov)
        setBpmnXml(xml)
      })
      .catch((e: Error) => {
        if (e.message.includes('403')) {
          setError('This process is a draft and is not available for viewing.')
        } else {
          setError(e.message)
        }
      })
  }, [id, setActiveProcess, setActiveStep])

  function handleStepSelect(stepId: string) {
    // Toggle — clicking the open step closes it
    setActiveStep(activeStepId === stepId ? null : stepId)
  }

  function handleSubprocessNavigate(subprocessId: string) {
    if (!overview) return
    pushSubprocess({ label: overview.frontmatter.title, processId: id!, type: 'process' })
    navigate(`/process/${subprocessId}`)
  }

  if (error) {
    return (
      <div className="page-error">
        <p>{error}</p>
        <button className="btn btn-outline" onClick={() => navigate('/inventory')}>
          Back to inventory
        </button>
      </div>
    )
  }

  return (
    <div className="viewer-layout">
      <div className="viewer-main">
        <Breadcrumb
          processTitle={overview?.frontmatter.title ?? '…'}
          processId={id!}
          category={overview?.frontmatter.category ?? []}
          status={overview?.frontmatter.status}
          version={overview?.frontmatter.version}
        />

        {bpmnXml && (
          <BpmnCanvas
            xml={bpmnXml}
            activeStepId={activeStepId}
            onStepSelect={handleStepSelect}
            onSubprocessNavigate={handleSubprocessNavigate}
            onStepsLoaded={setSteps}
          />
        )}

        {overview && <OverviewCard content={overview.content} />}

        <StepList
          steps={steps}
          activeStepId={activeStepId}
          processId={id!}
          overviewContent={overview?.content ?? ''}
          onStepSelect={handleStepSelect}
          onSubprocessNavigate={handleSubprocessNavigate}
        />
      </div>
    </div>
  )
}
