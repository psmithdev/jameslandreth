// Edit this file to update the trip. Stops are drawn on the map in order; the route loops back to the first stop.
// For each stop: date ("Oct 4"), note (Jim's few sentences), milesToNext (actual road miles; leave null to estimate), foliage stage + 3 colors.
// For each photo: put the image path in `file` (e.g. "/images/nea-foliage/01.jpg") and Jim's words in title/caption.
window.FOLIAGE = {
  title: "New England in Fall Color",
  hero: 8,
  favorite: 15, // Jim's favorite photo (position in the list below, 0-based)
  stops: [
    { id: "boston",        name: "Boston",             state: "Massachusetts", lon: -71.06, lat: 42.36, label: { dx: 14, dy: 22, anchor: "start" },
      date: "", note: "", milesToNext: null, foliage: { stage: "Turning", swatches: ["#6E7F3A","#C9A23A","#B5532B"] } },
    { id: "woodstock",     name: "Woodstock",          state: "Vermont",       lon: -72.52, lat: 43.62, label: { dx: -14, dy: 6, anchor: "end" },
      date: "", note: "", milesToNext: null, foliage: { stage: "Near peak", swatches: ["#C9A23A","#D9782A","#A63A22"] } },
    { id: "stowe",         name: "Stowe",              state: "Vermont",       lon: -72.69, lat: 44.47, label: { dx: -14, dy: 6, anchor: "end" },
      date: "", note: "", milesToNext: null, foliage: { stage: "Peak", swatches: ["#E0A526","#D2611F","#9E2A1E"] } },
    { id: "kancamagus",    name: "Kancamagus Highway", state: "New Hampshire", lon: -71.48, lat: 44.00, label: { dx: 14, dy: -10, anchor: "start" },
      date: "", note: "", milesToNext: null, foliage: { stage: "Peak", swatches: ["#E8B030","#C9471E","#8E1F1C"] } },
    { id: "acadia",        name: "Acadia",             state: "Maine",         lon: -68.21, lat: 44.35, label: { dx: -10, dy: -18, anchor: "end" },
      date: "", note: "", milesToNext: null, foliage: { stage: "Past peak", swatches: ["#B5793A","#8E3B22","#5E3A2A"] } },
    { id: "kennebunkport", name: "Kennebunkport",      state: "Maine",         lon: -70.48, lat: 43.36, label: { dx: 14, dy: 6, anchor: "start" },
      date: "", note: "", milesToNext: null, foliage: { stage: "Late color", swatches: ["#A0703A","#7A4A2A","#5A4A3A"] } }
  ],
  photos: [
    { stop: "boston",        orientation: "landscape", file: "", title: "", caption: "", date: "", camera: "" },
    { stop: "boston",        orientation: "portrait",  file: "", title: "", caption: "", date: "", camera: "" },
    { stop: "boston",        orientation: "portrait",  file: "", title: "", caption: "", date: "", camera: "" },
    { stop: "woodstock",     orientation: "landscape", file: "", title: "", caption: "", date: "", camera: "" },
    { stop: "woodstock",     orientation: "landscape", file: "", title: "", caption: "", date: "", camera: "" },
    { stop: "woodstock",     orientation: "portrait",  file: "", title: "", caption: "", date: "", camera: "" },
    { stop: "woodstock",     orientation: "portrait",  file: "", title: "", caption: "", date: "", camera: "" },
    { stop: "stowe",         orientation: "landscape", file: "", title: "", caption: "", date: "", camera: "" },
    { stop: "kancamagus",    orientation: "landscape", file: "", title: "", caption: "", date: "", camera: "" },
    { stop: "stowe",         orientation: "portrait",  file: "", title: "", caption: "", date: "", camera: "" },
    { stop: "stowe",         orientation: "portrait",  file: "", title: "", caption: "", date: "", camera: "" },
    { stop: "stowe",         orientation: "landscape", file: "", title: "", caption: "", date: "", camera: "" },
    { stop: "kancamagus",    orientation: "landscape", file: "", title: "", caption: "", date: "", camera: "" },
    { stop: "kancamagus",    orientation: "portrait",  file: "", title: "", caption: "", date: "", camera: "" },
    { stop: "kancamagus",    orientation: "portrait",  file: "", title: "", caption: "", date: "", camera: "" },
    { stop: "kancamagus",    orientation: "landscape", file: "", title: "", caption: "", date: "", camera: "" },
    { stop: "acadia",        orientation: "landscape", file: "", title: "", caption: "", date: "", camera: "" },
    { stop: "acadia",        orientation: "portrait",  file: "", title: "", caption: "", date: "", camera: "" },
    { stop: "acadia",        orientation: "portrait",  file: "", title: "", caption: "", date: "", camera: "" },
    { stop: "acadia",        orientation: "landscape", file: "", title: "", caption: "", date: "", camera: "" },
    { stop: "kennebunkport", orientation: "landscape", file: "", title: "", caption: "", date: "", camera: "" },
    { stop: "kennebunkport", orientation: "portrait",  file: "", title: "", caption: "", date: "", camera: "" },
    { stop: "kennebunkport", orientation: "portrait",  file: "", title: "", caption: "", date: "", camera: "" }
  ]
};
// Keep photos in trip order: sort by stop order so the slideshow follows the route.
(function () {
  const order = Object.fromEntries(window.FOLIAGE.stops.map((s, i) => [s.id, i]));
  const heroPhoto = window.FOLIAGE.photos[window.FOLIAGE.hero];
  const favPhoto = window.FOLIAGE.photos[window.FOLIAGE.favorite];
  window.FOLIAGE.photos = window.FOLIAGE.photos.map((p, i) => ({ p, i })).sort((a, b) => order[a.p.stop] - order[b.p.stop] || a.i - b.i).map(x => x.p);
  window.FOLIAGE.hero = window.FOLIAGE.photos.indexOf(heroPhoto);
  window.FOLIAGE.favorite = window.FOLIAGE.photos.indexOf(favPhoto);
})();
