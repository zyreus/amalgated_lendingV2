import { useEffect } from 'react'

function registerModalFactory() {
  window.applicationFormSystemModal = () => ({
    open: false,
    modalMessage: '',
    modalTone: 'error',
    modalTitle: 'System Message',
    openModal(payload) {
      const options =
        typeof payload === 'object' && payload !== null
          ? payload
          : { message: String(payload ?? '') }
      this.modalTitle = String(options.title || 'System Message')
      this.modalMessage = String(options.message ?? '')
      this.modalTone = options.tone === 'success' ? 'success' : 'error'
      this.open = true
    },
    closeModal() {
      this.open = false
    },
  })
}

export default function ApplicationFormModalHost() {
  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    registerModalFactory()

    let cancelled = false
    let initTimer = null
    const host = document.createElement('div')
    host.innerHTML = `
      <div
        x-data="window.applicationFormSystemModal()"
        x-show="open"
        x-cloak
        x-transition:enter="transition ease-out duration-200"
        x-transition:enter-start="opacity-0"
        x-transition:enter-end="opacity-100"
        x-transition:leave="transition ease-in duration-150"
        x-transition:leave-start="opacity-100"
        x-transition:leave-end="opacity-0"
        class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="system-message-title"
      >
        <div
          x-show="open"
          x-transition:enter="transition ease-out duration-200"
          x-transition:enter-start="opacity-0 scale-95"
          x-transition:enter-end="opacity-100 scale-100"
          x-transition:leave="transition ease-in duration-150"
          x-transition:leave-start="opacity-100 scale-100"
          x-transition:leave-end="opacity-0 scale-95"
          @click.stop
          class="relative w-full max-w-md rounded-2xl border border-gray-200 border-t-[3px] border-t-[#d92243] bg-white p-6 text-gray-900 shadow-2xl"
        >
          <p class="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#d92243]">System message</p>
          <h2 id="system-message-title" class="mt-2 text-lg font-semibold text-gray-900" x-text="modalTitle"></h2>
          <div class="mt-4 flex gap-3 border-l-4 border-[#d92243] pl-3">
            <template x-if="modalTone === 'success'">
              <svg class="mt-0.5 h-5 w-5 shrink-0 text-[#d92243]" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15-5-5 1.41-1.41L11 14.17l5.59-5.59L18 10l-7 7z" />
              </svg>
            </template>
            <template x-if="modalTone !== 'success'">
              <svg class="mt-0.5 h-5 w-5 shrink-0 text-[#d92243]" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
              </svg>
            </template>
            <p class="text-sm leading-relaxed text-gray-700" x-text="modalMessage"></p>
          </div>
          <button
            type="button"
            @click="closeModal()"
            class="mt-6 w-full rounded-xl bg-[#d92243] px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-[#b81c38] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d92243] focus-visible:ring-offset-2"
          >
            OK
          </button>
        </div>
      </div>
    `
    document.body.appendChild(host)

    const initAlpineTree = () => {
      if (cancelled) return
      const modalRoot = host.firstElementChild
      if (window.Alpine && modalRoot) {
        window.Alpine.initTree(modalRoot)
        window.openModal = (payload) => {
          const modal =
            modalRoot.__x?.$data ??
            modalRoot._x_dataStack?.[0]
          if (typeof modal?.openModal === 'function') {
            modal.openModal(payload)
          }
        }
        if (window.__applicationFormPendingModal) {
          window.openModal(window.__applicationFormPendingModal)
          delete window.__applicationFormPendingModal
        }
        return
      }
      initTimer = window.setTimeout(initAlpineTree, 50)
    }

    initAlpineTree()

    return () => {
      cancelled = true
      if (initTimer) window.clearTimeout(initTimer)
      if (window.openModal) {
        delete window.openModal
      }
      if (window.__applicationFormPendingModal) {
        delete window.__applicationFormPendingModal
      }
      delete window.applicationFormSystemModal
      host.remove()
    }
  }, [])

  return null
}
