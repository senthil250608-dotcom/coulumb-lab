import {
  ColormapType,
  ContourDensity,
  FieldSample,
  PointCharge,
  PresetConfig,
} from '../types/physics';

/**
 * Coulomb constant k_e scaled for charges in µC (10^-6 C), distances in m,
 * returning Potential V in kV (10^3 V) and Field E in kV/m (10^3 V/m).
 * k_e * 10^-6 / 10^3 = 8.9875517923
 */
export const K_SCALED = 8.9875517923;

/** Softening length in meters to prevent division by zero at r -> 0 */
const SOFTENING_EPS_SQ = 0.0016; // (0.04 m)^2

/** Physical radius in meters of a rendered charge disc */
export const CHARGE_HIT_RADIUS_M = 0.24;

export const HEATMAP_E_MIN = 0.4; // kV/m
export const HEATMAP_E_MAX = 400.0; // kV/m

export interface WorldBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface FieldLinePath {
  points: Array<{ x: number; y: number }>;
  /** True if traced forward from +, false if traced backward from - */
  forward: boolean;
}

export interface EquipotentialSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface EquipotentialLevel {
  levelKv: number;
  segments: EquipotentialSegment[];
  labelPos: { x: number; y: number } | null;
}

export const PRESETS: PresetConfig[] = [
  {
    id: 'dipole',
    name: 'Electric Dipole',
    summary: 'Equal and opposite charges (+2 µC, -2 µC) separated by 2.4 m',
    charges: [
      { x: -1.2, y: 0, q: 2 },
      { x: 1.2, y: 0, q: -2 },
    ],
  },
  {
    id: 'quadrupole',
    name: 'Quadrupole',
    summary: 'Four alternating ±2 µC charges arranged in a 2.2 m square',
    charges: [
      { x: -1.1, y: 1.1, q: 2 },
      { x: 1.1, y: 1.1, q: -2 },
      { x: 1.1, y: -1.1, q: 2 },
      { x: -1.1, y: -1.1, q: -2 },
    ],
  },
  {
    id: 'repulsion',
    name: 'Like-Charge Saddle',
    summary: 'Two +2.5 µC charges showing a zero-field saddle point at the origin',
    charges: [
      { x: -1.3, y: 0, q: 2.5 },
      { x: 1.3, y: 0, q: 2.5 },
    ],
  },
  {
    id: 'asymmetric',
    name: 'Asymmetric (+3 / -1)',
    summary: 'Demonstrates field line density proportional to charge magnitude',
    charges: [
      { x: -1.3, y: 0, q: 3 },
      { x: 1.3, y: 0, q: -1 },
    ],
  },
  {
    id: 'capacitor',
    name: 'Parallel Plates',
    summary: 'Oppositely charged linear arrays approximating a uniform interior field',
    charges: [
      { x: -1.4, y: 1.6, q: 1 },
      { x: -1.4, y: 0.8, q: 1 },
      { x: -1.4, y: 0, q: 1 },
      { x: -1.4, y: -0.8, q: 1 },
      { x: -1.4, y: -1.6, q: 1 },
      { x: 1.4, y: 1.6, q: -1 },
      { x: 1.4, y: 0.8, q: -1 },
      { x: 1.4, y: 0, q: -1 },
      { x: 1.4, y: -0.8, q: -1 },
      { x: 1.4, y: -1.6, q: -1 },
    ],
  },
  {
    id: 'shield',
    name: 'Faraday Ring',
    summary: 'Eight +1 µC charges on a circle creating a near-zero central field',
    charges: Array.from({ length: 8 }, (_, idx) => {
      const angle = (idx / 8) * Math.PI * 2;
      return {
        x: Number((Math.cos(angle) * 1.6).toFixed(3)),
        y: Number((Math.sin(angle) * 1.6).toFixed(3)),
        q: 1,
      };
    }),
  },
];

/**
 * Evaluate electric potential V (kV) and electric field vector E (kV/m) at (x, y).
 */
export function computeFieldAndPotential(
  x: number,
  y: number,
  charges: PointCharge[]
): FieldSample {
  let v = 0;
  let ex = 0;
  let ey = 0;

  for (let i = 0; i < charges.length; i++) {
    const c = charges[i];
    if (c.q === 0) continue;
    const dx = x - c.x;
    const dy = y - c.y;
    const r2 = dx * dx + dy * dy + SOFTENING_EPS_SQ;
    const r = Math.sqrt(r2);
    const invR = 1 / r;
    const invR3 = invR / r2;
    const kq = K_SCALED * c.q;

    v += kq * invR;
    ex += kq * dx * invR3;
    ey += kq * dy * invR3;
  }

  return {
    v,
    ex,
    ey,
    eMag: Math.hypot(ex, ey),
  };
}

