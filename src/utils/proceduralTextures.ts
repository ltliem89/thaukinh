import * as THREE from 'three';
import { BeamMode, ExperimentMode, OpticsCalculationResult, OpticsState } from '../types/optics';
import { OPTICAL_AXIS_Y } from './opticsMath';

export function createWoodTableTexture(maxAnisotropy: number): {
  map: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
} {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 0, 1024);
  grad.addColorStop(0, '#5c3a21');
  grad.addColorStop(0.5, '#6b4428');
  grad.addColorStop(1, '#52321b');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 1024);

  const numPlanks = 6;
  const plankH = 1024 / numPlanks;
  for (let p = 0; p < numPlanks; p++) {
    const y0 = p * plankH;
    ctx.fillStyle = p % 2 === 0 ? 'rgba(255, 210, 160, 0.03)' : 'rgba(20, 10, 5, 0.05)';
    ctx.fillRect(0, y0, 1024, plankH);

    ctx.strokeStyle = 'rgba(25, 12, 4, 0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, y0);
    ctx.lineTo(1024, y0);
    ctx.stroke();

    for (let i = 0; i < 65; i++) {
      const gy = y0 + ((i * 19 + p * 37) % plankH);
      const alpha = 0.03 + ((i * 13) % 10) * 0.008;
      ctx.strokeStyle = i % 3 === 0 ? `rgba(32, 16, 6, ${alpha})` : `rgba(145, 98, 56, ${alpha})`;
      ctx.lineWidth = 1 + (i % 3);
      ctx.beginPath();
      ctx.moveTo(0, gy);
      for (let x = 0; x <= 1024; x += 64) {
        const wave = Math.sin(x * 0.008 + i * 0.7 + p) * 4;
        ctx.lineTo(x, gy + wave);
      }
      ctx.stroke();
    }
  }

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = maxAnisotropy;

  const rCanvas = document.createElement('canvas');
  rCanvas.width = 512;
  rCanvas.height = 512;
  const rCtx = rCanvas.getContext('2d')!;
  rCtx.fillStyle = '#888888';
  rCtx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 180; i++) {
    rCtx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
    rCtx.fillRect(0, (i * 17) % 512, 512, 2);
  }
  const roughnessMap = new THREE.CanvasTexture(rCanvas);
  roughnessMap.colorSpace = THREE.NoColorSpace;
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;

  return { map, roughnessMap };
}

