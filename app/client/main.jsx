import DOMPurify from "dompurify";
import React, { useState, useEffect, useCallback } from "react";
import { createRoot } from "react-dom/client";
import {
  LayoutDashboard,
  Columns3,
  ChartNoAxesCombined,
  BookOpen,
  Brain,
  Calculator,
  Languages,
  History,
  Settings,
  ArrowUpRight,
  ArrowRight,
  Plus,
  Flame,
  Check,
  Clock,
  Play,
  Pause,
  ChevronRight,
  ChevronLeft,
  X,
  RefreshCw,
  Upload,
  Download,
  GitBranch,
  Target,
  TriangleAlert,
  CheckCircle2,
  ExternalLink,
  Search,
  Menu,
  Timer,
  ShieldCheck,
  Bell,
  CalendarDays,
  LoaderCircle,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  ScatterChart,
  Scatter,
  ReferenceLine,
  AreaChart,
  Area,
  ReferenceDot,
} from "recharts";
import "./style.css";
const COLORS = {
  QA: "#78acd8",
  DILR: "#8b9fdb",
  VARC: "#83b8a1",
  correct: "#83b8a1",
  wrong: "#e17c7c",
  skipped: "#66666f",
};
const fmt = (v, d = 1) => (v == null ? "—" : Number(v).toFixed(d));
const duration = (n) =>
  `${Math.floor((n || 0) / 60)}:${String(Math.round((n || 0) % 60)).padStart(2, "0")}`;
