import copy
import json
import math
import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
import rebuild

class ModelBehaviorTests(unittest.TestCase):
    def test_pending_is_not_a_negative_label(self):
        row={'reviewClass':'original_priority_nme_bla','onTime':8,'overdue':2,'pendingWithinGoal':900,'filed':910,'receiptFiscalYear':2024}
        with_pending=rebuild.fit_action([row])['original_priority_nme_bla']
        row['pendingWithinGoal']=0;row['filed']=10
        without_pending=rebuild.fit_action([row])['original_priority_nme_bla']
        self.assertEqual(with_pending['probability'],without_pending['probability'])
        self.assertEqual(with_pending['probability'],.75)
        self.assertEqual(with_pending['resolvedOrDue'],10)

    def test_exact_binary_score_from_counts(self):
        row={'reviewClass':'original_priority_nme_bla','onTime':3,'overdue':2,'pendingWithinGoal':4}
        score=rebuild.action_metrics([row],{'original_priority_nme_bla':.7})
        observed=[1,1,1,0,0]
        self.assertEqual(score['n'],5)
        self.assertAlmostEqual(score['brier'],sum((.7-y)**2 for y in observed)/5)
        self.assertAlmostEqual(score['logLoss'],-sum(math.log(.7 if y else .3) for y in observed)/5)

    def test_pending_bounds_cover_both_outcomes(self):
        rows=[{'reviewClass':'original_priority_nme_bla','onTime':3,'overdue':2,'pendingWithinGoal':4}]
        low,high=rebuild.pending_score_bounds(rows,{'original_priority_nme_bla':.7})
        for successes in range(5):
            filled=copy.deepcopy(rows);filled[0]['onTime']+=successes;filled[0]['overdue']+=4-successes;filled[0]['pendingWithinGoal']=0
            score=rebuild.action_metrics(filled,{'original_priority_nme_bla':.7})['brier']
            self.assertLessEqual(low-1e-12,score);self.assertGreaterEqual(high+1e-12,score)

    def test_duplicate_and_impossible_counts_fail(self):
        rows=rebuild.read('action_counts.json')
        rebuild.validate_counts(rows)
        with self.assertRaises(ValueError):rebuild.validate_counts(rows+[rows[0]])
        rows=copy.deepcopy(rows);rows[0]['filed']+=1
        with self.assertRaises(ValueError):rebuild.validate_counts(rows)

    def test_frozen_sources_and_temporal_separation(self):
        artifact=rebuild.build()
        for section in ('approvalRatePrior','actionTiming'):
            train=artifact[section]['train'];test=artifact[section]['test']
            self.assertLess(max(train['receiptFiscalYears']),min(test['receiptFiscalYears']))
            self.assertLess(train['availableBy'],test['forecastCutoff'])
        self.assertEqual(artifact['approvalRatePrior']['train']['sourceVintage'],'pdufa-2019')
        self.assertEqual(artifact['approvalRatePrior']['test']['cells'],6)
        self.assertEqual(artifact['actionTiming']['test']['dueOrResolved'],603)
        self.assertEqual(artifact['actionTiming']['test']['pendingWithinGoal'],8)

    def test_individual_approval_probability_not_fabricated(self):
        artifact=rebuild.build()
        for prior in artifact['approvalRatePrior']['current'].values():
            self.assertIsNone(prior['candidateProbability'])
        self.assertNotIn('series',artifact)
        self.assertTrue(all(not r['preliminary'] for r in artifact['approvalRatePrior']['observations']))

    def test_review_histories_are_cumulative_and_sourced(self):
        data=json.loads((Path(__file__).resolve().parent/'review_histories.json').read_text())
        self.assertEqual(len(data['histories']),12)
        for history in data['histories']:
            total=0.0
            self.assertFalse(history['diseaseSimilarityAssessed'])
            page=(Path(__file__).resolve().parent.parent/history['sourceTextPath']).read_text()
            self.assertIn(history['drug'],page)
            for event in history['timeline']:
                total+=event['months']
                self.assertAlmostEqual(total,event['cumulativeMonths'],places=1)
                self.assertIn(f"{event['months']:.1f}",page)
            self.assertEqual(history['totalMonths'],history['timeline'][-1]['cumulativeMonths'])
            self.assertEqual(history['timeline'][-1]['outcome'],'AP')

    def test_artifact_precision_removes_platform_last_bit_differences(self):
        value=0.17770988771587107
        following=math.nextafter(value,math.inf)
        self.assertNotEqual(value,following)
        self.assertEqual(rebuild.canonical_artifact({'metric':value}),rebuild.canonical_artifact({'metric':following}))
        self.assertNotEqual(rebuild.canonical_artifact({'metric':value}),rebuild.canonical_artifact({'metric':value+1e-7}))
        payload={'n':603,'hash':'unchanged','probability':None,'flag':True,'negativeZero':-0.0}
        canonical=rebuild.canonical_artifact(payload)
        self.assertIs(type(canonical['n']),int)
        self.assertEqual(canonical['hash'],payload['hash'])
        self.assertIsNone(canonical['probability'])
        self.assertEqual(math.copysign(1,canonical['negativeZero']),1)

    def test_artifact_rejects_non_finite_statistics(self):
        for value in (math.inf,-math.inf,math.nan):
            with self.assertRaisesRegex(ValueError,'non-finite'):
                rebuild.canonical_artifact({'bad':value})

    def test_stale_artifact_diagnostic_identifies_actual_field(self):
        old={'evaluation':[{'brier':0.03,'n':603}]}
        new={'evaluation':[{'brier':0.04,'n':603}]}
        self.assertEqual(rebuild.first_difference(old,new),'$.evaluation[0].brier')
        self.assertIsNone(rebuild.first_difference(new,copy.deepcopy(new)))

    def test_reported_artifact_reproduces(self):
        on_disk=json.loads((Path(__file__).resolve().parent/'artifact.json').read_text())
        self.assertEqual(on_disk,rebuild.build())

if __name__=='__main__':unittest.main()
