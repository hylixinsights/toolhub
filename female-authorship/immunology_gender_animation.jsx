import { useState, useEffect, useRef, useCallback } from "react";

const NAT_IMMUNOL = [
  {year:2002,first:28.1,last:14.3},{year:2003,first:39.0,last:17.1},{year:2004,first:30.3,last:18.0},
  {year:2005,first:41.7,last:17.4},{year:2006,first:38.9,last:11.3},{year:2007,first:45.7,last:14.3},
  {year:2008,first:34.7,last:9.0},{year:2009,first:37.4,last:19.4},{year:2010,first:29.7,last:13.3},
  {year:2011,first:30.3,last:26.6},{year:2012,first:31.8,last:21.9},{year:2013,first:38.9,last:27.5},
  {year:2014,first:38.0,last:14.7},{year:2015,first:36.5,last:20.0},{year:2016,first:48.4,last:29.3},
  {year:2017,first:53.5,last:38.3},{year:2018,first:49.7,last:47.7},{year:2019,first:48.6,last:38.8},
  {year:2020,first:50.8,last:34.6},{year:2021,first:47.4,last:36.1},{year:2022,first:46.5,last:39.8},
  {year:2023,first:54.6,last:37.5},{year:2024,first:48.7,last:38.8},{year:2025,first:54.6,last:42.7},
];

const IMMUNITY = [
  {year:2002,first:41.7,last:19.7},{year:2003,first:30.7,last:9.9},{year:2004,first:31.4,last:14.6},
  {year:2005,first:33.3,last:18.2},{year:2006,first:28.5,last:19.9},{year:2007,first:31.8,last:17.5},
  {year:2008,first:35.5,last:17.6},{year:2009,first:33.5,last:28.5},{year:2010,first:34.2,last:19.9},
  {year:2011,first:43.0,last:14.7},{year:2012,first:36.4,last:18.3},{year:2013,first:39.8,last:19.8},
  {year:2014,first:35.2,last:23.9},{year:2015,first:39.0,last:18.6},{year:2016,first:40.4,last:21.9},
  {year:2017,first:42.8,last:24.2},{year:2018,first:47.3,last:32.5},{year:2019,first:45.3,last:35.0},
  {year:2020,first:48.8,last:32.0},{year:2021,first:49.2,last:31.0},{year:2022,first:47.7,last:34.3},
  {year:2023,first:43.6,last:37.6},{year:2024,first:43.5,last:30.4},{year:2025,first:46.2,last:31.4},
];

const J_IMMUNOL = [
  {year:2002,first:45.7,last:19.5},{year:2003,first:42.7,last:20.5},{year:2004,first:44.8,last:19.5},
  {year:2005,first:44.5,last:21.8},{year:2006,first:46.8,last:22.1},{year:2007,first:48.5,last:21.0},
  {year:2008,first:47.9,last:23.0},{year:2009,first:50.9,last:23.5},{year:2010,first:51.9,last:23.3},
  {year:2011,first:47.4,last:25.8},{year:2012,first:50.5,last:26.9},{year:2013,first:51.7,last:27.6},
  {year:2014,first:50.0,last:28.4},{year:2015,first:52.8,last:27.9},{year:2016,first:52.9,last:33.2},
  {year:2017,first:51.1,last:28.5},{year:2018,first:52.3,last:29.7},{year:2019,first:51.5,last:27.2},
  {year:2020,first:51.2,last:30.1},{year:2021,first:50.0,last:30.4},{year:2022,first:54.1,last:33.7},
  {year:2023,first:49.1,last:30.0},{year:2024,first:52.4,last:27.5},{year:2025,first:52.6,last:34.7},
];

const JOURNALS = [
  { name: "Nature Immunology", data: NAT_IMMUNOL, accent: "#B5493A" },
  { name: "Immunity", data: IMMUNITY, accent: "#2E7D6A" },
  { name: "J. of Immunology", data: J_IMMUNOL, accent: "#4A5FA0" },
];

