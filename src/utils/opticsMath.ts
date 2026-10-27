import {
  LensProfileId,
  OpticsCalculationResult,
  OpticsState,
  RaySegment3D,
} from '../types/optics';
import { getLensSpec } from './lensCatalog';

export const OPTICAL_AXIS_Y = 9.5;
export const LENS_RADIUS_CM = 4.2;
export const F_OBJECT_HEIGHT_CM = 2.4;

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

/**
 * Computes the exact front X and back X surface offsets (relative to lensPos)
 * at radial distance r from the optical axis, matching the 3D LatheGeometry.
 */
export function getLensSurfaceOffsetsAtRadius(
  profileId: LensProfileId,
  r: number
): { xFrontOffset: number; xBackOffset: number } {
  const spec = getLensSpec(profileId);
  const t = clamp(r / LENS_RADIUS_CM, 0, 1);

  const halfCenter = spec.centerThicknessCm * 0.5;
  const halfEdge = spec.edgeThicknessCm * 0.5;

  if (spec.lensType === 'flat') {
    // Plane-parallel glass plate: both faces strictly flat
    return {
      xFrontOffset: -halfCenter,
      xBackOffset: halfCenter,
    };
  }

  // Symmetric Biconvex (halfCenter > halfEdge) or Biconcave (halfCenter < halfEdge)
  const halfThickAtR = halfCenter + (halfEdge - halfCenter) * (t * t);
  return {
    xFrontOffset: -halfThickAtR,
    xBackOffset: halfThickAtR,
  };
}

