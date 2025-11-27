const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();
app.use(express.json());

app.use(cors({
  origin: "https://adventofcode.com",   // ou un tableau si tu veux plusieurs origines
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
  credentials: false   // true seulement si tu utilises des cookies / auth
}));

const DATA_PATH = path.join(__dirname, "data.json");
const STATIC_CONFIG_PATH = path.join(__dirname, "config.json");


function loadStaticConfig() {
  console.log("Loading static config from", STATIC_CONFIG_PATH);
  try {
    const raw = fs.readFileSync(STATIC_CONFIG_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (err) {
    console.warn("No static config found or invalid JSON, exiting.");
    return {};
  }
}

const staticConfig = loadStaticConfig();
// Create data file if it doesn't exist
if (!fs.existsSync(DATA_PATH)) {
  const leaderboards = {};
  for (const leaderboard_name of Object.keys(staticConfig)) {
    const leaderboardId = staticConfig[leaderboard_name].id || null;
    const leaderboardYear = staticConfig[leaderboard_name].year || null;
    const leaderboardTeams = {};
    const teams = {};
    for (teamName of Object.keys(staticConfig[leaderboard_name].teams || {})) {
        teams[teamName] = { color: staticConfig[leaderboard_name].teams[teamName], members: [] };
    }
    if (leaderboardId && leaderboardYear) {
      leaderboards[leaderboard_name] = { 
        id: leaderboardId,
        year: leaderboardYear,
        teams: teams, 
      };
    }
  }
  fs.writeFileSync(DATA_PATH, JSON.stringify({ leaderboards }, null, 2));
}

// If this file exists but is empty or invalid, initialize it
if (!fs.existsSync(DATA_PATH) || (() => {
  try {
    const content = fs.readFileSync(DATA_PATH, "utf8");
    JSON.parse(content);
    return false;
  } catch {
    return true;
  }
})()) {
  const leaderboards = {};
  for (const leaderboard_name of Object.keys(staticConfig)) {
    const leaderboardId = staticConfig[leaderboard_name].id || null;
    const leaderboardYear = staticConfig[leaderboard_name].year || null;
    const leaderboardTeams = {};
    const teams = {};
    for (teamName of Object.keys(staticConfig[leaderboard_name].teams || {})) {
        teams[teamName] = { color: staticConfig[leaderboard_name].teams[teamName], members: [] };
    }
    if (leaderboardId && leaderboardYear) {
      leaderboards[leaderboard_name] = { 
        id: leaderboardId,
        year: leaderboardYear,
        teams: teams, 
      };
    }
  }
  fs.writeFileSync(DATA_PATH, JSON.stringify({ leaderboards }, null, 2));
}

let db = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
reconcileDbWithConfig();

function save() {
  fs.writeFileSync(DATA_PATH, JSON.stringify(db, null, 2));
}

function buildTeamsFromConfig(cfgTeams) {
  const teams = {};
  for (const [teamName, teamCfg] of Object.entries(cfgTeams || {})) {
    const color = typeof teamCfg === "string" ? teamCfg : teamCfg?.color ?? null;
    teams[teamName] = { color, members: [] };
  }
  return teams;
}

function reconcileDbWithConfig() {
  db.leaderboards ||= {};
  const next = {};

  for (const [slug, cfg] of Object.entries(staticConfig)) {
    const targetId = cfg.id ?? cfg.leaderboardId ?? cfg.leaderboard ?? null;
    const targetYear = cfg.year ?? null;
    const cfgTeams = cfg.teams || {};
    const cfgTeamNames = Object.keys(cfgTeams);

    const existing = db.leaderboards[slug];

    let shouldReset = false;
    if (!existing) {
      shouldReset = true;
    } else if (existing.id !== targetId || existing.year !== targetYear) {
      shouldReset = true;
    } else {
      const existingNames = Object.keys(existing.teams || {});
      if (existingNames.length !== cfgTeamNames.length || existingNames.some((n) => !cfgTeamNames.includes(n))) {
        shouldReset = true;
      }
    }

    let teams;
    if (shouldReset) {
      teams = buildTeamsFromConfig(cfgTeams);
    } else {
      teams = {};
      for (const name of cfgTeamNames) {
        const color = typeof cfgTeams[name] === "string" ? cfgTeams[name] : cfgTeams[name]?.color ?? null;
        const existingTeam = existing.teams?.[name] || {};
        teams[name] = {
          color: color ?? existingTeam.color ?? null,
          members: Array.isArray(existingTeam.members) ? existingTeam.members : [],
        };
      }
    }

    next[slug] = { id: targetId, year: targetYear, teams };
  }

  db.leaderboards = next;
  save();
  console.log("[AoC Teams] DB reconciled with config.json");
}

function normalizeEntry(slug, cfg) {
  const leaderboardId = cfg.id ?? cfg.leaderboardId ?? cfg.leaderboard;
  return {
    slug,
    year: cfg.year,
    id: leaderboardId,
  };
}

function getStaticLeaderboards() {
  return Object.entries(staticConfig)
    .map(([slug, cfg]) => normalizeEntry(slug, cfg))
    .filter((lb) => lb.id && lb.year);
}

function findLeaderboardBySlug(slug) {
  const decoded = decodeURIComponent(slug);
  const cfg = staticConfig[decoded];
  if (!cfg) return null;
  const normalized = normalizeEntry(decoded, cfg);
  if (!normalized.id || !normalized.year) return null;
  return normalized;
}


// Root helper: list full URLs available on this backend
app.get("/all", (req, res) => {
  const baseUrl = `${req.protocol}://${req.get("host")}`;
  const leaderboards = getStaticLeaderboards().map((lb) => ({
    ...lb,
    url: `${baseUrl}/${encodeURIComponent(lb.slug)}`,
  }));
  res.json({ leaderboards });
});

// Router scoped by slug (ex: /leaderboard_1/config, /leaderboard_1/assign)
const scoped = express.Router({ mergeParams: true });

scoped.get("/config", (req, res) => {
  const leaderboardName  = req.leaderboard;
  const cfg = db.leaderboards[leaderboardName] || { "error": "no config" };
  res.json({ leaderboardName, ...cfg });
});

scoped.post("/assign", (req, res) => {
  const { memberId, team } = req.body;
  const { slug } = req.leaderboardMeta;
  if (!memberId) {
    return res.status(400).json({ error: "missing memberId" });
  }

  db.leaderboards[slug] ||= { teams: {}, members: {} };
  const lb = db.leaderboards[slug];

  // Remove from all teams
  Object.values(lb.teams || {}).forEach((t) => {
    if (!Array.isArray(t.members)) t.members = [];
    t.members = t.members.filter((id) => String(id) !== String(memberId));
  });

  // Add to selected team if provided
  if (team) {
    lb.teams[team] ||= { color: null, members: [] };
    if (!Array.isArray(lb.teams[team].members)) lb.teams[team].members = [];
    lb.teams[team].members.push(String(memberId));
  }

  save();

  res.json({ ok: true, leaderboard: slug });
});

app.use("/:slug", (req, res, next) => {
  const meta = findLeaderboardBySlug(req.params.slug);
  if (!meta) return res.status(404).json({ error: "unknown leaderboard" });
  req.leaderboardMeta = meta; // { slug, id, year }
  req.leaderboard = meta.slug;
  next();
}, scoped);

app.listen(3001, () => {
  console.log("AOC Teams backend running on port http://localhost:3001");
});
