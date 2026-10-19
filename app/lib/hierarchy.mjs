// User-supplied historical priorities. They are not official CAT weightages.
export const HIERARCHY = {
  QA: [
    {
      id: "arithmetic",
      name: "Arithmetic",
      tier: 1,
      frequency: "35–40%",
      practiceBucket: "Arithmetic",
    },
    {
      id: "algebra",
      name: "Algebra",
      tier: 1,
      frequency: "20–30%",
      practiceBucket: "Algebra",
    },
    {
      id: "geometry",
      name: "Geometry",
      tier: 2,
      frequency: "12–15%",
      practiceBucket: "Geometry",
    },
    {
      id: "numbers",
      name: "Number Systems",
      tier: 2,
      frequency: "10–15%",
      practiceBucket: "Number Systems",
    },
    {
      id: "modern",
      name: "Modern Math",
      tier: 3,
      frequency: "10–15%",
      practiceBucket: "Modern Math",
    },
  ],
  DILR: [
    {
      id: "grouping",
      name: "Grouping & Conditionality",
      tier: 1,
      frequency: "15–20%",
      practiceBucket: "Grouping / conditionality",
    },
    {
      id: "games",
      name: "Games & Tournaments",
      tier: 1,
      frequency: "12–17%",
      practiceBucket: "Games / tournaments",
    },
    {
      id: "hybrid",
      name: "Hybrid DI + LR / Conditional caselets",
      tier: 1,
      frequency: "Increasing share · no stable %",
      practiceBucket: "Hybrid / reasoning DI",
    },
    {
      id: "arrangements",
      name: "Arrangements / Seating",
      tier: 2,
      frequency: "12–18%",
      practiceBucket: "Grouping / conditionality",
    },
    {
      id: "reasoning-di",
      name: "Reasoning-based DI",
      tier: 2,
      frequency: "10–15%",
      practiceBucket: "Hybrid / reasoning DI",
    },
    {
      id: "networks",
      name: "Routes, Networks & Scheduling",
      tier: 2,
      frequency: "5–10% combined",
      practiceBucket: "Routes / scheduling",
    },
    {
      id: "pure-di",
      name: "Pure calculation-based DI",
      tier: 3,
      frequency: "About 10%",
      practiceBucket: "Rotating families",
    },
    {
      id: "observation",
      name: "Observation-based DI",
      tier: 3,
      frequency: "5–10%",
      practiceBucket: "Rotating families",
    },
    {
      id: "puzzles",
      name: "Cube / Binary logic / Sudoku puzzles",
      tier: 3,
      frequency: "5–10%",
      practiceBucket: "Rotating families",
    },
    {
      id: "venn",
      name: "Venn Diagrams / Radar Charts",
      tier: 3,
      frequency: "Occasional",
      practiceBucket: "Rotating families",
    },
  ],
  VARC: [
    {
      id: "rc",
      name: "Reading Comprehension",
      tier: null,
      frequency: "No user-supplied tier",
      practiceBucket: "Reading Comprehension",
    },
    {
      id: "va",
      name: "Verbal Ability",
      tier: null,
      frequency: "No user-supplied tier",
      practiceBucket: "Verbal Ability",
    },
  ],
};
export function classify(question) {
  const defs = HIERARCHY[question.section] || [];
  if (question.cat_family && question.classification_source) {
    const explicit = defs.find(
      (d) => d.id === question.cat_family || d.name === question.cat_family,
    );
    if (explicit)
      return {
        ...explicit,
        provenance: "Analyst classification: " + question.classification_source,
      };
  }
  const topic = question.topic || "",
    area = question.area || "";
  let id;
  if (question.section === "QA") {
    if (
      /\bsici\b|interest|profit|loss|percentage|ratio|proportion|mixture|alligation|speed|distance|time.?work|time and work|averages?|partnership/i.test(
        topic,
      )
    )
      id = "arithmetic";
    else if (
      /surds?|indices|number|divisib|remainder|integer|factor|hcf|lcm|unit.?digit|base system/i.test(
        topic,
      )
    )
      id = "numbers";
    else if (
      /algebra|quadratic|linear|inequal|function|logarith|equation|polynomial|sequence|progression/i.test(
        topic,
      )
    )
      id = "algebra";
    else if (
      /triangle|mensuration|geometry|circle|quadrilateral|polygon|coordinate|trigonomet/i.test(
        topic,
      )
    )
      id = "geometry";
    else if (
      /permutation|combination|probability|binomial|set theory/i.test(topic)
    )
      id = "modern";
  } else if (question.section === "DILR") {
    // Broad IMS labels cannot prove the actual reasoning demanded by a set.
    if (/group.*arrangement|arrangement.*group/i.test(topic)) id = null;
    else if (/game|tournament|round.?robin/i.test(topic)) id = "games";
    else if (/hybrid|conditional caselet|caselet.*condition/i.test(topic))
      id = "hybrid";
    else if (/group|conditional|allocation|selection/i.test(topic))
      id = "grouping";
    else if (/arrangement|seating|circular|linear ordering/i.test(topic))
      id = "arrangements";
    else if (/reasoning.based.*di|di.*reasoning.based/i.test(topic))
      id = "reasoning-di";
    else if (/route|network|scheduling/i.test(topic)) id = "networks";
    else if (/calculation.based|pure di/i.test(topic)) id = "pure-di";
    else if (/observation.based/i.test(topic)) id = "observation";
    else if (/cube|binary logic|sudoku/i.test(topic)) id = "puzzles";
    else if (/venn|radar/i.test(topic)) id = "venn";
  } else if (question.section === "VARC") {
    if (/reading comprehension/i.test(area)) id = "rc";
    else if (
      /verbal ability/i.test(area) ||
      /summary|paragraph|sentence out|odd sentence/i.test(topic)
    )
      id = "va";
  }
  const result = defs.find((d) => d.id === id);
  return result
    ? { ...result, provenance: "Mapped from explicit provider topic" }
    : {
        id: "unclassified",
        name: "Needs classification",
        tier: null,
        frequency: "Unknown",
        practiceBucket: "Unclassified",
        provenance:
          "Provider label is broad or ambiguous; no tier inferred from appearance",
      };
}
function empty(def) {
  return {
    ...def,
    total: 0,
    attempted: 0,
    correct: 0,
    wrong: 0,
    skipped: 0,
    marks: 0,
    seconds: 0,
    questionIds: [],
    setIds: new Set(),
    topics: [],
  };
}
function add(row, q) {
  row.total++;
  row.attempted += q.outcome !== "skipped" ? 1 : 0;
  row.correct += q.outcome === "correct" ? 1 : 0;
  row.wrong += q.outcome === "wrong" ? 1 : 0;
  row.skipped += q.outcome === "skipped" ? 1 : 0;
  row.marks += Number.isFinite(q.marks) ? q.marks : 0;
  row.seconds += q.time_seconds || 0;
  row.questionIds.push(q.id);
  if (q.set_id) row.setIds.add((q.mock_id || "") + "|" + q.set_id);
}
function finish(row) {
  return {
    ...row,
    accuracy: row.attempted ? (100 * row.correct) / row.attempted : null,
    conversion: row.total ? (100 * row.correct) / row.total : null,
    sets: row.setIds.size,
    setIds: undefined,
    repairState:
      row.attempted === 0
        ? "Untested"
        : row.wrong || row.correct / row.attempted < 0.8
          ? "Diagnose"
          : "Monitor",
  };
}
export function buildHierarchy(mocks) {
  const output = {};
  for (const section of ["QA", "DILR", "VARC"]) {
    const map = new Map(HIERARCHY[section].map((def) => [def.id, empty(def)]));
    const sub = new Map();
    const questions = mocks
      .flatMap((m) => m.questions || [])
      .filter((q) => q.section === section);
    for (const q of questions) {
      const c = classify(q);
      if (!map.has(c.id)) map.set(c.id, empty(c));
      const family = map.get(c.id);
      add(family, q);
      const key = c.id + "|" + q.topic;
      if (!sub.has(key))
        sub.set(key, empty({ ...c, section, topic: q.topic, family: c.name }));
      add(sub.get(key), q);
    }
    output[section] = [...map.values()].map((f) => ({
      ...finish(f),
      section,
      topics: [...sub.values()].filter((t) => t.id === f.id).map(finish),
      observedShare: questions.length
        ? (100 * f.total) / questions.length
        : null,
    }));
  }
  return output;
}
