// csv-modal.js
// Common CSV preview modal for both VSS and DEP OIS CSV uploads

/**
 * Show a modal with a preview table of the CSV contents (header + first 10 rows)
 * @param {string} csvText - The raw CSV text
 * @param {string} [modalTitle] - Optional title for the modal
 */
function showCsvPreviewModal(csvText, modalTitle = "CSV Preview") {
  // Parse CSV (simple split, assumes no quoted commas)
  const lines = csvText.split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return;
  const header = lines[0].split(",");
  const rows = lines.slice(1, 11).map((line) => line.split(","));
  const colLetters = header.map((_, i) => String.fromCharCode(65 + i));

  // Build table HTML with column letters and horizontal scroll
  let tableHtml =
    '<div style="overflow-x:auto; max-width:100%;"><table class="table table-bordered table-sm" style="white-space:nowrap; width:auto;">';
  tableHtml += "<thead>";
  tableHtml +=
    "<tr>" +
    colLetters
      .map(
        (l) =>
          `<th style="text-align:center; color: var(--bs-primary, #0d6efd);">${l}</th>`
      )
      .join("") +
    "</tr>";
  tableHtml +=
    "<tr>" +
    header.map((h) => `<th style="max-width:200px;">${h}</th>`).join("") +
    "</tr>";
  tableHtml += "</thead><tbody>";
  for (const row of rows) {
    tableHtml +=
      "<tr>" +
      header
        .map(
          (_, i) =>
            `<td style="max-width:200px;">${
              row[i] !== undefined ? row[i] : ""
            }</td>`
        )
        .join("") +
      "</tr>";
  }
  tableHtml += "</tbody></table></div>";

  // Dropdowns for column selection
  function makeDropdown(id, label) {
    return `<div class="col-md-3 mb-2">
      <label for="${id}" class="form-label">${label}</label>
      <select class="form-select" id="${id}">
        <option value="" selected disabled>Select...</option>
        ${colLetters
          .map((l, i) => `<option value="${i}">${l}</option>`)
          .join("")}
      </select>
    </div>`;
  }
  // Save button row above dropdowns, right aligned
  const saveButtonRow = `
    <div class="row mb-3"> <!-- vertical space below button -->
      <div class="col-12 d-flex justify-content-end">
        <button type="submit" class="btn btn-primary" id="csv-preview-apply-cols">Save</button>
      </div>
    </div>
  `;
  const dropdownsHtml = `
    <form id="csv-col-select-form">
    <h6 class="mb-3 mt-4">Assign Columns</h6>
      <div class="row mb-2 align-items-end">
        ${makeDropdown("csv-col-name", "Name (string)")}
        ${makeDropdown("csv-col-lat", "Latitude (string)")}
        ${makeDropdown("csv-col-lng", "Longitude (string)")}
        ${makeDropdown("csv-col-elev", "Elev (m) (float value)")}
      </div>
       ${saveButtonRow}
    </form>
  `;

  // Create modal if not exists
  let modal = document.getElementById("csvPreviewModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "csvPreviewModal";
    modal.className = "modal fade";
    modal.tabIndex = -1;
    modal.innerHTML = `
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">${modalTitle}</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body" id="csvPreviewModalBody"></div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  } else {
    modal.querySelector(".modal-title").textContent = modalTitle;
  }
  // Set table HTML and dropdowns
  document.getElementById("csvPreviewModalBody").innerHTML =
    tableHtml + dropdownsHtml;

  // Show modal (Bootstrap 5)
  let bsModal = null;
  if (window.bootstrap) {
    bsModal = new bootstrap.Modal(modal);
    bsModal.show();
  } else {
    modal.style.display = "block";
  }

  // Store last JSON for plotting
  window.lastCsvGeoJson = null;

  // Add event for Save (Apply & Convert to JSON)
  document.getElementById("csv-col-select-form").onsubmit = function (e) {
    e.preventDefault();
    const nameIdx = parseInt(document.getElementById("csv-col-name").value);
    const latIdx = parseInt(document.getElementById("csv-col-lat").value);
    const lngIdx = parseInt(document.getElementById("csv-col-lng").value);
    const elevIdx = parseInt(document.getElementById("csv-col-elev").value);
    if ([nameIdx, latIdx, lngIdx, elevIdx].some(isNaN)) {
      if (window.Swal) {
        Swal.fire({
          icon: "warning",
          title: "Missing Selection",
          text: "Please select a column for each field.",
          confirmButtonColor: "#0d6efd",
          background: "#fff",
          color: "#212529",
        });
      } else {
        alert("Please select a column for each field.");
      }
      return;
    }
    // Parse all rows (skip header)
    const dataRows = lines
      .slice(1)
      .filter(Boolean)
      .map((line) => line.split(","));
    const features = dataRows.map((row) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [parseLatLng(row[lngIdx]), parseLatLng(row[latIdx])],
      },
      properties: {
        name: row[nameIdx] || "",
        elev: parseFloat(row[elevIdx]) || 0,
      },
    }));
    const geojson = {
      type: "FeatureCollection",
      features,
    };
    window.lastCsvGeoJson = geojson;
    // Plot on map if map is available
    if (window.plotCsvGeoJsonOnMap) {
      window.plotCsvGeoJsonOnMap(geojson);
    }
    // Close modal
    if (bsModal) {
      bsModal.hide();
    } else {
      modal.style.display = "none";
    }
  };
}

// Plot GeoJSON points on the map as Leaflet markers with clustering and smaller icons
window.plotCsvGeoJsonOnMap = function (geojson) {
  if (!window.map || !window.L) return;
  // Remove previous CSV markers layer if present
  if (window.csvGeoJsonLayer) {
    window.map.removeLayer(window.csvGeoJsonLayer);
    window.csvGeoJsonLayer = null;
  }
  if (window.csvGeoJsonCluster) {
    window.map.removeLayer(window.csvGeoJsonCluster);
    window.csvGeoJsonCluster = null;
  }
  // Use marker clustering (Leaflet.markercluster)
  if (window.L && (L.MarkerClusterGroup || L.markerClusterGroup)) {
    // Support both L.MarkerClusterGroup (constructor) and L.markerClusterGroup (factory)
    const cluster = L.markerClusterGroup
      ? L.markerClusterGroup()
      : new L.MarkerClusterGroup();
    const smallIcon = L.icon({
      iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
      iconSize: [13, 21], // 30% smaller than [18, 30]
      iconAnchor: [6, 21],
      popupAnchor: [0, -10],
      shadowUrl:
        "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
      shadowSize: [9, 15],
      shadowAnchor: [3, 15],
    });
    geojson.features.forEach(function (feature) {
      if (
        feature.geometry &&
        feature.geometry.type === "Point" &&
        Array.isArray(feature.geometry.coordinates)
      ) {
        const lng = feature.geometry.coordinates[0];
        const lat = feature.geometry.coordinates[1];
        if (!isNaN(lat) && !isNaN(lng)) {
          const marker = L.marker([lat, lng], { icon: smallIcon });
          const props = feature.properties || {};
          marker.bindPopup(
            `<div style='text-align:center;'>` +
              `<div><strong>${props.name || ""}</strong></div>` +
              `<div style='font-size:0.8rem;'>Lat: ${lat.toFixed(8)}</div>` +
              `<div style='font-size:0.8rem;'>Lng: ${lng.toFixed(8)}</div>` +
              `<div style='font-size:0.8rem;'>Elev: ${props.elev ?? ""}</div>` +
              `</div>`
          );
          cluster.addLayer(marker);
        }
      }
    });
    window.csvGeoJsonCluster = cluster.addTo(window.map);
    // Fit map to bounds if there are features
    try {
      const bounds = cluster.getBounds();
      if (bounds.isValid()) {
        window.map.fitBounds(bounds, { padding: [20, 20] });
      }
    } catch (e) {}
    return;
  } else {
    // Fallback: no clustering
    const smallIcon = L.icon({
      iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
      iconSize: [13, 21],
      iconAnchor: [6, 21],
      popupAnchor: [0, -10],
      shadowUrl:
        "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
      shadowSize: [9, 15],
      shadowAnchor: [3, 15],
    });
    window.csvGeoJsonLayer = L.geoJSON(geojson, {
      pointToLayer: function (feature, latlng) {
        return L.marker(latlng, { icon: smallIcon }).bindPopup(
          `<div style='text-align:center;'>` +
            `<div><strong>${feature.properties.name || ""}</strong></div>` +
            `<div style='font-size:0.8rem;'>Lat: ${latlng.lat.toFixed(
              8
            )}</div>` +
            `<div style='font-size:0.8rem;'>Lng: ${latlng.lng.toFixed(
              8
            )}</div>` +
            `<div style='font-size:0.8rem;'>Elev: ${
              feature.properties.elev ?? ""
            }</div>` +
            `</div>`
        );
      },
    }).addTo(window.map);
    try {
      const bounds = window.csvGeoJsonLayer.getBounds();
      if (bounds.isValid()) {
        window.map.fitBounds(bounds, { padding: [20, 20] });
      }
    } catch (e) {}
  }
};

// VSS CSV upload preview
const vssCsvUpload = document.getElementById("vss-csv-upload");
if (vssCsvUpload) {
  vssCsvUpload.addEventListener("change", function (e) {
    const file = e.target.files && e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function (evt) {
        showCsvPreviewModal(evt.target.result, "VSS CSV Preview");
      };
      reader.readAsText(file);
    }
  });
}

// DEP OIS CSV upload preview
const depCsvUpload = document.getElementById("dep-csv-upload");
if (depCsvUpload) {
  depCsvUpload.addEventListener("change", function (e) {
    const file = e.target.files && e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function (evt) {
        showCsvPreviewModal(evt.target.result, "DEP OIS CSV Preview");
      };
      reader.readAsText(file);
    }
  });
}

// Common CSV upload logic for both VSS and DEP OIS
let lastCommonCsvFile = null;
let lastCommonCsvText = null;

const commonCsvUpload = document.getElementById("common-csv-upload");
if (commonCsvUpload) {
  commonCsvUpload.addEventListener("change", function (e) {
    const file = e.target.files && e.target.files[0];
    if (file) {
      lastCommonCsvFile = file;
      const reader = new FileReader();
      reader.onload = function (evt) {
        lastCommonCsvText = evt.target.result;
        showCsvPreviewModal(lastCommonCsvText, "CSV Preview");
      };
      reader.readAsText(file);
    }
  });
}

// Redefine button logic for common CSV
const commonCsvRedefine = document.getElementById("common-csv-redefine");
if (commonCsvRedefine) {
  commonCsvRedefine.addEventListener("click", function () {
    if (lastCommonCsvText) {
      showCsvPreviewModal(lastCommonCsvText, "CSV Preview");
    } else {
      if (window.Swal) {
        Swal.fire({
          icon: "warning",
          title: "No CSV Uploaded",
          text: "Please upload a CSV file first.",
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
            icon: "warning",
            title: "No CSV Uploaded",
            text: "Please upload a CSV file first.",
            confirmButtonColor: "#0d6efd",
            background: "#fff",
            color: "#212529",
          });
        };
        document.head.appendChild(script);
      }
    }
  });
}

// Helper: Parse latitude/longitude string to decimal degrees
function parseLatLng(str) {
  if (!str || typeof str !== "string") return NaN;
  str = str.trim();
  // Decimal degrees (with optional hemisphere)
  let m = str.match(/^([NS\-+])?\s*([0-9]{1,3}(?:\.[0-9]+)?)\s*([NS])?$/i);
  if (m) {
    let val = parseFloat(m[2]);
    let hemi = (m[1] || m[3] || "").toUpperCase();
    if (hemi === "S" || hemi === "W" || m[1] === "-") val *= -1;
    return val;
  }
  // DMS with delimiters (e.g. 43°30'15.5"S or S43°30'15.5")
  m = str.match(
    /([NSWE\-+])?\s*([0-9]{1,3})[°\s]?\s*([0-9]{1,2})['\s]?\s*([0-9]{1,2}(?:\.[0-9]+)?)?["]?\s*([NSWE])?/i
  );
  if (m) {
    let deg = parseFloat(m[2]);
    let min = parseFloat(m[3]) || 0;
    let sec = parseFloat(m[4]) || 0;
    let hemi = (m[1] || m[5] || "").toUpperCase();
    let val = deg + min / 60 + sec / 3600;
    if (hemi === "S" || hemi === "W" || m[1] === "-") val *= -1;
    return val;
  }
  // DMM (e.g. 43 30.1234S or S43 30.1234)
  m = str.match(
    /([NSWE\-+])?\s*([0-9]{1,3})[°\s]?\s*([0-9]{1,2}(?:\.[0-9]+)?)[']?\s*([NSWE])?/i
  );
  if (m) {
    let deg = parseFloat(m[2]);
    let min = parseFloat(m[3]) || 0;
    let hemi = (m[1] || m[4] || "").toUpperCase();
    let val = deg + min / 60;
    if (hemi === "S" || hemi === "W" || m[1] === "-") val *= -1;
    return val;
  }
  // Compact DMS (e.g. 433015.5S or S433015.5)
  m = str.match(
    /([NSWE\-+])?\s*([0-9]{2,3})([0-9]{2})([0-9]{2}(?:\.[0-9]+)?)\s*([NSWE])?/i
  );
  if (m) {
    let deg = parseFloat(m[2]);
    let min = parseFloat(m[3]);
    let sec = parseFloat(m[4]);
    let hemi = (m[1] || m[5] || "").toUpperCase();
    let val = deg + min / 60 + sec / 3600;
    if (hemi === "S" || hemi === "W" || m[1] === "-") val *= -1;
    return val;
  }
  // Compact DMM (e.g. 4330.1234S or S4330.1234)
  m = str.match(
    /([NSWE\-+])?\s*([0-9]{2,3})([0-9]{2}(?:\.[0-9]+)?)\s*([NSWE])?/i
  );
  if (m) {
    let deg = parseFloat(m[2]);
    let min = parseFloat(m[3]);
    let hemi = (m[1] || m[4] || "").toUpperCase();
    let val = deg + min / 60;
    if (hemi === "S" || hemi === "W" || m[1] === "-") val *= -1;
    return val;
  }
  // Fallback: try parseFloat
  let val = parseFloat(str);
  return isNaN(val) ? NaN : val;
}

// Export for use in other scripts (if using modules)
// window.showCsvPreviewModal = showCsvPreviewModal;
