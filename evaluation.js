/**
 * Show evaluation results in a modal table.
 * @param {Array} results - Array of objects: {name, lat, lng, x, y, z, surfElev, remarks}
 */
function showEvaluationResultsModal(results) {
  // Helper: format WGS84 to DMS string
  function toDMS(deg, isLat) {
    const abs = Math.abs(deg);
    const d = Math.floor(abs);
    const m = Math.floor((abs - d) * 60);
    const s = ((abs - d - m / 60) * 3600).toFixed(isLat ? 3 : 2);
    const hemi = isLat ? (deg >= 0 ? "N" : "S") : deg >= 0 ? "E" : "W";
    return `${String(d).padStart(isLat ? 2 : 3, "0")}\u00B0 ${String(
      m
    ).padStart(2, "0")}' ${s}"${hemi}`;
  }

  // Sorting state
  let sortCol = null;
  let sortDir = 1; // 1 = asc, -1 = desc

  // Helper to sort results
  function sortResults(col) {
    if (sortCol === col) {
      sortDir *= -1;
    } else {
      sortCol = col;
      sortDir = 1;
    }
    results.sort((a, b) => {
      let va, vb;
      switch (col) {
        case "name":
          va = (a.name || "").toLowerCase();
          vb = (b.name || "").toLowerCase();
          break;
        case "z":
          va = +a.z;
          vb = +b.z;
          break;
        case "surfElev":
          va = +a.surfElev;
          vb = +b.surfElev;
          break;
        case "penetration":
          va = +a.z - +a.surfElev;
          vb = +b.z - +b.surfElev;
          break;
        case "remarks":
          va = a.remarks === "Critical" ? 1 : 0;
          vb = b.remarks === "Critical" ? 1 : 0;
          break;
        default:
          va = vb = 0;
      }
      if (va < vb) return -1 * sortDir;
      if (va > vb) return 1 * sortDir;
      return 0;
    });
    renderTable();
  }

  // Render table with current sort
  function renderTable() {
    let tableHtml = `
      <div style="overflow-x:auto; overflow-y:auto; height:100%; max-height:100%;">
        <table class="table table-bordered table-sm align-middle mb-0" style="white-space:nowrap;">
          <thead>
            <tr>
              <th role="button" style="cursor:pointer;" id="sort-name">
                Name <span style="font-size:0.9em;">${
                  sortCol === "name" ? (sortDir === 1 ? "▲" : "▼") : "⇅"
                }</span>
              </th>
              <th>WGS84 <br/> Coordinates</th>
              <th>NZTM <br/> (x, y)</th>
              <th role="button" style="cursor:pointer;" id="sort-z">
                Elevation <br/>(m) <span style="font-size:0.9em;">${
                  sortCol === "z" ? (sortDir === 1 ? "▲" : "▼") : "⇅"
                }</span>
              </th>
              <th role="button" style="cursor:pointer;" id="sort-surfElev">
                Surface elevation <br/> (m) <span style="font-size:0.9em;">${
                  sortCol === "surfElev" ? (sortDir === 1 ? "▲" : "▼") : "⇅"
                }</span>
              </th>
              <th role="button" style="cursor:pointer;" id="sort-penetration">
                Penetration <br/>(m) <span style="font-size:0.9em;">${
                  sortCol === "penetration" ? (sortDir === 1 ? "▲" : "▼") : "⇅"
                }</span>
              </th>
              <th role="button" style="cursor:pointer;" id="sort-remarks">
                Remarks <span style="font-size:0.9em;">${
                  sortCol === "remarks" ? (sortDir === 1 ? "▲" : "▼") : "⇅"
                }</span>
              </th>
            </tr>
          </thead>
          <tbody>
    `;
    for (const r of results) {
      const dmsLat = toDMS(r.lat, true);
      const dmsLng = toDMS(r.lng, false);
      const remarksHtml =
        r.remarks === "Critical"
          ? `<span style="color:#dc3545;font-weight:bold;">Critical</span>`
          : "Not critical";
      const penetration =
        r.surfElev !== null && r.surfElev !== undefined ? r.z - r.surfElev : "";
      tableHtml += `
        <tr>
          <td>${r.name || ""}</td>
          <td>
            ${dmsLat}, ${dmsLng}
          </td>
          <td>
            ${r.x.toFixed(2)}, ${r.y.toFixed(2)}
          </td>
          <td>${r.z}</td>
          <td>${
            r.surfElev !== null && r.surfElev !== undefined
              ? r.surfElev.toFixed(3)
              : ""
          }</td>
          <td>${penetration !== "" ? penetration.toFixed(3) : ""}</td>
          <td>${remarksHtml}</td>
        </tr>
      `;
    }
    tableHtml += `
          </tbody>
        </table>
      </div>
    `;
    document.getElementById("evaluationResultsModalBody").innerHTML = tableHtml;

    // Add sorting event listeners
    document
      .getElementById("sort-name")
      ?.addEventListener("click", () => sortResults("name"));
    document
      .getElementById("sort-z")
      ?.addEventListener("click", () => sortResults("z"));
    document
      .getElementById("sort-surfElev")
      ?.addEventListener("click", () => sortResults("surfElev"));
    document
      .getElementById("sort-penetration")
      ?.addEventListener("click", () => sortResults("penetration"));
    document
      .getElementById("sort-remarks")
      ?.addEventListener("click", () => sortResults("remarks"));
  }

  // Create modal if not exists
  let modal = document.getElementById("evaluationResultsModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "evaluationResultsModal";
    modal.className = "modal fade";
    modal.tabIndex = -1;
    modal.innerHTML = `
      <div class="modal-dialog" style="width:90vw; max-width:90vw; height:90vh; max-height:90vh;">
        <div class="modal-content" style="height:90vh; max-height:90vh; display:flex; flex-direction:column;">
          <div class="modal-header">
            <h5 class="modal-title">Obstacle Evaluation Results</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body flex-grow-1" id="evaluationResultsModalBody" style="overflow:auto; min-height:0; height:100%;"></div>
          <div class="modal-footer bg-light" style="position:sticky; bottom:0; z-index:10;">
            <div class="d-flex justify-content-end gap-2 w-100">
              <button class="btn btn-primary" disabled>Placeholder 1</button>
              <button class="btn btn-secondary" disabled>Placeholder 2</button>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  renderTable();

  // Show modal (Bootstrap 5)
  let bsModal = null;
  if (window.bootstrap) {
    bsModal = new bootstrap.Modal(modal);
    bsModal.show();
  } else {
    modal.style.display = "block";
  }
}

// Export for use in other scripts
window.showEvaluationResultsModal = showEvaluationResultsModal;

// Evaluation logic moved from csv-modal.js
document
  .getElementById("evaluate-common-csv")
  ?.addEventListener("click", async function () {
    const utils = window.vss3dUtils;
    if (
      !utils ||
      typeof utils.toXY !== "function" ||
      typeof utils.pointInPolygon !== "function" ||
      typeof utils.getVSSElevationAt !== "function" || // Needed for VSS
      typeof utils.planeFitZ !== "function" // Needed for DEP OIS
    ) {
      console.error(
        "Required vss3d-utils.js functions are not available. Ensure vss3d-utils.js is loaded and vss3dUtils is exposed globally."
      );
      if (window.Swal) {
        Swal.fire({
          icon: "error",
          title: "Script Error",
          text: "Utility functions for evaluation are missing. Please check console.",
          confirmButtonColor: "#0d6efd",
        });
      } else {
        alert(
          "Utility functions for evaluation are missing. Please check console."
        );
      }
      return;
    }
    const {
      toXY,
      pointInPolygon,
      getVSSElevationAt,
      planeFitZ,
      getDepElevationAt,
    } = utils;

    if (!window.lastCsvGeoJson) {
      if (window.Swal) {
        Swal.fire({
          icon: "info",
          title: "No CSV Data",
          text: "Please upload a CSV file with obstacles first.",
          confirmButtonColor: "#0d6efd",
        });
      } else {
        // Fallback if SweetAlert2 is not available
        window.alert("Please upload a CSV file with obstacles first.");
      }
      return;
    }

    const surfaceTypeSelect = document.getElementById("surface-type");
    let activeSurfacePoly3D;
    let evaluationMode; // "vss" or "dep_ois"

    if (surfaceTypeSelect && surfaceTypeSelect.value === "dep_ois") {
      activeSurfacePoly3D = window.lastDepOisPoly3D;
      evaluationMode = "dep_ois";
      if (!activeSurfacePoly3D) {
        if (window.Swal) {
          Swal.fire({
            icon: "warning",
            title: "No DEP OIS Surface",
            text: "Please draw a DEP OIS surface first.",
            confirmButtonColor: "#0d6efd",
          });
        } else {
          alert("Please draw a DEP OIS surface first.");
        }
        return;
      }
      if (activeSurfacePoly3D.length < 3) {
        console.error(
          "DEP OIS polygon must have at least 3 points to define a plane for evaluation."
        );
        if (window.Swal) {
          Swal.fire({
            icon: "warning",
            title: "DEP OIS Error",
            text: "DEP OIS polygon is invalid for evaluation (needs 3+ points).",
            confirmButtonColor: "#0d6efd",
          });
        } else {
          alert("DEP OIS polygon is invalid for evaluation (needs 3+ points).");
        }
        return;
      }
      // Debug: log the input polygon and projected coordinates
      console.log("DEP OIS polygon (lat,lng,elev):", activeSurfacePoly3D);
      const depOisPoly3D_XYZ = activeSurfacePoly3D.map(([lat, lng, elev]) => {
        const xy = toXY(lat, lng);
        return [xy[0], xy[1], elev];
      });
      console.log("DEP OIS polygon projected (x,y,z):", depOisPoly3D_XYZ);
    } else {
      // Default to VSS or if surfaceTypeSelect is not found
      activeSurfacePoly3D = window.lastVssPoly3D;
      evaluationMode = "vss";
      if (!activeSurfacePoly3D) {
        if (window.Swal) {
          Swal.fire({
            icon: "warning",
            title: "No VSS Surface",
            text: "Please draw a VSS surface first.",
            confirmButtonColor: "#0d6efd",
          });
        } else {
          alert("Please draw a VSS surface first.");
        }
        return;
      }
    }

    // Convert active surface polygon to [x, y, z] for planeFitZ if needed, and [x,y] for pointInPolygon
    const activeSurfacePoly3D_XYZ = activeSurfacePoly3D.map(
      ([lat, lng, elev]) => {
        const xy = toXY(lat, lng);
        return [xy[0], xy[1], elev];
      }
    );
    const activeSurfacePolyXY = activeSurfacePoly3D_XYZ.map(([x, y]) => [x, y]);

    const results = [];
    window.lastCsvGeoJson.features.forEach((feature) => {
      const props = feature.properties || {};
      // Attempt to read common variations of name and elevation properties
      const name =
        props.name || props.Name || props.NAME || props.OBJECT_NAM || "";
      const lat = feature.geometry.coordinates[1];
      const lng = feature.geometry.coordinates[0];
      const elev =
        props.elev ??
        props.elevation ??
        props.ALT_m ??
        props.ALT ??
        props.Altitude ??
        props.ELEVATION ??
        props.HEIGHT ??
        null;

      if (
        typeof lat !== "number" ||
        typeof lng !== "number" ||
        typeof elev !== "number" ||
        elev === null
      ) {
        console.warn(
          "Skipping obstacle with invalid/missing coordinates or elevation:",
          feature
        );
        return;
      }

      const obstacleCoordsXY = toXY(lat, lng);
      if (!obstacleCoordsXY || obstacleCoordsXY.length < 2) {
        console.warn("Could not convert obstacle coordinates to XY:", feature);
        return;
      }
      const [obsX, obsY] = obstacleCoordsXY;
      const obsZ = elev;
      // Debug: log obstacle and point-in-polygon result for DEP OIS
      if (evaluationMode === "dep_ois") {
        console.log("Obstacle (lat,lng,elev):", lat, lng, elev);
        console.log("Obstacle projected (x,y):", obsX, obsY);
        const pip = pointInPolygon([obsX, obsY], activeSurfacePolyXY);
        console.log("Point in DEP OIS polygon?", pip);
      }

      if (pointInPolygon([obsX, obsY], activeSurfacePolyXY)) {
        let surfElev = null;
        if (evaluationMode === "vss") {
          surfElev = getVSSElevationAt(obsX, obsY, activeSurfacePoly3D); // activeSurfacePoly3D is in [lat,lng,elev]
        } else if (evaluationMode === "dep_ois") {
          surfElev = getDepElevationAt(obsX, obsY, activeSurfacePoly3D); // Use robust function for DEP OIS
        }
        let remarks = "Not critical";
        if (surfElev === null || isNaN(surfElev)) {
          remarks = "Undetermined";
        } else if (obsZ > surfElev) {
          remarks = "Critical";
        }
        results.push({
          name,
          lat,
          lng,
          x: obsX,
          y: obsY,
          z: obsZ,
          surfElev,
          remarks,
        });
      }
    });

    if (results.length > 0) {
      window.showEvaluationResultsModal(results);
    } else {
      if (window.Swal) {
        Swal.fire({
          icon: "info",
          title: "No Obstacles Evaluated",
          text: "No obstacles were found within the selected surface, or surface elevation could not be determined for any obstacle inside.",
          confirmButtonColor: "#0d6efd",
        });
      } else {
        alert(
          "No obstacles were found within the selected surface, or surface elevation could not be determined for any obstacle inside."
        );
      }
    }
  });
