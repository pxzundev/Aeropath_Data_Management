// vss3d-utils.js
// Utility functions for 3D VSS surface and obstacle evaluation

// Convert [lat, lng] to [x, y] NZTM (WGS84 to NZTM2000)
function toXY(lat, lng) {
  return proj4("EPSG:4326", "EPSG:2193", [lng, lat]);
}

// Point-in-polygon test (ray-casting algorithm)
function pointInPolygon(point, polygon) {
  // point: [x, y], polygon: array of [x, y]
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0],
      yi = polygon[i][1];
    const xj = polygon[j][0],
      yj = polygon[j][1];
    const intersect =
      yi > point[1] !== yj > point[1] &&
      point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// Get the expected VSS surface elevation at a given [x, y] (NZTM)
// vssPoly3D: [leftBase, leftEnd, rightEnd, rightBase, leftBase] (each [lat, lng, elev])
// Returns null if point is outside the VSS polygon
// IMPORTANT: This function assumes a VSS-like geometry where elevation is interpolated along a centerline.
// It may not be suitable for other surface types like a simple planar DEP OIS.
// For a generic planar quadrilateral, consider using bilinearInterpolation.
function getVSSElevationAt(x, y, vssPoly3D) {
  // Project VSS polygon to [x, y]
  const vssXY = vssPoly3D.map(([lat, lng]) => toXY(lat, lng));
  if (!pointInPolygon([x, y], vssXY)) return null;

  // Get runway centerline start/end in [x, y, z]
  const leftBase = toXY(vssPoly3D[0][0], vssPoly3D[0][1]);
  const rightBase = toXY(vssPoly3D[3][0], vssPoly3D[3][1]);
  const leftEnd = toXY(vssPoly3D[1][0], vssPoly3D[1][1]);
  const rightEnd = toXY(vssPoly3D[2][0], vssPoly3D[2][1]);
  // Centerline at base and end
  const baseMid = [
    (leftBase[0] + rightBase[0]) / 2,
    (leftBase[1] + rightBase[1]) / 2,
  ];
  const endMid = [
    (leftEnd[0] + rightEnd[0]) / 2,
    (leftEnd[1] + rightEnd[1]) / 2,
  ];
  const baseElev = vssPoly3D[0][2];
  const endElev = vssPoly3D[1][2];

  // Project (x, y) onto centerline to get fraction along
  const dx = endMid[0] - baseMid[0];
  const dy = endMid[1] - baseMid[1];
  const length = Math.sqrt(dx * dx + dy * dy);
  if (length === 0) return baseElev;
  const t = ((x - baseMid[0]) * dx + (y - baseMid[1]) * dy) / (length * length);
  // Clamp t to [0, 1]
  const tClamped = Math.max(0, Math.min(1, t));
  // Linear interpolation of elevation
  return baseElev + (endElev - baseElev) * tClamped;
}

// Check if an obstacle is above the VSS surface
// obstacle: {lat, lng, elev}
function isObstacleAboveVSS(obstacle, vssPoly3D) {
  const [x, y] = toXY(obstacle.lat, obstacle.lng);
  const vssElev = getVSSElevationAt(x, y, vssPoly3D); // This call uses the VSS-specific logic
  if (vssElev === null) return false; // outside VSS
  return obstacle.elev > vssElev;
}

