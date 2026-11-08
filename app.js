// Gravity Garage dashboard. Data comes from tools/dashboard.py (data/current, data/history).
const M = 40; // game pixels per meter
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = (n, d = 2) => (typeof n === "number" ? (+n.toFixed(d)).toLocaleString() : n ?? "—");
const coins = (n) => (n ? `${n.toLocaleString()} coins` : "Free");

const state = { current: null, info: null, index: null, snaps: {}, carKind: "All" };

async function getJSON(url) {
  const r = await fetch(url, { cache: "no-cache" });
  if (!r.ok) throw new Error(url + " " + r.status);
  return r.json();
}
function snapshot(sha) {
  if (!state.snaps[sha]) state.snaps[sha] = getJSON(`data/history/${sha}/snapshot.json`).catch(() => null);
  return state.snaps[sha];
}

// ---------------- tabs ----------------
function showTab(name, push = true) {
  document.querySelectorAll(".tabs button").forEach((b) => b.setAttribute("aria-selected", b.dataset.tab === name));
  document.querySelectorAll(".tab").forEach((t) => (t.hidden = t.id !== "tab-" + name));
  if (push) history.replaceState(null, "", "#" + name);
}
document.querySelectorAll(".tabs button").forEach((b) => b.addEventListener("click", () => showTab(b.dataset.tab)));

// ---------------- modal ----------------
const modal = $("#modal");
modal.addEventListener("click", (e) => {
  if (e.target === modal || e.target.closest("[data-close]")) modal.close();
});
function openModal(html) {
  $("#modal-body").innerHTML = html;
  if (!modal.open) modal.showModal();
  modal.scrollTop = 0;
}

// ---------------- cars ----------------
function carKind(c) {
  if (c.id === "custom") return "Workshop";
  if (["buggy", "monster", "rocket"].includes(c.id)) return "Classic";
  if (["cart", "sofa", "bathtub", "icecream"].includes(c.id)) return "Funny";
  if (c.id.startsWith("kart")) return "Karts";
  if (c.id.startsWith("tractor")) return "Tractors";
  if (["race", "race-future", "sedan-sports", "hatchback-sports"].includes(c.id)) return "Racers";
  if (["truck", "truck-flat", "garbage-truck", "firetruck"].includes(c.id)) return "Trucks";
  return "Road cars";
}
const BAR_KEYS = ["Speed", "Power", "Grip", "Air control", "Fuel tank"];
const sorters = {
  order: (a, b) => a.order - b.order,
  cost: (a, b) => a.cost - b.cost,
  speed: (a, b) => b.top_speed_kmh - a.top_speed_kmh,
  power: (a, b) => (b.stats?.power ?? b.power) - (a.stats?.power ?? a.power),
  grip: (a, b) => (b.stats?.friction ?? b.grip) - (a.stats?.friction ?? a.grip),
  air: (a, b) => (b.stats?.air ?? b.air) - (a.stats?.air ?? a.air),
  mass: (a, b) => b.mass - a.mass,
  name: (a, b) => a.name.localeCompare(b.name),
};

function renderKinds() {
  const kinds = ["All", ...new Set(state.current.cars.map(carKind))];
  $("#car-kinds").innerHTML = kinds
    .map((k) => `<button class="chip" aria-pressed="${k === state.carKind}" data-kind="${esc(k)}">${esc(k)}</button>`)
    .join("");
}
$("#car-kinds").addEventListener("click", (e) => {
  const b = e.target.closest("[data-kind]");
  if (!b) return;
  state.carKind = b.dataset.kind;
  renderKinds();
  renderCars();
});
$("#car-q").addEventListener("input", renderCars);
$("#car-sort").addEventListener("change", renderCars);

function renderCars() {
  const q = $("#car-q").value.trim().toLowerCase();
  const list = state.current.cars
    .filter((c) => state.carKind === "All" || carKind(c) === state.carKind)
    .filter((c) => !q || [c.name, c.id, c.tag, c.trait].join(" ").toLowerCase().includes(q))
    .sort(sorters[$("#car-sort").value]);
  $("#cars").innerHTML =
    list
      .map(
        (c) => `
    <button class="card" data-car="${esc(c.id)}">
      <div class="stage"><img loading="lazy" src="data/current/${esc(c.img)}" alt="${esc(c.name)}"><span class="tag-pill">${esc(carKind(c))}</span></div>
      <div class="body">
        <h3>${esc(c.name)} <span class="price ${c.cost ? "" : "free"}">${c.cost ? c.cost.toLocaleString() : "Free"}</span></h3>
        <div class="trait">${esc(c.trait || c.tag)}</div>
        ${c.bars ? `<div class="minibars" title="${BAR_KEYS.join(" · ")}">${BAR_KEYS.map((k) => `<span><i style="width:${(c.bars[k] ?? 0) * 100}%"></i></span>`).join("")}</div>` : ""}
      </div>
    </button>`
      )
      .join("") || `<div class="empty">No cars match.</div>`;
}
$("#cars").addEventListener("click", (e) => {
  const b = e.target.closest("[data-car]");
  if (b) openCar(b.dataset.car);
});

