import { admin } from '../AdminUi.jsx'
import { LoadingButton } from '../../../components/loading'
import { useAsyncAction } from '../../../components/loading/useLoadingHooks.js'

export default function ExportButtons({ onCsv, onPdf, disabled = false }) {
  const { loading: csvLoading, run: runCsv } = useAsyncAction(async () => onCsv?.())
  const { loading: pdfLoading, run: runPdf } = useAsyncAction(async () => onPdf?.())

  return (
    <div className="flex flex-wrap gap-2">
      <LoadingButton
        type="button"
        onClick={() => void runCsv()}
        disabled={disabled || pdfLoading}
        loading={csvLoading}
        loadingKey="export"
        className={admin.btnSecondary}
        minWidth="7.5rem"
      >
        Export CSV
      </LoadingButton>
      <LoadingButton
        type="button"
        onClick={() => void runPdf()}
        disabled={disabled || csvLoading}
        loading={pdfLoading}
        loadingKey="export"
        className={admin.btnSecondary}
        minWidth="7.5rem"
      >
        Export PDF
      </LoadingButton>
    </div>
  )
}
