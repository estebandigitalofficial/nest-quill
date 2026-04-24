'use client'

import { useState } from 'react'

interface Explanation {
  summary: string
  analogy: string
  key_points: string[]
  fun_fact: string
  try_this: string
}

export default function ConceptExplainer() {
  const [topic, setTopic] = useState('')
  const [grade, setGrade] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Explanation | null>(null)

  async function handleExplain() {
    if (!topic.trim()) { setError('Enter a topic first.'); return }
    setError(null); setLoading(true); setResult(null)

    const res = await fetch('/api/learning/explain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic: topic.trim(), grade: grade ?? undefined }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.message); return }
    setResult(data)
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-6 space-y-5">
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-gray-700">What should we explain?</label>
          <input type="text" placeholder='e.g. "How does photosynthesis work?" or "What is democracy?"'
            value={topic} onChange={e => setTopic(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleExplain()}
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent" />
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-gray-700">Grade <span className="text-gray-400 font-normal">(optional — helps tune the explanation)</span></label>
          <div className="flex flex-wrap gap-2">
            {[1,2,3,4,5,6,7,8].map(g => (
              <button key={g} type="button" onClick={() => setGrade(grade === g ? null : g)}
                className={`w-10 h-10 rounded-xl border-2 text-sm font-semibold transition-all ${grade === g ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'}`}>{g}</button>
            ))}
          </div>
        </div>
        {error && <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-3">{error}</p>}
        <button onClick={handleExplain} disabled={!topic.trim() || loading}
          className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold text-base transition-colors">
          {loading ? 'Explaining…' : 'Explain It →'}
        </button>
      </div>

      {loading && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-8 py-10 text-center space-y-3">
          <div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-500">Building your explanation…</p>
        </div>
      )}

      {result && (
        <div className="space-y-3">
          {/* Summary */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-5 space-y-2">
            <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest">The Simple Version</p>
            <p className="text-base text-gray-800 leading-relaxed">{result.summary}</p>
          </div>

          {/* Analogy */}
          <div className="bg-indigo-50 border border-indigo-100 rounded-2xl px-6 py-5 space-y-2">
            <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest">Think of it like this…</p>
            <p className="text-sm text-indigo-800 leading-relaxed italic">{result.analogy}</p>
          </div>

          {/* Key points */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-5 space-y-3">
            <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest">Key Points</p>
            <ul className="space-y-2">
              {result.key_points.map((pt, i) => (
                <li key={i} className="flex gap-3 text-sm text-gray-700">
                  <span className="text-indigo-400 font-bold shrink-0 mt-0.5">{i + 1}.</span>
                  {pt}
                </li>
              ))}
            </ul>
          </div>

          {/* Fun fact */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl px-6 py-5 space-y-2">
            <p className="text-xs font-bold text-yellow-600 uppercase tracking-widest">Fun Fact ⚡</p>
            <p className="text-sm text-gray-700 leading-relaxed">{result.fun_fact}</p>
          </div>

          {/* Try this */}
          <div className="bg-green-50 border border-green-200 rounded-2xl px-6 py-5 space-y-2">
            <p className="text-xs font-bold text-green-600 uppercase tracking-widest">Try This at Home 🧪</p>
            <p className="text-sm text-gray-700 leading-relaxed">{result.try_this}</p>
          </div>

          <button onClick={() => { setResult(null); setTopic(''); setGrade(null) }}
            className="w-full py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-500 hover:bg-gray-50 transition-colors">
            Explain Something Else
          </button>
        </div>
      )}
    </div>
  )
}