/**
 * Compute electrostatic force F (in millinewtons, mN) acting on a specific charge.
 * Since q is in µC (10^-6 C) and E is in kV/m (10^3 V/m),
 * q * E has units 10^-6 * 10^3 = 10^-3 N = 1 mN directly!
 */
export function computeForceOnCharge(
  target: PointCharge,
  charges: PointCharge[]
): { fx: number; fy: number; fMag: number } {
  let ex = 0;
  let ey = 0;

  for (let i = 0; i < charges.length; i++) {
    const other = charges[i];
    if (other.id === target.id || other.q === 0) continue;
    const dx = target.x - other.x;
    const dy = target.y - other.y;
    const r2 = dx * dx + dy * dy + SOFTENING_EPS_SQ;
    const invR3 = 1 / (r2 * Math.sqrt(r2));
    const kq = K_SCALED * other.q;
    ex += kq * dx * invR3;
    ey += kq * dy * invR3;
  }

  const fx = target.q * ex;
  const fy = target.q * ey;
  return { fx, fy, fMag: Math.hypot(fx, fy) };
}

/**
 * Normalized unit electric field direction at (x, y).
 */
function sampleUnitField(
  x: number,
  y: number,
  charges: PointCharge[]
): { ux: number; uy: number; mag: number } {
  let ex = 0;
  let ey = 0;

  for (let i = 0; i < charges.length; i++) {
    const c = charges[i];
    if (c.q === 0) continue;
    const dx = x - c.x;
    const dy = y - c.y;
    const r2 = dx * dx + dy * dy + SOFTENING_EPS_SQ;
    const invR3 = 1 / (r2 * Math.sqrt(r2));
    const kq = K_SCALED * c.q;
    ex += kq * dx * invR3;
    ey += kq * dy * invR3;
  }

  const mag = Math.hypot(ex, ey);
  if (mag < 1e-7) {
    return { ux: 0, uy: 0, mag: 0 };
  }
  return { ux: ex / mag, uy: ey / mag, mag };
}

/**
 * Integrate a single field streamline using 4th-order Runge-Kutta (RK4).
 */
function traceFieldLine(
  startX: number,
  startY: number,
  directionSign: 1 | -1,
  charges: PointCharge[],
  bounds: WorldBounds,
  sourceId: string
): { points: Array<{ x: number; y: number }>; hitChargeId: string | null; arrivalAngle: number | null } {
  const stepSize = 0.045;
  const maxSteps = 420;
  const stopRadius = 0.21;
  const stopRadiusSq = stopRadius * stopRadius;
  const margin = 1.2;

  const points: Array<{ x: number; y: number }> = [{ x: startX, y: startY }];
  let x = startX;
  let y = startY;
  let prevDx = 0;
  let prevDy = 0;

  for (let step = 0; step < maxSteps; step++) {
    const k1 = sampleUnitField(x, y, charges);
    if (k1.mag < 1e-6) break;
    const k1x = k1.ux * directionSign;
    const k1y = k1.uy * directionSign;

    const k2 = sampleUnitField(x + 0.5 * stepSize * k1x, y + 0.5 * stepSize * k1y, charges);
    if (k2.mag < 1e-6) break;
    const k2x = k2.ux * directionSign;
    const k2y = k2.uy * directionSign;

    const k3 = sampleUnitField(x + 0.5 * stepSize * k2x, y + 0.5 * stepSize * k2y, charges);
    if (k3.mag < 1e-6) break;
    const k3x = k3.ux * directionSign;
    const k3y = k3.uy * directionSign;

    const k4 = sampleUnitField(x + stepSize * k3x, y + stepSize * k3y, charges);
    if (k4.mag < 1e-6) break;
    const k4x = k4.ux * directionSign;
    const k4y = k4.uy * directionSign;

    const dx = (stepSize / 6) * (k1x + 2 * k2x + 2 * k3x + k4x);
    const dy = (stepSize / 6) * (k1y + 2 * k2y + 2 * k3y + k4y);

    // Prevent oscillation around saddle points or sharp cusps
    if (step > 2 && dx * prevDx + dy * prevDy < -0.5 * stepSize * stepSize) {
      break;
    }

    x += dx;
    y += dy;
    prevDx = dx;
    prevDy = dy;

    points.push({ x, y });

    // Check termination inside another charge core
    for (let i = 0; i < charges.length; i++) {
      const c = charges[i];
      if (c.q === 0) continue;
      if (step < 4 && c.id === sourceId) continue;
      const cdx = x - c.x;
      const cdy = y - c.y;
      if (cdx * cdx + cdy * cdy <= stopRadiusSq) {
        // Snap endpoint cleanly onto charge perimeter
        const dist = Math.hypot(cdx, cdy) || 1e-6;
        points[points.length - 1] = {
          x: c.x + (cdx / dist) * stopRadius,
          y: c.y + (cdy / dist) * stopRadius,
        };
        return {
          points,
          hitChargeId: c.id,
          arrivalAngle: Math.atan2(cdy, cdx),
        };
      }
    }

    // Check viewport bounds with margin
    if (
      x < bounds.minX - margin ||
      x > bounds.maxX + margin ||
      y < bounds.minY - margin ||
      y > bounds.maxY + margin
    ) {
      break;
    }
  }

  return { points, hitChargeId: null, arrivalAngle: null };
}

