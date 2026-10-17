#!/usr/bin/env python3
"""Validate evolving uploaded SQLite tables without rebuilding original attempts."""
import gzip
import hashlib
import json
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def validate():
    manifest_path = ROOT / 'data/uploaded-databases-manifest.json'
    if not manifest_path.exists():
        from validate_mock_databases_legacy import validate as legacy_validate
        return legacy_validate()
    reports = []
    ids = set()
    for path in sorted((ROOT / 'data/mocks').glob('*/*.db')):
        con = sqlite3.connect(f'file:{path}?mode=ro', uri=True)
        con.row_factory = sqlite3.Row
        assert con.execute('pragma integrity_check').fetchone()[0] == 'ok'
        assert not con.execute('pragma foreign_key_check').fetchall()
        old = json.loads((path.parent / 'questions.json').read_text())
        original = {q['id']: q for q in old['questions']}
        rows = list(con.execute('select * from question_details'))
        assert len(rows) == len(original)
        for row in rows:
            assert row['question_id'] not in ids
            ids.add(row['question_id'])
            q = original[row['question_id']]
            for field in ['section', 'question_number', 'outcome', 'marks', 'time_seconds', 'provider_difficulty_type']:
                assert row[field] == q[field], (path.name, q['id'], field, row[field], q[field])
            assert row['sectional_topic'] == q['topic']
            assert row['sectional_area'] == q['area']
            opts = json.loads(row['options_json'] or '[]')
            assert len({o['label'] for o in opts}) == len(opts)
            if row['correct_response_option_label'] is not None:
                assert row['correct_response_option_label'] in [o['label'] for o in opts]
        for source in con.execute('select * from source_captures'):
            data = source['content']
            if source['compression'] == 'gzip':
                data = gzip.decompress(data)
            else:
                assert source['compression'] in (None, 'none', '')
            assert len(data) == source['raw_bytes']
            assert hashlib.sha256(data).hexdigest() == source['sha256']
        for media in con.execute('select * from media'):
            assert hashlib.sha256(media['content']).hexdigest() == media['sha256']
        reports.append({
            'mock_id': path.parent.name, 'database': str(path.relative_to(ROOT)),
            'bytes': path.stat().st_size, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
            'performance_records': len(rows),
            'available_question_views': sum(bool(r['display_html'] or r['question_html'] or r['question_text']) for r in rows),
            'nonempty_plain_question_text': sum(bool(r['question_text']) for r in rows),
            'answer_values': sum(r['correct_response'] is not None for r in rows),
            'solution_views': sum(bool(r['solution_display_html'] or r['solution_html'] or r['solution_text']) for r in rows),
            'sqlite_integrity': 'ok', 'foreign_key_errors': 0,
        })
        con.close()
    report = {'schema_version': '1.1', 'status': 'passed', 'question_records': len(ids),
              'available_question_views': sum(r['available_question_views'] for r in reports),
              'completeness': 'User says extraction is still being updated. View availability is not independent certification of complete content.',
              'checks': ['SQLite integrity and foreign keys', 'Original IDs, section/topic, marks, outcomes and timings unchanged',
                         'Unique option labels and valid MCQ keys', 'Embedded source gzip bytes and SHA-256', 'Embedded media SHA-256'],
              'mocks': reports}
    (ROOT / 'data/database-validation-report.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))
    return report


if __name__ == '__main__':
    validate()
