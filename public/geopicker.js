/* photo-tools — map-based GPS picker.
 *
 * Lazy-loads vendored Leaflet (~165KB js+css) on first open so users who
 * never touch the GPS field don't pay for it, and offline visitors who
 * never reach the network can still type lat/lon manually.
 *
 * Tile source: AutoNavi/Gaode (高德地图). Reasons:
 *   - tile.openstreetmap.org is firewalled in mainland China → would render
 *     a totally blank map for users there. This tool's primary user is in
 *     China; falling back to OSM is not an option.
 *   - Gaode renders tiles on the WGS-84 Web Mercator tile pyramid but the
 *     painted *content* is in GCJ-02 ("Mars coordinates", a state-mandated
 *     obfuscated CRS that offsets reality by 50–500 m within China). EXIF
 *     GPS is WGS-84. So we transform at the Leaflet boundary: any WGS-84
 *     coord we hand to Leaflet (setView, marker.setLatLng) gets wgs2gcj'd
 *     first; anything Leaflet emits (click, marker drag) gets gcj2wgs'd
 *     before we store it. Outside the China bounding box the conversion
 *     is a no-op, so non-Chinese users see no shift.
 *
 * GeoPicker.open({ initialLat, initialLng }) → Promise<{lat,lng}|null>
 */
