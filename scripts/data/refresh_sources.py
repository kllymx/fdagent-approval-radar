#!/usr/bin/env python3
"""Fetch public sources and report transport/content changes; never auto-overwrite reviewed claims.

Usage: python3 scripts/data/refresh_sources.py [--candidate relutrigine-dee] [--workers 4]
Uses only Python stdlib and public HTTPS URLs from the reviewed catalog. Raw pages stay
in ignored data/.cache/. The public report has hashes/status/metadata only. A 200 response
or matching excerpt is not evidence of accuracy or current FDA status.
"""
import argparse
import concurrent.futures
from datetime import datetime, timezone
import hashlib
import html
import json
from pathlib import Path
import re
import socket
import shutil
import subprocess
import urllib.request
import urllib.error

ROOT=Path(__file__).resolve().parents[2]
MAX_BYTES=8*1024*1024

def now(): return datetime.now(timezone.utc).isoformat().replace('+00:00','Z')
def clean_html(text):
    text=re.sub(r'<(script|style)\b[^>]*>.*?</\1>',' ',text,flags=re.S|re.I)
    return ' '.join(html.unescape(re.sub(r'<[^>]+>',' ',text)).split())
def trial_extract(data):
    p=data['protocolSection'];s=p['statusModule'];z=p['designModule']
    return dict(nctId=p['identificationModule']['nctId'],lastUpdatePosted=s.get('lastUpdatePostDateStruct'),enrollment=z.get('enrollmentInfo'),phases=z.get('phases'),allocation=z.get('designInfo',{}).get('allocation'),masking=z.get('designInfo',{}).get('maskingInfo',{}).get('masking'),primaryCompletion=s.get('primaryCompletionDateStruct'),hasResults=data.get('hasResults'),primaryOutcomeCount=len(p.get('outcomesModule',{}).get('primaryOutcomes',[])))

def fetch(source,cache,prior):
    started=now();url=source['url']
    if source['kind']=='trial':url='https://clinicaltrials.gov/api/v2/studies/'+url.rstrip('/').split('/')[-1]
    result=dict(sourceId=source['id'],url=url,retrievedAt=started,ok=False)
    try:
        request=urllib.request.Request(url,headers={'User-Agent':'FDAgent-Approval-Radar public-source-validation/1.0','Accept':'application/json,text/html,application/pdf;q=0.9,*/*;q=0.8'})
        with urllib.request.urlopen(request,timeout=25) as response:
            raw=response.read(MAX_BYTES+1)
            if len(raw)>MAX_BYTES:raise ValueError('source exceeds 8 MiB limit')
            content_type=response.headers.get('Content-Type','')
            result.update(ok=True,httpStatus=response.status,finalUrl=response.url,contentType=content_type,bytes=len(raw),sha256=hashlib.sha256(raw).hexdigest())
        cache.mkdir(parents=True,exist_ok=True)
        (cache/(source['id']+'.bin')).write_bytes(raw)
        result['changedSincePreviousFetch']=prior.get(source['id'],{}).get('sha256') not in (None,result['sha256'])
        if source['kind']=='trial':
            parsed=json.loads(raw);result['trial']=trial_extract(parsed)
            result['registryDateDiffersFromCatalog']=result['trial']['lastUpdatePosted']['date']!=source.get('publishedAt')
        elif 'html' in content_type or 'text/' in content_type:
            text=clean_html(raw.decode('utf-8',errors='replace'))
            result['looksLikeAccessChallenge']=bool(re.search(r'access denied|verify you are human|request has been identified as part of a network',text[:600],re.I))
            if source.get('excerpt'):
                result['excerptPresent']=' '.join(source['excerpt'].split()).lower() in text.lower()
        else:result['textChecks']='not attempted for binary content'
        result['method']='direct_https'
    except (urllib.error.URLError,TimeoutError,socket.timeout,ValueError,KeyError) as exc:
        result.update(error=str(exc)[:250],ok=False)
    return result

def firecrawl_retry(source,cache,failed):
    """Optional authenticated CLI extraction. Raw markdown remains ignored."""
    target=cache/(source['id']+'.md')
    target.parent.mkdir(parents=True,exist_ok=True)
    try:
        completed=subprocess.run(['firecrawl','scrape',source['url'],'-o',str(target)],capture_output=True,text=True,timeout=40)
        if completed.returncode or not target.exists():
            return dict(failed,fallbackError='Firecrawl CLI failed; inspect locally without publishing its raw output')
        raw=target.read_bytes();text=raw.decode('utf-8',errors='replace')
        return dict(sourceId=source['id'],url=source['url'],retrievedAt=now(),ok=True,method='firecrawl_cli',directError=failed.get('error'),bytes=len(raw),sha256=hashlib.sha256(raw).hexdigest(),looksLikeAccessChallenge=bool(re.search(r'access denied|verify you are human',text[:600],re.I)),excerptPresent=(' '.join(source.get('excerpt','').split()).lower() in ' '.join(text.split()).lower()) if source.get('excerpt') else None)
    except (OSError,subprocess.TimeoutExpired):
        return dict(failed,fallbackError='Firecrawl CLI unavailable or timed out')

if __name__=='__main__':
    ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--candidate');ap.add_argument('--workers',type=int,default=4);ap.add_argument('--firecrawl',action='store_true',help='Optionally use installed/authenticated Firecrawl CLI for blocked sources');ap.add_argument('--retry-failed',action='store_true',help='Retry failures from the previous report using Firecrawl; keep previous successes');args=ap.parse_args()
    catalog=json.loads((ROOT/'data/catalog.json').read_text());selected=catalog['sources']
    if args.candidate:
        c=next((c for c in catalog['candidates'] if c['id']==args.candidate),None)
        if not c:ap.error('candidate not found')
        selected=[s for s in selected if s['id'] in c['sourceIds']]
    path=ROOT/'data/source-health.json';prior={}
    if path.exists():prior={s['sourceId']:s for s in json.loads(path.read_text()).get('sources',[])}
    if args.firecrawl and not shutil.which('firecrawl'):ap.error('--firecrawl requires installed/authenticated Firecrawl CLI')
    if args.retry_failed and not args.firecrawl:ap.error('--retry-failed requires --firecrawl')
    def run(source):
        previous=prior.get(source['id'])
        if args.retry_failed and previous and previous.get('ok'):return previous
        result=previous if args.retry_failed and previous else fetch(source,ROOT/'data/.cache',prior)
        if args.firecrawl and not result.get('ok'):return firecrawl_retry(source,ROOT/'data/.cache',result)
        return result
    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1,min(args.workers,6))) as pool:
        rows=list(pool.map(run,selected))
    report=dict(generatedAt=now(),catalogAsOf=catalog['asOf'],scope=args.candidate or 'all',meaning='Transport/hash checks only. Does not certify scientific accuracy or pending FDA status. A separate human/agent review is required to update catalog claims.',sources=rows)
    path.write_text(json.dumps(report,indent=2)+'\n')
    ok=sum(r['ok'] for r in rows)
    print(f'Fetched {ok}/{len(rows)} sources. Report: {path}')
    for row in rows:
        if not row['ok']:print(row['sourceId']+': '+row['error'])