export function createOpticalRulerTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#cfd8e3');
  grad.addColorStop(0.5, '#e2e8f0');
  grad.addColorStop(1, '#b8c4d4');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 2048, 256);

  const totalCm = 90;
  const pxPerCm = 2048 / totalCm;

  ctx.strokeStyle = '#0f172a';
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 24px "IBM Plex Mono", monospace';
  ctx.textAlign = 'center';

  for (let cm = -45; cm <= 45; cm++) {
    const x = (cm + 45) * pxPerCm;
    const isMajor = cm % 5 === 0;
    const isZero = cm === 0;

    ctx.lineWidth = isZero ? 4 : isMajor ? 2.5 : 1.3;
    ctx.strokeStyle = isZero ? '#dc2626' : '#1e293b';
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, isZero ? 95 : isMajor ? 75 : 42);
    ctx.stroke();

    if (isMajor && Math.abs(cm) <= 40) {
      ctx.fillStyle = isZero ? '#dc2626' : '#0f172a';
      ctx.fillText(cm === 0 ? '0' : `${Math.abs(cm)}`, x, 130);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createPowerSupplyPanelTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 320;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#e5e7eb';
  ctx.fillRect(0, 0, 512, 320);

  ctx.fillStyle = '#1e293b';
  ctx.fillRect(16, 16, 480, 48);

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 20px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('NGUỒN ĐIỆN THÍ NGHIỆM (6)', 32, 47);

  ctx.fillStyle = '#38bdf8';
  ctx.font = '600 16px "IBM Plex Mono", monospace';
  ctx.textAlign = 'right';
  ctx.fillText('DC 0–12V', 480, 46);

  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 3;
  ctx.strokeRect(16, 16, 480, 288);

  ctx.fillStyle = '#334155';
  ctx.font = 'bold 15px "IBM Plex Mono", monospace';
  ctx.textAlign = 'center';
  const labels = ['3V', '6V', '9V', '12V'];
  const angles = [-Math.PI * 0.75, -Math.PI * 0.25, Math.PI * 0.25, Math.PI * 0.75];
  angles.forEach((ang, i) => {
    const lx = 256 + Math.cos(ang - Math.PI / 2) * 76;
    const ly = 185 + Math.sin(ang - Math.PI / 2) * 76;
    ctx.fillText(labels[i], lx, ly);
  });

  ctx.font = 'bold 14px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('CÔNG TẮC', 92, 265);
  ctx.fillStyle = '#dc2626';
  ctx.fillText('+ ĐỎ', 385, 265);
  ctx.fillStyle = '#2563eb';
  ctx.fillText('- XANH', 445, 265);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

/**
 * Creates the "HỘP THẤU KÍNH" front plaque sticker pasted directly onto the front face of the 3D wooden lens box.
 */
export function createLensBoxFrontLabelTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 96;
  const ctx = canvas.getContext('2d')!;

  // Brass / gold outer rim
  const grad = ctx.createLinearGradient(0, 0, 512, 0);
  grad.addColorStop(0, '#d97706');
  grad.addColorStop(0.5, '#fbbf24');
  grad.addColorStop(1, '#d97706');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 96);

  // Dark slate inner plate
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(8, 8, 496, 80);

  // Inner brass pin-stripe
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 2;
  ctx.strokeRect(14, 14, 484, 68);

  // Brass rivets on left and right
  ctx.fillStyle = '#fbbf24';
  [32, 480].forEach((rx) => {
    ctx.beginPath();
    ctx.arc(rx, 48, 6, 0, Math.PI * 2);
    ctx.fill();
  });

  // Crisp label text: "HỘP THẤU KÍNH"
  ctx.fillStyle = '#fef08a';
  ctx.font = 'bold 34px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('HỘP THẤU KÍNH', 256, 50);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

/**
 * Creates an individual parameter tag texture mounted on the top head of each lens inside the 3D lens box
 * (+5 cm, +10 cm, +15 cm, -10 cm, -20 cm, ∞).
 */