/**
 * Generate electrostatic field lines whose seed count is proportional to |q|.
 * Traces forward from positive charges and fills uncovered sectors around negative charges.
 */
export function generateFieldLines(
  charges: PointCharge[],
  densityPerMicroCoulomb: number,
  bounds: WorldBounds
): FieldLinePath[] {
  const activeCharges = charges.filter((c) => Math.abs(c.q) > 0.01);
  if (activeCharges.length === 0) return [];

  const lines: FieldLinePath[] = [];
  const seedRadius = 0.22;
  const arrivalAnglesByCharge = new Map<string, number[]>();

  for (const c of activeCharges) {
    arrivalAnglesByCharge.set(c.id, []);
  }

  // Pass 1: Seed forward lines from all positive charges
  for (const c of activeCharges) {
    if (c.q <= 0) continue;
    const count = Math.max(4, Math.round(densityPerMicroCoulomb * Math.abs(c.q)));
    // Slight angular offset helps avoid exact axis-aligned degeneracies on symmetric presets
    const angleOffset = Math.PI / count;

    for (let i = 0; i < count; i++) {
      const theta = angleOffset + (i / count) * Math.PI * 2;
      const sx = c.x + Math.cos(theta) * seedRadius;
      const sy = c.y + Math.sin(theta) * seedRadius;
      const traced = traceFieldLine(sx, sy, 1, activeCharges, bounds, c.id);
      if (traced.points.length >= 2) {
        lines.push({ points: traced.points, forward: true });
      }
      if (traced.hitChargeId && traced.arrivalAngle !== null) {
        const list = arrivalAnglesByCharge.get(traced.hitChargeId);
        if (list) list.push(traced.arrivalAngle);
      }
    }
  }

  // Pass 2: Seed backward lines from negative charges to cover unmatched flux sectors
  for (const c of activeCharges) {
    if (c.q >= 0) continue;
    const expectedCount = Math.max(4, Math.round(densityPerMicroCoulomb * Math.abs(c.q)));
    const arrived = arrivalAnglesByCharge.get(c.id) ?? [];
    const remaining = expectedCount - arrived.length;
    if (remaining <= 0) continue;

    const anglesToSeed: number[] = [];

    if (arrived.length === 0) {
      const angleOffset = Math.PI / expectedCount;
      for (let i = 0; i < expectedCount; i++) {
        anglesToSeed.push(angleOffset + (i / expectedCount) * Math.PI * 2);
      }
    } else {
      // Normalize arrival angles to [0, 2π) and find largest angular gaps
      const sorted = arrived
        .map((a) => ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2))
        .sort((a, b) => a - b);

      const gaps: Array<{ start: number; span: number }> = [];
      for (let i = 0; i < sorted.length; i++) {
        const a1 = sorted[i];
        const a2 = i + 1 < sorted.length ? sorted[i + 1] : sorted[0] + Math.PI * 2;
        gaps.push({ start: a1, span: a2 - a1 });
      }

      // Allocate remaining lines proportionally across angular gaps larger than ideal spacing
      const idealGap = (Math.PI * 2) / expectedCount;
      let totalExcess = 0;
      const gapWeights = gaps.map((g) => {
        const excess = Math.max(0, g.span - idealGap * 0.65);
        totalExcess += excess;
        return excess;
      });

      if (totalExcess > 0.05) {
        let seededSoFar = 0;
        for (let gIdx = 0; gIdx < gaps.length; gIdx++) {
          const share = Math.round((gapWeights[gIdx] / totalExcess) * remaining);
          const countInGap =
            gIdx === gaps.length - 1
              ? Math.max(0, remaining - seededSoFar)
              : Math.min(share, remaining - seededSoFar);
          for (let k = 1; k <= countInGap; k++) {
            anglesToSeed.push(gaps[gIdx].start + (k / (countInGap + 1)) * gaps[gIdx].span);
          }
          seededSoFar += countInGap;
        }
      }
    }

    for (const theta of anglesToSeed) {
      const sx = c.x + Math.cos(theta) * seedRadius;
      const sy = c.y + Math.sin(theta) * seedRadius;
      const traced = traceFieldLine(sx, sy, -1, activeCharges, bounds, c.id);
      // Reverse points so arrowheads always point along +E (into negative charge)
      if (traced.points.length >= 2) {
        lines.push({ points: traced.points.reverse(), forward: false });
      }
    }
  }

  return lines;
}

