const state = {
  assets: [], visits: [], heroes: {}, counts: {}, revision: 0,
  filter: "all", cluster: null, query: "", mode: "grid", currentId: null, groupLimit: 12,
};

const $ = (selector) => document.querySelector(selector);
const elements = {
  loading: $("#loading"), app: $("#app"), filters: $("#filters"), clusterList: $("#clusterList"),
  gridView: $("#gridView"), gridContent: $("#gridContent"), reviewView: $("#reviewView"),
  pageTitle: $("#pageTitle"), pageSubtitle: $("#pageSubtitle"), search: $("#searchInput"),
  gridMode: $("#gridMode"), reviewMode: $("#reviewMode"), mediaFrame: $("#mediaFrame"),
  reviewCluster: $("#reviewCluster"), reviewCounter: $("#reviewCounter"), stageBadges: $("#stageBadges"),
  captureDate: $("#captureDate"), placeLabel: $("#placeLabel"), placeBasis: $("#placeBasis"),
  sourceKind: $("#sourceKind"), sourceFilename: $("#sourceFilename"), visitSelect: $("#visitSelect"),
  wallpaperButton: $("#wallpaperButton"), heroButton: $("#heroButton"), autoAdvance: $("#autoAdvance"),
  reviewedLabel: $("#reviewedLabel"), progressPercent: $("#progressPercent"), progressBar: $("#progressBar"),
  saveState: $("#saveState"), revisionLabel: $("#revisionLabel"), toast: $("#toast"),
};

const imageObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    const image = entry.target; image.src = image.dataset.src; image.removeAttribute("data-src"); imageObserver.unobserve(image);
  });
}, { root: elements.gridView, rootMargin: "700px 0px" });

const filterDefinitions = [
  ["all", "▦", "All"], ["unreviewed", "○", "Unreviewed"], ["keep", "●", "Keep"],
  ["maybe", "◐", "Maybe"], ["private", "◌", "Private"], ["wallpaper", "★", "Wallpaper"],
  ["hero", "◆", "Place Hero"],
];

function text(tag, value, className) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.textContent = value;
  return node;
}

function statusOf(asset) { return asset.publicationStatus || "unreviewed"; }

function formatDate(value) {
  if (!value) return "Date unknown";
  const match = value.match(/^(\d{4}):(\d{2}):(\d{2})(?: (\d{2}):(\d{2}))?/);
  if (!match) return value;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const day = new Intl.DateTimeFormat(undefined, { year: "numeric", month: "long", day: "numeric" }).format(date);
  return match[4] ? `${day} · ${match[4]}:${match[5]}` : day;
}

function matchesFilter(asset) {
  if (state.filter === "unreviewed" || ["keep", "maybe", "private"].includes(state.filter)) return statusOf(asset) === state.filter;
  if (state.filter === "wallpaper") return asset.wallpaper;
  if (state.filter === "hero") return asset.isHero;
  return true;
}

