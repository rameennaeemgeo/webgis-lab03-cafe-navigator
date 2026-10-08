/* =========================================================
   WebGIS Lab 03 – Islamabad Café Navigator
   Student: Rameen Naeem | 24-ARID-2433
   Stack: Leaflet.js + OpenStreetMap + Geolocation API + OSRM routing
   ========================================================= */

// ---------- 1. Data: five real cafés in Islamabad (edit coordinates here) ----------
const PLACES = [
  { name: "Chaaye Khana", area: "F-6 Markaz, Islamabad", lat: 33.730242, lng: 73.077752 },
  { name: "Street 1 Cafe", area: "Street 10, F-6/3, Islamabad", lat: 33.735476, lng: 73.078221 },
  { name: "Butler's Chocolate Café", area: "F-6 Super Market, Islamabad", lat: 33.731698, lng: 73.078894 },
  { name: "Burning Brownie", area: "Beverly Center, Blue Area, Islamabad", lat: 33.720577, lng: 73.074007 },
  { name: "Loafology", area: "Jinnah Avenue, Blue Area, Islamabad", lat: 33.710866, lng: 73.058561 }
];

// Used only if the browser cannot give us a location (denied / blocked / timeout)
const FALLBACK_START = { lat: 33.7077, lng: 73.0498, label: "Islamabad (demo start)" };

// Routing servers: one OSRM profile per travel mode
const ROUTERS = {
  car:  "https://routing.openstreetmap.de/routed-car/route/v1/driving/",
  bike: "https://routing.openstreetmap.de/routed-bike/route/v1/driving/",
  foot: "https://routing.openstreetmap.de/routed-foot/route/v1/driving/"
};
const OSRM_DEMO = "https://router.project-osrm.org/route/v1/driving/"; // car backup

// ---------- 2. Map + base layers ----------
const map = L.map("map", { zoomControl: false }).setView([33.7294, 73.0931], 12);
L.control.zoom({ position: "topright" }).addTo(map);

const osm = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap contributors"
}).addTo(map);

const dark = L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap contributors &copy; CARTO"
});
L.control.layers({ "OpenStreetMap": osm, "Night view": dark }, null, { position: "topright" }).addTo(map);
L.control.scale({ position: "bottomright" }).addTo(map);

// ---------- 3. State ----------
let userLatLng = null;
let userMarker = null;
let selected = -1;
let mode = "car";
let picking = false;
let routeLayers = [];

const $ = (id) => document.getElementById(id);

// ---------- 4. Markers ----------
const cafeIcon = (active) => L.divIcon({
  className: "",
  html: `<div class="cafe-pin ${active ? "active" : ""}"><span>☕</span></div>`,
  iconSize: [38, 38], iconAnchor: [19, 38], popupAnchor: [0, -38]
});
const youIcon = L.divIcon({ className: "", html: '<div class="you-dot"></div>', iconSize: [18, 18] });

const markers = PLACES.map((p) =>
  L.marker([p.lat, p.lng], { icon: cafeIcon(false), title: p.name })
    .addTo(map)
    .bindPopup(`<b>${p.name}</b><br>${p.area}`)
);
markers.forEach((m, i) => m.on("click", () => selectPlace(i)));

// ---------- 5. Sidebar list ----------
const list = $("placeList");
PLACES.forEach((p, i) => {
  const li = document.createElement("li");
  li.className = "place";
  li.tabIndex = 0;
  li.innerHTML = `<div class="num">${i + 1}</div><div><b>${p.name}</b><span>${p.area}</span></div>`;
  li.addEventListener("click", () => selectPlace(i));
  li.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectPlace(i); } });
  list.appendChild(li);
});

// ---------- 6. Helpers ----------
function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast.id);
  toast.id = setTimeout(() => t.classList.remove("show"), 4200);
}
const fmtDist = (m) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`);
function fmtTime(s) {
  const m = Math.max(1, Math.round(s / 60));
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
}
function arrival(s) {
  return new Date(Date.now() + s * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ---------- 7. Current location (Browser Geolocation API) ----------
function setUser(lat, lng, label) {
  userLatLng = L.latLng(lat, lng);
  if (!userMarker) userMarker = L.marker(userLatLng, { icon: youIcon, zIndexOffset: 1000 }).addTo(map);
  else userMarker.setLatLng(userLatLng);
  userMarker.bindPopup("<b>Your start point</b>");
  $("locStatus").textContent = label;
  if (selected >= 0) selectPlace(selected);
}

function locate() {
  if (!("geolocation" in navigator)) return useFallback("Geolocation is not supported by this browser.");
  $("locStatus").textContent = "Finding your location…";
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude, accuracy } = pos.coords;
      setUser(latitude, longitude, `Live location found (±${Math.round(accuracy)} m)`);
      if (selected < 0) map.setView([latitude, longitude], 13);
    },
    (err) => useFallback(err.code === 1 ? "Location permission denied." : "Could not get your location."),
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
  );
}
function useFallback(reason) {
  toast(`${reason} Using a demo start point – or tap “Pick on map”.`);
  setUser(FALLBACK_START.lat, FALLBACK_START.lng, FALLBACK_START.label);
}

// ---------- 8. Routing (OSRM API) ----------
async function fetchRoute(from, to) {
  const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`;
  const query = "?overview=full&geometries=geojson&steps=true";
  const urls = [ROUTERS[mode] + coords + query];
  if (mode === "car") urls.push(OSRM_DEMO + coords + query);
  for (const url of urls) {
    try {
      const res = await fetch(url);
      const data = await res.json();
      if (data.code === "Ok") return data.routes[0];
    } catch (e) { /* try next server */ }
  }
  throw new Error("Routing service unavailable");
}

