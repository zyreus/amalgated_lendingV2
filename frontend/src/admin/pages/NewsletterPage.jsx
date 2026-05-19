import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../api/client.js'
import { useToast } from '../context/ToastContext.jsx'
import { admin, EmptyTableRow, TableSkeletonRows } from '../components/AdminUi.jsx'

const LOCALE = 'en'
const KEY_NEWS = 'landing.newsletter.news'
const KEY_ANNOUNCEMENTS = 'landing.newsletter.announcements'

function parseItems(body) {
  if (!body) return []
  try {
    const parsed = JSON.parse(body)
    if (Array.isArray(parsed)) {
      return parsed.map((row, i) => normalizeItem(row, i))
    }
  } catch {
    /* fallback below */
  }
  return String(body)
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean)
    .map((title, i) => normalizeItem({ title }, i))
}

function normalizeItem(item, i) {
  return {
    id: String(item?.id || `item-${Date.now()}-${i}`),
    title: String(item?.title || item?.headline || ''),
    summary: String(item?.summary || item?.description || ''),
    date: String(item?.date || ''),
  }
}

function toBody(items) {
  return JSON.stringify(
    items.map((x) => ({
      id: x.id,
      title: x.title,
      summary: x.summary,
      date: x.date,
    }))
  )
}

function emptyDraft() {
  return { title: '', summary: '', date: '' }
}

function formatSubscribedAt(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function parseSubscriberPage(response) {
  const payload = response?.data
  const rows = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : []
  return {
    rows,
    total: typeof payload?.total === 'number' ? payload.total : rows.length,
    currentPage: typeof payload?.current_page === 'number' ? payload.current_page : 1,
    lastPage: typeof payload?.last_page === 'number' ? payload.last_page : 1,
  }
}

function findExactSection(response, sectionKey) {
  const payload = response?.data
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.data)
      ? payload.data
      : []
  return list.find((row) => row?.section_key === sectionKey) || list[0] || null
}

