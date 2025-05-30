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

  let tableHtml = `
    <div style="overflow-x:auto;">
      <table class="table table-bordered table-sm align-middle" style="white-space:nowrap;">
        <thead>
          <tr>
            <th>Name</th>
            <th>WGS84 Coords</th>
            <th>NZTM</th>
            <th>Elevation</th>
            <th>Surface elevation</th>
            <th>Remarks</th>
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
    tableHtml += `
      <tr>
        <td>${r.name || ""}</td>
        <td>
          ${r.lat.toFixed(8)}, ${r.lng.toFixed(8)}<br>
          <span style="font-size:0.85em;">${dmsLat}, ${dmsLng}</span>
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
        <td>${remarksHtml}</td>
      </tr>
    `;
  }
  tableHtml += `
        </tbody>
      </table>
    </div>
    <div style="height:2rem;"></div>
    <div class="d-flex justify-content-end gap-2">
      <button class="btn btn-primary" disabled>Placeholder 1</button>
      <button class="btn btn-secondary" disabled>Placeholder 2</button>
    </div>
  `;

  // Create modal if not exists
  let modal = document.getElementById("evaluationResultsModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "evaluationResultsModal";
    modal.className = "modal fade";
    modal.tabIndex = -1;
    modal.innerHTML = `
      <div class="modal-dialog modal-xl">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Obstacle Evaluation Results</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body" id="evaluationResultsModalBody"></div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }
  document.getElementById("evaluationResultsModalBody").innerHTML = tableHtml;

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