function specRow(label, value, hint = "") {
  return `<tr><td>${label}${hint ? ` <small>${hint}</small>` : ""}</td><td>${value}</td></tr>`;
}

function openCar(id) {
  const c = state.current.cars.find((x) => x.id === id);
  if (!c) return;
  const st = c.stats || {};
  const mult = Object.entries(c.trait_mult || {}).filter(([k]) => k !== "trait");
  const range = st.fuel && st.burn ? `${fmt(st.fuel / st.burn, 0)} s` : "—";
  openModal(`
    <div class="m-hero">
      <div class="stage"><img src="data/current/${esc(c.img)}" alt="${esc(c.name)}"></div>
      <div class="m-info">
        <h2>${esc(c.name)}</h2>
        <p class="tagline">${esc(c.tag)}</p>
        <div class="kv">
          <span class="pill gold">${coins(c.cost)}</span>
          ${c.trait ? `<span class="pill">${esc(c.trait)}</span>` : ""}
          <span class="pill">${esc(carKind(c))}</span>
          ${c.color ? `<span class="pill"><span class="swatch" style="background:${esc(c.color)}"></span>${esc(c.color)}</span>` : ""}
        </div>
        ${
          c.bars
            ? `<div class="bars">${BAR_KEYS.map(
                (k) => `<div class="bar"><span>${k}</span><div class="track"><div class="fill" style="width:${(c.bars[k] ?? 0) * 100}%"></div></div><span class="val">${Math.round((c.bars[k] ?? 0) * 100)}</span></div>`
              ).join("")}</div>`
            : ""
        }
      </div>
    </div>
    <div class="m-sections">
      <div>
        <h4>Driving</h4>
        <table class="specs">
          ${specRow("Top speed", `${fmt(c.top_speed_kmh, 1)} km/h`, "on Dust Mesa")}
          ${specRow("Engine power", fmt(st.power ?? c.power))}
          ${specRow("Grip", fmt(st.friction ?? c.grip), "with trait")}
          ${specRow("Air control", fmt(st.air ?? c.air))}
          ${specRow("Wheelie", fmt(c.wheelie))}
          ${specRow("Wheel spin", fmt(st.spin ?? c.spin), "rad/s")}
        </table>
      </div>
      <div>
        <h4>Body</h4>
        <table class="specs">
          ${specRow("Weight", fmt(c.mass))}
          ${c.size ? specRow("Size", `${fmt(c.size[0] / M, 2)} × ${fmt(c.size[1] / M, 2)} m`) : ""}
          ${specRow("Wheel radius", c.wheel_rs ? c.wheel_rs.map((r) => fmt(r / M, 2)).join(" / ") + " m" : `${fmt(c.wheel_r / M, 2)} m`)}
          ${specRow("Wheel weight", fmt(c.wheel_mass))}
          ${specRow("Suspension", `${fmt(st.stiff ?? c.stiff, 1)} stiff · ${fmt(st.damp ?? c.damp, 2)} damp`)}
          ${specRow("Travel", `${fmt(c.travel / M, 2)} m`)}
        </table>
      </div>
      <div>
        <h4>Fuel</h4>
        <table class="specs">
          ${specRow("Tank", fmt(st.fuel, 0))}
          ${specRow("Burn rate", fmt(st.burn ?? c.burn), "per second")}
          ${specRow("Range at full gas", range)}
        </table>
        ${
          mult.length
            ? `<h4 style="margin-top:18px">Trait bonus</h4><table class="specs">${mult
                .map(([k, v]) => specRow(k, k === "tank" ? `+${v} fuel` : `×${v}`))
                .join("")}</table>`
            : ""
        }
      </div>
      ${
        c.upgrade_costs
          ? `<div><h4>Upgrade cost per level</h4><table class="specs">${c.upgrade_costs
              .map((v, i) => specRow(`Level ${i + 1}`, `${v.toLocaleString()} coins`))
              .join("")}${specRow("All 4 upgrades to max", `${(c.upgrade_costs.reduce((a, b) => a + b, 0) * 4).toLocaleString()} coins`)}</table></div>`
          : ""
      }
      <div class="wide"><h4>History of this car</h4><div class="timeline-mini" id="item-history">Loading…</div></div>
    </div>`);
  fillItemHistory("cars", id);
}

