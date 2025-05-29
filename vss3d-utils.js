// vss3d-utils.js
// Utility functions for 3D VSS surface and obstacle evaluation

// Convert [lat, lng] to [x, y] NZTM (WGS84 to NZTM2000)
export function toXY(lat, lng) {
  return proj4("EPSG:4326", "EPSG:2193", [lng, lat]);
}

// Point-in-polygon test (ray-casting algorithm)
export function pointInPolygon(point, polygon) {
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
export function getVSSElevationAt(x, y, vssPoly3D) {
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
export function isObstacleAboveVSS(obstacle, vssPoly3D) {
  const [x, y] = toXY(obstacle.lat, obstacle.lng);
  const vssElev = getVSSElevationAt(x, y, vssPoly3D);
  if (vssElev === null) return false; // outside VSS
  return obstacle.elev > vssElev;
}

// Bilinear interpolation for a quadrilateral (assumes points ordered: [A, B, C, D])
// A: [x0, y0, z00] (leftBase), B: [x1, y1, z10] (leftEnd), C: [x2, y2, z11] (rightEnd), D: [x3, y3, z01] (rightBase)
// Returns interpolated z at (x, y)
export function bilinearInterpolation(x, y, vssPoly3D) {
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
export function planeFitZ(x, y, p0, p1, p2) {
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
export function barycentricZ(x, y, p0, p1, p2) {
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
