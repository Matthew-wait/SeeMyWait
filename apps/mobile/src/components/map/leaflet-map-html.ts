/**
 * Self-contained HTML page: Leaflet + OSM tiles + marker clustering, used
 * identically by the native WebView (iOS/Android) and the web iframe
 * (MapView.tsx / MapView.web.tsx) — one implementation, same behavior on
 * every platform, matching the web app's Leaflet+OSM setup instead of
 * native MapKit/Google Maps SDK.
 *
 * Communication is a small postMessage protocol (see RnToMapMessage /
 * MapToRnMessage below) rather than passing React props, since this runs
 * inside an isolated page context on native.
 *
 * Pin look, clustering radius and stacking match the web map
 * (apps/web/src/lib/clinic-pin-layer.ts): the same teardrop pin artwork,
 * numbered dark cluster bubbles, and a count badge on pins that stand in
 * for 2+ offices at the same spot (tapping one opens a picker).
 */

export type MapClinicPoint = {
  id: string;
  lat: number;
  lng: number;
  name: string;
  address: string;
  pin: string;
};

export type MapBounds = { north: number; south: number; east: number; west: number };

export type RnToMapMessage =
  | { type: 'setClinics'; clinics: MapClinicPoint[] }
  | { type: 'setUserLocation'; location: { lat: number; lng: number } | null }
  | { type: 'setSearchArea'; area: { lat: number; lng: number; radiusMeters: number } | null }
  | { type: 'setNearbyRadius'; radiusMeters: number }
  | { type: 'setCandidate'; candidate: { lat: number; lng: number } | null }
  | { type: 'setFocus'; focus: { lat: number; lng: number; color: string } | null }
  | { type: 'setRoute'; geometry: [number, number][] | null }
  | { type: 'centerOn'; location: { lat: number; lng: number }; zoom?: number }
  | { type: 'fitToClinics' }
  | { type: 'zoomIn' }
  | { type: 'zoomOut' };

export type MapToRnMessage =
  | { type: 'ready' }
  | { type: 'clinicPress'; id: string }
  | { type: 'stackPress'; ids: string[] }
  | { type: 'boundsChanged'; bounds: MapBounds }
  | { type: 'mapPress'; lat: number; lng: number };

const OSM_TILE_URL_TEMPLATE = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