// ---------------- maps ----------------
function profileSVG(m, w = 300, h = 56, full = false) {
  if (!m.profile) return "";
  const p = m.profile;
  const lo = Math.min(...p) - 2, hi = Math.max(...p) + 2;
  const xs = (i) => (i / (p.length - 1)) * w;
  const ys = (v) => h - ((v - lo) / (hi - lo)) * h;
  let d = `M0 ${h} ` + p.map((v, i) => `L${xs(i).toFixed(1)} ${ys(v).toFixed(1)}`).join(" ") + ` L${w} ${h} Z`;
  const line = p.map((v, i) => `${i ? "L" : "M"}${xs(i).toFixed(1)} ${ys(v).toFixed(1)}`).join(" ");
  const step = m.profile_step || 5;
  const len = (p.length - 1) * step;
  let ticks = "";
  if (full) {
    for (let x = 0; x <= len; x += 250) {
      const px = (x / len) * w;
      ticks += `<line x1="${px}" x2="${px}" y1="0" y2="${h}" stroke="currentColor" stroke-opacity=".08"/><text x="${px + 3}" y="${h - 4}" font-size="10" fill="currentColor" fill-opacity=".5">${x} m</text>`;
    }
  }
  return `<svg class="${full ? "big-profile" : "profile"}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="Hill profile, first ${len} m">
    ${ticks}<path d="${d}" fill="${esc(m.soil)}" fill-opacity=".85"/><path d="${line}" fill="none" stroke="currentColor" stroke-opacity=".75" stroke-width="1.5" vector-effect="non-scaling-stroke"/></svg>`;
}
function gravityLabel(g) {
  return `${fmt(g / 980, 2)}× Earth`;
}
function renderMaps() {
  $("#maps").innerHTML = state.current.maps
    .map(
      (m) => `
    <button class="card" data-map="${esc(m.id)}">
      <div class="stage map-stage">${m.img ? `<img loading="lazy" src="data/current/${esc(m.img)}" alt="${esc(m.name)}">` : ""}</div>
      <div class="body">
        <h3>${esc(m.name)} <span class="price ${m.cost ? "" : "free"}">${m.cost ? m.cost.toLocaleString() : "Free"}</span></h3>
        <div class="trait">${esc(m.tag)}</div>
        <div class="facts"><span>Gravity <b>${gravityLabel(m.g)}</b></span><span>Grip <b>${fmt(m.ground)}</b></span><span>Hills <b>${fmt(m.amp)}</b></span><span>Coins <b>×${m.coin}</b></span></div>
        ${profileSVG(m)}
      </div>
    </button>`
    )
    .join("");
}
$("#maps").addEventListener("click", (e) => {
  const b = e.target.closest("[data-map]");
  if (b) openMap(b.dataset.map);
});
function openMap(id) {
  const m = state.current.maps.find((x) => x.id === id);
  if (!m) return;
  const colors = ["sky_top", "sky_bot", "sun", "far", "near", "top", "soil", "strata1", "strata2"].filter((k) => m[k]);
  const p = m.profile || [];
  const climb = p.reduce((a, v, i) => a + (i && v > p[i - 1] ? v - p[i - 1] : 0), 0);
  openModal(`
    <div class="m-hero">
      <div class="stage">${m.img ? `<img src="data/current/${esc(m.img)}" alt="${esc(m.name)}" style="object-fit:cover;height:100%;padding:0">` : ""}</div>
      <div class="m-info">
        <h2>${esc(m.name)}</h2>
        <p class="tagline">${esc(m.tag)}</p>
        <div class="kv">
          <span class="pill gold">${coins(m.cost)}</span>
          <span class="pill">Coins ×${m.coin}</span>
          ${m.props ? `<span class="pill">${esc(m.props)}</span>` : ""}
          ${m.lava ? `<span class="pill">lava</span>` : ""}
          ${m.stars ? `<span class="pill">stars</span>` : ""}
        </div>
        <table class="specs">
          ${specRow("Gravity", `${fmt(m.g, 0)} <small>(${gravityLabel(m.g)})</small>`)}
          ${specRow("Ground grip", fmt(m.ground))}
          ${specRow("Hill height", fmt(m.amp), "amp")}
          ${specRow("Roughness", fmt(m.rough))}
          ${specRow("Ridge style", esc(m.ridge))}
          ${specRow("World seed", m.seed)}
        </table>
      </div>
    </div>
    <div class="m-sections">
      ${
        p.length
          ? `<div class="wide"><h4>Hill profile — first ${(p.length - 1) * (m.profile_step || 5)} m</h4>${profileSVG(m, 900, 180, true)}
             <div class="facts"><span>Highest <b>${fmt(Math.max(...p), 1)} m</b></span><span>Lowest <b>${fmt(Math.min(...p), 1)} m</b></span><span>Total climb <b>${fmt(climb, 0)} m</b></span></div></div>`
          : ""
      }
      <div class="wide"><h4>Colors</h4><div class="palette">${colors
        .map((k) => `<span title="${k} ${esc(m[k])}" style="background:${esc(m[k])}"></span>`)
        .join("")}</div></div>
      <div class="wide"><h4>History of this map</h4><div class="timeline-mini" id="item-history">Loading…</div></div>
    </div>`);
  fillItemHistory("maps", id);
}

