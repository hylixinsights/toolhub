import React, { useState, useRef, useEffect, useMemo } from "react";

/* ================= GEOMETRIA (cena vertical p/ celular em pé) ================= */
const VW = 400, VH = 330;
const G = { L: 36, R: 364, T: 70, B: 210, CX: 200, CY: 140, MAXD: 178 };
const BALL_START = { x: 200, y: 292 };
const KEEPER_START = { x: 200, y: 170 };
const GRAVITY = 780; /* px/s² para os quiques */

const TEAMS = {
  yellow: { id: "yellow", name: "AMARELO", jersey: "#FFCC00", jersey2: "#e0b000", trim: "#009C3B", shorts: "#012776", text: "#1a1a00" },
  blue: { id: "blue", name: "AZUL ESCURO", jersey: "#012776", jersey2: "#001a52", trim: "#FFCC00", shorts: "#f2f2f2", text: "#fff" },
};
const other = (t) => (t === "yellow" ? "blue" : "yellow");

/* ================= HELPERS ================= */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const lerp = (a, b, p) => ({ x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p });
const gauss = (sd) => ((Math.random() + Math.random() + Math.random()) - 1.5) * 1.15 * sd;
const easeOut = (p) => 1 - Math.pow(1 - p, 2.2);
const genCode = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let c = "";
  for (let i = 0; i < 5; i++) c += chars[Math.floor(Math.random() * chars.length)];
  return c;
};
const goalsOf = (arr) => arr.filter((x) => x === "G").length;
const kickerOf = (m) => (m.kickNumber % 2 === 0 ? "A" : "B");
const clampDive = (p) => ({ x: clamp(p.x, 48, 352), y: clamp(p.y, 78, 204) });
const flightOf = (q) => (q === "strong" ? 860 : q === "weak" ? 1380 : 1780);
/* nível do chão sob a bola durante o voo (perspectiva: perto = baixo, gol = alto) */
const groundAt = (p) => 296 + (214 - 296) * easeOut(p);

function checkWinner(kA, kB) {
  const gA = goalsOf(kA), gB = goalsOf(kB), nA = kA.length, nB = kB.length;
  if (nA <= 5 && nB <= 5) {
    const rA = 5 - nA, rB = 5 - nB;
    if (gA > gB + rB) return "A";
    if (gB > gA + rA) return "B";
    if (nA === 5 && nB === 5 && gA !== gB) return gA > gB ? "A" : "B";
    return null;
  }
  if (nA === nB && nA > 5) return gA > gB ? "A" : gB > gA ? "B" : null;
  return null;
}

const aimDifficulty = (p) => Math.min(1, dist(p, { x: G.CX, y: G.CY }) / G.MAXD);

/* ============ NARRAÇÃO: bordões de comentarista ============ */
const pick = (a) => a[Math.floor(Math.random() * a.length)];
/* vibracao do celular (ignorada onde nao ha suporte) */
const buzz = (p) => { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) { } };
const BANNER = {
  G: ["GOOOOL!", "GOLAÇO!", "É GOOOL!"],
  S: ["DEFENDEU!", "PEGOU!", "MURALHA!"],
  P: ["NA TRAVE!"],
  O: ["PRA FORA!", "ISOLOU!"],
};
function commentFor(res, shot, dive, caught) {
  const q = shot.quality;
  if (res === "P") {
    return shot.bar
      ? pick(["Explodiu no travessão! O gol gritou de dor! 💥", "TRAVESSÃO! Por um fio de bigode!", "A trave tremeu, a torcida tremeu, EU tremi!"])
      : pick(["Carimbou a trave! Tirou tinta, minha gente!", "NA TRAVE! O gol tem seguro contra isso?", "A trave fez a defesa do ano!"]);
  }
  if (res === "O") {
    return pick([
      "Mandou pra arquibancada! Vai buscar quem chutou!",
      "Isolou! Essa bola só volta de Uber.",
      "Assustou o torcedor da fileira 12... e olha que ele tava de olho fechado!",
      "Chutou tão pra fora que quase marcou no outro estádio.",
    ]);
  }
  if (res === "S") {
    if (!caught) return pick([
      "ESPALMOU! Mandou pra um escanteio que nem existe!",
      "Rebateu com a ponta da luva! Reflexo felino!",
      "Não deu pra segurar, mas tirou! Defesaça!",
    ]);
    return q === "weak" || q === "veryweak"
      ? pick([
        "Chutou pra mamãe! O goleiro agradece e manda um abraço.",
        "Presa fácil! Nem despenteou o goleiro.",
        "Essa até eu pegava... e olha que eu só narro!",
      ])
      : pick([
        "AGARROU FIRME! Buscou no cantinho onde mora a coruja!",
        "Voou, agarrou com as duas e ainda deitou em cima!",
        "Fechou o gol e jogou a chave fora! Espetacular!",
      ]);
  }
  /* gol */
  if (!dive) return pick([
    "O goleiro virou estátua! Alguém chama o museu!",
    "Ficou plantado! Já pode dar fruto!",
  ]);
  if (dist(shot.target, dive) < 80) return pick([
    "O goleiro chegou atrasado igual segunda-feira!",
    "Tocou na bola... com o pensamento! Por um triz!",
  ]);
  if (q === "weak" || q === "veryweak") return pick([
    "Entrou de paraquedas... mas quem escreve o placar não desenha!",
    "Devagarinho, quase pedindo licença... e entrou!",
  ]);
  if (shot.difficulty > 0.72) return pick([
    "NO ÂNGULO! Onde dorme a coruja e mora a poesia!",
    "Que pintura! Emoldura e pendura na parede!",
    "Bateu com raiva e carinho ao mesmo tempo. GOLAÇO!",
  ]);
  return pick([
    "Bateu com categoria! O goleiro só foi na foto!",
    "Sem chance pro arqueiro! Chute de gente grande!",
    "Estufou a rede! A torcida veio abaixo!",
  ]);
}
const WIN_LINES = [
  "Pode gritar: É CAMPEÃO! 🎉",
  "Frieza de matador. O rival foi pra casa chorando.",
  "Coloca na conta do camisa 10!",
];
const LOSE_LINES = [
  "Levanta a cabeça... e culpa a trave.",
  "Faz parte. Amanhã tem revanche!",
  "O goleiro deles jantou você hoje. 🐔",
];

/* checa se o alvo bruto acerta a madeira; devolve o ponto de impacto ou null */
function postCheck(raw) {
  const inY = raw.y > G.T - 6 && raw.y < G.B;
  if (inY && Math.abs(raw.x - G.L) < 10) return { x: G.L, y: clamp(raw.y, G.T + 6, G.B - 6), bar: false };
  if (inY && Math.abs(raw.x - G.R) < 10) return { x: G.R, y: clamp(raw.y, G.T + 6, G.B - 6), bar: false };
  if (raw.x > G.L && raw.x < G.R && Math.abs(raw.y - G.T) < 10) return { x: clamp(raw.x, G.L + 8, G.R - 8), y: G.T, bar: true };
  return null;
}

function finishTarget(raw, quality) {
  if (quality === "out") {
    const vx = raw.x - G.CX, vy = raw.y - G.CY;
    const n = Math.hypot(vx, vy) || 1;
    let t = { x: G.CX + (vx / n) * 235, y: G.CY + (vy / n) * 165 };
    if (t.x > G.L && t.x < G.R && t.y > G.T - 12) t.y = G.T - 40;
    return { target: t, post: false };
  }
  const hit = postCheck(raw);
  if (hit) return { target: { x: hit.x, y: hit.y }, post: true, bar: hit.bar };
  return {
    target: { x: clamp(raw.x, G.L + 13, G.R - 13), y: clamp(raw.y, G.T + 11, G.B - 9) },
    post: false,
  };
}

function buildShot(aimPoint, offset) {
  const d = aimDifficulty(aimPoint);
  let quality;
  if (offset <= 0.32) quality = "strong";
  else if (offset <= 0.62) quality = "weak";
  else quality = d > 0.5 ? "out" : "veryweak";
  const dev = offset * 34 + 5;
  const raw = { x: aimPoint.x + gauss(dev), y: aimPoint.y + gauss(dev * 0.7) };
  const ft = finishTarget(raw, quality);
  return { target: ft.target, post: ft.post, bar: ft.bar || false, quality, offset, difficulty: d };
}

/* resultado: G gol, S defesa, O fora, P trave */
function computeResult(shot, dive, tapTime, flight) {
  if (shot.post) return "P";
  if (shot.quality === "out") return "O";
  if (!dive || tapTime == null || tapTime >= flight) return "G";
  const base = shot.quality === "strong" ? 72 : shot.quality === "weak" ? 118 : 158;
  const reach = base * (0.4 + 0.6 * Math.max(0, 1 - tapTime / flight));
  return dist(shot.target, dive) < reach ? "S" : "G";
}
/* agarra (chute fraco ou pulo em cima) ou espalma (chute forte no limite)? — determinístico */
function isCatch(shot, dive, tapTime, flight) {
  if (shot.quality !== "strong") return true;
  const reach = 72 * (0.4 + 0.6 * Math.max(0, 1 - tapTime / flight));
  return dist(shot.target, dive) < reach * 0.55;
}

function botKeeperPlan(level, shot, flight) {
  const correct = Math.random() < 0.3 + level * 0.055;
  let dive;
  if (correct) {
    const sd = Math.max(12, 76 - level * 6);
    dive = clampDive({ x: shot.target.x + gauss(sd), y: shot.target.y + gauss(sd * 0.8) });
  } else {
    const side = shot.target.x < G.CX ? 1 : -1;
    dive = clampDive({ x: G.CX + side * (70 + Math.random() * 80), y: 104 + Math.random() * 82 });
  }
  const tapTime = clamp(400 - level * 27 + gauss(70), 70, flight * 0.92);
  const result = computeResult(shot, dive, tapTime, flight);
  return { type: "bot", dive, tapTime, result };
}

function botShot(level) {
  const spots = [
    { x: 70, y: 92 }, { x: 330, y: 92 }, { x: 66, y: 186 }, { x: 334, y: 186 },
    { x: 140, y: 100 }, { x: 260, y: 100 }, { x: 200, y: 184 },
  ];
  const corner = Math.random() < 0.3 + level * 0.05;
  const base = corner ? spots[Math.floor(Math.random() * 4)] : spots[4 + Math.floor(Math.random() * 3)];
  const sd = Math.max(8, 40 - level * 3);
  const raw = { x: base.x + gauss(sd), y: base.y + gauss(sd) };
  const r = Math.random();
  const pOut = Math.max(0.02, 0.15 - level * 0.011);
  const pWeak = Math.max(0.07, 0.42 - level * 0.034);
  let quality = "strong";
  if (r < pOut) quality = "out";
  else if (r < pOut + pWeak) quality = "weak";
  const ft = finishTarget(raw, quality);
  return { target: ft.target, post: ft.post, bar: ft.bar || false, quality, offset: 0, difficulty: aimDifficulty(ft.target) };
}

/* ==================== BACKEND-START ====================
   Esta versao usa o armazenamento do artifact (preview).
   No site publicado, o build troca este bloco pelo Firebase. */
const KEY = (id) => "penaltis-match:" + id;
const DB_READY = true;
let _uid = null, _nameCache = "";
const nameStore = { get: () => _nameCache, set: (v) => { _nameCache = v; } };
const _tuto = {};
const tutoStore = { get: (k) => !!_tuto[k], set: (k) => { _tuto[k] = true; } };
async function ensureAuth() { if (!_uid) _uid = "anon-" + Math.random().toString(36).slice(2, 10); return _uid; }
async function readMatch(id) {
  try { const r = await window.storage.get(KEY(id), true); return r ? JSON.parse(r.value) : null; }
  catch (e) { return null; }
}
async function writeMatch(m) {
  m.seq = (m.seq || 0) + 1;
  await window.storage.set(KEY(m.id), JSON.stringify(m), true);
  return m;
}
async function recordHistory(m) {
  if (m.mode !== "online" || !m.winner) return;
  try {
    const rec = {
      id: m.id, date: new Date().toISOString(),
      a: { name: (m.players && m.players.A) || "jogador_1", team: m.teams.A, goals: goalsOf(m.kicks.A) },
      b: { name: (m.players && m.players.B) || "jogador_2", team: m.teams.B, goals: goalsOf(m.kicks.B) },
      winner: m.winner,
    };
    await window.storage.set("penaltis-hist:" + m.id, JSON.stringify(rec), true);
  } catch (e) { }
}
async function readHistory() {
  try {
    const l = await window.storage.list("penaltis-hist:", true);
    const keys = (l && l.keys ? l.keys : []).slice(-20);
    const out = [];
    for (const k of keys) {
      try { const r = await window.storage.get(k, true); if (r) out.push(JSON.parse(r.value)); } catch (e) { }
    }
    out.sort((a, b) => (a.date < b.date ? 1 : -1));
    return out;
  } catch (e) { return []; }
}
async function bumpMatchCount() {
  try {
    let n = 0;
    try { const r = await window.storage.get("penaltis-total", true); n = r ? parseInt(r.value) || 0 : 0; } catch (e) { }
    await window.storage.set("penaltis-total", String(n + 1), true);
  } catch (e) { }
}
async function readMatchCount() {
  try { const r = await window.storage.get("penaltis-total", true); return r ? parseInt(r.value) || 0 : 0; }
  catch (e) { return 0; }
}
async function serverBusy() { return false; }
function trackPresence() { }
/* ==================== BACKEND-END ==================== */

