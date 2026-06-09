import { useEffect, useState } from 'react'
import { admin } from '../AdminUi.jsx'

export default function SearchBar({ value, onSearch }) {
  const [draft, setDraft] = useState(value || '')

  useEffect(() => {
    setDraft(value || '')
  }, [value])

  const submit = () => onSearch(draft.trim())

  return (
    <div className="min-w-0 flex-1 sm:max-w-sm">
      <label className="sr-only" htmlFor="application-search">
        Search applications
      </label>
      <div className="flex gap-2">
        <input
          id="application-search"
          type="search"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Search borrower, email, or loan ID..."
          className={`min-w-0 flex-1 ${admin.input}`}
        />
        <button type="button" onClick={submit} className={admin.btnSecondary}>
          Search
        </button>
      </div>
    </div>
  )
}
