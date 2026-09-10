import { useState } from 'react';
import brandCatalog from '../data/brands.json';
import { safeSourceUrl } from './lib';

type Company = typeof brandCatalog.companies[number];
function CompanyMark({ company, compact }: { company: Company; compact: boolean }) {
  const [failed, setFailed] = useState(false);
  const asset = compact ? company.iconPath : company.assetPath;
  const symbol = (company as Company & { displayKind?: string }).displayKind === 'symbol';
  const initials = company.name.split(/\s+/).map((word) => word[0]).slice(0, 2).join('');
  // Bound intrinsic assets even before the application stylesheet has loaded.
  const imageWidth = compact ? 18 : symbol ? 26 : 110;
  const imageHeight = compact ? 18 : 26;
  return <span className={`company-mark ${compact ? 'compact' : 'wordmark'} ${symbol ? 'symbol' : ''} ${company.background}`} title={company.name}>
    {asset && !failed ? <img src={`${import.meta.env.BASE_URL}${asset}`} alt={compact || symbol ? '' : company.name} width={imageWidth} height={imageHeight} style={{ maxWidth: imageWidth, maxHeight: imageHeight, objectFit: 'contain' }} onError={() => setFailed(true)} loading="lazy" /> : <span className="company-fallback" aria-label={company.name}>{compact || symbol ? initials : company.name}</span>}
  </span>;
}

export default function CompanyLogos({ candidateId, compact = false, allSponsors = false }: { candidateId: string; compact?: boolean; allSponsors?: boolean }) {
  const ids = (brandCatalog.candidateCompanies as Record<string, string[]>)[candidateId] ?? [];
  const companies = ids.map((id) => brandCatalog.companies.find((company) => company.id === id)).filter((company): company is Company => Boolean(company));
  return <div className={`company-logos ${compact ? 'compact' : ''}`} aria-label={compact ? undefined : 'Sponsor companies'}>{(compact && !allSponsors ? companies.slice(0, 1) : companies).map((company) => compact ? <CompanyMark company={company} compact key={company.id} /> : <a href={safeSourceUrl(company.website)} target="_blank" rel="noreferrer" key={company.id} aria-label={company.name}><CompanyMark company={company} compact={false} />{(company as Company & { displayKind?: string }).displayKind === 'symbol' && <span className="company-name">{company.name}</span>}</a>)}</div>;
}