// Check if an obstacle is above the DEP OIS surface using plane fitting
// obstacle: {lat, lng, elev}
// depOisPoly3D: 3D polygon of the DEP OIS, typically [baseLeft, endLeft, endRight, baseRight, baseLeft (optional)].
// We will use the first three distinct points to define the plane, assuming it's planar.
function isObstacleAboveDepOIS(obstacle, depOisPoly3D) {
  const [obsX, obsY] = toXY(obstacle.lat, obstacle.lng);

  // Project DEP OIS polygon to 2D for point-in-polygon test
  const depOisXY = depOisPoly3D.map(([lat, lng]) => toXY(lat, lng));
  if (!pointInPolygon([obsX, obsY], depOisXY)) {
    return false; // Obstacle is outside the horizontal bounds of the DEP OIS
  }

  // Define the plane of the DEP OIS using three of its corners.
  // Ensure these points are in [x, y, z] format for planeFitZ.
  // Using baseLeft, endLeft, and baseRight (assuming depOisPoly3D[0], [1], [3])
  // This assumes depOisPoly3D has at least 4 points if using index 3.
  if (depOisPoly3D.length < 3) {
    console.error(
      "DEP OIS polygon must have at least 3 points to define a plane."
    );
    return false;
  }

  const p0_xyz = [
    ...toXY(depOisPoly3D[0][0], depOisPoly3D[0][1]),
    depOisPoly3D[0][2],
  ]; // e.g., baseLeft
  const p1_xyz = [
    ...toXY(depOisPoly3D[1][0], depOisPoly3D[1][1]),
    depOisPoly3D[1][2],
  ]; // e.g., endLeft
  // Choose the third point carefully to ensure non-collinearity.
  // If depOisPoly3D is [baseLeft, endLeft, endRight, baseRight], then depOisPoly3D[3] is baseRight.
  // Or, if it's just the four corners without closing, depOisPoly3D[2] is endRight.
  // Let's use depOisPoly3D[2] (e.g. endRight) as the third point for the plane definition.
  const p2_xyz = [
    ...toXY(depOisPoly3D[2][0], depOisPoly3D[2][1]),
    depOisPoly3D[2][2],
  ]; // e.g., endRight

  const surfaceElev = planeFitZ(obsX, obsY, p0_xyz, p1_xyz, p2_xyz);

  if (surfaceElev === null) {
    // This might happen if planeFitZ fails (e.g., collinear points)
    console.warn(
      "Could not determine DEP OIS surface elevation at obstacle location (planeFitZ failed).",
      { obsX, obsY, p0_xyz, p1_xyz, p2_xyz }
    );
    return false; // For safety, consider it not penetrating if elevation cannot be determined.
  }

  return obstacle.elev > surfaceElev;
}

// Get the expected DEP OIS surface elevation at a given [x, y] (NZTM)
// depOisPoly3D: [baseLeft, endLeft, endRight, baseRight, baseLeft (optional)] (each [lat, lng, elev])
// Returns null if point is outside the DEP OIS polygon
function getDepElevationAt(x, y, depOisPoly3D) {
  // Project DEP OIS polygon to [x, y]
  const depOisXY = depOisPoly3D.map(([lat, lng]) => toXY(lat, lng));
  if (!pointInPolygon([x, y], depOisXY)) return null;

  // Get base and end midpoints in [x, y]
  const baseLeft = toXY(depOisPoly3D[0][0], depOisPoly3D[0][1]);
  const baseRight = toXY(depOisPoly3D[3][0], depOisPoly3D[3][1]);
  const endLeft = toXY(depOisPoly3D[1][0], depOisPoly3D[1][1]);
  const endRight = toXY(depOisPoly3D[2][0], depOisPoly3D[2][1]);
  const baseMid = [
    (baseLeft[0] + baseRight[0]) / 2,
    (baseLeft[1] + baseRight[1]) / 2,
  ];
  const endMid = [
    (endLeft[0] + endRight[0]) / 2,
    (endLeft[1] + endRight[1]) / 2,
  ];
  const baseElev = (depOisPoly3D[0][2] + depOisPoly3D[3][2]) / 2;
  const endElev = (depOisPoly3D[1][2] + depOisPoly3D[2][2]) / 2;

  // Project (x, y) onto centerline to get fraction along
  const dx = endMid[0] - baseMid[0];
  const dy = endMid[1] - baseMid[1];
  const length = Math.sqrt(dx * dx + dy * dy);
  if (length === 0) return baseElev;
  const t = ((x - baseMid[0]) * dx + (y - baseMid[1]) * dy) / (length * length);
  // Clamp t to [0, 1]
  const tClamped = Math.max(0, Math.min(1, t));
  // Linear interpolation of elevation
  return baseElev + (endElev - baseElev) * tClamped;
}

