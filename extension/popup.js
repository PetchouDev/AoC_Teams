function setStatus(message, isError = false) {
  const el = document.getElementById("status");
  el.textContent = message || "";
  el.style.color = isError ? "#ef5350" : "#9fb3c8";
}

function normalizeUrl(url) {
  return url.replace(/\/+$/, "");
}

function extractLeaderboards(payload) {
  if (!payload) return [];
  if (Array.isArray(payload.leaderboards)) return payload.leaderboards;
  if (payload.leaderboards && typeof payload.leaderboards === "object") {
    return Object.entries(payload.leaderboards).map(([name, cfg]) => ({
      name: cfg.name || cfg.leaderboardName || name,
      ...cfg,
    }));
  }
  if (payload.year && (payload.id || payload.leaderboardId || payload.leaderboard)) {
    return [
      {
        year: payload.year,
        id: payload.id ?? payload.leaderboardId ?? payload.leaderboard,
        name: payload.name || payload.leaderboardName || null,
      },
    ];
  }
  return [];
}

function fetchBackendsFromStorage() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(null, (items) => {
      const entries = Object.entries(items)
        .filter(([k]) => /^\d{4}-\d+$/.test(k))
        .map(([key, value]) => {
          if (typeof value === "string") {
            return { key, backend: value, name: null };
          }
          return { key, backend: value?.backend, name: value?.name ?? null };
        })
        .filter((e) => e.backend);
      resolve(entries);
    });
  });
}

async function renderBackends(backends) {
  const list = document.getElementById("backend-list");
  list.innerHTML = "";
  if (!backends.length) {
    list.textContent = "No backend saved yet.";
    return;
  }

  for (const { key, backend, name } of backends) {
    const div = document.createElement("div");
    div.className = "backend";

    let config = null;
    try {
      const response = await fetch(`${backend}/config`);
      config = response.ok ? await response.json() : null;
    } catch (e) {
      config = null;
    }

    const info = document.createElement("div");
    const [year, id] = key.split("-");
    const title = document.createElement("strong");
    const label = (config && config.leaderboardName) || name || `Leaderboard ${year}-${id}`;
    title.textContent = label;
    const detail = document.createElement("span");
    detail.innerHTML = `${year}#${id}`;
    detail.style.color = "#9fb3c8";
    info.appendChild(title);
    info.appendChild(detail);

    if (!config) {
      const warn = document.createElement("div");
      warn.style.color = "#ef5350";
      warn.style.fontSize = "12px";
      warn.textContent = "Backend unreachable (showing stored entry)";
      info.appendChild(warn);
    }

    const btn = document.createElement("button");
    btn.className = "delete";
    btn.type = "button";
    btn.innerHTML = "&#128465; Remove";
    btn.addEventListener("click", () => {
      chrome.storage.sync.remove(key, () => {
        setStatus(`Backend ${key} removed.`);
        refresh();
      });
    });

    const updateBtn = document.createElement("button");
    updateBtn.className = "view";
    updateBtn.type = "button";
    updateBtn.innerHTML = "&#9888; Update";
    updateBtn.style.borderColor = "rgba(255, 167, 38, 0.6)";
    updateBtn.style.color = "#ffa726";
    updateBtn.addEventListener("click", () => {
      const proceed = window.confirm(
        "Leaderboard has changed on backend. Overwrite local entry?"
      );
      if (!proceed) return;
      updateBackend(backend).catch((err) => {
        console.error(err);
        setStatus(err.message || "Update failed", true);
      });
    });

    const viewBtn = document.createElement("button");
    viewBtn.className = "view";
    viewBtn.type = "button";
    viewBtn.innerHTML = "&#128065; Open";
    viewBtn.addEventListener("click", () => {
      chrome.tabs.create({ url: `https://adventofcode.com/${year}/leaderboard/private/view/${id}` }, () => {});
    });

    const actions = document.createElement("div");
    actions.style.display = "flex";
    actions.style.gap = "6px";
    const shouldShowUpdate = (() => {
      if (!config) return false;
      const lbs = extractLeaderboards(config);
      if (!lbs.length) return false;
      // if current key not present in backend list -> mismatch
      return !lbs.some((lb) => `${lb.year}-${lb.id}` === key);
    })();

    if (shouldShowUpdate) {
      actions.appendChild(updateBtn);
    } else {
      actions.appendChild(viewBtn);
    }
    actions.appendChild(btn);

    const urlRow = document.createElement("div");
    urlRow.style.gridColumn = "1 / span 3";
    urlRow.style.fontSize = "12px";
    urlRow.style.color = "#9fb3c8";
    urlRow.textContent = backend;

    div.appendChild(info);
    div.appendChild(actions);
    div.appendChild(urlRow);
    list.appendChild(div);
  }
}