function EditorBlock({
  label,
  items,
  draft,
  onDraftChange,
  onAdd,
  onEdit,
  onDelete,
}) {
  return (
    <div className={`space-y-4 p-5 ${admin.cardNoHover}`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-neutral-900">{label}</h2>
        <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs text-neutral-700">
          {items.length} item{items.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="grid gap-3">
        <input
          value={draft.title}
          onChange={(e) => onDraftChange((d) => ({ ...d, title: e.target.value }))}
          placeholder="Title"
          className={admin.input}
        />
        <textarea
          value={draft.summary}
          onChange={(e) => onDraftChange((d) => ({ ...d, summary: e.target.value }))}
          rows={3}
          placeholder="Summary (optional)"
          className={admin.input}
        />
        <input
          value={draft.date}
          onChange={(e) => onDraftChange((d) => ({ ...d, date: e.target.value }))}
          placeholder="Date (optional) e.g. Mar 2026"
          className={admin.input}
        />
        <button type="button" onClick={onAdd} className={`${admin.btnPrimary} px-5`}>
          Add item
        </button>
      </div>

      <div className="space-y-2">
        {items.length === 0 ? (
          <p className={`text-sm ${admin.textMuted}`}>No items yet.</p>
        ) : (
          items.map((item) => (
            <div key={item.id} className="rounded-xl border border-neutral-200 bg-white p-3">
              <p className="text-sm font-semibold text-neutral-900">{item.title || '(Untitled)'}</p>
              {item.summary ? <p className="mt-1 text-sm text-neutral-700">{item.summary}</p> : null}
              {item.date ? <p className="mt-1 text-xs uppercase tracking-wide text-neutral-500">{item.date}</p> : null}
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => onEdit(item.id)}
                  className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(item.id)}
                  className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default function NewsletterPage() {
  const { showToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [news, setNews] = useState([])
  const [announcements, setAnnouncements] = useState([])
  const [newsDraft, setNewsDraft] = useState(emptyDraft)
  const [announcementDraft, setAnnouncementDraft] = useState(emptyDraft)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [subscribersLoading, setSubscribersLoading] = useState(true)
  const [subscribers, setSubscribers] = useState([])
  const [subscriberTotal, setSubscriberTotal] = useState(0)
  const [subscriberPage, setSubscriberPage] = useState(1)
  const [subscriberLastPage, setSubscriberLastPage] = useState(1)
  const [subscriberSearch, setSubscriberSearch] = useState('')
  const [subscriberSearchInput, setSubscriberSearchInput] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const [newsRes, annRes] = await Promise.all([
          api(`/cms?section_key=${encodeURIComponent(KEY_NEWS)}&locale=${encodeURIComponent(LOCALE)}`),
          api(
            `/cms?section_key=${encodeURIComponent(KEY_ANNOUNCEMENTS)}&locale=${encodeURIComponent(LOCALE)}`
          ),
        ])
        if (cancelled) return
        const newsRow = findExactSection(newsRes, KEY_NEWS)
        const annRow = findExactSection(annRes, KEY_ANNOUNCEMENTS)
        setNews(parseItems(newsRow?.body))
        setAnnouncements(parseItems(annRow?.body))
      } catch (e) {
        if (!cancelled) showToast(e.message || 'Failed to load news and announcements.', 'error')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [showToast])

  const loadSubscribers = useCallback(
    async (page = 1, search = subscriberSearch) => {
      setSubscribersLoading(true)
      try {
        const params = new URLSearchParams({ per_page: '50', page: String(page) })
        if (search.trim()) params.set('search', search.trim())
        const res = await api(`/newsletter-subscribers?${params}`)
        const parsed = parseSubscriberPage(res)
        setSubscribers(parsed.rows)
        setSubscriberTotal(parsed.total)
        setSubscriberPage(parsed.currentPage)
        setSubscriberLastPage(parsed.lastPage)
      } catch (e) {
        showToast(e.message || 'Failed to load newsletter subscribers.', 'error')
        setSubscribers([])
        setSubscriberTotal(0)
      } finally {
        setSubscribersLoading(false)
      }
    },
    [showToast, subscriberSearch]
  )

  useEffect(() => {
    void loadSubscribers(1)
  }, [loadSubscribers])

  const canSave = useMemo(() => !saving && !loading, [saving, loading])

  const addItem = (kind) => {
    const draft = kind === 'news' ? newsDraft : announcementDraft
    if (!draft.title.trim()) {
      showToast('Title is required.', 'error')
      return
    }
    const next = {
      id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: draft.title.trim(),
      summary: draft.summary.trim(),
      date: draft.date.trim(),
    }
    if (kind === 'news') {
      setNews((prev) => [next, ...prev])
      setNewsDraft(emptyDraft())
    } else {
      setAnnouncements((prev) => [next, ...prev])
      setAnnouncementDraft(emptyDraft())
    }
  }

  const editItem = (kind, id) => {
    const list = kind === 'news' ? news : announcements
    const hit = list.find((x) => x.id === id)
    if (!hit) return
    const title = window.prompt('Edit title', hit.title)
    if (title == null) return
    const summary = window.prompt('Edit summary', hit.summary || '') ?? ''
    const date = window.prompt('Edit date', hit.date || '') ?? ''
    const apply = (x) => (x.id === id ? { ...x, title: title.trim(), summary: summary.trim(), date: date.trim() } : x)
    if (kind === 'news') setNews((prev) => prev.map(apply))
    else setAnnouncements((prev) => prev.map(apply))
  }

  const deleteItem = (kind, id) => {
    if (kind === 'news') setNews((prev) => prev.filter((x) => x.id !== id))
    else setAnnouncements((prev) => prev.filter((x) => x.id !== id))
  }

  const askDeleteItem = (kind, id) => {
    const list = kind === 'news' ? news : announcements
    const item = list.find((x) => x.id === id)
    if (!item) return
    setDeleteTarget({
      kind,
      id,
      title: item.title || '(Untitled)',
    })
  }

  const save = async () => {
    setSaving(true)
    try {
      await Promise.all([
        api('/cms', {
          method: 'POST',
          body: JSON.stringify({
            section_key: KEY_NEWS,
            locale: LOCALE,
            title: 'News',
            body: toBody(news),
            meta: {},
          }),
        }),
        api('/cms', {
          method: 'POST',
          body: JSON.stringify({
            section_key: KEY_ANNOUNCEMENTS,
            locale: LOCALE,
            title: 'Announcements',
            body: toBody(announcements),
            meta: {},
          }),
        }),
      ])
      showToast('News and announcements saved.', 'success')
    } catch (e) {
      showToast(e.message || 'Save failed.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="w-full min-w-0 space-y-6">
      <div>
        <h1 className={admin.pageTitle}>News & Announcements</h1>
        <p className={admin.pageSubtitle}>
          Manage news and announcements, and view people who subscribed from the website footer.
        </p>
      </div>

      {loading ? (
        <div className={`p-6 ${admin.cardNoHover}`}>
          <p className={`text-sm ${admin.textMuted}`}>Loading content...</p>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          <EditorBlock
            label="Announcements"
            items={announcements}
            draft={announcementDraft}
            onDraftChange={setAnnouncementDraft}
            onAdd={() => addItem('announcements')}
            onEdit={(id) => editItem('announcements', id)}
            onDelete={(id) => askDeleteItem('announcements', id)}
          />
          <EditorBlock
            label="News"
            items={news}
            draft={newsDraft}
            onDraftChange={setNewsDraft}
            onAdd={() => addItem('news')}
            onEdit={(id) => editItem('news', id)}
            onDelete={(id) => askDeleteItem('news', id)}
          />
        </div>
      )}

      <div className={`p-4 ${admin.cardNoHover}`}>
        <button
          type="button"
          disabled={!canSave}
          onClick={save}
          className={`${admin.btnPrimary} px-6 disabled:opacity-50`}
        >
          {saving ? 'Saving...' : 'Save changes'}
        </button>
      </div>

      <div className={`space-y-4 p-5 ${admin.cardNoHover}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-neutral-900 dark:text-gray-100">Newsletter subscribers</h2>
            <p className={`mt-1 text-sm ${admin.textMuted}`}>
              Signups from the website footer. Also visible in Chat CRM as leads.
            </p>
          </div>
          <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs text-neutral-700 dark:bg-[#1F2937] dark:text-gray-300">
            {subscriberTotal} subscriber{subscriberTotal === 1 ? '' : 's'}
          </span>
        </div>

        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            setSubscriberSearch(subscriberSearchInput.trim())
            setSubscriberPage(1)
            void loadSubscribers(1, subscriberSearchInput.trim())
          }}
        >
          <input
            type="search"
            value={subscriberSearchInput}
            onChange={(e) => setSubscriberSearchInput(e.target.value)}
            placeholder="Search name or email"
            className={`min-w-[12rem] flex-1 ${admin.input}`}
          />
          <button type="submit" className={admin.btnSecondary}>
            Search
          </button>
          <button
            type="button"
            className={admin.btnSecondary}
            onClick={() => {
              setSubscriberSearchInput('')
              setSubscriberSearch('')
              void loadSubscribers(1, '')
            }}
          >
            Clear
          </button>
        </form>

        <div className={admin.tableWrap}>
          <div className={admin.tableScroll}>
            <table className={`${admin.tableBase} ${admin.tableMin640}`}>
              <thead className={admin.thead}>
                <tr>
                  <th className={admin.tableCell}>Name</th>
                  <th className={admin.tableCell}>Email</th>
                  <th className={admin.tableCell}>Subscribed</th>
                  <th className={admin.tableCell}>Status</th>
                </tr>
              </thead>
              <tbody>
                {subscribersLoading ? (
                  <TableSkeletonRows cols={4} rows={5} />
                ) : subscribers.length === 0 ? (
                  <EmptyTableRow colSpan={4} message="No newsletter subscribers yet." />
                ) : (
                  subscribers.map((row) => (
                    <tr key={row.id} className={admin.tbodyRow}>
                      <td className={`${admin.tableCell} ${admin.tableText}`}>{row.name || '—'}</td>
                      <td className={`${admin.tableCell} ${admin.tableText}`}>
                        <a href={`mailto:${row.email}`} className="text-brand-primary hover:underline">
                          {row.email}
                        </a>
                      </td>
                      <td className={`${admin.tableCell} ${admin.tableMuted}`}>
                        {formatSubscribedAt(row.subscribed_at)}
                      </td>
                      <td className={`${admin.tableCell} capitalize ${admin.tableMuted}`}>{row.status || 'new'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {subscriberLastPage > 1 ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              disabled={subscribersLoading || subscriberPage <= 1}
              onClick={() => void loadSubscribers(subscriberPage - 1)}
              className={admin.paginationBtn}
            >
              Previous
            </button>
            <span className={`text-sm ${admin.textMuted}`}>
              Page {subscriberPage} of {subscriberLastPage}
            </span>
            <button
              type="button"
              disabled={subscribersLoading || subscriberPage >= subscriberLastPage}
              onClick={() => void loadSubscribers(subscriberPage + 1)}
              className={admin.paginationBtn}
            >
              Next
            </button>
          </div>
        ) : null}
      </div>

      {deleteTarget ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-5 shadow-2xl">
            <h3 className="text-base font-semibold text-neutral-900">Delete item?</h3>
            <p className="mt-2 text-sm text-neutral-600">
              You are deleting{' '}
              <span className="font-semibold text-neutral-900">{deleteTarget.title}</span>. This action cannot be
              undone.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteItem(deleteTarget.kind, deleteTarget.id)
                  setDeleteTarget(null)
                }}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

