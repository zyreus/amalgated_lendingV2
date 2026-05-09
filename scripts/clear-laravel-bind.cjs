/** Removes stale dev port files so wait scripts do not trust a previous run. */
const { clearBindPort, clearActivePort, clearStartStatus } = require('./laravel-active-port.cjs')
const { clearActivePort: clearChatActivePort } = require('./chat-active-port.cjs')
clearBindPort()
clearActivePort()
clearStartStatus()
clearChatActivePort()
