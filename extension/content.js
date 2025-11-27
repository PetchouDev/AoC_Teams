// extension/content.js

async function getBackendUrlForLeaderboard(year, leaderboardId) {
  const key = `${year}-${leaderboardId}`;
  return new Promise((resolve) => {
    chrome.storage.sync.get(key, (result) => {
      const entry = result[key];
      if (!entry) return resolve(null);
      if (typeof entry === "string") return resolve(entry);
      resolve(entry.backend || null);
    });
  });
}

function starSpans(count) {
  const wrapper = document.createElement("span");
  const both = Math.floor((count || 0) / 2);
  const half = (count || 0) % 2;
  if (both) {
    const span = document.createElement("span");
    span.className = "privboard-star-both";
    span.textContent = "*".repeat(both);
    wrapper.appendChild(span);
  }
  if (half) {
    const span = document.createElement("span");
    span.className = "privboard-star-firstonly";
    span.textContent = "*".repeat(half);
    wrapper.appendChild(span);
  }
  return wrapper;
}

function renderTeamsTable(teams, currentTeam) {
  const container = document.createElement("div");
  const entries = Object.entries(teams).sort(
    (a, b) => (b[1]?.local_score || 0) - (a[1]?.local_score || 0)
  );

  entries.forEach(([name, data], idx) => {
    const row = document.createElement("div");
    row.className = "privboard-row";
    row.style.display = "flex";
    row.style.alignItems = "center";
    const colorValue = (data.color && data.color.color) || data.color || null;
    if (colorValue) {
      row.style.borderLeft = `4px solid ${colorValue}`;
      row.style.paddingLeft = "4px";
    }

    const pos = document.createElement("span");
    pos.className = "privboard-position";
    pos.textContent = `${idx + 1})`;

    const score = document.createElement("span");
    score.style.marginLeft = "6px";
    score.textContent = String(data.local_score ?? 0).padStart(5, " ");

    const starsWrapper = document.createElement("span");
    starsWrapper.style.marginLeft = "10px";
    const starCount = document.createElement("span");
    starCount.textContent = String(data.stars ?? 0).padStart(4, " ");
    const starIcon = document.createElement("span");
    starIcon.className = "privboard-star-both";
    starIcon.textContent = "*";
    starsWrapper.appendChild(starCount);
    starsWrapper.appendChild(starIcon);

    const label = document.createElement("span");
    label.className = "privboard-name";
    label.style.marginLeft = "12px";
    label.textContent = name;
    label.style.flex = "1";
    if (colorValue) {
      label.style.color = colorValue;
    }

    const btn = document.createElement("button");
    btn.style.marginLeft = "12px";
    btn.style.background = "none";
    btn.style.border = "none";
    btn.style.cursor = "pointer";
    btn.style.fontWeight = "500";
    if (!currentTeam) {
      btn.dataset.teamAction = name;
      btn.textContent = "[Join]";
      btn.style.color = "#00cc66";
    } else if (currentTeam === name) {
      btn.dataset.teamAction = "";
      btn.textContent = "[Leave]";
      btn.style.color = "#ff4444";
    } else {
      btn.style.display = "none";
    }

    row.appendChild(pos);
    row.appendChild(score);
    row.appendChild(starsWrapper);
    row.appendChild(label);
    row.appendChild(btn);
    container.appendChild(row);
  });

  return container;
}

