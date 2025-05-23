// Helper: Convert degrees to radians
function toRad(deg) {
  return (deg * Math.PI) / 180;
}
// Helper: Convert radians to degrees
function toDeg(rad) {
  return (rad * 180) / Math.PI;
}
// Helper: Convert feet to meters
function ftToM(ft) {
  return ft * 0.3048;
}

// Add proj4 for coordinate conversion
// <script src="https://cdnjs.cloudflare.com/ajax/libs/proj4js/2.8.0/proj4.js"></script>

// EPSG:4326 (WGS84) and EPSG:2193 (NZTM2000)
const projWGS84 = "EPSG:4326";
const projNZTM = "EPSG:2193";
proj4.defs(
  projNZTM,
  "+proj=tmerc +lat_0=0 +lon_0=173 +k=0.9996 +x_0=1600000 +y_0=10000000 +datum=WGS84 +units=m +no_defs"
);

// Helper: Convert [lat, lng] to [x, y] NZTM
function toXY(lat, lng) {
  return proj4(projWGS84, projNZTM, [lng, lat]);
}
// Helper: Convert [x, y] NZTM to [lat, lng]
function toLatLng(x, y) {
  const [lng, lat] = proj4(projNZTM, projWGS84, [x, y]);
  return [lat, lng];
}

// Calculate bearing from runway threshold to runway end using EPSG:2193 (NZTM)
function calculateRwyBearing(thrLat, thrLng, endLat, endLng) {
  // Convert to x/y (NZTM)
  const thrXY = toXY(thrLat, thrLng);
  const endXY = toXY(endLat, endLng);
  const dx = endXY[0] - thrXY[0];
  const dy = endXY[1] - thrXY[1];
  const bearing = ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360;
  console.log("Runway bearing (deg):", bearing);
  // Set the bearing as the value for the fac input field (to 2 decimal places)
  const facInput = document.getElementById("fac");
  if (facInput) facInput.value = bearing.toFixed(2);
  return bearing;
}

let vssLayerId = "vss-extrusion";

// Add KML export functionality
function vssToKML(vssPoly3D) {
  // vssPoly3D: [leftBase, leftEnd, rightEnd, rightBase, leftBase]
  const [leftBase, leftEnd, rightEnd, rightBase] = vssPoly3D;
  //   const vertexNames = ['Left Base', 'Left End', 'Right End', 'Right Base'];
  const vertexNames = ["", "", "", ""];
  const vertexIcons = [
    "http://maps.google.com/mapfiles/kml/paddle/A.png",
    "http://maps.google.com/mapfiles/kml/paddle/B.png",
    "http://maps.google.com/mapfiles/kml/paddle/C.png",
    "http://maps.google.com/mapfiles/kml/paddle/D.png",
  ];
  // Styles for markers
  const markerStyles = vertexIcons
    .map(
      (icon, i) =>
        `    <Style id="marker${i}">\n      <IconStyle>\n        <Icon>\n          <href>${icon}</href>\n        </Icon>\n      </IconStyle>\n    </Style>`
    )
    .join("\n");
  // Placemark for each vertex
  const vertexPlacemarks = vssPoly3D
    .slice(0, 4)
    .map(
      ([lat, lng, alt], idx) =>
        `    <Placemark>\n      <name>${vertexNames[idx]}</name>\n      <styleUrl>#marker${idx}</styleUrl>\n      <Point>\n        <coordinates>${lng},${lat},${alt}</coordinates>\n        <altitudeMode>absolute</altitudeMode>\n      </Point>\n    </Placemark>`
    )
    .join("\n");
  // Polygon coordinates (no extension to ground)
  const coordinates = vssPoly3D
    .map(([lat, lng, alt]) => `${lng},${lat},${alt}`)
    .join(" ");
  // Polygon style
  const polyStyle = `    <Style id="vssPolyStyle">\n      <LineStyle>\n        <color>ff0000ff</color>\n        <width>2</width>\n      </LineStyle>\n      <PolyStyle>\n        <color>cc0000ff</color>\n      </PolyStyle>\n    </Style>`;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2">\n  <Document>\n${markerStyles}\n${polyStyle}\n    <Placemark>\n      <name>VSS Polygon</name>\n      <styleUrl>#vssPolyStyle</styleUrl>\n      <Polygon>\n        <extrude>0</extrude>\n        <altitudeMode>absolute</altitudeMode>\n        <outerBoundaryIs>\n          <LinearRing>\n            <coordinates>${coordinates}</coordinates>\n          </LinearRing>\n        </outerBoundaryIs>\n      </Polygon>\n    </Placemark>\n${vertexPlacemarks}\n  </Document>\n</kml>`;
}

