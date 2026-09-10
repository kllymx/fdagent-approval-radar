import copy
import json
import unittest
from pathlib import Path
from validate_catalog import validate

CATALOG=json.loads((Path(__file__).resolve().parents[2]/'data/catalog.json').read_text())
class EvidenceIntegrity(unittest.TestCase):
    def test_curated_catalog(self): self.assertEqual(validate(CATALOG),[])
    def test_broken_reference_rejected(self):
        d=copy.deepcopy(CATALOG);d['candidates'][0]['signals'][0]['sourceIds']=['not-real']
        self.assertTrue(any('references not in candidate' in e for e in validate(d)))
    def test_future_source_rejected(self):
        d=copy.deepcopy(CATALOG);d['sources'][0]['publishedAt']='2026-09-11'
        self.assertTrue(any('after catalog cutoff' in e for e in validate(d)))
    def test_future_claim_not_target_rejected(self):
        d=copy.deepcopy(CATALOG);d['candidates'][0]['milestones'][0]['date']='2026-12-31'
        self.assertTrue(any('future event asserted' in e for e in validate(d)))
    def test_full_non_government_text_rejected(self):
        d=copy.deepcopy(CATALOG);d['sources'][0]['fullText']='uncurated text'
        self.assertTrue(any('full text' in e for e in validate(d)))
    def test_stale_pending_target_rejected(self):
        d=copy.deepcopy(CATALOG);d['candidates'][0]['targetDate']='2026-01-01'
        self.assertTrue(any('past-target' in e for e in validate(d)))
    def test_target_is_not_invented(self):
        d=copy.deepcopy(CATALOG);d['candidates'][0]['targetDate']='2026-12-28'
        self.assertTrue(any('no sourced milestone' in e for e in validate(d)))
    def test_excerpt_limit(self):
        d=copy.deepcopy(CATALOG);d['sources'][0]['excerpt']=' '.join(['word']*26)
        self.assertTrue(any('exceeds 25' in e for e in validate(d)))

if __name__=='__main__': unittest.main()
