import { useState } from 'react'
import { useMatchHistory, useRanking } from '../data/queries'

function Pager({ page, total, pageSize, onChange }: { page: number; total: number; pageSize: number; onChange: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  return <div className="pager"><button type="button" className="button button-secondary" disabled={page === 1} onClick={() => onChange(page - 1)}>Previous</button><span>Page {page} of {pages}</span><button type="button" className="button button-secondary" disabled={page === pages} onClick={() => onChange(page + 1)}>Next</button></div>
}

export function RankingPanel() {
  const [page, setPage] = useState(1)
  const query = useRanking(page)
  if (query.isLoading) return <p className="panel-message">Loading ranking…</p>
  if (query.isError) return <div className="panel-message"><p>Could not load ranking.</p><button className="button button-secondary" type="button" onClick={() => void query.refetch()}>Try again</button></div>
  if (!query.data?.items.length) return <p className="panel-message">No completed battles yet.</p>
  return <section className="data-panel" aria-label="Ranking"><h2>Ranking</h2><ol>{query.data.items.map((entry, index) => <li key={entry.id}><span>#{(page - 1) * query.data.pageSize + index + 1} {entry.playerName}</span><strong>{entry.score}</strong></li>)}</ol><Pager page={page} total={query.data.total} pageSize={query.data.pageSize} onChange={setPage} /></section>
}

export function MatchHistoryPanel() {
  const [page, setPage] = useState(1)
  const query = useMatchHistory(page)
  if (query.isLoading) return <p className="panel-message">Loading match history…</p>
  if (query.isError) return <div className="panel-message"><p>Could not load match history.</p><button className="button button-secondary" type="button" onClick={() => void query.refetch()}>Try again</button></div>
  if (!query.data?.items.length) return <p className="panel-message">Your completed battles will appear here.</p>
  return <section className="data-panel" aria-label="Match history"><h2>Match History</h2><ol>{query.data.items.map((match) => <li key={match.id}><span>{match.score} points · {match.durationSeconds}s · {match.endReason}</span><time dateTime={match.completedAt}>{new Date(match.completedAt).toLocaleDateString()}</time></li>)}</ol><Pager page={page} total={query.data.total} pageSize={query.data.pageSize} onChange={setPage} /></section>
}