/* ================= FIGURAS ================= */
/* Goleiro paramétrico: pose = {x, y, rot, c (agachamento), d (mergulho), side} */
function Keeper({ pose, team }) {
  const t = TEAMS[team];
  const skin = "#C68958";
  const { x, y, rot = 0, c = 0, d = 0, side = 0 } = pose;
  const lead = side >= 0 ? 1 : -1;
  const airH = Math.max(0, 210 - (y + 40));

  let handL, handR, armBackPath, armFrontPath;
  if (d > 0.02) {
    const ext = 24 * d;
    handR = { x: side === 0 ? 3.5 : lead * (10 + 9 * d), y: -22 - ext };
    handL = { x: side === 0 ? -3.5 : lead * 2, y: -20 - ext * 0.92 };
    armFrontPath = `M ${8 * lead} -21 Q ${side === 0 ? 6 : lead * (12 + 4 * d)} ${-24 - 8 * d} ${handR.x} ${handR.y}`;
    armBackPath = `M ${-8 * lead} -21 Q ${side === 0 ? -6 : lead * 1} ${-26 - 10 * d} ${handL.x} ${handL.y}`;
  } else {
    handL = { x: -13.5 - 2 * c, y: 1 + 3 * c };
    handR = { x: 13.5 + 2 * c, y: 1 + 3 * c };
    armBackPath = `M -8 -21 Q ${-12 - 2 * c} ${-11 + 2 * c} ${handL.x} ${handL.y}`;
    armFrontPath = `M 8 -21 Q ${12 + 2 * c} ${-11 + 2 * c} ${handR.x} ${handR.y}`;
  }

  const hipY = 8 + 2 * c;
  const legs = [-1, 1].map((k) => {
    if (d > 0.02) {
      const back = -side * (7 + 1.5 * k) * d;
      return {
        knee: { x: k * 3 + back * 0.5, y: 17 + 2 * d },
        ank: { x: k * 4.5 + back, y: 26 - 3 * d + k * 1.2 },
      };
    }
    return {
      knee: { x: k * (6 + 2.5 * c), y: 18 - 1.5 * c },
      ank: { x: k * (6.2 + 1.5 * c), y: 29 - 4 * c },
    };
  });

  return (
    <g>
      {/* sombra fica no chão (linha do gol) e some conforme ele voa */}
      <ellipse cx={x} cy={210} rx={Math.max(8, 20 - airH * 0.25)} ry="4.2"
        fill={`rgba(0,0,0,${clamp(0.32 - airH / 220, 0.08, 0.32)})`} />
      <g transform={`translate(${x},${y + 3 * c}) rotate(${rot}) scale(1.28)`}>
        <g className={d === 0 ? "pk-sway" : ""}>
          {legs.map((L, i) => {
            const k = i === 0 ? -1 : 1;
            return (
              <g key={i}>
                <path d={`M ${3.5 * k} ${hipY} Q ${L.knee.x} ${L.knee.y} ${L.ank.x} ${L.ank.y}`} stroke={skin} strokeWidth="4.6" fill="none" strokeLinecap="round" />
                <path d={`M ${(L.knee.x + L.ank.x) / 2} ${(L.knee.y + L.ank.y) / 2 + 1} Q ${L.ank.x} ${L.ank.y - 2} ${L.ank.x} ${L.ank.y}`} stroke="#fff" strokeWidth="5" fill="none" strokeLinecap="round" />
                <path d={`M ${L.ank.x} ${L.ank.y} L ${L.ank.x + 2.6 * k} ${L.ank.y + 2.2}`} stroke="#141414" strokeWidth="4.6" strokeLinecap="round" />
              </g>
            );
          })}
          <path d={`M -6.2 -2 L -7.6 ${hipY + 1} L -1.6 ${hipY + 1.8} L 0 ${hipY - 3.5} L 1.6 ${hipY + 1.8} L 7.6 ${hipY + 1} L 6.2 -2 Q 0 0.4 -6.2 -2 Z`}
            fill={t.shorts} stroke="rgba(0,0,0,.28)" strokeWidth="0.6" />
          <path d={armBackPath} stroke={t.jersey} strokeWidth="4.4" fill="none" strokeLinecap="round" />
          <circle cx={handL.x} cy={handL.y} r="3.4" fill="#fff" stroke="#999" strokeWidth="0.7" />
          <path d="M -9 -23.5 L -6.2 -2 Q 0 0.4 6.2 -2 L 9 -23.5 Q 0 -26.5 -9 -23.5 Z"
            fill={t.jersey} stroke="rgba(0,0,0,.35)" strokeWidth="0.8" />
          <path d="M 2 -23.9 L 9 -23.5 L 6.2 -2 Q 3.5 -0.9 2 -0.9 Z" fill="rgba(0,0,0,.10)" />
          <path d="M -4 -24.6 Q 0 -22.6 4 -24.6 L 4 -26 Q 0 -24.2 -4 -26 Z" fill={t.trim} />
          <text x="0" y="-9.5" textAnchor="middle" fontSize="9" fontWeight="900" fill={t.text} fontFamily="'Inter',sans-serif">1</text>
          <rect x="-1.8" y="-28.6" width="3.6" height="4.2" fill={skin} />
          <circle cx="0" cy="-32.6" r="5.4" fill={skin} stroke="rgba(0,0,0,.22)" strokeWidth="0.5" />
          <path d="M -5.4 -33.6 A 5.4 5.4 0 0 1 5.4 -33.6 L 5.2 -35.9 A 5.4 5.4 0 0 0 -5.2 -35.9 Z" fill="#20160c" />
          <path d="M -5.4 -33.4 Q -4.5 -31.7 -4.7 -30.3 L -5.4 -30.8 Z" fill="#20160c" />
          <path d="M 5.4 -33.4 Q 4.5 -31.7 4.7 -30.3 L 5.4 -30.8 Z" fill="#20160c" />
          <path d={armFrontPath} stroke={t.jersey} strokeWidth="4.4" fill="none" strokeLinecap="round" />
          <circle cx={handR.x} cy={handR.y} r="3.4" fill="#fff" stroke="#999" strokeWidth="0.7" />
        </g>
      </g>
    </g>
  );
}

function Kicker({ team, runP = 0, kickP = 0, mood = null }) {
  const t = TEAMS[team];
  const skin = "#C68958";
  const p = easeOut(runP);
  const kp = easeOut(kickP);
  const cel = mood === "celebrate", sad = mood === "sad";
  const pos = lerp({ x: 118, y: 268 }, { x: 166, y: 262 }, p);
  const lean = cel ? -4 : sad ? 14 : 8 * p - 13 * kp;
  const kneeR = lerp(lerp({ x: 5, y: 20 }, { x: 11, y: 16 }, p), { x: 2, y: 13 }, kp);
  const ankR = lerp(lerp({ x: 5.5, y: 31 }, { x: 16, y: 24 }, p), { x: -6, y: 12 }, kp);
  const ankL = lerp({ x: -5.5, y: 31 }, { x: -7.5, y: 31 }, p);
  let handR = lerp(lerp({ x: 12, y: 0 }, { x: 15, y: -8 }, p), { x: 17, y: 2 }, kp);
  let handL = lerp(lerp({ x: -12, y: 0 }, { x: -15, y: 6 }, p), { x: -17, y: -9 }, kp);
  /* comemora de braços pro alto; lamenta de braços caídos e cabeça baixa */
  if (cel) { handL = { x: -16, y: -40 }; handR = { x: 16, y: -40 }; }
  if (sad) { handL = { x: -9, y: 7 }; handR = { x: 9, y: 7 }; }
  const armQx = cel ? 15 : sad ? 11 : 13;
  const armQy = cel ? -31 : sad ? -6 : -11;
  return (
    <g>
      {/* sombra sob os pés */}
      <ellipse cx={pos.x + 3} cy={pos.y + 37} rx="21" ry="4.4" fill="rgba(0,0,0,.32)" />
      <g transform={`translate(${pos.x},${pos.y}) rotate(${lean}) scale(1.12)`}>
        <g className={cel ? "pk-hop" : runP === 0 && kickP === 0 && !sad ? "pk-sway" : ""}>
          <path d={`M -3.8 8 Q -5.2 20 ${ankL.x} ${ankL.y}`} stroke={skin} strokeWidth="4.8" fill="none" strokeLinecap="round" />
          <path d={`M ${ankL.x + 0.8} ${ankL.y - 8} Q ${ankL.x} ${ankL.y - 4} ${ankL.x} ${ankL.y}`} stroke="#fff" strokeWidth="5.2" fill="none" strokeLinecap="round" />
          <path d={`M ${ankL.x} ${ankL.y} L ${ankL.x - 2.7} ${ankL.y + 2.3}`} stroke="#141414" strokeWidth="4.8" strokeLinecap="round" />
          <path d={`M 3.8 8 Q ${kneeR.x} ${kneeR.y} ${ankR.x} ${ankR.y}`} stroke={skin} strokeWidth="4.8" fill="none" strokeLinecap="round" />
          <path d={`M ${(kneeR.x + ankR.x) / 2} ${(kneeR.y + ankR.y) / 2} Q ${ankR.x} ${ankR.y - 2} ${ankR.x} ${ankR.y}`} stroke="#fff" strokeWidth="5.2" fill="none" strokeLinecap="round" />
          <path d={`M ${ankR.x} ${ankR.y} L ${ankR.x + 2.9} ${ankR.y + 1.9}`} stroke="#141414" strokeWidth="4.8" strokeLinecap="round" />
          <path d="M -6.6 -2 L -8 9.5 L -1.8 10.3 L 0 5 L 1.8 10.3 L 8 9.5 L 6.6 -2 Q 0 0.5 -6.6 -2 Z"
            fill={t.shorts} stroke="rgba(0,0,0,.28)" strokeWidth="0.6" />
          <path d={`M -9 -21 Q ${-armQx} ${armQy} ${handL.x} ${handL.y}`} stroke={t.jersey} strokeWidth="4.6" fill="none" strokeLinecap="round" />
          <path d={`M 9 -21 Q ${armQx} ${armQy} ${handR.x} ${handR.y}`} stroke={t.jersey} strokeWidth="4.6" fill="none" strokeLinecap="round" />
          <circle cx={handL.x} cy={handL.y} r="2.6" fill={skin} />
          <circle cx={handR.x} cy={handR.y} r="2.6" fill={skin} />
          <path d="M -9.6 -23.5 L -6.6 -2 Q 0 0.5 6.6 -2 L 9.6 -23.5 Q 0 -26.8 -9.6 -23.5 Z"
            fill={t.jersey} stroke="rgba(0,0,0,.35)" strokeWidth="0.9" />
          <path d="M 2.4 -24 L 9.6 -23.5 L 6.6 -2 Q 4 -0.8 2.4 -0.8 Z" fill="rgba(0,0,0,.10)" />
          <path d="M -4.4 -24.7 Q 0 -22.7 4.4 -24.7 L 4.4 -26.2 Q 0 -24.4 -4.4 -26.2 Z" fill={t.trim} />
          <text x="0" y="-8" textAnchor="middle" fontSize="11" fontWeight="900" fill={t.text} fontFamily="'Inter',sans-serif">10</text>
          <rect x="-1.9" y="-28.6" width="3.8" height="4.2" fill={skin} />
          <circle cx="0" cy="-32.8" r="5.6" fill="#2a1c0e" stroke="rgba(0,0,0,.3)" strokeWidth="0.5" />
          <path d="M -5.6 -31 Q 0 -28.2 5.6 -31 L 5.6 -33 L -5.6 -33 Z" fill="#2a1c0e" />
        </g>
      </g>
    </g>
  );
}

/* bola de futebol clássica: gomo central + 5 gomos ao redor, costuras, sombra esférica e rotação */
function Ball({ x, y, r = 13, o = 1, spin = 0 }) {
  const u = r / 13;
  const pent = (cx, cy, rr, rot) => {
    let p = "";
    for (let i = 0; i < 5; i++) {
      const a = ((rot + i * 72) * Math.PI) / 180;
      p += (i ? "L" : "M") + (cx + rr * Math.cos(a)).toFixed(2) + " " + (cy + rr * Math.sin(a)).toFixed(2) + " ";
    }
    return p + "Z";
  };
  const ring = [];
  for (let k = 0; k < 5; k++) {
    const a = ((-90 + 72 * k) * Math.PI) / 180;
    const dcx = Math.cos(a) * 9.4, dcy = Math.sin(a) * 9.4;
    ring.push({
      d: pent(dcx, dcy, 3.1, -90 + 72 * k + 36),
      s: { x1: Math.cos(a) * 4.5, y1: Math.sin(a) * 4.5, x2: dcx * 0.68, y2: dcy * 0.68 },
    });
  }
  return (
    <g transform={`translate(${x},${y})`} opacity={o}>
      <circle r={r} fill="url(#ballG)" />
      <g transform={`scale(${u}) rotate(${spin})`}>
        <path d={pent(0, 0, 4.4, -90)} fill="#1c1c1c" />
        {ring.map((g2, i) => (
          <g key={i}>
            <line x1={g2.s.x1} y1={g2.s.y1} x2={g2.s.x2} y2={g2.s.y2} stroke="#9a9a9a" strokeWidth="0.7" />
            <path d={g2.d} fill="#1c1c1c" />
          </g>
        ))}
      </g>
      <circle r={r} fill="url(#ballShade)" />
      <ellipse cx={-r * 0.34} cy={-r * 0.4} rx={r * 0.3} ry={r * 0.18} fill="rgba(255,255,255,.75)" />
      <circle r={r} fill="none" stroke="rgba(70,70,70,.5)" strokeWidth={Math.max(0.7, r * 0.055)} />
    </g>
  );
}

/* posição das mãos do goleiro no mundo (bola presa nas luvas / espalmada) — espelha o Keeper */
function keeperHands(pose) {
  const { rot = 0, c = 0, d = 0, side = 0 } = pose;
  const lead = side >= 0 ? 1 : -1;
  let hL, hR;
  if (d > 0.02) {
    const ext = 24 * d;
    hR = { x: side === 0 ? 3.5 : lead * (10 + 9 * d), y: -22 - ext };
    hL = { x: side === 0 ? -3.5 : lead * 2, y: -20 - ext * 0.92 };
  } else {
    hL = { x: -13.5 - 2 * c, y: 1 + 3 * c };
    hR = { x: 13.5 + 2 * c, y: 1 + 3 * c };
  }
  const s = 1.28, a = (rot * Math.PI) / 180, ox = pose.x, oy = pose.y + 3 * c;
  const tf = (p) => ({ x: ox + p.x * s * Math.cos(a) - p.y * s * Math.sin(a), y: oy + p.x * s * Math.sin(a) + p.y * s * Math.cos(a) });
  const L = tf(hL), R = tf(hR);
  return { L, R, mid: { x: (L.x + R.x) / 2, y: (L.y + R.y) / 2 } };
}

/* linha do tempo do goleiro: prontidão → carga → voo em arco → ATERRISSAGEM (deitando no chão) */
function keeperPoseAt(ft, tapTime, dive, caught) {
  const IDLE = { x: KEEPER_START.x, y: KEEPER_START.y, rot: 0, c: 0.35, d: 0, side: 0 };
  if (!dive || tapTime == null || ft < tapTime) return IDLE;
  const T = ft - tapTime, CD = 110, DD = 300, LD = 240;
  const dx = dive.x - KEEPER_START.x;
  const sideV = Math.abs(dx) < 24 ? 0 : Math.sign(dx);
  if (T < CD) return { ...IDLE, c: 0.35 + 0.65 * (T / CD) };
  if (T < CD + DD) {
    const kp = (T - CD) / DD, e = easeOut(kp);
    const kpos = lerp(KEEPER_START, dive, e);
    const arc = Math.sin(kp * Math.PI * 0.9) * (8 + 8 * Math.min(1, Math.abs(dx) / 120));
    return { x: kpos.x, y: kpos.y - arc, rot: clamp(dx / 150, -1, 1) * 82 * e, c: Math.max(0, 1 - kp * 2.2) * 0.6, d: e, side: sideV };
  }
  const le = easeOut(Math.min(1, (T - CD - DD) / LD));
  if (sideV === 0) {
    /* pulo vertical: volta ao chão de pé, abraçando a bola se agarrou */
    return {
      x: dive.x, y: KEEPER_START.y + (dive.y - KEEPER_START.y) * (1 - le * 0.9),
      rot: 0, c: 0.35 * le, d: 1 - le * (caught ? 0.55 : 0.6), side: 0,
    };
  }
  /* queda lateral: corpo gira até quase deitar e desce ao gramado */
  const rotF = clamp(dx / 150, -1, 1) * 82;
  const landY = Math.max(dive.y, Math.min(dive.y + 18, 194));
  return {
    x: dive.x + sideV * 8 * le,
    y: dive.y + (landY - dive.y) * le,
    rot: rotF + Math.sign(rotF) * (88 - Math.abs(rotF)) * le,
    c: 0,
    d: caught ? 1 - le * 0.5 : 1,
    side: sideV,
  };
}

