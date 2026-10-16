#!/usr/bin/env python3
"""Deterministic recovery of existing CAT records; never fetches or guesses answers."""
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
LEGACY = ROOT / 'data/legacy/CAT-Mock-Analysis'
CAPTURE = ROOT / 'data/legacy/supporting/cat-mock-source.json'
SECTIONS = ('VARC', 'DILR', 'QA')
NAMES = {'VARC': 'Verbal Ability & Reading Comprehension',
         'DILR': 'Data Interpretation & Logical Reasoning', 'QA': 'Quantitative Ability'}
MOCKS = [('pre1', 'presimcat-1-2026', '01-PreSimCAT-1.md'),
         ('pre2', 'presimcat-2-2026', '02-PreSimCAT-2.md'),
         ('sim2', 'simcat-2-2026', '03-SimCAT-2.md')]


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + '\n')


def rel(path):
    return path.relative_to(ROOT).as_posix()


def seconds(value):
    assert re.fullmatch(r'\d+:\d{2}', value), value
    minute, second = map(int, value.split(':'))
    assert second < 60
    return 60 * minute + second


def cells(line):
    return [x.strip() for x in line.strip().strip('|').split('|')]


def parse_markdown(path):
    text = path.read_text()
    title = text.splitlines()[0].removeprefix('# ').removesuffix(': independent analysis')
    overall = re.search(r'Overall: \*\*(\d+) marks, ([\d.]+) mock percentile\*\*', text)
    assert overall
    summary = {}
    questions = []
    blocks = []
    active = None
    for no, line in enumerate(text.splitlines(), 1):
        if line.startswith('## '):
            active = line[3:]
        if line in ('### VARC', '### DILR', '### QA') and active in ('Complete question evidence', 'VARC', 'DILR', 'QA'):
            active = line[4:]
        if not line.startswith('|'):
            continue
        c = cells(line)
        if len(c) == 8 and c[0] in SECTIONS and c[1].lstrip('-').isdigit():
            summary[c[0]] = dict(score=int(c[1]), provider_percentile=float(c[2]),
                attempted=int(c[3]), correct=int(c[4]), incorrect=int(c[5]),
                skipped=int(c[6]), accuracy_percent=float(c[7].rstrip('%')), source_line=no)
        if active == 'DILR block accounting' and len(c) == 6 and re.fullmatch(r'Q\d+-\d+', c[0]):
            start, end = map(int, c[0][1:].split('-'))
            blocks.append(dict(start=start, end=end, topic=c[1], time_seconds=seconds(c[2]),
                               score=int(c[3]), source_line=no))
        if active in SECTIONS and len(c) == 11 and c[0].isdigit():
            questions.append(dict(section=active, number=int(c[0]), area=c[1], topic=c[2],
                ims_type=c[3], outcome=c[4].lower(), marks=int(c[5]),
                time_seconds=seconds(c[6]), original_time=c[6],
                benchmark_time_seconds=seconds(c[7]), benchmark_attempt_percent=float(c[8]),
                benchmark_accuracy_percent=float(c[9]), benchmark_p_value=float(c[10]), source_line=no))
    assert len(questions) == 68, (path, len(questions))
    assert len(summary) == 3 and len(blocks) == 5
    return text, title, dict(score=int(overall[1]), provider_percentile=float(overall[2])), summary, questions, blocks


def read_provider_area(text):
    labels = {'overall': 'Overall', **NAMES}
    out = {}
    for key, label in labels.items():
        tail = text.split('\n' + label + '\n', 1)[1]
        lines = [x.strip() for x in tail.splitlines() if x.strip()]
        out[key] = dict(score=int(lines[0]), question_count=int(lines[1]), attempted=int(lines[2]),
            correct=int(lines[3]), accuracy_percent=float(lines[4]),
            time_spent_hh_mm=lines[5], marks_per_minute=float(lines[6]),
            time_per_attempted_question_mm_ss=lines[7])
    return out