const BG = "#F8F5F1";
const GRID = "#E5DFD8";
const TEXT_DIM = "#9E9389";
const TEXT_MED = "#6B5F54";

const W = 360, H = 310;
const margin = { top: 14, right: 44, bottom: 36, left: 44 };
const plotW = W - margin.left - margin.right;
const plotH = H - margin.top - margin.bottom;
const yMin = 0, yMax = 70, xMin = 2002, xMax = 2025;

const xPos = (yr) => margin.left + ((yr - xMin) / (xMax - xMin)) * plotW;
const yPos = (val) => margin.top + (1 - (val - yMin) / (yMax - yMin)) * plotH;

function buildPath(data, key) {
  return data.map((d, i) => `${i === 0 ? "M" : "L"}${xPos(d.year).toFixed(1)},${yPos(d[key]).toFixed(1)}`).join(" ");
}

function buildArea(data) {
  const top = data.map((d, i) => `${i === 0 ? "M" : "L"}${xPos(d.year).toFixed(1)},${yPos(d.first).toFixed(1)}`).join(" ");
  return `${top} L${xPos(data[data.length-1].year).toFixed(1)},${yPos(0).toFixed(1)} L${xPos(data[0].year).toFixed(1)},${yPos(0).toFixed(1)} Z`;
}

function lerpXY(data, key, frac) {
  const t = frac * (data.length - 1);
  const i = Math.min(Math.floor(t), data.length - 2);
  const f = t - i;
  const yr = data[i].year + (data[i+1].year - data[i].year) * f;
  const val = data[i][key] + (data[i+1][key] - data[i][key]) * f;
  return { x: xPos(yr), y: yPos(val), val };
}

function ChartAxes() {
  const yTicks = [0, 10, 20, 30, 40, 50, 60, 70];
  const xTicks = [2002, 2006, 2010, 2014, 2018, 2022, 2025];

  return (
    <g>
      {yTicks.map(v => (
        <g key={v}>
          <line x1={margin.left} y1={yPos(v)} x2={W - margin.right} y2={yPos(v)}
            stroke={v === 0 ? "#C4BAB0" : GRID} strokeWidth={v === 0 ? 0.8 : 0.5} />
          {v % 10 === 0 && (
            <text x={margin.left - 6} y={yPos(v)} textAnchor="end" dominantBaseline="middle"
              fill={TEXT_DIM} fontSize="9" fontFamily="Georgia,serif">{v}%</text>
          )}
        </g>
      ))}
      {/* 50% dashed reference line */}
      <line x1={margin.left} y1={yPos(50)} x2={W - margin.right} y2={yPos(50)}
        stroke="#B8AFA5" strokeWidth={0.9} strokeDasharray="5 3" />
      <text x={W - margin.right + 4} y={yPos(50)} dominantBaseline="middle"
        fill="#B8AFA5" fontSize="8.5" fontFamily="Georgia,serif">50%</text>

      {xTicks.map(yr => (
        <g key={yr}>
          <line x1={xPos(yr)} y1={yPos(0)} x2={xPos(yr)} y2={yPos(0)+4}
            stroke="#C4BAB0" strokeWidth={0.5} />
          <text x={xPos(yr)} y={yPos(0)+16} textAnchor="middle"
            fill={TEXT_DIM} fontSize="8.5" fontFamily="Georgia,serif">
            {yr === 2002 ? "'02" : yr === 2025 ? "'25" : "'" + String(yr).slice(2)}
          </text>
        </g>
      ))}
    </g>
  );
}

