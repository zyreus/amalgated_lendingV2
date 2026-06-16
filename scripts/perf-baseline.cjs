#!/usr/bin/env node
/* eslint-disable no-console */
const { performance } = require('node:perf_hooks');

const targets = [
  process.env.PERF_URL_HEALTH || 'http://127.0.0.1:8000/api/v1/health',
  process.env.PERF_URL_CHAT_HEALTH || 'http://127.0.0.1:8010/health',
];
const runs = Number(process.env.PERF_RUNS || 20);

async function timeRequest(url) {
  const started = performance.now();
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  await res.text();
  return { ms: performance.now() - started, status: res.status };
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx];
}

async function benchmark(url) {
  const latencies = [];
  const statuses = {};
  for (let i = 0; i < runs; i += 1) {
    const result = await timeRequest(url);
    latencies.push(result.ms);
    statuses[result.status] = (statuses[result.status] || 0) + 1;
  }
  const avg = latencies.reduce((sum, value) => sum + value, 0) / Math.max(latencies.length, 1);
  return {
    url,
    runs,
    avgMs: Number(avg.toFixed(2)),
    p50Ms: Number(percentile(latencies, 50).toFixed(2)),
    p95Ms: Number(percentile(latencies, 95).toFixed(2)),
    minMs: Number(Math.min(...latencies).toFixed(2)),
    maxMs: Number(Math.max(...latencies).toFixed(2)),
    statuses,
  };
}

(async () => {
  const report = [];
  for (const target of targets) {
    report.push(await benchmark(target));
  }
  console.log(JSON.stringify({ generatedAt: new Date().toISOString(), report }, null, 2));
})();