// Store last VSS polygon for export
let lastVssPoly3D = null;

document.getElementById("vss-form").addEventListener("submit", function (e) {
  e.preventDefault();
  // Get user input values
  const thrLat = parseFloat(document.getElementById("thr-lat").value);
  const thrLng = parseFloat(document.getElementById("thr-lng").value);
  const rwyendLat = parseFloat(document.getElementById("rwyend-lat").value);
  const rwyendLng = parseFloat(document.getElementById("rwyend-lng").value);
  const strip = parseFloat(document.getElementById("strip").value);
  const och = ftToM(parseFloat(document.getElementById("och").value));
  const fac = parseFloat(document.getElementById("fac").value);
  const rwyelev = parseFloat(document.getElementById("rwyelev").value);
  const vpa = parseFloat(document.getElementById("vpa").value);

  // Validate all required numeric fields before proceeding
  const requiredNumeric = [
    thrLat,
    thrLng,
    rwyendLat,
    rwyendLng,
    strip,
    och,
    fac,
    rwyelev,
    vpa,
  ];
  if (requiredNumeric.some((v) => isNaN(v))) {
    // Show modal for missing/invalid fields
    const modalBody = document.getElementById("missingFieldsList");
    if (modalBody) modalBody.innerHTML = "Invalid or missing fields.";
    if (window.bootstrap && document.getElementById("missingFieldsModal")) {
      const modal = new bootstrap.Modal(
        document.getElementById("missingFieldsModal")
      );
      modal.show();
    } else {
      // Use SweetAlert2 for a consistent dialog
      if (!window.Swal) {
        const script = document.createElement("script");
        script.src =
          "https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.all.min.js";
        script.onload = function () {
          Swal.fire({
            icon: "error",
            title: "Form Error",
            text: "Invalid or missing fields.",
            confirmButtonColor: "#0d6efd", // Bootstrap primary
            background: "#fff",
            color: "#212529",
          });
        };
        document.head.appendChild(script);
      } else {
        Swal.fire({
          icon: "error",
          title: "Form Error",
          text: "Invalid or missing fields.",
          confirmButtonColor: "#0d6efd", // Bootstrap primary
          background: "#fff",
          color: "#212529",
        });
      }
    }
    return;
  }

  // Convert all input lat/lng to x/y (NZTM)
  const thrXY = toXY(thrLat, thrLng);
  const rwyendXY = toXY(rwyendLat, rwyendLng);

  // Calculate RWYCL bearing in x/y
  const dx = rwyendXY[0] - thrXY[0];
  const dy = rwyendXY[1] - thrXY[1];
  const rwyclBrngXY = ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360;

  console.log("RWYCL bearing (x/y):", rwyclBrngXY);

  // Calculate left and right splay angles based on FAC offset
  const splayAngle = 8.53076561; // degrees, atan(0.15)
  // Use the value from the offsetangle input field instead of calculating offset
  // WORKAROUND: this is a workaround for the offset angle input field so it's similar to the ILS frame of reference.
  const offset =
    -1 * parseFloat(document.getElementById("offsetangle").value) || 0;
  let leftSplay, rightSplay;
  // If offset is negative, splay with offset should be on the left side of the rwycl when approaching the runway threshold
  if (offset < 0) {
    leftSplay = offset - splayAngle;
    rightSplay = splayAngle;
  } else if (offset > 0) {
    rightSplay = offset + splayAngle;
    leftSplay = -splayAngle;
  } else {
    leftSplay = -splayAngle;
    rightSplay = splayAngle;
  }

  console.log("Left splay:", leftSplay);
  console.log("Right splay:", rightSplay);

  // Use splay angles in radians for geometry
  const leftSplayAngle = toRad(leftSplay);
  const rightSplayAngle = toRad(rightSplay);

  // VSS slope (deg) - use VPA - 1.12 as per ICAO definition
  const vssSlope = vpa - 1.12;
  const vssSlopeRad = toRad(vssSlope);
  // VSS origin: 60m before threshold, OPPOSITE direction of runway
  const vssOriginXY = [
    thrXY[0] - 60 * Math.sin(toRad(rwyclBrngXY)),
    thrXY[1] - 60 * Math.cos(toRad(rwyclBrngXY)),
  ];

  // Calculate length to OCH (horizontal distance)
  const vssLength = och / Math.tan(vssSlopeRad);
  console.log("VSS length:", vssLength);

  // Calculate base points (runway strip, perpendicular to runway centerline at VSS origin)
  const leftBaseXY = [
    vssOriginXY[0] + (strip / 2) * Math.cos(toRad(rwyclBrngXY)),
    vssOriginXY[1] - (strip / 2) * Math.sin(toRad(rwyclBrngXY)),
  ];
  const rightBaseXY = [
    vssOriginXY[0] - (strip / 2) * Math.cos(toRad(rwyclBrngXY)),
    vssOriginXY[1] + (strip / 2) * Math.sin(toRad(rwyclBrngXY)),
  ];

  // Calculate end points (splayed from base corners)
  const leftEndDir = toRad(rwyclBrngXY) + leftSplayAngle;
  const rightEndDir = toRad(rwyclBrngXY) + rightSplayAngle;

  // Calculate hypotenuse length for left splay
  const leftHypotenuse = vssLength / Math.cos(leftSplayAngle);
  const leftEndXY = [
    leftBaseXY[0] - leftHypotenuse * Math.sin(leftEndDir),
    leftBaseXY[1] - leftHypotenuse * Math.cos(leftEndDir),
  ];

  // Calculate hypotenuse length for right splay
  const rightHypotenuse = vssLength / Math.cos(rightSplayAngle);
  const rightEndXY = [
    rightBaseXY[0] - rightHypotenuse * Math.sin(rightEndDir),
    rightBaseXY[1] - rightHypotenuse * Math.cos(rightEndDir),
  ];

  // Convert all XY vertices back to lat/lng
  const leftBase = toLatLng(leftBaseXY[0], leftBaseXY[1]);
  const rightBase = toLatLng(rightBaseXY[0], rightBaseXY[1]);
  const leftEnd = toLatLng(leftEndXY[0], leftEndXY[1]);
  const rightEnd = toLatLng(rightEndXY[0], rightEndXY[1]);

  // Polygon: leftBase -> leftEnd -> rightEnd -> rightBase -> leftBase
  const leftBase3D = [...leftBase, rwyelev];
  const leftEnd3D = [...leftEnd, och + rwyelev];
  const rightEnd3D = [...rightEnd, och + rwyelev];
  const rightBase3D = [...rightBase, rwyelev];
  // Correct order: leftBase, leftEnd, rightEnd, rightBase, leftBase
  const vssPoly3D = [
    leftBase3D,
    leftEnd3D,
    rightEnd3D,
    rightBase3D,
    leftBase3D,
  ];

  // Store for export
  lastVssPoly3D = vssPoly3D;

  // Log the vertices as [lat, lng, alt]
  console.log("VSS vertices (lat, lng, alt):", vssPoly3D);

  // Also log the vertices as [x, y, z] in NZTM
  const vssPolyXYZ = [
    leftBaseXY,
    leftEndXY,
    rightEndXY,
    rightBaseXY,
    leftBaseXY,
  ].map(([x, y], i) => {
    const z = i === 0 || i === 4 || i === 3 ? rwyelev : och;
    return [x, y, z];
  });
  //   console.log('VSS vertices (x, y, z) NZTM:', vssPolyXYZ);

  // Remove previous VSS polygon if present (Leaflet)
  if (window.vssLayer) {
    map.removeLayer(window.vssLayer);
    window.vssLayer = null;
  }

  // Draw as 2D polygon on Leaflet map
  window.vssLayer = L.polygon(
    vssPoly3D.map(([lat, lng]) => [lat, lng]),
    { color: "red", fillOpacity: 0.2 }
  ).addTo(map);
  map.fitBounds(window.vssLayer.getBounds(), { padding: [20, 20] });

  // Add markers for each vertex and label with A, B, C, D (leftBase, leftEnd, rightEnd, rightBase)
  if (window.vssMarkers) {
    window.vssMarkers.forEach((marker) => {
      map.removeLayer(marker);
    });
  }
  const markerLabels = ["A", "B", "C", "D"];
  const smallIcon = L.icon({
    iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
    iconSize: [18, 30], // 50% of default [25, 41]
    iconAnchor: [9, 30],
    shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
    shadowSize: [13, 21],
    shadowAnchor: [4, 21],
  });
  window.vssMarkers = [leftBase3D, leftEnd3D, rightEnd3D, rightBase3D].map(
    ([lat, lng, z], idx) => {
      const marker = L.marker([lat, lng], { icon: smallIcon }).addTo(map);
      // Add popup with label, lat, lng, z, all center aligned
      const popupContent = `
            <div style="text-align:center;">
                <div><strong>Point ${markerLabels[idx]}</strong></div>
                <div style="font-size: 0.8rem;">Latitude: ${lat.toFixed(
                  8
                )}</div>
                <div style="font-size: 0.8rem;">Longitude: ${lng.toFixed(
                  8
                )}</div>
                <div style="font-size: 0.8rem;">Elevation: ${z.toFixed(
                  2
                )} m</div>
            </div>
        `;
      marker.bindPopup(popupContent);
      return marker;
    }
  );
});

