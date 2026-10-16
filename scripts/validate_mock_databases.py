#!/usr/bin/env python3
"""Check SQLite exports against their historical and newly opened evidence."""
import hashlib
import json
from pathlib import Path
import sqlite3

ROOT = Path(__file__).resolve().parents[1]


def validate():
    manifest = json.loads((ROOT/'data/database-source-manifest.json').read_text())
    assert manifest['full_question_records'] == len(manifest['sources'])
    for source in manifest['sources']:
        raw = (ROOT/source['path']).read_bytes()
        assert len(raw) == source['bytes']
        assert hashlib.sha256(raw).hexdigest() == source['sha256']
    reports = []
    all_ids = set()
    for path in sorted((ROOT/'data/mocks').glob('*/*.db')):
        con = sqlite3.connect(f'file:{path}?mode=ro', uri=True)
        con.row_factory = sqlite3.Row
        assert con.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
        assert not con.execute('PRAGMA foreign_key_check').fetchall()
        original = json.loads((path.parent/'questions.json').read_text())
        result = json.loads((path.parent/'results.json').read_text())
        rows = list(con.execute('SELECT * FROM questions ORDER BY section,question_number'))
        assert len(rows) == len(original['questions']) == 68
        originals = {q['id']: q for q in original['questions']}
        complete = 0
        for row in rows:
            q = originals[row['question_id']]
            assert row['question_id'] not in all_ids
            all_ids.add(row['question_id'])
            for field in ('section','question_number','time_seconds','outcome','marks','provider_difficulty_type'):
                assert row[field] == q[field]
            assert row['sectional_area'] == q['area'] and row['sectional_topic'] == q['topic']
            assert json.loads(row['historical_record_json']) == q
            options = list(con.execute('SELECT * FROM options WHERE question_id=? ORDER BY position', (row['question_id'],)))
            if row['content_status'] == 'full_text_and_html_recovered':
                complete += 1
                capture = json.loads((ROOT/row['answer_evidence']).read_text())
                assert row['question_text'] == capture['question_text']
                assert row['question_html'] == capture['question_html']
                assert len(options) == len(capture['options']) == 4
                for opt, source in zip(options, capture['options']):
                    for field in ('text','html','label'):
                        assert opt[field] == source[field]
                    assert opt['is_selected'] == int(source['selected'])
                    assert opt['is_correct'] == int(source['correct'])
                selected = [o for o in options if o['is_selected']]
                correct = [o for o in options if o['is_correct']]
                assert len(selected) == len(correct) == 1
                assert row['original_response_option_label'] == selected[0]['label']
                assert row['correct_response_option_label'] == correct[0]['label']
                assert row['question_type'] == 'MCQ'
                if row['stimulus_id']:
                    stimulus = con.execute('SELECT * FROM stimuli WHERE stimulus_id=?', (row['stimulus_id'],)).fetchone()
                    assert stimulus['text'] == capture['instructions_text']
                    assert stimulus['html'] == capture['instructions_html']
            else:
                assert not options and row['question_type'] is None
                assert row['question_text'] is None and row['question_html'] is None
                assert json.loads(row['missing_fields_json'])['options']
        for section, sr in result['sections'].items():
            items = [r for r in rows if r['section'] == section]
            assert sum(r['marks'] for r in items) == sr['score']
            assert sum(r['time_seconds'] for r in items) == sr['attributed_question_time_seconds']
            for outcome, field in [('correct','correct'),('wrong','incorrect'),('skipped','skipped')]:
                assert sum(r['outcome'] == outcome for r in items) == sr['statistics'][field]
        assert sum(r['marks'] for r in rows) == result['overall']['score']
        for capture in con.execute('SELECT * FROM source_captures'):
            raw = (ROOT/capture['relative_path']).read_bytes()
            assert raw == capture['content']
            assert hashlib.sha256(raw).hexdigest() == capture['sha256']
        reports.append(dict(mock_id=path.parent.name, database=str(path.relative_to(ROOT)),
            sha256=hashlib.sha256(path.read_bytes()).hexdigest(), bytes=path.stat().st_size,
            records=len(rows), records_with_sectional_topic=sum(bool(r['sectional_topic']) for r in rows),
            records_with_difficulty_type=sum(bool(r['provider_difficulty_type']) for r in rows),
            full_question_records=complete, missing_full_question_records=68-complete,
            response_formats_recovered=sum(r['question_type'] is not None for r in rows),
            answer_label_pairs=sum(r['correct_response_option_label'] is not None and r['original_response_option_label'] is not None for r in rows),
            option_records=con.execute('SELECT count(*) FROM options').fetchone()[0],
            shared_stimuli=con.execute('SELECT count(*) FROM stimuli').fetchone()[0],
            source_captures=con.execute('SELECT count(*) FROM source_captures').fetchone()[0],
            sqlite_integrity='ok', foreign_key_errors=0))
        con.close()
    assert len(reports) == 3 and len(all_ids) == 204
    report = dict(schema_version='1.0',status='passed',
        extraction_status='partial; browser connection unavailable',
        question_records=204, full_question_records=sum(r['full_question_records'] for r in reports),
        duplicate_question_ids=0, mocks=reports,
        checks=['SQLite integrity and foreign keys', '204 unique IDs and historical source agreement',
                'All sectional and overall scores, outcomes and attributed time sums',
                'Every full question, option, selection, key and passage against opened capture',
                'Every embedded source checked byte-for-byte and by SHA-256'],
        gaps=['199 full question texts and option sets unavailable.',
              'MCQ/TITA format unavailable for 199 questions; A/B/C labels available for all 204.',
              'Six answer label pairs available: five fresh captures and one prior narrative-only pair.',
              'Exact attempt dates and additional subtopic fields unavailable.'])
    (ROOT/'data/database-validation-report.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report,indent=2))
    return report


if __name__ == '__main__':
    validate()