export function getContourLevels(density: ContourDensity): number[] {
  switch (density) {
    case ContourDensity.Coarse:
      return [-120, -45, -18, -7, -2.5, 0, 2.5, 7, 18, 45, 120];
    case ContourDensity.Fine:
      return [
        -220, -140, -90, -60, -40, -26, -17, -11, -7, -4.5, -2.5, -1.2, 0,
        1.2, 2.5, 4.5, 7, 11, 17, 26, 40, 60, 90, 140, 220,
      ];
    case ContourDensity.Standard:
    default:
      return [-160, -85, -45, -24, -12, -6, -2.5, 0, 2.5, 6, 12, 24, 45, 85, 160];
  }
}

/**
 * Extract equipotential contours using Marching Squares over a world-space grid.
 */
export function generateEquipotentials(
  charges: PointCharge[],
  bounds: WorldBounds,
  density: ContourDensity,
  cellSizeMeters: number
): EquipotentialLevel[] {
  const activeCharges = charges.filter((c) => Math.abs(c.q) > 0.01);
  if (activeCharges.length === 0) return [];

  const levels = getContourLevels(density);
  const cols = Math.max(8, Math.ceil((bounds.maxX - bounds.minX) / cellSizeMeters));
  const rows = Math.max(8, Math.ceil((bounds.maxY - bounds.minY) / cellSizeMeters));
  const dx = (bounds.maxX - bounds.minX) / cols;
  const dy = (bounds.maxY - bounds.minY) / rows;

  // Evaluate potential scalar grid once
  const grid = new Float32Array((rows + 1) * (cols + 1));
  for (let r = 0; r <= rows; r++) {
    const y = bounds.minY + r * dy;
    const rowOffset = r * (cols + 1);
    for (let c = 0; c <= cols; c++) {
      const x = bounds.minX + c * dx;
      let v = 0;
      for (let i = 0; i < activeCharges.length; i++) {
        const ch = activeCharges[i];
        const cdx = x - ch.x;
        const cdy = y - ch.y;
        v += (K_SCALED * ch.q) / Math.sqrt(cdx * cdx + cdy * cdy + SOFTENING_EPS_SQ);
      }
      grid[rowOffset + c] = v;
    }
  }

  const results: EquipotentialLevel[] = [];
  const skipCoreSq = 0.19 * 0.19;

  for (const level of levels) {
    const segments: EquipotentialSegment[] = [];

    for (let r = 0; r < rows; r++) {
      const y0 = bounds.minY + r * dy;
      const y1 = y0 + dy;
      const row0 = r * (cols + 1);
      const row1 = (r + 1) * (cols + 1);

      for (let c = 0; c < cols; c++) {
        const v00 = grid[row0 + c]; // bottom-left
        const v10 = grid[row0 + c + 1]; // bottom-right
        const v11 = grid[row1 + c + 1]; // top-right
        const v01 = grid[row1 + c]; // top-left

        let mask = 0;
        if (v00 >= level) mask |= 1;
        if (v10 >= level) mask |= 2;
        if (v11 >= level) mask |= 4;
        if (v01 >= level) mask |= 8;

        if (mask === 0 || mask === 15) continue;

        const x0 = bounds.minX + c * dx;
        const x1 = x0 + dx;

        // Skip contour cells right inside a charge core
        const midCellX = x0 + 0.5 * dx;
        const midCellY = y0 + 0.5 * dy;
        let insideCharge = false;
        for (let i = 0; i < activeCharges.length; i++) {
          const ch = activeCharges[i];
          const ddx = midCellX - ch.x;
          const ddy = midCellY - ch.y;
          if (ddx * ddx + ddy * ddy < skipCoreSq) {
            insideCharge = true;
            break;
          }
        }
        if (insideCharge) continue;

        const interp = (va: number, vb: number) => {
          const denom = vb - va;
          if (Math.abs(denom) < 1e-9) return 0.5;
          return Math.max(0, Math.min(1, (level - va) / denom));
        };

        // Edges: 0=bottom (v00-v10), 1=right (v10-v11), 2=top (v01-v11), 3=left (v00-v01)
        const pBottom = { x: x0 + interp(v00, v10) * dx, y: y0 };
        const pRight = { x: x1, y: y0 + interp(v10, v11) * dy };
        const pTop = { x: x0 + interp(v01, v11) * dx, y: y1 };
        const pLeft = { x: x0, y: y0 + interp(v00, v01) * dy };

        const addSeg = (a: { x: number; y: number }, b: { x: number; y: number }) => {
          segments.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
        };

        switch (mask) {
          case 1:
          case 14:
            addSeg(pLeft, pBottom);
            break;
          case 2:
          case 13:
            addSeg(pBottom, pRight);
            break;
          case 3:
          case 12:
            addSeg(pLeft, pRight);
            break;
          case 4:
          case 11:
            addSeg(pRight, pTop);
            break;
          case 5: {
            const center = 0.25 * (v00 + v10 + v11 + v01);
            if (center >= level) {
              addSeg(pLeft, pTop);
              addSeg(pBottom, pRight);
            } else {
              addSeg(pLeft, pBottom);
              addSeg(pTop, pRight);
            }
            break;
          }
          case 6:
          case 9:
            addSeg(pBottom, pTop);
            break;
          case 7:
          case 8:
            addSeg(pLeft, pTop);
            break;
          case 10: {
            const center = 0.25 * (v00 + v10 + v11 + v01);
            if (center >= level) {
              addSeg(pLeft, pBottom);
              addSeg(pTop, pRight);
            } else {
              addSeg(pLeft, pTop);
              addSeg(pBottom, pRight);
            }
            break;
          }
        }
      }
    }

    if (segments.length > 0) {
      // Pick a clean interior label position near the middle segment
      const candidate = segments[Math.floor(segments.length * 0.35)];
      const lx = 0.5 * (candidate.x1 + candidate.x2);
      const ly = 0.5 * (candidate.y1 + candidate.y2);
      const inView =
        lx > bounds.minX + 0.5 &&
        lx < bounds.maxX - 0.5 &&
        ly > bounds.minY + 0.4 &&
        ly < bounds.maxY - 0.4;

      results.push({
        levelKv: level,
        segments,
        labelPos: inView ? { x: lx, y: ly } : null,
      });
    }
  }

  return results;
}

