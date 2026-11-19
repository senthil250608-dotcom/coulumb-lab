export enum InteractionTool {
  SelectMove = 'select_move',
  AddPositive = 'add_positive',
  AddNegative = 'add_negative',
  PinProbe = 'pin_probe',
  LaunchTestCharge = 'launch_test_charge',
}

export enum ColormapType {
  Inferno = 'inferno',
  Viridis = 'viridis',
  Coolwarm = 'coolwarm',
}

export enum ContourDensity {
  Coarse = 'coarse',
  Standard = 'standard',
  Fine = 'fine',
}

export interface PointCharge {
  id: string;
  /** X coordinate in meters (world space, 0 = canvas center) */
  x: number;
  /** Y coordinate in meters (world space, 0 = canvas center, +Y is up) */
  y: number;
  /** Charge magnitude and sign in microcoulombs (µC) */
  q: number;
}

export interface SimulationSettings {
  showFieldLines: boolean;
  /** Number of field lines seeded per 1 µC of charge */
  fieldLineDensity: number;
  showEquipotentials: boolean;
  contourDensity: ContourDensity;
  showHeatmap: boolean;
  heatmapOpacity: number;
  colormap: ColormapType;
  showVectorGrid: boolean;
  showGridAxes: boolean;
}

export interface FieldSample {
  /** Electric potential V in kilovolts (kV) */
  v: number;
  /** X-component of electric field in kV/m */
  ex: number;
  /** Y-component of electric field in kV/m */
  ey: number;
  /** Electric field magnitude |E| in kV/m */
  eMag: number;
}

export interface ProbeState {
  x: number;
  y: number;
  sample: FieldSample;
  pinned: boolean;
}

export interface TestParticle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  trail: Array<{ x: number; y: number }>;
  alive: boolean;
}

export interface PresetConfig {
  id: string;
  name: string;
  summary: string;
  charges: Array<{ x: number; y: number; q: number }>;
}