function renderPlayersTable(leaderboard, teams, currentTeam, currentUser) {
  const container = document.createElement("div");
  if (!leaderboard?.members) return container;

  const members = Object.values(leaderboard.members).sort(
    (a, b) => (b.local_score || 0) - (a.local_score || 0)
  );

  members.forEach((m, idx) => {
    const row = document.createElement("div");
    row.className = "privboard-row";

    const pos = document.createElement("span");
    pos.className = "privboard-position";
    pos.textContent = `${idx + 1})`;

    const score = document.createElement("span");
    score.style.marginLeft = "6px";
    score.textContent = String(m.local_score ?? 0).padStart(5, " ");

    const starsWrapper = document.createElement("span");
    starsWrapper.style.marginLeft = "10px";
    const starCount = document.createElement("span");
    starCount.textContent = String(m.stars ?? 0).padStart(4, " ");
    const starIcon = document.createElement("span");
    starIcon.className = "privboard-star-both";
    starIcon.textContent = "*";
    starsWrapper.appendChild(starCount);
    starsWrapper.appendChild(starIcon);

    const name = document.createElement("span");
    name.className = "privboard-name";
    name.style.marginLeft = "6px";
    name.textContent = m.name || "(anonyme)";

    const teamColor =
      m.teamColor ||
      (m.teamName && teams[m.teamName]?.color?.color) ||
      (m.teamName && teams[m.teamName]?.color) ||
      null;
    if (teamColor) {
      name.style.color = teamColor;
      name.style.fontWeight = "700";
    }

    const teamInfo = document.createElement("span");
    teamInfo.style.marginLeft = "8px";
    teamInfo.style.color = "#555";
    teamInfo.textContent = m.teamName ? `(${m.teamName})` : "";

    row.appendChild(pos);
    row.appendChild(score);
    row.appendChild(starsWrapper);
    row.appendChild(name);
    row.appendChild(teamInfo);
    container.appendChild(row);
  });

  return container;
}

function decorateExistingPlayersTable(leaderboard, teams) {
  if (!leaderboard?.members) return;
  const byName = {};
  Object.values(leaderboard.members).forEach((m) => {
    if (m.name) byName[m.name.trim()] = m;
  });

  document.querySelectorAll(".privboard-row .privboard-name").forEach((el) => {
    const nameText = el.textContent.trim();
    const member = byName[nameText];
    if (!member || !member.teamName) return;
    const color =
      member.teamColor ||
      (teams[member.teamName]?.color?.color) ||
      (teams[member.teamName]?.color) ||
      null;
    if (color) {
      el.style.color = color;
      el.style.fontWeight = "700";
    }
    if (!el.dataset.teamTagApplied) {
      const tag = document.createElement("span");
      tag.textContent = ` (${member.teamName})`;
      tag.style.marginLeft = "6px";
      tag.style.color = "#888";
      el.after(tag);
      el.dataset.teamTagApplied = "1";
    }
  });
}

function injectUi(leaderboard, teams, membersByTeam, config, backendUrl, leaderboardId) {
  const article = document.querySelector("article");
  if (!article) return;

  const currentUser = getCurrentUserName();
  const currentTeam = getCurrentTeam(currentUser, config, leaderboard);

  const titleTeams = document.createElement("h1");
  titleTeams.textContent = "Teams ranking";
  titleTeams.style.color = "#00cc00";
  titleTeams.style.textShadow = "0 0 2px #00cc00, 0 0 5px #00cc00";

  const teamsEl = renderTeamsTable(teams, currentTeam);

  const section = document.createElement("div");
  section.appendChild(titleTeams);
  section.appendChild(teamsEl);

  const eventInfo = article.querySelector("#event_info");
  if (eventInfo) {
    eventInfo.insertAdjacentElement("afterend", section);
  } else {
    article.prepend(section);
  }

  // Highlight user names in existing players table so they match their team colors
  decorateExistingPlayersTable(leaderboard, teams);


  article.querySelectorAll("[data-team-action]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const team = btn.dataset.teamAction || null;
      const memberId = findCurrentMemberId(currentUser, leaderboard) ?? currentUser;
      if (!memberId) return;
      try {
        await assignTeam(backendUrl, memberId, team);
        window.location.reload();
      } catch (err) {
        console.error(err);
        alert("Erreur lors de la mise à jour de l'équipe");
      }
    });
  });
}

function computeTeams(leaderboard, config) {
  const teams = {};
  const membersByTeam = {};
  const configTeams = config.teams || {};
  const lbMembers = leaderboard?.members || {};

  const getMemberFromLeaderboard = (id) => {
    const m = lbMembers[id];
    if (m) return m;
    const asNumber = Number(id);
    return {
      id: isNaN(asNumber) ? id : asNumber,
      name: null,
      local_score: 0,
      stars: 0,
      completion_day_level: {},
    };
  };

  for (const [teamName, teamCfg] of Object.entries(configTeams)) {
    const color = teamCfg.color || null;
    const memberIds = Array.isArray(teamCfg.members) ? teamCfg.members : [];
    const teamEntry = {
      color,
      local_score: 0,
      stars: 0,
      members: {},
    };
    membersByTeam[teamName] = [];

    for (const rawId of memberIds) {
      const idStr = String(rawId);
      const member = { ...getMemberFromLeaderboard(idStr) };
      member.teamName = teamName;
      const colorValue = color?.color || color || null;
      if (colorValue) {
        member.teamColor = colorValue;
        if (lbMembers[idStr]) lbMembers[idStr].teamColor = colorValue;
      }
      teamEntry.members[idStr] = member;
      teamEntry.local_score += member.local_score || 0;
      teamEntry.stars += member.stars || 0;
      membersByTeam[teamName].push(member.name || "(anonyme)");
      if (lbMembers[idStr]) lbMembers[idStr].teamName = teamName;
    }

    teams[teamName] = teamEntry;
  }

  console.log("[AoC Teams] computed teams", teams);

  return { teams, membersByTeam };
}