// Bilinear interpolation for a quadrilateral (assumes points ordered: [A, B, C, D])
// A: [x0, y0, z00] (leftBase), B: [x1, y1, z10] (leftEnd), C: [x2, y2, z11] (rightEnd), D: [x3, y3, z01] (rightBase)
// Returns interpolated z at (x, y)
function bilinearInterpolation(x, y, vssPoly3D) {
  // Project corners to [x, y, z]
  const A = [...toXY(vssPoly3D[0][0], vssPoly3D[0][1]), vssPoly3D[0][2]];
  const B = [...toXY(vssPoly3D[1][0], vssPoly3D[1][1]), vssPoly3D[1][2]];
  const C = [...toXY(vssPoly3D[2][0], vssPoly3D[2][1]), vssPoly3D[2][2]];
  const D = [...toXY(vssPoly3D[3][0], vssPoly3D[3][1]), vssPoly3D[3][2]];
  // Map (x, y) to (u, v) in the quad (approximate by solving for u, v in parallelogram)
  // Use A as origin, AB as u, AD as v
  const AB = [B[0] - A[0], B[1] - A[1]];
  const AD = [D[0] - A[0], D[1] - A[1]];
  const AP = [x - A[0], y - A[1]];
  // Solve [AB AD] * [u v]^T = AP
  const det = AB[0] * AD[1] - AB[1] * AD[0];
  if (Math.abs(det) < 1e-8) return null; // degenerate
  const u = (AP[0] * AD[1] - AP[1] * AD[0]) / det;
  const v = (AB[0] * AP[1] - AB[1] * AP[0]) / det;
  // Clamp u, v to [0, 1]
  const uu = Math.max(0, Math.min(1, u));
  const vv = Math.max(0, Math.min(1, v));
  // Bilinear interpolation
  const z =
    (1 - uu) * (1 - vv) * A[2] +
    uu * (1 - vv) * B[2] +
    uu * vv * C[2] +
    (1 - uu) * vv * D[2];
  return z;
}

// Plane fitting for a triangle (returns z at (x, y) for triangle [p0, p1, p2])
// p0, p1, p2: [x, y, z]
function planeFitZ(x, y, p0, p1, p2) {
  // Plane: z = a*x + b*y + c
  const mat = [
    [p0[0], p0[1], 1],
    [p1[0], p1[1], 1],
    [p2[0], p2[1], 1],
  ];
  const vec = [p0[2], p1[2], p2[2]];
  // Solve for [a, b, c] using Cramer's rule
  const det =
    mat[0][0] * (mat[1][1] * mat[2][2] - mat[2][1] * mat[1][2]) -
    mat[0][1] * (mat[1][0] * mat[2][2] - mat[2][0] * mat[1][2]) +
    mat[0][2] * (mat[1][0] * mat[2][1] - mat[2][0] * mat[1][1]);
  if (Math.abs(det) < 1e-8) return null;
  // Compute determinants for a, b, c
  const detA =
    vec[0] * (mat[1][1] * mat[2][2] - mat[2][1] * mat[1][2]) -
    mat[0][1] * (vec[1] * mat[2][2] - mat[2][1] * vec[2]) +
    mat[0][2] * (vec[1] * mat[2][1] - mat[2][1] * vec[2]);
  const detB =
    mat[0][0] * (vec[1] * mat[2][2] - mat[2][1] * vec[2]) -
    vec[0] * (mat[1][0] * mat[2][2] - mat[2][0] * mat[1][2]) +
    mat[0][2] * (mat[1][0] * vec[2] - vec[1] * mat[2][0]);
  const detC =
    mat[0][0] * (mat[1][1] * vec[2] - vec[1] * mat[2][1]) -
    mat[0][1] * (mat[1][0] * vec[2] - vec[1] * mat[2][0]) +
    vec[0] * (mat[1][0] * mat[2][1] - mat[2][0] * mat[1][1]);
  const a = detA / det;
  const b = detB / det;
  const c = detC / det;
  return a * x + b * y + c;
}