function JournalChart({ journal, progress }) {
  const { name, data, accent } = journal;
  const accentLight = accent + "15";
  const accentMed = accent + "AA";
  const clipW = margin.left + plotW * progress + 1;
  const clipId = `clip-${name.replace(/[\s.]/g, "")}`;

  const firstPath = buildPath(data, "first");
  const lastPath = buildPath(data, "last");
  const areaPath = buildArea(data);

  const visibleDots = data.filter((_, i) => progress >= i / (data.length - 1));
  const firstTip = lerpXY(data, "first", Math.min(progress, 1));
  const lastTip = lerpXY(data, "last", Math.min(progress, 1));
  const currentIdx = Math.min(Math.floor(progress * (data.length - 1)), data.length - 1);

  return (
    <div style={{ flex: "1 1 0", minWidth: 280 }}>
      <div style={{ textAlign: "center", fontFamily: "Georgia,serif", marginBottom: 2 }}>
        <span style={{
          fontSize: "1.05rem", fontWeight: 700, fontStyle: "italic",
          color: accent, letterSpacing: "-0.02em",
        }}>{name}</span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }}>
        <defs>
          <clipPath id={clipId}>
            <rect x={0} y={0} width={clipW} height={H} />
          </clipPath>
        </defs>

        <ChartAxes />

        <path d={areaPath} fill={accentLight} clipPath={`url(#${clipId})`} />

        <path d={lastPath} fill="none" stroke={accentMed} strokeWidth={2}
          strokeDasharray="6 4" strokeLinecap="round" strokeLinejoin="round"
          clipPath={`url(#${clipId})`} />

        <path d={firstPath} fill="none" stroke={accent} strokeWidth={2.4}
          strokeLinecap="round" strokeLinejoin="round"
          clipPath={`url(#${clipId})`} />

        {visibleDots.map(d => (
          <g key={d.year}>
            <circle cx={xPos(d.year)} cy={yPos(d.first)} r={2.5}
              fill="#fff" stroke={accent} strokeWidth={1.5} />
            <circle cx={xPos(d.year)} cy={yPos(d.last)} r={2.5}
              fill="#fff" stroke={accentMed} strokeWidth={1.5} />
          </g>
        ))}

        {progress > 0.01 && (
          <>
            <circle cx={firstTip.x} cy={firstTip.y} r={6} fill={accent} opacity={0.15} />
            <circle cx={firstTip.x} cy={firstTip.y} r={3.8} fill={accent} />
            <text x={firstTip.x > W - margin.right - 45 ? firstTip.x - 10 : firstTip.x + 10}
              y={firstTip.y - 7}
              fill={accent} fontSize="10" fontWeight="bold" fontFamily="Georgia,serif"
              textAnchor={firstTip.x > W - margin.right - 45 ? "end" : "start"}>
              {firstTip.val.toFixed(1)}%
            </text>

            <circle cx={lastTip.x} cy={lastTip.y} r={6} fill={accentMed} opacity={0.15} />
            <circle cx={lastTip.x} cy={lastTip.y} r={3.8} fill={accentMed} />
            <text x={lastTip.x > W - margin.right - 45 ? lastTip.x - 10 : lastTip.x + 10}
              y={lastTip.y + 14}
              fill={accentMed} fontSize="10" fontWeight="bold" fontFamily="Georgia,serif"
              textAnchor={lastTip.x > W - margin.right - 45 ? "end" : "start"}>
              {lastTip.val.toFixed(1)}%
            </text>
          </>
        )}

        {progress > 0.97 && (
          <>
            <text x={W - 2} y={yPos(data[data.length-1].first) - 8}
              fill={accent} fontSize="8.5" fontWeight="bold" fontFamily="Georgia,serif"
              textAnchor="end">1st</text>
            <text x={W - 2} y={yPos(data[data.length-1].last) + 12}
              fill={accentMed} fontSize="8.5" fontWeight="bold" fontFamily="Georgia,serif"
              textAnchor="end">Last</text>
          </>
        )}
      </svg>
    </div>
  );
}

