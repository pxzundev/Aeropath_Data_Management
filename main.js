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

// Add KML export functionality for DEP OIS
function depOisToKML(depOisPoly3D) {
  // depOisPoly3D: [baseRight, leftEnd, rightEnd, baseLeft, baseRight]
  const [baseRight, leftEnd, rightEnd, baseLeft] = depOisPoly3D;
  const vertexNames = ["", "", "", ""];
  const vertexIcons = [
    "http://maps.google.com/mapfiles/kml/paddle/A.png",
    "http://maps.google.com/mapfiles/kml/paddle/B.png",
    "http://maps.google.com/mapfiles/kml/paddle/C.png",
    "http://maps.google.com/mapfiles/kml/paddle/D.png",
  ];
  const markerStyles = vertexIcons
    .map(
      (icon, i) =>
        `    <Style id="marker${i}">\n      <IconStyle>\n        <Icon>\n          <href>${icon}</href>\n        </Icon>\n      </IconStyle>\n    </Style>`
    )
    .join("\n");
  const vertexPlacemarks = depOisPoly3D
    .slice(0, 4)
    .map(
      ([lat, lng, alt], idx) =>
        `    <Placemark>\n      <name>${vertexNames[idx]}</name>\n      <styleUrl>#marker${idx}</styleUrl>\n      <Point>\n        <coordinates>${lng},${lat},${alt}</coordinates>\n        <altitudeMode>absolute</altitudeMode>\n      </Point>\n    </Placemark>`
    )
    .join("\n");
  const coordinates = depOisPoly3D
    .map(([lat, lng, alt]) => `${lng},${lat},${alt}`)
    .join(" ");
  const polyStyle = `    <Style id="depOisPolyStyle">\n      <LineStyle>\n        <color>ff00aaff</color>\n        <width>2</width>\n      </LineStyle>\n      <PolyStyle>\n        <color>cc00aaff</color>\n      </PolyStyle>\n    </Style>`;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2">\n  <Document>\n${markerStyles}\n${polyStyle}\n    <Placemark>\n      <name>DEP OIS Polygon</name>\n      <styleUrl>#depOisPolyStyle</styleUrl>\n      <Polygon>\n        <extrude>0</extrude>\n        <altitudeMode>absolute</altitudeMode>\n        <outerBoundaryIs>\n          <LinearRing>\n            <coordinates>${coordinates}</coordinates>\n          </LinearRing>\n        </outerBoundaryIs>\n      </Polygon>\n    </Placemark>\n${vertexPlacemarks}\n  </Document>\n</kml>`;
}

// Store last VSS polygon for export
window.lastVssPoly3D = null;

// Store last DEP OIS polygon for export
window.lastDepOisPoly3D = null;

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
  window.lastVssPoly3D = vssPoly3D;

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
  //   console.log("[DEP OIS] drawDepOisRunwayLine:", {
  //     startLat,
  //     startLng,
  //     endLat,
  //     endLng,
  //   });
  if (
    !isNaN(startLat) &&
    !isNaN(startLng) &&
    !isNaN(endLat) &&
    !isNaN(endLng)
  ) {
    if (window.depOisLine) {
      window.map.removeLayer(window.depOisLine);
      //   console.log("[DEP OIS] Removed previous line");
    }
    window.depOisLine = L.polyline(
      [
        [startLat, startLng],
        [endLat, endLng],
      ],
      { color: "green", weight: 4, dashArray: "6, 8" }
    ).addTo(window.map);
    // console.log("[DEP OIS] Line drawn on map");
  } else {
    // console.log("[DEP OIS] Not drawing line: invalid or missing coordinates");
  }
}

