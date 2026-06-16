#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Lightweight load test (ab/wrk substitute on Windows).
 * Example: npm run octane:benchmark
 */
const { performance } = require('node:perf_hooks')
const { getOctanePort } = require('./laravel-dev-port.cjs')
const { readBindPort } = require('./laravel-active-port.cjs')

const port = process.env.PERF_PORT || readBindPort() || getOctanePort()
const url = process.env.PERF_URL || `http://127.0.0.1:${port}/test`
const total = Number(process.env.PERF_REQUESTS || 200)
const concurrency = Number(process.env.PERF_CONCURRENCY || 20)
const timeoutMs = Number(process.env.PERF_TIMEOUT_MS || 5000)

async function fetchOnce(target) {
  const started = performance.now()
  const res = await fetch(target, { signal: AbortSignal.timeout(timeoutMs) })
  await res.text()
  return { ms: performance.now() - started, status: res.status }
}

async function runBatch(target, count) {
  const results = await Promise.all(
    Array.from({ length: count }, () => fetchOnce(target)),
  )
  return results
}

function percentile(values, p) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)
  return sorted[idx]
}

async function main() {
  const started = performance.now()
  const latencies = []
  const statuses = {}
  let completed = 0

  while (completed < total) {
    const batchSize = Math.min(concurrency, total - completed)
    const batch = await runBatch(url, batchSize)
    for (const row of batch) {
      latencies.push(row.ms)
      statuses[row.status] = (statuses[row.status] || 0) + 1
    }
    completed += batchSize
  }

  const elapsedSec = (performance.now() - started) / 1000
  const rps = Number((total / elapsedSec).toFixed(2))
  const avg = latencies.reduce((sum, value) => sum + value, 0) / latencies.length

  const report = {
    generatedAt: new Date().toISOString(),
    url,
    requests: total,
    concurrency,
    durationSec: Number(elapsedSec.toFixed(3)),
    requestsPerSec: rps,
    avgMs: Number(avg.toFixed(2)),
    p50Ms: Number(percentile(latencies, 50).toFixed(2)),
    p95Ms: Number(percentile(latencies, 95).toFixed(2)),
    minMs: Number(Math.min(...latencies).toFixed(2)),
    maxMs: Number(Math.max(...latencies).toFixed(2)),
    statuses,
  }

  console.log(JSON.stringify(report, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