export default function App() {
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const rafRef = useRef(null);
  const startRef = useRef(null);
  const pausedAt = useRef(0);
  const DURATION = 6000;

  useEffect(() => {
    const t = setTimeout(() => setPlaying(true), 600);
    return () => clearTimeout(t);
  }, []);

  const loop = useCallback((ts) => {
    if (!startRef.current) startRef.current = ts;
    const elapsed = ts - startRef.current;
    const raw = Math.min((pausedAt.current + elapsed) / DURATION, 1);
    const eased = 1 - Math.pow(1 - raw, 2.5);
    setProgress(eased);
    if (raw < 1) rafRef.current = requestAnimationFrame(loop);
    else setPlaying(false);
  }, []);

  useEffect(() => {
    if (playing) {
      startRef.current = null;
      rafRef.current = requestAnimationFrame(loop);
    }
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [playing, loop]);

  const currentIdx = Math.min(Math.floor(progress * (NAT_IMMUNOL.length - 1)), NAT_IMMUNOL.length - 1);
  const currentYear = NAT_IMMUNOL[currentIdx].year;

  const togglePlay = () => {
    if (playing) {
      setPlaying(false);
      const inv = 1 - Math.pow(1 - progress, 1/2.5);
      pausedAt.current = inv * DURATION;
    } else {
      if (progress >= 0.999) { pausedAt.current = 0; setProgress(0); }
      setPlaying(true);
    }
  };

  const replay = () => {
    setPlaying(false);
    setProgress(0);
    pausedAt.current = 0;
    setTimeout(() => setPlaying(true), 100);
  };

  return (
    <div style={{
      background: BG, minHeight: "100vh",
      display: "flex", justifyContent: "center", alignItems: "center",
      padding: "20px 12px", fontFamily: "Georgia,serif",
    }}>
      <div style={{
        background: "#fff", borderRadius: 16,
        boxShadow: "0 8px 40px rgba(0,0,0,0.06)",
        padding: "32px 28px 24px", maxWidth: 1100, width: "100%",
      }}>
        <div style={{ textAlign: "center", marginBottom: 4 }}>
          <h1 style={{
            fontSize: "1.3rem", fontWeight: 700, color: "#2C2420",
            letterSpacing: "-0.02em", margin: 0,
          }}>
            Female Authorship in Immunology Journals
          </h1>
          <p style={{
            fontSize: "0.78rem", color: TEXT_DIM, fontStyle: "italic", margin: "3px 0 0",
          }}>
            % female among gender-classified authors · 2002–2025
          </p>
        </div>

        <div style={{
          textAlign: "center", fontSize: "2rem", fontWeight: 800,
          color: "#5A4A3A", height: 42, lineHeight: "42px",
          fontVariantNumeric: "tabular-nums",
          opacity: progress > 0.005 ? 1 : 0,
          transition: "opacity 0.3s",
          letterSpacing: "-0.02em",
        }}>
          {currentYear}
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
          {JOURNALS.map(j => (
            <JournalChart key={j.name} journal={j} progress={progress} />
          ))}
        </div>

        <div style={{
          display: "flex", justifyContent: "center", gap: 28,
          marginTop: 12, fontSize: "0.75rem", color: TEXT_MED,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <div style={{ width: 24, borderTop: "2.5px solid #5A4A3A" }} />
            <span>First author</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <div style={{ width: 24, borderTop: "2.5px dashed #5A4A3AAA" }} />
            <span>Last author</span>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 14 }}>
          <button onClick={togglePlay} style={{
            background: "#5A4A3A", color: "#fff", border: "none",
            padding: "7px 22px", borderRadius: 7,
            fontFamily: "Georgia,serif", fontSize: "0.78rem", cursor: "pointer",
          }}>
            {playing ? "⏸ Pause" : "▶ Play"}
          </button>
          <button onClick={replay} style={{
            background: "transparent", color: "#5A4A3A",
            border: "1.5px solid #5A4A3A",
            padding: "7px 22px", borderRadius: 7,
            fontFamily: "Georgia,serif", fontSize: "0.78rem", cursor: "pointer",
          }}>
            ↺ Replay
          </button>
        </div>

        <p style={{
          textAlign: "center", fontSize: "0.65rem", color: "#C4BAB0", marginTop: 10,
        }}>
          Excluding undetermined gender · Source: PubMed / gender-guesser
        </p>
      </div>
    </div>
  );
}
