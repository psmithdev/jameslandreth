(function () {
  const D = window.FOLIAGE;
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const pad = n => String(n).padStart(2, "0");
  const stops = D.stops.map((s, i) => ({ ...s, index: i, num: pad(i + 1) }));
  const byId = Object.fromEntries(stops.map(s => [s.id, s]));
  const routeLegs = D.routeLegs || stops.map((s, i) => ({ from: s.id, to: stops[(i + 1) % stops.length].id }));
  D.photos.forEach((p, i) => { p.index = i; p.n = pad(i + 1); });
  const hav = (a, b) => { const r = x => x * Math.PI / 180, R = 3958.8, dLa = r(b.lat - a.lat), dLo = r(b.lon - a.lon);
    return 2 * R * Math.asin(Math.sqrt(Math.sin(dLa / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLo / 2) ** 2)); };
  const legMiles = stops.map((s, i) => s.milesToNext ?? Math.round(hav(s, stops[(i + 1) % stops.length]) * 1.3 / 5) * 5);
  const mileAt = i => legMiles.slice(0, i).reduce((x, y) => x + y, 0);
  const totalMiles = mileAt(stops.length);
  const estimated = stops.some(s => s.milesToNext == null);

  const css = `
  .ph-empty{width:100%;display:flex;align-items:center;justify-content:center;background:repeating-linear-gradient(135deg,var(--ph-a) 0 9px,var(--ph-b) 9px 18px)}
  .ph-empty span{font-family:'IBM Plex Mono',monospace;font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:var(--ph-ink);background:var(--ph-tag);padding:6px 10px;text-align:center}
  .ph-img{display:block;width:100%;height:auto;object-fit:cover}
  .todo{color:var(--todo);font-style:italic;border-bottom:1px dashed currentColor}
  .lb{position:fixed;inset:0;z-index:100;background:var(--lb-bg);color:var(--lb-fg);display:grid;grid-template-rows:auto minmax(0,1fr) auto auto;font-family:'IBM Plex Serif',Georgia,serif}
  .lb[hidden]{display:none}
  .lb-top{display:flex;align-items:center;gap:16px;padding:16px 24px;font-family:'IBM Plex Mono',monospace;font-size:14px;letter-spacing:.16em;text-transform:uppercase}
  .lb-count{color:var(--lb-accent)}.lb-stop{flex:1}
  .lb-btn{font:500 14px/1 'IBM Plex Mono',monospace;letter-spacing:.12em;text-transform:uppercase;color:var(--lb-fg);background:transparent;border:1px solid var(--lb-rule);padding:12px 16px;cursor:pointer;min-height:44px;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;gap:8px;transition:color .15s,border-color .15s}
  .lb-btn:hover{border-color:var(--lb-accent);color:var(--lb-accent)}
  .lb-btn[aria-disabled=true]{opacity:.45;pointer-events:none}
  .lb-stage{display:grid;grid-template-columns:64px minmax(0,1fr) 64px;align-items:center;gap:12px;padding:0 16px;min-height:0}
  .lb-media{display:flex;justify-content:center;align-items:center;min-height:0;height:100%}
  .lb-media img{max-height:66vh;max-width:100%;width:auto;height:auto}
  .lb-media .ph-empty{height:min(62vh,52vw);width:auto;max-width:100%}
  .lb-arrow{width:56px;height:56px;font-size:22px;padding:0}
  .lb-bottom{display:flex;gap:24px;justify-content:space-between;align-items:flex-end;padding:20px 24px 24px;max-width:1280px;margin:0 auto;width:100%;box-sizing:border-box;flex-wrap:wrap}
  .lb-title{font-family:'Libre Baskerville',Georgia,serif;font-size:28px;margin:0 0 8px;font-weight:400}
  .lb-cap{font-size:20px;line-height:1.5;margin:0 0 8px;max-width:60ch}
  .lb-meta{font-family:'IBM Plex Mono',monospace;font-size:14px;letter-spacing:.1em;text-transform:uppercase;margin:0}
  .lb .todo{color:var(--lb-fg);opacity:.8}
  .lb-actions{display:flex;gap:10px;flex-wrap:wrap}
  .lb-bar{height:3px;background:var(--lb-rule)}.lb-bar i{display:block;height:100%;width:0;background:var(--lb-accent)}
  @media(max-width:700px){.lb-stage{grid-template-columns:44px minmax(0,1fr) 44px;gap:6px;padding:0 6px}.lb-arrow{width:44px;height:44px}.lb-title{font-size:22px}.lb-cap{font-size:18px}}
  .map-stop{cursor:pointer}
  `;
  document.head.insertAdjacentHTML("beforeend", `<style>${css}</style>`);

  function media(p, cls = "") {
    const ratio = p.orientation === "portrait" ? "2 / 3" : p.orientation === "square" ? "1 / 1" : "3 / 2";
    const where = byId[p.stop].name;
    if (p.file) return `<img class="ph-img ${cls}" src="${esc(p.file)}" alt="${esc(p.title || where)}" loading="lazy" style="aspect-ratio:${ratio}">`;
    return `<div class="ph-empty ${cls}" style="aspect-ratio:${ratio}"><span>Photo ${p.n} · ${esc(where)}</span></div>`;
  }
  const text = (v, fallback) => v ? esc(v) : `<span class="todo">${esc(fallback)}</span>`;
  const meta = p => [p.date, p.credit ? `Photograph by ${p.credit}` : ""].filter(Boolean).map(esc).join(" · ");

  // ---------- Lightbox ----------
  let lb, cur = 0, playing = false, timer = null;
  const DWELL = 5000;
  function buildLightbox() {
    if (lb) return;
    document.body.insertAdjacentHTML("beforeend", `
    <div class="lb" hidden role="dialog" aria-modal="true" aria-label="Photo viewer">
      <div class="lb-top"><span class="lb-count"></span><span class="lb-stop"></span><button class="lb-btn lb-close" type="button">Close ✕</button></div>
      <div class="lb-stage">
        <button class="lb-btn lb-arrow lb-prev" type="button" aria-label="Previous photo">←</button>
        <div class="lb-media"></div>
        <button class="lb-btn lb-arrow lb-next" type="button" aria-label="Next photo">→</button>
      </div>
      <div class="lb-bottom">
        <div><h3 class="lb-title"></h3><p class="lb-cap"></p><p class="lb-meta"></p></div>
        <div class="lb-actions"><button class="lb-btn lb-play" type="button">▶ Play slideshow</button><a class="lb-btn lb-dl" download>Download print ↓</a></div>
      </div>
      <div class="lb-bar"><i></i></div>
    </div>`);
    lb = document.querySelector(".lb");
    lb.querySelector(".lb-close").onclick = close;
    lb.querySelector(".lb-prev").onclick = () => step(-1);
    lb.querySelector(".lb-next").onclick = () => step(1);
    lb.querySelector(".lb-play").onclick = () => setPlay(!playing);
    document.addEventListener("keydown", e => {
      if (lb.hidden) return;
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") step(-1);
      if (e.key === "ArrowRight") step(1);
      if (e.key === " ") { e.preventDefault(); setPlay(!playing); }
    });
    document.addEventListener("click", e => {
      const play = e.target.closest("[data-play-slideshow]");
      if (play) { open(0); setPlay(true); return; }
      const t = e.target.closest("[data-photo-index]");
      if (t) open(+t.dataset.photoIndex);
    });
  }
  function render() {
    const p = D.photos[cur], s = byId[p.stop];
    lb.querySelector(".lb-count").textContent = `${p.n} / ${pad(D.photos.length)}`;
    lb.querySelector(".lb-stop").textContent = `Chapter ${s.num} · ${s.name}, ${s.state}`;
    lb.querySelector(".lb-media").innerHTML = media(p);
    lb.querySelector(".lb-title").innerHTML = text(p.title, "Jim’s title");
    lb.querySelector(".lb-cap").innerHTML = text(p.caption, "A sentence or two from Jim about this picture.");
    lb.querySelector(".lb-meta").innerHTML = meta(p);
    const dl = lb.querySelector(".lb-dl");
    if (p.file) { dl.href = p.file; dl.removeAttribute("aria-disabled"); } else { dl.removeAttribute("href"); dl.setAttribute("aria-disabled", "true"); }
    if (playing) restartBar();
  }
  function restartBar() {
    const bar = lb.querySelector(".lb-bar i");
    bar.style.transition = "none"; bar.style.width = "0"; void bar.offsetWidth;
    bar.style.transition = `width ${DWELL}ms linear`; bar.style.width = "100%";
    clearTimeout(timer); timer = setTimeout(() => step(1), DWELL);
  }
  function setPlay(on) {
    playing = on;
    lb.querySelector(".lb-play").textContent = on ? "❚❚ Pause" : "▶ Play slideshow";
    const bar = lb.querySelector(".lb-bar i");
    if (on) restartBar(); else { clearTimeout(timer); bar.style.transition = "none"; bar.style.width = "0"; }
  }
  function step(d) { cur = (cur + d + D.photos.length) % D.photos.length; render(); }
  function open(i) { cur = i; lb.hidden = false; document.body.style.overflow = "hidden"; render(); }
  function close() { setPlay(false); lb.hidden = true; document.body.style.overflow = ""; }

  // ---------- Map ----------
  const NE = ["09", "23", "25", "33", "44", "50"];
  const STATE_LABELS = [["Vt.", -72.85, 43.2], ["N.H.", -71.62, 43.35], ["Maine", -69.25, 45.45], ["Mass.", -72.2, 42.45], ["Conn.", -72.72, 41.62], ["R.I.", -71.55, 41.68], ["N.Y.", -73.55, 43.9]];
  async function drawMap(svgEl, T, onStopClick) {
    const W = 560, H = 700;
    svgEl.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svgEl.setAttribute("preserveAspectRatio", "xMidYMid meet");
    const svg = d3.select(svgEl);
    const proj = d3.geoTransverseMercator().rotate([71, 0]);
    let topo = null;
    try { topo = await (await fetch("https://cdn.jsdelivr.net/npm/us-atlas@3.0.1/states-10m.json")).json(); } catch (e) { console.warn("Map data unavailable", e); }
    if (topo) {
      const feats = topojson.feature(topo, topo.objects.states).features;
      const ne = feats.filter(f => NE.includes(f.id));
      const ctx = feats.filter(f => ["36", "34", "42"].includes(f.id));
      proj.fitExtent([[28, 28], [W - 28, H - 28]], { type: "FeatureCollection", features: ne });
      const path = d3.geoPath(proj);
      svg.append("g").selectAll("path").data(ctx).join("path").attr("d", path).attr("fill", T.ctx).attr("stroke", T.stroke).attr("stroke-width", 0.8);
      svg.append("g").selectAll("path").data(ne).join("path").attr("d", path).attr("fill", T.land).attr("stroke", T.stroke).attr("stroke-width", 1);
      svg.append("g").selectAll("text").data(STATE_LABELS).join("text")
        .attr("x", d => proj([d[1], d[2]])[0]).attr("y", d => proj([d[1], d[2]])[1]).text(d => d[0])
        .attr("text-anchor", "middle").attr("fill", T.stateLabel).attr("font-family", "IBM Plex Mono, monospace").attr("font-size", 14).attr("letter-spacing", "0.18em").style("text-transform", "uppercase");
      const [ox, oy] = proj([-68.7, 42.9]);
      svg.append("text").attr("x", ox).attr("y", oy).attr("text-anchor", "middle").attr("fill", T.stateLabel).attr("font-family", "Libre Baskerville, Georgia, serif").attr("font-style", "italic").attr("font-size", 16).text("Gulf of Maine");
    } else {
      proj.fitExtent([[60, 60], [W - 60, H - 60]], { type: "MultiPoint", coordinates: stops.map(s => [s.lon, s.lat]) });
    }
    const pts = stops.map(s => proj([s.lon, s.lat]));
    const waypointData = routeLegs.flatMap(leg => leg.via || []);
    const legD = routeLegs.map(leg => {
      const routePoints = [byId[leg.from], ...(leg.via || []), byId[leg.to]].map(p => proj([p.lon, p.lat]));
      return d3.line().curve(d3.curveCatmullRom.alpha(0.5))(routePoints);
    });
    svg.append("g").selectAll("path").data(legD).join("path").attr("d", d => d).attr("fill", "none").attr("stroke", T.ghost).attr("stroke-width", 1.6).attr("stroke-dasharray", "2 7").attr("stroke-linecap", "round");
    const waypoints = svg.append("g").attr("class", "map-waypoints").selectAll("g").data(waypointData).join("g")
      .attr("transform", d => { const p = proj([d.lon, d.lat]); return `translate(${p[0]},${p[1]})`; });
    waypoints.append("circle").attr("r", 3).attr("fill", T.dotFill).attr("stroke", T.ghost).attr("stroke-width", 1.4);
    waypoints.append("title").text(d => d.name);
    const routeG = svg.append("g");
    if (T.glow) routeG.style("filter", `drop-shadow(0 0 6px ${T.glow})`);
    const legs = legD.map(d => {
      const el = routeG.append("path").attr("d", d).attr("fill", "none").attr("stroke", T.route).attr("stroke-width", 3.5).attr("stroke-linecap", "round").node();
      const len = el.getTotalLength();
      el.style.strokeDasharray = len; el.style.strokeDashoffset = len;
      return { el, len };
    });
    const traveler = routeG.append("circle").attr("r", T.here ? 5.5 : 6).attr("fill", T.route).attr("stroke", T.here ? T.dotFill : "none").attr("stroke-width", 2).attr("opacity", 0);
    const here = T.here ? routeG.insert("circle", "circle").attr("r", 6).attr("fill", "none").attr("stroke", T.route).attr("stroke-width", 1.5).attr("opacity", 0) : null;
    if (here) {
      here.append("animate").attr("attributeName", "r").attr("values", "6;15").attr("dur", "2.4s").attr("repeatCount", "indefinite");
      here.append("animate").attr("attributeName", "stroke-opacity").attr("values", "0.6;0").attr("dur", "2.4s").attr("repeatCount", "indefinite");
    }
    const markers = stops.map((s, i) => {
      const g = svg.append("g").attr("class", "map-stop").attr("transform", `translate(${pts[i][0]},${pts[i][1]})`).on("click", () => onStopClick(i));
      g.append("circle").attr("r", 22).attr("fill", "transparent");
      const ring = g.append("circle").attr("r", 13).attr("fill", "none").attr("stroke", T.route).attr("stroke-width", 1.5).attr("opacity", 0);
      const dot = g.append("circle").attr("r", 6.5).attr("fill", T.dotFill).attr("stroke", T.dotStroke).attr("stroke-width", 2);
      const label = g.append("text").attr("x", s.label.dx).attr("y", s.label.dy).attr("text-anchor", s.label.anchor)
        .attr("font-family", "IBM Plex Mono, monospace").attr("font-size", 15).attr("letter-spacing", "0.06em").attr("fill", T.label)
        .text(`${s.num} ${s.mapName || s.name}`);
      return { ring, dot, label };
    });
    return {
      update(prog, active) {
        let head = null;
        legs.forEach((l, i) => {
          l.el.style.strokeDashoffset = l.len * (1 - prog[i]);
          if (prog[i] > 0 && prog[i] < 1) head = l.el.getPointAtLength(l.len * prog[i]);
        });
        if (head) traveler.attr("cx", head.x).attr("cy", head.y).attr("opacity", 1); else traveler.attr("opacity", 0);
        if (here) { if (head) here.attr("cx", head.x).attr("cy", head.y).attr("opacity", 1); else here.attr("opacity", 0); }
        markers.forEach((m, i) => {
          const visited = active >= 0 && i <= active;
          m.dot.attr("fill", visited ? T.route : T.dotFill).attr("stroke", visited ? T.route : T.dotStroke);
          m.ring.attr("opacity", i === active ? 1 : 0);
          m.label.attr("fill", i === active ? T.labelActive : T.label).attr("font-weight", i === active ? 600 : 400);
        });
      }
    };
  }

  // ---------- Scroll ----------
  async function init(opts) {
    buildLightbox();
    const secs = [...document.querySelectorAll("[data-stop-section]")];
    const set = (sel, v) => document.querySelectorAll(sel).forEach(el => (el.textContent = v));
    const scrollToStop = i => {
      const mapCol = document.querySelector(opts.mapCol || "#map");
      const offset = window.innerWidth < 960 ? mapCol.getBoundingClientRect().height + 8 : 24;
      window.scrollTo({ top: secs[i].getBoundingClientRect().top + window.scrollY - offset + 2, behavior: "smooth" });
    };
    const map = await drawMap(document.querySelector(opts.map), opts.theme, scrollToStop);
    let lastActive = -2;
    function tick() {
      const mid = window.innerHeight * 0.55;
      let active = -1;
      const prog = secs.map((s, i) => {
        const r = s.getBoundingClientRect();
        if (r.top < mid) active = i;
        return Math.max(0, Math.min(1, (mid - r.top) / r.height));
      });
      map.update(prog, active);
      if (opts.onTick) opts.onTick(prog, active);
      if (active !== lastActive) {
        lastActive = active;
        const s = stops[Math.max(active, 0)];
        set("[data-readout-num]", active < 0 ? "—" : s.num);
        set("[data-readout-name]", active < 0 ? opts.startLabel || "Scroll to begin" : s.name);
        set("[data-readout-state]", active < 0 ? `${stops.length} chapters · ${D.photos.length} photographs` : `${s.state} · Chapter ${s.num} of ${pad(stops.length)}`);
      }
    }
    let raf = 0;
    const onScroll = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(tick); };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    tick();
  }

  window.FoliageApp = { D, stops, byId, esc, pad, media, text, meta, initLightbox: buildLightbox, init, drawMap, legMiles, mileAt, totalMiles, estimated, photosFor: id => D.photos.filter(p => p.stop === id) };
})();
