/**
 * proxy-server.js
 * ───────────────
 * Local development proxy — forwards /api/anthropic/* requests to
 * api.anthropic.com, injecting the API key from .env so it never
 * reaches the browser bundle.
 *
 * Run:  node proxy-server.js
 * Port: 3001  (Vite dev server proxies /api → here automatically)
 */

require('dotenv').config()
const express = require('express')
const cors = require('cors')
const { createProxyMiddleware } = require('http-proxy-middleware')

const app = express()
const PORT = 3001

// ── Validate API key at startup
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('\n❌  ANTHROPIC_API_KEY is not set.')
  console.error('    Create a .env file in the project root:\n')
  console.error('    ANTHROPIC_API_KEY=sk-ant-your-key-here\n')
  process.exit(1)
}

// ── CORS — allow requests from Vite dev server
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))

// ── Health check
app.get('/health', (_, res) => res.json({ ok: true }))

// ── Proxy /api/anthropic → https://api.anthropic.com
app.use('/api/anthropic', createProxyMiddleware({
  target: 'https://api.anthropic.com',
  changeOrigin: true,
  secure: true,
  pathRewrite: { '^/api/anthropic': '' },
  on: {
    proxyReq: (proxyReq) => {
      proxyReq.setHeader('x-api-key', process.env.ANTHROPIC_API_KEY)
      proxyReq.setHeader('anthropic-version', '2023-06-01')
    },
    error: (err, req, res) => {
      console.error('[proxy error]', err.message)
      res.status(502).json({ error: 'Proxy error', detail: err.message })
    },
  },
}))

app.listen(PORT, () => {
  console.log(`\n✅  Proxy running  →  http://localhost:${PORT}`)
  console.log(`    API key         →  ${process.env.ANTHROPIC_API_KEY.slice(0, 14)}…\n`)
})
