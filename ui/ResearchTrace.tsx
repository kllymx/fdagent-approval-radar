import { ChevronDown, ChevronRight, ListChecks } from 'lucide-react';
import type { Investigation } from './types';

export default function ResearchTrace({ tools, onSources }: { tools: NonNullable<Investigation['tools']>; onSources: (ids: string[]) => void }) {
  if (!tools.length) return null;
  const labels = { completed: 'Completed', partial: 'Partial result', error: 'Request failed' };
  return <details className="research-trace disclosure"><summary><ListChecks size={15} /><span>Research trail</span><span className="trace-call-count">{tools.length} tool calls</span><ChevronDown size={14} /></summary><p className="trace-note">Actual tool executions from this run. Partial and failed requests remain visible.</p><ol>{tools.map((tool, index) => <li key={`${index}-${tool.name}`}><span className="trace-number">{index + 1}</span><div className="trace-call"><div><code>{tool.name}</code><span className={`trace-status ${tool.status}`}>{labels[tool.status]}</span><span className="trace-duration">{tool.durationMs < 1000 ? `${tool.durationMs} ms` : `${(tool.durationMs / 1000).toFixed(1)} s`}</span></div>{Object.keys(tool.arguments).length > 0 && <details><summary>Request details<ChevronRight size={11} /></summary><dl>{Object.entries(tool.arguments).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{key === 'sourceId' && typeof value === 'string' ? <button className="text-button" onClick={() => onSources([value])}>{value}<ChevronRight size={11} /></button> : typeof value === 'string' ? value : JSON.stringify(value)}</dd></div>)}</dl></details>}</div></li>)}</ol></details>;
}