function clearRoute() {
  routeLayers.forEach((l) => map.removeLayer(l));
  routeLayers = [];
}

async function selectPlace(i) {
  selected = i;
  const p = PLACES[i];

  [...list.children].forEach((li, k) => li.classList.toggle("active", k === i));
  markers.forEach((m, k) => m.setIcon(cafeIcon(k === i)));
  markers[i].openPopup();
  clearRoute();

  if (!userLatLng) { toast("Waiting for your location…"); return; }

  $("summary").className = "summary empty";
  $("summary").innerHTML = "<p>Calculating route…</p>";
  $("steps").innerHTML = "";

  try {
    const r = await fetchRoute(userLatLng, p);
    if (selected !== i) return; // user clicked another place meanwhile
    drawRoute(r);
    showSummary(r, p);
  } catch (e) {
    $("summary").innerHTML = "<p>Route could not be calculated. Check your internet connection and try again.</p>";
    toast("Routing service unavailable.");
  }
}

function drawRoute(r) {
  const latlngs = r.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
  const casing = L.polyline(latlngs, { color: "#ffffff", weight: 9, opacity: 0.9 }).addTo(map);
  const line = L.polyline(latlngs, { color: "#0a7f8c", weight: 5, className: "route-line" }).addTo(map);
  routeLayers.push(casing, line);
  map.fitBounds(line.getBounds(), { padding: [70, 70] });
}

// ---------- 9. Right sidebar: summary + turn-by-turn ----------
function showSummary(r, p) {
  const s = $("summary");
  s.className = "summary";
  s.innerHTML = `
    <div class="stat wide"><small>Destination</small><div class="big">${p.name}</div></div>
    <div class="stat"><small>Distance</small><div class="big">${fmtDist(r.distance)}</div></div>
    <div class="stat"><small>Travel time</small><div class="big">${fmtTime(r.duration)}</div></div>
    <div class="stat wide" style="background:#fff;color:inherit"><small>Estimated arrival</small><div class="big">${arrival(r.duration)}</div></div>`;

  const steps = r.legs[0].steps.filter((st) => st.distance > 0 || st.maneuver.type === "arrive");
  $("steps").innerHTML = steps.map((st) => {
    const road = st.name ? ` onto <b>${st.name}</b>` : "";
    const m = st.maneuver;
    let txt;
    if (m.type === "depart") txt = `Start${st.name ? " on <b>" + st.name + "</b>" : ""}`;
    else if (m.type === "arrive") txt = `Arrive at <b>${p.name}</b>`;
    else if (m.type === "roundabout" || m.type === "rotary") txt = `Take the roundabout${road}`;
    else txt = `${m.modifier ? "Turn " + m.modifier : "Continue"}${road}`;
    return `<li>${txt} <em>(${fmtDist(st.distance)})</em></li>`;
  }).join("");
}

// ---------- 10. Controls ----------
$("btnLocate").addEventListener("click", locate);

$("btnPick").addEventListener("click", () => {
  picking = !picking;
  $("btnPick").classList.toggle("on", picking);
  document.querySelector(".map-wrap").classList.toggle("picking", picking);
  if (picking) toast("Click anywhere on the map to set your start point.");
});
map.on("click", (e) => {
  if (!picking) return;
  picking = false;
  $("btnPick").classList.remove("on");
  document.querySelector(".map-wrap").classList.remove("picking");
  setUser(e.latlng.lat, e.latlng.lng, "Start point picked on map");
});

$("modes").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  mode = b.dataset.mode;
  [...$("modes").children].forEach((x) => x.classList.toggle("active", x === b));
  if (selected >= 0) selectPlace(selected);
});

// ---------- 11. Start ----------
map.fitBounds(L.latLngBounds(PLACES.map((p) => [p.lat, p.lng])), { padding: [80, 80] });
locate();
