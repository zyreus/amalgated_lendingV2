import { useCallback, useMemo, useState } from 'react'
import {
  buildStepStatusMap,
  parseValidationErrors,
  scrollToWizardTarget,
} from '../validation/wizardValidationUtils.js'

export function useWizardStepValidation({ steps, step }) {
  const [modalOpen, setModalOpen] = useState(false)
  const [groupedErrors, setGroupedErrors] = useState([])
  const [fieldErrors, setFieldErrors] = useState({})
  const [docErrors, setDocErrors] = useState({})
  const [firstTarget, setFirstTarget] = useState(null)
  const [shakeKeys, setShakeKeys] = useState(() => new Set())
  const [errorStepIds, setErrorStepIds] = useState(() => new Set())
  const [completedStepIds, setCompletedStepIds] = useState(() => new Set())

  const triggerShake = useCallback((keys) => {
    const next = new Set(keys.filter(Boolean))
    if (!next.size) return
    setShakeKeys(next)
    window.setTimeout(() => setShakeKeys(new Set()), 480)
  }, [])

  const applyValidationResult = useCallback(
    (result, stepId) => {
      const hasErrors = Boolean(result?.grouped?.length)
      if (!hasErrors) return false

      setGroupedErrors(result.grouped)
      setFieldErrors(result.fieldErrors || {})
      setDocErrors(result.docErrors || {})
      setFirstTarget(result.firstTarget || null)
      setModalOpen(true)
      setErrorStepIds((prev) => new Set([...prev, Number(stepId)]))
      triggerShake([...Object.keys(result.fieldErrors || {}), ...Object.keys(result.docErrors || {})])
      return true
    },
    [triggerShake],
  )

  const applyApiErrors = useCallback(
    (errorMessages, registry, { stepId, currentStepTitle } = {}) => {
      const result = parseValidationErrors(errorMessages, registry, { currentStepTitle })
      return applyValidationResult(result, stepId)
    },
    [applyValidationResult],
  )

  const clearFieldError = useCallback((key) => {
    if (!key) return
    setFieldErrors((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }, [])

  const clearDocError = useCallback((key) => {
    if (!key) return
    setDocErrors((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }, [])

  const markStepComplete = useCallback((stepId) => {
    const id = Number(stepId)
    setCompletedStepIds((prev) => new Set([...prev, id]))
    setErrorStepIds((prev) => {
      if (!prev.has(id)) return prev
      const next = new Set(prev)
      next.delete(id)
      return next
    })
    setFieldErrors({})
    setDocErrors({})
  }, [])

  const closeModal = useCallback(() => setModalOpen(false), [])

  const handleReviewMissing = useCallback(() => {
    setModalOpen(false)
    window.setTimeout(() => {
      const scrolled = scrollToWizardTarget(firstTarget)
      if (firstTarget?.type === 'field' && firstTarget.key) {
        triggerShake([firstTarget.key])
      } else if (firstTarget?.type === 'doc' && firstTarget.key) {
        triggerShake([firstTarget.key])
      } else if (!scrolled) {
        document.querySelector('[data-wizard-section]')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }, 120)
  }, [firstTarget, triggerShake])

  const stepStatuses = useMemo(
    () =>
      buildStepStatusMap({
        steps,
        currentStep: step,
        completedStepIds,
        errorStepIds,
      }),
    [steps, step, completedStepIds, errorStepIds],
  )

  const getFieldError = useCallback((key) => fieldErrors[key] || '', [fieldErrors])
  const getDocError = useCallback((key) => docErrors[key] || '', [docErrors])
  const shouldShakeField = useCallback((key) => shakeKeys.has(key), [shakeKeys])
  const shouldShakeDoc = useCallback((key) => shakeKeys.has(key), [shakeKeys])

  return {
    modalOpen,
    groupedErrors,
    fieldErrors,
    docErrors,
    stepStatuses,
    applyValidationResult,
    applyApiErrors,
    clearFieldError,
    clearDocError,
    markStepComplete,
    closeModal,
    handleReviewMissing,
    getFieldError,
    getDocError,
    shouldShakeField,
    shouldShakeDoc,
  }
}