async function assignTeam(backendUrl, memberId, team) {
  const res = await fetch(`${backendUrl}/assign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ memberId, team }),
  });
  if (!res.ok) {
    throw new Error(`assign failed: ${res.status}`);
  }
}

function findCurrentMemberId(currentUser, leaderboard) {
  if (!currentUser || !leaderboard?.members) return null;
  const match = Object.values(leaderboard.members).find((m) => m.name === currentUser);
  return match?.id ?? null;
}

function getCurrentTeam(currentUser, config, leaderboard) {
  if (!currentUser) return null;
  const memberId = findCurrentMemberId(currentUser, leaderboard);
  // Prefer config.teams membership by id
  for (const [teamName, teamCfg] of Object.entries(config.teams || {})) {
    if (memberId && Array.isArray(teamCfg.members) && teamCfg.members.includes(String(memberId))) {
      return teamName;
    }
  }
  // Fallback to config.members mapping if present
  const memberMap = config.members || {};
  if (memberId && memberMap[String(memberId)]) return memberMap[String(memberId)];
  return null;
}

async function main() {
  const match = location.pathname.match(/^\/(\d{4})\/leaderboard\/private\/view\/(\d+)/);
  if (!match) return;

  const [, year, leaderboardId] = match;
  const backendUrl = await getBackendUrlForLeaderboard(year, leaderboardId);
  if (!backendUrl) return;

  const jsonUrl = `${location.origin}/${year}/leaderboard/private/view/${leaderboardId}.json`;

  const leaderboard = await fetch(jsonUrl, { credentials: "include" }).then((r) => r.json());

  let config;
  try {
    const resp = await fetch(`${backendUrl}/config`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    config = await resp.json();
  } catch (err) {
    console.error("[AoC Teams] Failed to reach backend", backendUrl, err);
    const article = document.querySelector("article");
    if (article) {
      const warn = document.createElement("div");
      warn.style.color = "#ff5555";
      warn.style.fontWeight = "700";
      warn.style.margin = "12px 0";
      warn.textContent = `AoC Teams: backend unreachable at ${backendUrl}`;
      article.prepend(warn);
    }
    return;
  }

  const { teams, membersByTeam } = computeTeams(leaderboard, config);

  injectUi(leaderboard, teams, membersByTeam, config, backendUrl, leaderboardId);
}

main().catch(console.error);

function getPlayersFromPage() {
  const rows = document.querySelectorAll(".privboard-row");
  const players = {};

  rows.forEach((row) => {
    const nameEl = row.querySelector(".privboard-name");
    const positionEl = row.querySelector(".privboard-position");
    if (!nameEl || !positionEl) return;

    const name = nameEl.textContent.trim();

    const text = row.textContent;
    const scoreMatch = text.match(/\)\s+(\d+)/);
    const score = scoreMatch ? Number(scoreMatch[1]) : 0;

    const starNodesOne = row.querySelectorAll(".privboard-star-firstonly");
    const starNodesBoth = row.querySelectorAll(".privboard-star-both");
    let stars = 0;
    starNodesOne.forEach((el) => {
      stars += el.textContent.length;
    });
    starNodesBoth.forEach((el) => {
      stars += 2 * el.textContent.length;
    });

    players[name] = { local_score: score, stars };
  });

  return players;
}

function getCurrentUserName() {
  const userEl = document.querySelector(".user");
  if (!userEl) return null;
  const clone = userEl.cloneNode(true);
  clone.querySelectorAll("span").forEach((s) => s.remove());
  const name = clone.textContent.trim();
  return name || null;
}