export function buildLeafletMapHtml(): string {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css" />
<style>
  html, body, #map { height: 100%; margin: 0; padding: 0; background: #e5e7eb; }
  .smw-pin-wrap { position: relative; width: 36px; height: 48px; filter: drop-shadow(0 2px 2px rgba(15,23,42,0.28)); }
  .smw-pin-wrap svg { display: block; }
  .smw-badge { position: absolute; left: 20px; top: -5px; min-width: 18px; height: 18px; box-sizing: border-box;
    padding: 0 4px; border-radius: 9px; background: #1e293b; color: #fff; border: 1.5px solid #fff;
    font: 700 9px/15px system-ui, -apple-system, 'Segoe UI', sans-serif; text-align: center; white-space: nowrap; }
  .smw-candidate { width: 22px; height: 22px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg);
    border: 2.5px solid #fff; background: #2563eb; box-shadow: 0 2px 4px rgba(15,23,42,0.45); }
  .smw-cluster { display:flex; align-items:center; justify-content:center; border-radius: 50%;
    background: #1e293b; color: #fff; font: 700 11px system-ui, -apple-system, 'Segoe UI', sans-serif;
    border: 2px solid rgba(255,255,255,0.9); box-shadow: 0 1px 3px rgba(15,23,42,0.3); }
  .leaflet-control-zoom { display: none; }
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script src="https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js"></script>
<script>
(function () {
  var map = L.map('map', { zoomControl: false, attributionControl: false }).setView([25.7617, -80.1918], 11);
  L.tileLayer('${OSM_TILE_URL_TEMPLATE}', { maxZoom: 19 }).addTo(map);

  var clusterGroup = L.markerClusterGroup({
    maxClusterRadius: 50,
    spiderfyOnMaxZoom: false,
    showCoverageOnHover: false,
    iconCreateFunction: function (cluster) {
      var count = cluster.getChildCount();
      var label = count > 999 ? '999+' : String(count);
      var size = Math.min(26 + Math.log(count) * 5, 44);
      return L.divIcon({
        html: '<div class="smw-cluster" style="width:' + size + 'px;height:' + size + 'px;">' + label + '</div>',
        className: '',
        iconSize: [size, size],
      });
    },
  });
  map.addLayer(clusterGroup);

  var userDot = null, searchCircle = null, radiusCircle = null, candidateMarker = null, routeLine = null;
  var clinicMarkers = {};
  var nearbyRadiusMeters = 1609;
  var hasFitOnce = false;

  function post(msg) {
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
      window.ReactNativeWebView.postMessage(JSON.stringify(msg));
    } else if (window.parent) {
      window.parent.postMessage(msg, '*');
    }
  }

  // Same artwork as the web canvas pin (clinic-pin-layer.ts): teardrop + white dot,
  // with an optional count badge when one pin stands for several offices.
  function pinIcon(color, count) {
    var badge = count > 1 ? '<div class="smw-badge">' + (count > 99 ? '99+' : String(count)) + '</div>' : '';
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="48" viewBox="0 0 24 32">'
      + '<path fill="' + color + '" stroke="white" stroke-width="1.5" d="M12 .5C5.9.5 1 5.4 1 11.5c0 8 11 19.5 11 19.5s11-11.5 11-19.5C23 5.4 18.1.5 12 .5z"/>'
      + '<circle cx="12" cy="11.5" r="4.3" fill="white"/></svg>';
    return L.divIcon({
      html: '<div class="smw-pin-wrap">' + svg + badge + '</div>',
      className: '',
      iconSize: [36, 48],
      iconAnchor: [18, 48],
    });
  }

  function reportBounds() {
    var b = map.getBounds();
    post({ type: 'boundsChanged', bounds: { north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() } });
  }

  var clinicList = [];

  // Offices that sit on the same spot on screen (e.g. one building, a few metres
  // apart) are merged into one pin with a count, like web's stack badge; tapping it
  // opens the picker. Grouping is by screen distance (10 px at the current zoom), so
  // it works however close the coordinates are, and it is rebuilt on each zoom.
  function setClinics(clinics) {
    clinicList = clinics;
    buildMarkers();
    if (!hasFitOnce && clinics.length > 1 && !userDot) {
      try {
        map.fitBounds(clusterGroup.getBounds().pad(0.2), { animate: false });
        hasFitOnce = true;
      } catch (e) {}
    }
  }

  function buildMarkers() {
    clusterGroup.clearLayers();
    clinicMarkers = {};
    var zoom = map.getZoom();
    var groups = {};
    clinicList.forEach(function (c) {
      if (!isFinite(c.lat) || !isFinite(c.lng)) return;
      var world = map.project([c.lat, c.lng], zoom);
      var key = Math.floor(world.x / 10) + ':' + Math.floor(world.y / 10);
      (groups[key] = groups[key] || []).push(c);
    });
    Object.keys(groups).forEach(function (key) {
      var group = groups[key];
      var head = group[0];
      var marker = L.marker([head.lat, head.lng], { icon: pinIcon(head.pin, group.length) });
      if (group.length === 1) {
        marker.bindTooltip(head.name, { direction: 'top', offset: [0, -40] });
        marker.on('click', function () { post({ type: 'clinicPress', id: head.id }); });
      } else {
        marker.bindTooltip(group.length + ' doctor offices here', { direction: 'top', offset: [0, -40] });
        marker.on('click', function () { post({ type: 'stackPress', ids: group.map(function (c) { return c.id; }) }); });
      }
      group.forEach(function (c) { clinicMarkers[c.id] = marker; });
      clusterGroup.addLayer(marker);
    });
  }

  function setUserLocation(loc) {
    if (userDot) { map.removeLayer(userDot); userDot = null; }
    if (radiusCircle) { map.removeLayer(radiusCircle); radiusCircle = null; }
    if (!loc) return;
    // Same current-location marker as the web map: a 16px blue dot with a white ring
    // (a pixel-sized circleMarker, so it stays the same size at every zoom), with a
    // faint ring at the admin radius. Styles copied from apps/web MapView.tsx.
    userDot = L.circleMarker([loc.lat, loc.lng], { radius: 8, color: '#ffffff', weight: 3, fillColor: '#0284c7', fillOpacity: 1, interactive: false }).addTo(map);
    if (!searchCircle) {
      radiusCircle = L.circle([loc.lat, loc.lng], { radius: nearbyRadiusMeters, color: '#0284c7', opacity: 0.25, weight: 1.5, fillColor: '#0284c7', fillOpacity: 0.04, interactive: false }).addTo(map);
    }
  }

  function setSearchArea(area) {
    if (searchCircle) { map.removeLayer(searchCircle); searchCircle = null; }
    if (radiusCircle) { map.removeLayer(radiusCircle); radiusCircle = null; }
    if (!area) return;
    searchCircle = L.circle([area.lat, area.lng], { radius: area.radiusMeters, color: 'rgba(59,130,246,0.6)', weight: 2, fillColor: 'rgba(59,130,246,0.12)', fillOpacity: 1 }).addTo(map);
    map.flyTo([area.lat, area.lng], Math.max(9, 15 - Math.log2(Math.max(area.radiusMeters, 100) / 400)), { animate: true, duration: 0.45 });
  }

  function setRoute(geometry) {
    if (routeLine) { map.removeLayer(routeLine); routeLine = null; }
    if (!geometry || !geometry.length) return;
    routeLine = L.polyline(geometry, { color: '#2563eb', weight: 5, opacity: 0.85 }).addTo(map);
    try { map.fitBounds(routeLine.getBounds().pad(0.15), { animate: true }); } catch (e) {}
  }

  // Candidate (a result awaiting verification) uses the same pin artwork in web's
  // candidate blue (#2563eb, apps/web MapView CANDIDATE_COLOR), drawn above the rest.
  function setCandidate(candidate) {
    if (candidateMarker) { map.removeLayer(candidateMarker); candidateMarker = null; }
    if (!candidate) return;
    candidateMarker = L.marker([candidate.lat, candidate.lng], { icon: pinIcon('#2563eb', 1), zIndexOffset: 1000, keyboard: false }).addTo(map);
    map.setView([candidate.lat, candidate.lng], 16);
  }

  // Focused search result (a saved office): its pin in its wait colour, and the view
  // moved so the pin sits above the bottom card — the same as web's focusedPlace effect
  // (setView 16, then panBy down by min(120, 28% of the map height)).
  var focusMarker = null;
  function setFocus(focus) {
    if (focusMarker) { map.removeLayer(focusMarker); focusMarker = null; }
    if (!focus) return;
    focusMarker = L.marker([focus.lat, focus.lng], { icon: pinIcon(focus.color, 1), zIndexOffset: 1200, keyboard: false }).addTo(map);
    map.setView([focus.lat, focus.lng], 16, { animate: false });
    map.panBy([0, Math.min(120, map.getSize().y * 0.28)], { animate: false });
  }

  map.on('click', function (e) {
    post({ type: 'mapPress', lat: e.latlng.lat, lng: e.latlng.lng });
  });
  map.on('moveend', reportBounds);
  map.on('zoomend', buildMarkers);

  window.addEventListener('message', onMessage);
  document.addEventListener('message', onMessage); // Android WebView dispatches here

  function onMessage(event) {
    var msg;
    try { msg = typeof event.data === 'string' ? JSON.parse(event.data) : event.data; } catch (e) { return; }
    if (!msg || !msg.type) return;
    if (msg.type === 'setClinics') setClinics(msg.clinics || []);
    else if (msg.type === 'setUserLocation') setUserLocation(msg.location);
    else if (msg.type === 'setSearchArea') setSearchArea(msg.area);
    else if (msg.type === 'setNearbyRadius') {
      nearbyRadiusMeters = msg.radiusMeters;
      if (radiusCircle) radiusCircle.setRadius(nearbyRadiusMeters);
    }
    else if (msg.type === 'setCandidate') setCandidate(msg.candidate);
    else if (msg.type === 'setFocus') setFocus(msg.focus);
    else if (msg.type === 'setRoute') setRoute(msg.geometry);
    else if (msg.type === 'centerOn') map.flyTo([msg.location.lat, msg.location.lng], msg.zoom || 16, { animate: true, duration: 0.35 });
    else if (msg.type === 'fitToClinics') {
      try { map.fitBounds(clusterGroup.getBounds().pad(0.2), { animate: true }); } catch (e) {}
    }
    else if (msg.type === 'zoomIn') map.zoomIn();
    else if (msg.type === 'zoomOut') map.zoomOut();
  }

  // The bottom list panel grows/shrinks as offices stream in, which resizes this
  // page. Leaflet only re-measures on a pan, so without this the map looks stuck
  // until the user drags it. Re-measure whenever the container changes size.
  var mapEl = document.getElementById('map');
  var resizeTimer = 0;
  function remeasure() {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(function () { map.invalidateSize({ animate: false }); }, 60);
  }
  if (window.ResizeObserver) new ResizeObserver(remeasure).observe(mapEl);
  window.addEventListener('resize', remeasure);

  post({ type: 'ready' });
  reportBounds();
})();
</script>
</body>
</html>`;
}