// Precomputed 256-entry RGB lookup tables for smooth scientific colormaps
function buildLut(stops: Array<[number, number, number, number]>): Uint8ClampedArray {
  const lut = new Uint8ClampedArray(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let s0 = stops[0];
    let s1 = stops[stops.length - 1];
    for (let j = 0; j < stops.length - 1; j++) {
      if (t >= stops[j][0] && t <= stops[j + 1][0]) {
        s0 = stops[j];
        s1 = stops[j + 1];
        break;
      }
    }
    const span = s1[0] - s0[0] || 1;
    const localT = (t - s0[0]) / span;
    lut[i * 3] = Math.round(s0[1] + (s1[1] - s0[1]) * localT);
    lut[i * 3 + 1] = Math.round(s0[2] + (s1[2] - s0[2]) * localT);
    lut[i * 3 + 2] = Math.round(s0[3] + (s1[3] - s0[3]) * localT);
  }
  return lut;
}

const INFERNO_LUT = buildLut([
  [0.0, 9, 13, 24],
  [0.2, 46, 17, 74],
  [0.45, 136, 34, 106],
  [0.7, 224, 92, 46],
  [0.88, 250, 178, 34],
  [1.0, 252, 248, 168],
]);

const VIRIDIS_LUT = buildLut([
  [0.0, 14, 20, 42],
  [0.25, 59, 82, 139],
  [0.5, 33, 145, 140],
  [0.75, 94, 201, 98],
  [1.0, 253, 231, 37],
]);