function filteredAssets({ ignoreCluster = false } = {}) {
  const query = state.query.trim().toLocaleLowerCase();
  return state.assets.filter((asset) => {
    if (!matchesFilter(asset)) return false;
    if (!ignoreCluster && state.cluster && asset.cluster.key !== state.cluster) return false;
    if (query) {
      const haystack = [asset.cluster.label, asset.association.label, asset.filename, asset.captureAt, asset.association.country].filter(Boolean).join(" ").toLocaleLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}

function groupAssets(assets) {
  const groups = new Map();
  assets.forEach((asset) => {
    if (!groups.has(asset.cluster.key)) groups.set(asset.cluster.key, { ...asset.cluster, assets: [] });
    groups.get(asset.cluster.key).assets.push(asset);
  });
  groups.forEach((group) => group.assets.sort((a, b) => (a.captureAt || "9999").localeCompare(b.captureAt || "9999") || a.filename.localeCompare(b.filename)));
  return [...groups.values()].sort((a, b) => a.sort.localeCompare(b.sort));
}

function countForFilter(key) {
  if (key === "all") return state.assets.length;
  if (key === "wallpaper") return state.assets.filter((asset) => asset.wallpaper).length;
  if (key === "hero") return state.assets.filter((asset) => asset.isHero).length;
  return state.assets.filter((asset) => statusOf(asset) === key).length;
}

function renderProgress() {
  const reviewed = state.assets.filter((asset) => asset.publicationStatus).length;
  const percent = Math.round((reviewed / state.assets.length) * 100);
  elements.reviewedLabel.textContent = `${reviewed} of ${state.assets.length} reviewed`;
  elements.progressPercent.textContent = `${percent}%`;
  elements.progressBar.style.width = `${percent}%`;
  elements.revisionLabel.textContent = `Revision ${state.revision}`;
}

function renderFilters() {
  elements.filters.replaceChildren();
  filterDefinitions.forEach(([key, icon, label]) => {
    const button = document.createElement("button");
    button.className = `filter-button${state.filter === key ? " active" : ""}`;
    button.append(text("span", icon, "filter-icon"), text("span", label), text("span", String(countForFilter(key)), "count"));
    button.addEventListener("click", () => { state.filter = key; state.cluster = null; state.groupLimit = 12; render(); });
    elements.filters.append(button);
  });
}

function renderClusters() {
  elements.clusterList.replaceChildren();
  const groups = groupAssets(filteredAssets({ ignoreCluster: true }));
  groups.forEach((group) => {
    const button = document.createElement("button");
    button.className = `cluster-button${state.cluster === group.key ? " active" : ""}${group.uncertain ? " uncertain" : ""}`;
    button.append(text("span", group.label), text("span", String(group.assets.length), "count"));
    button.title = group.uncertain ? "Suggested association — not editorially confirmed" : group.label;
    button.addEventListener("click", () => { state.cluster = state.cluster === group.key ? null : group.key; state.mode = "grid"; state.groupLimit = 12; render(); });
    elements.clusterList.append(button);
  });
}

function badge(label, className = "") { return text("span", label, `mini-badge ${className}`); }

function openReview(assetId) {
  const asset = state.assets.find((item) => item.id === assetId);
  if (asset) state.cluster = asset.cluster.key;
  state.currentId = assetId;
  state.mode = "review";
  render();
}

function quickAction(asset, action, value, label) {
  const button = text("button", label);
  button.type = "button";
  button.addEventListener("click", async (event) => { event.stopPropagation(); await saveDecision(asset, action, value, false); });
  return button;
}

function photoCard(asset) {
  const card = document.createElement("article");
  card.className = "photo-card"; card.tabIndex = 0; card.dataset.status = statusOf(asset);
  const image = new Image(); image.dataset.src = asset.previewUrl; image.alt = `${asset.association.label}, ${formatDate(asset.captureAt)}`;
  const badges = text("div", "", "card-badges");
  if (asset.wallpaper) badges.append(badge("★", "wallpaper"));
  if (asset.isHero) badges.append(badge("◆", "hero"));
  if (asset.kind === "live_photo") badges.append(badge("LIVE"));
  if (asset.burstCandidate) badges.append(badge("BURST"));
  const actions = text("div", "", "quick-actions");
  actions.append(quickAction(asset, "status", "keep", "Keep"), quickAction(asset, "status", "maybe", "Maybe"), quickAction(asset, "status", "private", "Private"));
  card.append(image, badges, actions);
  imageObserver.observe(image);
  card.addEventListener("click", () => openReview(asset.id));
  card.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openReview(asset.id); } });
  return card;
}

function renderGrid() {
  imageObserver.disconnect();
  elements.gridContent.replaceChildren();
  const allGroups = groupAssets(filteredAssets());
  const groups = state.cluster ? allGroups : allGroups.slice(0, state.groupLimit);
  if (!allGroups.length) {
    elements.gridView.classList.add("empty");
    const empty = text("div", "", "empty-state"); empty.append(text("strong", "Nothing here yet"), text("span", "Try another filter or place."));
    elements.gridContent.append(empty); return;
  }
  elements.gridView.classList.remove("empty");
  groups.forEach((group) => {
    const section = text("section", "", "grid-section");
    const header = text("header", "", "grid-section-header");
    const copy = document.createElement("div"); copy.append(text("h2", group.label), text("p", group.uncertain ? "Suggested association · review before import" : "Confirmed visit association"));
    header.append(copy, text("span", `${group.assets.length} ${group.assets.length === 1 ? "photo" : "photos"}`, "section-count"));
    const grid = text("div", "", "photo-grid"); group.assets.forEach((asset) => grid.append(photoCard(asset)));
    section.append(header, grid); elements.gridContent.append(section);
  });
  if (groups.length < allGroups.length) {
    const more = text("button", `Show more places · ${allGroups.length - groups.length} remaining`, "load-more");
    more.addEventListener("click", () => { state.groupLimit += 12; renderGrid(); });
    elements.gridContent.append(more);
  }
}

function reviewSequence() { return filteredAssets().sort((a, b) => a.cluster.sort.localeCompare(b.cluster.sort) || (a.captureAt || "9999").localeCompare(b.captureAt || "9999")); }