// history entries for one car/map, from the precomputed index
function fillItemHistory(kind, id) {
  const el = $("#item-history");
  if (!state.index) {
    el.textContent = "No history yet — run: python3 tools/dashboard.py history";
    return;
  }
  const rows = [];
  for (const c of state.index.commits) {
    const ch = c.changes?.[kind];
    if (!ch) continue;
    const what = [];
    if (ch.added.includes(id)) what.push("added");
    if (ch.look.includes(id)) what.push("new look");
    if (ch.stats.includes(id)) what.push("stats changed");
    if (ch.removed.includes(id)) what.push("removed");
    if (what.length) rows.push({ c, what });
  }
  el.innerHTML = rows.length
    ? rows
        .map(
          ({ c, what }) => `<div class="tm-row"><span class="sha">${esc(c.short)}</span><div><button data-goto="${esc(c.sha)}"><b>${esc(what.join(", "))}</b> — ${esc(c.subject)}</button><div class="c-meta">${new Date(c.date).toLocaleString()}</div></div></div>`
        )
        .join("")
    : `<span class="note">No recorded changes — unchanged since the first snapshot.</span>`;
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-goto]");
  if (!b) return;
  modal.close();
  showTab("history");
  const d = document.getElementById("c-" + b.dataset.goto);
  if (d) {
    d.open = true;
    d.scrollIntoView({ behavior: "smooth", block: "start" });
  }
});

// ---------------- history ----------------
function badges(c) {
  const ch = c.changes;
  if (!ch) return `<span class="badge">no snapshot</span>`;
  const out = [];
  const n = (a) => a.length;
  if (!c.has_parent_snapshot) out.push(`<span class="badge add">first snapshot</span>`);
  for (const [kind, label] of [["cars", "car"], ["maps", "map"]]) {
    const k = ch[kind];
    if (n(k.added)) out.push(`<span class="badge add">+${n(k.added)} ${label}${n(k.added) > 1 ? "s" : ""}</span>`);
    if (n(k.removed)) out.push(`<span class="badge stat">−${n(k.removed)} ${label}${n(k.removed) > 1 ? "s" : ""}</span>`);
    if (n(k.look)) out.push(`<span class="badge look">${n(k.look)} ${label} look${n(k.look) > 1 ? "s" : ""}</span>`);
    if (n(k.stats)) out.push(`<span class="badge stat">${n(k.stats)} ${label} stat${n(k.stats) > 1 ? "s" : ""}</span>`);
  }
  const p = ch.parts;
  if (p && n(p.added)) out.push(`<span class="badge add">+${n(p.added)} workshop parts</span>`);
  if (p && n(p.changed)) out.push(`<span class="badge stat">${n(p.changed)} parts tuned</span>`);
  return out.join("");
}
function isVisual(c) {
  const ch = c.changes;
  if (!ch) return false;
  return ["cars", "maps"].some((k) => Object.values(ch[k]).some((a) => a.length)) || Object.values(ch.parts || {}).some((a) => a.length);
}
function thumbs(c) {
  const ch = c.changes;
  if (!ch) return "";
  const ids = [...new Set([...ch.cars.added, ...ch.cars.look])].slice(0, 8);
  const maps = [...new Set([...ch.maps.added, ...ch.maps.look])].slice(0, 4);
  if (!ids.length && !maps.length) return "";
  return `<div class="c-thumbs">${ids.map((i) => `<img loading="lazy" src="data/history/${c.sha}/cars/${esc(i)}.png" alt="">`).join("")}${maps
    .map((i) => `<img loading="lazy" src="data/history/${c.sha}/maps/${esc(i)}.png" alt="">`)
    .join("")}</div>`;
}

