// csv-modal.js
// console.log("csv-modal.js loaded, window.geolib is:", window.geolib); // Keep this for initial load check if desired, or remove.
// Handles CSV upload, preview, column selection, and conversion to JSON for VSS evaluation

// Utility to convert column index to letter (A, B, ...)
function colIdxToLetter(idx) {
  return String.fromCharCode(65 + idx);
}

// Parse CSV string to array of arrays
function parseCSV(csv, delimiter = ",") {
  // Split into lines
  const lines = csv.split(/\r?\n/).filter((line) => line.trim().length > 0);
  return lines.map((line) => {
    // Simple CSV split, handles quoted fields
    const result = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  });
}

// Helper function to parse coordinate strings
function parseCoordinateString(coordStr) {
  if (!coordStr || typeof coordStr !== "string") {
    console.warn("Invalid coordinate string input:", coordStr);
    return null;
  }

  let originalCoordStr = coordStr.trim();

  // Attempt to parse as a simple float first (already decimal degrees)
  const simpleFloat = parseFloat(originalCoordStr);
  if (!isNaN(simpleFloat) && originalCoordStr.match(/^-?\d*\.?\d+$/)) {
    // Check if it's purely numeric (with optional sign and decimal)
    // and doesn't contain NSEW characters, which would imply it's not yet parsed.
    if (!/[NSEW]/i.test(originalCoordStr)) {
      return simpleFloat;
    }
  }

  let strForParsing = originalCoordStr.toUpperCase();
  let valDirection = 1;

  // Extract and remove direction character (N, S, E, W)
  // It can be at the beginning or end, optionally with a space
  if (
    strForParsing.startsWith("N") ||
    strForParsing.startsWith("S") ||
    strForParsing.startsWith("E") ||
    strForParsing.startsWith("W")
  ) {
    const dir = strForParsing.charAt(0);
    if (dir === "S" || dir === "W") {
      valDirection = -1;
    }
    strForParsing = strForParsing.substring(1).trim();
  } else if (
    strForParsing.endsWith("N") ||
    strForParsing.endsWith("S") ||
    strForParsing.endsWith("E") ||
    strForParsing.endsWith("W")
  ) {
    const dir = strForParsing.charAt(strForParsing.length - 1);
    if (dir === "S" || dir === "W") {
      valDirection = -1;
    }
    strForParsing = strForParsing.slice(0, -1).trim();
  }

  // Remove common DMS symbols and other non-numeric characters except decimal point and minus sign for negative numbers if direction was not specified.
  // Normalize multiple spaces to a single space for splitting.
  strForParsing = strForParsing
    .replace(/[°º'’"dms]/gi, " ") // Replace symbols with space
    .replace(/\s+/g, " ") // Normalize spaces
    .trim();

  // Handle formats like ddmmss.sss or ddmm.mmm by inserting spaces
  // Check if it's a sequence of digits, possibly with a decimal, and no spaces yet.
  if (/^\d+\.?\d*$/.test(strForParsing) && strForParsing.length > 4) {
    // Heuristic: length > 4 to avoid misinterpreting DD.ddd
    let tempStr = strForParsing.replace(".", ""); // Remove decimal to check length for DMS/DM patterns
    let parts;
    if (
      tempStr.length >= 5 &&
      tempStr.length <= 7 &&
      strForParsing.includes(".")
    ) {
      // Likely ddmm.mmm (e.g. 3807.581 -> 38 07.581)
      const minutesPartIndex =
        tempStr.length === 7 ? 4 : tempStr.length === 6 ? 3 : 2; // Heuristic for ddmm.mmm or dmm.mmm
      const degrees = strForParsing.substring(0, minutesPartIndex - 2);
      const minutes = strForParsing.substring(minutesPartIndex - 2);
      parts = [degrees, minutes];
      strForParsing = parts.join(" ");
    } else if (tempStr.length >= 6 && !strForParsing.includes(".")) {
      // ddmmss (no decimal)
      parts = [
        strForParsing.substring(0, 2),
        strForParsing.substring(2, 4),
        strForParsing.substring(4),
      ];
      strForParsing = parts.join(" ");
    } else if (tempStr.length >= 7 && strForParsing.includes(".")) {
      // ddmmss.sss (e.g. 380751.581 -> 38 07 51.581)
      // Find the decimal point to correctly split seconds
      const decimalIdx = strForParsing.indexOf(".");
      let s = strForParsing.substring(4, decimalIdx + 4);
      if (decimalIdx !== -1 && decimalIdx > 4) {
        // Ensure decimal is after potential minutes part
        const d = strForParsing.substring(0, 2);
        const m = strForParsing.substring(2, 4);
        s = strForParsing.substring(4);
        parts = [d, m, s];
        strForParsing = parts.join(" ");
      } else if (decimalIdx === -1 && tempStr.length >= 6) {
        // No decimal, but long enough for ddmmss
        parts = [
          strForParsing.substring(0, 2),
          strForParsing.substring(2, 4),
          strForParsing.substring(4),
        ];
        strForParsing = parts.join(" ");
      }
      // If still not spaced, it might be a different compact format or already decimal
    }
  }

  const numericParts = strForParsing
    .split(" ")
    .map((part) => parseFloat(part))
    .filter((part) => !isNaN(part));

  if (numericParts.length === 0) {
    console.warn("Could not extract numeric parts from:", originalCoordStr);
    return null;
  }

  // If only one part after all processing, it might be decimal degrees that had a direction character.
  if (numericParts.length === 1) {
    return numericParts[0] * valDirection;
  }
  if (numericParts.length === 2) {
    // Degrees, Decimal Minutes (e.g., DD MM.MMM)
    const decimal = (numericParts[0] + numericParts[1] / 60) * valDirection;
    return decimal;
  }
  if (numericParts.length === 3) {
    // Degrees, Minutes, Seconds (e.g., DD MM SS.SSS)
    const decimal =
      (numericParts[0] + numericParts[1] / 60 + numericParts[2] / 3600) *
      valDirection;
    return decimal;
  }

  console.warn(
    "Fallback parsing failed for:",
    originalCoordStr,
    "Processed to:",
    strForParsing,
    "Parts:",
    numericParts
  );
  return null;
}

// Show Bootstrap modal with CSV preview and column selectors
function showCSVModal(csvArray, onSave) {
  // Remove any existing modal (including fade-out)
  document.querySelectorAll(".modal.fade.show").forEach((el) => {
    if (bootstrap.Modal.getInstance(el)) {
      bootstrap.Modal.getInstance(el).hide();
    }
    el.remove();
  });
  const existing = document.getElementById("csvPreviewModal");
  if (existing) existing.remove();

  // Build table header
  // Find the maximum number of columns in the first 11 rows (header + 10 data rows)
  const previewRows = csvArray.slice(0, 11); // Includes header + 10 data rows
  const colCount = Math.max(...previewRows.map((row) => row.length));

  // Row 1 of thead: Lettered columns (A, B, C...)
  const letterHeaderRow = Array.from(
    { length: colCount },
    (_, i) => `<th>${colIdxToLetter(i)}</th>`
  ).join("");

  // Row 2 of thead: Actual CSV header content
  let actualCsvHeaderRow = "";
  if (csvArray.length > 0) {
    const actualHeaderCells = csvArray[0];
    const paddedActualHeaderCells = [...actualHeaderCells];
    while (paddedActualHeaderCells.length < colCount)
      paddedActualHeaderCells.push(""); // Pad if shorter
    actualCsvHeaderRow = `<tr>${paddedActualHeaderCells
      .map(
        (cell) =>
          `<th style="font-weight:normal; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:200px;">${String(
            cell
          )
            .replace(/\n|\r/g, " ")
            .replace(/\s+/g, " ")
            .trim()}</th>`
      )
      .join("")}</tr>`;
  }

  const dataRows = previewRows
    .slice(1) // Start from the second row for data preview
    .map((row) => {
      const padded = [...row];
      while (padded.length < colCount) padded.push("");
      return `<tr>${padded
        .map(
          (cell) =>
            `<td style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:200px;">${String(
              cell
            )
              .replace(/\n|\r/g, " ")
              .replace(/\s+/g, " ")
              .trim()}</td>`
        )
        .join("")}</tr>`;
    })
    .join("");

  // Dropdowns for Name, Lat, Lng, Elev
  const dropdown = (id, label) => `
    <div class="col">
      <label for="${id}" class="form-label mb-0">${label}</label>
      <select class="form-select" id="${id}">
        <option value="">Select</option>
        ${Array.from(
          { length: colCount },
          (_, i) => `<option value="${i}">${colIdxToLetter(i)}</option>`
        ).join("")}
      </select>
    </div>
  `;

  const modalHtml = `
    <div class="modal fade" id="csvPreviewModal" tabindex="-1" aria-labelledby="csvPreviewModalLabel" aria-hidden="true">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="csvPreviewModalLabel">CSV Preview</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <div class="table-responsive mb-3" style="overflow-x:auto;">
              <table class="table table-bordered table-sm" style="min-width:900px;">
                <thead>
                  <tr>${letterHeaderRow}</tr>
                  ${actualCsvHeaderRow} 
                </thead>
                <tbody>${dataRows}</tbody>
              </table>
            </div>
            <div class="row g-2 align-items-end mb-2">
              ${dropdown("csv-col-name", "Name")}
              ${dropdown("csv-col-lat", "Latitude")}
              ${dropdown("csv-col-lng", "Longitude")}
              ${dropdown("csv-col-elev", "Elevation")}
              <div class="col-auto">
                <button id="csv-save-btn" class="btn btn-primary">Save</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  // Remove any lingering modal and backdrop before inserting new modal
  const existingModal = document.getElementById("csvPreviewModal");
  if (existingModal) {
    if (bootstrap.Modal.getInstance(existingModal)) {
      bootstrap.Modal.getInstance(existingModal).hide();
    }
    existingModal.remove();
  }
  document.querySelectorAll(".modal-backdrop").forEach((el) => el.remove());
  document.body.insertAdjacentHTML("beforeend", modalHtml);
  const modalEl = document.getElementById("csvPreviewModal");
  const modal = new bootstrap.Modal(modalEl);
  // Ensure modal/backdrop are removed after close (robust cleanup)
  modalEl.addEventListener("hidden.bs.modal", function () {
    modalEl.remove();
    document.querySelectorAll(".modal-backdrop").forEach((el) => el.remove());
  });

  document.getElementById("csv-save-btn").onclick = function (e) {
    e.preventDefault();
    const nameIdx = document.getElementById("csv-col-name").value;
    const latIdx = document.getElementById("csv-col-lat").value;
    const lngIdx = document.getElementById("csv-col-lng").value;
    const elevIdx = document.getElementById("csv-col-elev").value;
    if (nameIdx === "" || latIdx === "" || lngIdx === "" || elevIdx === "") {
      alert("Please select all columns.");
      return;
    }
    // Convert to JSON
    const result = [];
    for (let i = 1; i < csvArray.length; i++) {
      const row = csvArray[i];
      // Pad row to colCount for safety
      const padded = [...row];
      while (padded.length < colCount) padded.push("");

      const latStr = padded[latIdx];
      const lngStr = padded[lngIdx];

      result.push({
        name: padded[nameIdx],
        lat: parseCoordinateString(latStr), // Use new parsing function
        lng: parseCoordinateString(lngStr), // Use new parsing function
        elev: parseFloat(padded[elevIdx]),
      });
    }
    modal.hide();
    if (onSave) onSave(result, csvArray);
  };
  // Use requestAnimationFrame to guarantee modal is in DOM before showing
  requestAnimationFrame(() => modal.show());
  return { modal, modalEl };
}

// Attach handler to file input (call this from main.js)
function setupCSVUploadHandler(inputId, onSave, getRawArray) {
  const input = document.getElementById(inputId);
  if (!input) return;

  let currentRawArray = null; // Store the most recently parsed CSV data

  // Clear the input value on every click, so the file dialog always allows selecting the same file
  input.addEventListener("click", function () {
    input.value = "";
  });

  input.addEventListener("change", function (e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (evt) {
      const csv = evt.target.result;
      const arr = parseCSV(csv);
      currentRawArray = arr; // Store parsed array
      // Pass a combined onSave that also updates the global/external storage if needed
      const combinedOnSave = (jsonData, originalArr) => {
        if (onSave) onSave(jsonData, originalArr);
        // The original onSave in main.js should handle setting window.vssRawCSV or window.depOisRawCSV
      };
      showCSVModal(arr, combinedOnSave);
    };
    reader.readAsText(file);
  });

  // If a getRawArray function is provided, attach a redefine handler
  // We will now use currentRawArray instead of getRawArray for immediate access
  const redefineBtnId = inputId.replace("upload", "redefine");
  const redefineBtn = document.getElementById(redefineBtnId);

  if (redefineBtn) {
    redefineBtn.addEventListener("click", function () {
      // const arr = getRawArray(); // OLD: using potentially stale data
      const arr = currentRawArray; // NEW: using the most recently parsed data

      if (Array.isArray(arr) && arr.length > 1 && arr[0].length > 0) {
        // Pass a combined onSave that also updates the global/external storage if needed
        const combinedOnSave = (jsonData, originalArr) => {
          if (onSave) onSave(jsonData, originalArr);
          // The original onSave in main.js should handle setting window.vssRawCSV or window.depOisRawCSV
        };
        showCSVModal(arr, combinedOnSave);
      } else {
        alert(
          "No CSV data has been uploaded yet for this session, or the data is invalid. Please upload a CSV file first."
        );
      }
    });
  }
}

// Global store for raw CSV data (keyed by inputId)
// This is an alternative to window.vssRawCSV / window.depOisRawCSV if we want to centralize
// const rawCSVDataStore = {};