function currentAsset() {
  const sequence = reviewSequence();
  let asset = sequence.find((item) => item.id === state.currentId);
  if (!asset) asset = sequence[0];
  if (asset) state.currentId = asset.id;
  return { asset, sequence, index: asset ? sequence.findIndex((item) => item.id === asset.id) : -1 };
}

function setButtonState(selector, active) { selector.classList.toggle("active", Boolean(active)); }

function renderVisitOptions(asset) {
  const selected = asset.associationOverride?.visitId || "";
  elements.visitSelect.replaceChildren(new Option("Use inferred association", ""));
  state.visits.forEach((visit) => elements.visitSelect.add(new Option(`${visit.chronologyIndex}. ${visit.label} · ${visit.country}`, visit.id, false, visit.id === selected)));
}

function renderReview() {
  const { asset, sequence, index } = currentAsset();
  elements.mediaFrame.replaceChildren(); elements.stageBadges.replaceChildren();
  if (!asset) { elements.mediaFrame.append(text("div", "No photos match this view.", "empty-state")); return; }
  if (asset.videoUrl) {
    const video = document.createElement("video"); video.src = asset.videoUrl; video.controls = true; video.preload = "metadata"; elements.mediaFrame.append(video);
  } else {
    const image = new Image(); image.src = asset.previewUrl; image.alt = `${asset.association.label}, ${formatDate(asset.captureAt)}`; elements.mediaFrame.append(image);
  }
  if (asset.kind === "live_photo") elements.stageBadges.append(text("span", "◉ LIVE PHOTO"));
  if (asset.burstCandidate) elements.stageBadges.append(text("span", "Burst candidate"));
  if (asset.similarCandidate) elements.stageBadges.append(text("span", "Similar-frame candidate"));
  if (asset.association.uncertain) elements.stageBadges.append(text("span", "Association needs review", "uncertain"));
  elements.reviewCluster.textContent = asset.cluster.label;
  elements.reviewCounter.textContent = `${index + 1} of ${sequence.length}`;
  elements.captureDate.textContent = formatDate(asset.captureAt);
  elements.placeLabel.textContent = asset.association.label;
  elements.placeBasis.textContent = `${asset.association.basis}${asset.association.distanceKm != null ? ` · ${asset.association.distanceKm} km` : ""}`;
  elements.sourceKind.textContent = asset.kind === "live_photo" ? "Live Photo" : asset.kind === "standalone_video" ? "Video" : "Still photo";
  elements.sourceFilename.textContent = `${asset.filename}${asset.sourceFiles.length > 1 ? ` · ${asset.sourceFiles.length} paired source files` : ""}`;
  document.querySelectorAll(".decision[data-status]").forEach((button) => setButtonState(button, button.dataset.status === asset.publicationStatus));
  setButtonState(elements.wallpaperButton, asset.wallpaper); elements.wallpaperButton.querySelector("i").textContent = asset.wallpaper ? "★" : "☆";
  setButtonState(elements.heroButton, asset.isHero); elements.heroButton.querySelector("i").textContent = asset.isHero ? "◆" : "◇";
  elements.heroButton.disabled = !asset.cluster.heroEligible;
  elements.heroButton.title = asset.cluster.heroEligible ? "Make this the representative image for this place/visit cluster" : "Assign a place or visit before choosing a hero";
  renderVisitOptions(asset);
}

function renderHeader() {
  const filtered = filteredAssets();
  const selectedGroup = state.cluster ? groupAssets(state.assets).find((group) => group.key === state.cluster) : null;
  const definition = filterDefinitions.find(([key]) => key === state.filter);
  elements.pageTitle.textContent = selectedGroup?.label || definition?.[2] || "All Photos";
  elements.pageSubtitle.textContent = `${filtered.length} logical ${filtered.length === 1 ? "asset" : "assets"}`;
  elements.gridMode.classList.toggle("active", state.mode === "grid"); elements.reviewMode.classList.toggle("active", state.mode === "review");
  elements.gridView.hidden = state.mode !== "grid"; elements.reviewView.hidden = state.mode !== "review";
}

function render() {
  renderProgress(); renderFilters(); renderClusters(); renderHeader();
  if (state.mode === "grid") renderGrid(); else renderReview();
}

let toastTimer;
function toast(message) { elements.toast.textContent = message; elements.toast.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => elements.toast.classList.remove("show"), 1400); }