const depOisForm = document.getElementById("dep-ois-form");
if (depOisForm) {
  depOisForm.addEventListener("submit", function (e) {
    e.preventDefault();
    // Get input values
    const startLat = parseFloat(document.getElementById("dep-start-lat").value);
    const startLng = parseFloat(document.getElementById("dep-start-lng").value);
    const endLat = parseFloat(document.getElementById("dep-end-lat").value);
    const endLng = parseFloat(document.getElementById("dep-end-lng").value);
    const cwyLength =
      parseFloat(document.getElementById("cwy-length").value) || 0;
    // Use the value from the dep-offset input field, negative = left, positive = right
    const offset =
      -1 * parseFloat(document.getElementById("dep-offset").value) || 0;
    // Validation
    if (
      !isFinite(startLat) ||
      !isFinite(startLng) ||
      !isFinite(endLat) ||
      !isFinite(endLng)
    ) {
      if (window.Swal) {
        Swal.fire({
          icon: "error",
          title: "Form Error",
          text: "Invalid or missing fields.",
          confirmButtonColor: "#0d6efd",
          background: "#fff",
          color: "#212529",
        });
      } else {
        // Dynamically load SweetAlert2 if not present
        const script = document.createElement("script");
        script.src =
          "https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.all.min.js";
        script.onload = function () {
          Swal.fire({
            icon: "error",
            title: "Form Error",
            text: "Invalid or missing fields.",
            confirmButtonColor: "#0d6efd",
            background: "#fff",
            color: "#212529",
          });
        };
        document.head.appendChild(script);
      }
      return;
    }
    // Remove previous polygon if present
    if (window.depOisPoly) {
      window.map.removeLayer(window.depOisPoly);
    }
    // Geometry constants
    const baseWidth = 300; // meters
    const length = 5000; // meters
    const splayDeg = 15;
    // Convert to x/y (NZTM)
    const startXY = toXY(startLat, startLng);
    const endXY = toXY(endLat, endLng);
    // Runway centerline bearing (from start to end)
    const dx = endXY[0] - startXY[0];
    const dy = endXY[1] - startXY[1];
    const rwyBrg = Math.atan2(dx, dy); // radians

    // Base origin: at runway end, or cwyLength from end along centerline
    let baseOriginXY = [endXY[0], endXY[1]];
    let baseOriginElev = 5 + (parseFloat(document.getElementById("dep-end-elev").value) || 0);
    if (cwyLength > 0) {
      baseOriginXY = [
        endXY[0] + cwyLength * Math.sin(rwyBrg),
        endXY[1] + cwyLength * Math.cos(rwyBrg),
      ];
      // Elevation at base origin is still rwyend elev + 5m
      // (CWY is flat, not sloped)
    }

    // Base corners (perpendicular to centerline)
    const baseLeftXY = [
      baseOriginXY[0] + (baseWidth / 2) * Math.cos(rwyBrg),
      baseOriginXY[1] - (baseWidth / 2) * Math.sin(rwyBrg),
    ];
    const baseRightXY = [
      baseOriginXY[0] - (baseWidth / 2) * Math.cos(rwyBrg),
      baseOriginXY[1] + (baseWidth / 2) * Math.sin(rwyBrg),
    ];

    // Splay angles (match VSS logic)
    let leftSplay, rightSplay;
    if (offset < 0) {
      leftSplay = offset - splayDeg;
      rightSplay = splayDeg;
    } else if (offset > 0) {
      rightSplay = offset + splayDeg;
      leftSplay = -splayDeg;
    } else {
      leftSplay = -splayDeg;
      rightSplay = splayDeg;
    }
    // Splay angles in radians
    const leftSplayRad = toRad(leftSplay);
    const rightSplayRad = toRad(rightSplay);
    // End corners (splayed from base corners)
    const leftEndDir = rwyBrg + leftSplayRad;
    const rightEndDir = rwyBrg + rightSplayRad;
    const leftEndXY = [
      baseLeftXY[0] + length * Math.sin(leftEndDir),
      baseLeftXY[1] + length * Math.cos(leftEndDir),
    ];
    const rightEndXY = [
      baseRightXY[0] + length * Math.sin(rightEndDir),
      baseRightXY[1] + length * Math.cos(rightEndDir),
    ];

    // Calculate elevations for DEP OIS vertices using 2.5% slope along centerline
    // Base elevation is rwyend elev + 5m
    // End elevation is base elevation + (5000m * 0.025)
    const depBaseElev = baseOriginElev;
    const depEndElev = depBaseElev + (5000 * 0.025);

    // Vertices with elevation: [lat, lng, elev]
    // baseRight3D and baseLeft3D use depBaseElev
    // leftEnd3D and rightEnd3D use depEndElev
    const baseLeft = toLatLng(baseLeftXY[0], baseLeftXY[1]);
    const baseRight = toLatLng(baseRightXY[0], baseRightXY[1]);
    const leftEnd = toLatLng(leftEndXY[0], leftEndXY[1]);
    const rightEnd = toLatLng(rightEndXY[0], rightEndXY[1]);
    const baseRight3D = [baseRight[0], baseRight[1], depBaseElev];
    const leftEnd3D = [leftEnd[0], leftEnd[1], depEndElev];
    const rightEnd3D = [rightEnd[0], rightEnd[1], depEndElev];
    const baseLeft3D = [baseLeft[0], baseLeft[1], depBaseElev];

    // Store for export (order: baseRight, leftEnd, rightEnd, baseLeft, baseRight)
    window.lastDepOisPoly3D = [
      baseRight3D,
      leftEnd3D,
      rightEnd3D,
      baseLeft3D,
      baseRight3D,
    ];

    // Log the vertices as [lat, lng, elev]
    console.log("DEP OIS vertices (lat, lng, elev):", [
      baseRight3D,
      leftEnd3D,
      rightEnd3D,
      baseLeft3D,
    ]);
    // Polygon: baseRight -> leftEnd -> rightEnd -> baseLeft -> baseRight
    const depOisPolyLatLngs = [
      [baseRight[0], baseRight[1]],
      [leftEnd[0], leftEnd[1]],
      [rightEnd[0], rightEnd[1]],
      [baseLeft[0], baseLeft[1]],
      [baseRight[0], baseRight[1]],
    ];
    window.depOisPoly = L.polygon(depOisPolyLatLngs, {
      color: "orange",
      fillOpacity: 0.2,
    }).addTo(window.map);

    // Fit map to bounds of the DEP OIS polygon (same as VSS logic)
    window.map.fitBounds(window.depOisPoly.getBounds(), { padding: [20, 20] });

    // Add markers for each DEP OIS polygon vertex (A: baseRight, B: leftEnd, C: rightEnd, D: baseLeft)
    if (window.depOisMarkers) {
      window.depOisMarkers.forEach((marker) => {
        window.map.removeLayer(marker);
      });
    }
    const depOisMarkerLabels = ["A", "B", "C", "D"];
    const depOisVertices = [baseRight, leftEnd, rightEnd, baseLeft];
    const depOisIcon = L.icon({
      iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
      iconSize: [18, 30],
      iconAnchor: [9, 30],
      shadowUrl:
        "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
      shadowSize: [13, 21],
      shadowAnchor: [4, 21],
    });
    window.depOisMarkers = depOisVertices.map(([lat, lng], idx) => {
      const marker = L.marker([lat, lng], { icon: depOisIcon }).addTo(
        window.map
      );
      const popupContent = `
        <div style="text-align:center;">
            <div><strong>Point ${depOisMarkerLabels[idx]}</strong></div>
            <div style="font-size: 0.8rem;">Latitude: ${lat.toFixed(8)}</div>
            <div style="font-size: 0.8rem;">Longitude: ${lng.toFixed(8)}</div>
        </div>
      `;
      marker.bindPopup(popupContent);
      return marker;
    });
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
  exportBtn.addEventListener("click", async function () {
    if (!window.lastVssPoly3D) {
      // Use SweetAlert2 for error if VSS polygon is missing
      if (window.Swal) {
        Swal.fire({
          icon: "error",
          title: "No VSS Polygon",
          text: "Please draw the VSS polygon first.",
          confirmButtonColor: "#0d6efd",
          background: "#fff",
          color: "#212529",
        });
      } else {
        // Dynamically load SweetAlert2 if not present
        const script = document.createElement("script");
        script.src =
          "https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.all.min.js";
        script.onload = function () {
          Swal.fire({
            icon: "error",
            title: "No VSS Polygon",
            text: "Please draw the VSS polygon first.",
            confirmButtonColor: "#0d6efd",
            background: "#fff",
            color: "#212529",
          });
        };
        document.head.appendChild(script);
      }
      return;
    }
    const kml = vssToKML(window.lastVssPoly3D);
    // Determine ICAO and THR designator for filename
    let icao = "";
    let thr = "";
    const icaoEl = document.getElementById("aerodrome");
    if (icaoEl) icao = icaoEl.value.trim();
    const thrEl = document.getElementById("runwaythr");
    if (thrEl) {
      // Extract only the runway number and the last letter (if any)
      // Examples: 'THR 05G' -> '05G', 'THR 05' -> '05', 'THR 23L' -> '23L', 'THR 23' -> '23'
      const raw = thrEl.value.trim();
      const match = raw.match(/(\d{2})([A-Z])?$/i);
      if (match) {
        thr = match[1] + (match[2] ? match[2].toUpperCase() : "");
      }
    }
    let defaultFileName = "vss.kml";
    if (icao && thr) {
      defaultFileName = `${icao}-VSS-RWY${thr}`;
    } else if (icao) {
      defaultFileName = `${icao}-VSS-RWY`;
    }
    defaultFileName += ".kml";
    // Use File System Access API if available
    if (window.showSaveFilePicker) {
      try {
        const opts = {
          suggestedName: defaultFileName,
          types: [
            {
              description: "KML Files",
              accept: { "application/vnd.google-earth.kml+xml": [".kml"] },
            },
          ],
        };
        const handle = await window.showSaveFilePicker(opts);
        const writable = await handle.createWritable();
        await writable.write(kml);
        await writable.close();
      } catch (err) {
        if (err.name !== "AbortError") {
          if (window.Swal) {
            Swal.fire({
              icon: "error",
              title: "Export Error",
              text: "Failed to save KML file.",
              confirmButtonColor: "#0d6efd",
              background: "#fff",
              color: "#212529",
            });
          } else {
            const script = document.createElement("script");
            script.src =
              "https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.all.min.js";
            script.onload = function () {
              Swal.fire({
                icon: "error",
                title: "Export Error",
                text: "Failed to save KML file.",
                confirmButtonColor: "#0d6efd",
                background: "#fff",
                color: "#212529",
              });
            };
            document.head.appendChild(script);
          }
        }
      }
    } else {
      // Fallback: Blob download
      const blob = new Blob([kml], {
        type: "application/vnd.google-earth.kml+xml",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = defaultFileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  });
}

// DEP OIS form event handlers
const depExportKmlBtn = document.getElementById("dep-export-kml");
if (depExportKmlBtn) {
  depExportKmlBtn.addEventListener("click", async function () {
    if (!window.lastDepOisPoly3D) {
      if (window.Swal) {
        Swal.fire({
          icon: "error",
          title: "No DEP OIS Polygon",
          text: "Please draw the DEP OIS polygon first.",
          confirmButtonColor: "#0d6efd",
          background: "#fff",
          color: "#212529",
        });
      } else {
        const script = document.createElement("script");
        script.src =
          "https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.all.min.js";
        script.onload = function () {
          Swal.fire({
            icon: "error",
            title: "No DEP OIS Polygon",
            text: "Please draw the DEP OIS polygon first.",
            confirmButtonColor: "#0d6efd",
            background: "#fff",
            color: "#212529",
          });
        };
        document.head.appendChild(script);
      }
      return;
    }
    const kml = depOisToKML(window.lastDepOisPoly3D);
    // Determine ICAO and RWY for filename
    let icao = "";
    let rwy = "";
    const icaoEl = document.getElementById("aerodrome");
    if (icaoEl) icao = icaoEl.value.trim();
    const rwyEl = document.getElementById("dep-rwythr");
    if (rwyEl) {
      const raw = rwyEl.value.trim();
      const match = raw.match(/(\d{2})([A-Z])?$/i);
      if (match) {
        rwy = match[1] + (match[2] ? match[2].toUpperCase() : "");
      }
    }
    let defaultFileName = "dep_ois.kml";
    if (icao && rwy) {
      defaultFileName = `${icao}-DEP-OIS-RWY${rwy}`;
    } else if (icao) {
      defaultFileName = `${icao}-DEP-OIS-RWY`;
    }
    defaultFileName += ".kml";
    // Use File System Access API if available
    if (window.showSaveFilePicker) {
      try {
        const opts = {
          suggestedName: defaultFileName,
          types: [
            {
              description: "KML Files",
              accept: { "application/vnd.google-earth.kml+xml": [".kml"] },
            },
          ],
        };
        const handle = await window.showSaveFilePicker(opts);
        const writable = await handle.createWritable();
        await writable.write(kml);
        await writable.close();
      } catch (err) {
        if (err.name !== "AbortError") {
          if (window.Swal) {
            Swal.fire({
              icon: "error",
              title: "Export Error",
              text: "Failed to save KML file.",
              confirmButtonColor: "#0d6efd",
              background: "#fff",
              color: "#212529",
            });
          } else {
            const script = document.createElement("script");
            script.src =
              "https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.all.min.js";
            script.onload = function () {
              Swal.fire({
                icon: "error",
                title: "Export Error",
                text: "Failed to save KML file.",
                confirmButtonColor: "#0d6efd",
                background: "#fff",
                color: "#212529",
              });
            };
            document.head.appendChild(script);
          }
        }
      }
    } else {
      // Fallback: Blob download
      const blob = new Blob([kml], {
        type: "application/vnd.google-earth.kml+xml",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = defaultFileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
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
        // Only add runways that start with "THR"
        if (!rwy.startsWith("THR")) continue;
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

// Dynamic loading of runway THR options for VSS form
const thrSelect = document.getElementById("runwaythr");
const endSelect = document.getElementById("runwayend");
if (aerodromeSelect) {
  aerodromeSelect.addEventListener("change", function () {
    const icao = this.value;
    if (thrSelect) thrSelect.innerHTML = '<option value="">THR</option>';
    if (endSelect) endSelect.innerHTML = '<option value="">END</option>';
    if (
      icao &&
      typeof aerodromeRunways !== "undefined" &&
      aerodromeRunways[icao]
    ) {
      for (const rwy of aerodromeRunways[icao]) {
        // Only add runways that start with "THR"
        if (!rwy.startsWith("THR")) continue;
        if (thrSelect) {
          const opt1 = document.createElement("option");
          opt1.value = rwy;
          opt1.textContent = rwy;
          thrSelect.appendChild(opt1);
        }
        if (endSelect) {
          const opt2 = document.createElement("option");
          opt2.value = rwy;
          opt2.textContent = rwy;
          endSelect.appendChild(opt2);
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

// VSS Clear button logic
const vssClearBtn = document.querySelector("#vss-form-card .btn-danger");
if (vssClearBtn) {
  vssClearBtn.addEventListener("click", function () {
    // Remove VSS polygon and markers from map
    if (window.vssLayer) {
      map.removeLayer(window.vssLayer);
      window.vssLayer = null;
    }
    if (window.vssMarkers) {
      window.vssMarkers.forEach((marker) => map.removeLayer(marker));
      window.vssMarkers = null;
    }
    // Reset VSS form fields to default values
    const vssForm = document.getElementById("vss-form");
    if (vssForm) vssForm.reset();
    // Set custom defaults
    document.getElementById("runwaycode").value = "3,4";
    document.getElementById("strip").value = 280;
    document.getElementById("vpa").value = 3.0;
    document.getElementById("och").value = 500;
    document.getElementById("offsetangle").value = 0;
    // Clear hidden/disabled fields
    [
      "thr-lat",
      "thr-lng",
      "rwyelev",
      "rwyend-lat",
      "rwyend-lng",
      "rwyendelev",
      "fac",
    ].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });
    // Remove runway line if present
    if (window.runwayLine) {
      map.removeLayer(window.runwayLine);
      window.runwayLine = null;
    }
    // Clear lastVssPoly3D so export is disabled
    window.lastVssPoly3D = null;
  });
}

// DEP OIS Clear button logic
const depClearBtn = document.getElementById("dep-clear");
if (depClearBtn) {
  depClearBtn.addEventListener("click", function () {
    // Remove DEP OIS polygon and markers from map
    if (window.depOisPoly) {
      window.map.removeLayer(window.depOisPoly);
      window.depOisPoly = null;
    }
    if (window.depOisMarkers) {
      window.depOisMarkers.forEach((marker) => window.map.removeLayer(marker));
      window.depOisMarkers = null;
    }
    // Remove DEP OIS runway line if present
    if (window.depOisLine) {
      window.map.removeLayer(window.depOisLine);
      window.depOisLine = null;
    }
    // Reset DEP OIS form fields to default values
    const depOisForm = document.getElementById("dep-ois-form");
    if (depOisForm) depOisForm.reset();
    // Set custom defaults
    document.getElementById("cwy-length").value = 0;
    document.getElementById("dep-offset").value = 0;
    // Clear hidden/disabled fields
    [
      "dep-start-lat",
      "dep-start-lng",
      "dep-start-elev",
      "dep-end-lat",
      "dep-end-lng",
      "dep-end-elev",
    ].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });
  });
}

// Helper to clear all overlays: runway line, VSS, and DEP OIS
function clearAllOverlays() {
  if (window.runwayLine) {
    window.map.removeLayer(window.runwayLine);
    window.runwayLine = null;
  }
  if (window.vssLayer) {
    window.map.removeLayer(window.vssLayer);
    window.vssLayer = null;
  }
  if (window.vssMarkers) {
    window.vssMarkers.forEach((marker) => window.map.removeLayer(marker));
    window.vssMarkers = null;
  }
  if (window.depOisPoly) {
    window.map.removeLayer(window.depOisPoly);
    window.depOisPoly = null;
  }
  if (window.depOisMarkers) {
    window.depOisMarkers.forEach((marker) => window.map.removeLayer(marker));
    window.depOisMarkers = null;
  }
}

// Remove overlays when aerodrome, surface type, or any runway select changes
[
  "aerodrome",
  "surface-type",
  "runwaythr",
  "runwayend",
  "dep-startrwy",
  "dep-rwythr",
].forEach((id) => {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener("change", clearAllOverlays);
  }
});

// Toggle VSS hidden fields visibility
const vssToggleBtn = document.getElementById("vss-toggle-hidden-fields");
if (vssToggleBtn) {
  vssToggleBtn.addEventListener("click", function () {
    // Find all hidden rows in the VSS form
    const vssFormCard = document.getElementById("vss-form-card");
    if (!vssFormCard) return;
    const hiddenRows = vssFormCard.querySelectorAll(".row.mb-3, .row.mb-4");
    // Only toggle rows that have a 'hidden' attribute or were previously shown by this toggle
    let anyHidden = false;
    hiddenRows.forEach((row) => {
      if (row.hasAttribute("hidden")) anyHidden = true;
    });
    hiddenRows.forEach((row, idx) => {
      // Only toggle the two hidden rows (by index)
      if (idx === 1 || idx === 2) {
        if (anyHidden) {
          row.removeAttribute("hidden");
        } else {
          row.setAttribute("hidden", "");
        }
      }
    });
    // Toggle icon
    const icon = vssToggleBtn.querySelector("i");
    if (icon) {
      if (anyHidden) {
        icon.classList.remove("bi-eye-slash");
        icon.classList.add("bi-eye");
      } else {
        icon.classList.remove("bi-eye");
        icon.classList.add("bi-eye-slash");
      }
    }
  });
}

// Toggle DEP OIS hidden fields visibility
const depOisToggleBtn = document.createElement("span");
depOisToggleBtn.id = "dep-ois-toggle-hidden-fields";
depOisToggleBtn.className = "float-end";
depOisToggleBtn.setAttribute("role", "button");
depOisToggleBtn.setAttribute("tabindex", "0");
depOisToggleBtn.setAttribute("title", "Show/hide hidden fields");
depOisToggleBtn.innerHTML = '<i class="bi bi-eye-slash"></i>';
const depOisHeader = document.querySelector("#dep-ois-form-card .card-header");
if (depOisHeader) {
  depOisHeader.appendChild(depOisToggleBtn);
}
depOisToggleBtn.addEventListener("click", function () {
  const depOisFormCard = document.getElementById("dep-ois-form-card");
  if (!depOisFormCard) return;
  const hiddenRows = depOisFormCard.querySelectorAll(".row.mb-3");
  // Only toggle the two hidden rows (by index: 1 and 2)
  let anyHidden = false;
  hiddenRows.forEach((row, idx) => {
    if ((idx === 1 || idx === 2) && row.hasAttribute("hidden"))
      anyHidden = true;
  });
  hiddenRows.forEach((row, idx) => {
    if (idx === 1 || idx === 2) {
      if (anyHidden) {
        row.removeAttribute("hidden");
      } else {
        row.setAttribute("hidden", "");
      }
    }
  });
  // Toggle icon
  const icon = depOisToggleBtn.querySelector("i");
  if (icon) {
    if (anyHidden) {
      icon.classList.remove("bi-eye-slash");
      icon.classList.add("bi-eye");
    } else {
      icon.classList.remove("bi-eye");
      icon.classList.add("bi-eye-slash");
    }
  }
});
