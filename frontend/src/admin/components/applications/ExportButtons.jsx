import { admin } from '../AdminUi.jsx'

export default function ExportButtons({ onCsv, onPdf, disabled = false }) {
  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={onCsv} disabled={disabled} className={admin.btnSecondary}>
        Export CSV
      </button>
      <button type="button" onClick={onPdf} disabled={disabled} className={admin.btnSecondary}>
        Export PDF
      </button>
    </div>
  )
}
