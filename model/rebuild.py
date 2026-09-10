#!/usr/bin/env python3
"""Reproduce public FDA cohort baselines with Python's standard library.

No API keys, LLM calls, invented outcomes, or external Python packages are used.
Approval graph percentages are modeled as rates, never expanded into drug labels.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import math
import random
import statistics
from pathlib import Path

ROOT = Path(__file__).resolve().parent
FLOAT_DECIMAL_PLACES = 12

def canonical_artifact(value):
    """Round only final numeric outputs, below the precision of reported estimates.

    Platform libm implementations can differ in the last binary digit. Twelve
    decimal places preserve meaningful model changes while making JSON portable.
    Source hashes, integer counts, strings, and nulls are unchanged.
    """
    if isinstance(value, float):
        if not math.isfinite(value):
            raise ValueError('Model artifact contains a non-finite number.')
        rounded = round(value, FLOAT_DECIMAL_PLACES)
        return 0.0 if rounded == 0 else rounded
    if isinstance(value, dict):
        return {key: canonical_artifact(item) for key, item in value.items()}
    if isinstance(value, list):
        return [canonical_artifact(item) for item in value]
    return value

def first_difference(actual, expected, path='$'):
    """Name a stale field without printing source contents or the full artifact."""
    if type(actual) is not type(expected):
        return path + ' (type differs)'
    if isinstance(actual, dict):
        if actual.keys() != expected.keys():
            return path + ' (keys differ)'
        for key in expected:
            difference = first_difference(actual[key], expected[key], path + '.' + key)
            if difference:
                return difference
    elif isinstance(actual, list):
        if len(actual) != len(expected):
            return path + ' (length differs)'
        for index, (left, right) in enumerate(zip(actual, expected)):
            difference = first_difference(left, right, path + '[' + str(index) + ']')
            if difference:
                return difference
    elif actual != expected:
        return path
    return None
CLASSES = {
    'original_priority_nme_bla': ('Original priority NME NDAs / BLAs', 6, 'filing date after the 60-day filing period'),
    'original_standard_nme_bla': ('Original standard NME NDAs / BLAs', 10, 'filing date after the 60-day filing period'),
    'original_priority_non_nme': ('Original priority non-NME NDAs', 6, 'receipt date'),
    'original_standard_non_nme': ('Original standard non-NME NDAs', 10, 'receipt date'),
    'resubmission_class_1': ('Class 1 original application resubmissions', 2, 'resubmission receipt date'),
    'resubmission_class_2': ('Class 2 original application resubmissions', 6, 'resubmission receipt date'),
}

def read(name):
    return json.loads((ROOT / 'sources' / name).read_text())

def validate_counts(rows):
    seen = set()
    for row in rows:
        key = row['receiptFiscalYear'], row['reviewClass']
        if key in seen:
            raise ValueError(f'duplicate action cell: {key}')
        seen.add(key)
        if row['reviewClass'] not in CLASSES:
            raise ValueError(f'unknown review class: {key}')
        for field in ('filed', 'onTime', 'overdue', 'pendingWithinGoal'):
            if type(row[field]) is not int or row[field] < 0:
                raise ValueError(f'invalid count: {field} {key}')
        if row['filed'] != row['onTime'] + row['overdue'] + row['pendingWithinGoal']:
            raise ValueError(f'count identity violated: {key}')

def validate_rates(rows):
    seen=set()
    for row in rows:
        key=(row['sourceId'], row['receiptFiscalYear'], row['reviewClass'])
        if key in seen: raise ValueError(f'duplicate approval rate {key}')
        seen.add(key)
        if not 0 <= row['firstCycleApprovalPercent'] <= 100: raise ValueError('invalid approval rate')
        if row['reviewClass'] not in ('priority','standard'): raise ValueError('invalid rate class')

def wilson(success, total, z=1.96):
    if not total: return [0.0,1.0]
    p=success/total
    d=1+z*z/total
    centre=(p+z*z/(2*total))/d
    radius=z*math.sqrt(p*(1-p)/total+z*z/(4*total*total))/d
    return [max(0,centre-radius),min(1,centre+radius)]

def fit_action(rows, stratified=True):
    """Beta(1,1) binomial posterior mean; pending statuses excluded."""
    result={}
    for cl in CLASSES:
        selected=[r for r in rows if not stratified or r['reviewClass']==cl]
        on=sum(r['onTime'] for r in selected)
        late=sum(r['overdue'] for r in selected)
        pending=sum(r['pendingWithinGoal'] for r in selected)
        result[cl]={
            'probability':(on+1)/(on+late+2),
            'onTime':on,'overdue':late,'pendingWithinGoal':pending,
            'resolvedOrDue':on+late,
            'wilson95':wilson(on,on+late),
            'pendingOutcomeSensitivity':[(on+1)/(on+late+pending+2),(on+pending+1)/(on+late+pending+2)],
        }
    return result

def action_metrics(rows, probabilities):
    """Exact individual binary proper scores from sufficient aggregate counts."""
    n=success=0
    brier=logloss=expected=0.0
    for r in rows:
        p=probabilities[r['reviewClass']]
        if not 0<p<1: raise ValueError('proper scores need interior probability')
        on,late=r['onTime'],r['overdue']; n+=on+late;success+=on
        brier += on*(1-p)**2+late*p**2
        logloss -= on*math.log(p)+late*math.log(1-p)
        expected+=(on+late)*p
    return {'n':n,'brier':brier/n,'logLoss':logloss/n,'meanPrediction':expected/n,'observedOnTimeRate':success/n,'calibrationError':abs(expected-success)/n}

def pending_score_bounds(rows, probabilities):
    base=action_metrics(rows,probabilities)
    pending=sum(r['pendingWithinGoal'] for r in rows)
    low=high=base['brier']*base['n']
    for r in rows:
        p=probabilities[r['reviewClass']]
        scores=[p*p,(1-p)**2]
        low+=r['pendingWithinGoal']*min(scores)
        high+=r['pendingWithinGoal']*max(scores)
    return [low/(base['n']+pending),high/(base['n']+pending)]

def rate_predictions(rows, stratified=True):
    return {cl:statistics.mean(r['firstCycleApprovalPercent']/100 for r in rows if not stratified or r['reviewClass']==cl) for cl in ('priority','standard')}

def rate_metrics(rows,predictions):
    errors=[predictions[r['reviewClass']]-r['firstCycleApprovalPercent']/100 for r in rows]
    mae=statistics.mean(abs(e) for e in errors)
    return {'cells':len(rows),'maePercentagePoints':mae*100,'rmsePercentagePoints':math.sqrt(statistics.mean(e*e for e in errors))*100,'maxErrorPercentagePoints':max(abs(e) for e in errors)*100,'roundingOnlyMaeBoundsPercentagePoints':[max(0,mae*100-1),mae*100+1]}

def block_bootstrap_action(rows, samples=2000):
    rng=random.Random(20260910)
    years=sorted({r['receiptFiscalYear'] for r in rows})
    byyear={y:[r for r in rows if r['receiptFiscalYear']==y] for y in years}
    values={cl:[] for cl in CLASSES}
    for _ in range(samples):
        resample=[r for y in rng.choices(years,k=len(years)) for r in byyear[y]]
        fit=fit_action(resample)
        for cl in CLASSES: values[cl].append(fit[cl]['probability'])
    return {cl:quantile_range(v) for cl,v in values.items()}

def quantile_range(values):
    values=sorted(values)
    return [values[int(.025*(len(values)-1))],values[int(.975*(len(values)-1))]]

def block_bootstrap_rates(rows, samples=2000):
    rng=random.Random(20260910)
    years=sorted({r['receiptFiscalYear'] for r in rows})
    byyear={y:[r for r in rows if r['receiptFiscalYear']==y] for y in years}
    values={cl:[] for cl in ('priority','standard')}
    for _ in range(samples):
        resample=[r for y in rng.choices(years,k=len(years)) for r in byyear[y]]
        fit=rate_predictions(resample)
        for cl in values:values[cl].append(fit[cl])
    return {cl:quantile_range(v) for cl,v in values.items()}

def build():
    counts,rates,reports=read('action_counts.json'),read('approval_rates.json'),read('reports.json')
    validate_counts(counts);validate_rates(rates)
    # Frozen report vintage; calendar gap means no test-receipt cohorts contribute.
    approval_train=[r for r in rates if r['sourceId']=='pdufa-2019' and 2013<=r['receiptFiscalYear']<=2017 and not r['preliminary']]
    approval_test=[r for r in rates if r['sourceId']=='pdufa-2025' and 2021<=r['receiptFiscalYear']<=2023 and not r['preliminary']]
    approval_current=[r for r in rates if r['sourceId']=='pdufa-2025' and 2017<=r['receiptFiscalYear']<=2023 and not r['preliminary']]
    action_train=[r for r in counts if 2017<=r['receiptFiscalYear']<=2019]
    action_test=[r for r in counts if 2022<=r['receiptFiscalYear']<=2024]
    assert max(r['receiptFiscalYear'] for r in action_train)<min(r['receiptFiscalYear'] for r in action_test)
    action_fits={'class_beta_binomial':fit_action(action_train),'pooled_beta_binomial':fit_action(action_train,False)}
    action_probs={name:{cl:v['probability'] for cl,v in fit.items()} for name,fit in action_fits.items()}
    action_probs['policy_90_percent']={cl:.90 for cl in CLASSES}
    action_scores={name:action_metrics(action_test,p) for name,p in action_probs.items()}
    approval_models={'class_mean':rate_predictions(approval_train),'pooled_mean':rate_predictions(approval_train,False)}
    approval_scores={name:rate_metrics(approval_test,p) for name,p in approval_models.items()}
    latest_action=fit_action(counts); action_uncertainty=block_bootstrap_action(counts)
    for cl,row in latest_action.items():
        row.update({'label':CLASSES[cl][0],'nominalGoalMonths':CLASSES[cl][1],'clockOrigin':CLASSES[cl][2], 'fiscalYearBootstrapMean95':action_uncertainty[cl], 'predictionUnit':'cohort action timeliness; not approval'})
    latest_rate=rate_predictions(approval_current); rate_uncertainty=block_bootstrap_rates(approval_current)
    latest_rate={cl:{'meanRate':p,'fiscalYearBootstrapMean95':rate_uncertainty[cl],'annualObservedRange':[min(r['firstCycleApprovalPercent']/100 for r in approval_current if r['reviewClass']==cl),max(r['firstCycleApprovalPercent']/100 for r in approval_current if r['reviewClass']==cl)],'annualCohortCount':len(approval_current)//2,'candidateProbability':None} for cl,p in latest_rate.items()}
    availability=[
      {'id':'pdufa-2019-availability','sourceUrl':'https://jamanetwork.com/journals/jamainternalmedicine/fullarticle/2775955','availableBy':'2020-09-26','scope':'Chahal et al., JAMA Internal Medicine (2021), reference16 cites the exact FDA FY2019 report URL with a September26,2020 reference-access date. The current PDF metadata is May22,2020. This supports availability before the October1,2020 holdout start, but does not independently archive the exact historical bytes.'},
      {'id':'pdufa-2020-availability','sourceUrl':'https://www.fda.gov/about-fda/fda-track-agency-wide-program-performance/fda-track-newsletter-september-23-2021','availableBy':'2021-09-23','scope':'FDA newsletter says preliminary FY2020 user-fee performance data available. Together with FY2020 report PDF metadata dated August2021, supports report-era availability before FY2022. Exact byte-version historical publication not archived.'},
    ]
    limitations=[
      'This is a statistical public-cohort baseline, not a validated probability that a particular drug will be approved.',
      'Approval-rate evaluation has only six held-out year-by-review-class cells across three fiscal years; these are rounded annual rates, not individual drug outcomes.',
      'Original applications mix novel and non-novel NDA products with BLAs. First-cycle rates are not valid resubmission, biosimilar, generic, supplement, or early-development approval probabilities.',
      'Action-timeliness predicts FDA action by the applicable goal, which can include approval, complete response, tentative approval or withdrawal. It does not predict approval.',
      'Actions still pending within goal are excluded from binary scoring and retained as unresolved counts; overdue pending actions already have a known missed-goal outcome.',
      'Historical sources are report vintages, with a primary research reference-access date and FDA newsletters supporting report-era availability. Exact historical PDF byte-version upload dates are not independently archived.',
      'Aggregate data cannot group repeated applications by drug, sponsor or facility. Action proper scores are exact from counts, but independence assumptions and individual discrimination are not established.',
      'An extension can change the applicable PDUFA goal. Historical goal performance does not measure adherence to an originally announced, unextended date.',
      'Intervals reflect sampling and year-to-year variation within this limited cohort; they do not cover all shifts in policy, case mix, source revisions or candidate-specific uncertainty.',
      'No monthly approval CDF or survival curve is inferred from median review durations, and no CRL eventual approval_status field is used as a predictive feature or terminal label.',
    ]
    result = {
      'schemaVersion':1,'status':'evaluated','generatedAt':'2026-09-10','modelVersion':'public-cohort-baselines-v1',
      'serialization':{'floatDecimalPlaces':FLOAT_DECIMAL_PLACES,'maximumAbsoluteRoundingError':'5e-13','scope':'Final float outputs only; source hashes, integer counts and model calculations are unchanged.'},
      'title':'FDA public-cohort baselines',
      'summary':'Reproducible class-level first-cycle rate forecasts and separately scored action-timing baselines. Individual approval probabilities remain unestimated.',
      'cohortSize':sum(r['onTime']+r['overdue'] for r in counts),
      'cohortSizeUnit':'original and resubmission action records with known goal outcome, FY2017–2024; aggregate counts, not deduplicated drugs',
      'metrics':[{'label':'Approval-rate MAE','value':f"{approval_scores['class_mean']['maePercentagePoints']:.1f} pp",'detail':'Six held-out annual review-class rates, FY2021–2023. Not individual drug prediction accuracy.'},{'label':'Action timing Brier','value':f"{action_scores['class_beta_binomial']['brier']:.4f}",'detail':f"Exact score over {action_scores['class_beta_binomial']['n']} due/resolved action outcomes, FY2022–2024; lower is better."},{'label':'Pending held out','value':str(sum(r['pendingWithinGoal'] for r in action_test)),'detail':'Kept unresolved; never counted as unsuccessful approvals.'}],
      'approvalRatePrior':{
        'target':'FDA-reported annual first-cycle approval percentage by original-application review priority',
        'unit':'annual review-class cohort','method':'Unweighted least-squares class intercept (class-specific mean); equal weight per fiscal year.',
        'selectionRule':'Five complete older receipt cohorts in frozen FY2019 report; later FY2021–2023 held out; current reference refit on FY2017–2023.',
        'train':{'receiptFiscalYears':[2013,2014,2015,2016,2017],'cells':len(approval_train),'sourceVintage':'pdufa-2019','availableBy':'2020-09-26'},
        'test':{'receiptFiscalYears':[2021,2022,2023],'cells':len(approval_test),'forecastCutoff':'2020-09-30','labelSourceVintage':'pdufa-2025'},
        'fittedBeforeHoldout':approval_models,'evaluation':approval_scores,'current':latest_rate,
        'observations':approval_current,'heldOutPredictions':[{**r,'prediction':approval_models['class_mean'][r['reviewClass']],'pooledPrediction':approval_models['pooled_mean'][r['reviewClass']]} for r in approval_test],
        'interpretation':'The mean is a historical cohort reference; candidateProbability is null. It is not a calibrated individualized likelihood.',
      },
      'actionTiming':{
        'target':'FDA action completed by its applicable PDUFA goal among cases with observable timely/overdue status',
        'method':'Beta(1,1) prior plus exact on-time and overdue counts, conditioned on six review classes.',
        'train':{'receiptFiscalYears':[2017,2018,2019],'sourceVintages':['pdufa-2018','pdufa-2019','pdufa-2020'],'availableBy':'2021-09-23','dueOrResolved':sum(r['onTime']+r['overdue'] for r in action_train),'pendingWithinGoal':sum(r['pendingWithinGoal'] for r in action_train)},
        'test':{'receiptFiscalYears':[2022,2023,2024],'forecastCutoff':'2021-09-30','sourceVintages':['pdufa-2023','pdufa-2024','pdufa-2025'],'dueOrResolved':sum(r['onTime']+r['overdue'] for r in action_test),'pendingWithinGoal':sum(r['pendingWithinGoal'] for r in action_test)},
        'fittedBeforeHoldout':action_fits,'evaluation':action_scores,
        'pendingOutcomeBrierBounds':{name:pending_score_bounds(action_test,p) for name,p in action_probs.items()},
        'current':latest_action,
        'heldOutPredictions':[{**r,'prediction':action_probs['class_beta_binomial'][r['reviewClass']]} for r in action_test],
        'censoring':'Pending within goal excluded; scoring bounds also show either eventual timing outcome for unresolved statuses. No terminal drug failure label exists.',
      },
      'limitations':limitations,'sources':reports,'availabilityEvidence':availability,
      'sourceDataSha256':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted((ROOT/'sources').glob('*.json'))},
      'reproduce':'python3 model/rebuild.py && python3 -m unittest discover -s model -p "test_*.py"',
    }
    return canonical_artifact(result)

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--check',action='store_true');args=parser.parse_args()
    result=build(); serialized=json.dumps(result,indent=2,ensure_ascii=False)+'\n'; path=ROOT/'artifact.json'
    if args.check:
        if path.read_text()!=serialized:
            try:
                mismatch=first_difference(json.loads(path.read_text()),result) or '$ (JSON formatting differs)'
            except json.JSONDecodeError:
                mismatch='$ (invalid JSON)'
            raise SystemExit(f'artifact.json is stale at {mismatch}; run python3 model/rebuild.py')
        print('artifact.json is reproducible and current')
    else:path.write_text(serialized);print(json.dumps({'artifact':str(path),'metrics':result['metrics']},indent=2))

if __name__=='__main__':main()