const COOLWARM_LUT = buildLut([
  [0.0, 11, 20, 38],
  [0.3, 37, 99, 235],
  [0.55, 14, 165, 233],
  [0.8, 245, 158, 11],
  [1.0, 244, 63, 94],
]);

export function getColormapLut(type: ColormapType): Uint8ClampedArray {
  switch (type) {
    case ColormapType.Viridis:
      return VIRIDIS_LUT;
    case ColormapType.Coolwarm:
      return COOLWARM_LUT;
    case ColormapType.Inferno:
    default:
      return INFERNO_LUT;
  }
}

export function getColormapCssGradient(type: ColormapType): string {
  switch (type) {
    case ColormapType.Viridis:
      return 'linear-gradient(90deg, #0e142a 0%, #3b528b 25%, #21918c 50%, #5ec962 75%, #fde725 100%)';
    case ColormapType.Coolwarm:
      return 'linear-gradient(90deg, #0b1426 0%, #2563eb 30%, #0ea5e9 55%, #f59e0b 80%, #f43f5e 100%)';
    case ColormapType.Inferno:
    default:
      return 'linear-gradient(90deg, #090d18 0%, #2e114a 20%, #88226a 45%, #e05c2e 70%, #fab222 88%, #fcf8a8 100%)';
  }
}

/**
 * Render logarithmic electric field intensity |E| into an ImageData buffer.
 */
export function renderHeatmapImageData(
  imageData: ImageData,
  width: number,
  height: number,
  charges: PointCharge[],
  bounds: WorldBounds,
  colormap: ColormapType,
  opacity: number
): void {
  const data = imageData.data;
  const activeCharges = charges.filter((c) => Math.abs(c.q) > 0.01);

  if (activeCharges.length === 0) {
    data.fill(0);
    return;
  }

  const lut = getColormapLut(colormap);
  const logMin = Math.log10(HEATMAP_E_MIN);
  const logSpan = Math.log10(HEATMAP_E_MAX) - logMin;
  const invLog10 = 1 / Math.LN10;
  const alphaByte = Math.round(Math.max(0, Math.min(1, opacity)) * 255);

  const worldW = bounds.maxX - bounds.minX;
  const worldH = bounds.maxY - bounds.minY;

  for (let py = 0; py < height; py++) {
    // Canvas Y goes top-to-bottom; world Y goes bottom-to-top
    const wy = bounds.maxY - ((py + 0.5) / height) * worldH;
    const rowIdx = py * width * 4;

    for (let px = 0; px < width; px++) {
      const wx = bounds.minX + ((px + 0.5) / width) * worldW;
      let ex = 0;
      let ey = 0;

      for (let i = 0; i < activeCharges.length; i++) {
        const ch = activeCharges[i];
        const dx = wx - ch.x;
        const dy = wy - ch.y;
        const r2 = dx * dx + dy * dy + SOFTENING_EPS_SQ;
        const invR3 = 1 / (r2 * Math.sqrt(r2));
        const kq = K_SCALED * ch.q;
        ex += kq * dx * invR3;
        ey += kq * dy * invR3;
      }

      const eMag = Math.hypot(ex, ey);
      let norm = 0;
      if (eMag > HEATMAP_E_MIN) {
        const logVal = Math.log(eMag) * invLog10;
        norm = Math.max(0, Math.min(1, (logVal - logMin) / logSpan));
      }

      const lutIdx = Math.round(norm * 255) * 3;
      const idx = rowIdx + px * 4;
      data[idx] = lut[lutIdx];
      data[idx + 1] = lut[lutIdx + 1];
      data[idx + 2] = lut[lutIdx + 2];
      data[idx + 3] = alphaByte;
    }
  }
}

export function formatPotential(kv: number): string {
  const abs = Math.abs(kv);
  if (abs < 0.005) return '0.00 kV';
  if (abs >= 100) return `${kv >= 0 ? '+' : ''}${kv.toFixed(1)} kV`;
  return `${kv >= 0 ? '+' : ''}${kv.toFixed(2)} kV`;
}

export function formatFieldMag(eKvPerM: number): string {
  if (eKvPerM < 0.01) return '0.00 kV/m';
  if (eKvPerM >= 100) return `${eKvPerM.toFixed(1)} kV/m`;
  return `${eKvPerM.toFixed(2)} kV/m`;
}