function JerseyIcon({ team, size = 54 }) {
  const t = TEAMS[team];
  return (
    <svg width={size} height={size} viewBox="0 0 60 60">
      <path d="M18 8 L8 16 L14 26 L18 23 L18 52 L42 52 L42 23 L46 26 L52 16 L42 8 L36 8 Q30 15 24 8 Z"
        fill={t.jersey} stroke={t.trim} strokeWidth="2.5" />
      <text x="30" y="42" textAnchor="middle" fontSize="15" fontWeight="900" fill={t.text} fontFamily="'Inter',sans-serif">10</text>
    </svg>
  );
}

/* balão de tutorial com setinha */
function Balloon({ text, style, down = false }) {
  const arrow = {
    position: "absolute", left: "50%", transform: "translateX(-50%)",
    width: 0, height: 0, borderLeft: "8px solid transparent", borderRight: "8px solid transparent",
  };
  return (
    <div className="pk-pop" style={{
      position: "absolute", left: "50%", transform: "translateX(-50%)",
      background: "#fff", color: "#0a1a30", fontWeight: 800, fontSize: 12.5, lineHeight: 1.35,
      borderRadius: 12, padding: "9px 14px", maxWidth: 290, textAlign: "center",
      boxShadow: "0 8px 20px rgba(0,0,0,.45)", zIndex: 6, pointerEvents: "none",
      ...style,
    }}>
      {text}
      {down
        ? <div style={{ ...arrow, top: "100%", borderTop: "9px solid #fff" }} />
        : <div style={{ ...arrow, bottom: "100%", borderBottom: "9px solid #fff" }} />}
    </div>
  );
}

function FloodTower({ x, flip = false }) {
  return (
    <g transform={`translate(${x},0) ${flip ? "scale(-1,1)" : ""}`}>
      <rect x="-2.5" y="6" width="5" height="36" fill="#0c1626" />
      <rect x="-16" y="0" width="32" height="10" rx="2" fill="#101d31" stroke="#1d3050" strokeWidth="1" />
      {[-11, -4, 3, 10].map((lx, i) => <circle key={i} cx={lx} cy="5" r="2.6" fill="#fff8dc" />)}
      <path d="M -16 10 L 16 10 L 56 96 L -56 96 Z" fill="url(#beam)" opacity="0.5" />
    </g>
  );
}