function renderHistory() {
  const el = $("#history");
  if (!state.index || !state.index.commits.length) {
    el.innerHTML = `<div class="empty">No history yet. Run <code>python3 tools/dashboard.py history</code> once, then every <code>git push</code> adds to it.</div>`;
    return;
  }
  const q = $("#hist-q").value.trim().toLowerCase();
  const onlyVisual = $("#hist-visual").checked;
  const pushes = state.index.pushes || [];
  const pushOf = {};
  pushes.forEach((p, i) => p.commits.forEach((s) => (pushOf[s] ??= i)));
  const commits = state.index.commits.filter(
    (c) => (!q || (c.subject + " " + c.sha + " " + c.author).toLowerCase().includes(q)) && (!onlyVisual || isVisual(c))
  );
  // group consecutive commits by the push that sent them
  const groups = [];
  for (const c of commits) {
    const key = pushOf[c.sha] ?? "none";
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(c);
    else groups.push({ key, items: [c] });
  }
  el.innerHTML = groups
    .map((g) => {
      const p = g.key === "none" ? null : pushes[g.key];
      const head = p
        ? `<span class="dot"></span><b>Push</b> ${new Date(p.time).toLocaleString()} → ${esc(p.ref.replace("refs/heads/", ""))} · ${g.items.length} commit${g.items.length > 1 ? "s" : ""}`
        : `<span class="dot" style="background:var(--muted)"></span><b>Not from a recorded push</b> · ${g.items.length} commit${g.items.length > 1 ? "s" : ""} (backfilled or not pushed yet)`;
      return `<div class="push"><div class="push-head">${head}</div>${g.items
        .map(
          (c) => `
        <details class="commit" id="c-${esc(c.sha)}" data-sha="${esc(c.sha)}">
          <summary>
            <div class="c-subj">${esc(c.subject)}</div>
            <div class="c-badges">${badges(c)}</div>
            <div class="c-meta"><span class="sha">${esc(c.short)}</span><span>${new Date(c.date).toLocaleString()}</span><span>${esc(c.author)}</span><span>${c.files} file${c.files === 1 ? "" : "s"}</span>${
              c.counts ? `<span>${c.counts.cars} cars · ${c.counts.maps} maps</span>` : ""
            }</div>
            ${thumbs(c)}
          </summary>
          <div class="c-detail">Loading…</div>
        </details>`
        )
        .join("")}</div>`;
    })
    .join("") || `<div class="empty">No commits match.</div>`;
}
$("#hist-q").addEventListener("input", renderHistory);
$("#hist-visual").addEventListener("change", renderHistory);
$("#history").addEventListener(
  "toggle",
  (e) => {
    const d = e.target;
    if (d.matches("details.commit") && d.open && !d.dataset.loaded) {
      d.dataset.loaded = "1";
      loadCommitDetail(d);
    }
  },
  true
);

