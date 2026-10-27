export type ExperimentMode = 'f_object' | 'laser_rays';

export type LensType = 'converging' | 'diverging' | 'flat';

export type LensProfileId =
  | 'conv_5'
  | 'conv_10'
  | 'conv_15'
  | 'div_10'
  | 'div_20'
  | 'flat_inf';

export type BeamMode = 'single' | 'double' | 'triple' | 'bundle' | 'f_rays';

export type CameraPreset =
  | 'overview'
  | 'left_view'
  | 'right_view'
  | 'top_down'
  | 'back_view'
  | 'eye_view'
  | 'screen_closeup'
  | 'lens_macro';

export type AppScreenState = 'title' | 'playing' | 'paused' | 'guide_modal';

export interface LensCatalogItem {
  id: LensProfileId;
  codeLabel: string; // "+5 cm", "+10 cm", "+15 cm", "-10 cm", "-20 cm", "∞"
  name: string;
  shortName: string;
  lensType: LensType;
  focalLengthCm: number; // Infinity for flat_inf, otherwise 5, 10, 15, 20
  refractiveIndex: number; // Standard optical glass BK7 n = 1.50
  centerThicknessCm: number;
  edgeThicknessCm: number;
  description: string;
  svgPath: string;
}

export interface OpticsState {
  experimentMode: ExperimentMode;
  lensProfileId: LensProfileId;
  lensType: LensType;
  focalLength: number; // 5, 10, 15, 20, or Infinity
  refractiveIndex: number; // 1.50
  powerOn: boolean;
  voltage: number; // 3V to 12V
  psuPos: [number, number]; // (6) Nguồn điện [x, z] position on wooden table (default on left)
  lensBoxPos: [number, number]; // Hộp thấu kính [x, z] position on wooden table
  lampPos: number; // (1) Đèn chiếu sáng position on rail in cm
  objectPos: number; // (2) Vật sáng hình chữ F position on rail in cm
  lensPos: number; // (3) Thấu kính position on rail in cm
  screenPos: number; // (4) Màn chắn position on rail in cm
  beamMode: BeamMode;
  rayOffsetY: number;
  rayAngleDeg: number;
  showPhotons: boolean;
  showVirtualRays: boolean;
  showLabels: boolean;
  ambientLightLevel: number; // 0 (Phòng tối) to 100 (Phòng sáng)
  tableBrightness: number; // 10 (Mặt bàn tối) to 100 (Mặt bàn sáng)
  cameraPreset: CameraPreset;
  muted: boolean;
  activePresetId: string;
}

export interface RaySegment3D {
  // 1. Incident ray in air: lamp slit -> front surface S1 of lens
  start: [number, number, number];
  entryHit: [number, number, number];
  // 2. Internal refracted ray inside glass lens: front surface S1 -> back surface S2
  exitHit: [number, number, number];
  // 3. Emergent refracted ray in air: back surface S2 -> screen
  refractedEnd: [number, number, number];
  screenHit: [number, number, number] | null;
  // 4. Virtual dashed backward extension ray
  virtualStart?: [number, number, number];
  virtualEnd?: [number, number, number];
  color: string;
  refractiveIndexUsed: number;
}

export interface OpticsCalculationResult {
  signedFocalLength: number; // +5, +10, +15, -10, -20, or Infinity
  d: number;
  dPrime: number | null;
  magnification: number | null;
  imageType: 'real' | 'virtual' | 'infinity';
  imageWorldX: number | null;
  screenDistance: number;
  defocusAmount: number;
  isFocusedOnScreen: boolean;
  rays: RaySegment3D[];
}

export interface TextbookPreset {
  id: string;
  label: string;
  subtitle: string;
  state: Partial<OpticsState>;
}