/* ================= COMPONENTE ================= */
export default function PenaltisDoBrasil() {
  const [screen, setScreen] = useState("menu");
  const [mode, setMode] = useState("bot");
  const [botLevel, setBotLevel] = useState(5);
  const [myTeam, setMyTeam] = useState("yellow");
  const [role, setRole] = useState("A");
  const [match, setMatch] = useState(null);
  const [sub, setSub] = useState("idle");
  const [aim, setAim] = useState(null);
  const [barPos, setBarPos] = useState(0.5);
  const [anim, setAnim] = useState(null);
  const [result, setResult] = useState(null);
  const [lastPlay, setLastPlay] = useState(null);
  const [overLine, setOverLine] = useState("");
  const [flash, setFlash] = useState(null);
  const [joinCode, setJoinCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [muted, setMuted] = useState(false);
  const [myName, setMyName] = useState(nameStore.get());
  const [p1Name, setP1Name] = useState("");
  const [p2Name, setP2Name] = useState("");
  const [history, setHistory] = useState(null);
  const [invite, setInvite] = useState(false);
  const [tuto, setTuto] = useState({ aim: tutoStore.get("aim"), power: tutoStore.get("power"), react: tutoStore.get("react") });
  const [powerFx, setPowerFx] = useState(null);
  const [totalMatches, setTotalMatches] = useState(0);
  const [qrFail, setQrFail] = useState(false);

  const matchRef = useRef(null);
  const subRef = useRef("idle");
  const seqRef = useRef(0);
  const playedRef = useRef(0);
  const reactRef = useRef(-1);
  const rafRef = useRef(null);
  const liveRef = useRef(null);
  const flashTO = useRef(null);
  const sceneRef = useRef(null);
  const audioRef = useRef(null);
  const mutedRef = useRef(false);
  const pendingShotRef = useRef(null);
  const powerFxTO = useRef(null);

  useEffect(() => { matchRef.current = match; }, [match]);
  useEffect(() => { subRef.current = sub; }, [sub]);
  useEffect(() => { mutedRef.current = muted; }, [muted]);
  useEffect(() => { nameStore.set(myName); }, [myName]);
  useEffect(() => {
    if (screen !== "menu") return;
    let on = true;
    readMatchCount().then((n) => { if (on) setTotalMatches(n); });
    return () => { on = false; };
  }, [screen]);
  /* convite via link ?sala=CODIGO (QR / WhatsApp) */
  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search);
      const c = (q.get("sala") || "").toUpperCase();
      if (c) { setJoinCode(c); setInvite(true); setScreen("setup_online"); }
    } catch (e) { }
  }, []);
  useEffect(() => () => { cancelAnimationFrame(rafRef.current); clearTimeout(flashTO.current); }, []);

  /* ---------------- ÁUDIO ---------------- */
  function A() {
    if (!audioRef.current) {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const master = ctx.createGain();
        master.gain.value = mutedRef.current ? 0 : 0.6;
        master.connect(ctx.destination);
        audioRef.current = { ctx, master, crowdGain: null, crowdNodes: [] };
      } catch (e) { return null; }
    }
    if (audioRef.current.ctx.state === "suspended") audioRef.current.ctx.resume();
    return audioRef.current;
  }
  function noiseBuf(ctx, dur = 2) {
    const b = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  const S = {
    crowdStart() {
      const a = A(); if (!a || a.crowdGain) return;
      try {
        const { ctx, master } = a;
        const src = ctx.createBufferSource(); src.buffer = noiseBuf(ctx, 2.5); src.loop = true;
        const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 520;
        const g = ctx.createGain(); g.gain.value = 0.05;
        const lfo = ctx.createOscillator(); lfo.frequency.value = 0.13;
        const lg = ctx.createGain(); lg.gain.value = 0.02;
        lfo.connect(lg); lg.connect(g.gain);
        src.connect(lp); lp.connect(g); g.connect(master);
        src.start(); lfo.start();
        a.crowdGain = g; a.crowdNodes = [src, lfo];
      } catch (e) { }
    },
    crowdStop() {
      const a = audioRef.current; if (!a || !a.crowdGain) return;
      try { a.crowdNodes.forEach((n) => n.stop()); } catch (e) { }
      a.crowdGain = null; a.crowdNodes = [];
    },
    swell(peak, up, hold, down) {
      const a = A(); if (!a || !a.crowdGain) return;
      const t = a.ctx.currentTime, g = a.crowdGain.gain;
      try {
        g.cancelScheduledValues(t);
        g.setValueAtTime(g.value, t);
        g.linearRampToValueAtTime(peak, t + up);
        g.setValueAtTime(peak, t + up + hold);
        g.linearRampToValueAtTime(0.05, t + up + hold + down);
      } catch (e) { }
    },
    whistle(long = false) {
      const a = A(); if (!a) return;
      try {
        const { ctx, master } = a, t = ctx.currentTime, dur = long ? 0.9 : 0.5;
        const o = ctx.createOscillator(); o.type = "square"; o.frequency.value = 2350;
        const g = ctx.createGain(); g.gain.value = 0;
        const lfo = ctx.createOscillator(); lfo.frequency.value = 42;
        const lg = ctx.createGain(); lg.gain.value = 0.05;
        lfo.connect(lg); lg.connect(g.gain);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.11, t + 0.02);
        g.gain.setValueAtTime(0.11, t + dur - 0.06);
        g.gain.linearRampToValueAtTime(0, t + dur);
        o.connect(g); g.connect(master);
        o.start(t); o.stop(t + dur + 0.05); lfo.start(t); lfo.stop(t + dur + 0.05);
      } catch (e) { }
    },
    kick() {
      buzz(30);
      const a = A(); if (!a) return;
      try {
        const { ctx, master } = a, t = ctx.currentTime;
        const o = ctx.createOscillator(); o.type = "sine";
        o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.55, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
        o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.16);
        const n = ctx.createBufferSource(); n.buffer = noiseBuf(ctx, 0.08);
        const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 700;
        const ng = ctx.createGain(); ng.gain.setValueAtTime(0.3, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
        n.connect(lp); lp.connect(ng); ng.connect(master); n.start(t);
      } catch (e) { }
    },
    post() {
      buzz([60,40,60]);
      const a = A(); if (!a) return;
      S.swell(0.16, 0.06, 0.2, 0.8);
      try {
        const { ctx, master } = a, t = ctx.currentTime;
        [842, 1275].forEach((f, i) => {
          const o = ctx.createOscillator(); o.type = "triangle"; o.frequency.value = f;
          const g = ctx.createGain();
          g.gain.setValueAtTime(i ? 0.09 : 0.15, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
          o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.45);
        });
      } catch (e) { }
    },
    bounce(v = 0.2) {
      const a = A(); if (!a) return;
      try {
        const { ctx, master } = a, t = ctx.currentTime;
        const o = ctx.createOscillator(); o.type = "sine";
        o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(55, t + 0.09);
        const g = ctx.createGain();
        g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.12);
      } catch (e) { }
    },
    goal() {
      buzz([30,50,30,50,120]);
      const a = A(); if (!a) return;
      S.swell(0.38, 0.1, 1.7, 2.2);
      try {
        const { ctx, master } = a, t = ctx.currentTime;
        /* rugido grave da torcida vibrando (varredura de frequência) */
        const low = ctx.createBufferSource(); low.buffer = noiseBuf(ctx, 2.6);
        const lbp = ctx.createBiquadFilter(); lbp.type = "bandpass"; lbp.Q.value = 0.7;
        lbp.frequency.setValueAtTime(280, t);
        lbp.frequency.linearRampToValueAtTime(950, t + 0.5);
        lbp.frequency.linearRampToValueAtTime(420, t + 2.3);
        const lg = ctx.createGain();
        lg.gain.setValueAtTime(0.001, t); lg.gain.linearRampToValueAtTime(0.3, t + 0.12);
        lg.gain.setValueAtTime(0.3, t + 1.1); lg.gain.exponentialRampToValueAtTime(0.001, t + 2.5);
        low.connect(lbp); lbp.connect(lg); lg.connect(master); low.start(t);
        /* gritos agudos por cima */
        const n = ctx.createBufferSource(); n.buffer = noiseBuf(ctx, 2.0);
        const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 1400;
        const ng = ctx.createGain();
        ng.gain.setValueAtTime(0.001, t); ng.gain.linearRampToValueAtTime(0.16, t + 0.1);
        ng.gain.exponentialRampToValueAtTime(0.001, t + 1.9);
        n.connect(hp); hp.connect(ng); ng.connect(master); n.start(t);
        /* buzina de estádio */
        [464, 470].forEach((f) => {
          const o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = f;
          const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1100;
          const og = ctx.createGain();
          og.gain.setValueAtTime(0.001, t + 0.15); og.gain.linearRampToValueAtTime(0.07, t + 0.22);
          og.gain.setValueAtTime(0.07, t + 0.85); og.gain.linearRampToValueAtTime(0.001, t + 1.0);
          o.connect(lp); lp.connect(og); og.connect(master); o.start(t + 0.15); o.stop(t + 1.05);
        });
      } catch (e) { }
    },
    /* fanfarra de vitória: arpejo ascendente + acorde + torcida em festa */
    victory() {
      buzz([50,60,50,60,200]);
      const a = A(); if (!a) return;
      S.swell(0.34, 0.15, 2.2, 2.5);
      try {
        const { ctx, master } = a, t = ctx.currentTime;
        const notes = [523.25, 659.25, 783.99, 1046.5];
        notes.forEach((f, i) => {
          const st = t + i * 0.14, dur = i === 3 ? 0.95 : 0.22;
          const o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = f;
          const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2200;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.001, st); g.gain.linearRampToValueAtTime(0.1, st + 0.02);
          g.gain.setValueAtTime(0.1, st + dur - 0.08); g.gain.linearRampToValueAtTime(0.001, st + dur);
          o.connect(lp); lp.connect(g); g.connect(master); o.start(st); o.stop(st + dur + 0.05);
        });
        /* acorde de apoio sob a nota final */
        [523.25, 659.25, 783.99].forEach((f) => {
          const st = t + 0.56;
          const o = ctx.createOscillator(); o.type = "triangle"; o.frequency.value = f;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.001, st); g.gain.linearRampToValueAtTime(0.055, st + 0.05);
          g.gain.setValueAtTime(0.055, st + 0.8); g.gain.linearRampToValueAtTime(0.001, st + 1.1);
          o.connect(g); g.connect(master); o.start(st); o.stop(st + 1.15);
        });
        /* brilho de confete */
        const n = ctx.createBufferSource(); n.buffer = noiseBuf(ctx, 1.3);
        const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 3200;
        const ng = ctx.createGain();
        ng.gain.setValueAtTime(0.001, t + 0.4); ng.gain.linearRampToValueAtTime(0.07, t + 0.55);
        ng.gain.exponentialRampToValueAtTime(0.001, t + 1.6);
        n.connect(hp); hp.connect(ng); ng.connect(master); n.start(t + 0.4);
      } catch (e) { }
    },
    /* trombone triste de derrota: 4 notas descendo, a última escorregando com vibrato */
    defeat() {
      buzz(160);
      const a = A(); if (!a) return;
      S.swell(0.02, 0.3, 0.5, 2);
      try {
        const { ctx, master } = a, t = ctx.currentTime;
        const seq = [[294, 0, 0.3], [277, 0.32, 0.3], [262, 0.64, 0.3], [247, 0.96, 1.05]];
        seq.forEach(([f, off, dur], i) => {
          const st = t + off;
          const o = ctx.createOscillator(); o.type = "sawtooth";
          o.frequency.setValueAtTime(f, st);
          if (i === 3) {
            o.frequency.linearRampToValueAtTime(f * 0.84, st + dur);
            const lfo = ctx.createOscillator(); lfo.frequency.value = 6;
            const lg2 = ctx.createGain(); lg2.gain.value = 8;
            lfo.connect(lg2); lg2.connect(o.frequency); lfo.start(st); lfo.stop(st + dur);
          }
          const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 750;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.001, st); g.gain.linearRampToValueAtTime(0.11, st + 0.03);
          g.gain.setValueAtTime(0.11, st + dur - 0.1); g.gain.linearRampToValueAtTime(0.001, st + dur);
          o.connect(lp); lp.connect(g); g.connect(master); o.start(st); o.stop(st + dur + 0.05);
        });
      } catch (e) { }
    },
    save() {
      buzz(80);
      const a = A(); if (!a) return;
      S.swell(0.2, 0.08, 0.3, 0.8);
      try {
        const { ctx, master } = a, t = ctx.currentTime;
        const n = ctx.createBufferSource(); n.buffer = noiseBuf(ctx, 0.5);
        const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 700; bp.Q.value = 0.8;
        const ng = ctx.createGain();
        ng.gain.setValueAtTime(0.001, t); ng.gain.linearRampToValueAtTime(0.2, t + 0.06);
        ng.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
        n.connect(bp); bp.connect(ng); ng.connect(master); n.start(t);
      } catch (e) { }
    },
    out() {
      buzz(40);
      const a = A(); if (!a) return;
      S.swell(0.12, 0.08, 0.15, 0.7);
      try {
        const { ctx, master } = a, t = ctx.currentTime;
        const o = ctx.createOscillator(); o.type = "sawtooth";
        o.frequency.setValueAtTime(240, t); o.frequency.linearRampToValueAtTime(120, t + 0.7);
        const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 500;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.001, t); g.gain.linearRampToValueAtTime(0.06, t + 0.1);
        g.gain.linearRampToValueAtTime(0.001, t + 0.75);
        o.connect(lp); lp.connect(g); g.connect(master); o.start(t); o.stop(t + 0.8);
      } catch (e) { }
    },
  };

  /* ---------------- FLUXO ---------------- */
  const iAmKicker = (m) => kickerOf(m) === role;

  const markTuto = (k) => { if (tuto[k]) return; tutoStore.set(k); setTuto((t) => ({ ...t, [k]: true })); };

  function doFlash(txt, dur = 900) {
    clearTimeout(flashTO.current);
    setFlash(txt);
    flashTO.current = setTimeout(() => setFlash(null), dur);
  }

  function startTurn(m) {
    setAnim(null); setResult(null); setAim(null); setFlash(null); setLastPlay(null);
    liveRef.current = null;
    if (m.winner) {
      const mine = m.mode === "local" ? true : m.winner === role;
      setOverLine(pick(mine ? WIN_LINES : LOSE_LINES));
      setSub("over");
      S.whistle(true);
      setTimeout(() => (mine ? S.victory() : S.defeat()), 700);
      if (m.mode !== "online") bumpMatchCount();
      return;
    }
    if (m.mode === "online" && !m.joined.B) { setSub("wait_join"); return; }
    if (m.mode === "local") { setSub("pass_kick"); return; }
    if (iAmKicker(m)) { setSub("aim"); return; }
    if (m.mode === "bot") {
      setSub("wait_shot");
      setTimeout(() => {
        if (matchRef.current !== m || subRef.current !== "wait_shot") return;
        const shot = botShot(m.level);
        startKickSequence(shot, { type: "user" }, (res, dive, tapTime, flight) => {
          const nm = advance(matchRef.current, shot, dive, tapTime, flight, res);
          matchRef.current = nm; setMatch(nm); startTurn(nm);
        });
      }, 700);
    } else {
      setSub("wait_shot");
    }
  }

  function advance(m, shot, dive, tapTime, flight, res) {
    const k = kickerOf(m);
    const nm = { ...m, kicks: { A: [...m.kicks.A], B: [...m.kicks.B] } };
    nm.kicks[k].push(res);
    nm.lastKick = { shot, dive, tapTime, flight, result: res, kicker: k, kickNumber: m.kickNumber };
    nm.kickNumber = m.kickNumber + 1;
    nm.currentShot = null;
    nm.winner = checkWinner(nm.kicks.A, nm.kicks.B);
    return nm;
  }

  /* ------ sequência: preparação → CHUTOU → voo → FÍSICA (trave/espalmada/quique) → resultado ------ */
  function startKickSequence(shot, keeperCfg, onDone) {
    cancelAnimationFrame(rafRef.current);
    const flight = flightOf(shot.quality);
    const prep = keeperCfg.type === "user" ? 950 + Math.random() * 950 : 600;
    const live = { shot, flight, prep, keeperCfg, tap: null, kicked: false, flightDone: false, done: false, phys: null, lastT: null };
    liveRef.current = live;
    setResult(null); setAim(null); setLastPlay(null);
    setSub(keeperCfg.type === "user" ? "react" : "kick_anim");
    S.whistle();
    const dv0 = keeperCfg.dive ? clampDive(keeperCfg.dive) : null;
    const t0 = performance.now();
    live.t0 = t0;

    const ballAt = (pp, endPoint) => {
      const flat = lerp(BALL_START, endPoint, easeOut(pp));
      return {
        x: flat.x, flatY: flat.y,
        y: flat.y - Math.sin(pp * Math.PI) * (shot.quality === "strong" ? 30 : 16),
        r: 13 - 5.5 * easeOut(pp),
      };
    };
    const shadowFor = (x, y, groundY, r) => {
      const h = Math.max(0, groundY - y);
      return {
        x, y: groundY,
        o: clamp(0.34 - h / 420, 0.07, 0.34),
        s: clamp(1 - h / 260, 0.45, 1) * (r / 13),
      };
    };

    const step = (t) => {
      if (liveRef.current !== live) return;
      const dt = live.lastT ? Math.min(0.05, (t - live.lastT) / 1000) : 0.016;
      live.lastT = t;
      const el = t - t0;

      /* fase 1: preparação */
      if (el < prep) {
        setAnim({
          ball: BALL_START, ballR: 13, trail: [],
          shadow: { x: BALL_START.x, y: 296, o: 0.34, s: 1 },
          keeper: { x: KEEPER_START.x, y: KEEPER_START.y, rot: 0, c: 0.35, d: 0, side: 0 },
          runP: el / prep, kickP: 0,
        });
        rafRef.current = requestAnimationFrame(step);
        return;
      }
      if (!live.kicked) {
        live.kicked = true;
        S.kick();
        if (keeperCfg.type === "user") doFlash("CHUTOU! 🫵", 900);
      }
      const ft = el - prep;
      const p = Math.min(1, ft / flight);

      let dive = null, tapTime = null;
      if (keeperCfg.type === "user") { if (live.tap) { dive = live.tap.point; tapTime = live.tap.time; } }
      else { dive = dv0; tapTime = keeperCfg.tapTime; }

      /* pose do goleiro pela linha do tempo (inclui aterrissagem; congela ao fim) */
      const keeper = keeperPoseAt(ft, tapTime, dive, !!live.caught);
      const kickP = clamp(ft / 190, 0, 1);

      /* fase 2: voo até o destino */
      if (!live.flightDone) {
        const knownRes = keeperCfg.type !== "user"
          ? keeperCfg.result
          : (p >= 1 ? computeResult(shot, dive, tapTime, flight) : null);
        const endPoint = knownRes === "S" && dive ? dive : shot.target;
        const b = ballAt(p, endPoint);
        const spin = easeOut(p) * 560 * Math.sign((endPoint.x - BALL_START.x) || 1);
        live.spin = spin;
        const trail = shot.quality === "strong" && p > 0.1
          ? [0.08, 0.16].map((dd) => (p - dd > 0 ? ballAt(p - dd, endPoint) : null)).filter(Boolean)
          : [];
        setAnim({
          ball: { x: b.x, y: b.y }, ballR: b.r, trail, spin,
          shadow: shadowFor(b.x, b.y, groundAt(p), b.r),
          keeper, runP: 1, kickP,
        });
        if (p < 1) { rafRef.current = requestAnimationFrame(step); return; }

        /* voo terminou: resolve e prepara a física */
        live.flightDone = true;
        const res = keeperCfg.type === "user" ? knownRes : keeperCfg.result;
        live.res = res; live.dive = dive; live.tapTime = tapTime;
        const caught = res === "S" && dive ? isCatch(shot, dive, tapTime, flight) : false;
        live.caught = caught;
        const end = res === "S" && dive ? dive : shot.target;
        live.rest = { ...end };
        const dir = { x: (end.x - BALL_START.x), y: (end.y - BALL_START.y) };
        const dn = Math.hypot(dir.x, dir.y) || 1;
        dir.x /= dn; dir.y /= dn;

        if (res === "G") {
          /* GOL: a bola estufa a rede, é freada por ela e cai dentro do gol */
          live.phys = { x: end.x, y: end.y, r: 7.5, vx: dir.x * 62, vy: dir.y * 62, floor: G.B - 6, net: true, moving: true };
        } else if (res === "P") {
          /* trave: reflete e volta pro campo quicando */
          S.post();
          const v = shot.bar
            ? { x: dir.x * 90 + gauss(30), y: 170 + Math.random() * 60 }
            : { x: -Math.sign(dir.x || 1) * (110 + Math.random() * 80), y: 120 + Math.random() * 70 };
          live.phys = { x: end.x, y: end.y, r: 7.5, vx: v.x, vy: v.y, floor: 250, moving: true };
        } else if (res === "O" && end.y > 46) {
          /* pra fora rente: passa e quica atrás da linha */
          live.phys = { x: end.x, y: end.y, r: 7.5, vx: dir.x * 160, vy: Math.max(50, dir.y * 160), floor: 222, moving: true };
        } else if (res === "S" && !caught) {
          /* ESPALMADA: rebate da ponta das luvas e quica no campo */
          const hp = keeperHands(keeper).mid;
          const sgn = Math.sign(end.x - G.CX) || (Math.random() < 0.5 ? -1 : 1);
          live.phys = { x: hp.x, y: hp.y, r: 7.5, vx: sgn * (150 + Math.random() * 110), vy: 30 + Math.random() * 70, floor: 252, moving: true };
        }
        /* defesa com agarrada: sem física — a bola gruda nas luvas e acompanha o goleiro */

        setLastPlay({
          shot, dive, tapTime, result: res, caught,
          big: res === "S" && !caught ? "ESPALMOU!" : pick(BANNER[res]),
          comment: commentFor(res, shot, dive, caught),
        });
        setResult(res);
        if (res === "G") S.goal();
        else if (res === "S") S.save();
        else if (res === "O") S.out();
        setSub("result");
        setTimeout(() => { live.done = true; onDone(res, dive, tapTime, flight); }, 2400);
        rafRef.current = requestAnimationFrame(step);
        return;
      }

      /* fase 3: física dos quiques / rede / bola nas luvas, enquanto o banner aparece */
      if (live.phys && live.phys.moving) {
        const ph = live.phys;
        ph.vy += GRAVITY * dt;
        if (ph.net) {
          /* a rede absorve: freia forte o avanço da bola */
          ph.vx *= Math.pow(0.03, dt);
          if (ph.vy < 0) ph.vy *= Math.pow(0.03, dt);
        }
        ph.x += ph.vx * dt;
        ph.y += ph.vy * dt;
        ph.x = clamp(ph.x, ph.net ? G.L + 8 : 6, ph.net ? G.R - 8 : 394);
        ph.r = clamp(7.5 + (ph.y - 214) * 0.035, 6.5, 11);
        live.spin = (live.spin || 0) + ph.vx * dt * 3.2;
        if (ph.y >= ph.floor) {
          ph.y = ph.floor;
          if (Math.abs(ph.vy) > 75) {
            if (!ph.net) S.bounce(clamp(Math.abs(ph.vy) / 900, 0.06, 0.26));
            ph.vy = -ph.vy * (ph.net ? 0.28 : 0.45);
            ph.vx *= 0.72;
          } else {
            ph.vy = 0;
            ph.vx *= Math.pow(0.25, dt); /* rolando até parar */
            if (Math.abs(ph.vx) < 6) ph.moving = false;
          }
        }
        setAnim((a) => ({
          ...a, keeper,
          ball: { x: ph.x, y: ph.y }, ballR: ph.r, trail: [], spin: live.spin,
          shadow: shadowFor(ph.x, ph.y, ph.floor, ph.r),
        }));
      } else if (live.phys) {
        setAnim((a) => ({ ...a, keeper }));
      } else if (live.res === "S" && live.dive) {
        /* bola AGARRADA: gruda nas luvas e acompanha as mãos durante toda a aterrissagem */
        const hp = keeperHands(keeper).mid;
        setAnim((a) => ({
          ...a, keeper,
          ball: hp, ballR: 7.5, trail: [], spin: live.spin || 0,
          shadow: shadowFor(hp.x, hp.y, 210, 7.5),
        }));
      } else {
        /* bola parada (isolada na arquibancada etc.) */
        setAnim((a) => ({
          ...a, keeper,
          ball: live.rest, ballR: 7.5, trail: [], spin: live.spin || 0,
          shadow: shadowFor(live.rest.x, live.rest.y, 214, 7.5),
        }));
      }
      if (!live.done) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
  }

  /* ---------------- MESMO CELULAR (passa-e-joga) ---------------- */
  function startLocal() {
    A(); S.crowdStart();
    const t1 = myTeam;
    const m = {
      id: "LOCAL", mode: "local",
      teams: { A: t1, B: other(t1) },
      players: { A: (p1Name.trim() || "Jogador 1").slice(0, 14), B: (p2Name.trim() || "Jogador 2").slice(0, 14) },
      joined: { A: true, B: true },
      kicks: { A: [], B: [] }, kickNumber: 0, winner: null,
      currentShot: null, lastKick: null, seq: 0,
    };
    setMode("local"); setRole("A");
    setMatch(m); matchRef.current = m; setScreen("game"); startTurn(m);
  }
  function startLocalDefense() {
    const shot = pendingShotRef.current;
    if (!shot) return;
    pendingShotRef.current = null;
    startKickSequence(shot, { type: "user" }, (res, dive, tapTime, flight) => {
      const nm = advance(matchRef.current, shot, dive, tapTime, flight, res);
      matchRef.current = nm; setMatch(nm); startTurn(nm);
    });
  }

  /* ---------------- BOT ---------------- */
  function startBot(team) {
    setMode("bot"); setRole("A"); setMyTeam(team);
    A(); S.crowdStart();
    const m = {
      id: "BOT", mode: "bot", level: botLevel,
      teams: { A: team, B: other(team) },
      joined: { A: true, B: true },
      kicks: { A: [], B: [] }, kickNumber: 0, winner: null,
      currentShot: null, lastKick: null, seq: 0,
    };
    setMatch(m); matchRef.current = m; setScreen("game"); startTurn(m);
  }

  /* ---------------- ONLINE ---------------- */
  async function createOnline(team) {
    if (!DB_READY) { setErr("Modo online indisponível neste ambiente."); return; }
    setBusy(true); setErr("");
    await ensureAuth();
    trackPresence();
    if (await serverBusy()) {
      setErr("🥵 Servidor lotado agora! Muita gente jogando — espere uns minutinhos e tente de novo.");
      setBusy(false); return;
    }
    A(); S.crowdStart();
    try {
      const m = {
        id: genCode(), mode: "online",
        teams: { A: team, B: other(team) },
        players: { A: (myName.trim() || "jogador_1").slice(0, 14), B: null },
        joined: { A: true, B: false },
        kicks: { A: [], B: [] }, kickNumber: 0, winner: null,
        currentShot: null, lastKick: null, seq: 0,
      };
      await writeMatch(m);
      seqRef.current = m.seq; playedRef.current = 0; reactRef.current = -1;
      setMode("online"); setRole("A"); setMyTeam(team);
      setMatch(m); matchRef.current = m;
      setScreen("game"); setSub("wait_join");
    } catch (e) { setErr("Não foi possível criar a partida. Tente de novo."); }
    setBusy(false);
  }

  async function joinOnline() {
    if (!DB_READY) { setErr("Modo online indisponível neste ambiente."); return; }
    await ensureAuth();
    const code = joinCode.trim().toUpperCase();
    if (code.length < 4) { setErr("Digite o código da partida."); return; }
    setBusy(true); setErr("");
    trackPresence();
    if (await serverBusy()) {
      setErr("🥵 Servidor lotado agora! Muita gente jogando — espere uns minutinhos e tente de novo.");
      setBusy(false); return;
    }
    A(); S.crowdStart();
    try {
      const m = await readMatch(code);
      if (!m) { setErr("Partida não encontrada. Confira o código."); setBusy(false); return; }
      if (m.joined.B) { setErr("Essa partida já tem 2 jogadores."); setBusy(false); return; }
      m.joined.B = true;
      m.players = { ...(m.players || {}), B: (myName.trim() || "jogador_2").slice(0, 14) };
      await writeMatch(m);
      seqRef.current = m.seq; playedRef.current = m.kickNumber; reactRef.current = -1;
      setMode("online"); setRole("B"); setMyTeam(m.teams.B);
      setMatch(m); matchRef.current = m;
      setScreen("game"); startTurn(m);
    } catch (e) { setErr("Erro ao entrar na partida. Tente de novo."); }
    setBusy(false);
  }

  async function submitShotOnline(shot) {
    try {
      const fresh = (await readMatch(matchRef.current.id)) || matchRef.current;
      fresh.currentShot = shot;
      await writeMatch(fresh);
      seqRef.current = fresh.seq; matchRef.current = fresh;
      setMatch(fresh); setSub("wait_dive");
    } catch (e) { setErr("Erro de conexão. Tente chutar de novo."); setSub("aim"); }
  }

  function startOnlineDefense(m) {
    const shot = m.currentShot;
    reactRef.current = m.kickNumber;
    startKickSequence(shot, { type: "user" }, async (res, dive, tapTime, flight) => {
      try {
        const nm = advance(matchRef.current, shot, dive, tapTime, flight, res);
        await writeMatch(nm);
        seqRef.current = nm.seq; playedRef.current = nm.kickNumber; matchRef.current = nm;
        if (nm.winner) { recordHistory(nm); bumpMatchCount(); }
        setMatch(nm); startTurn(nm);
      } catch (e) { setErr("Erro de conexão ao salvar a defesa."); }
    });
  }

  useEffect(() => {
    if (mode !== "online" || screen !== "game" || !match?.id) return;
    const t = setInterval(async () => {
      const s = subRef.current;
      if (s === "kick_anim" || s === "react" || s === "result") return;
      const m = await readMatch(matchRef.current.id);
      if (!m || m.seq <= seqRef.current) return;
      seqRef.current = m.seq;
      if (m.lastKick && m.kickNumber > playedRef.current) {
        playedRef.current = m.kickNumber;
        matchRef.current = m;
        if (m.winner) recordHistory(m);
        const lk = m.lastKick;
        startKickSequence(lk.shot, { type: "replay", dive: lk.dive, tapTime: lk.tapTime, result: lk.result },
          () => { setMatch(m); startTurn(m); });
      } else if (m.currentShot && kickerOf(m) !== role && reactRef.current !== m.kickNumber) {
        matchRef.current = m; setMatch(m);
        startOnlineDefense(m);
      } else {
        const prev = matchRef.current;
        matchRef.current = m; setMatch(m);
        if (prev && !prev.joined.B && m.joined.B) startTurn(m);
      }
    }, 1200);
    return () => clearInterval(t);
  }, [mode, screen, match?.id, role]);

  /* ---------------- BARRA DE FORÇA ---------------- */
  useEffect(() => {
    if (sub !== "power" || !aim) return;
    const d = aimDifficulty(aim);
    const speed = 0.42 + 1.5 * Math.pow(d, 1.25);
    const t0 = performance.now();
    let raf;
    const step = (t) => {
      const x = (((t - t0) / 1000) * speed * 2) % 2;
      setBarPos(x < 1 ? x : 2 - x);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [sub, aim]);

  function stopPower() {
    const offset = Math.abs(barPos - 0.5) * 2;
    buzz(15);
    markTuto("power");
    const fx = offset <= 0.12 ? { t: "PERFEITO! ⚡", c: "#22c55e" }
      : offset <= 0.32 ? { t: "FORTE! 💪", c: "#86efac" }
        : offset <= 0.62 ? { t: "FRAQUINHO... 🐢", c: "#f5d90a" }
          : { t: "PASSOU DO PONTO! 😬", c: "#ef4444" };
    clearTimeout(powerFxTO.current);
    setPowerFx(fx);
    powerFxTO.current = setTimeout(() => setPowerFx(null), 1100);
    const shot = buildShot(aim, offset);
    if (mode === "local") {
      /* guarda o chute e passa o celular pro defensor */
      pendingShotRef.current = shot;
      setAim(null); setSub("pass_dive");
      return;
    }
    if (mode === "bot") {
      const plan = botKeeperPlan(matchRef.current.level, shot, flightOf(shot.quality));
      startKickSequence(shot, plan, (res, dive, tapTime, flight) => {
        const nm = advance(matchRef.current, shot, dive, tapTime, flight, res);
        matchRef.current = nm; setMatch(nm); startTurn(nm);
      });
    } else {
      setSub("wait_dive");
      submitShotOnline(shot);
    }
  }

  /* ---------------- ENTRADA ---------------- */
  const toSvg = (e) => {
    const r = sceneRef.current.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * VW, y: ((e.clientY - r.top) / r.height) * VH };
  };

  function onSceneDown(e) {
    e.preventDefault();
    const p = toSvg(e);
    if (sub === "aim") {
      if (p.x > G.L - 16 && p.x < G.R + 16 && p.y > G.T - 18 && p.y < G.B + 12) {
        markTuto("aim");
        setAim({ x: clamp(p.x, G.L + 12, G.R - 12), y: clamp(p.y, G.T + 8, G.B - 6) });
        setSub("power");
      }
    } else if (sub === "power") {
      stopPower();
    } else if (sub === "react") {
      const live = liveRef.current;
      if (!live || live.flightDone) return;
      if (!live.kicked) { doFlash("Calma! Espere o chute ✋", 600); return; }
      if (live.tap) return;
      markTuto("react");
      buzz(20);
      live.tap = { point: clampDive(p), time: performance.now() - live.t0 - live.prep };
    }
  }

  /* ---------------- UI HELPERS ---------------- */
  const m = match;
  const crowd = useMemo(() => {
    const dots = [];
    for (let i = 0; i < 320; i++) {
      const tier = Math.random();
      dots.push({
        x: Math.random() * VW,
        y: tier < 0.4 ? 6 + Math.random() * 12 : tier < 0.75 ? 23 + Math.random() * 10 : 37 + Math.random() * 8,
        c: ["#FFCC00", "#1f9d55", "#2b4b9b", "#e8e3d0", "#c9622f", "#d94f4f"][Math.floor(Math.random() * 6)],
        r: 1 + Math.random() * 1.2,
        o: 0.3 + Math.random() * 0.55,
      });
    }
    return dots;
  }, []);
  const flags = useMemo(() => [...Array(7)].map(() => ({
    x: 24 + Math.random() * 352, y: 8 + Math.random() * 24,
    c: Math.random() < 0.5 ? "#FFCC00" : "#22c55e", f: Math.random() < 0.5,
  })), []);
  const confetti = useMemo(() => [...Array(16)].map((_, i) => ({
    left: 4 + (i * 6.1) % 92, delay: (i * 0.13) % 0.9, dur: 1.4 + (i % 4) * 0.25,
    c: ["#FFCC00", "#22c55e", "#fff", "#4ea3ff"][i % 4], rot: (i * 47) % 360,
  })), []);

  const suddenDeath = m && !m.winner && m.kickNumber >= 10;
  const slotCount = m ? Math.max(5, Math.ceil((m.kickNumber + 1) / 2)) : 5;

  function pips(arr) {
    const out = [];
    for (let i = 0; i < slotCount; i++) {
      const v = arr[i];
      out.push(
        <span key={i} style={{
          width: 15, height: 15, borderRadius: "50%", display: "inline-flex",
          alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 900,
          background: v === "G" ? "#22c55e" : v ? "#ef4444" : "rgba(255,255,255,.12)",
          color: "#fff", border: v ? "none" : "1.5px solid rgba(255,255,255,.35)",
        }}>{v === "G" ? "✓" : v ? "✕" : ""}</span>
      );
    }
    return out;
  }

  const dispName = (r) => {
    if (!m) return "";
    if (m.mode === "online") {
      const n = (m.players && m.players[r]) || (r === "A" ? "jogador_1" : "jogador_2");
      return r === role ? n + " ⭐" : n;
    }
    if (m.mode === "local") return (m.players && m.players[r]) || ("Jogador " + (r === "A" ? 1 : 2));
    return r === role ? "VOCÊ" : `BOT ${m.level}`;
  };
  const nameA = dispName("A");
  const nameB = dispName("B");

  const instruction = (() => {
    if (!m) return "";
    switch (sub) {
      case "aim": return "🎯 Toque no gol para mirar · meio é seguro, ângulo é pra gente grande";
      case "power": return "⚡ Respira... e pare a bola no MEIO da barra!";
      case "react": return "🧤 Fique pronto! Quando aparecer CHUTOU, toque onde quer voar!";
      case "wait_shot": return mode === "bot"
        ? "🎙️ O bot ajeita a bola na marca da cal... segura o coração!"
        : "🎙️ O rival ajeita a bola na marca da cal... prepare as luvas!";
      case "wait_join": return "Esperando o segundo jogador entrar...";
      case "wait_dive": return "⏳ Bola a caminho! O goleiro rival range os dentes...";
      default: return "";
    }
  })();

  const resultText = result
    ? {
      big: lastPlay?.big || { G: "GOOOOL!", S: "DEFENDEU!", P: "NA TRAVE!", O: "PRA FORA!" }[result],
      color: { G: "#22c55e", S: "#FFCC00", P: "#fb923c", O: "#ef4444" }[result],
    }
    : null;

  const resultSub = result && lastPlay?.comment ? "🎙️ " + lastPlay.comment : "";

  const inviteLink = m
    ? ((typeof window !== "undefined" && window.location ? window.location.origin + window.location.pathname : "") + "?sala=" + m.id)
    : "";
  function shareWhatsApp() {
    const txt = `⚽ Bora uma DISPUTA DE PÊNALTIS? Toque no link e entre: ${inviteLink} (ou use o código ${m.id})`;
    window.open("https://wa.me/?text=" + encodeURIComponent(txt), "_blank");
  }
  async function copyCode() {
    try { await navigator.clipboard.writeText(m.id); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch (e) { }
  }
  function toggleMute() {
    const nm = !muted; setMuted(nm);
    const a = A(); if (a) a.master.gain.value = nm ? 0 : 0.6;
  }
  function backToMenu() {
    S.crowdStop();
    cancelAnimationFrame(rafRef.current);
    liveRef.current = null;
    setScreen("menu"); setMatch(null); setSub("idle"); setErr("");
  }

  const aimSpeedHint = aim ? aimDifficulty(aim) : 0;
  const kickerTeam = m ? m.teams[kickerOf(m)] : "yellow";
  const keeperTeam = m ? m.teams[kickerOf(m) === "A" ? "B" : "A"] : "blue";
  const keeperPos = anim?.keeper || { x: KEEPER_START.x, y: KEEPER_START.y, rot: 0, c: 0.35, d: 0, side: 0 };
  const ballPos = anim?.ball || BALL_START;
  const ballR = anim?.ballR ?? 13;
  const trail = anim?.trail || [];
  const shadow = anim?.shadow || { x: BALL_START.x, y: 296, o: 0.34, s: 1 };
  const runP = anim?.runP ?? 0;
  const kickP = anim?.kickP ?? 0;
  const ballSpin = anim?.spin ?? 0;

  /* ================= ESTILOS ================= */
  const fontImport = (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@500;600;700;800;900&display=swap');
      .pk-root{font-family:'Inter','Helvetica Neue',Helvetica,system-ui,sans-serif;}
      .pk-display{font-family:'Inter','Helvetica Neue',Helvetica,sans-serif;font-weight:900;letter-spacing:-.01em;}
      .pk-btn{transition:transform .08s ease, filter .12s ease;}
      .pk-btn:active{transform:scale(.96);}
      @keyframes pk-sway{0%,100%{transform:translateY(0) rotate(.6deg)}50%{transform:translateY(-1.6px) rotate(-.6deg)}}
      .pk-sway{animation:pk-sway 1.5s ease-in-out infinite;transform-box:fill-box;transform-origin:50% 92%;}
      @keyframes pk-pop{0%{transform:scale(.6);opacity:0}60%{transform:scale(1.12)}100%{transform:scale(1);opacity:1}}
      .pk-pop{animation:pk-pop .35s ease-out both;}
      @keyframes pk-flash{0%{transform:scale(.4);opacity:0}25%{transform:scale(1.25);opacity:1}70%{transform:scale(1);opacity:1}100%{transform:scale(1);opacity:0}}
      .pk-flash{animation:pk-flash .9s ease-out both;}
      @keyframes pk-pulse{0%,100%{opacity:.5}50%{opacity:1}}
      .pk-pulse{animation:pk-pulse 1.4s ease-in-out infinite;}
      @keyframes pk-aim{0%,100%{transform:scale(1)}50%{transform:scale(1.25)}}
      .pk-aim{animation:pk-aim 1s ease-in-out infinite;transform-box:fill-box;transform-origin:center;}
      @keyframes pk-net{0%,100%{transform:translate(0,0)}15%{transform:translate(3.5px,2.5px)}35%{transform:translate(-3.5px,-2px)}55%{transform:translate(2.5px,-2.5px)}75%{transform:translate(-2px,1.8px)}}
      .pk-net{animation:pk-net .5s ease-out 3;}
      @keyframes pk-ring{0%{transform:scale(.3);opacity:.9}100%{transform:scale(2.4);opacity:0}}
      .pk-ring{animation:pk-ring .8s ease-out both;transform-box:fill-box;transform-origin:center;}
      @keyframes pk-conf{0%{transform:translateY(-10%) rotate(0deg);opacity:1}100%{transform:translateY(110vh) rotate(540deg);opacity:.2}}
      @keyframes pk-hop{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
      .pk-hop{animation:pk-hop .5s ease-in-out 3;transform-box:fill-box;transform-origin:50% 100%;}
      @keyframes pk-jump{0%,100%{transform:translateY(0)}50%{transform:translateY(-2.6px)}}
      .pk-j0{animation:pk-jump .45s ease-in-out infinite;}
      .pk-j1{animation:pk-jump .45s ease-in-out .15s infinite;}
      .pk-j2{animation:pk-jump .45s ease-in-out .3s infinite;}
      @keyframes pk-screenin{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
      .pk-screen{animation:pk-screenin .22s ease-out both;}
      @media (prefers-reduced-motion: reduce){*{animation-duration:.001s !important;animation-iteration-count:1 !important;transition:none !important;}}
    `}</style>
  );

  const bgGrad = "radial-gradient(55% 36% at 12% 6%, rgba(34,197,94,.14), transparent 60%), radial-gradient(50% 34% at 88% 4%, rgba(255,204,0,.11), transparent 60%), radial-gradient(120% 90% at 50% 0%, #123157 0%, #081426 55%, #050c18 100%)";
  const bgStyle = {
    minHeight: "100vh", background: bgGrad, color: "#fff",
    display: "flex", flexDirection: "column", alignItems: "center",
    padding: "16px 12px 32px", overflowY: "auto",
  };
  const bigBtn = (bg, color = "#081426") => ({
    display: "block", width: "100%", maxWidth: 340, margin: "10px auto",
    background: bg, color, border: "none", borderRadius: 14,
    padding: "14px 20px", fontSize: 16, fontWeight: 800, cursor: "pointer",
    boxShadow: "0 5px 0 rgba(0,0,0,.35)",
  });

  /* ================= MENU (landing page) ================= */
  if (screen === "menu") {
    const MenuBtn = ({ icon, title, subtitle, grad, glow, color, onClick }) => (
      <button className="pk-btn" onClick={onClick} style={{
        width: "100%", maxWidth: 360, margin: "7px auto", display: "flex", alignItems: "center", gap: 14,
        background: grad, border: "1px solid rgba(255,255,255,.3)", borderRadius: 18,
        padding: "14px 16px", cursor: "pointer", textAlign: "left", color,
        boxShadow: `0 12px 26px ${glow}, inset 0 1px 0 rgba(255,255,255,.5)`,
      }}>
        <span style={{
          width: 46, height: 46, borderRadius: 14, flexShrink: 0,
          background: "rgba(255,255,255,.35)", display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 23, boxShadow: "inset 0 0 0 1px rgba(255,255,255,.45)",
        }}>{icon}</span>
        <span style={{ flex: 1 }}>
          <span style={{ display: "block", fontWeight: 900, fontSize: 16, letterSpacing: "-.01em" }}>{title}</span>
          <span style={{ display: "block", fontWeight: 600, fontSize: 11.5, opacity: .75, marginTop: 1 }}>{subtitle}</span>
        </span>
        <span style={{ fontWeight: 900, fontSize: 22, opacity: .55 }}>›</span>
      </button>
    );
    return (
      <div className="pk-root pk-screen" style={bgStyle}>
        {fontImport}
        <div style={{ marginTop: 18, textAlign: "center" }}>
          <div style={{
            display: "inline-block", background: "#012776", color: "#FFCC00",
            fontWeight: 800, fontSize: 11, letterSpacing: ".3em", padding: "5px 14px",
            borderRadius: 999, border: "1px solid rgba(255,204,0,.4)",
          }}>⚽ A DECISÃO É SUA</div>
          <div className="pk-display" style={{ fontSize: 15, letterSpacing: ".46em", color: "rgba(255,255,255,.85)", marginTop: 12 }}>DISPUTA DE</div>
          <div className="pk-display" style={{
            fontSize: 58, lineHeight: 1, marginTop: 2,
            fontStyle: "italic", transform: "skewX(-5deg)",
            background: "linear-gradient(180deg, #FFE55C 0%, #FFCC00 55%, #E7A600 100%)",
            WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
            filter: "drop-shadow(0 4px 0 #012776) drop-shadow(0 8px 14px rgba(0,0,0,.5))",
          }}>PÊNALTIS</div>
          <div className="pk-display" style={{ fontSize: 13, color: "#22c55e", marginTop: 9, letterSpacing: ".24em" }}>
            GLÓRIA OU FRANGO — VOCÊ DECIDE
          </div>
        </div>

        {/* HERO: goleiro voando e bola no ângulo */}
        <div style={{
          width: "100%", maxWidth: 380, margin: "16px 0 6px",
          borderRadius: 20, overflow: "hidden", border: "1px solid rgba(255,255,255,.14)",
          boxShadow: "0 16px 40px rgba(0,0,0,.5)",
        }}>
          <svg viewBox="0 0 340 200" style={{ width: "100%", display: "block" }}>
            <defs>
              <linearGradient id="hSky" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1a3a5e" /><stop offset="100%" stopColor="#0a1a30" />
              </linearGradient>
              <linearGradient id="hGrass" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2f9e57" /><stop offset="100%" stopColor="#136433" />
              </linearGradient>
              <radialGradient id="ballG" cx="38%" cy="30%">
                <stop offset="0%" stopColor="#ffffff" /><stop offset="100%" stopColor="#d2d2d2" />
              </radialGradient>
              <radialGradient id="ballShade" cx="38%" cy="32%" r="75%">
                <stop offset="55%" stopColor="rgba(0,0,0,0)" /><stop offset="100%" stopColor="rgba(0,0,0,.32)" />
              </radialGradient>
              <radialGradient id="hGlow" cx="50%" cy="50%">
                <stop offset="0%" stopColor="rgba(255,250,215,.45)" /><stop offset="100%" stopColor="rgba(255,250,215,0)" />
              </radialGradient>
            </defs>
            <rect width="340" height="200" fill="url(#hSky)" />
            <circle cx="20" cy="0" r="70" fill="url(#hGlow)" />
            <circle cx="320" cy="0" r="70" fill="url(#hGlow)" />
            {[...Array(90)].map((_, i) => (
              <circle key={i} cx={(i * 41) % 340} cy={4 + ((i * 17) % 30)}
                r={1 + (i % 3) * 0.5}
                fill={["#FFCC00", "#1f9d55", "#2b4b9b", "#e8e3d0", "#c9622f"][i % 5]}
                opacity={0.35 + (i % 4) * 0.14} />
            ))}
            <rect y="36" width="340" height="10" fill="#012776" />
            <rect y="36" width="340" height="1.5" fill="rgba(255,255,255,.35)" />
            <rect y="46" width="340" height="154" fill="url(#hGrass)" />
            {[-3, -1, 1].map((i) => (
              <path key={i} d={`M ${170 + i * 30} 46 L ${170 + (i + 1) * 30} 46 L ${170 + (i + 1) * 62} 200 L ${170 + i * 62} 200 Z`} fill="rgba(0,0,0,.09)" />
            ))}
            {/* gol */}
            <rect x="52" y="52" width="236" height="96" fill="rgba(3,10,20,.5)" />
            {[...Array(16)].map((_, i) => (
              <line key={"v" + i} x1={58 + i * 14.5} y1="55" x2={60 + i * 14.5} y2="146" stroke="rgba(255,255,255,.2)" strokeWidth="1" />
            ))}
            {[...Array(6)].map((_, i) => (
              <line key={"h" + i} x1="53" y1={62 + i * 15} x2="287" y2={64 + i * 15} stroke="rgba(255,255,255,.16)" strokeWidth="1" />
            ))}
            <line x1="52" y1="52" x2="52" y2="150" stroke="#fff" strokeWidth="6" strokeLinecap="round" />
            <line x1="288" y1="52" x2="288" y2="150" stroke="#fff" strokeWidth="6" strokeLinecap="round" />
            <line x1="49" y1="52" x2="291" y2="52" stroke="#fff" strokeWidth="6" strokeLinecap="round" />
            <line x1="20" y1="150" x2="320" y2="150" stroke="rgba(255,255,255,.6)" strokeWidth="2" />
            {/* goleiro voando (sombra do componente cai fora do quadro) */}
            <g transform="translate(0,-46)">
              <Keeper pose={{ x: 150, y: 140, rot: 52, c: 0, d: 1, side: 1 }} team="blue" />
            </g>
            {/* bola no ângulo com rastro */}
            <line x1="176" y1="126" x2="242" y2="74" stroke="rgba(255,255,255,.25)" strokeWidth="3" strokeLinecap="round" strokeDasharray="2 10" />
            <Ball x={214} y={96} r={7} o={0.18} />
            <Ball x={236} y={79} r={7.5} o={0.32} />
            <Ball x={258} y={64} r={8.5} />
            <rect width="340" height="200" fill="none" />
          </svg>
        </div>

        <MenuBtn
          icon="🤖" title="Jogar contra o Bot"
          subtitle="10 níveis de goleiro: do frango garantido ao paredão"
          grad="linear-gradient(135deg,#FFE55C 0%,#FFC400 100%)"
          glow="rgba(255,204,0,.22)" color="#3a2c00"
          onClick={() => { setMode("bot"); setScreen("setup_bot"); }} />
        <MenuBtn
          icon="📱" title="2 jogadores no mesmo celular"
          subtitle="Um chuta, passa o celular, o outro defende"
          grad="linear-gradient(135deg,#7cc4ff 0%,#2f7fd6 100%)"
          glow="rgba(80,160,255,.22)" color="#04182e"
          onClick={() => setScreen("setup_local")} />
        <MenuBtn
          icon="👥" title="Jogar online com um amigo"
          subtitle="Código, QR ou link pelo WhatsApp"
          grad="linear-gradient(135deg,#4ade80 0%,#16a34a 100%)"
          glow="rgba(34,197,94,.22)" color="#04220f"
          onClick={() => { setMode("online"); setErr(""); setScreen("setup_online"); }} />
        <button className="pk-btn"
          onClick={async () => { setScreen("history"); setHistory(null); setHistory(await readHistory()); }}
          style={{
            width: "100%", maxWidth: 360, margin: "7px auto", display: "block",
            background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.18)",
            color: "#fff", borderRadius: 16, padding: "12px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer",
          }}>📜 Partidas jogadas</button>

        <div style={{ opacity: .55, fontSize: 12, marginTop: 12, textAlign: "center", maxWidth: 340 }}>
          5 cobranças pra cada lado, morte súbita e zero desculpas. Ative o som 🔊
        </div>
        {totalMatches > 0 && (
          <div className="pk-display" style={{ marginTop: 10, fontSize: 13, color: "#22c55e", letterSpacing: ".08em" }}>
            ⚽ {totalMatches.toLocaleString("pt-BR")} {totalMatches === 1 ? "PARTIDA JÁ DISPUTADA" : "PARTIDAS JÁ DISPUTADAS"}
          </div>
        )}
        <div style={{
          marginTop: 12, fontSize: 12, opacity: .8, textAlign: "center",
          background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)",
          borderRadius: 999, padding: "7px 16px", fontWeight: 600,
        }}>
          ✨ Jogo idealizado e desenvolvido com IA por <span style={{ color: "#FFCC00", fontWeight: 800 }}>@helder_nakaya</span>
        </div>
      </div>
    );
  }

  /* ================= HISTORICO ================= */
  if (screen === "history") {
    return (
      <div className="pk-root pk-screen" style={bgStyle}>
        {fontImport}
        <div className="pk-display" style={{ fontSize: 28, color: "#FFCC00", marginTop: 10 }}>PARTIDAS JOGADAS</div>
        <div style={{ fontSize: 12, opacity: .6, marginTop: 4 }}>Últimas partidas online (2 jogadores)</div>
        <div style={{ width: "100%", maxWidth: 430, marginTop: 14 }}>
          {history === null && <div className="pk-pulse" style={{ textAlign: "center", fontWeight: 700, opacity: .7 }}>Carregando...</div>}
          {history && history.length === 0 && (
            <div style={{ textAlign: "center", opacity: .6, fontWeight: 600, padding: "0 20px" }}>
              Nenhuma partida registrada ainda. Bora inaugurar o placar! ⚽
            </div>
          )}
          {history && history.map((h, i) => {
            const d = new Date(h.date);
            const winA = h.winner === "A";
            return (
              <div key={h.id || i} style={{
                background: "rgba(0,0,0,.4)", border: "1px solid rgba(255,255,255,.1)",
                borderRadius: 12, padding: "10px 14px", marginBottom: 8,
              }}>
                <div style={{ fontSize: 10.5, opacity: .55, fontWeight: 600 }}>
                  {d.toLocaleDateString("pt-BR")} · {d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} · #{h.id}
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4, gap: 8 }}>
                  <span style={{ fontWeight: winA ? 900 : 600, color: winA ? "#FFCC00" : "#fff", fontSize: 13, display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: (TEAMS[h.a.team] || TEAMS.yellow).jersey, flexShrink: 0 }} />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.a.name}</span>{winA ? "🏆" : ""}
                  </span>
                  <span className="pk-display" style={{ fontSize: 18, color: "#FFCC00", flexShrink: 0 }}>{h.a.goals} × {h.b.goals}</span>
                  <span style={{ fontWeight: !winA ? 900 : 600, color: !winA ? "#FFCC00" : "#fff", fontSize: 13, display: "flex", alignItems: "center", gap: 6, minWidth: 0, justifyContent: "flex-end" }}>
                    {!winA ? "🏆" : ""}<span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.b.name}</span>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: (TEAMS[h.b.team] || TEAMS.blue).jersey, flexShrink: 0 }} />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        <button className="pk-btn" style={{ ...bigBtn("transparent", "#fff"), boxShadow: "none", border: "2px solid rgba(255,255,255,.25)" }}
          onClick={() => setScreen("menu")}>Voltar</button>
      </div>
    );
  }

  const TeamPicker = ({ onPick }) => (
    <div style={{ display: "flex", gap: 14, justifyContent: "center", margin: "12px 0" }}>
      {["yellow", "blue"].map((t) => (
        <button key={t} className="pk-btn" onClick={() => onPick(t)}
          style={{
            background: myTeam === t ? "rgba(255,255,255,.14)" : "rgba(255,255,255,.05)",
            border: myTeam === t ? "3px solid #22c55e" : "3px solid rgba(255,255,255,.15)",
            borderRadius: 16, padding: "12px 18px", cursor: "pointer", color: "#fff",
          }}>
          <JerseyIcon team={t} size={50} />
          <div style={{ fontWeight: 800, fontSize: 12, marginTop: 5 }}>{TEAMS[t].name}</div>
        </button>
      ))}
    </div>
  );

  /* ================= SETUP BOT ================= */
  if (screen === "setup_bot") {
    return (
      <div className="pk-root pk-screen" style={bgStyle}>
        {fontImport}
        <div className="pk-display" style={{ fontSize: 30, color: "#FFCC00", marginTop: 10 }}>CONTRA O BOT</div>
        <div style={{ marginTop: 12, fontWeight: 700, fontSize: 14 }}>Escolha seu uniforme:</div>
        <TeamPicker onPick={setMyTeam} />
        <div style={{ fontWeight: 700, fontSize: 14 }}>Dificuldade: <span style={{ color: "#FFCC00" }}>nível {botLevel}</span></div>
        <input type="range" min="1" max="10" value={botLevel} onChange={(e) => setBotLevel(+e.target.value)}
          style={{ width: 270, margin: "10px 0", accentColor: "#FFCC00" }} />
        <div style={{ fontSize: 11, opacity: .6, marginBottom: 8 }}>1 = frango garantido · 10 = paredão com reflexo de gato</div>
        <button className="pk-btn" style={bigBtn("#22c55e", "#04220f")} onClick={() => startBot(myTeam)}>COMEÇAR ⚽</button>
        <button className="pk-btn" style={{ ...bigBtn("transparent", "#fff"), boxShadow: "none", border: "2px solid rgba(255,255,255,.25)" }}
          onClick={() => setScreen("menu")}>Voltar</button>
      </div>
    );
  }

  /* ================= SETUP MESMO CELULAR ================= */
  if (screen === "setup_local") {
    const inputSt = {
      marginTop: 6, padding: "11px 14px", fontSize: 15, textAlign: "center",
      borderRadius: 12, border: "2px solid rgba(255,255,255,.3)", background: "rgba(255,255,255,.08)",
      color: "#fff", width: 220, fontWeight: 700, outline: "none",
    };
    return (
      <div className="pk-root pk-screen" style={bgStyle}>
        {fontImport}
        <div className="pk-display" style={{ fontSize: 26, color: "#7cc4ff", marginTop: 10 }}>MESMO CELULAR</div>
        <div style={{ fontSize: 12, opacity: .6, marginTop: 4, textAlign: "center", maxWidth: 300 }}>
          Um chuta e passa o celular, o outro defende. Sem espiar! 👀
        </div>
        <div style={{ marginTop: 14, fontWeight: 700, fontSize: 14 }}>Jogador 1 (bate primeiro):</div>
        <input value={p1Name} onChange={(e) => setP1Name(e.target.value.slice(0, 14))} placeholder="Jogador 1" maxLength={14} style={inputSt} />
        <div style={{ marginTop: 12, fontWeight: 700, fontSize: 14 }}>Jogador 2:</div>
        <input value={p2Name} onChange={(e) => setP2Name(e.target.value.slice(0, 14))} placeholder="Jogador 2" maxLength={14} style={inputSt} />
        <div style={{ marginTop: 14, fontWeight: 700, fontSize: 14 }}>Uniforme do Jogador 1 (o 2 fica com o outro):</div>
        <TeamPicker onPick={setMyTeam} />
        <button className="pk-btn" style={bigBtn("#7cc4ff", "#04182e")} onClick={startLocal}>COMEÇAR ⚽</button>
        <button className="pk-btn" style={{ ...bigBtn("transparent", "#fff"), boxShadow: "none", border: "2px solid rgba(255,255,255,.25)" }}
          onClick={() => setScreen("menu")}>Voltar</button>
      </div>
    );
  }

  /* ================= SETUP ONLINE ================= */
  if (screen === "setup_online") {
    return (
      <div className="pk-root pk-screen" style={bgStyle}>
        {fontImport}
        <div className="pk-display" style={{ fontSize: 30, color: "#22c55e", marginTop: 10 }}>JOGO ONLINE</div>
        {invite && (
          <div style={{
            marginTop: 12, background: "rgba(34,197,94,.15)", border: "1px solid rgba(34,197,94,.4)",
            borderRadius: 12, padding: "9px 16px", fontWeight: 700, fontSize: 13, color: "#86efac",
          }}>🎟️ Convite recebido! Digite seu nome e toque em "Entrar na partida".</div>
        )}
        <div style={{ marginTop: 12, fontWeight: 700, fontSize: 14 }}>Seu nome (aparece no placar e no histórico):</div>
        <input value={myName} onChange={(e) => setMyName(e.target.value.slice(0, 14))}
          placeholder="jogador_1" maxLength={14}
          style={{
            marginTop: 8, padding: "11px 14px", fontSize: 15, textAlign: "center",
            borderRadius: 12, border: "2px solid rgba(255,255,255,.3)", background: "rgba(255,255,255,.08)",
            color: "#fff", width: 230, fontWeight: 700, outline: "none",
          }} />
        <div style={{ marginTop: 14, fontWeight: 700, fontSize: 14 }}>Criar partida — escolha seu uniforme:</div>
        <TeamPicker onPick={setMyTeam} />
        <button className="pk-btn" disabled={busy} style={bigBtn("#FFCC00")} onClick={() => createOnline(myTeam)}>
          {busy ? "Criando..." : "➕ Criar partida e gerar código"}
        </button>
        <div style={{ margin: "16px 0 6px", opacity: .6, fontWeight: 700 }}>— ou —</div>
        <div style={{ fontWeight: 700, fontSize: 14 }}>Entrar com um código:</div>
        <input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
          placeholder="EX: K7Q2M" maxLength={6}
          style={{
            marginTop: 8, padding: "12px", fontSize: 20, textAlign: "center", letterSpacing: ".3em",
            borderRadius: 12, border: "2px solid rgba(255,255,255,.3)", background: "rgba(255,255,255,.08)",
            color: "#fff", width: 210, fontWeight: 900, outline: "none",
          }} />
        <button className="pk-btn" disabled={busy} style={bigBtn("#22c55e", "#04220f")} onClick={joinOnline}>
          {busy ? "Entrando..." : "Entrar na partida"}
        </button>
        {err && <div style={{ color: "#fda4af", fontWeight: 700, marginTop: 6 }}>{err}</div>}
        <div style={{ fontSize: 11, opacity: .5, maxWidth: 320, textAlign: "center", marginTop: 8 }}>
          Quem entra joga com o uniforme que sobrar. O placar final fica registrado na página de partidas.
        </div>
        <button className="pk-btn" style={{ ...bigBtn("transparent", "#fff"), boxShadow: "none", border: "2px solid rgba(255,255,255,.25)" }}
          onClick={() => setScreen("menu")}>Voltar</button>
      </div>
    );
  }

  /* ================= JOGO ================= */
  if (!m) return null;
  const winnerIsMe = m.winner === role;

  return (
    <div className="pk-root pk-screen" style={{ ...bgStyle, padding: "8px 8px 24px" }}>
      {fontImport}

      {/* PLACAR */}
      <div style={{
        width: "100%", maxWidth: 560, background: "rgba(8,16,30,.55)",
        backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
        border: "1px solid rgba(255,255,255,.14)", borderRadius: 16, padding: "8px 12px", position: "relative",
      }}>
        <button onClick={toggleMute} className="pk-btn" title="Som"
          style={{
            position: "absolute", top: -2, right: -2, background: "rgba(255,255,255,.1)",
            border: "1px solid rgba(255,255,255,.2)", borderRadius: 10, color: "#fff",
            width: 33, height: 33, cursor: "pointer", fontSize: 14,
          }}>{muted ? "🔇" : "🔊"}</button>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingRight: 34 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <div style={{ width: 13, height: 13, borderRadius: 4, background: TEAMS[m.teams.A].jersey, border: "1.5px solid " + TEAMS[m.teams.A].trim }} />
            <span style={{ fontWeight: 800, fontSize: 11 }}>{nameA}</span>
            {!m.winner && kickerOf(m) === "A" && <span className="pk-pulse" style={{ fontSize: 11 }}>⚽</span>}
          </div>
          <div className="pk-display" style={{ fontSize: 26, color: "#FFCC00" }}>
            {goalsOf(m.kicks.A)} <span style={{ color: "#fff", opacity: .5 }}>×</span> {goalsOf(m.kicks.B)}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            {!m.winner && kickerOf(m) === "B" && <span className="pk-pulse" style={{ fontSize: 11 }}>⚽</span>}
            <span style={{ fontWeight: 800, fontSize: 11 }}>{nameB}</span>
            <div style={{ width: 13, height: 13, borderRadius: 4, background: TEAMS[m.teams.B].jersey, border: "1.5px solid " + TEAMS[m.teams.B].trim }} />
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
          <div style={{ display: "flex", gap: 4 }}>{pips(m.kicks.A)}</div>
          <div style={{ display: "flex", gap: 4 }}>{pips(m.kicks.B)}</div>
        </div>
        {suddenDeath ? (
          <div className="pk-pulse pk-display" style={{ textAlign: "center", color: "#ef4444", fontSize: 13, marginTop: 4 }}>☠️ MORTE SÚBITA — errou, chorou!</div>
        ) : !m.winner ? (
          <div style={{ textAlign: "center", fontSize: 10, fontWeight: 800, opacity: .65, marginTop: 5, letterSpacing: ".18em" }}>
            COBRANÇA {Math.floor(m.kickNumber / 2) + 1} DE 5
          </div>
        ) : null}
      </div>

      {/* CENA */}
      <div ref={sceneRef} onPointerDown={onSceneDown}
        style={{
          width: "100%", maxWidth: 560, marginTop: 8, touchAction: "none",
          borderRadius: 16, overflow: "hidden", position: "relative",
          cursor: sub === "aim" || sub === "react" ? "crosshair" : "default",
          userSelect: "none", boxShadow: "0 10px 30px rgba(0,0,0,.5)",
        }}>
        <svg viewBox={`0 0 ${VW} ${VH}`} style={{ width: "100%", display: "block" }}>
          <defs>
            <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#16324f" /><stop offset="100%" stopColor="#0a1a30" />
            </linearGradient>
            <linearGradient id="grassG" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2f9e57" /><stop offset="100%" stopColor="#136433" />
            </linearGradient>
            <radialGradient id="ballG" cx="38%" cy="30%">
              <stop offset="0%" stopColor="#ffffff" /><stop offset="100%" stopColor="#d2d2d2" />
            </radialGradient>
            <radialGradient id="ballShade" cx="38%" cy="32%" r="75%">
              <stop offset="55%" stopColor="rgba(0,0,0,0)" /><stop offset="100%" stopColor="rgba(0,0,0,.32)" />
            </radialGradient>
            <radialGradient id="bulge" cx="50%" cy="50%">
              <stop offset="0%" stopColor="rgba(255,255,255,.22)" /><stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </radialGradient>
            <linearGradient id="postG" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#ffffff" /><stop offset="50%" stopColor="#e6e6e6" /><stop offset="100%" stopColor="#b5b5b5" />
            </linearGradient>
            <linearGradient id="beam" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(255,250,215,.30)" /><stop offset="100%" stopColor="rgba(255,250,215,0)" />
            </linearGradient>
            <radialGradient id="vign" cx="50%" cy="42%">
              <stop offset="62%" stopColor="rgba(0,0,0,0)" /><stop offset="100%" stopColor="rgba(0,0,0,.38)" />
            </radialGradient>
            <radialGradient id="spotGlow" cx="50%" cy="50%">
              <stop offset="0%" stopColor="rgba(255,255,255,.10)" /><stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </radialGradient>
          </defs>

          {/* céu / arquibancada */}
          <rect x="0" y="0" width={VW} height="48" fill="url(#sky)" />
          <rect x="0" y="0" width={VW} height="5" fill="#040b16" />
          {[0, 1, 2].map((k) => (
            <g key={"cg" + k} className={result === "G" ? `pk-j${k}` : ""}>
              {crowd.filter((_, i) => i % 3 === k).map((d, i) => (
                <circle key={i} cx={d.x} cy={d.y} r={d.r} fill={d.c} opacity={d.o} />
              ))}
            </g>
          ))}
          <rect x="0" y="20" width={VW} height="2" fill="#0a1526" />
          <rect x="0" y="35" width={VW} height="2" fill="#0a1526" />
          {flags.map((f, i) => (
            <path key={"f" + i} d={`M ${f.x} ${f.y} l ${f.f ? 9 : -9} 2.5 l ${f.f ? -9 : 9} 2.5 Z`} fill={f.c} opacity="0.85" />
          ))}
          <FloodTower x={40} />
          <FloodTower x={360} flip />
          <circle cx="200" cy="0" r="55" fill="url(#beam)" opacity="0.6" />

          {/* placas de publicidade */}
          <rect x="0" y="48" width={VW} height="14" fill="#012776" />
          <rect x="0" y="48" width={VW} height="1.8" fill="rgba(255,255,255,.35)" />
          {[40, 200, 360].map((x, i) => (
            <text key={i} x={x} y="58.5" textAnchor="middle" fontSize="8.5" fontWeight="800" fill="#FFCC00" fontFamily="'Inter',sans-serif" letterSpacing="2">⚽ PÊNALTIS</text>
          ))}
          {[120, 280].map((x, i) => (
            <text key={"b" + i} x={x} y="58.5" textAnchor="middle" fontSize="8.5" fontWeight="800" fill="#22c55e" fontFamily="'Inter',sans-serif" letterSpacing="2">BRASIL</text>
          ))}

          {/* gramado */}
          <rect x="0" y="62" width={VW} height={VH - 62} fill="url(#grassG)" />
          {[-5, -3, -1, 1, 3].map((i) => (
            <path key={i}
              d={`M ${200 + i * 24} 62 L ${200 + (i + 1) * 24} 62 L ${200 + (i + 1) * 60} ${VH} L ${200 + i * 60} ${VH} Z`}
              fill="rgba(0,0,0,.09)" />
          ))}
          {/* linhas do campo */}
          <line x1="8" y1={G.B} x2="392" y2={G.B} stroke="rgba(255,255,255,.7)" strokeWidth="2.5" />
          <path d={`M 110 ${G.B} L 92 242 M 290 ${G.B} L 308 242 M 92 242 L 308 242`} stroke="rgba(255,255,255,.45)" strokeWidth="1.8" fill="none" />
          <path d="M 158 316 Q 200 304 242 316" stroke="rgba(255,255,255,.4)" strokeWidth="1.8" fill="none" />
          <circle cx={BALL_START.x} cy={BALL_START.y + 4} r="26" fill="url(#spotGlow)" />
          <ellipse cx={BALL_START.x} cy={BALL_START.y + 4} rx="4.5" ry="2.4" fill="rgba(255,255,255,.9)" />

          {/* rede (treme no gol) */}
          <g className={result === "G" ? "pk-net" : ""}>
            <rect x={G.L - 2} y={G.T + 2} width={G.R - G.L + 4} height={G.B - G.T} fill="rgba(3,10,20,.5)" />
            <path d={`M ${G.L} ${G.T} L ${G.L + 16} ${G.T + 12} L ${G.R - 16} ${G.T + 12} L ${G.R} ${G.T} Z`} fill="rgba(255,255,255,.05)" stroke="rgba(255,255,255,.18)" strokeWidth="0.8" />
            {[...Array(12)].map((_, i) => (
              <line key={"nt" + i} x1={G.L + 6 + i * 27} y1={G.T + 2} x2={G.L + 19 + i * 27} y2={G.T + 12} stroke="rgba(255,255,255,.18)" strokeWidth="0.8" />
            ))}
            <path d={`M ${G.L} ${G.T} L ${G.L - 13} ${G.T + 16} L ${G.L - 13} ${G.B + 5} L ${G.L} ${G.B} Z`} fill="rgba(255,255,255,.07)" stroke="rgba(255,255,255,.2)" strokeWidth="0.8" />
            <path d={`M ${G.R} ${G.T} L ${G.R + 13} ${G.T + 16} L ${G.R + 13} ${G.B + 5} L ${G.R} ${G.B} Z`} fill="rgba(255,255,255,.07)" stroke="rgba(255,255,255,.2)" strokeWidth="0.8" />
            {[...Array(24)].map((_, i) => (
              <path key={"nv" + i}
                d={`M ${G.L + 6 + i * 13.7} ${G.T + 4} Q ${G.L + 10 + i * 13.7} ${G.CY} ${G.L + 9 + i * 13.7} ${G.B - 2}`}
                stroke="rgba(255,255,255,.22)" strokeWidth="1" fill="none" />
            ))}
            {[...Array(10)].map((_, i) => (
              <path key={"nh" + i}
                d={`M ${G.L} ${G.T + 8 + i * 14} Q ${G.CX} ${G.T + 13 + i * 14} ${G.R} ${G.T + 8 + i * 14}`}
                stroke="rgba(255,255,255,.17)" strokeWidth="1" fill="none" />
            ))}
            {/* estufada da rede no ponto do impacto */}
            {result === "G" && lastPlay && (
              <g>
                <ellipse cx={lastPlay.shot.target.x} cy={lastPlay.shot.target.y} rx="27" ry="21" fill="url(#bulge)" className="pk-pop" />
                <circle cx={lastPlay.shot.target.x} cy={lastPlay.shot.target.y} r="15" fill="none" stroke="rgba(255,255,255,.5)" strokeWidth="2" className="pk-ring" />
              </g>
            )}
          </g>

          {/* traves */}
          <ellipse cx={G.L} cy={G.B + 3} rx="9" ry="2.8" fill="rgba(0,0,0,.3)" />
          <ellipse cx={G.R} cy={G.B + 3} rx="9" ry="2.8" fill="rgba(0,0,0,.3)" />
          <line x1={G.L} y1={G.T} x2={G.L} y2={G.B} stroke="url(#postG)" strokeWidth="8" strokeLinecap="round" />
          <line x1={G.R} y1={G.T} x2={G.R} y2={G.B} stroke="url(#postG)" strokeWidth="8" strokeLinecap="round" />
          <line x1={G.L - 3} y1={G.T} x2={G.R + 3} y2={G.T} stroke="url(#postG)" strokeWidth="8" strokeLinecap="round" />

          {/* GOLEIRO (pulinho de comemoração quando defende em pé) */}
          <g className={result === "S" && lastPlay && Math.abs(((lastPlay.dive && lastPlay.dive.x) || G.CX) - G.CX) < 26 ? "pk-hop" : ""}>
            <Keeper pose={keeperPos} team={keeperTeam} />
          </g>

          {/* mira */}
          {aim && (sub === "aim" || sub === "power") && (
            <g className="pk-pop">
              <g className="pk-aim">
                <circle cx={aim.x} cy={aim.y} r="15" fill="none" stroke="#FFCC00" strokeWidth="2.5" strokeDasharray="6 5" />
              </g>
              <circle cx={aim.x} cy={aim.y} r="7" fill="none" stroke="rgba(255,204,0,.5)" strokeWidth="2" />
              <circle cx={aim.x} cy={aim.y} r="3.4" fill="#FFCC00" />
            </g>
          )}

          {/* marca do pulo (defesa) */}
          {sub === "react" && liveRef.current?.tap && (
            <g className="pk-pop">
              <circle cx={liveRef.current.tap.point.x} cy={liveRef.current.tap.point.y} r="11" fill="none" stroke="#4ade80" strokeWidth="3" />
            </g>
          )}

          {/* batedor */}
          <Kicker team={kickerTeam} runP={runP} kickP={kickP}
            mood={result ? (result === "G" ? "celebrate" : "sad") : null} />

          {/* rastro + sombra no chão + bola */}
          {trail.map((tt, i) => <Ball key={"t" + i} x={tt.x} y={tt.y} r={tt.r * 0.9} o={0.22 - i * 0.08} />)}
          <ellipse cx={shadow.x} cy={shadow.y} rx={13 * 1.1 * (shadow.s ?? 1)} ry={13 * 0.28 * (shadow.s ?? 1)}
            fill={`rgba(0,0,0,${shadow.o})`} />
          <Ball x={ballPos.x} y={ballPos.y} r={ballR} spin={ballSpin} />

          <rect x="0" y="0" width={VW} height={VH} fill="url(#vign)" pointerEvents="none" />
        </svg>

        {/* feedback instantâneo da barra de força */}
        {powerFx && (
          <div className="pk-pop" style={{
            position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)",
            background: "rgba(5,12,24,.88)", border: `2px solid ${powerFx.c}`, color: powerFx.c,
            fontWeight: 900, fontSize: 16, borderRadius: 999, padding: "7px 18px", pointerEvents: "none",
          }}>{powerFx.t}</div>
        )}

        {/* balões de tutorial (primeira vez) */}
        {sub === "aim" && !tuto.aim && (
          <Balloon style={{ top: 10 }} text="👆 Toque em qualquer ponto DENTRO do gol para escolher a mira" />
        )}
        {sub === "power" && !tuto.power && (
          <Balloon style={{ bottom: 14 }} down text="⏱️ Lá embaixo: pare a bola no MEIO da barra e toque em CHUTAR!" />
        )}
        {sub === "react" && !tuto.react && (
          <Balloon style={{ top: 10 }} text="🧤 Espere aparecer CHUTOU! e toque no ponto do gol para o goleiro voar" />
        )}

        {/* flash CHUTOU */}
        {flash && (
          <div className="pk-flash pk-display" style={{
            position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
            pointerEvents: "none", fontSize: 52, color: "#FFCC00", textShadow: "0 5px 0 rgba(0,0,0,.6)",
          }}>{flash}</div>
        )}

        {/* resultado */}
        {resultText && (
          <div style={{
            position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden",
            background: result === "G" ? "rgba(6,40,18,.32)" : "rgba(4,10,20,.28)",
          }}>
            {result === "G" && confetti.map((c, i) => (
              <span key={i} style={{
                position: "absolute", top: "-6%", left: c.left + "%", width: 9, height: 14,
                background: c.c, borderRadius: 2, transform: `rotate(${c.rot}deg)`,
                animation: `pk-conf ${c.dur}s linear ${c.delay}s both`,
              }} />
            ))}
            <div className="pk-pop" style={{
              position: "absolute", inset: 0, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
            }}>
              <div className="pk-display" style={{ fontSize: 56, color: resultText.color, textShadow: "0 5px 0 rgba(0,0,0,.55)" }}>
                {resultText.big}
              </div>
              {resultSub && <div style={{ fontWeight: 700, marginTop: 2, textShadow: "0 2px 4px #000", fontSize: 14 }}>{resultSub}</div>}
            </div>
          </div>
        )}

        {/* fim de jogo */}
        {sub === "over" && (
          <div className="pk-pop" style={{
            position: "absolute", inset: 0, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", background: "rgba(3,8,16,.85)", gap: 8,
          }}>
            <div style={{ fontSize: 44 }}>{(m.mode === "local" || winnerIsMe) ? "🏆" : "😭"}</div>
            <div className="pk-display" style={{ fontSize: m.mode === "local" ? 30 : 38, color: (m.mode === "local" || winnerIsMe) ? "#FFCC00" : "#ef4444" }}>
              {m.mode === "local"
                ? `${(m.players && m.players[m.winner]) || "Jogador"} VENCEU!`
                : winnerIsMe ? "VOCÊ VENCEU!" : "VOCÊ PERDEU"}
            </div>
            <div style={{ fontWeight: 700, opacity: .8 }}>{goalsOf(m.kicks.A)} × {goalsOf(m.kicks.B)}</div>
            {overLine && <div style={{ fontWeight: 600, fontSize: 13, opacity: .85, textAlign: "center", padding: "0 24px" }}>🎙️ {overLine}</div>}
            <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
              {mode === "local" && (
                <button className="pk-btn" onClick={startLocal}
                  style={{ background: "#7cc4ff", color: "#04182e", border: "none", borderRadius: 12, padding: "12px 20px", fontWeight: 900, fontSize: 15, cursor: "pointer", boxShadow: "0 4px 0 rgba(0,0,0,.4)" }}>
                  Revanche 🔁
                </button>
              )}
              {mode === "bot" && (
                <button className="pk-btn" onClick={() => startBot(myTeam)}
                  style={{ background: "#FFCC00", color: "#081426", border: "none", borderRadius: 12, padding: "12px 20px", fontWeight: 900, fontSize: 15, cursor: "pointer", boxShadow: "0 4px 0 rgba(0,0,0,.4)" }}>
                  Jogar de novo
                </button>
              )}
              <button className="pk-btn" onClick={backToMenu}
                style={{ background: "transparent", color: "#fff", border: "2px solid rgba(255,255,255,.3)", borderRadius: 12, padding: "12px 20px", fontWeight: 800, fontSize: 15, cursor: "pointer" }}>
                Menu principal
              </button>
            </div>
          </div>
        )}
      </div>

      {/* INSTRUÇÃO */}
      {instruction && sub !== "over" && sub !== "wait_join" && (
        <div className={sub === "wait_dive" || sub === "wait_shot" ? "pk-pulse" : ""} style={{
          marginTop: 8, fontWeight: 700, textAlign: "center", fontSize: 13,
          background: "rgba(10,18,32,.55)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
          border: "1px solid rgba(255,255,255,.12)", borderRadius: 12, padding: "8px 14px", maxWidth: 560, width: "100%",
        }}>
          {instruction}
          {sub === "react" && (
            <div style={{ fontWeight: 600, fontSize: 11, opacity: .8, marginTop: 2 }}>
              Quanto mais rápido você tocar, mais longe o goleiro alcança!
            </div>
          )}
        </div>
      )}

      {/* BARRA DE FORÇA */}
      {sub === "power" && (
        <div style={{ width: "100%", maxWidth: 560, marginTop: 10 }}>
          <div style={{
            position: "relative", height: 34, borderRadius: 17,
            background: "linear-gradient(90deg,#e5484d 0%,#f5d90a 28%,#22c55e 44%,#22c55e 56%,#f5d90a 72%,#e5484d 100%)",
            border: "2px solid rgba(255,255,255,.5)",
          }}>
            <div style={{ position: "absolute", left: "50%", top: -4, bottom: -4, width: 3, background: "#fff", transform: "translateX(-50%)", borderRadius: 2 }} />
            <div style={{
              position: "absolute", top: "50%", left: `${barPos * 100}%`,
              transform: "translate(-50%,-50%)", fontSize: 27, filter: "drop-shadow(0 2px 2px rgba(0,0,0,.5))",
            }}>⚽</div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, opacity: .75, fontWeight: 700, margin: "4px 4px 0" }}>
            <span>FRACO / FORA</span><span>PERFEITO</span><span>FRACO / FORA</span>
          </div>
          <button className="pk-btn" onPointerDown={stopPower}
            style={{ ...bigBtn("#FFCC00"), marginTop: 8, fontSize: 19, fontWeight: 900, letterSpacing: ".02em" }}>
            CHUTAR! 🥅
          </button>
          <button className="pk-btn" onClick={() => { setAim(null); setSub("aim"); }}
            style={{
              background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.22)",
              color: "rgba(255,255,255,.9)", fontWeight: 700, fontSize: 14,
              display: "block", margin: "6px auto 0", cursor: "pointer",
              borderRadius: 12, padding: "12px 22px", minHeight: 44,
            }}>
            ↩ Mirar de novo
          </button>
          <div style={{ textAlign: "center", fontSize: 11, opacity: .55 }}>
            Dificuldade da mira: {"🔥".repeat(Math.max(1, Math.round(aimSpeedHint * 5)))}
          </div>
        </div>
      )}

      {/* ESPERANDO RIVAL */}
      {sub === "wait_join" && (
        <div style={{ marginTop: 14, textAlign: "center", width: "100%", maxWidth: 560 }}>
          <div style={{ fontWeight: 700, opacity: .8 }}>Código da partida:</div>
          <div className="pk-display" style={{
            fontSize: 42, letterSpacing: ".25em", color: "#FFCC00", margin: "6px 0 12px",
            background: "rgba(0,0,0,.4)", borderRadius: 12, padding: "6px 0", border: "2px dashed rgba(255,204,0,.5)",
          }}>{m.id}</div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button className="pk-btn" onClick={shareWhatsApp} style={{ ...bigBtn("#25D366", "#053b1e"), maxWidth: 220, margin: 0 }}>
              Enviar no WhatsApp
            </button>
            <button className="pk-btn" onClick={copyCode}
              style={{ ...bigBtn("rgba(255,255,255,.12)", "#fff"), maxWidth: 130, margin: 0, boxShadow: "none", border: "2px solid rgba(255,255,255,.3)" }}>
              {copied ? "Copiado ✓" : "Copiar"}
            </button>
          </div>
          {!qrFail && (
            <div style={{ marginTop: 12 }}>
              <div style={{ background: "#fff", borderRadius: 14, padding: 8, display: "inline-block" }}>
                <img alt="QR do convite" width={140} height={140}
                  src={"https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=" + encodeURIComponent(inviteLink)}
                  onError={() => setQrFail(true)} style={{ display: "block" }} />
              </div>
              <div style={{ fontSize: 11, opacity: .6, marginTop: 5 }}>Ou o rival aponta a câmera pro QR e já entra 📷</div>
            </div>
          )}
          <div className="pk-pulse" style={{ marginTop: 12, fontWeight: 700, opacity: .7 }}>⏳ Esperando o rival entrar...</div>
        </div>
      )}
      {/* PASSA-E-JOGA: vez de chutar */}
      {sub === "pass_kick" && m.mode === "local" && (
        <div style={{ marginTop: 14, textAlign: "center", width: "100%", maxWidth: 560 }}>
          <div className="pk-display" style={{ fontSize: 22, color: "#FFCC00" }}>
            🎯 Vez de {(m.players && m.players[kickerOf(m)]) || "Jogador"} chutar!
          </div>
          <div style={{ fontWeight: 600, fontSize: 13, opacity: .7, marginTop: 4 }}>
            Sem espiar, {(m.players && m.players[kickerOf(m) === "A" ? "B" : "A"]) || "goleiro"}! 👀
          </div>
          <button className="pk-btn" style={{ ...bigBtn("#FFCC00"), maxWidth: 260 }} onClick={() => setSub("aim")}>
            PODE CHUTAR ⚽
          </button>
        </div>
      )}
      {/* PASSA-E-JOGA: passar o celular pro goleiro */}
      {sub === "pass_dive" && m.mode === "local" && (
        <div style={{ marginTop: 14, textAlign: "center", width: "100%", maxWidth: 560 }}>
          <div className="pk-display" style={{ fontSize: 22, color: "#7cc4ff" }}>
            🧤 Passe o celular para {(m.players && m.players[kickerOf(m) === "A" ? "B" : "A"]) || "o goleiro"}!
          </div>
          <div style={{ fontWeight: 600, fontSize: 13, opacity: .7, marginTop: 4 }}>
            {(m.players && m.players[kickerOf(m)]) || "Batedor"}, boca fechada: nada de dar dica! 🤫
          </div>
          <button className="pk-btn" style={{ ...bigBtn("#7cc4ff", "#04182e"), maxWidth: 280 }} onClick={startLocalDefense}>
            PRONTO PRA DEFENDER 🧤
          </button>
        </div>
      )}
      {err && screen === "game" && <div style={{ color: "#fda4af", fontWeight: 700, marginTop: 8, fontSize: 13 }}>{err}</div>}
    </div>
  );
}
