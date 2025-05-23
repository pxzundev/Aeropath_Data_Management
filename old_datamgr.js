/**
 * Parses the runways.csv file and returns a list of unique ICAO codes (column 17).
 * @returns {Promise<string[]>} Promise resolving to an array of unique ICAO codes.
 */
async function getUniqueAerodromeICAOs() {
  const response = await fetch("data/runways.csv");
  const text = await response.text();
  const lines = text.split(/\r?\n/).filter(Boolean);
  const icaoSet = new Set();
  for (let i = 1; i < lines.length; i++) {
    // skip header
    const cols = lines[i].split(",");
    if (cols.length >= 17) {
      const icao = cols[16].trim();
      if (icao) icaoSet.add(icao);
    }
  }
  return Array.from(icaoSet);
}

// Expose for use in main.js or inline script
window.getUniqueAerodromeICAOs = getUniqueAerodromeICAOs;

/**
 * Parses the runways.csv file and returns a mapping of ICAO codes to their runways.
 * @returns {Promise<Object>} Promise resolving to an object: { ICAO: [runway1, runway2, ...], ... }
 */
async function getAerodromeRunways() {
  const response = await fetch("data/runways.csv");
  const text = await response.text();
  const lines = text.split(/\r?\n/).filter(Boolean);
  const aerodromeMap = {};
  for (let i = 1; i < lines.length; i++) {
    // skip header
    const cols = lines[i].split(",");
    if (cols.length >= 17) {
      const icao = cols[16].trim();
      const runway = cols[0].trim();
      if (icao && runway) {
        if (!aerodromeMap[icao]) aerodromeMap[icao] = [];
        if (!aerodromeMap[icao].includes(runway))
          aerodromeMap[icao].push(runway);
      }
    }
  }
  return aerodromeMap;
}
window.getAerodromeRunways = getAerodromeRunways;

/**
 * Plots all runways for the given ICAO code on the map with labels and zooms to bounds.
 * @param {string} icao - ICAO code of the aerodrome
 * @param {object} map - Leaflet map instance
 */
async function plotRunwaysForAerodrome(icao, map) {
  // Remove previous runway markers
  if (window.runwayMarkers && window.runwayMarkers.length) {
    window.runwayMarkers.forEach((m) => map.removeLayer(m));
    window.runwayMarkers = [];
  }
  window.runwayBounds = null;
  if (!icao) return;
  // Fetch and parse runways.csv
  const response = await fetch("data/runways.csv");
  const text = await response.text();
  const lines = text.split(/\r?\n/).filter(Boolean);
  const markers = [];
  const bounds = [];
  for (let i = 1; i < lines.length; i++) {
    // skip header
    const cols = lines[i].split(",");
    if (cols.length >= 17 && cols[16].trim() === icao) {
      // Latitude (WGS84) col 5, Longitude (WGS84) col 6
      const latStr = cols[5].replace("S", "-").replace("N", "").trim();
      const lngStr = cols[6].replace("E", "").replace("W", "-").trim();
      const lat = parseFloat(latStr);
      const lng = parseFloat(lngStr);
      if (!isNaN(lat) && !isNaN(lng)) {
        const smallIcon = L.icon({
          iconUrl:
            "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
          iconSize: [14, 22], // smaller than default
          iconAnchor: [7, 22],
          shadowUrl:
            "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
          shadowSize: [13, 21],
          shadowAnchor: [4, 21],
        });
        const marker = L.marker([lat, lng], { icon: smallIcon }).addTo(map);
        marker
          .bindTooltip(cols[0].trim(), {
            permanent: true,
            direction: "top",
            className: "runway-label",
            offset: [0, -12],
          })
          .openTooltip();
        markers.push(marker);
        bounds.push([lat, lng]);
      }
    }
  }
  window.runwayMarkers = markers;
  if (bounds.length) {
    window.runwayBounds = L.latLngBounds(bounds);
    map.fitBounds(window.runwayBounds, { padding: [20, 20] });
  }
}
window.plotRunwaysForAerodrome = plotRunwaysForAerodrome;
