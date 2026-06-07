/**
 * proxy-server.js
 * ───────────────
 * Local dev proxy — forwards /api/groq to Groq API,
 * injecting GROQ_API_KEY from .env so it never reaches the browser.
 *
 * Run alongside Vite:  node proxy-server.js
 * Port: 3001  (vite.config.js already proxies /api → here)
 *
 * Production: Vercel edge function (api/groq.js) handles this automatically.
 */

require('dotenv').config()
const express = require('express')
const cors = require('cors')

const app = express()
const PORT = 3001

if (!process.env.GROQ_API_KEY) {
  console.error('\n❌  GROQ_API_KEY is not set.')
  console.error('    Add to your .env:\n\n    GROQ_API_KEY=gsk_your-key-here\n')
  process.exit(1)
}

app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:3000'] }))
app.use(express.text({ type: '*/*', limit: '1mb' }))

app.get('/health', (_, res) => res.json({ ok: true }))

app.post('/api/groq', async (req, res) => {
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: req.body,
    })
    const data = await response.text()
    res.status(response.status).set('Content-Type', 'application/json').send(data)
  } catch (err) {
    console.error('[proxy error]', err.message)
    res.status(502).json({ error: 'Proxy error', detail: err.message })
  }
})

app.listen(PORT, () => {
  console.log(`\n✅  Groq proxy  →  http://localhost:${PORT}/api/groq`)
  console.log(`    API key     →  ${process.env.GROQ_API_KEY.slice(0, 14)}…\n`)
})