function flatten(o, pre = "", out = {}) {
  for (const [k, v] of Object.entries(o || {})) {
    if (["img", "img_hash", "order", "profile"].includes(k)) continue;
    if (v && typeof v === "object" && !Array.isArray(v)) flatten(v, pre + k + ".", out);
    else out[pre + k] = v;
  }
  return out;
}
function show(v) {
  if (Array.isArray(v)) return v.length > 6 ? `[${v.length} items]` : `[${v.map((x) => (typeof x === "number" ? fmt(x, 3) : Array.isArray(x) ? "…" : x)).join(", ")}]`;
  if (typeof v === "number") return fmt(v, 3);
  return esc(v);
}
function fieldChanges(a, b) {
  const fa = flatten(a), fb = flatten(b);
  const keys = [...new Set([...Object.keys(fa), ...Object.keys(fb)])];
  const rows = [];
  for (const k of keys) {
    if (JSON.stringify(fa[k]) === JSON.stringify(fb[k])) continue;
    let cls = "";
    if (typeof fa[k] === "number" && typeof fb[k] === "number") cls = fb[k] > fa[k] ? "up" : "down";
    const arrow = cls === "up" ? "▲" : cls === "down" ? "▼" : "→";
    rows.push(`<tr><td>${esc(k)}</td><td class="old">${fa[k] === undefined ? "—" : show(fa[k])}</td><td class="${cls}">${arrow} ${fb[k] === undefined ? "—" : show(fb[k])}</td></tr>`);
  }
  let extra = "";
  if (b?.profile && JSON.stringify(a?.profile) !== JSON.stringify(b.profile)) extra = profileCompare(a, b);
  return rows.length || extra ? `${rows.length ? `<table class="changes">${rows.join("")}</table>` : ""}${extra}` : "";
}

// before (dashed) and after (solid) hill lines on one chart
function profileCompare(a, b) {
  const n = Math.round(800 / (b.profile_step || 5)) + 1; // first 800 m, so the hills are readable
  const pa = (a?.profile || []).slice(0, n), pb = b.profile.slice(0, n);
  const all = [...pa, ...pb];
  const lo = Math.min(...all) - 2, hi = Math.max(...all) + 2, w = 900, h = 140;
  const path = (p) => p.map((v, i) => `${i ? "L" : "M"}${((i / (p.length - 1)) * w).toFixed(1)} ${(h - ((v - lo) / (hi - lo)) * h).toFixed(1)}`).join(" ");
  const len = (pb.length - 1) * (b.profile_step || 5);
  const diffs = pb.filter((v, i) => pa[i] !== undefined && Math.abs(v - pa[i]) > 0.05).length;
  return `<div class="pc"><div class="pc-legend"><span><i class="before"></i>Before</span><span><i class="after"></i>After</span><span>hill height, first ${len} m · ${pa.length ? `${Math.round((diffs / pb.length) * 100)}% of the road changed` : "new"}</span></div>
    <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" class="big-profile" style="height:140px">
      ${pa.length ? `<path d="${path(pa)}" fill="none" stroke="currentColor" stroke-opacity=".45" stroke-dasharray="5 4" stroke-width="1.5" vector-effect="non-scaling-stroke"/>` : ""}
      <path d="${path(pb)}" fill="none" stroke="var(--teal)" stroke-width="2" vector-effect="non-scaling-stroke"/></svg></div>`;
}