// Barycentric interpolation for a triangle (returns z at (x, y) for triangle [p0, p1, p2])
// p0, p1, p2: [x, y, z]
function barycentricZ(x, y, p0, p1, p2) {
  // Compute barycentric coordinates
  const denom =
    (p1[1] - p2[1]) * (p0[0] - p2[0]) + (p2[0] - p1[0]) * (p0[1] - p2[1]);
  if (Math.abs(denom) < 1e-8) return null;
  const w1 =
    ((p1[1] - p2[1]) * (x - p2[0]) + (p2[0] - p1[0]) * (y - p2[1])) / denom;
  const w2 =
    ((p2[1] - p0[1]) * (x - p2[0]) + (p0[0] - p2[0]) * (y - p2[1])) / denom;
  const w3 = 1 - w1 - w2;
  return w1 * p0[2] + w2 * p1[2] + w3 * p2[2];
}

// Get the expected DEP OIS surface elevation at a given [x, y] (NZTM)
// depOisPoly3D: [baseLeft, endLeft, endRight, baseRight, baseLeft (optional)] (each [lat, lng, elev])
// Returns null if point is outside the DEP OIS polygon
function getDepOISElevationAt(x, y, depOisPoly3D) {
  // Project DEP OIS polygon to [x, y]
  const depOisXY = depOisPoly3D.map(([lat, lng]) => toXY(lat, lng));
  if (!pointInPolygon([x, y], depOisXY)) return null;

  // Get base and end midpoints in [x, y]
  const baseLeft = toXY(depOisPoly3D[0][0], depOisPoly3D[0][1]);
  const baseRight = toXY(depOisPoly3D[3][0], depOisPoly3D[3][1]);
  const endLeft = toXY(depOisPoly3D[1][0], depOisPoly3D[1][1]);
  const endRight = toXY(depOisPoly3D[2][0], depOisPoly3D[2][1]);
  const baseMid = [
    (baseLeft[0] + baseRight[0]) / 2,
    (baseLeft[1] + baseRight[1]) / 2,
  ];
  const endMid = [
    (endLeft[0] + endRight[0]) / 2,
    (endLeft[1] + endRight[1]) / 2,
  ];
  const baseElev = (depOisPoly3D[0][2] + depOisPoly3D[3][2]) / 2;
  const endElev = (depOisPoly3D[1][2] + depOisPoly3D[2][2]) / 2;

  // Project (x, y) onto centerline to get fraction along
  const dx = endMid[0] - baseMid[0];
  const dy = endMid[1] - baseMid[1];
  const length = Math.sqrt(dx * dx + dy * dy);
  if (length === 0) return baseElev;
  const t = ((x - baseMid[0]) * dx + (y - baseMid[1]) * dy) / (length * length);
  // Clamp t to [0, 1]
  const tClamped = Math.max(0, Math.min(1, t));
  // Linear interpolation of elevation
  return baseElev + (endElev - baseElev) * tClamped;
}

// At the end of the file, expose functions for global use (if not using modules)
if (typeof window !== "undefined") {
  window.vss3dUtils = {
    toXY,
    pointInPolygon,
    getVSSElevationAt,
    getDepElevationAt,
    isObstacleAboveVSS,
    isObstacleAboveDepOIS, // Add the new function here
    bilinearInterpolation,
    planeFitZ,
    barycentricZ,
    getDepOISElevationAt,
  };
}
