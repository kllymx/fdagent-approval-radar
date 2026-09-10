import { ExternalLink } from 'lucide-react';
import { getSourceReviewNotes } from '../shared/review-notes';
import { safeSourceUrl } from './lib';

export default function SourceReviewNotes({ runId }: { runId: string }) {
  const notes = getSourceReviewNotes(runId);
  if (!notes.length) return null;
  return <aside className="source-review-notes" aria-label="Editorial source review"><h2>Source review note</h2><p className="source-review-basis">Editorial check · Astra’s output is unchanged.</p>{notes.map((note) => <article key={note.title}><h3>{note.title}</h3><p>{note.detail}</p>{safeSourceUrl(note.sourceUrl) && <a className="text-link" href={safeSourceUrl(note.sourceUrl)} target="_blank" rel="noreferrer">{note.sourceLabel}<ExternalLink size={12} /></a>}</article>)}</aside>;
}