// Draw a line between runway threshold and runway end if both are set
function drawRunwayLine() {
  const thrLat = parseFloat(document.getElementById("thr-lat").value);
  const thrLng = parseFloat(document.getElementById("thr-lng").value);
  const endLat = parseFloat(document.getElementById("rwyend-lat").value);
  const endLng = parseFloat(document.getElementById("rwyend-lng").value);
  if (!isNaN(thrLat) && !isNaN(thrLng) && !isNaN(endLat) && !isNaN(endLng)) {
    if (window.runwayLine) {
      window.map.removeLayer(window.runwayLine);
    }
    window.runwayLine = L.polyline(
      [
        [thrLat, thrLng],
        [endLat, endLng],
      ],
      { color: "blue", weight: 3, dashArray: "5, 10" }
    ).addTo(window.map);
  }
}

// Listen for changes to runwaythr and runwayend and update the line
["runwaythr", "runwayend"].forEach((id) => {
  document.getElementById(id).addEventListener("change", drawRunwayLine);
});
// Also update the line if the lat/lng fields change (e.g. after selection)
["thr-lat", "thr-lng", "rwyend-lat", "rwyend-lng"].forEach((id) => {
  document.getElementById(id).addEventListener("input", drawRunwayLine);
});

// Helper to draw DEP OIS runway line if both start and end lat/lng fields are set
function drawDepOisRunwayLine() {
  const startLat = parseFloat(document.getElementById("dep-start-lat").value);
  const startLng = parseFloat(document.getElementById("dep-start-lng").value);
  const endLat = parseFloat(document.getElementById("dep-end-lat").value);
  const endLng = parseFloat(document.getElementById("dep-end-lng").value);
  console.log("[DEP OIS] drawDepOisRunwayLine:", {
    startLat,
    startLng,
    endLat,
    endLng,
  });
  if (
    !isNaN(startLat) &&
    !isNaN(startLng) &&
    !isNaN(endLat) &&
    !isNaN(endLng)
  ) {
    if (window.depOisLine) {
      window.map.removeLayer(window.depOisLine);
      console.log("[DEP OIS] Removed previous line");
    }
    window.depOisLine = L.polyline(
      [
        [startLat, startLng],
        [endLat, endLng],
      ],
      { color: "green", weight: 4, dashArray: "6, 8" }
    ).addTo(window.map);
    window.map.fitBounds(window.depOisLine.getBounds(), { padding: [20, 20] });
    console.log("[DEP OIS] Line drawn on map");
  } else {
    console.log("[DEP OIS] Not drawing line: invalid or missing coordinates");
  }
}

