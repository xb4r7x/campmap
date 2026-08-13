const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const PBKDF2_ITERATIONS = 250000;
const POINT_LAYER = 'campsites';

let allFeatures = null;
let activeCategories = new Set();

const map = new maplibregl.Map({
  container: 'map',
  style: MAP_STYLE,
  center: [-98.5, 39.5],
  zoom: 3.5,
});

fetch('points.json')
  .then((r) => {
    if (!r.ok) throw new Error('no plaintext data');
    return r.json();
  })
  .then(renderData)
  .catch(() => showGate());

function showGate() {
  const gate = document.getElementById('gate');
  gate.classList.add('visible');
  document.getElementById('password').focus();
  document.getElementById('unlock-form').addEventListener('submit', (e) => {
    e.preventDefault();
    unlock();
  });
}

async function unlock() {
  const password = document.getElementById('password').value;
  const status = document.getElementById('gate-status');
  if (!password) return;
  status.textContent = '';
  try {
    const resp = await fetch('points.json.enc');
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const buf = await resp.arrayBuffer();
    const geojson = await decryptData(buf, password);
    renderData(geojson);
    document.getElementById('gate').classList.remove('visible');
    document.getElementById('password').value = '';
  } catch (err) {
    status.textContent = 'Wrong password, or data failed to load.';
    console.error(err);
  }
}

async function decryptData(buffer, password) {
  const salt = new Uint8Array(buffer.slice(0, 16));
  const iv = new Uint8Array(buffer.slice(16, 28));
  const ciphertext = new Uint8Array(buffer.slice(28));

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  );
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);

  const inflated = new Response(plaintext).body.pipeThrough(new DecompressionStream('gzip'));
  const text = await new Response(inflated).text();
  return JSON.parse(text);
}

function renderData(geojson) {
  if (!map.loaded()) {
    map.once('load', () => renderData(geojson));
    return;
  }

  map.addSource('campsites', {
    type: 'geojson',
    data: geojson,
    cluster: true,
    clusterMaxZoom: 13,
    clusterRadius: 50,
  });

  map.addLayer({
    id: 'clusters',
    type: 'circle',
    source: 'campsites',
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': [
        'step',
        ['get', 'point_count'],
        '#51bbd6',
        10,
        '#f1f075',
        100,
        '#f28cb1',
      ],
      'circle-radius': ['step', ['get', 'point_count'], 20, 10, 30, 100, 40],
    },
  });

  map.addLayer({
    id: 'cluster-count',
    type: 'symbol',
    source: 'campsites',
    filter: ['has', 'point_count'],
    layout: {
      'text-field': ['get', 'point_count_abbreviated'],
      'text-size': 12,
    },
    paint: { 'text-color': '#fff' },
  });

  map.addLayer({
    id: POINT_LAYER,
    type: 'circle',
    source: 'campsites',
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-radius': 6,
      'circle-color': '#2c7a4b',
      'circle-stroke-width': 1,
      'circle-stroke-color': '#fff',
    },
  });

  const bounds = new maplibregl.LngLatBounds();
  geojson.features.forEach((f) => bounds.extend(f.geometry.coordinates));
  map.fitBounds(bounds, { padding: 30, maxZoom: 6 });

  document.getElementById('count').textContent =
    `${geojson.features.length.toLocaleString()} campgrounds`;

  allFeatures = geojson.features;
  buildFilters();
  applyFilters();

  map.on('click', 'clusters', (e) => {
    const feature = e.features[0];
    const clusterId = feature.properties.cluster_id;
    map.getSource('campsites').getClusterExpansionZoom(clusterId, (err, zoom) => {
      if (err) return;
      map.easeTo({ center: feature.geometry.coordinates, zoom });
    });
  });

  map.on('click', POINT_LAYER, (e) => {
    const f = e.features[0];
    new maplibregl.Popup({ offset: 16 })
      .setLngLat(f.geometry.coordinates)
      .setHTML(popupHtml(f.properties))
      .addTo(map);
  });

  map.on('mouseenter', 'clusters', () => {
    map.getCanvas().style.cursor = 'pointer';
  });
  map.on('mouseleave', 'clusters', () => {
    map.getCanvas().style.cursor = '';
  });
  map.on('mouseenter', POINT_LAYER, () => {
    map.getCanvas().style.cursor = 'pointer';
  });
  map.on('mouseleave', POINT_LAYER, () => {
    map.getCanvas().style.cursor = '';
  });
}

function buildFilters() {
  const categories = [...new Set(allFeatures.map((f) => f.properties.category))].sort();
  const list = document.getElementById('filter-list');
  list.innerHTML = '';
  activeCategories = new Set(categories);

  categories.forEach((cat) => {
    const label = document.createElement('label');
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = true;
    box.dataset.category = cat;
    box.addEventListener('change', () => {
      if (box.checked) activeCategories.add(cat);
      else activeCategories.delete(cat);
      applyFilters();
    });
    label.appendChild(box);
    label.appendChild(document.createTextNode(` ${cat}`));
    list.appendChild(label);
  });

  document.getElementById('filter-all').addEventListener('click', (e) => {
    e.preventDefault();
    list.querySelectorAll('input').forEach((b) => {
      b.checked = true;
      activeCategories.add(b.dataset.category);
    });
    applyFilters();
  });
  document.getElementById('filter-none').addEventListener('click', (e) => {
    e.preventDefault();
    list.querySelectorAll('input').forEach((b) => {
      b.checked = false;
    });
    activeCategories.clear();
    applyFilters();
  });

  document.getElementById('filters').classList.add('visible');
}

function applyFilters() {
  const filtered = allFeatures.filter((f) => activeCategories.has(f.properties.category));
  map.getSource('campsites').setData({ type: 'FeatureCollection', features: filtered });
  document.getElementById('count').textContent =
    `${filtered.length.toLocaleString()} campgrounds`;
}

function popupHtml(p) {
  const rows = [
    ['Category', p.category],
    ['Price', p.price ? `$${p.price}/night` : null],
    ['Rating', p.rating ? `${p.rating}★` : null],
  ].filter(([, v]) => v);
  return (
    `<h3>${escapeHtml(p.name)}</h3>` +
    (p.location ? `<p class="meta">${escapeHtml(p.location)}</p>` : '') +
    `<p>${escapeHtml(p.description || '')}</p>` +
    rows.map(([k, v]) => `<p class="meta"><strong>${k}:</strong> ${escapeHtml(String(v))}</p>`).join('')
  );
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));
}