async function loadCommitDetail(d) {
  const sha = d.dataset.sha;
  const c = state.index.commits.find((x) => x.sha === sha);
  const parent = c.parents[0];
  const [meta, after, before] = await Promise.all([
    getJSON(`data/history/${sha}/meta.json`).catch(() => null),
    snapshot(sha),
    parent && c.has_parent_snapshot ? snapshot(parent) : Promise.resolve(null),
  ]);
  const box = $(".c-detail", d);
  let html = "";
  if (meta?.body) html += `<div class="c-body">${esc(meta.body)}</div>`;
  if (!after) {
    box.innerHTML = html + `<p class="note">No snapshot for this commit (export failed).</p>`;
    return;
  }
  if (!before) html += `<p class="note">${parent ? "Parent commit has no snapshot, so there is nothing to compare against." : "First commit — everything below is new."}</p>`;

  for (const [kind, label] of [["cars", "Cars"], ["maps", "Maps"]]) {
    const A = Object.fromEntries((before?.[kind] || []).map((x) => [x.id, x]));
    const B = Object.fromEntries(after[kind].map((x) => [x.id, x]));
    const added = before ? after[kind].filter((x) => !A[x.id]) : [];
    const removed = before ? before[kind].filter((x) => !B[x.id]) : [];
    const changed = before
      ? after[kind].filter((x) => A[x.id] && (A[x.id].img_hash !== x.img_hash || fieldChanges(A[x.id], x)))
      : [];
    const mapCls = kind === "maps" ? " map" : "";
    if (added.length)
      html += `<div class="sec-title">${label} added</div><div class="added-grid">${added
        .map((x) => `<figure>${x.img ? `<img src="data/history/${sha}/${esc(x.img)}" alt="">` : ""}<figcaption>${esc(x.name)}</figcaption></figure>`)
        .join("")}</div>`;
    if (changed.length)
      html += `<div class="sec-title">${label} changed — before / after</div><div class="ba-list">${changed
        .map((x) => {
          const a = A[x.id];
          const lookChanged = a.img_hash !== x.img_hash;
          const fields = fieldChanges(a, x);
          return `<div class="ba"><div class="ba-head">${esc(x.name)} <small>${[lookChanged && "new look", fields && "stats changed"].filter(Boolean).join(" · ")}</small></div>
            ${
              lookChanged
                ? `<div class="ba-imgs${mapCls}"><figure><figcaption>Before</figcaption>${a.img ? `<img src="data/history/${parent}/${esc(a.img)}" alt="before">` : `<div class="none">no picture</div>`}</figure><figure><figcaption class="after">After</figcaption>${x.img ? `<img src="data/history/${sha}/${esc(x.img)}" alt="after">` : `<div class="none">no picture</div>`}</figure></div>`
                : ""
            }
            ${fields}</div>`;
        })
        .join("")}</div>`;
    if (removed.length)
      html += `<div class="sec-title">${label} removed</div><div class="added-grid">${removed
        .map((x) => `<figure>${x.img ? `<img src="data/history/${parent}/${esc(x.img)}" alt="">` : ""}<figcaption>${esc(x.name)}</figcaption></figure>`)
        .join("")}</div>`;
  }

  // workshop parts
  const pc = c.changes?.parts;
  if (pc && (pc.added.length || pc.changed.length || pc.removed.length)) {
    const name = (snap, key) => {
      const [cat, id] = key.split("/");
      return snap?.parts?.[cat]?.[id];
    };
    html += `<div class="sec-title">Workshop parts</div><table class="changes" style="margin-bottom:18px">${[
      ...pc.added.map((k) => `<tr><td>${esc(k)}</td><td></td><td class="up">+ ${esc(name(after, k)?.name)} · ${name(after, k)?.cost ?? 0} coins</td></tr>`),
      ...pc.removed.map((k) => `<tr><td>${esc(k)}</td><td class="old">${esc(name(before, k)?.name)}</td><td class="down">removed</td></tr>`),
      ...pc.changed.map((k) => `<tr><td colspan="3">${esc(k)}${fieldChanges(name(before, k), name(after, k))}</td></tr>`),
    ].join("")}</table>`;
  }

  if (!before) {
    html += `<div class="sec-title">Cars at this commit</div><div class="added-grid">${after.cars
      .map((x) => `<figure>${x.img ? `<img src="data/history/${sha}/${esc(x.img)}" alt="">` : ""}<figcaption>${esc(x.name)}</figcaption></figure>`)
      .join("")}</div><div class="sec-title">Maps at this commit</div><div class="added-grid">${after.maps
      .map((x) => `<figure>${x.img ? `<img src="data/history/${sha}/${esc(x.img)}" alt="">` : ""}<figcaption>${esc(x.name)}</figcaption></figure>`)
      .join("")}</div>`;
  }

  if (meta?.files?.length)
    html += `<div class="sec-title">Files changed</div><div class="files">${meta.files
      .map(
        (f) => `<div><span class="st ${esc(f.status)}">${esc(f.status)}</span><span>${esc(f.path)}</span><span>${
          f.add == null ? "binary" : `<span class="plus">+${f.add}</span> <span class="minus">−${f.del}</span>`
        }</span></div>`
      )
      .join("")}</div>`;
  box.innerHTML = html;
}

// ---------------- boot ----------------
async function boot() {
  try {
    state.current = await getJSON("data/current/snapshot.json");
  } catch {
    $("main").innerHTML = `<div class="empty">No data yet. Start the dashboard with <code>python3 tools/dashboard.py serve</code>.</div>`;
    return;
  }
  state.info = await getJSON("data/current.json").catch(() => null);
  state.index = await getJSON("data/history/index.json").catch(() => null);
  $("#n-cars").textContent = state.current.cars.length;
  $("#n-maps").textContent = state.current.maps.length;
  $("#n-hist").textContent = state.index ? state.index.commits.length : 0;
  if (state.info) $("#meta").textContent = `${state.info.branch} @ ${state.info.head} · exported ${new Date(state.info.exported_at).toLocaleString()}`;
  renderKinds();
  renderCars();
  renderMaps();
  renderHistory();
  const tab = location.hash.slice(1);
  if (["cars", "maps", "history"].includes(tab)) showTab(tab, false);
}
boot();
