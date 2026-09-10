#!/usr/bin/env python3
"""Download pinned FDA sources and verify transcriptions against extracted text.

Requires Poppler's pdftotext. Rebuilding the model itself needs only Python stdlib.
First-cycle charts are manually checked against page renders; this check confirms
all values occur in the stated chart, while the pinned source hash prevents drift.
"""
import argparse
import hashlib
import json
import re
import shutil
import subprocess
import urllib.request
from pathlib import Path

ROOT=Path(__file__).resolve().parent
CACHE=ROOT.parent/'research/model/.cache'

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--download',action='store_true');args=parser.parse_args()
    if not shutil.which('pdftotext'):raise SystemExit('Install Poppler (pdftotext) for source verification.')
    CACHE.mkdir(parents=True,exist_ok=True)
    reports=json.loads((ROOT/'sources/reports.json').read_text())
    text={};manifest=[]
    for report in reports:
        path=CACHE/f"{report['id']}.pdf"
        if not path.exists():
            if not args.download:raise SystemExit(f'Missing {path}; use --download')
            req=urllib.request.Request(report['url'],headers={'User-Agent':'FDAgentApprovalRadar/0.1 public source verification'})
            with urllib.request.urlopen(req,timeout=60) as r:path.write_bytes(r.read())
        digest=hashlib.sha256(path.read_bytes()).hexdigest()
        if digest!=report['sha256']:raise SystemExit(f"Source changed: {report['id']}. Review and repin; do not silently accept.")
        output=path.with_suffix('.verify.txt')
        subprocess.run(['pdftotext','-layout',str(path),str(output)],check=True)
        raw_output=path.with_suffix('.raw.verify.txt')
        subprocess.run(['pdftotext','-raw',str(path),str(raw_output)],check=True)
        text[report['id']]=output.read_text()
        text[report['id']+'-raw']=raw_output.read_text()
        manifest.append({'id':report['id'],'sha256Verified':True})
    counts=json.loads((ROOT/'sources/action_counts.json').read_text())
    for row in counts:
        # These are exact table numerators and binary denominators, not rounded percentages.
        pattern=rf"\b{row['onTime']}\s+of\s+{row['onTime']+row['overdue']}\s+on\s+time\b"
        if not any(re.search(pattern,text[row['sourceId']+suffix],re.I) for suffix in ('','-raw')):
            raise SystemExit(f"Cannot verify action summary count: {row}")
    rates=json.loads((ROOT/'sources/approval_rates.json').read_text())
    for row in rates:
        pages=text[row['sourceId']].split('\f')
        page=pages[row['pdfPage']-1]
        if not re.search(rf"\b{row['firstCycleApprovalPercent']}%",page):
            raise SystemExit(f"Cannot verify rate appears on chart page: {row}")
    print(json.dumps({'sources':len(manifest),'exactActionCellsVerified':len(counts),'chartValuesLocated':len(rates),'note':'Chart year/class positions require manual visual verification; counts must also be reviewed against the named detailed table. Presence alone is not semantic validation.'},indent=2))

if __name__=='__main__':main()