async function saveDecision(asset, action, value, advance = false, extra = {}) {
  elements.saveState.textContent = "Saving…";
  try {
    const response = await fetch("/api/curation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assetId: asset.id, action, value, ...extra }) });
    const result = await response.json(); if (!response.ok) throw new Error(result.error || "Save failed");
    state.revision = result.revision; state.heroes = result.heroes;
    const index = state.assets.findIndex((item) => item.id === asset.id); state.assets[index] = result.asset;
    if (action === "association") state.cluster = result.asset.cluster.key;
    if (action === "hero") {
      const heroId = state.heroes[extra.scopeKey]?.assetId;
      state.assets.forEach((item) => { if (item.cluster.key === extra.scopeKey) item.isHero = item.id === heroId; });
    }
    elements.saveState.textContent = "Saved locally";
    if (action === "status") toast(value === "private" ? "Marked Private" : value === "maybe" ? "Saved as Maybe" : "Kept");
    if (action === "wallpaper") toast(value ? "Added to wallpapers" : "Removed from wallpapers");
    if (action === "hero") toast(value ? "Place hero selected" : "Place hero removed");
    if (action === "association") toast(extra.visitId ? "Visit corrected" : "Using inferred association");
    if (advance && elements.autoAdvance.checked) move(1, false); else render();
  } catch (error) { elements.saveState.textContent = "Save failed"; toast(error.message); }
}

function move(direction, wrap = true) {
  const { sequence, index } = currentAsset(); if (!sequence.length) return;
  let next = index + direction;
  if (wrap) next = (next + sequence.length) % sequence.length;
  else next = Math.max(0, Math.min(sequence.length - 1, next));
  state.currentId = sequence[next].id; renderReview();
}

function bindEvents() {
  elements.search.addEventListener("input", () => { state.query = elements.search.value; state.groupLimit = 12; render(); });
  elements.gridMode.addEventListener("click", () => { state.mode = "grid"; render(); });
  elements.reviewMode.addEventListener("click", () => { state.mode = "review"; render(); });
  $("#backToGrid").addEventListener("click", () => { state.mode = "grid"; render(); });
  $("#previousPhoto").addEventListener("click", () => move(-1)); $("#nextPhoto").addEventListener("click", () => move(1));
  document.querySelectorAll(".decision[data-status]").forEach((button) => button.addEventListener("click", () => { const { asset } = currentAsset(); if (asset) saveDecision(asset, "status", button.dataset.status, true); }));
  elements.wallpaperButton.addEventListener("click", () => { const { asset } = currentAsset(); if (asset) saveDecision(asset, "wallpaper", !asset.wallpaper); });
  elements.heroButton.addEventListener("click", () => { const { asset } = currentAsset(); if (asset && asset.cluster.heroEligible) saveDecision(asset, "hero", !asset.isHero, false, { scopeKey: asset.cluster.key, scopeLabel: asset.cluster.label }); });
  elements.visitSelect.addEventListener("change", () => { const { asset } = currentAsset(); if (asset) saveDecision(asset, "association", null, false, { visitId: elements.visitSelect.value || null }); });
  $("#shortcutButton").addEventListener("click", () => $("#shortcutsDialog").showModal());
  $("#collapseSidebar").addEventListener("click", () => $("#sidebar").classList.remove("open"));
  $("#showSidebar").addEventListener("click", () => $("#sidebar").classList.add("open"));
  document.addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey || ["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement?.tagName) || $("#shortcutsDialog").open) return;
    if (state.mode !== "review") { if (event.key.toLowerCase() === "r" && filteredAssets().length) { state.mode = "review"; render(); } return; }
    const { asset } = currentAsset(); if (!asset) return;
    const key = event.key.toLowerCase();
    if (["1", "2", "3", "w", "h", "arrowleft", "arrowright", "g", "escape"].includes(key)) event.preventDefault();
    if (key === "1") saveDecision(asset, "status", "keep", true);
    else if (key === "2") saveDecision(asset, "status", "maybe", true);
    else if (key === "3") saveDecision(asset, "status", "private", true);
    else if (key === "w") saveDecision(asset, "wallpaper", !asset.wallpaper);
    else if (key === "h" && asset.cluster.heroEligible) saveDecision(asset, "hero", !asset.isHero, false, { scopeKey: asset.cluster.key, scopeLabel: asset.cluster.label });
    else if (key === "arrowleft") move(-1); else if (key === "arrowright") move(1);
    else if (key === "g" || key === "escape") { state.mode = "grid"; render(); }
  });
}

async function initialize() {
  const response = await fetch("/api/state"); if (!response.ok) throw new Error("Could not load the private photo inventory");
  const data = await response.json(); Object.assign(state, { assets: data.assets, visits: data.visits, heroes: data.heroes, counts: data.counts, revision: data.revision });
  bindEvents(); render(); elements.loading.hidden = true; elements.app.hidden = false;
}

initialize().catch((error) => { elements.loading.innerHTML = `<p>${error.message}</p><p>Run the tool from the repository with <code>npm run photos:curate</code>.</p>`; });