export function createLensHeadTagTexture(
  codeLabel: string,
  lensType: 'converging' | 'diverging' | 'flat',
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 192;
  canvas.height = 80;
  const ctx = canvas.getContext('2d')!;

  const borderColor =
    lensType === 'converging' ? '#f59e0b' : lensType === 'diverging' ? '#38bdf8' : '#e2e8f0';
  const textColor =
    lensType === 'converging' ? '#fef08a' : lensType === 'diverging' ? '#7dd3fc' : '#f8fafc';

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, 192, 80);

  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 6;
  ctx.strokeRect(4, 4, 184, 72);

  ctx.fillStyle = textColor;
  ctx.font = 'bold 36px "IBM Plex Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(codeLabel.replace(' cm', ''), 96, 42);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createFrostedFObjectTexture(maxAnisotropy: number, isVirtualGhost = false): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  if (isVirtualGhost) {
    ctx.clearRect(0, 0, 512, 512);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
    ctx.lineWidth = 8;
    ctx.setLineDash([18, 12]);
    ctx.beginPath();
    ctx.arc(256, 256, 210, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = 'rgba(14, 165, 233, 0.14)';
    ctx.beginPath();
    ctx.arc(256, 256, 206, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = '#18181b';
    ctx.fillRect(0, 0, 512, 512);

    const radGrad = ctx.createRadialGradient(256, 256, 20, 256, 256, 210);
    radGrad.addColorStop(0, '#fffbeb');
    radGrad.addColorStop(0.7, '#fde68a');
    radGrad.addColorStop(0.95, '#d97706');
    radGrad.addColorStop(1, '#27272a');
    ctx.fillStyle = radGrad;
    ctx.beginPath();
    ctx.arc(256, 256, 205, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#27272a';
    ctx.beginPath();
    ctx.arc(256, 256, 188, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.save();
  ctx.translate(256, 256);
  ctx.shadowColor = isVirtualGhost ? '#38bdf8' : '#fbbf24';
  ctx.shadowBlur = 24;
  ctx.fillStyle = isVirtualGhost ? '#7dd3fc' : '#fef08a';

  ctx.fillRect(-68, -125, 38, 250);
  ctx.fillRect(-68, -125, 148, 38);
  ctx.fillRect(-68, -18, 105, 34);
  ctx.fillRect(52, -125, 28, 56);

  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

/**
 * Dynamic Slit Diaphragm Plate on the Front of Lamp (1):
 * Visually shows 1 slit, 2 slits, 3 slits, 5-slit comb (chùm sáng khe hẹp), or open circular aperture.
 */
export class DynamicLampSlitPlate {
  public canvas: HTMLCanvasElement;
  public ctx: CanvasRenderingContext2D;
  public texture: THREE.CanvasTexture;

  constructor(maxAnisotropy: number) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 256;
    this.canvas.height = 256;
    this.ctx = this.canvas.getContext('2d')!;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = maxAnisotropy;
  }

  public update(
    powerOn: boolean,
    experimentMode: ExperimentMode,
    beamMode: BeamMode,
    rayOffsetY = 0
  ) {
    const ctx = this.ctx;
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, 256, 256);

    // Metallic diaphragm frame border
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 8;
    ctx.strokeRect(8, 8, 240, 240);

    const slitColor = powerOn ? '#fef08a' : '#334155';
    ctx.fillStyle = slitColor;
    ctx.shadowColor = powerOn ? '#f59e0b' : 'transparent';
    ctx.shadowBlur = powerOn ? 16 : 0;

    // Note: slitPlateMesh is a PlaneGeometry(4.4, 3.2) rotated around Y by PI/2,
    // so canvas Y (0 top -> 256 bottom) maps to 3D Y (+2.2 top -> -2.2 bottom).
    const pxPerCm = 38;

    if (experimentMode === 'f_object' && beamMode === 'f_rays') {
      // Open round condenser aperture to illuminate the "F" frosted plate
      ctx.beginPath();
      ctx.arc(128, 128, 72, 0, Math.PI * 2);
      ctx.fill();
    } else if (beamMode === 'single') {
      const shiftPx = -Math.max(-2.65, Math.min(2.65, rayOffsetY)) * pxPerCm;
      ctx.fillRect(36, 120 + shiftPx, 184, 16);
    } else if (beamMode === 'double') {
      const shiftPx = -Math.max(-1.35, Math.min(1.35, rayOffsetY)) * pxPerCm;
      ctx.fillRect(36, 76 + shiftPx, 184, 14);
      ctx.fillRect(36, 166 + shiftPx, 184, 14);
    } else if (beamMode === 'triple') {
      const shiftPx = -Math.max(-1.15, Math.min(1.15, rayOffsetY)) * pxPerCm;
      ctx.fillRect(36, 66 + shiftPx, 184, 13);
      ctx.fillRect(36, 121 + shiftPx, 184, 14);
      ctx.fillRect(36, 177 + shiftPx, 184, 13);
    } else {
      // 'bundle': 5-slit comb (chùm sáng khe hẹp)
      const shiftPx = -Math.max(-0.85, Math.min(0.85, rayOffsetY)) * pxPerCm;
      const ys = [52, 87, 122, 157, 192];
      for (const y of ys) {
        ctx.fillRect(34, y + shiftPx, 188, 11);
      }
    }

    this.texture.needsUpdate = true;
  }
}

export class DynamicScreenProjector {
  public canvas: HTMLCanvasElement;
  public ctx: CanvasRenderingContext2D;
  public texture: THREE.CanvasTexture;

  constructor(maxAnisotropy: number) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 512;
    this.canvas.height = 512;
    this.ctx = this.canvas.getContext('2d')!;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = maxAnisotropy;
  }

  public update(state: OpticsState, calc: OpticsCalculationResult) {
    const ctx = this.ctx;
    const W = 512;
    const H = 512;

    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.28)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= W; i += 32) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, H);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(W, i);
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(100, 116, 139, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(W / 2, 0);
    ctx.lineTo(W / 2, H);
    ctx.moveTo(0, H / 2);
    ctx.lineTo(W, H / 2);
    ctx.stroke();

    if (!state.powerOn) {
      this.texture.needsUpdate = true;
      return;
    }

    const brightness = (state.voltage / 12) * 0.95 + 0.15;

    if (state.experimentMode === 'f_object') {
      if (calc.imageType === 'real' && calc.dPrime !== null && calc.magnification !== null) {
        const scale = Math.min(2.6, Math.max(0.2, Math.abs(calc.magnification)));
        const deltaCm = Math.abs(calc.screenDistance - calc.dPrime);
        const blurPx = Math.min(36, deltaCm * 2.4);

        const haloRadius = Math.min(230, 85 * scale + deltaCm * 5);
        const halo = ctx.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, haloRadius);
        halo.addColorStop(0, `rgba(254, 240, 138, ${0.42 * brightness})`);
        halo.addColorStop(0.65, `rgba(251, 191, 36, ${0.18 * brightness})`);
        halo.addColorStop(1, 'rgba(251, 191, 36, 0)');
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(W / 2, H / 2, haloRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.save();
        ctx.translate(W / 2, H / 2);
        ctx.scale(-scale, -scale);

        if (blurPx > 0.6) {
          ctx.filter = `blur(${blurPx.toFixed(1)}px)`;
        }

        const alpha = Math.max(0.18, Math.min(1, 1.05 - deltaCm * 0.032)) * brightness;
        ctx.fillStyle = `rgba(217, 119, 6, ${alpha})`;
        ctx.shadowColor = 'rgba(245, 158, 11, 0.9)';
        ctx.shadowBlur = calc.isFocusedOnScreen ? 8 : 18;

        ctx.fillRect(-38, -72, 22, 144);
        ctx.fillRect(-38, -72, 86, 22);
        ctx.fillRect(-38, -10, 62, 20);
        ctx.fillRect(32, -72, 16, 32);

        if (deltaCm < 4) {
          ctx.fillStyle = `rgba(254, 249, 195, ${alpha * 0.9})`;
          ctx.fillRect(-34, -68, 14, 136);
          ctx.fillRect(-34, -68, 78, 14);
          ctx.fillRect(-34, -6, 54, 12);
        }

        ctx.restore();

        if (calc.isFocusedOnScreen) {
          ctx.fillStyle = '#059669';
          ctx.font = 'bold 20px "Plus Jakarta Sans", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('ẢNH THẬT RÕ NÉT (NGƯỢC CHIỀU)', W / 2, 38);
        }
      } else {
        const spreadRadius = Math.min(
          235,
          105 + (calc.screenDistance / Math.max(6, Number.isFinite(state.focalLength) ? state.focalLength : 15)) * 55
        );
        const diffuse = ctx.createRadialGradient(W / 2, H / 2, 15, W / 2, H / 2, spreadRadius);
        diffuse.addColorStop(0, `rgba(253, 224, 71, ${0.32 * brightness})`);
        diffuse.addColorStop(0.55, `rgba(251, 191, 36, ${0.14 * brightness})`);
        diffuse.addColorStop(1, 'rgba(251, 191, 36, 0)');
        ctx.fillStyle = diffuse;
        ctx.beginPath();
        ctx.arc(W / 2, H / 2, spreadRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#64748b';
        ctx.font = '600 18px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('KHÔNG HỨNG ĐƯỢC ẢNH TRÊN MÀN', W / 2, 42);
      }
    } else {
      const pxPerCm = 42;
      for (const ray of calc.rays) {
        if (!ray.screenHit) continue;
        const [, hitY, hitZ] = ray.screenHit;
        const relY = hitY - OPTICAL_AXIS_Y;
        const relZ = hitZ;

        const sx = W / 2 + relZ * pxPerCm;
        const sy = H / 2 - relY * pxPerCm;

        if (sx >= -30 && sx <= W + 30 && sy >= -30 && sy <= H + 30) {
          const spotGrad = ctx.createRadialGradient(sx, sy, 2, sx, sy, 26);
          spotGrad.addColorStop(0, '#ffffff');
          spotGrad.addColorStop(0.3, ray.color);
          spotGrad.addColorStop(1, 'rgba(245, 158, 11, 0)');
          ctx.fillStyle = spotGrad;
          ctx.beginPath();
          ctx.arc(sx, sy, 26, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    this.texture.needsUpdate = true;
  }
}
