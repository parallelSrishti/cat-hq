#!/usr/bin/env python3
"""Build standalone SQLite exports, overlaying verified full-review captures.

The historical questions.json files and immutable legacy evidence stay unchanged.
No answer or response format is inferred from score or outcome.
"""
import hashlib
import json
from pathlib import Path
import re
import sqlite3

ROOT = Path(__file__).resolve().parents[1]
SCHEMA = """
PRAGMA foreign_keys=ON;
CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE mocks (mock_id TEXT PRIMARY KEY, name TEXT, attempt_id TEXT,
  attempt_kind TEXT, attempt_date TEXT, score REAL, provider_percentile REAL,
  results_json TEXT NOT NULL);
CREATE TABLE sections (section TEXT PRIMARY KEY, score REAL,
  provider_percentile REAL, question_count INTEGER, attempted INTEGER,
  correct INTEGER, incorrect INTEGER, skipped INTEGER, time_seconds INTEGER,
  source_json TEXT NOT NULL);
CREATE TABLE stimuli (stimulus_id TEXT PRIMARY KEY, kind TEXT, text TEXT,
  html TEXT, content_sha256 TEXT NOT NULL);
CREATE TABLE sets (set_id TEXT PRIMARY KEY, section TEXT, source_json TEXT NOT NULL);
CREATE TABLE questions (
  question_id TEXT PRIMARY KEY, section TEXT NOT NULL REFERENCES sections(section),
  question_number INTEGER NOT NULL, provider_question_id TEXT,
  question_type TEXT, sectional_area TEXT, sectional_topic TEXT, subtopic TEXT,
  classification_source TEXT, provider_difficulty_type TEXT,
  set_id TEXT REFERENCES sets(set_id), stimulus_id TEXT REFERENCES stimuli(stimulus_id),
  question_text TEXT, question_html TEXT, stem_excerpt TEXT,
  original_response TEXT, original_response_option_label TEXT,
  correct_response TEXT, correct_response_option_label TEXT, answer_evidence TEXT,
  outcome TEXT NOT NULL CHECK(outcome IN ('correct','wrong','skipped')),
  attempted INTEGER NOT NULL, marks REAL NOT NULL, time_seconds INTEGER NOT NULL,
  topper_time_seconds INTEGER, topper_attempt_percent REAL,
  topper_accuracy_percent REAL, topper_p_value REAL,
  solution_text TEXT, solution_html TEXT, content_status TEXT NOT NULL,
  missing_fields_json TEXT NOT NULL, historical_record_json TEXT NOT NULL,
  UNIQUE(section, question_number)
);
CREATE TABLE options (
  question_id TEXT NOT NULL REFERENCES questions(question_id), position INTEGER NOT NULL,
  label TEXT NOT NULL, text TEXT, html TEXT, is_selected INTEGER,
  is_correct INTEGER, PRIMARY KEY(question_id,label), UNIQUE(question_id,position)
);
CREATE TABLE source_captures (
  source_id TEXT PRIMARY KEY, question_id TEXT REFERENCES questions(question_id),
  relative_path TEXT NOT NULL, source_url TEXT, captured_at TEXT,
  sha256 TEXT NOT NULL, mime_type TEXT NOT NULL, content BLOB NOT NULL
);
CREATE TABLE notes (note_id TEXT PRIMARY KEY, note TEXT NOT NULL);
CREATE VIEW question_details AS
 SELECT q.*, s.text AS stimulus_text, s.html AS stimulus_html,
 (SELECT json_group_array(json_object('label',o.label,'text',o.text,
   'html',o.html,'is_selected',o.is_selected,'is_correct',o.is_correct))
 FROM options o WHERE o.question_id=q.question_id ORDER BY o.position) AS options_json
 FROM questions q LEFT JOIN stimuli s USING(stimulus_id);
"""


def dumps(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, allow_nan=False)


def read(path):
    return json.loads(path.read_text())


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def add_capture(db, path, question_id=None, capture=None):
    raw = path.read_bytes()
    rel = str(path.relative_to(ROOT))
    db.execute('INSERT INTO source_captures VALUES (?,?,?,?,?,?,?,?)',
               (rel, question_id, rel, (capture or {}).get('url'),
                (capture or {}).get('captured_at'), sha(raw),
                'application/json' if path.suffix == '.json' else 'text/markdown' if path.suffix == '.md' else 'text/plain', raw))


