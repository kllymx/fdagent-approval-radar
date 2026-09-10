#!/usr/bin/env python3
"""Validate evidence integrity without pretending this verifies scientific truth."""
import json
import re
import sys
from datetime import date, datetime
from pathlib import Path
from urllib.parse import urlparse

ROOT=Path(__file__).resolve().parents[2]
SOURCE_KINDS={'fda','sec','sponsor','trial','publication'}
MILESTONE_KINDS={'trial','submission','acceptance','target','extension','approval','crl','update'}
DIRECTIONS={'supportive','concern','unknown','neutral'}
CATEGORIES={'clinical','safety','manufacturing','regulatory','timing'}
STATUS={'under_review','approved','complete_response','development'}

def validate(data):
    errors=[]
    def check(ok,message):
        if not ok: errors.append(message)
    def day(value,context):
        try:
            check(bool(re.fullmatch(r'\d{4}-\d{2}-\d{2}',value)),f'{context}: must be YYYY-MM-DD')
            return date.fromisoformat(value)
        except (TypeError,ValueError): errors.append(f'{context}: invalid date'); return None
    check(data.get('schemaVersion')==1,'unsupported schemaVersion')
    as_of=day(data.get('asOf'),'asOf')
    sources=data.get('sources',[])
    check(isinstance(sources,list) and bool(sources),'sources must be nonempty list')
    source_ids=[s.get('id') for s in sources]
    check(len(set(source_ids))==len(source_ids),'duplicate source id')
    published={}
    for s in sources:
        sid=s.get('id','?')
        check(s.get('kind') in SOURCE_KINDS,f'{sid}: invalid source kind')
        u=urlparse(s.get('url',''))
        check(u.scheme=='https' and bool(u.netloc),f'{sid}: public HTTPS URL required')
        check(bool(s.get('summary')) and bool(s.get('publisher')) and bool(s.get('title')),f'{sid}: attribution and summary required')
        if s.get('publishedAt') is not None:
            d=day(s['publishedAt'],sid+' publishedAt'); published[sid]=d
            if d and as_of: check(d<=as_of,f'{sid}: source published after catalog cutoff')
        try:
            dt=datetime.fromisoformat(s['retrievedAt'].replace('Z','+00:00'))
            check(dt.tzinfo is not None,f'{sid}: retrieval timestamp must include timezone')
        except (ValueError,KeyError): errors.append(f'{sid}: invalid retrievedAt')
        # SEC exhibits and trial submissions may be third-party authored.
        if s.get('kind')!='fda':
            check(len(s.get('excerpt','').split())<=25,f'{sid}: excerpt exceeds 25 words')
            check(not s.get('fullText'),f'{sid}: non-FDA full text may only live in ignored cache')
    candidates=data.get('candidates',[])
    check(isinstance(candidates,list) and bool(candidates),'candidates must be nonempty list')
    cids=[c.get('id') for c in candidates]
    check(len(set(cids))==len(cids),'duplicate candidate id')
    for c in candidates:
        cid=c.get('id','?')
        for field in ['drug','indication','sponsor','modality','phase','reviewType','applicationType','summary']:
            check(bool(c.get(field)),f'{cid}: {field} required')
        check(c.get('status') in STATUS,f'{cid}: invalid status')
        check(c.get('asOf')==data.get('asOf'),f'{cid}: cutoff differs from catalog')
        check(all(re.fullmatch(r'NCT\d{8}',n) for n in c.get('nctIds',[])),f'{cid}: malformed NCT id')
        refs=set(c.get('sourceIds',[]))
        check(bool(refs),f'{cid}: sources required')
        check(refs.issubset(set(source_ids)),f'{cid}: unresolved source reference')
        target=c.get('targetDate')
        check(c.get('targetDateKind')==('reported' if target else 'unknown'),f'{cid}: inconsistent target kind')
        if target:
            d=day(target,cid+' targetDate')
            check(any(e.get('kind')=='target' and e.get('date')==target for e in c.get('milestones',[])),f'{cid}: no sourced milestone for target')
            if d and as_of and c.get('status')=='under_review': check(d>=as_of,f'{cid}: pending past-target episode requires review')
        entries=c.get('milestones',[])+c.get('signals',[])
        eids=[e.get('id') for e in entries]
        check(len(set(eids))==len(eids),f'{cid}: duplicate evidence item id')
        for e in entries:
            eid=e.get('id','?')
            er=set(e.get('sourceIds',[]))
            check(bool(er) and er.issubset(refs),f'{cid}/{eid}: item references not in candidate source set')
            check(bool(e.get('detail')),f'{cid}/{eid}: detail required')
        for e in c.get('milestones',[]):
            check(e.get('kind') in MILESTONE_KINDS,f'{cid}/{e.get("id")}: invalid milestone kind')
            d=day(e.get('date'),cid+' milestone')
            if d and as_of and e.get('kind')!='target':check(d<=as_of,f'{cid}: future event asserted as completed')
        for e in c.get('signals',[]):
            check(e.get('direction') in DIRECTIONS,f'{cid}: invalid signal direction')
            check(e.get('category') in CATEGORIES,f'{cid}: invalid signal category')
    check(bool(data.get('coverage',{}).get('limitations')),'coverage limitations required')
    return errors

if __name__=='__main__':
    path=Path(sys.argv[1]) if len(sys.argv)>1 else ROOT/'data/catalog.json'
    data=json.loads(path.read_text());errors=validate(data)
    if errors:
        print('\n'.join(errors));sys.exit(1)
    print(f'Validated {len(data["candidates"])} candidates, {len(data["sources"])} sources; references, dates and excerpt policy pass.')
