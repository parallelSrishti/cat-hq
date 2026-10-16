#!/usr/bin/env python3
"""Validate recovered preparation records against retained, opened source evidence."""
from collections import Counter
import hashlib
import json
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]


def unique_object(pairs):
    out = {}
    for key, value in pairs:
        if key in out:
            raise ValueError('Duplicate JSON object key: ' + key)
        out[key] = value
    return out


def read(path):
    return json.loads(path.read_text(), object_pairs_hook=unique_object,
                      parse_constant=lambda x: (_ for _ in ()).throw(ValueError('Non-finite JSON: '+x)))


def sec(value):
    a,b = map(int,value.split(':'))
    assert 0 <= b < 60
    return a*60+b


def validate():
    json_files = sorted((ROOT/'data').rglob('*.json'))
    for path in json_files:
        read(path)
    manifest = read(ROOT/'data/recovery-manifest.json')
    for source in manifest['source_files']:
        raw = (ROOT/source['path']).read_bytes()
        assert len(raw) == source['bytes'], source['path']
        assert hashlib.sha256(raw).hexdigest() == source['sha256'], source['path']
    legacy = ROOT/'data/legacy/CAT-Mock-Analysis'
    assert len(list(legacy.glob('*.md'))) == manifest['markdown_files_recovered'] == 8
    capture = read(ROOT/'data/legacy/supporting/cat-mock-source.json')
    keys = {'presimcat-1-2026':'pre1','presimcat-2-2026':'pre2','simcat-2-2026':'sim2'}
    global_ids = set()
    global_set_ids = set()
    reports = []
    for directory in sorted((ROOT/'data/mocks').iterdir()):
        if not directory.is_dir():
            continue
        result = read(directory/'results.json')
        doc = read(directory/'questions.json')
        slug = directory.name
        assert result['mock_id'] == doc['mock_id'] == slug
        assert result['attempt']['id'] == doc['attempt_id'] == slug+':original'
        assert result['attempt']['kind'] == 'original'
        assert result['attempt']['attempt_date'] is None
        for field in ('attempt_date','timezone','started_at','completed_at','provider_attempt_id','actual_elapsed_seconds'):
            assert result['attempt'][field] is None
            assert result['attempt']['null_explanations'][field]
        assert (directory/'analysis.md').is_file() and (directory/'sources/README.md').is_file()
        key = keys[slug]
        extracted = read(directory/'sources/source-extracts.json')
        assert extracted == {k:v for k,v in capture.items() if k.startswith(key+'_')}
        rawrows = read(directory/'sources/question-wise-rows.json')
        assert rawrows == capture[key+'_rows']
        rawindex = {(r['cells'][0],int(r['cells'][1].split('.')[0])):r for r in rawrows}
        assert len(rawindex) == 68
        qs = doc['questions']
        assert len(qs) == doc['question_count'] == 68
        assert len(doc['sets']) == 5
        set_index = {s['id']:s for s in doc['sets']}
        assert len(set_index) == len(doc['sets'])
        for s in doc['sets']:
            assert s['id'] not in global_set_ids
            global_set_ids.add(s['id'])
            assert s['provider_set_id'] is None
        for q in qs:
            assert q['id'] not in global_ids, q['id']
            global_ids.add(q['id'])
            assert q['id'] == f"{slug}:original:{q['section'].lower()}:q{q['question_number']:02}"
            assert q['mock_id'] == slug and q['attempt_id'] == doc['attempt_id']
            assert q['outcome'] in ('correct','wrong','skipped')
            assert q['attempted'] == (q['outcome'] != 'skipped')
            assert isinstance(q['time_seconds'],int) and q['time_seconds'] >= 0
            assert q['question_text'] is None and q['options'] is None and q['provider_question_id'] is None
            assert q['question_content_status'] == 'partial_ui_excerpt_only'
            if q['outcome']=='correct':
                assert q['marks']==3
            elif q['outcome']=='wrong':
                assert q['marks'] in (-1,0)
            else:
                assert q['marks']==0
            sourcepath = ROOT/q['source']['markdown_path']
            lines = sourcepath.read_text().splitlines()
            line = lines[q['source']['markdown_line']-1]
            c = [x.strip() for x in line.strip().strip('|').split('|')]
            assert len(c)==11 and int(c[0])==q['question_number']
            assert c[1:4] == [q['area'],q['topic'],q['provider_difficulty_type']]
            assert c[4].lower()==q['outcome'] and int(c[5])==q['marks'] and sec(c[6])==q['time_seconds']
            benchmark=q['provider_benchmark']
            assert sec(c[7])==benchmark['time_seconds']
            assert list(map(float,c[8:]))==[benchmark['attempt_percent'],benchmark['accuracy_percent'],benchmark['p_value']]
            raw=rawindex[(q['section'],q['question_number'])]
            assert sec(raw['cells'][3])==q['time_seconds'] and sec(raw['cells'][4])==benchmark['time_seconds']
            assert raw['cells'][1].split('\n\n',1)[-1].strip()==q['recovered_stem_excerpt']
            sourceoutcome='correct' if 'tickCircle-active' in raw['status'] else 'wrong' if 'cancel-icon-rounded' in raw['status'] else 'skipped'
            assert sourceoutcome==q['outcome']
            evidence=(ROOT/q['source']['topic_evidence_path']).read_text()
            erows=[x.split('\t') for x in evidence.splitlines() if x.split('\t')[0]==str(q['question_number'])]
            assert len(erows)==1
            e=erows[0]
            assert [e[1],e[2],e[3].removeprefix('Type ')]==[q['area'],q['topic'],q['provider_difficulty_type']]
            assert sec(e[4])==q['time_seconds'] and int(e[8])==q['marks'] and e[7].lower()==q['outcome']
            if q['section']=='DILR':
                assert q['set_id'] in set_index
                assert q['question_number'] in set_index[q['set_id']]['question_numbers']
            else:
                assert q['set_id'] is None
            if q['original_response'] is not None or q['correct_answer'] is not None:
                assert slug=='simcat-2-2026' and q['section']=='QA' and q['question_number']==3
                assert q['original_response']['option_label']=='B' and q['correct_answer']['option_label']=='A'
                assert q['original_response']['evidence_kind']=='prior_analysis_visual_observation'
                assert 'selected option B and correct option A' in sourcepath.read_text()
            else:
                assert doc['field_notes']['original_response'] and doc['field_notes']['correct_answer']
        totals=Counter(q['outcome'] for q in qs)
        expected=dict(question_count=68,attempted=totals['correct']+totals['wrong'],correct=totals['correct'],
                      incorrect=totals['wrong'],skipped=totals['skipped'])
        expected['accuracy_percent']=round(100*expected['correct']/expected['attempted'],2)
        assert result['overall']['statistics']==expected
        assert sum(q['marks'] for q in qs)==result['overall']['score']==sum(s['score'] for s in result['sections'].values())
        assert sum(q['time_seconds'] for q in qs)==result['overall']['attributed_question_time_seconds']
        ai=(directory/'sources/ai-insights-varc.txt').read_text()
        m=re.search(r'\nOVERALL\n([\d.]+)%ile\n(\d+) marks',ai)
        assert float(m[1])==result['overall']['provider_percentile'] and int(m[2])==result['overall']['score']
        section_report={}
        for section,count in [('VARC',24),('DILR',22),('QA',22)]:
            items=[q for q in qs if q['section']==section]
            assert sorted(q['question_number'] for q in items)==list(range(1,count+1))
            sr=result['sections'][section]; counts=Counter(q['outcome'] for q in items)
            stats=dict(question_count=count,attempted=counts['correct']+counts['wrong'],correct=counts['correct'],incorrect=counts['wrong'],skipped=counts['skipped'])
            stats['accuracy_percent']=round(100*stats['correct']/stats['attempted'],2)
            assert stats==sr['statistics']
            assert sum(q['marks'] for q in items)==sr['score']
            assert sum(q['time_seconds'] for q in items)==sr['attributed_question_time_seconds']
            m=re.search(r'\n'+section+r'\n([\d.]+)%ile\n(\d+) marks',ai)
            assert float(m[1])==sr['provider_percentile'] and int(m[2])==sr['score']
            c=[x.strip() for x in (ROOT/sr['source']['markdown_path']).read_text().splitlines()[sr['source']['markdown_line']-1].strip().strip('|').split('|')]
            assert c[0]==section and int(c[1])==sr['score'] and float(c[2])==sr['provider_percentile']
            assert list(map(int,c[3:7]))==[stats[x] for x in ('attempted','correct','incorrect','skipped')]
            if sr['provider_area_statistics'] is not None:
                for field in ('question_count','attempted','correct','accuracy_percent'):
                    assert sr['provider_area_statistics'][field]==stats[field]
                assert sr['provider_area_statistics']['score']==sr['score']
            section_report[section]={'records':count,'marks':sr['score'],'attributed_time_seconds':sr['attributed_question_time_seconds'],
                                     'difference_from_2400_seconds':sr['attributed_question_time_seconds']-2400}
        if (directory/'sources/scorecard.txt').exists():
            scorecard=(directory/'sources/scorecard.txt').read_text()
            marker=scorecard.split('Section\nScore\nPercentile\n',1)[1].split('Percentile Mapper',1)[0]
            lines=[x.strip() for x in marker.splitlines() if x.strip()]
            for index,label in enumerate(('overall','VARC','DILR','QA')):
                r=result['overall'] if label=='overall' else result['sections'][label]
                assert int(lines[index*3+1])==r['score'] and float(lines[index*3+2].rstrip('%'))==r['provider_percentile']
        for s in doc['sets']:
            block=[q for q in qs if q['set_id']==s['id']]
            assert sorted(q['question_number'] for q in block)==s['question_numbers']
            assert sum(q['marks'] for q in block)==s['marks']
            assert sum(q['time_seconds'] for q in block)==s['time_seconds']
        reports.append(dict(mock_id=slug,record_count=len(qs),score=result['overall']['score'],
                            mock_percentile=result['overall']['provider_percentile'],sections=section_report))
    assert len(global_ids)==manifest['question_records_recovered']==204
    assert len(global_set_ids)==15
    assert not list((ROOT/'data/mocks').glob('*/reattempts/*/questions.json'))
    for md in [ROOT/'README.md',ROOT/'AGENTS.md',ROOT/'docs/ANALYSIS-CONTRACT.md',ROOT/'data/README.md']:
        for target in re.findall(r'\]\(([^)]+)\)',md.read_text()):
            if '://' not in target and not target.startswith('#'):
                destination=(md.parent/target).resolve()
                assert destination==(ROOT/'data/validation-report.json').resolve() or destination.exists(), (md,target)
    report=dict(schema_version='1.0',status='passed',validation_scope='This recovered original-attempt batch',
        source_hashes_checked=len(manifest['source_files']),source_and_record_json_files_parsed=len([p for p in json_files if p.name!='validation-report.json']),
        markdown_sources_preserved=8,question_records=204,duplicate_question_ids=0,local_dilr_blocks=15,
        reattempt_records=0,full_question_content_records=0,narrative_only_answer_label_pairs=1,mocks=reports,
        checks=['JSON syntax, duplicate object keys and finite numbers','Byte-identical source hashes and sizes',
            'Global composite question/set IDs and section numbering','204 outcomes, marks, question times and benchmark fields against Markdown and raw captures',
            'All nine section totals, overall totals, attempts, outcomes and accuracy',
            'Headline provider mock percentiles; retained detailed Scorecards/Area-Wise statistics',
            'DILR block membership, score and time sums','Null explanations and narrative-only answer exception','Index/documentation links'],
        caveats=['Full question text/options absent for all 204 rows; metadata recovery only.',
            'No exact attempt dates or completed reattempts recovered.',
            'One response/key label pair is supported by a prior analyst narrative, not a recovered screenshot.',
            'PreSimCAT 1 separate Scorecard/Area-Wise captures absent; Markdown/AI sources support totals.',
            'PreSimCAT 2 aggregate Question Selection capture has empty counts.',
            'Attributed times differ slightly from nominal section duration; retained unchanged.',
            'Original AI prose includes contradictions and is not treated as authoritative arithmetic.'])
    (ROOT/'data/validation-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2,allow_nan=False)+'\n')
    print(json.dumps(report,indent=2))


if __name__=='__main__':
    try:
        validate()
    except (AssertionError,ValueError,KeyError,FileNotFoundError) as exc:
        print('VALIDATION FAILED:',repr(exc),file=sys.stderr)
        raise