async function refresh() {
  const entries = await fetchBackendsFromStorage();
  renderBackends(entries);
}

async function addBackend(url) {
  const backendUrl = normalizeUrl(url);
  setStatus("Fetching /config...");

  const response = await fetch(`${backendUrl}/config`);
  if (!response.ok) {
    throw new Error(`Response ${response.status}`);
  }
  const payload = await response.json();
  const leaderboards = extractLeaderboards(payload);
  if (!leaderboards.length) {
    throw new Error("No leaderboard found in /config");
  }

  const toStore = {};
  for (const lb of leaderboards) {
    if (!lb.year || !lb.id) continue;
    const key = `${lb.year}-${lb.id}`;
    const name = lb.name || lb.slug || lb.leaderboardName || payload.leaderboardName || null;
    toStore[key] = { backend: backendUrl, name };
  }
  if (!Object.keys(toStore).length) {
    throw new Error("No valid year/id in /config");
  }

  const existing = await new Promise((resolve) => {
    chrome.storage.sync.get(Object.keys(toStore), (items) => resolve(items));
  });
  const collisions = Object.keys(toStore).filter((k) => existing[k]);

  const backendCollisions = await new Promise((resolve) => {
    chrome.storage.sync.get(null, (items) => {
      const keys = Object.entries(items)
        .filter(
          ([k, v]) =>
            /^\d{4}-\d+$/.test(k) &&
            ((typeof v === "string" && v === backendUrl) ||
              (v && typeof v === "object" && v.backend === backendUrl))
        )
        .map(([k]) => k);
      resolve(keys);
    });
  });

  const allCollisions = Array.from(new Set([...collisions, ...backendCollisions]));

  if (allCollisions.length) {
    const proceed = window.confirm(
      `These entries already exist (${allCollisions.join(", ")}). Replace them?`
    );
    if (!proceed) {
      setStatus("Cancelled.");
      return;
    }

    await new Promise((resolve) => {
      chrome.storage.sync.remove(allCollisions, () => resolve());
    });
  }

  await new Promise((resolve, reject) => {
    chrome.storage.sync.set(toStore, () => {
      if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
      resolve();
    });
  });

  const storedKeys = Object.keys(toStore).join(", ");
  setStatus(`Backend added for ${storedKeys}`);
  await refresh();
}

async function updateBackend(backendUrl) {
  const response = await fetch(`${backendUrl}/config`);
  if (!response.ok) throw new Error(`Response ${response.status}`);
  const payload = await response.json();
  const leaderboards = extractLeaderboards(payload);
  if (!leaderboards.length) throw new Error("No leaderboard found in /config");

  const toStore = {};
  for (const lb of leaderboards) {
    if (!lb.year || !lb.id) continue;
    const key = `${lb.year}-${lb.id}`;
    const name = lb.name || lb.slug || lb.leaderboardName || payload.leaderboardName || null;
    toStore[key] = { backend: backendUrl, name };
  }
  if (!Object.keys(toStore).length) throw new Error("No valid year/id in /config");

  // Remove all entries pointing to this backend, then set fresh
  const toRemove = await new Promise((resolve) => {
    chrome.storage.sync.get(null, (items) => {
      const keys = Object.entries(items)
        .filter(
          ([k, v]) =>
            /^\d{4}-\d+$/.test(k) &&
            ((typeof v === "string" && v === backendUrl) ||
              (v && typeof v === "object" && v.backend === backendUrl))
        )
        .map(([k]) => k);
      resolve(keys);
    });
  });

  await new Promise((resolve) => {
    chrome.storage.sync.remove(toRemove, () => resolve());
  });

  await new Promise((resolve, reject) => {
    chrome.storage.sync.set(toStore, () => {
      if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
      resolve();
    });
  });

  const storedKeys = Object.keys(toStore).join(", ");
  setStatus(`Backend updated for ${storedKeys}`);
  await refresh();
}

function setupForm() {
  const form = document.getElementById("add-form");
  const input = document.getElementById("backend-url");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const url = input.value.trim();
    if (!url) return;

    try {
      await addBackend(url);
    } catch (err) {
      console.error(err);
      setStatus(err.message || "Error while adding backend", true);
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  setupForm();
  refresh();
});