def build(directory):
    slug = directory.name
    result = read(directory / 'results.json')
    historic = read(directory / 'questions.json')
    captures = {}
    for path in sorted((directory / 'sources/full-review').glob('*.json')):
        match = re.fullmatch(r'(VARC|DILR|QA)-q(\d+)\.json', path.name)
        assert match, path
        capture = read(path)
        section, number = match[1], int(match[2])
        assert capture.get('section', section) == section
        assert capture.get('number', number) == number
        assert capture['question_text'].strip() and capture['question_html']
        assert len(capture['options']) == 4, 'New response formats require explicit handling'
        captures[section, number] = (path, capture)
    target = directory / (slug + '.db')
    temporary = target.with_suffix('.db.tmp')
    if temporary.exists():
        temporary.unlink()
    db = sqlite3.connect(temporary)
    db.executescript(SCHEMA)
    db.executemany('INSERT INTO metadata VALUES (?,?)', {
        'schema_version': '1.0', 'mock_id': slug,
        'status': 'partial_full_content_extraction',
        'review_date_local': '2026-10-17', 'review_timezone': 'Asia/Kolkata',
        'time_unit': 'seconds', 'percentage_unit': '0-100',
        'attempt_kind': 'original',
        'question_type_definition': 'MCQ/TITA response format; null if not directly recovered',
        'provider_difficulty_type_definition': 'IMS A/B/C; distinct from response format',
        'sectional_topic_definition': 'IMS topic; sectional_area is the IMS area label',
        'subtopic_definition': 'null; no additional provider subtopic field recovered',
        'content_gap': 'BrowserOS local MCP server became unreachable after five PreSimCAT 1 questions. Missing content has not been reconstructed.',
        'null_note': 'Missing fields are explained in questions.missing_fields_json and notes.',
    }.items())
    db.execute('INSERT INTO mocks VALUES (?,?,?,?,?,?,?,?)',
               (slug, result['name'], result['attempt']['id'], 'original',
                result['attempt']['attempt_date'], result['overall']['score'],
                result['overall']['provider_percentile'], dumps(result)))
    for section, sr in result['sections'].items():
        stats = sr['statistics']
        db.execute('INSERT INTO sections VALUES (?,?,?,?,?,?,?,?,?,?)',
                   (section, sr['score'], sr['provider_percentile'],
                    stats['question_count'], stats['attempted'], stats['correct'],
                    stats['incorrect'], stats['skipped'],
                    sr['attributed_question_time_seconds'], dumps(sr)))
    for s in historic['sets']:
        db.execute('INSERT INTO sets VALUES (?,?,?)', (s['id'], 'DILR', dumps(s)))
    notes = {
        'scope': '68 original-attempt question records. Reattempts are not mixed into this database.',
        'source_integrity': 'Historical JSON and legacy sources remain unchanged; full-review captures form a separate evidence layer.',
        'attempt_date': 'Exact original attempt date unavailable. Review date is not an attempt date.',
        'question_type': 'Only directly viewed response formats are recorded. No inference from marks, outcome or topic.',
        'topics': 'Area/topic/A-B-C labels are IMS labels from retained evidence tables. No analyst classifications added.',
        'subtopic': 'No separate subtopic field recovered; sectional_topic retains the exact available provider topic.',
        'time': 'Question and topper times use integer seconds; section time is attributed row sum, not wall-clock duration.',
        'p_value': 'Provider percentage-style p-value, not a statistical significance p-value.',
        'answer_selection': 'Full-review selected options use the blue option-container class; key uses the Correct option image marker. Both observations preserved in the source capture.',
        'historical_answer_pair': 'SimCAT 2 QA Q3 B/A remains narrative-only evidence; full question and options were not recovered for it.',
        'media': 'First five full questions have no external image elements in their question, options or shared passage. Their HTML and text are stored in this database.',
        'blockers': 'Review Player displayed Dev-Tools Detected. Regular analytics exposed five full questions, then BrowserOS calls failed to reach http://127.0.0.1:9000/mcp; retry tab listing failed too.',
        'resume': 'Resume at PreSimCAT 1 VARC Q6, then remaining DILR/QA and the other two mocks. Confirm IDs and source content before inserting.',
    }
    db.executemany('INSERT INTO notes VALUES (?,?)', notes.items())
    for q in historic['questions']:
        values = dict(question_id=q['id'], section=q['section'],
            question_number=q['question_number'], provider_question_id=None,
            question_type=None, sectional_area=q['area'], sectional_topic=q['topic'],
            subtopic=None, classification_source=q['source']['topic_evidence_path'],
            provider_difficulty_type=q['provider_difficulty_type'], set_id=q['set_id'],
            stimulus_id=None, question_text=None, question_html=None,
            stem_excerpt=q['recovered_stem_excerpt'], original_response=None,
            original_response_option_label=None, correct_response=None,
            correct_response_option_label=None, answer_evidence=None,
            outcome=q['outcome'], attempted=int(q['attempted']), marks=q['marks'],
            time_seconds=q['time_seconds'],
            topper_time_seconds=q['provider_benchmark']['time_seconds'],
            topper_attempt_percent=q['provider_benchmark']['attempt_percent'],
            topper_accuracy_percent=q['provider_benchmark']['accuracy_percent'],
            topper_p_value=q['provider_benchmark']['p_value'], solution_text=None,
            solution_html=None, content_status='partial_ui_excerpt_only',
            historical_record_json=dumps(q))
        missing = dict(question_text='Full question not recovered before browser connection failed.',
            options='Full options not recovered.', question_type='MCQ/TITA format not recovered.',
            original_response='Original answer not recovered; outcome is not an answer.',
            correct_response='Key not recovered; outcome is not a key.',
            solution='Solution not recovered.', subtopic=notes['subtopic'])
        if q['original_response']:
            values.update(original_response_option_label=q['original_response']['option_label'],
                correct_response_option_label=q['correct_answer']['option_label'],
                answer_evidence='prior_analysis_visual_observation; underlying screenshot unavailable')
            missing['original_response'] = 'Option label only from prior narrative; answer text unavailable.'
            missing['correct_response'] = 'Option label only from prior narrative; answer text unavailable.'
        item = captures.get((q['section'], q['question_number']))
        options = []
        if item:
            path, c = item
            options = c['options']
            selected = [o for o in options if o['selected']]
            correct = [o for o in options if o['correct']]
            assert len(correct) == 1 and len(selected) == 1
            assert (selected[0]['label'] == correct[0]['label']) == (q['outcome'] == 'correct')
            assert c['question_text'].strip().startswith(q['recovered_stem_excerpt'].strip())
            provider_id = re.search(r'/preview/(\d+)/', c['url'])[1]
            values.update(provider_question_id=provider_id, question_type='MCQ',
                question_text=c['question_text'], question_html=c['question_html'],
                original_response=selected[0]['text'], original_response_option_label=selected[0]['label'],
                correct_response=correct[0]['text'], correct_response_option_label=correct[0]['label'],
                answer_evidence=str(path.relative_to(ROOT)), solution_text=c['solution_text'],
                solution_html=c['solution_html'], content_status='full_text_and_html_recovered')
            missing = {'subtopic': notes['subtopic']}
            # Preserve shared instructions/passages once, linked to every associated question.
            if c['instructions_html']:
                digest = sha(c['instructions_html'].encode())
                stimulus_id = slug + ':stimulus:' + digest[:16]
                db.execute('INSERT OR IGNORE INTO stimuli VALUES (?,?,?,?,?)',
                    (stimulus_id, 'RC passage and instructions', c['instructions_text'], c['instructions_html'], digest))
                values['stimulus_id'] = stimulus_id
            for html in (c['question_html'], c['instructions_html'], *(o['html'] for o in options)):
                assert not re.search(r'<img\b[^>]*src=["\']https?://', html or ''), 'Media requires embedding'
        values['missing_fields_json'] = dumps(missing)
        names = list(values)
        db.execute('INSERT INTO questions (' + ','.join(names) + ') VALUES (' + ','.join('?' for _ in names) + ')',
                   [values[n] for n in names])
        for position, o in enumerate(options, 1):
            db.execute('INSERT INTO options VALUES (?,?,?,?,?,?,?)',
                       (q['id'], position, o['label'], o['text'], o['html'], int(o['selected']), int(o['correct'])))
        if item:
            add_capture(db, item[0], q['id'], item[1])
    for path in [directory/'results.json', directory/'questions.json', directory/'analysis.md',
                 directory/'sources/question-wise-rows.json', *sorted((directory/'sources').glob('evidence-*-topics.txt'))]:
        add_capture(db, path)
    db.commit()
    assert db.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
    assert not db.execute('PRAGMA foreign_key_check').fetchall()
    db.close()
    temporary.replace(target)
    return target


if __name__ == '__main__':
    for folder in sorted((ROOT/'data/mocks').iterdir()):
        if folder.is_dir():
            path = build(folder)
            print(path.relative_to(ROOT))