export function calculateOptics(state: OpticsState): OpticsCalculationResult {
  const spec = getLensSpec(state.lensProfileId);
  const nGlass = state.refractiveIndex || 1.5;

  const isFlat = spec.lensType === 'flat' || !Number.isFinite(state.focalLength);
  const signedF = isFlat
    ? Number.POSITIVE_INFINITY
    : state.lensType === 'converging'
    ? state.focalLength
    : -state.focalLength;

  const d = Math.max(1.5, state.lensPos - state.objectPos);
  const screenDistance = Math.max(2, state.screenPos - state.lensPos);

  let dPrime: number | null = null;
  let magnification: number | null = null;
  let imageType: 'real' | 'virtual' | 'infinity' = 'real';
  let imageWorldX: number | null = null;

  if (isFlat) {
    // Plane-parallel plate: virtual image same size (k = +1) shifted slightly by glass thickness
    dPrime = -d;
    magnification = 1.0;
    imageType = 'virtual';
    imageWorldX = state.objectPos + spec.centerThicknessCm * (1 - 1 / nGlass);
  } else if (Math.abs(d - signedF) < 0.25) {
    imageType = 'infinity';
  } else {
    dPrime = (d * signedF) / (d - signedF);
    magnification = -dPrime / d;
    imageType = dPrime > 0 ? 'real' : 'virtual';
    imageWorldX = state.lensPos + dPrime;
  }

  let defocusAmount = 1.0;
  let isFocusedOnScreen = false;
  if (imageType === 'real' && dPrime !== null) {
    const deltaScreen = Math.abs(screenDistance - dPrime);
    defocusAmount = Math.min(1.5, deltaScreen / 10);
    isFocusedOnScreen = deltaScreen < 0.85;
  } else {
    defocusAmount = 1.2;
    isFocusedOnScreen = false;
  }

  const rays: RaySegment3D[] = [];
  if (!state.powerOn) {
    return {
      signedFocalLength: signedF,
      d,
      dPrime,
      magnification,
      imageType,
      imageWorldX,
      screenDistance,
      defocusAmount,
      isFocusedOnScreen,
      rays,
    };
  }

  const lensX = state.lensPos;
  const screenX = state.screenPos;

  /**
   * Traces an incident ray from (startX, startY, startZ) hitting the lens at (hitY, hitZ)
   * obeying exact optical physics:
   * - Converging (+5, +10, +15 cm) & Diverging (-10, -20 cm):
   *   Refracts at front surface S1 into glass, then at back surface S2 into air so that
   *   parallel rays pass strictly through the exact focal point F' = lensX + signedF!
   * - Flat Glass Plate (f = ∞):
   *   Refracts via Snell's law at flat S1 (sin i = n sin r) and flat S2 so emergent ray
   *   is strictly parallel to incident ray!
   */
  const traceOpticalRay = (
    startX: number,
    startY: number,
    startZ: number,
    hitY: number,
    hitZ: number,
    color: string
  ): RaySegment3D => {
    const relY = hitY - OPTICAL_AXIS_Y;
    const relZ = hitZ;
    const r = Math.sqrt(relY * relY + relZ * relZ);

    const { xFrontOffset, xBackOffset } = getLensSurfaceOffsetsAtRadius(state.lensProfileId, r);
    const entryX = lensX + xFrontOffset;
    const exitX = lensX + xBackOffset;
    const glassThick = Math.max(0.2, exitX - entryX);

    const dxIn = Math.max(0.2, entryX - startX);
    const slopeYIn = (hitY - startY) / dxIn;
    const slopeZIn = (hitZ - startZ) / dxIn;

    if (isFlat) {
      // Exact Snell's law for plane-parallel plate (f = ∞):
      // sin(i) = n * sin(r) -> internal slope reduced by ~1/n, emergent slope equals incident slope!
      const internalSlopeY = slopeYIn / nGlass;
      const internalSlopeZ = slopeZIn / nGlass;

      const exitY = hitY + internalSlopeY * glassThick;
      const exitZ = hitZ + internalSlopeZ * glassThick;

      // Emergent ray is strictly parallel to incident ray
      const slopeYOut = slopeYIn;
      const slopeZOut = slopeZIn;

      const endX = Math.max(exitX + 1, screenX);
      const dxOut = endX - exitX;

      return {
        start: [startX, startY, startZ],
        entryHit: [entryX, hitY, hitZ],
        exitHit: [exitX, exitY, exitZ],
        refractedEnd: [endX, exitY + slopeYOut * dxOut, exitZ + slopeZOut * dxOut],
        screenHit: [
          screenX,
          exitY + slopeYOut * (screenX - exitX),
          exitZ + slopeZOut * (screenX - exitX),
        ],
        color,
        refractiveIndexUsed: nGlass,
      };
    }

    // Converging (+5, +10, +15) or Diverging (-10, -20) Lens:
    // Total deflection across both surfaces: slopeOut = slopeIn - offset / signedF
    const totalDeflectionY = -relY / signedF;
    const totalDeflectionZ = -relZ / signedF;

    // 1st refraction at front surface S1 (half deflection inside symmetric lens)
    const internalSlopeY = slopeYIn + totalDeflectionY * 0.5;
    const internalSlopeZ = slopeZIn + totalDeflectionZ * 0.5;

    const exitY = hitY + internalSlopeY * glassThick;
    const exitZ = hitZ + internalSlopeZ * glassThick;

    // 2nd refraction at back surface S2 so emergent ray passes through exact focal point (lensX + signedF)
    // When incident ray is parallel (slopeIn == 0), target at x = lensX + signedF has y = OPTICAL_AXIS_Y
    const slopeYOut = slopeYIn + totalDeflectionY;
    const slopeZOut = slopeZIn + totalDeflectionZ;

    // Adjust exitY slightly or anchor emergent line through exact principal plane at lensX so focal intersection at (lensX + signedF) is 100% exact
    const endX = Math.max(exitX + 1, screenX);
    const endY = hitY + slopeYOut * (endX - lensX);
    const endZ = hitZ + slopeZOut * (endX - lensX);

    const screenHitY = hitY + slopeYOut * (screenX - lensX);
    const screenHitZ = hitZ + slopeZOut * (screenX - lensX);

    const segment: RaySegment3D = {
      start: [startX, startY, startZ],
      entryHit: [entryX, hitY, hitZ],
      exitHit: [exitX, exitY, exitZ],
      refractedEnd: [endX, endY, endZ],
      screenHit: [screenX, screenHitY, screenHitZ],
      color,
      refractiveIndexUsed: nGlass,
    };

    // Virtual dashed backward extension ray
    if (state.showVirtualRays) {
      if (
        state.lensType === 'diverging' ||
        (state.experimentMode === 'f_object' && imageType === 'virtual')
      ) {
        const backDist =
          imageWorldX !== null && imageType === 'virtual'
            ? Math.max(4, Math.min(38, lensX - imageWorldX + 3))
            : Math.abs(signedF) + 3;
        const vEndX = lensX - backDist;
        const vEndY = hitY - slopeYOut * backDist;
        const vEndZ = hitZ - slopeZOut * backDist;
        segment.virtualStart = [exitX, exitY, exitZ];
        segment.virtualEnd = [vEndX, vEndY, vEndZ];
      }
    }

    return segment;
  };

  if (state.experimentMode === 'f_object' && state.beamMode === 'f_rays') {
    const objX = state.objectPos;
    const tipY = OPTICAL_AXIS_Y + F_OBJECT_HEIGHT_CM * 0.82;
    const tipZ = 0;

    // 1. Tia tới song song trục chính
    rays.push(traceOpticalRay(objX, tipY, tipZ, tipY, 0, '#f59e0b'));
    // 2. Tia tới qua quang tâm O
    rays.push(traceOpticalRay(objX, tipY, tipZ, OPTICAL_AXIS_Y, 0, '#38bdf8'));
    // 3. Tia tới qua tiêu điểm F (nếu f hữu hạn)
    if (!isFlat) {
      const slopeToF = -(tipY - OPTICAL_AXIS_Y) / signedF;
      const hitY3 = clamp(
        tipY + slopeToF * (lensX - objX),
        OPTICAL_AXIS_Y - LENS_RADIUS_CM * 0.85,
        OPTICAL_AXIS_Y + LENS_RADIUS_CM * 0.85
      );
      rays.push(traceOpticalRay(objX, tipY, tipZ, hitY3, 0, '#34d399'));
    }
  } else {
    // Rays emitted from the slit diaphragm head on Lamp (1)
    // All rays can be dragged vertically (rayOffsetY) within the lamp aperture bounds [-2.6, +2.6] cm
    const emitterX = state.lampPos + 4.25;
    const tanAngle = Math.tan((state.rayAngleDeg * Math.PI) / 180);
    const dx = Math.max(1, lensX - emitterX);
    const maxApertureY = 2.65;

    if (state.beamMode === 'single') {
      const relStartY = clamp(state.rayOffsetY, -maxApertureY, maxApertureY);
      const startY = OPTICAL_AXIS_Y + relStartY;
      const hitY = clamp(
        startY + tanAngle * dx,
        OPTICAL_AXIS_Y - LENS_RADIUS_CM * 0.88,
        OPTICAL_AXIS_Y + LENS_RADIUS_CM * 0.88
      );
      rays.push(traceOpticalRay(emitterX, startY, 0, hitY, 0, '#f59e0b'));
    } else if (state.beamMode === 'double') {
      const clampedShift = clamp(state.rayOffsetY, -1.35, 1.35);
      const offsets = [-1.25, 1.25];
      for (const oy of offsets) {
        const startY = OPTICAL_AXIS_Y + oy + clampedShift;
        const hitY = clamp(
          startY + tanAngle * dx,
          OPTICAL_AXIS_Y - LENS_RADIUS_CM * 0.88,
          OPTICAL_AXIS_Y + LENS_RADIUS_CM * 0.88
        );
        rays.push(traceOpticalRay(emitterX, startY, 0, hitY, 0, '#f59e0b'));
      }
    } else if (state.beamMode === 'triple' || state.beamMode === 'f_rays') {
      const clampedShift = clamp(state.rayOffsetY, -1.15, 1.15);
      const offsets = [-1.5, 0, 1.5];
      const colors = ['#f59e0b', '#38bdf8', '#f59e0b'];
      offsets.forEach((oy, idx) => {
        const startY = OPTICAL_AXIS_Y + oy + clampedShift;
        const hitY = clamp(
          startY + tanAngle * dx,
          OPTICAL_AXIS_Y - LENS_RADIUS_CM * 0.88,
          OPTICAL_AXIS_Y + LENS_RADIUS_CM * 0.88
        );
        rays.push(traceOpticalRay(emitterX, startY, 0, hitY, 0, colors[idx]));
      });
    } else if (state.beamMode === 'bundle') {
      const clampedShift = clamp(state.rayOffsetY, -0.85, 0.85);
      const offsets = [-1.8, -0.9, 0, 0.9, 1.8];
      offsets.forEach((oy, idx) => {
        const startY = OPTICAL_AXIS_Y + oy + clampedShift;
        const hitY = clamp(
          startY + tanAngle * dx,
          OPTICAL_AXIS_Y - LENS_RADIUS_CM * 0.9,
          OPTICAL_AXIS_Y + LENS_RADIUS_CM * 0.9
        );
        rays.push(
          traceOpticalRay(emitterX, startY, 0, hitY, 0, idx === 2 ? '#38bdf8' : '#f59e0b')
        );
      });
    }
  }

  return {
    signedFocalLength: signedF,
    d,
    dPrime,
    magnification,
    imageType,
    imageWorldX,
    screenDistance,
    defocusAmount,
    isFocusedOnScreen,
    rays,
  };
}
