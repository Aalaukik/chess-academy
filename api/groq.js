/**
 * api/groq.js — Vercel Edge Function
 * Proxies requests to Groq. Set GROQ_API_KEY in Vercel env vars (no VITE_ prefix).
 */
export const config = { runtime: 'edge' }

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Groq API key not configured' }), { status: 500 })
  }

  try {
    const body = await req.text()
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body,
    })
    const data = await response.text()
    return new Response(data, {
      status: response.status,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Proxy error', detail: err.message }), { status: 502 })
  }
}
