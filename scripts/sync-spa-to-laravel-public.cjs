/**
 * After `npm run build`, copies Vite output into Laravel `public/` so
 * `/assets/*.js` resolves when the document root is amalgated-lending-api/public.
 */
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const distDir = path.join(root, 'dist')
const publicDir = path.join(root, 'amalgated-lending-api', 'public')

if (!fs.existsSync(distDir)) {
  console.error('[sync-spa] dist/ not found. Run: npm run build')
  process.exit(1)
}

const assetsSrc = path.join(distDir, 'assets')
const assetsDest = path.join(publicDir, 'assets')
if (fs.existsSync(assetsSrc)) {
  fs.mkdirSync(publicDir, { recursive: true })
  fs.cpSync(assetsSrc, assetsDest, { recursive: true })
}

const indexSrc = path.join(distDir, 'index.html')
const indexDest = path.join(publicDir, 'index.html')
if (fs.existsSync(indexSrc)) {
  fs.mkdirSync(publicDir, { recursive: true })
  fs.copyFileSync(indexSrc, indexDest)
}

for (const name of fs.readdirSync(distDir)) {
  const src = path.join(distDir, name)
  if (!fs.statSync(src).isFile() || name === 'index.html') continue
  fs.copyFileSync(src, path.join(publicDir, name))
}

const publicExtras = ['service-worker.js', 'offline.html']
for (const name of publicExtras) {
  const src = path.join(root, 'frontend', 'public', name)
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(publicDir, name))
  }
}

const mailLogoSrc = path.join(root, 'frontend', 'src', 'assets', 'amalgated-lending-logo.png')
const mailLogoDest = path.join(publicDir, 'amalgated-lending-logo.png')
if (fs.existsSync(mailLogoSrc)) {
  fs.mkdirSync(publicDir, { recursive: true })
  fs.copyFileSync(mailLogoSrc, mailLogoDest)
}

console.log('[sync-spa] Copied dist/ -> amalgated-lending-api/public/ (assets + index.html)')
