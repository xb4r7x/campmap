const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

const map = new maplibregl.Map({
  container: 'map',
  style: MAP_STYLE,
  center: [-98.5, 39.5],
  zoom: 3.5,
});

const POINT_LAYER = 'campsites';

map.on('load', () => {
  fetch('points.json')
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then((geojson) => {
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
    })
    .catch((err) => {
      console.error('Failed to load points.json', err);
      document.getElementById('count').textContent = 'Failed to load data';
    });
});

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
