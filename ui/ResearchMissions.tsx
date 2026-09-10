import { ArrowRight, FileSearch } from 'lucide-react';
import type { Dashboard } from './types';

// Editorial entry points to the exact recorded investigations cited here.
const missions = [
  { candidateId: 'apitegromab-sma', runId: 'fd8efe13-d17e-47d4-8245-867f37157055', question: 'Does a clean clinical inspection resolve the manufacturing risk?', method: 'Facility identity · FDA inspection scope · Supplier history', finding: 'Astra separated clinical oversight from manufacturing clearance. A reported BIMO inspection did not establish product-specific manufacturing acceptance.' },
  { candidateId: 'satralizumab-ted', runId: '88baf4b3-0ec3-4dd4-b344-34a8b1e170ab', question: 'Can positive secondary results outweigh a failed primary endpoint?', method: 'Two trial registries · Primary publication · Testing hierarchy', finding: 'Astra found that failed primary testing stopped confirmatory secondary testing. The trial discrepancy remained unexplained.' },
  { candidateId: 'zanzalintinib-mcrc', runId: '0f625d8d-f1fc-430c-9388-0919fa463813', question: 'Which statistical plan governs the survival claim?', method: 'Original study design · Later results · Registry endpoints', finding: 'Astra found conflicting descriptions of the testing hierarchy. It could not verify the operative amended analysis plan, leaving a specific question for diligence.' },
];

export default function ResearchMissions({ dashboard, onOpen }: { dashboard: Dashboard; onOpen: (candidateId: string, runId: string) => void }) {
  const available = missions.flatMap((mission) => {
    const candidate = dashboard.catalog.candidates.find((item) => item.id === mission.candidateId);
    const run = dashboard.investigations.find((item) => item.id === mission.runId && item.provenance === 'recorded');
    return candidate && run ? [{ ...mission, drug: candidate.drug }] : [];
  });
  if (!available.length) return null;
  return <section className="research-missions" aria-labelledby="research-missions-title"><div className="mission-heading"><h2 id="research-missions-title">Recorded Astra investigations</h2><p>Open a real case to inspect the sources, follow the research trail and challenge the conclusion.</p></div><div className="mission-grid">{available.map((mission) => <button className="research-mission" key={mission.runId} onClick={() => onOpen(mission.candidateId, mission.runId)}><span className="mission-drug"><FileSearch size={13} />{mission.drug}</span><h3>{mission.question}</h3><span className="mission-method">{mission.method}</span><p>{mission.finding}</p><span className="mission-open">Follow the investigation<ArrowRight size={13} /></span></button>)}</div></section>;
}