const api = async (url, body) => {
  const res = await fetch(url, {
    ...(body === undefined
      ? {}
      : {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-HQ-Request": "1" },
          body: JSON.stringify(body),
        }),
  });
  const data = await res.json();
  if (!res.ok) throw Error(data.error || "Request failed");
  return data;
};
const go = (path) => (location.hash = "/" + path);
DOMPurify.addHook("afterSanitizeAttributes", (node) => {
  if (node.tagName === "IMG") {
    const src = node.getAttribute("src") || "";
    if (!/^data:image\//i.test(src)) {
      node.removeAttribute("src");
      node.setAttribute("alt", "External image not embedded in this snapshot");
    }
  }
  for (const attr of ["href", "xlink:href"]) {
    if (
      node.namespaceURI === "http://www.w3.org/2000/svg" &&
      /^https?:/i.test(node.getAttribute(attr) || "")
    )
      node.removeAttribute(attr);
  }
});
function RichContent({ html, className = "" }) {
  const clean = DOMPurify.sanitize(html || "", {
    USE_PROFILES: { html: true, svg: true, mathMl: true },
    FORBID_TAGS: [
      "style",
      "iframe",
      "object",
      "embed",
      "form",
      "input",
      "button",
    ],
    FORBID_ATTR: ["style"],
    ALLOW_DATA_ATTR: false,
  });
  return (
    <div
      className={"source-content " + className}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}
function Badge({ children, tone = "" }) {
  return <span className={"badge " + tone}>{children}</span>;
}
function Empty({ children }) {
  return (
    <div className="empty">
      <BookOpen size={22} />
      <p>{children}</p>
    </div>
  );
}
function Panel({ title, kicker, action, children, className = "" }) {
  return (
    <section className={"panel " + className}>
      <div className="panel-heading">
        <div>
          {kicker && <span className="eyebrow">{kicker}</span>}
          <h3>{title}</h3>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
const grid = { stroke: "#333339", strokeDasharray: "3 4", vertical: false };
const axis = {
  stroke: "#777780",
  fontSize: 11,
  tickLine: false,
  axisLine: false,
};
const tip = {
  contentStyle: {
    background: "#2a2a2e",
    border: "1px solid #414147",
    borderRadius: 10,
    color: "#eee",
  },
  labelStyle: { color: "#ddd" },
  cursor: { fill: "rgba(255,255,255,.03)" },
};
function Bars({
  data,
  x = "name",
  series,
  height = 230,
  percent = false,
  click,
}) {
  return (
    <div style={{ height, minWidth: 0 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          onClick={(e) => {
            if (click && e?.activeLabel) click(e.activeLabel);
          }}
          margin={{ top: 14, right: 10, bottom: 10, left: -20 }}
        >
          <CartesianGrid {...grid} />
          <XAxis
            dataKey={x}
            {...axis}
            interval={0}
            tickFormatter={(v) =>
              String(v).length > 17 ? String(v).slice(0, 15) + "…" : v
            }
          />
          <YAxis {...axis} domain={percent ? [0, 100] : ["auto", "auto"]} />
          <Tooltip
            {...tip}
            formatter={(v, name) => [
              fmt(v, percent ? 1 : 0) + (percent ? "%" : ""),
              name,
            ]}
          />
          {series.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.label}
              fill={s.color || "#78acd8"}
              radius={[4, 4, 0, 0]}
              maxBarSize={36}
              stackId={s.stack}
            />
          ))}
          <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
function Stat({ label, value, detail, color }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong style={{ color }}>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}
function Modal({ title, children, onClose, wide = false }) {
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={"modal " + (wide ? "wide" : "")}
      >
        <div className="modal-title">
          <h2>{title}</h2>
          <button
            className="icon-btn"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
function TaskCard({ task, onOpen, compact = false }) {
  return (
    <button
      className={"task-card " + (compact ? "compact" : "")}
      onClick={() => onOpen(task)}
    >
      <div className="task-tags">
        <Badge tone={task.section.toLowerCase()}>{task.section}</Badge>
        <span>
          {task.type === "questions"
            ? "QUESTION PRACTICE"
            : task.type.toUpperCase()}
        </span>
        {task.stage === "delayed-retest" && <Badge>RETEST</Badge>}
      </div>
      <h4>{task.title}</h4>
      {!compact && <p>{task.reason}</p>}
      <div className="task-footer">
        <span>
          <Clock size={12} />
          {task.minutes} min · {task.due}
        </span>
        <span className="xp">
          +{task.xp} XP <ChevronRight size={14} />
        </span>
      </div>
      {task.blockedBy?.length > 0 && (
        <div className="content-note">
          Review gate · {task.blockedBy.length} prior repairs open
        </div>
      )}
      {task.questionCount > 0 && task.contentCount < task.questionCount && (
        <div className="content-note">IMS references · timer ready</div>
      )}
    </button>
  );
}
function Board({ data, onOpen, full = false }) {
  const [filter, setFilter] = useState("ALL");
  return (
    <>
      <div className="section-toolbar">
        <div className="segmented">
          {["ALL", "QA", "DILR", "VARC"].map((s) => (
            <button
              key={s}
              className={filter === s ? "selected" : ""}
              onClick={() => setFilter(s)}
            >
              {s === "ALL" ? "All sections" : s}
            </button>
          ))}
        </div>
        <span className="muted small">Click a mission to begin</span>
      </div>
      <div className={"kanban " + (full ? "four" : "")}>
        {(full
          ? ["today", "missed", "upcoming", "done"]
          : ["missed", "today", "upcoming"]
        ).map((status) => {
          const tasks = data.tasks.filter(
            (t) =>
              t.status === status && (filter === "ALL" || t.section === filter),
          );
          return (
            <div className={"lane " + status} key={status}>
              <div className="lane-head">
                <span className="dot" />
                <h3>
                  {
                    {
                      today: "Today’s focus",
                      missed: "Carry forward",
                      upcoming: "Up next",
                      done: "Completed",
                    }[status]
                  }
                </h3>
                <span className="count">{tasks.length}</span>
              </div>
              {(full ? tasks : tasks.slice(0, 3)).map((t) => (
                <TaskCard key={t.id} task={t} onOpen={onOpen} />
              ))}
              {!tasks.length && (
                <div className="lane-empty">
                  {status === "done"
                    ? "Your completed missions will appear here."
                    : status === "today"
                      ? "No missions due today. Choose a repair or pull a task forward."
                      : "Nothing here. Keep the loop moving."}
                </div>
              )}
              {!full && tasks.length > 3 && (
                <button className="text-btn" onClick={() => go("board")}>
                  View {tasks.length - 3} more <ArrowRight size={13} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
function TrendPanel({
  data,
  section = "ALL",
  compact = false,
  measure: controlledMeasure,
  onMeasureChange,
}) {
  const [windowSize, setWindowSize] = useState("all");
  const [localMeasure, setLocalMeasure] = useState("cohort");
  const measure = controlledMeasure ?? localMeasure;
  const setMeasure = onMeasureChange || setLocalMeasure;
  const timeline = data.analytics.timeline;
  const key = section === "ALL" ? measure : section;
  const trend = data.analytics.trends[key];
  const points =
    windowSize === "all"
      ? timeline.points
      : timeline.points.slice(-Number(windowSize));
  const color =
    section === "ALL"
      ? key === "projection"
        ? "#b39fe2"
        : "#78acd8"
      : COLORS[section];
  const title =
    section === "ALL"
      ? key === "projection"
        ? "Provider CAT predictions over time"
        : "Mock cohort percentile over time"
      : `${section} cohort percentile over time`;
  return (
    <Panel title={title} kicker="TREND · VERIFIED CHRONOLOGY" className="lower">
      <div className="chart-controls">
        {section === "ALL" && (
          <label>
            Measure{" "}
            <select
              aria-label="Trend measure"
              value={measure}
              onChange={(e) => setMeasure(e.target.value)}
            >
              <option value="cohort">Mock cohort percentile</option>
              <option value="projection">Provider CAT prediction</option>
            </select>
          </label>
        )}
        <label>
          Window{" "}
          <select
            aria-label={`${section} trend window`}
            value={windowSize}
            onChange={(e) => setWindowSize(e.target.value)}
          >
            <option value="all">All observations</option>
            <option value="10">Latest 10</option>
            <option value="5">Latest 5</option>
          </select>
        </label>
      </div>
      {points.some((p) => Number.isFinite(p[key])) ? (
        <div
          style={{ height: compact ? 230 : 290, minWidth: 0 }}
          role="img"
          aria-label={title}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={points}
              margin={{ top: 16, right: 20, left: -20, bottom: 10 }}
            >
              <CartesianGrid {...grid} />
              <XAxis
                dataKey="index"
                {...axis}
                minTickGap={45}
                tickFormatter={(v) =>
                  points.find((p) => p.index === v)?.label || v
                }
              />
              <YAxis
                {...axis}
                domain={[0, 100]}
                tickFormatter={(v) => `${v}`}
              />
              <Tooltip
                {...tip}
                labelFormatter={(v) => {
                  const p = points.find((p) => p.index === v);
                  return p ? `${p.label} · ${p.count} mock(s)` : v;
                }}
                formatter={(v, name) => [fmt(v, 2), name]}
              />
              <Legend />
              <Line
                dataKey={key}
                name={
                  key === "projection"
                    ? "Provider CAT prediction"
                    : "Cohort percentile"
                }
                stroke={color}
                strokeWidth={2}
                dot={points.length < 15}
                connectNulls={false}
                isAnimationActive={false}
              />
              <Line
                dataKey={key + "_rolling"}
                name="Trailing ≤5-observation mean"
                stroke="#79b99c"
                strokeWidth={2}
                strokeDasharray="5 4"
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
              {trend.dips
                .filter((d) => points.some((p) => p.index === d.index))
                .map((d) => (
                  <ReferenceDot
                    key={d.index}
                    x={d.index}
                    y={d[key]}
                    r={5}
                    fill="#e48494"
                    stroke="#191b1f"
                  />
                ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <Empty>
          {timeline.included
            ? "No reported values for this series on the verified timeline."
            : "No verified timeline yet."}{" "}
          All {data.analytics.total} full mocks still contribute to the
          consolidated view. Record exact attempt dates or an explicitly
          verified global chronological order to reveal trends; file order and
          mock names are not chronology.
        </Empty>
      )}
      <p className="chart-note">
        {timeline.included}/{timeline.total} mocks on the timeline ·{" "}
        {timeline.points.length} observations · {timeline.excluded} without
        verified chronology. {timeline.note}{" "}
        {timeline.groupedDays &&
          "The rolling mean weights daily observations equally."}{" "}
        Pink markers flag descriptive dips. Percentiles are cohort-relative;
        paper and cohort changes can also move them.
      </p>
    </Panel>
  );
}
function TrendAnalysis({ data, section = "ALL", measure = "cohort" }) {
  const trend = data.analytics.trends[section === "ALL" ? measure : section];
  const weak = Object.entries(data.analytics.sections)
    .filter(([, r]) => Number.isFinite(r.percentile))
    .sort((a, b) => a[1].percentile - b[1].percentile)[0];
  return (
    <Panel
      title="What the trend says"
      kicker="EVIDENCE & INTERPRETATION"
      className="lower"
    >
      <div className="stats-row trend-stats">
        <Stat
          label="DIRECTION"
          value={trend.direction}
          detail={
            trend.change === null
              ? "Needs two groups of five observations"
              : `${trend.change > 0 ? "+" : ""}${fmt(trend.change, 2)} points · latest 5 vs preceding 5`
          }
        />
        <Stat
          label="RECENT VARIABILITY"
          value={fmt(trend.dispersion, 2)}
          detail="Percentile-point SD · latest ≤5 observations"
        />
        <Stat
          label="FLAGGED DIPS"
          value={trend.dips.length}
          detail="Against the preceding 3–5 observations"
        />
      </div>
      {!trend.observations ? (
        <p>
          No time-based improvement or decline can be inferred for this series
          without verified chronology and reported values.
          {section === "ALL" && measure === "cohort" && weak
            ? ` ${weak[0]} has the lowest all-mock mean (${fmt(weak[1].percentile, 2)}); this identifies a relative repair priority, not a recent dip.`
            : " Use the sectional hierarchy pages to locate demonstrated gaps."}
        </p>
      ) : (
        <>
          <p>
            Latest observation: <b>{trend.latest.label}</b>,{" "}
            {fmt(trend.latest[section === "ALL" ? measure : section], 2)}{" "}
            {measure === "projection" && section === "ALL"
              ? "provider CAT prediction percentile."
              : "cohort percentile."}{" "}
            {trend.change === null
              ? "There is not yet enough verified history for a five-versus-five direction comparison."
              : `The two-window change is ${fmt(trend.change, 2)} percentile points.`}
          </p>
          {trend.dips.slice(-3).map((d) => (
            <p key={d.index}>
              <b>{d.label}:</b> {fmt(d.drop, 2)} points below the
              preceding-window mean of {fmt(d.baseline, 2)}. Inspect selection,
              errors and timing in the attempt archive.
            </p>
          ))}
          {section === "ALL" && trend.drivers.length > 0 && (
            <p>
              Latest section-score changes versus preceding available
              observations:{" "}
              {trend.drivers
                .map(
                  (d) =>
                    `${d.section} ${d.marksChange >= 0 ? "+" : ""}${fmt(d.marksChange)} marks`,
                )
                .join("; ")}
              . These describe score movements; they do not establish causes or
              add up to an overall percentile change.
            </p>
          )}
        </>
      )}
      <details>
        <summary>Trend and dip rules</summary>
        <p className="small muted">{trend.note}</p>
      </details>
    </Panel>
  );
}
function HierarchyPanel({ data, section, onTopic }) {
  const families = data.analytics.hierarchy[section];
  const observed = families.filter((f) => f.total);
  const groups = section === "VARC" ? [null] : [1, 2, 3, null];
  return (
    <Panel
      title={`${section} topic hierarchy`}
      kicker="ALL ORIGINAL MOCKS · FAMILY → TOPIC"
      className="lower"
    >
      <p className="chart-note">
        Historical frequency is your prioritization reference, not official
        weightage. Observed share below counts questions in your mocks, not
        CAT-wide frequency or DILR set frequency. Families with no sample need
        diagnostics; they are not proven weaknesses. Broad IMS labels stay
        unclassified until the set's reasoning is verified.
      </p>
      {section === "QA" && (
        <p className="chart-note">
          Preparation mapping: sequences/progressions, functions and logarithms
          → Algebra; surds/indices → Number Systems. Original IMS area labels
          remain in the question records.
        </p>
      )}
      {observed.length > 0 && (
        <div
          style={{ height: Math.max(190, observed.length * 34 + 50) }}
          role="img"
          aria-label={`${section} family accuracy and question conversion`}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={observed}
              layout="vertical"
              margin={{ left: 10, right: 20, top: 10, bottom: 10 }}
            >
              <CartesianGrid stroke="#34383e" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} {...axis} />
              <YAxis
                type="category"
                dataKey="name"
                width={155}
                {...axis}
                tickFormatter={(v) =>
                  v.length > 25 ? v.slice(0, 23) + "…" : v
                }
              />
              <Tooltip {...tip} formatter={(v, name) => [fmt(v) + "%", name]} />
              <Legend />
              <Bar
                dataKey="accuracy"
                name="Correct / attempted"
                fill={COLORS[section]}
                maxBarSize={14}
              />
              <Bar
                dataKey="conversion"
                name="Correct / all questions"
                fill="#ba91cb"
                maxBarSize={14}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      {groups.map((tier) => {
        const rows = families.filter((f) => f.tier === tier);
        return (
          rows.length > 0 && (
            <div className="hierarchy-tier" key={tier ?? "none"}>
              <h4>
                {tier
                  ? `Tier ${tier} · ${tier === 1 ? "Critical" : tier === 2 ? "Important" : "Lower frequency"}`
                  : section === "VARC"
                    ? "Section families · no frequency tier assigned"
                    : "Needs classification"}
              </h4>
              {rows.map((f) => (
                <details
                  className="family-detail"
                  key={f.id}
                  open={tier === 1 || section === "VARC" ? true : undefined}
                >
                  <summary>
                    <span>{f.name}</span>
                    <span className="small muted">
                      {f.frequency} · {f.total} questions · {f.sets} identified
                      sets
                    </span>
                  </summary>
                  {!f.total ? (
                    <p className="small muted">
                      Not sampled. Start with a fresh diagnostic before
                      prescribing a lesson.
                    </p>
                  ) : (
                    <>
                      <p className="small muted">
                        {f.correct}/{f.attempted} attempted correct ·{" "}
                        {f.skipped} skipped · {fmt(f.accuracy)}% accuracy ·{" "}
                        {fmt(f.observedShare)}% observed question share ·{" "}
                        {f.marks} net marks
                      </p>
                      <div className="table-scroll">
                        <table>
                          <thead>
                            <tr>
                              <th>Topic</th>
                              <th>Correct / tried</th>
                              <th>Skipped</th>
                              <th>Accuracy</th>
                              <th>Time / seen question</th>
                              <th>Practice status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {f.topics.map((t) => {
                              const current = data.topics.find(
                                (x) =>
                                  x.section === section && x.topic === t.topic,
                              );
                              return (
                                <tr key={t.topic}>
                                  <td>
                                    <button
                                      className="topic-link"
                                      onClick={() => onTopic(current || t)}
                                    >
                                      {t.topic}
                                    </button>
                                  </td>
                                  <td>
                                    {t.correct}/{t.attempted}
                                  </td>
                                  <td>
                                    {t.skipped}/{t.total}
                                  </td>
                                  <td>{fmt(t.accuracy)}%</td>
                                  <td>{duration(t.seconds / t.total)}</td>
                                  <td>
                                    {current?.repairState || t.repairState}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </details>
              ))}
            </div>
          )
        );
      })}
    </Panel>
  );
}
function SectionPage(props) {
  const { section, data, onTopic, onOpen } = props;
  const [inspect, setInspect] = useState(false);
  const r = data.analytics.sections[section];
  const topics = data.topics.filter((t) => t.section === section).slice(0, 5);
  return (
    <>
      <div className="page-intro">
        <div className="eyebrow">{section} · CONSOLIDATED EVIDENCE</div>
        <h1>
          {section === "QA"
            ? "Build reliable routes."
            : section === "DILR"
              ? "Build the model. Then solve."
              : "Read the claim. Test the options."}
        </h1>
        <p>
          All {r.count} full mocks, current repair evidence, and the next
          specific action.
        </p>
      </div>
      <div className="stats-row">
        <Stat
          label="MEAN SECTION COHORT PERCENTILE"
          value={fmt(r.percentile, 2)}
          detail={`${r.percentileCount}/${r.count} reported · not a CAT forecast`}
        />
        <Stat
          label="MEAN NET MARKS"
          value={fmt(r.score)}
          detail="All original full mocks"
        />
        <Stat
          label="POOLED ACCURACY"
          value={fmt(r.accuracy) + "%"}
          detail={`${r.correct}/${r.attempted} correct · ${r.skipped} skipped`}
        />
        <Stat
          label="OBSERVED PERCENTILE RANGE"
          value={r.range ? `${fmt(r.range[0], 1)}–${fmt(r.range[1], 1)}` : "—"}
          detail="Historical spread · not a confidence interval"
        />
      </div>
      <TrendPanel data={data} section={section} />
      <TrendAnalysis data={data} section={section} />
      <div className="two-col lower">
        <Panel title="Repair priorities" kicker="CURRENT CHECKED EVIDENCE">
          {topics.map((t) => (
            <button
              className="repair-priority"
              key={t.topic}
              onClick={() => onTopic(t)}
            >
              <span>
                <b>{t.topic}</b>
                <small>
                  {t.family} · {t.repairState}
                </small>
              </span>
              <span>
                {t.attempted ? `${fmt(t.accuracy)}%` : "Diagnostic"}
                <ChevronRight size={14} />
              </span>
            </button>
          ))}
        </Panel>
        <Panel
          title="Your next specific actions"
          kicker="SOLVE → REPAIR → TRANSFER"
        >
          {data.tasks
            .filter(
              (t) =>
                t.section === section &&
                t.status !== "done" &&
                t.status !== "retired",
            )
            .slice(0, 3)
            .map((t) => (
              <TaskCard key={t.id} task={t} onOpen={onOpen} />
            ))}
          <p className="small muted">
            A video is followed by a 5–10-question assessment. Fresh and delayed
            results update repair status; familiar redo accuracy does not
            establish mastery.
          </p>
        </Panel>
      </div>
      <HierarchyPanel data={data} section={section} onTopic={onTopic} />
      <details
        className="panel lower attempt-inspector"
        onToggle={(e) => setInspect(e.currentTarget.open)}
      >
        <summary>
          Inspect an individual attempt · detailed timing and original results
        </summary>
        {inspect && <AttemptDetails {...props} />}
      </details>
    </>
  );
}
function AttemptArchive({ data, onMock }) {
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState(""),
    [page, setPage] = useState(0);
  const filtered = data.mocks.filter((m) =>
    m.name.toLowerCase().includes(query.toLowerCase()),
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / 10));
  const current = Math.min(page, pageCount - 1);
  return (
    <details
      className="panel lower attempt-inspector"
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary>Individual mock archive · {data.mocks.length} attempts</summary>
      {open && (
        <>
          <label className="archive-search">
            Find an attempt{" "}
            <input
              aria-label="Find an attempt"
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(0);
              }}
              placeholder="Search mock name"
            />
          </label>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Attempt</th>
                  <th>Date</th>
                  <th>Score</th>
                  <th>Mock percentile</th>
                  <th>Provider CAT prediction</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(current * 10, current * 10 + 10).map((m) => (
                  <tr key={m.mock_id}>
                    <td>{m.name}</td>
                    <td>{m.attempt.attempt_date || "Unknown"}</td>
                    <td>{m.overall.score}</td>
                    <td>{fmt(m.overall.provider_percentile, 2)}</td>
                    <td>
                      {fmt(m.provider_estimates?.predicted_cat_percentile, 2)}
                    </td>
                    <td>
                      <button className="secondary" onClick={() => onMock(m)}>
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filtered.length && <Empty>No matching attempts.</Empty>}
          </div>
          <div className="pagination">
            <button
              className="secondary"
              disabled={current === 0}
              onClick={() => setPage(current - 1)}
            >
              Previous
            </button>
            <span>
              Page {current + 1} of {pageCount}
            </span>
            <button
              className="secondary"
              disabled={current + 1 >= pageCount}
              onClick={() => setPage(current + 1)}
            >
              Next
            </button>
          </div>
        </>
      )}
    </details>
  );
}

function Home({ data, onOpen }) {
  const [measure, setMeasure] = useState("cohort");
  const summary = data.analytics.summary;
  const complete = data.tasks.filter((t) => t.status === "done").length;
  const missed = data.tasks.filter((t) => t.status === "missed").length;
  const next =
    data.tasks.find((t) => t.status === "today") ||
    data.tasks.find((t) => t.status === "missed");
  return (
    <>
      <div className="page-intro">
        <div className="eyebrow">YOUR NEXT ATTEMPT STARTS HERE</div>
        <h1>
          Make the next question count<span className="accent">.</span>
        </h1>
        <p>Solve first. Find the gap. Come back stronger.</p>
      </div>
      <div className="hero-grid">
        <section className="forecast panel">
          <div className="forecast-top">
            <Badge tone="accent">CAT 2026 · 99+ TARGET</Badge>
            <Target size={24} />
          </div>
          <span className="eyebrow">
            {data.estimate.kind === "mock-proxy"
              ? "ALL-MOCK COHORT PROXY"
              : "ALL-MOCK PROVISIONAL CAT ESTIMATE"}
          </span>
          <div className="forecast-number">
            {fmt(data.estimate.value, 2)}
            <span>/ 100</span>
          </div>
          <p>
            {data.estimate.kind === "mock-proxy"
              ? "Mock-cohort proxy"
              : "Provider CAT estimates"}{" "}
            · {data.estimate.count}/{data.estimate.mockCount} full mocks
          </p>
          <div className="goal-track">
            <span
              style={{ width: Math.min(100, data.estimate.value || 0) + "%" }}
            />
          </div>
          <div className="forecast-bottom">
            <span>
              Target <b>99+</b>
            </span>
            <span>
              Mock cohort <b>{fmt(summary.percentile, 2)}</b>
            </span>
          </div>
          <small>{data.estimate.note}</small>
        </section>
        <Panel
          title="A balanced score opens doors"
          kicker="SECTIONAL CHECK-IN"
          action={<Badge>Goal &gt;90 each</Badge>}
        >
          <div className="section-checks">
            {["VARC", "DILR", "QA"].map((s) => {
              const v = data.analytics.sections[s];
              return (
                <button key={s} onClick={() => go(s)}>
                  <div className="section-check-name">
                    <span style={{ background: "#8995a5" }} />
                    {s}
                    <ArrowUpRight size={14} />
                  </div>
                  <strong>
                    {fmt(v?.percentile, 2)}
                    <small>mean cohort percentile</small>
                  </strong>
                  <div className="mini-track">
                    <span
                      style={{
                        width: (v?.percentile || 0) + "%",
                        background: "#8995a5",
                      }}
                    />
                  </div>
                  <span className="small muted">
                    {fmt(v?.score)} mean marks · {fmt(v?.accuracy)}% accuracy
                  </span>
                </button>
              );
            })}
          </div>
          <div className="subtle-note">
            <ShieldCheck size={16} /> All {data.analytics.total} full mocks
            contribute. Section cohort means are not calibrated CAT forecasts;
            missing dates limit trend analysis.
          </div>
        </Panel>
      </div>
      <div className="stats-row">
        <Stat
          label="MISSIONS COMPLETE"
          value={complete}
          detail="Evidence saved, plan updated"
        />
        <Stat
          label="CONSISTENCY"
          value={`${data.streak} days`}
          detail="Build a repeatable rhythm"
        />
        <Stat
          label="REPAIR XP"
          value={data.xp}
          detail={`Level ${data.level} · next at ${data.level * 250} XP`}
          color="#b3bdc9"
        />
        <Stat
          label="OPEN CARRYOVERS"
          value={missed}
          detail="Recover the work, keep its history"
        />
      </div>
      <div className="title-row">
        <div>
          <span className="eyebrow">THE DAILY LOOP</span>
          <h2>Your mission board</h2>
        </div>
        <button className="secondary" onClick={() => go("board")}>
          Full board <ArrowUpRight size={15} />
        </button>
      </div>
      <Board data={data} onOpen={onOpen} />
      <TrendPanel
        data={data}
        compact
        measure={measure}
        onMeasureChange={setMeasure}
      />
      <div className="two-col lower">
        <TrendAnalysis data={data} measure={measure} />
        <Risk data={data} />
      </div>
    </>
  );
}
function Risk({ data }) {
  const risk = data.risk;
  return (
    <Panel
      title="What’s at risk if it stays unresolved?"
      kicker="ACCOUNTABILITY SCENARIO"
      action={<TriangleAlert size={18} color="#b3bdc9" />}
    >
      <div className="risk-summary">
        <strong>
          {risk.marks}
          <small>marks exposed</small>
        </strong>
        <strong>
          {risk.range
            ? `${fmt(risk.range[0])}–${fmt(risk.range[1])}`
            : risk.scenarios.some((s) => s.below != null)
              ? `≤${fmt(Math.max(...risk.scenarios.map((s) => s.below || 0)))}`
              : "—"}
          <small>scenario percentile</small>
        </strong>
      </div>
      {risk.exposure.length ? (
        <Bars
          height={150}
          data={risk.exposure.map((t) => ({ name: t.topic, marks: t.marks }))}
          series={[{ key: "marks", label: "Topic exposure", color: "#78acd8" }]}
        />
      ) : (
        <p className="muted">No mapped topic exposure from overdue tasks.</p>
      )}
      <p className="chart-note">
        {risk.penalty > 0 &&
          `${risk.penalty} point(s) from your missed-mock rule. `}
        Assumed loss, not a measured drop. Repeated reminders do not add
        penalties.
      </p>
      <details>
        <summary>How this is calculated</summary>
        <p className="small muted">{risk.note}</p>
        <a href={risk.source} target="_blank" rel="noreferrer">
          IMS historical curves <ExternalLink size={12} />
        </a>
      </details>
    </Panel>
  );
}
function AttemptDetails({ section, data, onTopic, onQuestion, onOpen }) {
  const [only, setOnly] = useState(data.profile.baselineMockId);
  const mock = data.mocks.find((m) => m.mock_id === only) || data.mocks[0];
  const r = mock.sections[section];
  const qs = data.questions.filter(
    (q) => q.mock_id === only && q.section === section,
  );
  const topics = data.topics.filter((t) => t.section === section);
  const perf = topics.map((t) => ({
    name: t.topic,
    accuracy: t.accuracy,
    n: t.attempted,
  }));
  const sets = section === "DILR" ? mock.sets : [];
  const scatter =
    section === "DILR"
      ? sets.map((s) => ({
          name: "Q" + s.question_numbers.join("/"),
          minutes: s.time_seconds / 60,
          marks: s.marks,
        }))
      : qs.map((q) => ({
          name: "Q" + q.question_number,
          minutes: q.time_seconds / 60,
          marks: q.marks,
          id: q.id,
        }));
  const history = data.mocks.map((m) => ({
    name: m.name.replace(" 2026", ""),
    percentile: m.sections[section].provider_percentile,
  }));
  return (
    <>
      <div className="page-intro title-row">
        <div>
          <div className="eyebrow">
            {section === "QA"
              ? "QUANTITATIVE APTITUDE"
              : section === "DILR"
                ? "DATA INTERPRETATION & LOGICAL REASONING"
                : "VERBAL ABILITY & READING COMPREHENSION"}
          </div>
          <h1>
            {section === "QA"
              ? "Build reliable routes."
              : section === "DILR"
                ? "Build the model. Then solve."
                : "Read the claim. Test the options."}
          </h1>
          <p>
            Current diagnosis, specific repairs, and the evidence behind them.
          </p>
        </div>
        <select
          aria-label="Selected mock"
          value={only}
          onChange={(e) => setOnly(e.target.value)}
        >
          {data.mocks.map((m) => (
            <option key={m.mock_id} value={m.mock_id}>
              {m.name}
            </option>
          ))}
        </select>
      </div>
      <div className="stats-row">
        <Stat
          label="SELECTED MOCK PERCENTILE"
          value={fmt(r.provider_percentile, 2)}
          detail="CAT sectional forecast is uncalibrated"
          color="#b3bdc9"
        />
        <Stat
          label="NET MARKS"
          value={r.score}
          detail={`${r.statistics.correct} correct · ${r.statistics.incorrect} wrong`}
        />
        <Stat
          label="ACCURACY"
          value={fmt(r.statistics.accuracy_percent) + "%"}
          detail={`${r.statistics.attempted} attempts · ${r.statistics.skipped} skipped`}
        />
        <Stat
          label="RESULT SOURCE"
          value="Original"
          detail="Reattempts remain separate from original performance"
        />
      </div>
      <div className="two-col">
        <Panel
          title="Where the repair effort belongs"
          kicker="ACCURACY BY TOPIC · ALL RECOVERED MOCKS"
        >
          <Bars
            data={perf}
            percent
            series={[
              {
                key: "accuracy",
                label: "Attempt accuracy",
                color: COLORS[section],
              },
            ]}
            click={(name) => onTopic(topics.find((t) => t.topic === name))}
          />
          <p className="chart-note">
            Untested topics have no accuracy value. Sample counts are in the
            repair table.
          </p>
        </Panel>
        <Panel
          title={
            section === "DILR"
              ? "Which sets returned the time?"
              : "Where did the minutes go?"
          }
          kicker={
            section === "DILR"
              ? "SET TIME VS NET MARKS"
              : "QUESTION TIME VS NET MARKS"
          }
        >
          <div style={{ height: 230 }}>
            <ResponsiveContainer>
              <ScatterChart
                margin={{ top: 15, right: 15, left: -18, bottom: 20 }}
              >
                <CartesianGrid {...grid} />
                <XAxis
                  {...axis}
                  type="number"
                  dataKey="minutes"
                  name="Minutes"
                  label={{
                    value: "Recorded minutes (shared setup may be included)",
                    position: "bottom",
                    fill: "#888",
                    fontSize: 10,
                    offset: 4,
                  }}
                />
                <YAxis {...axis} type="number" dataKey="marks" name="Marks" />
                <Tooltip
                  {...tip}
                  content={({ active, payload }) =>
                    active && payload?.[0] ? (
                      <div className="chart-tooltip">
                        {payload[0].payload.name}
                        <br />
                        {fmt(payload[0].payload.minutes)} min ·{" "}
                        {payload[0].payload.marks} marks
                      </div>
                    ) : null
                  }
                />
                <Scatter
                  data={scatter}
                  fill={COLORS[section]}
                  onClick={(point) => {
                    if (point.id)
                      onQuestion(data.questions.find((q) => q.id === point.id));
                  }}
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <p className="chart-note">
            Question times are attributed platform values, not reconstructed
            thinking time.
          </p>
        </Panel>
      </div>
      <Panel
        title="Repair priorities"
        kicker="CLICK A TOPIC FOR THE QUESTION EVIDENCE"
        className="lower"
      >
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Topic</th>
                <th>Correct / attempted</th>
                <th>Skipped</th>
                <th>Accuracy</th>
                <th>Repair state</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {topics.map((t) => (
                <tr
                  key={t.topic}
                  onClick={() => onTopic(t)}
                  className="clickable"
                >
                  <td>
                    <b>{t.topic}</b>
                    <small>{t.family}</small>
                  </td>
                  <td>
                    {t.correct} / {t.attempted}
                  </td>
                  <td>{t.skipped}</td>
                  <td>
                    {fmt(t.accuracy)}
                    {t.accuracy != null ? "%" : ""}
                  </td>
                  <td>
                    <Badge tone={t.repairState === "Untested" ? "" : "amber"}>
                      {t.repairState}
                    </Badge>
                  </td>
                  <td>
                    <ArrowUpRight size={15} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <div className="two-col lower">
        <Panel
          title="Sectional results across the records"
          kicker="COHORT RESULTS · DATES UNKNOWN"
        >
          <Bars
            data={history}
            percent
            series={[
              {
                key: "percentile",
                label: "Mock percentile",
                color: COLORS[section],
              },
            ]}
          />
        </Panel>
        <Panel
          title="Next section missions"
          kicker="ACTIONS, NOT A CHAPTER BACKLOG"
        >
          {data.tasks
            .filter(
              (t) =>
                t.section === section &&
                !["done", "retired"].includes(t.status),
            )
            .slice(0, 3)
            .map((t) => (
              <TaskCard key={t.id} task={t} onOpen={onOpen} compact />
            ))}
          <p className="chart-note">
            Mock and sectional checkpoints require prior review and fresh
            transfer. Unknown topics are assessed before lessons.
          </p>
        </Panel>
      </div>
      {section !== "VARC" && (
        <Panel
          title="Preparation allocation"
          kicker="STUDY PRIORITIES, NOT EXAM WEIGHTAGE"
          className="lower"
        >
          <Bars
            data={Object.entries(
              section === "QA"
                ? data.profile.qaAllocation
                : data.profile.dilrAllocation,
            ).map(([name, planned]) => {
              const sessions = data.sessions.filter(
                (s) => s.completedAt && s.section === section,
              );
              const total = sessions.reduce((n, s) => n + s.elapsedSeconds, 0);
              const actual = sessions
                .filter((s) =>
                  data.topics.some(
                    (t) =>
                      t.topic === s.topic &&
                      (t.practiceBucket || t.family) === name,
                  ),
                )
                .reduce((n, s) => n + s.elapsedSeconds, 0);
              return {
                name,
                planned,
                actual: total ? (100 * actual) / total : null,
              };
            })}
            percent
            series={[
              {
                key: "planned",
                label: "Starting allocation",
                color: COLORS[section],
              },
              {
                key: "actual",
                label: "Completed practice time",
                color: "#a3a3ae",
              },
            ]}
          />
          <p className="chart-note">
            Unclassified or mixed practice remains outside the topic allocation
            bars. No completed practice is assumed.
          </p>
        </Panel>
      )}
    </>
  );
}
function Repairs({ data, onTopic }) {
  return (
    <>
      <div className="page-intro">
        <div className="eyebrow">THE REPAIR LAB</div>
        <h1>Turn an error into a skill.</h1>
        <p>
          Original errors locate the gap. Fresh transfer and retention establish
          progress.
        </p>
      </div>
      <div className="two-col">
        <Panel
          title="Consolidated repair map"
          kicker="ALL MOCKS · CLICK A TOPIC"
        >
          <p className="chart-note">
            Each cell summarizes all original attempts. Colour shows accuracy:
            green ≥80%, blue ≥50%, pink &lt;50%, grey untested. Fresh practice
            status is shown separately.
          </p>
          <div className="repair-map">
            {["QA", "DILR", "VARC"].map((section) => (
              <div key={section}>
                <h4>{section}</h4>
                {data.topics
                  .filter((t) => t.section === section)
                  .map((t) => (
                    <button
                      className="repair-map-cell"
                      key={t.topic}
                      onClick={() => onTopic(t)}
                      style={{
                        borderLeftColor:
                          t.accuracy == null
                            ? "#676f7b"
                            : t.accuracy >= 80
                              ? "#79b99c"
                              : t.accuracy >= 50
                                ? "#78acd8"
                                : "#e48494",
                      }}
                    >
                      <b>{t.topic}</b>
                      <span>
                        {t.correct}/{t.attempted} correct · {t.skipped} skipped
                      </span>
                      <small>{t.repairState}</small>
                    </button>
                  ))}
              </div>
            ))}
          </div>
        </Panel>
        <div>
          <Panel title="The next repair loop" kicker="EVIDENCE GATES">
            <ol className="repair-loop">
              {[
                ["Cold attempt", "Expose the exact obstacle before hints."],
                [
                  "Targeted repair",
                  "A lesson only when missing knowledge is demonstrated.",
                ],
                [
                  "Fresh transfer",
                  "QA: ≥80% first. DILR: two consecutive fully correct fresh sets.",
                ],
                [
                  "Delayed retest",
                  "Recheck after about 48 hours, then in the following week.",
                ],
              ].map(([a, b], i) => (
                <li key={a}>
                  <span>{i + 1}</span>
                  <div>
                    <b>{a}</b>
                    <p>{b}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Panel>
          <div className="lower">
            <Risk data={data} />
          </div>
        </div>
      </div>
      <Panel
        title="Practice evidence"
        kicker="ALL COMPLETED SESSIONS"
        className="lower"
      >
        {data.sessions.some((s) => s.completedAt) ? (
          <Bars
            data={data.sessions
              .filter((s) => s.completedAt)
              .map((s, i) => ({
                name: "Session " + (i + 1),
                accuracy: s.answers.length
                  ? (100 * s.answers.filter((a) => a.correct).length) /
                    s.answers.length
                  : s.external?.accuracy,
                minutes: s.elapsedSeconds / 60,
              }))}
            percent
            series={[
              { key: "accuracy", label: "Checked accuracy", color: "#83b8a1" },
            ]}
          />
        ) : (
          <Empty>
            Your first completed session will begin this graph. No progress is
            assumed from the historical records.
          </Empty>
        )}
      </Panel>
    </>
  );
}
function HistoryPage({ data, onMock }) {
  const [measure, setMeasure] = useState("cohort");
  return (
    <>
      <div className="page-intro">
        <div className="eyebrow">THE EVIDENCE ROOM</div>
        <h1>Follow the trend. Inspect the dip.</h1>
        <p>
          Consolidated evidence first. Open the archive for individual analyses
          and question records.
        </p>
      </div>
      <div className="stats-row">
        <Stat
          label="FULL MOCKS"
          value={data.analytics.total}
          detail="Every original contributes"
        />
        <Stat
          label="CONSOLIDATED CAT ESTIMATE"
          value={fmt(data.estimate.value, 2)}
          detail={`${data.estimate.count} available ${data.estimate.kind === "provider" ? "provider predictions" : "cohort proxies"}`}
        />
        <Stat
          label="MEAN MOCK COHORT PERCENTILE"
          value={fmt(data.analytics.summary.percentile, 2)}
          detail="Distinct from CAT predictions"
        />
        <Stat
          label="POOLED ACCURACY"
          value={fmt(data.analytics.summary.accuracy) + "%"}
          detail="Correct / attempted across all mocks"
        />
      </div>
      <TrendPanel data={data} measure={measure} onMeasureChange={setMeasure} />
      <TrendAnalysis data={data} measure={measure} />
      <AttemptArchive data={data} onMock={onMock} />
      <div className="lower">
        <Panel title="Plan revisions" kicker="WHY THE QUEUE CHANGED">
          {data.revisions.length ? (
            data.revisions.slice(0, 6).map((r) => (
              <div className="timeline-item" key={r.id}>
                <span className="dot" />
                <div>
                  <b>{r.reason}</b>
                  <small>
                    {new Date(r.at).toLocaleString("en-IN", {
                      timeZone: "Asia/Calcutta",
                    })}{" "}
                    · {r.openTasks.length} open missions
                  </small>
                </div>
              </div>
            ))
          ) : (
            <Empty>No plan revisions yet.</Empty>
          )}
        </Panel>
      </div>
      <Panel title="Session history" className="lower">
        {data.sessions.some((s) => s.completedAt) ? (
          data.sessions
            .filter((s) => s.completedAt)
            .map((s) => (
              <div className="timeline-item" key={s.id}>
                <CheckCircle2 size={18} />
                <div>
                  <b>
                    {data.tasks.find((t) => t.id === s.taskId)?.title ||
                      s.taskId}
                  </b>
                  <small>
                    {s.stage} · {duration(s.elapsedSeconds)} active · {s.report}
                  </small>
                </div>
              </div>
            ))
        ) : (
          <Empty>
            Timed responses and completed external work will appear here.
          </Empty>
        )}
      </Panel>
    </>
  );
}
function QuestionTable({ questions, onQuestion }) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Question</th>
            <th>Topic</th>
            <th>Outcome</th>
            <th>Marks</th>
            <th>Time</th>
            <th>Benchmark</th>
          </tr>
        </thead>
        <tbody>
          {questions.map((q) => (
            <tr key={q.id} className="clickable" onClick={() => onQuestion(q)}>
              <td>
                {q.section} Q{q.question_number}
              </td>
              <td>{q.topic}</td>
              <td>
                <Badge
                  tone={
                    q.outcome === "wrong"
                      ? "red"
                      : q.outcome === "correct"
                        ? "green"
                        : ""
                  }
                >
                  {q.outcome}
                </Badge>
              </td>
              <td>{q.marks}</td>
              <td>{duration(q.time_seconds)}</td>
              <td>{duration(q.provider_benchmark?.time_seconds)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function SettingsPage({ data, refresh, notify }) {
  const [p, setP] = useState(data.profile);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <div className="page-intro">
        <div className="eyebrow">MAKE IT WORK FOR YOU</div>
        <h1>Your setup.</h1>
        <p>Local records, a shared Git repository, and visible sync status.</p>
      </div>
      <div className="two-col">
        <Panel title="Planning preferences">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await api("/api/profile", p);
                await refresh();
                notify("Preferences saved. The plan has been recalculated.");
              } catch (e) {
                notify(e.message, true);
              }
              setBusy(false);
            }}
          >
            <label>
              Name
              <input
                value={p.name}
                onChange={(e) => setP({ ...p, name: e.target.value })}
              />
            </label>
            <label>
              Individual-review starting mock
              <select
                value={p.baselineMockId}
                onChange={(e) => setP({ ...p, baselineMockId: e.target.value })}
              >
                {data.mocks.map((m) => (
                  <option key={m.mock_id} value={m.mock_id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Optional daily capacity (minutes)
              <input
                type="number"
                min="30"
                placeholder="Flexible — no fixed ceiling"
                value={p.dailyMinutes ?? ""}
                onChange={(e) =>
                  setP({
                    ...p,
                    dailyMinutes:
                      e.target.value === "" ? null : Number(e.target.value),
                  })
                }
              />
            </label>
            <label>
              Official exam date (leave blank until verified)
              <input
                type="date"
                value={p.examDate ?? ""}
                onChange={(e) =>
                  setP({ ...p, examDate: e.target.value || null })
                }
              />
            </label>
            <label className="check-label">
              <input
                type="checkbox"
                checked={p.autoSync}
                onChange={(e) => setP({ ...p, autoSync: e.target.checked })}
              />
              Commit and push preparation updates automatically
            </label>
            <button className="primary" disabled={busy}>
              Save preferences <Check size={15} />
            </button>
          </form>
        </Panel>
        <div>
          <Panel
            title="GitHub synchronisation"
            action={<GitBranch size={18} />}
          >
            <Badge tone={data.sync.state === "synced" ? "green" : "amber"}>
              {data.sync.state === "synced"
                ? "Synced"
                : data.sync.state === "attention"
                  ? "Needs attention"
                  : "Pending push"}
            </Badge>
            <p className="muted small">{data.sync.message}</p>
            {data.sync.sha && (
              <code>
                {data.sync.sha.slice(0, 12)} · {data.sync.branch}
              </code>
            )}
            <button
              className="secondary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const r = await api("/api/sync", {});
                  await refresh();
                  notify(
                    r.state === "synced"
                      ? "Remote commit verified."
                      : r.message,
                    r.state !== "synced",
                  );
                } catch (e) {
                  notify(e.message, true);
                }
                setBusy(false);
              }}
            >
              <RefreshCw size={15} />
              Sync now
            </button>
          </Panel>
          <Panel title="Daily reminders" className="lower">
            <p className="muted small">
              Warnings appear here and can use desktop notifications while this
              page is open. For reminders with the browser closed, install the
              documented local background job. This computer must be awake.
            </p>
            <button
              className="secondary"
              onClick={async () => {
                if (!("Notification" in window))
                  return notify(
                    "Desktop notifications are unavailable in this browser.",
                    true,
                  );
                const status = await Notification.requestPermission();
                notify(
                  status === "granted"
                    ? "Desktop notifications enabled for this browser."
                    : "Desktop notifications were not enabled.",
                  status !== "granted",
                );
              }}
            >
              <Bell size={15} />
              Enable browser notifications
            </button>
            <p className="chart-note">
              Daily review: 20:00 Asia/Calcutta. No messages are sent to other
              people.
            </p>
          </Panel>
          <Panel title="Portable records" className="lower">
            <a
              className="secondary"
              href="/api/export"
              download="cat-hq-backup.json"
            >
              <Download size={15} />
              Download backup
            </a>
            <p className="chart-note">
              The repository remains the canonical copy. Runtime locks and sync
              logs stay on this machine.
            </p>
          </Panel>
        </div>
      </div>
    </>
  );
}
function ImportPage({ data, notify, refresh }) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [count, setCount] = useState(0);
  return (
    <>
      <div className="page-intro">
        <div className="eyebrow">THE SHARED HANDOFF</div>
        <h1>Bring the evidence in.</h1>
        <p>
          The analysis tab pushes records to GitHub. Sync here, or import a
          structured package.
        </p>
      </div>
      <div className="stats-row">
        <Stat
          label="MOCK RECORDS"
          value={data.mocks.length}
          detail="Original attempts kept separate"
        />
        <Stat
          label="QUESTION ROWS"
          value={data.coverage.rows}
          detail="Scores, topics and recorded timing"
        />
        <Stat
          label="AVAILABLE QUESTION VIEWS"
          value={data.coverage.fullContent}
          detail="Recovered excerpts are not full questions"
        />
        <Stat
          label="DATED ATTEMPTS"
          value={data.coverage.datedMocks}
          detail="No dates inferred from review dates"
        />
      </div>
      <div className="two-col">
        <Panel
          title="Import a question or mock package"
          kicker="JSON · CONTRACT VERSION 1.1"
        >
          <label className="file-input">
            <Upload size={18} />
            Choose JSON file
            <input
              type="file"
              accept="application/json,.json"
              onChange={async (e) => {
                if (e.target.files[0]) setInput(await e.target.files[0].text());
              }}
            />
          </label>
          <textarea
            aria-label="Import JSON"
            rows={14}
            placeholder='{"kind":"questions","questions":[…]}'
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button
            className="primary"
            disabled={busy || !input}
            onClick={async () => {
              setBusy(true);
              try {
                const r = await api("/api/import", JSON.parse(input));
                setCount(r.count);
                await refresh();
                notify(`${r.count} records imported; the plan has refreshed.`);
                setInput("");
              } catch (e) {
                notify(e.message, true);
              }
              setBusy(false);
            }}
          >
            Validate and import <ArrowRight size={15} />
          </button>
          {count > 0 && <p>{count} records imported.</p>}
        </Panel>
        <Panel title="What the analysis tab should provide">
          <p className="muted">
            Read <code>docs/ANALYSIS-CONTRACT.md</code> in the shared
            repository. Original metadata remains untouched; complete question
            content can be added separately.
          </p>
          <pre>
            {JSON.stringify(
              {
                kind: "questions",
                questions: [
                  {
                    id: "unique-source-id",
                    section: "QA",
                    topic: "Simple & Compound Interest",
                    question_text: "Complete exact question text",
                    options: ["Option A", "Option B"],
                    answer: "A",
                    explanation: "Verified solution",
                    fresh: true,
                    source_url: "https://example.com/source",
                    question_content_status: "complete",
                  },
                ],
              },
              null,
              2,
            )}
          </pre>
          <p className="chart-note">
            For an existing mock question, reuse its exact composite ID. Include
            passage/shared set information in <code>passage</code>. A fresh
            question must be unseen, not a renamed familiar question.
          </p>
        </Panel>
      </div>
    </>
  );
}
function Practice({ id, data, refresh, notify }) {
  const [s, setS] = useState(null),
    [index, setIndex] = useState(0),
    [response, setResponse] = useState(""),
    [reason, setReason] = useState(""),
    [selfCorrect, setSelfCorrect] = useState(""),
    [report, setReport] = useState(""),
    [external, setExternal] = useState({ total: "", correct: "", source: "" }),
    [mockId, setMockId] = useState(""),
    [busy, setBusy] = useState(false),
    [tick, setTick] = useState(Date.now());
  const get = useCallback(async () => {
    try {
      const current = await api("/api/session/" + id);
      setS(current);
      setIndex(
        Math.max(
          0,
          current.questions.findIndex((q) => q.id === current.focusedId),
        ),
      );
    } catch (e) {
      notify(e.message, true);
    }
  }, [id]);
  useEffect(() => {
    get();
    const interval = setInterval(() => setTick(Date.now()), 500);
    return () => clearInterval(interval);
  }, [get]);
  if (!s)
    return (
      <div className="loading">
        <LoaderCircle className="spin" />
        Loading your session…
      </div>
    );
  const task = s.task,
    q = s.questions[index],
    saved = s.answers.find((a) => a.questionId === q?.id);
  const seconds = Math.round(
    (s.accumulatedMs +
      (s.runningSince ? tick - Date.parse(s.runningSince) : 0)) /
      1000,
  );
  const allAnswered = s.answers.length === s.questions.length;
  const submit = async (action, input) => {
    setBusy(true);
    try {
      const r = await api("/api/session/" + id + "/" + action, {
        version: s.version,
        ...input,
      });
      setS(r);
      if (action === "answer") {
        setResponse("");
        setReason("");
        setSelfCorrect("");
        notify("Response and time saved.");
      }
      if (action === "finish") {
        await refresh();
        notify("Session complete. Your next steps have been updated.");
      }
    } catch (e) {
      notify(e.message, true);
      await get();
    }
    setBusy(false);
  };
  if (s.completedAt)
    return (
      <>
        <div className="page-intro">
          <Badge tone="green">
            <Check size={13} />
            SESSION COMPLETE
          </Badge>
          <h1>You closed the loop.</h1>
          <p>Your work is saved. The plan has changed around the evidence.</p>
        </div>
        <div className="stats-row">
          <Stat
            label="ACTIVE TIME"
            value={duration(s.elapsedSeconds)}
            detail="Pauses excluded"
          />
          <Stat
            label="SAVED RESPONSES"
            value={s.answers.length}
            detail="Original attempt preserved"
          />
          <Stat
            label="CHECKED CORRECT"
            value={s.answers.filter((a) => a.correct).length}
            detail="Self-checks remain labelled"
          />
          <Stat
            label="NEW STEP"
            value="Queued"
            detail="Repair, transfer or retention"
          />
        </div>
        <div className="two-col">
          <Panel title="Time per response">
            <Bars
              data={s.answers.map((a, i) => ({
                name:
                  "Q" +
                  (s.questions.find((q) => q.id === a.questionId)
                    ?.question_number || i + 1),
                seconds: a.seconds,
              }))}
              series={[
                { key: "seconds", label: "Active seconds", color: "#b39fe2" },
              ]}
            />
          </Panel>
          <Panel title="What changed">
            <p>{s.report}</p>
            <p className="muted">
              {s.external?.total
                ? `${s.external.correct}/${s.external.total} external outcomes · ${s.external.source}. Self-reported evidence.`
                : ""}
            </p>
            {data.tasks
              .filter((t) => t.parentTaskId === task.id)
              .map((t) => (
                <TaskCard task={t} key={t.id} onOpen={() => go("board")} />
              ))}
            <button className="primary" onClick={() => go("board")}>
              Back to the board <ArrowRight size={15} />
            </button>
          </Panel>
        </div>
        <Panel title="Response review" className="lower">
          {s.answers.map((a, i) => (
            <div className="review-answer" key={a.questionId}>
              <Badge
                tone={a.correct ? "green" : a.correct === false ? "red" : ""}
              >
                {a.correct
                  ? "Correct"
                  : a.correct === false
                    ? "Needs repair"
                    : "Ungraded"}
              </Badge>
              <b>
                Q{i + 1} · {a.response || "Skipped"}
              </b>
              <span>
                {duration(a.seconds)} · {a.verification}
              </span>
              <p>{a.reason}</p>
            </div>
          ))}
        </Panel>
      </>
    );
  return (
    <>
      <div className="practice-header">
        <button className="text-btn" onClick={() => go("board")}>
          <ChevronLeft size={16} />
          Mission board
        </button>
        <Badge tone={task.section.toLowerCase()}>
          {task.section} · {task.stage}
        </Badge>
      </div>
      <h1 className="practice-title">{task.title}</h1>
      <div className="practice-layout">
        <section className="panel practice-question">
          <div className="question-top">
            <span className="eyebrow">
              {s.questions.length
                ? `QUESTION ${index + 1} OF ${s.questions.length}`
                : "EXTERNAL PRACTICE WORKSPACE"}
            </span>
            <div className="timer">
              <Timer size={17} />
              {duration(seconds)}
              <button
                className="icon-btn"
                disabled={busy}
                aria-label={s.runningSince ? "Pause timer" : "Resume timer"}
                onClick={() => submit("timer", { running: !s.runningSince })}
              >
                {s.runningSince ? <Pause size={17} /> : <Play size={17} />}
              </button>
            </div>
          </div>
          <div className="goal-track session-progress">
            <span
              style={{
                width:
                  (s.questions.length
                    ? (s.answers.length / s.questions.length) * 100
                    : 0) + "%",
              }}
            />
          </div>
          {q ? (
            <>
              <div className="question-label">
                <Badge>{q.topic}</Badge>
                <span className="muted small">
                  {q.mock_id || q.source || "Question bank"} · Q
                  {q.question_number || index + 1}
                </span>
              </div>
              {q.databaseFile && (
                <p className="chart-note">
                  SQLite question view · source collection is still being
                  updated.
                </p>
              )}
              {q.question_text || q.question_html ? (
                <>
                  {q.passage_html ? (
                    <RichContent html={q.passage_html} className="passage" />
                  ) : (
                    q.passage && <div className="passage">{q.passage}</div>
                  )}
                  {q.question_html ? (
                    <RichContent
                      html={q.question_html}
                      className="question-text"
                    />
                  ) : (
                    <p className="question-text">{q.question_text}</p>
                  )}
                  {q.options?.map((option, i) => (
                    <label
                      className={
                        "answer-option " +
                        (response === String.fromCharCode(65 + i)
                          ? "chosen"
                          : "")
                      }
                      key={i}
                    >
                      <input
                        type="radio"
                        name="option"
                        disabled={!!saved}
                        checked={response === String.fromCharCode(65 + i)}
                        onChange={() =>
                          setResponse(String.fromCharCode(65 + i))
                        }
                      />
                      <span>{String.fromCharCode(65 + i)}</span>
                      {q.options_html?.[i] ? (
                        <RichContent html={q.options_html[i]} />
                      ) : (
                        option
                      )}
                    </label>
                  ))}
                </>
              ) : (
                <div className="reference-placeholder">
                  <BookOpen size={30} />
                  <h3>Open the original IMS question</h3>
                  <p>
                    The recovered record contains performance metadata and this
                    short excerpt. The full question and options were not
                    recovered.
                  </p>
                  <blockquote>
                    {q.recovered_stem_excerpt ||
                      "No question excerpt available."}
                    …
                  </blockquote>
                  <a
                    className="secondary"
                    href={
                      data.mocks.find((m) => m.mock_id === q.mock_id)
                        ?.source_urls?.detailed_analytics ||
                      "https://myimsv3.imsindia.com/"
                    }
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open IMS source <ExternalLink size={15} />
                  </a>
                  <p className="chart-note">
                    Find {q.section} Q{q.question_number} in Review Test. The
                    timer keeps running here. Do not treat the excerpt as a
                    complete question.
                  </p>
                </div>
              )}
              {saved ? (
                <div className="saved-answer">
                  <CheckCircle2 size={19} />
                  <div>
                    <b>Response saved: {saved.response || "Skipped"}</b>
                    <p>
                      {saved.correct === true
                        ? "Correct"
                        : saved.correct === false
                          ? "Needs repair"
                          : "Ungraded"}{" "}
                      · {saved.verification} · {duration(saved.seconds)}
                    </p>
                    {saved.reason && <p>{saved.reason}</p>}
                    {(s.feedback?.questionId === q.id
                      ? s.feedback
                      : s.review?.[q.id]) &&
                      (() => {
                        const review =
                          s.feedback?.questionId === q.id
                            ? s.feedback
                            : s.review[q.id];
                        return (
                          <div className="answer-review">
                            <p>
                              Key: {review.answer ?? "Not recovered"} · Original
                              response:{" "}
                              {review.originalResponse?.option_label ??
                                review.originalResponse?.value ??
                                "Not recovered"}{" "}
                              · Original time:{" "}
                              {duration(review.originalSeconds)}
                            </p>
                            {review.explanation_html ? (
                              <RichContent html={review.explanation_html} />
                            ) : (
                              <p>{review.explanation}</p>
                            )}
                          </div>
                        );
                      })()}
                  </div>
                </div>
              ) : (
                <>
                  <label>
                    Your response
                    <input
                      aria-label="Your response"
                      value={response}
                      placeholder="Option label, numeric answer, or leave blank to record a skip"
                      onChange={(e) => setResponse(e.target.value)}
                    />
                  </label>
                  <label>
                    Checked outcome (only when no answer key is available)
                    <select
                      aria-label="Checked outcome"
                      value={selfCorrect}
                      onChange={(e) => setSelfCorrect(e.target.value)}
                    >
                      <option value="">Not checked / unknown</option>
                      <option value="yes">I checked it: correct</option>
                      <option value="no">I checked it: wrong or blocked</option>
                    </select>
                  </label>
                  <label>
                    First blocked step or explanation
                    <textarea
                      rows={3}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Explain the route, the missed deduction, or what stopped you."
                    />
                  </label>
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={() =>
                      submit("answer", {
                        questionId: q.id,
                        response,
                        reason,
                        ...(selfCorrect
                          ? { selfCorrect: selfCorrect === "yes" }
                          : {}),
                      })
                    }
                  >
                    Save answer & time <Check size={15} />
                  </button>
                </>
              )}
              <div className="question-nav">
                <button
                  className="secondary"
                  disabled={busy || index === 0}
                  onClick={async () => {
                    await submit("focus", {
                      questionId: s.questions[index - 1].id,
                    });
                    setIndex(index - 1);
                    setResponse("");
                    setReason("");
                    setSelfCorrect("");
                  }}
                >
                  <ChevronLeft size={15} />
                  Previous
                </button>
                <div className="question-dots">
                  {s.questions.map((v, i) => (
                    <button
                      aria-label={"Go to question " + (i + 1)}
                      disabled={busy}
                      key={v.id}
                      className={
                        (i === index ? "active " : "") +
                        (s.answers.some((a) => a.questionId === v.id)
                          ? "answered"
                          : "")
                      }
                      onClick={async () => {
                        await submit("focus", {
                          questionId: s.questions[i].id,
                        });
                        setIndex(i);
                        setResponse("");
                        setReason("");
                        setSelfCorrect("");
                      }}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
                <button
                  className="secondary"
                  disabled={busy || index === s.questions.length - 1}
                  onClick={async () => {
                    await submit("focus", {
                      questionId: s.questions[index + 1].id,
                    });
                    setIndex(index + 1);
                    setResponse("");
                    setReason("");
                    setSelfCorrect("");
                  }}
                >
                  Next
                  <ChevronRight size={15} />
                </button>
              </div>
            </>
          ) : (
            <div className="external-practice">
              <BookOpen size={32} />
              <h2>Use the assigned source, keep this timer.</h2>
              <p>
                {task.completion ||
                  "Attempt first, review the first blocked step, then record the result."}
              </p>
              {task.videoUrl && (
                <a
                  className="primary"
                  href={task.videoUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open assigned lesson <ExternalLink size={15} />
                </a>
              )}
              <p className="muted">
                Fresh questions or sets should come from unused IMS/PYQ
                material. Add exact content through the import page for in-app
                answering.
              </p>
            </div>
          )}
        </section>
        <aside>
          <Panel title="What this mission repairs" kicker="YOUR BRIEF">
            <p>{task.reason}</p>
            {task.status === "missed" && task.risk && (
              <div className="completion-box">
                <b>IF UNRESOLVED · SCENARIO</b>
                <p>
                  {task.risk.penalty
                    ? `${task.risk.penalty} percentile-point accountability penalty.`
                    : `${task.risk.marks} gross marks exposed. `}
                  {task.risk.range
                    ? `Scenario percentile ${fmt(task.risk.range[0])}–${fmt(task.risk.range[1])}; drop ${fmt(data.estimate.value - task.risk.range[1])}–${fmt(data.estimate.value - task.risk.range[0])} points.`
                    : task.risk.scenarios.some((s) => s.below != null)
                      ? "Loss exceeds the published curve range; no extrapolated number is invented."
                      : "No supported percentile conversion for this task yet."}
                </p>
              </div>
            )}
            <ol className="mission-steps">
              {task.steps?.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
            {task.videoUrl && (
              <>
                <a href={task.videoUrl} target="_blank" rel="noreferrer">
                  Assigned lesson <ExternalLink size={13} />
                </a>
                <button
                  className="secondary"
                  onClick={async () => {
                    try {
                      await api("/api/task/action", {
                        taskId: task.id,
                        action: "video-watched",
                      });
                      await get();
                      notify(
                        "Lesson step recorded. Complete the assessment next.",
                      );
                    } catch (e) {
                      notify(e.message, true);
                    }
                  }}
                >
                  {task.videoWatchedAt
                    ? "Lesson watched"
                    : "Mark lesson watched"}
                </button>
              </>
            )}
          </Panel>
          <Panel title="Close the loop" className="lower">
            <p className="chart-note">
              {task.completion || "Save outcomes and the next repair decision."}
            </p>
            {(task.requiresFresh || !s.questions.length) &&
              task.type !== "mock" && (
                <>
                  <label>
                    Fresh {task.section === "DILR" ? "sets" : "questions"}{" "}
                    completed
                    <input
                      type="number"
                      min="0"
                      value={external.total}
                      onChange={(e) =>
                        setExternal({ ...external, total: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Fully correct{" "}
                    {task.section === "DILR" ? "sets" : "questions"}
                    <input
                      type="number"
                      min="0"
                      value={external.correct}
                      onChange={(e) =>
                        setExternal({ ...external, correct: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Source / question or set references
                    <input
                      value={external.source}
                      onChange={(e) =>
                        setExternal({ ...external, source: e.target.value })
                      }
                      placeholder="IMS sectional name, set numbers, or PYQ year"
                    />
                  </label>
                  <p className="chart-note">
                    Required fresh count: {task.requiredFreshCount || 1}.
                    External outcomes remain self-reported.
                  </p>
                </>
              )}
            {task.type === "mock" && (
              <label>
                Imported new mock
                <select
                  value={mockId}
                  onChange={(e) => setMockId(e.target.value)}
                >
                  <option value="">Select its imported result</option>
                  {data.mocks
                    .filter((m) => m.attempt.attempt_date)
                    .map((m) => (
                      <option key={m.mock_id} value={m.mock_id}>
                        {m.name} · {m.attempt.attempt_date}
                      </option>
                    ))}
                </select>
              </label>
            )}
            <label>
              Outcome in your own words
              <textarea
                rows={4}
                value={report}
                onChange={(e) => setReport(e.target.value)}
                placeholder="What worked? Where did you get stuck?"
              />
            </label>
            <button
              className="primary full"
              disabled={busy || !allAnswered || !report.trim()}
              onClick={() =>
                submit("finish", {
                  report,
                  mockId,
                  external:
                    external.total !== ""
                      ? {
                          total: Number(external.total),
                          correct: Number(external.correct),
                          source: external.source,
                        }
                      : {},
                })
              }
            >
              Finish & update plan <ArrowRight size={15} />
            </button>
            {!allAnswered && (
              <p className="chart-note">Save all assigned responses first.</p>
            )}
          </Panel>
        </aside>
      </div>
    </>
  );
}
function NewTask({ data, refresh, notify, onClose, topic }) {
  const [t, setT] = useState({
    title: topic ? "Fresh transfer: " + topic.topic : "",
    section: topic?.section || "QA",
    topic: topic?.topic || "",
    type: "questions",
    due: data.today,
    minutes: 30,
    questionIds: [],
    videoUrl: "",
    reason: "",
    requiredFreshCount: 5,
  });
  const [ids, setIds] = useState("");
  return (
    <Modal title="Assign a specific next step" onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await api("/api/task", {
              ...t,
              questionIds: ids
                .split(/[\n,]/)
                .map((x) => x.trim())
                .filter(Boolean),
            });
            await refresh();
            notify("Mission added.");
            onClose();
          } catch (e) {
            notify(e.message, true);
          }
        }}
      >
        <label>
          Mission title
          <input
            required
            value={t.title}
            onChange={(e) => setT({ ...t, title: e.target.value })}
          />
        </label>
        <div className="form-row">
          <label>
            Section
            <select
              value={t.section}
              onChange={(e) => setT({ ...t, section: e.target.value })}
            >
              {["QA", "DILR", "VARC", "ALL"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            Action
            <select
              value={t.type}
              onChange={(e) => setT({ ...t, type: e.target.value })}
            >
              {[
                "questions",
                "repair",
                "video",
                "sectional",
                "mock",
                "review",
              ].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Topic
          <input
            value={t.topic}
            onChange={(e) => setT({ ...t, topic: e.target.value })}
          />
        </label>
        <div className="form-row">
          <label>
            Due
            <input
              required
              type="date"
              value={t.due}
              onChange={(e) => setT({ ...t, due: e.target.value })}
            />
          </label>
          <label>
            Estimated minutes
            <input
              type="number"
              min="1"
              value={t.minutes}
              onChange={(e) => setT({ ...t, minutes: Number(e.target.value) })}
            />
          </label>
        </div>
        <label>
          Why this task?
          <textarea
            value={t.reason}
            onChange={(e) => setT({ ...t, reason: e.target.value })}
          />
        </label>
        <label>
          Question IDs (one per line; optional for external work)
          <textarea
            rows={4}
            value={ids}
            onChange={(e) => setIds(e.target.value)}
          />
        </label>
        {t.type === "video" && (
          <label>
            Specific lesson URL
            <input
              required
              type="url"
              value={t.videoUrl}
              onChange={(e) => setT({ ...t, videoUrl: e.target.value })}
            />
          </label>
        )}
        <p className="chart-note">
          A video task requires 5–10 imported assessment IDs. External practice
          requires a source and outcomes at completion.
        </p>
        <button className="primary">
          Add mission <Plus size={15} />
        </button>
      </form>
    </Modal>
  );
}
function App() {
  const [data, setData] = useState(null),
    [route, setRoute] = useState(location.hash.slice(2) || "home"),
    [toast, setToast] = useState(null),
    [task, setTask] = useState(null),
    [topic, setTopic] = useState(null),
    [question, setQuestion] = useState(null),
    [mock, setMock] = useState(null),
    [newTask, setNewTask] = useState(false),
    [menu, setMenu] = useState(false),
    [tab, setTab] = useState("analysis"),
    [due, setDue] = useState(""),
    [moveReason, setMoveReason] = useState(""),
    [attachIds, setAttachIds] = useState(""),
    [busy, setBusy] = useState(false);
  const notify = useCallback(
    (message, error = false) => setToast({ message, error, id: Date.now() }),
    [],
  );
  const refresh = useCallback(async () => {
    try {
      setData(await api("/api/state"));
    } catch (e) {
      notify(e.message, true);
    }
  }, []);
  useEffect(() => {
    refresh();
    const hash = () => {
      setRoute(location.hash.slice(2) || "home");
      setMenu(false);
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", hash);
    const timer = setInterval(refresh, 30000);
    return () => {
      window.removeEventListener("hashchange", hash);
      clearInterval(timer);
    };
  }, [refresh]);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 7000);
      return () => clearTimeout(t);
    }
  }, [toast]);
  useEffect(() => {
    if (
      !data ||
      !("Notification" in window) ||
      Notification.permission !== "granted"
    )
      return;
    const key = "hq-warning-" + data.today;
    const count = data.tasks.filter((t) => t.status === "missed").length;
    if (count && localStorage.getItem(key) !== String(count)) {
      new Notification("CAT HQ · close the repair loop", {
        body: `${count} overdue missions. ${data.risk.marks} marks in the unresolved-topic scenario. Open your board to recover the work.`,
      });
      localStorage.setItem(key, String(count));
    }
  }, [data?.today, data?.tasks.filter((t) => t.status === "missed").length]);
  if (!data)
    return (
      <div className="loading">
        <LoaderCircle className="spin" />
        Opening your CAT HQ…{toast && <p>{toast.message}</p>}
      </div>
    );
  const openTask = (t) => {
    setTask(t);
    setAttachIds("");
    setDue(t.due);
    setMoveReason("");
  };
  const page = route.split("/")[0];
  const nav = [
    ["home", "Overview", LayoutDashboard],
    ["board", "Mission board", Columns3],
    ["repairs", "Repair lab", Brain],
    ["history", "Trends & dips", History],
  ];
  const iconMap = { QA: Calculator, DILR: Brain, VARC: Languages };
  const subtitle =
    page === "home"
      ? "Overview"
      : page === "board"
        ? "Mission board"
        : page === "practice"
          ? "Focus session"
          : page === "repairs"
            ? "Repair lab"
            : page === "history"
              ? "Trends & dips"
              : page === "import"
                ? "Records & sources"
                : page === "settings"
                  ? "Settings"
                  : page;
  const start = async () => {
    setBusy(true);
    try {
      const s = await api("/api/session/start", { taskId: task.id });
      setTask(null);
      go("practice/" + s.id);
    } catch (e) {
      notify(e.message, true);
    }
    setBusy(false);
  };
  return (
    <div className="app-shell">
      <aside className={"sidebar " + (menu ? "visible" : "")}>
        <a className="brand" href="#/home">
          <span className="brand-icon">
            C<span>•</span>
          </span>
          <span>
            CAT<span className="brand-light">HQ</span>
            <small>THE 2026 CHAPTER</small>
          </span>
        </a>
        <div className="workspace-name">
          <span className="avatar">S</span>
          <div>
            Srishti’s workspace<small>Question first. Always.</small>
          </div>
        </div>
        <span className="nav-label">YOUR WORKSPACE</span>
        <nav>
          {nav.map(([id, name, Icon]) => (
            <a
              key={id}
              href={"#/" + id}
              className={page === id ? "active" : ""}
            >
              <Icon size={18} />
              {name}
              {id === "board" && (
                <span className="nav-count">
                  {
                    data.tasks.filter(
                      (t) => t.status === "today" || t.status === "missed",
                    ).length
                  }
                </span>
              )}
            </a>
          ))}
        </nav>
        <span className="nav-label">YOUR SECTIONS</span>
        <nav>
          {["VARC", "DILR", "QA"].map((s) => {
            const Icon = iconMap[s];
            return (
              <a key={s} href={"#/" + s} className={page === s ? "active" : ""}>
                <Icon size={18} color="#b3bdc9" />
                {s}
                <ChevronRight size={13} className="nav-arrow" />
              </a>
            );
          })}
        </nav>
        <span className="nav-label">THE TOOLKIT</span>
        <nav>
          <a href="#/import" className={page === "import" ? "active" : ""}>
            <BookOpen size={18} />
            Records & sources
          </a>
          <a href="#/settings" className={page === "settings" ? "active" : ""}>
            <Settings size={18} />
            Settings
          </a>
        </nav>
        <div className="sidebar-bottom">
          <div className="level-box">
            <Flame size={22} color="#b3bdc9" />
            <div>
              Level {data.level} · {data.xp} XP
              <small>Consistency compounds.</small>
            </div>
          </div>
          <div className="goal-track">
            <span style={{ width: ((data.xp % 250) / 250) * 100 + "%" }} />
          </div>
          <a href="#/settings" className="sync-indicator">
            <span
              className={
                "status-dot " +
                (data.sync.state === "synced" ? "green" : "amber")
              }
            />
            {data.sync.state === "synced"
              ? "GitHub synced"
              : "Sync needs attention"}
            <GitBranch size={13} />
          </a>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div>
            <button
              className="icon-btn mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMenu(!menu)}
            >
              <Menu size={20} />
            </button>
            <span className="muted">Workspace</span>
            <ChevronRight size={14} />
            <b>{subtitle}</b>
          </div>
          <div>
            <span className="date-label">
              <CalendarDays size={14} />
              {new Date(data.today + "T12:00:00Z").toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                weekday: "short",
              })}
            </span>
            <span className="top-divider" />
            <span className="streak">
              <Flame size={16} />
              {data.streak} day streak
            </span>
            <span className="avatar small-avatar">S</span>
          </div>
        </header>
        <main>
          {page === "home" && (
            <Home
              data={data}
              onOpen={openTask}
              onMock={(m) => {
                setMock(m);
                setTab("analysis");
              }}
            />
          )}
          {page === "board" && (
            <>
              <div className="page-intro title-row">
                <div>
                  <div className="eyebrow">SMALL MISSIONS. REAL PROGRESS.</div>
                  <h1>Your next right step.</h1>
                  <p>
                    {data.profile.dailyMinutes
                      ? `Suggested capacity: ${data.profile.dailyMinutes} minutes.`
                      : "Flexible workload. Preserve the sequence; complete repairs before adding tests."}
                  </p>
                </div>
                <button className="primary" onClick={() => setNewTask(true)}>
                  <Plus size={16} />
                  Add mission
                </button>
              </div>
              <Board data={data} onOpen={openTask} full />
            </>
          )}
          {["QA", "DILR", "VARC"].includes(page) && (
            <SectionPage
              key={page}
              section={page}
              data={data}
              onOpen={openTask}
              onTopic={setTopic}
              onQuestion={setQuestion}
            />
          )}
          {page === "repairs" && <Repairs data={data} onTopic={setTopic} />}
          {page === "history" && (
            <HistoryPage
              data={data}
              onMock={(m) => {
                setMock(m);
                setTab("analysis");
              }}
            />
          )}
          {page === "settings" && (
            <SettingsPage data={data} refresh={refresh} notify={notify} />
          )}
          {page === "import" && (
            <ImportPage data={data} refresh={refresh} notify={notify} />
          )}
          {page === "practice" && (
            <Practice
              key={route}
              id={route.split("/")[1]}
              data={data}
              refresh={refresh}
              notify={notify}
            />
          )}
          <footer className="page-footer">
            <span>CAT HQ · Built around your next question.</span>
            <span>Local first · Asia/Calcutta</span>
          </footer>
        </main>
      </div>
      {task && (
        <Modal title={task.title} onClose={() => setTask(null)}>
          <div className="task-tags">
            <Badge tone={task.section.toLowerCase()}>{task.section}</Badge>
            <Badge>{task.stage || task.type}</Badge>
            <Badge>+{task.xp} XP</Badge>
          </div>
          <p>{task.reason}</p>
          {task.status === "missed" && task.risk && (
            <div className="completion-box">
              <b>IF UNRESOLVED · SCENARIO</b>
              <p>
                {task.risk.penalty
                  ? `${task.risk.penalty} percentile-point accountability penalty.`
                  : `${task.risk.marks} gross marks exposed. `}
                {task.risk.range
                  ? `Scenario percentile ${fmt(task.risk.range[0])}–${fmt(task.risk.range[1])}; drop ${fmt(data.estimate.value - task.risk.range[1])}–${fmt(data.estimate.value - task.risk.range[0])} points.`
                  : task.risk.scenarios.some((s) => s.below != null)
                    ? "Loss exceeds the published curve range; no extrapolated number is invented."
                    : "No supported percentile conversion for this task yet."}
              </p>
            </div>
          )}
          <ol className="mission-steps">
            {task.steps?.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
          <div className="completion-box">
            <b>Done means</b>
            <p>
              {task.completion ||
                "Outcomes recorded and a next-step decision saved."}
            </p>
          </div>
          {task.questionCount > 0 && (
            <p className="chart-note">
              {task.contentCount}/{task.questionCount} question views available.
              IMS reference mode supports timed responses for the remaining
              questions.
            </p>
          )}
          {task.videoUrl && (
            <a href={task.videoUrl} target="_blank" rel="noreferrer">
              Open lesson <ExternalLink size={13} />
            </a>
          )}
          {task.status === "done" ? (
            <Badge tone="green">Completed · evidence preserved</Badge>
          ) : (
            <>
              {task.blockedBy?.length > 0 && (
                <p className="chart-note">
                  Checkpoint is gated by {task.blockedBy.length} unfinished
                  reviews/repairs. Complete them first or move the checkpoint.
                </p>
              )}
              <button
                className="primary full"
                onClick={start}
                disabled={busy || task.blockedBy?.length > 0}
              >
                <Play size={16} />
                {task.session ? "Resume timed session" : "Start timed session"}
              </button>
              <details className="lower">
                <summary>Attach imported questions to this task</summary>
                <label>
                  Question IDs, one per line
                  <textarea
                    rows={4}
                    value={attachIds}
                    onChange={(e) => setAttachIds(e.target.value)}
                    placeholder="Paste the IDs from the analysis-tab import."
                  />
                </label>
                <button
                  className="secondary"
                  onClick={async () => {
                    try {
                      await api("/api/task/action", {
                        taskId: task.id,
                        action: "assign-questions",
                        questionIds: attachIds
                          .split(/[\n,]/)
                          .map((x) => x.trim())
                          .filter(Boolean),
                        reason:
                          "Attached source-referenced question content for in-app assessment",
                      });
                      await refresh();
                      setTask(null);
                      notify(
                        "Question content attached. Reopen the task to begin.",
                      );
                    } catch (e) {
                      notify(e.message, true);
                    }
                  }}
                >
                  Attach assessment questions
                </button>
                <p className="chart-note">
                  Fresh tasks require unseen content. Original mock IDs can
                  receive full content through the import page.
                </p>
              </details>
              <details className="lower">
                <summary>Move or retire this mission</summary>
                <label>
                  New due date
                  <input
                    type="date"
                    value={due}
                    onChange={(e) => setDue(e.target.value)}
                  />
                </label>
                <label>
                  Reason
                  <textarea
                    value={moveReason}
                    onChange={(e) => setMoveReason(e.target.value)}
                    placeholder="Keep the history of why the plan changed."
                  />
                </label>
                <div className="form-row">
                  {["reschedule", "retire"].map((action) => (
                    <button
                      key={action}
                      className="secondary"
                      onClick={async () => {
                        try {
                          await api("/api/task/action", {
                            taskId: task.id,
                            action,
                            due,
                            reason: moveReason,
                          });
                          setTask(null);
                          await refresh();
                          notify(
                            action === "retire"
                              ? "Mission retired, without XP or false completion."
                              : "Due date updated; the original date is preserved.",
                          );
                        } catch (e) {
                          notify(e.message, true);
                        }
                      }}
                    >
                      {action === "retire"
                        ? "Retire pending task"
                        : "Move task"}
                    </button>
                  ))}
                </div>
              </details>
            </>
          )}
        </Modal>
      )}
      {topic && (
        <Modal title={topic.topic} wide onClose={() => setTopic(null)}>
          <div className="stats-row">
            <Stat
              label="CORRECT / ATTEMPTED"
              value={`${topic.correct}/${topic.attempted}`}
              detail={`${topic.skipped} skipped`}
            />
            <Stat
              label="STATE"
              value={topic.repairState}
              detail="No automatic weakness from zero attempts"
            />
          </div>
          <p className="muted">
            {topic.attempted === 0
              ? "Current ability is untested: use a cold diagnostic before prescribing a lesson."
              : topic.wrong > 0
                ? "Review the first incorrect inference or route, then test it on unseen material."
                : "Preserve the strength with mixed and delayed practice."}
          </p>
          <QuestionTable
            questions={data.questions.filter((q) =>
              topic.questionIds.includes(q.id),
            )}
            onQuestion={setQuestion}
          />
          <button
            className="primary lower"
            onClick={() => {
              setNewTask({ ...topic });
              setTopic(null);
            }}
          >
            Assign a specific repair <Plus size={15} />
          </button>
        </Modal>
      )}
      {question && (
        <Modal
          title={`${question.section} Q${question.question_number} · ${question.topic}`}
          onClose={() => setQuestion(null)}
        >
          <Badge
            tone={
              question.outcome === "correct"
                ? "green"
                : question.outcome === "wrong"
                  ? "red"
                  : ""
            }
          >
            {question.outcome}
          </Badge>
          <p>
            {question.question_text ||
              (question.question_html
                ? "Formatted question is available in a timed mission."
                : question.recovered_stem_excerpt + "…")}
          </p>
          {!question.question_text && !question.question_html && (
            <p className="chart-note">
              Partial UI excerpt only. Complete question/options are
              unavailable.
            </p>
          )}
          {question.question_html && (
            <RichContent html={question.question_html} />
          )}
          <Bars
            height={160}
            data={[
              { name: "Recorded", seconds: question.time_seconds },
              {
                name: "Benchmark",
                seconds: question.provider_benchmark?.time_seconds,
              },
            ]}
            series={[
              {
                key: "seconds",
                label: "Seconds",
                color: COLORS[question.section],
              },
            ]}
          />
          <p className="muted small">
            Net marks: {question.marks}. Shared passage/set setup can be
            attributed to the first question.
          </p>
          <code>{question.id}</code>
          <a
            className="secondary lower"
            target="_blank"
            rel="noreferrer"
            href={
              data.mocks.find((m) => m.mock_id === question.mock_id)
                ?.source_urls?.detailed_analytics ||
              "https://myimsv3.imsindia.com/"
            }
          >
            Open IMS source <ExternalLink size={14} />
          </a>
        </Modal>
      )}
      {mock && (
        <Modal title={mock.name} wide onClose={() => setMock(null)}>
          <div className="segmented">
            <button
              className={tab === "analysis" ? "selected" : ""}
              onClick={() => setTab("analysis")}
            >
              Detailed analysis
            </button>
            <button
              className={tab === "questions" ? "selected" : ""}
              onClick={() => setTab("questions")}
            >
              Question evidence
            </button>
          </div>
          {tab === "analysis" ? (
            <div className="analysis-text">{mock.analysis}</div>
          ) : (
            <QuestionTable
              questions={data.questions.filter(
                (q) => q.mock_id === mock.mock_id,
              )}
              onQuestion={setQuestion}
            />
          )}
        </Modal>
      )}
      {newTask && (
        <NewTask
          data={data}
          topic={typeof newTask === "object" ? newTask : null}
          refresh={refresh}
          notify={notify}
          onClose={() => setNewTask(false)}
        />
      )}
      {toast && (
        <div className={"toast " + (toast.error ? "error" : "")} role="status">
          {toast.error ? (
            <TriangleAlert size={19} />
          ) : (
            <CheckCircle2 size={19} />
          )}
          <span>{toast.message}</span>
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast(null)}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")).render(<App />);
