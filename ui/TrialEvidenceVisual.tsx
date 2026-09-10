import { BookOpen, ChevronDown, ChevronRight } from 'lucide-react';
import type { TrialVisual } from './types';

export function trialAxis(values: number[], unit: string): { min: number; max: number; ticks: number[] } {
  const finite = values.filter(Number.isFinite);
  if (unit === '%' && finite.every((value) => value >= 0 && value <= 100)) return { min: 0, max: 100, ticks: [0, 25, 50, 75, 100] };
  const lower = Math.min(0, ...finite);
  const upper = Math.max(0, ...finite);
  const rawStep = (upper - lower || 1) / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const fraction = rawStep / magnitude;
  const step = (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10) * magnitude;
  const min = Math.floor(lower / step) * step;
  const max = Math.ceil(upper / step) * step || (min === 0 ? 1 : 0);
  const ticks = Array.from({ length: Math.round((max - min) / step) + 1 }, (_, index) => Number((min + index * step).toPrecision(12)));
  return { min, max, ticks };
}

export function trialBar(value: number, axis: { min: number; max: number }): { start: number; width: number; zero: number } {
  const range = axis.max - axis.min || 1;
  const zero = axis.min === 0 ? 0 : -axis.min / range * 100;
  const end = (value - axis.min) / range * 100;
  return { start: Math.min(zero, end), width: Math.abs(end - zero), zero };
}

function number(value: number): string { return new Intl.NumberFormat('en-US', { maximumFractionDigits: 5 }).format(value).replace('-', '−'); }
function valueLabel(value: number, unit: string): string { return `${number(value)}${unit === '%' ? '%' : unit ? ` ${unit}` : ''}`; }

function TrialChart({ visual, onSources }: { visual: TrialVisual; onSources: (ids: string[]) => void }) {
  const axis = trialAxis(visual.arms.map((arm) => arm.value), visual.unit);
  return <article className="trial-visual" aria-labelledby={`trial-title-${visual.id}`}>
    <div className="trial-visual-heading"><div><span className="trial-study">{visual.study}</span><h3 id={`trial-title-${visual.id}`}>{visual.title}</h3></div><span className="trial-direction">{visual.direction === 'higher' ? 'Higher is better' : 'Lower is better'}</span></div>
    <p className="trial-context">{visual.population}<span aria-hidden="true"> · </span>{visual.timepoint}</p>
    <div className="trial-chart" role="img" aria-label={`${visual.study}. ${visual.endpoint}. ${visual.comparisonLabel}. ${visual.arms.map((arm) => `${arm.label}: ${valueLabel(arm.value, visual.unit)}${arm.n !== undefined ? `, n=${arm.n}` : ''}`).join('; ')}. ${visual.direction === 'higher' ? 'Higher' : 'Lower'} is better.`}>
      <div className="trial-measure">{visual.comparisonLabel}<span>{visual.unit}</span></div>
      {visual.arms.map((arm, index) => {
        const bar = trialBar(arm.value, axis);
        return <div className="trial-arm" key={`${visual.id}-${index}`}><div className="trial-arm-label"><span>{arm.label}</span>{arm.n !== undefined && <small>{arm.numerator !== undefined ? `${arm.numerator.toLocaleString()} / ${arm.n.toLocaleString()}` : `n = ${arm.n.toLocaleString()}`}</small>}</div><div className="trial-bar-track"><i className="trial-zero" style={{ left: `${bar.zero}%` }} /><span className={`trial-bar arm-${index % 3}`} style={{ left: `${bar.start}%`, width: `${bar.width}%` }} /></div><strong className="trial-arm-value">{valueLabel(arm.value, visual.unit)}</strong></div>;
      })}
      {visual.arms.length > 0 && <div className="trial-axis-row"><span /><div className="trial-axis">{axis.ticks.map((tick) => <span key={tick} style={{ left: `${(tick - axis.min) / (axis.max - axis.min) * 100}%` }}>{number(tick)}</span>)}</div><span /></div>}
    </div>
    {visual.effect && <div className="trial-effect"><span>{visual.effect.label}</span><strong>{valueLabel(visual.effect.value, visual.effect.unit ?? '')}</strong>{visual.effect.lower !== undefined && visual.effect.upper !== undefined && <span>{visual.effect.level ? `${visual.effect.level} ` : 'Interval '}{number(visual.effect.lower)}–{number(visual.effect.upper)}</span>}</div>}
    <p className="trial-interpretation">{visual.interpretation}</p>
    <div className="trial-footer"><details><summary>Endpoint and limitations<ChevronDown size={12} /></summary><div><p><strong>Endpoint:</strong> {visual.endpoint}</p><p>{visual.sourceNote}</p>{visual.limitations.length > 0 && <ul>{visual.limitations.map((limitation, index) => <li key={`${index}-${limitation}`}>{limitation}</li>)}</ul>}</div></details>{visual.sourceIds.length > 0 && <button className="text-button" onClick={() => onSources(visual.sourceIds)}><BookOpen size={12} />Sources<ChevronRight size={12} /></button>}</div>
  </article>;
}

export default function TrialEvidenceVisual({ visuals, onSources }: { visuals: TrialVisual[]; onSources: (ids: string[]) => void }) {
  if (!visuals.length) return null;
  return <section className="trial-evidence" aria-label="Clinical trial evidence"><div className="trial-evidence-heading"><h2>Clinical results</h2><p>Reported trial endpoints · Not approval probabilities</p></div><div className={`trial-visual-grid ${visuals.length === 1 ? 'single' : ''}`}>{visuals.slice(0, 2).map((visual) => <TrialChart key={visual.id} visual={visual} onSources={onSources} />)}</div></section>;
}