["dep-start-lat", "dep-start-lng", "dep-end-lat", "dep-end-lng"].forEach(
  (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("input", drawDepOisRunwayLine);
      console.log("[DEP OIS] Listener attached to", id);
    } else {
      console.log("[DEP OIS] No element found for", id);
    }
  }
);

const depOisForm = document.getElementById("dep-ois-form");
if (depOisForm) {
  depOisForm.addEventListener("submit", function (e) {
    e.preventDefault();
    console.log("[DEP OIS] Form submitted");
    drawDepOisRunwayLine();
  });
}

// Also call drawDepOisRunwayLine on form submit (for safety)
const depOisFormSafety = document.getElementById("dep-ois-form");
if (depOisFormSafety) {
  depOisFormSafety.addEventListener("submit", function (e) {
    e.preventDefault();
    drawDepOisRunwayLine();
  });
}

// Add event listener for Export KML button
const exportBtn = document.getElementById("export-kml");
if (exportBtn) {
  exportBtn.addEventListener("click", function () {
    if (!lastVssPoly3D) {
      alert("Please draw the VSS polygon first.");
      return;
    }
    const kml = vssToKML(lastVssPoly3D);
    const blob = new Blob([kml], {
      type: "application/vnd.google-earth.kml+xml",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "vss.kml";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
}

// Initialize Bootstrap tooltips globally
if (window.bootstrap) {
  const tooltipTriggerList = [].slice.call(
    document.querySelectorAll('[data-bs-toggle="tooltip"]')
  );
  tooltipTriggerList.forEach(function (tooltipTriggerEl) {
    new bootstrap.Tooltip(tooltipTriggerEl);
  });
}

// Dynamic loading of runway THR options for DEP OIS form
const depRwyThr = document.getElementById("dep-rwythr"); // END
const depStartRwy = document.getElementById("dep-startrwy"); // START
const aerodromeSelect = document.getElementById("aerodrome");
if (aerodromeSelect) {
  aerodromeSelect.addEventListener("change", function () {
    const icao = this.value;
    if (depRwyThr) depRwyThr.innerHTML = '<option value="">END</option>';
    if (depStartRwy) depStartRwy.innerHTML = '<option value="">START</option>';
    if (
      icao &&
      typeof aerodromeRunways !== "undefined" &&
      aerodromeRunways[icao]
    ) {
      for (const rwy of aerodromeRunways[icao]) {
        if (depStartRwy) {
          const opt1 = document.createElement("option");
          opt1.value = rwy;
          opt1.textContent = rwy;
          depStartRwy.appendChild(opt1);
        }
        if (depRwyThr) {
          const opt2 = document.createElement("option");
          opt2.value = rwy;
          opt2.textContent = rwy;
          depRwyThr.appendChild(opt2);
        }
      }
    }
  });
}

// DEP OIS: Fill out lat/lng/elev fields when start or end runway is selected
if (depStartRwy) {
  depStartRwy.addEventListener("change", async function () {
    const icao = aerodromeSelect ? aerodromeSelect.value : "";
    const rwyName = this.value;
    if (!icao || !rwyName) return;
    const response = await fetch("data/runways.csv");
    const text = await response.text();
    const lines = text.split(/\r?\n/).filter(Boolean);
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",");
      if (
        cols.length >= 17 &&
        cols[16].trim() === icao &&
        cols[0].trim() === rwyName
      ) {
        // Latitude (WGS84) col 5, Longitude (WGS84) col 6, Elevation col 3
        const latStr = cols[5].replace("S", "-").replace("N", "").trim();
        const lngStr = cols[6].replace("E", "").replace("W", "-").trim();
        const elevStr = cols[3].trim();
        document.getElementById("dep-start-lat").value =
          parseFloat(latStr) || "";
        document.getElementById("dep-start-lng").value =
          parseFloat(lngStr) || "";
        document.getElementById("dep-start-elev").value =
          parseFloat(elevStr) || "";
        break;
      }
    }
    drawDepOisRunwayLine();
  });
}
if (depRwyThr) {
  depRwyThr.addEventListener("change", async function () {
    const icao = aerodromeSelect ? aerodromeSelect.value : "";
    const rwyName = this.value;
    if (!icao || !rwyName) return;
    const response = await fetch("data/runways.csv");
    const text = await response.text();
    const lines = text.split(/\r?\n/).filter(Boolean);
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",");
      if (
        cols.length >= 17 &&
        cols[16].trim() === icao &&
        cols[0].trim() === rwyName
      ) {
        // Latitude (WGS84) col 5, Longitude (WGS84) col 6, Elevation col 3
        const latStr = cols[5].replace("S", "-").replace("N", "").trim();
        const lngStr = cols[6].replace("E", "").replace("W", "-").trim();
        const elevStr = cols[3].trim();
        document.getElementById("dep-end-lat").value = parseFloat(latStr) || "";
        document.getElementById("dep-end-lng").value = parseFloat(lngStr) || "";
        document.getElementById("dep-end-elev").value =
          parseFloat(elevStr) || "";
        break;
      }
    }
    drawDepOisRunwayLine();
  });
}

// DEP OIS form event handlers
const depExportKmlBtn = document.getElementById("dep-export-kml");
if (depExportKmlBtn) {
  depExportKmlBtn.addEventListener("click", function () {
    if (window.Swal) {
      Swal.fire({
        icon: "info",
        title: "Not Implemented",
        text: "DEP OIS KML export is not yet implemented.",
        confirmButtonColor: "#0d6efd",
        background: "#fff",
        color: "#212529",
      });
    }
  });
}
const depClearBtn = document.getElementById("dep-clear");
if (depClearBtn) {
  depClearBtn.addEventListener("click", function () {
    // TODO: Implement clear logic for DEP OIS
    if (window.Swal) {
      Swal.fire({
        icon: "info",
        title: "Not Implemented",
        text: "DEP OIS clear logic is not yet implemented.",
        confirmButtonColor: "#0d6efd",
        background: "#fff",
        color: "#212529",
      });
    }
  });
}