def generate():
    captured = json.loads(CAPTURE.read_text())
    recovery = []
    for source_path in sorted(LEGACY.glob('*.md')) + [CAPTURE]:
        data = source_path.read_bytes()
        recovery.append(dict(path=rel(source_path), bytes=len(data), sha256=hashlib.sha256(data).hexdigest()))
    manifests = []
    for key, slug, filename in MOCKS:
        source_path = LEGACY / filename
        text, title, overall, summary, qrows, blocks = parse_markdown(source_path)
        dest = ROOT / 'data/mocks' / slug
        sources = dest / 'sources'
        sources.mkdir(parents=True, exist_ok=True)
        excerpt = {k: v for k, v in captured.items() if k.startswith(key + '_')}
        write_json(sources / 'source-extracts.json', excerpt)
        ai_text = captured[key + '_ai'][0]['data']['result']['value']
        for label, expected_score, expected_pct in [('OVERALL', overall['score'], overall['provider_percentile'])] + [
            (s, summary[s]['score'], summary[s]['provider_percentile']) for s in SECTIONS]:
            found = re.search(r'\n' + label + r'\n([\d.]+)%ile\n(\d+) marks', ai_text)
            assert found and float(found[1]) == expected_pct and int(found[2]) == expected_score
        for index, section in enumerate(SECTIONS):
            ai = captured[key + '_ai'][index]['data']['result']['value']
            (sources / ('ai-insights-' + section.lower() + '.txt')).write_text(ai)
            for offset, kind in enumerate(('selection', 'time-management', 'topics')):
                v = captured[key + '_evidence'][index*3 + offset]['data']['result']['value']
                (sources / ('evidence-' + section.lower() + '-' + kind + '.txt')).write_text(v)
        analytics = captured.get(key + '_analytics')
        provider_area = None
        if analytics:
            for entry, name in zip(analytics, ('scorecard.txt', 'area-wise.txt', 'question-wise.json', 'question-selection.txt')):
                v = entry['data']['result']['value']
                if name.endswith('.json'):
                    write_json(sources / name, json.loads(v))
                else:
                    (sources / name).write_text(v)
            provider_area = read_provider_area(analytics[1]['data']['result']['value'])
        rawrows = captured[key + '_rows']
        write_json(sources / 'question-wise-rows.json', rawrows)
        rawindex = {(x['cells'][0], int(x['cells'][1].split('.')[0])): x for x in rawrows}
        topicindex = {}
        for i, section in enumerate(SECTIONS):
            evidence = captured[key + '_evidence'][i*3+2]['data']['result']['value']
            for row in evidence.splitlines():
                c = row.split('\t')
                if c[0].isdigit():
                    topicindex[(section, int(c[0]))] = c
        attempt_id = slug + ':original'
        sets = []
        for i, block in enumerate(blocks, 1):
            sets.append(dict(id=slug + f':dilr:block-{i:02}', provider_set_id=None, section='DILR',
                question_numbers=list(range(block['start'], block['end'] + 1)), topic=block['topic'],
                grouping_basis='Adjacent question block recorded in the recovered analyst report; not a provider set ID.',
                time_seconds=block['time_seconds'], marks=block['score'],
                source=dict(path=rel(source_path), line=block['source_line'])))
        normalized = []
        for row in qrows:
            section, number = row['section'], row['number']
            qid = slug + f':original:{section.lower()}:q{number:02}'
            original = rawindex[(section, number)]
            t = topicindex[(section, number)]
            assert row['area'] == t[1] and row['topic'] == t[2] and row['ims_type'] == t[3].removeprefix('Type ')
            assert row['time_seconds'] == seconds(t[4]) == seconds(original['cells'][3])
            assert row['benchmark_time_seconds'] == seconds(t[5]) == seconds(original['cells'][4])
            assert row['outcome'] == t[7].lower() and row['marks'] == int(t[8])
            icon = original['status']
            status = 'correct' if 'tickCircle-active' in icon else 'wrong' if 'cancel-icon-rounded' in icon else 'skipped'
            assert status == row['outcome']
            for field, value in zip(('benchmark_attempt_percent', 'benchmark_accuracy_percent', 'benchmark_p_value'), original['cells'][5:8]):
                assert row[field] == float(value)
            response, answer = None, None
            if slug == 'simcat-2-2026' and section == 'QA' and number == 3:
                assert 'selected option B and correct option A' in text
                basis = 'Recovered prior analyst narrative reporting a visual observation; the underlying screenshot is not available.'
                response = dict(option_label='B', text=None, value=None, evidence_kind='prior_analysis_visual_observation', note=basis)
                answer = dict(option_label='A', text=None, value=None, evidence_kind='prior_analysis_visual_observation', note=basis)
            block = next((b for b in sets if section == 'DILR' and number in b['question_numbers']), None)
            snippet = original['cells'][1].split('\n\n', 1)[-1].strip()
            normalized.append(dict(id=qid, mock_id=slug, attempt_id=attempt_id, section=section,
                question_number=number, provider_question_id=None, set_id=block['id'] if block else None,
                area=row['area'], topic=row['topic'], provider_difficulty_type=row['ims_type'],
                question_text=None, options=None, recovered_stem_excerpt=snippet,
                question_content_status='partial_ui_excerpt_only', original_response=response,
                correct_answer=answer, outcome=row['outcome'], attempted=row['outcome'] != 'skipped',
                marks=row['marks'], time_seconds=row['time_seconds'],
                provider_benchmark=dict(time_seconds=row['benchmark_time_seconds'],
                    attempt_percent=row['benchmark_attempt_percent'], accuracy_percent=row['benchmark_accuracy_percent'],
                    p_value=row['benchmark_p_value'], p_value_unit='provider percentage-style value on a 0-100 scale; not a statistical significance p-value'),
                source=dict(markdown_path=rel(source_path), markdown_line=row['source_line'],
                    question_wise_path=rel(sources / 'question-wise-rows.json'),
                    topic_evidence_path=rel(sources / ('evidence-' + section.lower() + '-topics.txt')))))
        sections = {}
        for section in SECTIONS:
            qs = [q for q in normalized if q['section'] == section]
            counts = Counter(q['outcome'] for q in qs)
            stats = dict(question_count=len(qs), attempted=counts['correct']+counts['wrong'],
                correct=counts['correct'], incorrect=counts['wrong'], skipped=counts['skipped'],
                accuracy_percent=summary[section]['accuracy_percent'])
            assert summary[section]['attempted'] == stats['attempted']
            assert summary[section]['correct'] == stats['correct']
            assert summary[section]['incorrect'] == stats['incorrect']
            assert summary[section]['skipped'] == stats['skipped']
            assert sum(q['marks'] for q in qs) == summary[section]['score']
            if provider_area:
                for field in ('question_count', 'attempted', 'correct', 'accuracy_percent'):
                    assert provider_area[section][field] == stats[field], (slug, section, field)
                assert provider_area[section]['score'] == summary[section]['score']
            sections[section] = dict(score=summary[section]['score'],
                provider_percentile=summary[section]['provider_percentile'], statistics=stats,
                attributed_question_time_seconds=sum(q['time_seconds'] for q in qs),
                provider_area_statistics=provider_area[section] if provider_area else None,
                source=dict(markdown_path=rel(source_path), markdown_line=summary[section]['source_line']))
        total = dict(question_count=len(normalized), attempted=sum(s['statistics']['attempted'] for s in sections.values()),
            correct=sum(s['statistics']['correct'] for s in sections.values()),
            incorrect=sum(s['statistics']['incorrect'] for s in sections.values()),
            skipped=sum(s['statistics']['skipped'] for s in sections.values()))
        total['accuracy_percent'] = round(100*total['correct']/total['attempted'], 2)
        assert sum(q['marks'] for q in normalized) == overall['score'] == sum(s['score'] for s in sections.values())
        if provider_area:
            for field in ('question_count','attempted','correct','accuracy_percent'):
                assert provider_area['overall'][field] == total[field]
        predicted = re.search(r'predicted CAT percentile of ([\d.]+)', text)
        source_url = re.search(r'\[IMS detailed analytics\]\(([^)]+)\)', text)[1]
        results = dict(schema_version='1.0', mock_id=slug, name=title, provider='IMS',
            attempt=dict(id=attempt_id, kind='original', sequence=1, attempt_date=None, timezone=None,
                started_at=None, completed_at=None, provider_attempt_id=None, actual_elapsed_seconds=None,
                reviewed_on='2026-10-16', reviewed_timezone='Asia/Kolkata',
                null_explanations={'attempt_date':'The recovered reports explicitly say the attempt date is unknown; review date is not attempt date.',
                    'timezone':'Attempt timezone was not recorded.', 'started_at':'No start timestamp recovered.',
                    'completed_at':'No completion timestamp recovered.', 'provider_attempt_id':'No verified provider attempt identifier recovered; URL assessment IDs identify tests, not attempts.',
                    'actual_elapsed_seconds':'Only attributed per-question times and, for two tests, rounded provider area durations were recovered.'}),
            overall={**overall, 'statistics':total, 'attributed_question_time_seconds':sum(q['time_seconds'] for q in normalized),
                'provider_area_statistics':provider_area['overall'] if provider_area else None},
            sections=sections, provider_estimates={'predicted_cat_percentile':float(predicted[1]) if predicted else None,
                'note':'Separate IMS prediction, not the mock percentile or a validated CAT result.'},
            conditions={'exam_conditions':'Reported by user in the recovered analyst records.',
                'chronology':'Mocks spread over months; ordering by test name does not establish attempt-date order.'},
            source_urls={'detailed_analytics':source_url,'ai_insights':'https://ai-insights.beta.imsindia.com/report-v2'},
            missing_fields={'provider_area_statistics': None if provider_area else 'The original PreSimCAT 1 Scorecard/Area-Wise text captures were not retained in the recovered JSON; Markdown summary and AI evidence remain.',
                'reattempts':'No later reattempt records recovered; none were fabricated.'})
        write_json(dest/'results.json',results)
        question_doc = dict(schema_version='1.0', mock_id=slug, attempt_id=attempt_id, question_count=len(normalized),
            field_notes={'provider_question_id':'Null for every row: no reliable provider question IDs recovered; local composite IDs are section-scoped.',
                'set_id':'DILR block IDs are local analyst groupings, not provider IDs. Null elsewhere because no reliable grouping references were imported.',
                'question_text':'Null for all rows: full exact stems/passages were not recovered.',
                'options':'Null for all rows: complete answer-option text was not recovered.',
                'recovered_stem_excerpt':'Literal short UI snippet; not a full question and not a reconstructed stem.',
                'original_response':'Null unless independently retained in an opened source. A correct outcome is not used to infer an answer.',
                'correct_answer':'Null unless retained in an opened source. Only SimCAT 2 QA Q3 has option-label evidence from a prior analyst narrative, without the screenshot.',
                'time_seconds':'Non-negative integer converted from question MM:SS. Zero means zero recorded time, not proof that a question was never seen.',
                'marks':'Preserved per-question score; wrong TITA-like zero-mark responses are not assigned -1.',
                'outcome':'correct, wrong or skipped from the provider topic evidence, cross-checked with status icons.',
                'provider_difficulty_type':'Original retrospective IMS A/B/C label, not a personal-difficulty claim.'},
            questions=normalized, sets=sets)
        write_json(dest/'questions.json',question_doc)
        (dest/'analysis.md').write_text('# Recovered analysis: '+title+'\n\nThis is the existing detailed analysis, preserved below without new performance inferences. '
            'Attempt date is unavailable. References to future tests are recommendations recorded on 16 October 2026, not completed reattempts.\n\n'
            f'Canonical source: [{filename}](../../legacy/CAT-Mock-Analysis/{filename}). '
            'The byte-identical source is in the legacy directory.\n\n---\n\n'+text)
        (sources/'README.md').write_text('# Recovered source evidence\n\n'
            'All files here are derived from the saved IMS extraction JSON, not a fresh portal visit. '
            'The original complete JSON is retained byte-for-byte at `data/legacy/supporting/cat-mock-source.json`.\n\n'
            '`source-extracts.json` preserves this mock\'s original keys/values. Readable text files expose the saved AI narratives and evidence tables; '
            '`question-wise-rows.json` holds the 68 original UI rows with literal snippets and status-icon paths. '
            + ('Scorecard and Area-Wise text captures are available. The original PreSimCAT 2 Question Selection text capture has headings but empty counts; use the per-question evidence instead.\n\n' if key=='pre2' else
               'Scorecard and Area-Wise text captures are available.\n\n' if analytics else
               'A separate original Scorecard/Area-Wise text capture was not recovered for this test. Totals are supported by the opened Markdown and AI selection/topic evidence.\n\n')
            +'Full question content, original screenshots/PDF exports, handwritten working and reliable attempt dates were not recovered. '
            'AI narratives contain documented inconsistencies; use question records and source tables for arithmetic checks.\n')
        manifests.append(dict(mock_id=slug, record_count=len(normalized), sections={s:len([q for q in normalized if q['section']==s]) for s in SECTIONS},
            score=overall['score'], full_question_content_count=0,
            original_response_label_count=sum(q['original_response'] is not None for q in normalized),
            correct_answer_label_count=sum(q['correct_answer'] is not None for q in normalized)))
    write_json(ROOT/'data/recovery-manifest.json', dict(schema_version='1.0', recovered_on='2026-10-17',
        recovered_timezone='Asia/Kolkata', method='Opened existing local files; no records reconstructed from conversation memory or fresh portal retrieval.',
        markdown_files_recovered=len(list(LEGACY.glob('*.md'))), expected_previously_reported_markdown_count=7,
        markdown_count_explanation='Eight exist: seven original Markdown files plus the later 06-Weighted-Priority-Framework.md.',
        source_files=recovery, mocks=manifests, question_records_recovered=sum(x['record_count'] for x in manifests),
        reattempt_records_recovered=0, omitted_non_preparation_files=['.file-identities.json (Library transport metadata)',
            '/tmp/build_cat_analysis.py (old generation script; not independent source evidence)']))
    print(json.dumps({'markdown_files':len(list(LEGACY.glob('*.md'))),'question_records':sum(x['record_count'] for x in manifests),'mocks':manifests},indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--from-recovered-legacy', action='store_true', required=True,
                        help='Explicitly regenerate only this legacy import; not a future-analysis command.')
    parser.parse_args()
    generate()
