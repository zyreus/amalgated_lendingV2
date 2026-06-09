import { admin } from '../AdminUi.jsx'
import { APPLICATION_STATUSES } from './applicationStatus.js'

export default function StatusTabs({ activeStatus, onChange }) {
  return (
    <div className="flex max-w-full flex-nowrap gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:overflow-visible sm:pb-0">
      {APPLICATION_STATUSES.map((status) => (
        <button
          key={status.value}
          type="button"
          onClick={() => onChange(status.value)}
          className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide transition-all duration-200 ${
            activeStatus === status.value ? admin.filterActive : admin.filterInactive
          }`}
        >
          {status.label}
        </button>
      ))}
    </div>
  )
}