(function () {
  'use strict';

  // ─── GCJ-02 ↔ WGS-84 conversion ──────────────────────────────────────
  // Standard Krasovsky-1940 ellipsoid offset, derivation per the openly
  // documented "evil transform" reverse engineering of GCJ-02. Returns the
  // input unchanged outside the China bounding box — including HK, Macau,
  // Taiwan (whose tile content GCJ-02 leaves un-shifted).
  const KRASOV_A = 6378245.0;
  const KRASOV_EE = 0.00669342162296594323;

  function outOfChina(lat, lng) {
    return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271;
  }
  function tLat(x, y) {
    let r = -100 + 2 * x + 3 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
    r += (20 * Math.sin(6 * x * Math.PI) + 20 * Math.sin(2 * x * Math.PI)) * 2 / 3;
    r += (20 * Math.sin(y * Math.PI) + 40 * Math.sin(y / 3 * Math.PI)) * 2 / 3;
    r += (160 * Math.sin(y / 12 * Math.PI) + 320 * Math.sin(y * Math.PI / 30)) * 2 / 3;
    return r;
  }
  function tLng(x, y) {
    let r = 300 + x + 2 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
    r += (20 * Math.sin(6 * x * Math.PI) + 20 * Math.sin(2 * x * Math.PI)) * 2 / 3;
    r += (20 * Math.sin(x * Math.PI) + 40 * Math.sin(x / 3 * Math.PI)) * 2 / 3;
    r += (150 * Math.sin(x / 12 * Math.PI) + 300 * Math.sin(x / 30 * Math.PI)) * 2 / 3;
    return r;
  }
  function wgs2gcj(lat, lng) {
    if (outOfChina(lat, lng)) return [lat, lng];
    let dLat = tLat(lng - 105, lat - 35);
    let dLng = tLng(lng - 105, lat - 35);
    const radLat = lat / 180 * Math.PI;
    let m = Math.sin(radLat);
    m = 1 - KRASOV_EE * m * m;
    const sqM = Math.sqrt(m);
    dLat = (dLat * 180) / ((KRASOV_A * (1 - KRASOV_EE)) / (m * sqM) * Math.PI);
    dLng = (dLng * 180) / (KRASOV_A / sqM * Math.cos(radLat) * Math.PI);
    return [lat + dLat, lng + dLng];
  }
  // Iterative inverse — closed form doesn't exist; 5 fixed-point iterations
  // converges to sub-meter accuracy across the China bbox.
  function gcj2wgs(gcjLat, gcjLng) {
    if (outOfChina(gcjLat, gcjLng)) return [gcjLat, gcjLng];
    let lat = gcjLat, lng = gcjLng;
    for (let i = 0; i < 5; i++) {
      const [tlat, tlng] = wgs2gcj(lat, lng);
      lat = gcjLat - (tlat - lat);
      lng = gcjLng - (tlng - lng);
    }
    return [lat, lng];
  }

  let leafletReady = null;
  let mapInstance = null;
  let tileLayer = null;
  let pinMarker = null;
  let currentLat = null;     // always WGS-84
  let currentLng = null;
  let pendingResolve = null;

  function ensureLeaflet() {
    if (leafletReady) return leafletReady;
    if (typeof window.L !== 'undefined') {
      leafletReady = Promise.resolve(window.L);
      return leafletReady;
    }
    leafletReady = new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'vendor/leaflet.css';
      document.head.appendChild(link);
      const s = document.createElement('script');
      s.src = 'vendor/leaflet.js';
      s.async = true;
      s.onload = () => {
        if (typeof window.L !== 'undefined') resolve(window.L);
        else reject(new Error('Leaflet loaded but global missing'));
      };
      s.onerror = () => reject(new Error('Leaflet load failed'));
      document.head.appendChild(s);
    });
    leafletReady.catch(() => { leafletReady = null; });
    return leafletReady;
  }

  function fmt(n) {
    return (n == null || !isFinite(n)) ? '—' : Number(n).toFixed(6);
  }
  function updateReadout() {
    const el = document.getElementById('geo-readout');
    if (!el) return;
    if (currentLat == null || currentLng == null) el.textContent = '—';
    else el.textContent = fmt(currentLat) + ' · ' + fmt(currentLng);
  }

  // setPin takes WGS-84 input and stores it as the canonical lat/lng we
  // hand back to the caller. For the Leaflet pin position we go through
  // wgs2gcj because the GCJ-02 tile plate visually offsets China content.
  function setPin(L, wgsLat, wgsLng, fly) {
    currentLat = wgsLat;
    currentLng = wgsLng;
    const [vLat, vLng] = wgs2gcj(wgsLat, wgsLng);
    if (!pinMarker) {
      const icon = L.divIcon({
        className: 'geo-pin',
        html: '<span class="geo-pin-dot"></span>',
        iconSize: [24, 32],
        iconAnchor: [12, 30]
      });
      pinMarker = L.marker([vLat, vLng], { icon, draggable: true }).addTo(mapInstance);
      pinMarker.on('drag', (e) => {
        const ll = e.target.getLatLng();
        const [wLat, wLng] = gcj2wgs(ll.lat, ll.lng);
        currentLat = wLat;
        currentLng = wLng;
        updateReadout();
      });
    } else {
      pinMarker.setLatLng([vLat, vLng]);
    }
    if (fly) {
      const z = Math.max(mapInstance.getZoom() || 0, 13);
      mapInstance.setView([vLat, vLng], z);
    }
    updateReadout();
  }

  function ensureMap(L, initialLat, initialLng) {
    const container = document.getElementById('geo-map');
    if (!container) throw new Error('geo-map element missing');
    if (!mapInstance) {
      mapInstance = L.map(container, { zoomControl: true });
      // wgs2gcj on the seed view too, so the initial pin (if any) lands on
      // the correct visual landmark on the GCJ-02 tile plate.
      const seedLat = (initialLat != null) ? initialLat : 20;
      const seedLng = (initialLng != null) ? initialLng : 0;
      const [vSeedLat, vSeedLng] = wgs2gcj(seedLat, seedLng);
      const startZ = (initialLat != null) ? 13 : 2;
      mapInstance.setView([vSeedLat, vSeedLng], startZ);
      // Gaode/AutoNavi raster base map. Subdomain 1–4. style=7 is the full
      // road map with labels (style=8 would be a transparent overlay only).
      // lang=zh_cn yields Chinese labels.
      tileLayer = L.tileLayer(
        'https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=7&x={x}&y={y}&z={z}',
        {
          attribution: '&copy; <a href="https://amap.com/" target="_blank" rel="noopener">AutoNavi 高德地图</a>',
          subdomains: '1234',
          maxZoom: 18
        }
      ).addTo(mapInstance);
      // Click → Leaflet emits the lat/lng of the screen pixel as if the
      // tiles were WGS-84. They aren't (they're GCJ-02 within China), so
      // gcj2wgs the click coord before storing it.
      mapInstance.on('click', (e) => {
        const [wLat, wLng] = gcj2wgs(e.latlng.lat, e.latlng.lng);
        setPin(L, wLat, wLng, false);
      });
    }
    if (initialLat != null && initialLng != null) {
      setPin(L, initialLat, initialLng, true);
    } else {
      if (pinMarker) {
        mapInstance.removeLayer(pinMarker);
        pinMarker = null;
      }
      currentLat = null;
      currentLng = null;
      updateReadout();
      mapInstance.setView([20, 0], 2);
    }
    // Dialog reflow: invalidateSize once the dialog has settled to its
    // resting geometry. Leaflet calculates tile bounds from container size,
    // and a stale zero-size layout prevents tiles from loading.
    setTimeout(() => mapInstance.invalidateSize(), 60);
  }

  function locateMe() {
    if (!navigator.geolocation) return;
    const btn = document.getElementById('geo-locate');
    if (btn) btn.disabled = true;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (btn) btn.disabled = false;
        ensureLeaflet().then((L) => setPin(L, pos.coords.latitude, pos.coords.longitude, true));
      },
      () => { if (btn) btn.disabled = false; /* permission denied — silent */ },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
    );
  }

  function showError(msg) {
    const el = document.getElementById('geo-error');
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
  }
  function hideError() {
    const el = document.getElementById('geo-error');
    if (el) el.hidden = true;
  }
  function setLoading(on) {
    const el = document.getElementById('geo-loading');
    if (el) el.hidden = !on;
  }

  function close(value) {
    const dlg = document.getElementById('geo-modal');
    if (dlg && dlg.open) dlg.close();
    if (pendingResolve) {
      pendingResolve(value);
      pendingResolve = null;
    }
  }

  async function open(opts) {
    opts = opts || {};
    const dlg = document.getElementById('geo-modal');
    if (!dlg) throw new Error('geo-modal element missing');
    hideError();
    setLoading(true);
    if (!dlg.open) dlg.showModal();

    let L;
    try {
      L = await ensureLeaflet();
    } catch (err) {
      setLoading(false);
      const offlineMsg = (window.I18N && window.I18N.t)
        ? window.I18N.t('geo.offline')
        : 'Could not load map. Type latitude/longitude above instead.';
      showError(offlineMsg);
      return new Promise((resolve) => { pendingResolve = resolve; });
    }
    setLoading(false);
    ensureMap(L, opts.initialLat == null ? null : Number(opts.initialLat),
                  opts.initialLng == null ? null : Number(opts.initialLng));

    return new Promise((resolve) => { pendingResolve = resolve; });
  }

  function init() {
    const confirmBtn = document.getElementById('geo-confirm');
    const cancelBtn = document.getElementById('geo-cancel');
    const closeBtn = document.getElementById('geo-close');
    const locateBtn = document.getElementById('geo-locate');
    const dlg = document.getElementById('geo-modal');
    if (confirmBtn) confirmBtn.addEventListener('click', () => {
      if (currentLat == null || currentLng == null) close(null);
      else close({ lat: currentLat, lng: currentLng });
    });
    if (cancelBtn) cancelBtn.addEventListener('click', () => close(null));
    if (closeBtn) closeBtn.addEventListener('click', () => close(null));
    if (locateBtn) locateBtn.addEventListener('click', locateMe);
    if (dlg) {
      // Esc / backdrop dismissal — ::backdrop click isn't auto-closing,
      // mimic crop-modal's pattern by listening to the native cancel event.
      dlg.addEventListener('cancel', () => {
        if (pendingResolve) { pendingResolve(null); pendingResolve = null; }
      });
      // Click-outside on the dialog element itself (showModal centers a
      // ::backdrop pseudo-element, but clicks on the <dialog> outside the
      // inner card still fire here).
      dlg.addEventListener('click', (e) => {
        if (e.target === dlg) close(null);
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.GeoPicker = { open };
})();
