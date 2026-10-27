import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { BeamMode, LensProfileId, OpticsCalculationResult, OpticsState } from '../types/optics';
import {
  getLensSurfaceOffsetsAtRadius,
  LENS_RADIUS_CM,
  OPTICAL_AXIS_Y,
} from '../utils/opticsMath';
import { LENS_CATALOG, getLensSpec } from '../utils/lensCatalog';
import {
  createFrostedFObjectTexture,
  createLensBoxFrontLabelTexture,
  createLensHeadTagTexture,
  createOpticalRulerTexture,
  createPowerSupplyPanelTexture,
  createWoodTableTexture,
  DynamicLampSlitPlate,
  DynamicScreenProjector,
} from '../utils/proceduralTextures';
import { labAudio } from '../utils/audio';

interface OpticsScene3DProps {
  state: OpticsState;
  calc: OpticsCalculationResult;
  onUpdateState: (patch: Partial<OpticsState>) => void;
}

interface ProjectedLabel {
  id: string;
  text: string;
  x: number;
  y: number;
  visible: boolean;
  tone: 'badge' | 'focal' | 'virtual' | 'kit' | 'kit_head_conv' | 'kit_head_div' | 'kit_head_flat';
  lensId?: LensProfileId;
}

const _vec3A = new THREE.Vector3();
const _vec3B = new THREE.Vector3();
const _vec3C = new THREE.Vector3();
const _vec3D = new THREE.Vector3();
const _quatA = new THREE.Quaternion();
const _scaleA = new THREE.Vector3();
const _mat4A = new THREE.Matrix4();
const _upVec = new THREE.Vector3(0, 1, 0);
const _railDragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const _tableDragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _intersectPt = new THREE.Vector3();

function createProfileLensGeometry(
  profileId: LensProfileId,
  radiusScale = 1.0
): THREE.BufferGeometry {
  const R = LENS_RADIUS_CM * radiusScale;
  const points: THREE.Vector2[] = [];
  const steps = 32;

  for (let i = 0; i <= steps; i++) {
    const r = (i / steps) * R;
    const { xFrontOffset } = getLensSurfaceOffsetsAtRadius(profileId, r / radiusScale);
    points.push(new THREE.Vector2(r, xFrontOffset * radiusScale));
  }

  for (let i = steps; i >= 0; i--) {
    const r = (i / steps) * R;
    const { xBackOffset } = getLensSurfaceOffsetsAtRadius(profileId, r / radiusScale);
    points.push(new THREE.Vector2(r, xBackOffset * radiusScale));
  }

  const geom = new THREE.LatheGeometry(points, 48);
  geom.rotateZ(-Math.PI / 2);
  geom.computeVertexNormals();
  return geom;
}

function buildRiderBase(
  metalMat: THREE.Material,
  darkMat: THREE.Material,
  brassMat: THREE.Material
): THREE.Group {
  const rider = new THREE.Group();
  const block = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.3, 4.4), darkMat);
  block.position.set(0, 3.3, 0);
  block.castShadow = true;
  block.receiveShadow = true;
  rider.add(block);

  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.75, 1.4, 20), metalMat);
  collar.position.set(0, 4.4, 0);
  collar.castShadow = true;
  rider.add(collar);

  const screwStem = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 1.1, 12), brassMat);
  screwStem.rotation.x = Math.PI / 2;
  screwStem.position.set(0, 3.3, 2.5);
  rider.add(screwStem);

  const screwHead = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.32, 16), brassMat);
  screwHead.rotation.x = Math.PI / 2;
  screwHead.position.set(0, 3.3, 3.05);
  rider.add(screwHead);

  const pointer = new THREE.Mesh(
    new THREE.ConeGeometry(0.18, 0.7, 4),
    new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.4 })
  );
  pointer.rotation.z = Math.PI;
  pointer.position.set(0, 2.75, 2.28);
  rider.add(pointer);

  return rider;
}

export const OpticsScene3D: React.FC<OpticsScene3DProps> = ({ state, calc, onUpdateState }) => {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef<OpticsState>(state);
  const calcRef = useRef<OpticsCalculationResult>(calc);
  const onUpdateRef = useRef(onUpdateState);

  stateRef.current = state;
  calcRef.current = calc;
  onUpdateRef.current = onUpdateState;

  const [labels, setLabels] = useState<ProjectedLabel[]>([]);

  const sceneHandlesRef = useRef<{
    syncSceneWithState: () => void;
    applyCameraPreset: (preset: OpticsState['cameraPreset']) => void;
  } | null>(null);

  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    const maxAniso = renderer.capabilities.getMaxAnisotropy();

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0f17);
    scene.fog = new THREE.FogExp2(0x0b0f17, 0.0036);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(
      40,
      container.clientWidth / container.clientHeight,
      0.5,
      380
    );
    // Full laboratory table overview ("góc nhìn đầy đủ cả cái bàn")
    camera.position.set(0, 32, 78);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.065;
    controls.enableZoom = false; // Handled by custom cursor-centered wheel zoom
    controls.screenSpacePanning = true;
    // Left mouse button pans the screen ("bàn tay kéo màn hình di chuyển qua lại để xem từng vị trí"), Right/Middle rotates 3D
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.PAN,
      MIDDLE: THREE.MOUSE.ROTATE,
      RIGHT: THREE.MOUSE.ROTATE,
    };
    controls.maxPolarAngle = Math.PI * 0.485;
    controls.minDistance = 5;
    controls.maxDistance = 115;
    controls.target.set(0, 5.5, 3);
    renderer.domElement.style.cursor = 'grab';

    const camTransition = {
      active: false,
      posTarget: new THREE.Vector3(0, 32, 78),
      lookTarget: new THREE.Vector3(0, 5.5, 3),
    };
    controls.addEventListener('start', () => {
      camTransition.active = false;
      if (!activeDragId) {
        renderer.domElement.style.cursor = 'grabbing';
      }
    });
    controls.addEventListener('end', () => {
      if (!activeDragId) {
        renderer.domElement.style.cursor = 'grab';
      }
    });

    const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x1e1b18, 0.65);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff7ed, 1.85);
    keyLight.position.set(22, 48, 34);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 5;
    keyLight.shadow.camera.far = 140;
    const dBounds = 60;
    keyLight.shadow.camera.left = -dBounds;
    keyLight.shadow.camera.right = dBounds;
    keyLight.shadow.camera.top = dBounds;
    keyLight.shadow.camera.bottom = -dBounds;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.75);
    rimLight.position.set(-35, 24, -32);
    scene.add(rimLight);

    const { map: woodMap, roughnessMap: woodRoughMap } = createWoodTableTexture(maxAniso);
    const woodMat = new THREE.MeshStandardMaterial({
      map: woodMap,
      roughnessMap: woodRoughMap,
      roughness: 0.58,
      metalness: 0.05,
    });

    const brushedAluminumMat = new THREE.MeshPhysicalMaterial({
      color: 0xd1d5db,
      metalness: 0.88,
      roughness: 0.24,
      anisotropy: 0.7,
    });

    const darkAnodizedMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.65,
      roughness: 0.38,
    });

    const matteBlackMat = new THREE.MeshStandardMaterial({
      color: 0x111827,
      metalness: 0.25,
      roughness: 0.75,
    });

    const brassMat = new THREE.MeshPhysicalMaterial({
      color: 0xf59e0b,
      metalness: 0.92,
      roughness: 0.18,
      clearcoat: 0.5,
    });

    const chromePostMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      metalness: 0.95,
      roughness: 0.12,
    });

    // 1. Wooden Laboratory Table (Widened slightly so the left-side Power Supply and Lens Box have ample room)
    const tableGroup = new THREE.Group();
    const tableTop = new THREE.Mesh(new THREE.BoxGeometry(122, 3.2, 58), woodMat);
    tableTop.position.set(-2, -1.6, 0);
    tableTop.receiveShadow = true;
    tableTop.castShadow = true;
    tableGroup.add(tableTop);

    const apronMat = new THREE.MeshStandardMaterial({ color: 0x3e2412, roughness: 0.7 });
    const apronFront = new THREE.Mesh(new THREE.BoxGeometry(116, 4.0, 1.8), apronMat);
    apronFront.position.set(-2, -5.2, 26);
    tableGroup.add(apronFront);
    const apronBack = apronFront.clone();
    apronBack.position.set(-2, -5.2, -26);
    tableGroup.add(apronBack);

    const legGeo = new THREE.CylinderGeometry(2.1, 1.6, 32, 20);
    [
      [-56, -19, 24],
      [52, -19, 24],
      [-56, -19, -24],
      [52, -19, -24],
    ].forEach(([lx, ly, lz]) => {
      const leg = new THREE.Mesh(legGeo, woodMat);
      leg.position.set(lx, ly, lz);
      tableGroup.add(leg);
    });
    scene.add(tableGroup);

    // 2. (5) Giá quang học
    const benchGroup = new THREE.Group();
    const railLength = 90;
    const railBeam = new THREE.Mesh(
      new THREE.BoxGeometry(railLength, 2.2, 3.6),
      brushedAluminumMat
    );
    railBeam.position.set(0, 1.7, 0);
    railBeam.castShadow = true;
    railBeam.receiveShadow = true;
    benchGroup.add(railBeam);

    const railRidge = new THREE.Mesh(new THREE.BoxGeometry(railLength, 0.5, 2.2), chromePostMat);
    railRidge.position.set(0, 3.05, 0);
    railRidge.receiveShadow = true;
    benchGroup.add(railRidge);

    const rulerTex = createOpticalRulerTexture(maxAniso);
    const rulerMat = new THREE.MeshStandardMaterial({
      map: rulerTex,
      roughness: 0.3,
      metalness: 0.4,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const rulerStrip = new THREE.Mesh(new THREE.PlaneGeometry(railLength, 1.5), rulerMat);
    rulerStrip.position.set(0, 1.75, 1.82);
    benchGroup.add(rulerStrip);

    [-45.6, 45.6].forEach((ex) => {
      const endCap = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.9, 4.8), darkAnodizedMat);
      endCap.position.set(ex, 1.65, 0);
      endCap.castShadow = true;
      benchGroup.add(endCap);

      [-1.9, 1.9].forEach((ez) => {
        const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.85, 0.6, 16), brassMat);
        foot.position.set(ex, 0.3, ez);
        benchGroup.add(foot);
      });
    });

    const axisGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-44, OPTICAL_AXIS_Y, 0),
      new THREE.Vector3(44, OPTICAL_AXIS_Y, 0),
    ]);
    const axisLine = new THREE.Line(
      axisGeo,
      new THREE.LineDashedMaterial({
        color: 0x64748b,
        dashSize: 0.8,
        gapSize: 0.6,
        transparent: true,
        opacity: 0.45,
      })
    );
    axisLine.computeLineDistances();
    benchGroup.add(axisLine);
    scene.add(benchGroup);

    // 3. Draggable 3D Wooden Velvet-Lined Optical Lens Box on Table
    // With "HỘP THẤU KÍNH" pasted on the front face & individual parameter tags on each lens head
    const lensBoxGroup = new THREE.Group();
    lensBoxGroup.position.set(stateRef.current.lensBoxPos[0], 0, stateRef.current.lensBoxPos[1]);
    lensBoxGroup.rotation.y = 0.04;

    const boxWoodMat = new THREE.MeshStandardMaterial({
      color: 0x451a03,
      roughness: 0.42,
      metalness: 0.08,
    });
    const velvetMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.92,
      metalness: 0.02,
    });

    const caseBase = new THREE.Mesh(new THREE.BoxGeometry(23.5, 1.7, 7.8), boxWoodMat);
    caseBase.position.set(0, 0.85, 0);
    caseBase.castShadow = true;
    caseBase.receiveShadow = true;
    lensBoxGroup.add(caseBase);

    const velvetTray = new THREE.Mesh(new THREE.BoxGeometry(22.0, 0.5, 6.5), velvetMat);
    velvetTray.position.set(0, 1.5, 0);
    lensBoxGroup.add(velvetTray);

    // Chữ "HỘP THẤU KÍNH" đặt dán vào mặt trước của hộp (Nắp hộp đã ẩn đi để nhìn rõ các thấu kính)
    const frontLabelTex = createLensBoxFrontLabelTexture(maxAniso);
    const frontLabelPlaque = new THREE.Mesh(
      new THREE.PlaneGeometry(10.5, 1.25),
      new THREE.MeshBasicMaterial({ map: frontLabelTex })
    );
    frontLabelPlaque.position.set(0, 0.88, 3.93);
    lensBoxGroup.add(frontLabelPlaque);

    [-7.5, 7.5].forEach((cx) => {
      const clasp = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.65, 0.3), brassMat);
      clasp.position.set(cx, 0.95, 3.95);
      lensBoxGroup.add(clasp);
    });

    // Make the entire wooden box draggable when grabbed
    lensBoxGroup.traverse((child) => {
      child.userData = { draggableId: 'lens_box' };
    });

    const kitGlassMat = new THREE.MeshPhysicalMaterial({
      color: 0xbae6fd,
      metalness: 0.05,
      roughness: 0.1,
      transmission: isSoftwareGl ? 0 : 0.88,
      transparent: true,
      opacity: isSoftwareGl ? 0.55 : 0.95,
      ior: 1.5,
      clearcoat: 1.0,
    });

    const kitSlotGroups: Record<string, THREE.Group> = {};
    const kitSlotXCoords: Record<string, number> = {};

    LENS_CATALOG.forEach((item, idx) => {
      const slotX = -8.75 + idx * 3.5;
      kitSlotXCoords[item.id] = slotX;

      const slotHolder = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.7, 4.1), brassMat);
      slotHolder.position.set(slotX, 1.85, 0);
      slotHolder.userData = { draggableId: 'lens_box' };
      lensBoxGroup.add(slotHolder);

      const slotLensUnit = new THREE.Group();
      slotLensUnit.position.set(slotX, 2.95, 0);

      const miniLensGeo = createProfileLensGeometry(item.id, 0.45);
      const miniLensMesh = new THREE.Mesh(miniLensGeo, kitGlassMat.clone());
      miniLensMesh.userData = { draggableId: `kit_lens_${item.id}` };
      slotLensUnit.add(miniLensMesh);

      // Physical 3D Parameter Tag right on the top head of each lens inside the box
      const headTagTex = createLensHeadTagTexture(item.codeLabel, item.lensType, maxAniso);
      const headTagMat = new THREE.MeshBasicMaterial({
        map: headTagTex,
        side: THREE.DoubleSide,
      });
      const headTagMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.82), headTagMat);
      headTagMesh.position.set(0, 1.95, 0);
      headTagMesh.rotation.x = -0.18;
      headTagMesh.userData = { draggableId: `kit_lens_${item.id}` };
      slotLensUnit.add(headTagMesh);

      kitSlotGroups[item.id] = slotLensUnit;
      lensBoxGroup.add(slotLensUnit);
    });

    scene.add(lensBoxGroup);

    // 4. (6) Compact Nguồn điện (Positioned in the front-left of the table, Draggable, with Prominent Raised ON/OFF Button)
    const powerSupplyGroup = new THREE.Group();
    powerSupplyGroup.position.set(stateRef.current.psuPos[0], 0, stateRef.current.psuPos[1]);
    powerSupplyGroup.rotation.y = 0.08;

    const psuBody = new THREE.Mesh(
      new THREE.BoxGeometry(7.8, 4.4, 5.8),
      new THREE.MeshStandardMaterial({ color: 0xd1d5db, roughness: 0.42, metalness: 0.35 })
    );
    psuBody.position.set(0, 2.3, 0);
    psuBody.castShadow = true;
    psuBody.receiveShadow = true;
    powerSupplyGroup.add(psuBody);

    const psuHood = new THREE.Mesh(new THREE.BoxGeometry(8.0, 4.6, 5.4), darkAnodizedMat);
    psuHood.position.set(0, 2.3, -0.15);
    powerSupplyGroup.add(psuHood);

    const psuPanelTex = createPowerSupplyPanelTexture(maxAniso);
    const psuPanel = new THREE.Mesh(
      new THREE.PlaneGeometry(7.4, 4.0),
      new THREE.MeshStandardMaterial({ map: psuPanelTex, roughness: 0.35 })
    );
    psuPanel.position.set(0, 2.3, 2.92);
    powerSupplyGroup.add(psuPanel);

    const raisedSwitchBezel = new THREE.Mesh(
      new THREE.CylinderGeometry(1.35, 1.5, 0.55, 28),
      brassMat
    );
    raisedSwitchBezel.position.set(-1.8, 4.75, 0.6);
    powerSupplyGroup.add(raisedSwitchBezel);

    const raisedSwitchCapMat = new THREE.MeshStandardMaterial({
      color: 0x22c55e,
      emissive: 0x16a34a,
      emissiveIntensity: 0.65,
      roughness: 0.25,
    });
    const raisedSwitchCap = new THREE.Mesh(
      new THREE.CylinderGeometry(1.05, 1.12, 0.95, 28),
      raisedSwitchCapMat
    );
    raisedSwitchCap.position.set(-1.8, 5.25, 0.6);
    raisedSwitchCap.castShadow = true;
    powerSupplyGroup.add(raisedSwitchCap);

    const switchPivot = new THREE.Group();
    switchPivot.position.set(-2.3, 1.8, 2.95);
    const switchToggle = new THREE.Mesh(
      new THREE.BoxGeometry(0.75, 1.05, 0.5),
      new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.3 })
    );
    switchPivot.add(switchToggle);
    powerSupplyGroup.add(switchPivot);

    const voltageKnob = new THREE.Mesh(
      new THREE.CylinderGeometry(0.75, 0.82, 0.55, 20),
      matteBlackMat
    );
    voltageKnob.rotation.x = Math.PI / 2;
    voltageKnob.position.set(0, 2.1, 3.1);
    const knobMarker = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.55, 0.18),
      new THREE.MeshBasicMaterial({ color: 0xfacc15 })
    );
    knobMarker.position.set(0, 0.28, 0.22);
    voltageKnob.add(knobMarker);
    powerSupplyGroup.add(voltageKnob);

    const psuLedMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
    const psuLed = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 12), psuLedMat);
    psuLed.position.set(-2.3, 2.8, 3.0);
    powerSupplyGroup.add(psuLed);

    const redTerminal = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.22, 0.6, 12),
      new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.3 })
    );
    redTerminal.rotation.x = Math.PI / 2;
    redTerminal.position.set(1.8, 1.65, 3.05);
    powerSupplyGroup.add(redTerminal);

    const blueTerminal = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.22, 0.6, 12),
      new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.3 })
    );
    blueTerminal.rotation.x = Math.PI / 2;
    blueTerminal.position.set(2.8, 1.65, 3.05);
    powerSupplyGroup.add(blueTerminal);

    // Ensure every child of powerSupplyGroup is draggable on the table
    powerSupplyGroup.traverse((child) => {
      child.userData = { draggableId: 'psu_box' };
    });
    raisedSwitchBezel.userData = { draggableId: 'power_switch' };
    raisedSwitchCap.userData = { draggableId: 'power_switch' };
    switchToggle.userData = { draggableId: 'power_switch' };

    scene.add(powerSupplyGroup);

    const redWireMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.45 });
    const blueWireMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.45 });
    let redWireMesh: THREE.Mesh | null = null;
    let blueWireMesh: THREE.Mesh | null = null;

    const updatePowerWires = (lampX: number) => {
      if (redWireMesh) {
        redWireMesh.geometry.dispose();
        scene.remove(redWireMesh);
      }
      if (blueWireMesh) {
        blueWireMesh.geometry.dispose();
        scene.remove(blueWireMesh);
      }

      const redStart = new THREE.Vector3(1.8, 1.65, 3.25).applyMatrix4(powerSupplyGroup.matrixWorld);
      const blueStart = new THREE.Vector3(2.8, 1.65, 3.25).applyMatrix4(powerSupplyGroup.matrixWorld);

      const lampRearRed = new THREE.Vector3(lampX - 3.6, OPTICAL_AXIS_Y - 0.5, -0.5);
      const lampRearBlue = new THREE.Vector3(lampX - 3.6, OPTICAL_AXIS_Y - 0.5, 0.5);

      const sideZ = redStart.z >= 0 ? Math.max(5.2, redStart.z * 0.55) : Math.min(-5.2, redStart.z * 0.55);
      const redCurve = new THREE.CatmullRomCurve3([
        redStart,
        new THREE.Vector3(Math.min(redStart.x, lampX) - 5.5, 0.35, sideZ),
        new THREE.Vector3(lampX - 5.2, 2.5, redStart.z >= 0 ? 1.5 : -1.5),
        lampRearRed,
      ]);
      const blueCurve = new THREE.CatmullRomCurve3([
        blueStart,
        new THREE.Vector3(Math.min(blueStart.x, lampX) - 4.5, 0.35, sideZ + 0.8),
        new THREE.Vector3(lampX - 4.8, 2.2, redStart.z >= 0 ? 2.2 : 1.2),
        lampRearBlue,
      ]);

      redWireMesh = new THREE.Mesh(
        new THREE.TubeGeometry(redCurve, 24, 0.12, 8, false),
        redWireMat
      );
      blueWireMesh = new THREE.Mesh(
        new THREE.TubeGeometry(blueCurve, 24, 0.12, 8, false),
        blueWireMat
      );
      scene.add(redWireMesh);
      scene.add(blueWireMesh);
    };

    // 5. (1) Đèn chiếu sáng có Đầu chắn khe sáng (1 tia, 2 tia, 3 tia, khe hẹp)
    const lampGroup = new THREE.Group();
    const lampRider = buildRiderBase(brushedAluminumMat, darkAnodizedMat, brassMat);
    lampGroup.add(lampRider);

    const lampStem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.32, 4.8, 16),
      chromePostMat
    );
    lampStem.position.set(0, 6.8, 0);
    lampGroup.add(lampStem);

    const lampBox = new THREE.Mesh(new THREE.BoxGeometry(5.8, 3.6, 3.6), matteBlackMat);
    lampBox.position.set(0, OPTICAL_AXIS_Y, 0);
    lampBox.castShadow = true;
    lampGroup.add(lampBox);

    const lampSnout = new THREE.Mesh(
      new THREE.CylinderGeometry(1.35, 1.45, 1.6, 24),
      darkAnodizedMat
    );
    lampSnout.rotation.z = Math.PI / 2;
    lampSnout.position.set(3.2, OPTICAL_AXIS_Y, 0);
    lampGroup.add(lampSnout);

    const slitHolderBox = new THREE.Mesh(new THREE.BoxGeometry(0.42, 4.8, 3.6), brassMat);
    slitHolderBox.position.set(4.05, OPTICAL_AXIS_Y, 0);
    lampGroup.add(slitHolderBox);

    const lampSlitPlate = new DynamicLampSlitPlate(maxAniso);
    const slitFaceMat = new THREE.MeshBasicMaterial({ map: lampSlitPlate.texture });
    const slitPlateMesh = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 3.2), slitFaceMat);
    slitPlateMesh.rotation.y = Math.PI / 2;
    slitPlateMesh.position.set(4.28, OPTICAL_AXIS_Y, 0);
    lampGroup.add(slitPlateMesh);

    // Physical lamp beam light for dark-room illumination on the optical bench & wooden table
    const lampApertureGlowLight = new THREE.PointLight(0xffb74d, 1.8, 22, 1.4);
    lampApertureGlowLight.position.set(4.8, OPTICAL_AXIS_Y, 0);
    lampGroup.add(lampApertureGlowLight);

    const lampBeamSpotLight = new THREE.SpotLight(0xffe082, 4.5, 95, Math.PI * 0.17, 0.65, 1.1);
    lampBeamSpotLight.position.set(4.3, OPTICAL_AXIS_Y, 0);
    lampBeamSpotLight.target.position.set(60, OPTICAL_AXIS_Y - 1.2, 0);
    lampGroup.add(lampBeamSpotLight);
    lampGroup.add(lampBeamSpotLight.target);

    lampGroup.traverse((child) => {
      child.userData = { draggableId: 'lamp' };
    });
    slitHolderBox.userData = { draggableId: 'lamp_slit_head' };
    slitPlateMesh.userData = { draggableId: 'lamp_slit_head' };

    scene.add(lampGroup);

    // 6. (2) Vật sáng bằng kính mờ hình chữ F
    const objectGroup = new THREE.Group();
    const objectRider = buildRiderBase(brushedAluminumMat, darkAnodizedMat, brassMat);
    objectGroup.add(objectRider);

    const objectStem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.3, 4.8, 16),
      chromePostMat
    );
    objectStem.position.set(0, 6.8, 0);
    objectGroup.add(objectStem);

    const objectPlate = new THREE.Mesh(new THREE.BoxGeometry(0.45, 7.6, 7.6), matteBlackMat);
    objectPlate.position.set(0, OPTICAL_AXIS_Y, 0);
    objectPlate.castShadow = true;
    objectGroup.add(objectPlate);

    const fObjectTex = createFrostedFObjectTexture(maxAniso, false);
    const fObjectMat = new THREE.MeshBasicMaterial({ map: fObjectTex });
    const fDiscFront = new THREE.Mesh(new THREE.CircleGeometry(2.85, 32), fObjectMat);
    fDiscFront.rotation.y = Math.PI / 2;
    fDiscFront.position.set(0.25, OPTICAL_AXIS_Y, 0);
    objectGroup.add(fDiscFront);

    const fDiscBack = new THREE.Mesh(new THREE.CircleGeometry(2.85, 32), fObjectMat);
    fDiscBack.rotation.y = -Math.PI / 2;
    fDiscBack.position.set(-0.25, OPTICAL_AXIS_Y, 0);
    objectGroup.add(fDiscBack);

    objectGroup.traverse((child) => {
      child.userData = { draggableId: 'object' };
    });
    scene.add(objectGroup);

    // 7. (3) Thấu kính trên Giá quang học
    const lensGroup = new THREE.Group();
    const lensRider = buildRiderBase(brushedAluminumMat, darkAnodizedMat, brassMat);
    lensGroup.add(lensRider);

    const lensStem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.34, 4.6, 16),
      chromePostMat
    );
    lensStem.position.set(0, 6.6, 0);
    lensGroup.add(lensStem);

    const lensFrameRing = new THREE.Mesh(
      new THREE.TorusGeometry(LENS_RADIUS_CM + 0.35, 0.38, 16, 48),
      darkAnodizedMat
    );
    lensFrameRing.rotation.y = Math.PI / 2;
    lensFrameRing.position.set(0, OPTICAL_AXIS_Y, 0);
    lensFrameRing.castShadow = true;
    lensGroup.add(lensFrameRing);

    const lensBrassBezel = new THREE.Mesh(
      new THREE.TorusGeometry(LENS_RADIUS_CM + 0.08, 0.12, 12, 48),
      brassMat
    );
    lensBrassBezel.rotation.y = Math.PI / 2;
    lensBrassBezel.position.set(0, OPTICAL_AXIS_Y, 0);
    lensGroup.add(lensBrassBezel);

    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xe0f2fe,
      metalness: 0,
      roughness: 0.04,
      transmission: isSoftwareGl ? 0 : 0.94,
      transparent: true,
      opacity: isSoftwareGl ? 0.38 : 1.0,
      ior: 1.5,
      thickness: 1.8,
      attenuationColor: new THREE.Color(0xbae6fd),
      attenuationDistance: 8,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      depthWrite: false,
    });

    const lensGlassMesh = new THREE.Mesh(
      createProfileLensGeometry(stateRef.current.lensProfileId),
      glassMat
    );
    lensGlassMesh.position.set(0, OPTICAL_AXIS_Y, 0);
    lensGlassMesh.renderOrder = 2;
    lensGroup.add(lensGlassMesh);

    let lastLensProfileId = stateRef.current.lensProfileId;

    lensGroup.traverse((child) => {
      child.userData = { draggableId: 'lens' };
    });
    scene.add(lensGroup);

    // 8. (4) Màn chắn
    const screenGroup = new THREE.Group();
    const screenRider = buildRiderBase(brushedAluminumMat, darkAnodizedMat, brassMat);
    screenGroup.add(screenRider);

    const screenStem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.32, 4.8, 16),
      chromePostMat
    );
    screenStem.position.set(0, 6.8, 0);
    screenGroup.add(screenStem);

    const screenBacking = new THREE.Mesh(
      new THREE.BoxGeometry(0.38, 10.6, 10.6),
      darkAnodizedMat
    );
    screenBacking.position.set(0, OPTICAL_AXIS_Y, 0);
    screenBacking.castShadow = true;
    screenGroup.add(screenBacking);

    const screenProjector = new DynamicScreenProjector(maxAniso);
    const screenFaceMat = new THREE.MeshBasicMaterial({ map: screenProjector.texture });
    const screenFrontPlane = new THREE.Mesh(new THREE.PlaneGeometry(10.2, 10.2), screenFaceMat);
    screenFrontPlane.rotation.y = -Math.PI / 2;
    screenFrontPlane.position.set(-0.22, OPTICAL_AXIS_Y, 0);
    screenGroup.add(screenFrontPlane);

    const screenBackPlane = new THREE.Mesh(new THREE.PlaneGeometry(10.2, 10.2), screenFaceMat);
    screenBackPlane.rotation.y = Math.PI / 2;
    screenBackPlane.position.set(0.22, OPTICAL_AXIS_Y, 0);
    screenGroup.add(screenBackPlane);

    screenGroup.traverse((child) => {
      child.userData = { draggableId: 'screen' };
    });
    scene.add(screenGroup);

    // 9. 3D Virtual Image Ghost ("Ảnh ảo chữ F")
    const virtualImageTex = createFrostedFObjectTexture(maxAniso, true);
    const virtualImageMat = new THREE.MeshBasicMaterial({
      map: virtualImageTex,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const virtualImageMesh = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 5.6), virtualImageMat);
    virtualImageMesh.rotation.y = Math.PI / 2;
    virtualImageMesh.renderOrder = 3;
    scene.add(virtualImageMesh);

    // 10. Focal Point Markers (F, O, F')
    const focalMarkerGroup = new THREE.Group();
    const focalDotGeo = new THREE.SphereGeometry(0.32, 16, 16);
    const markerF = new THREE.Mesh(focalDotGeo, new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));
    const markerFPrime = new THREE.Mesh(
      focalDotGeo,
      new THREE.MeshBasicMaterial({ color: 0xf59e0b })
    );
    focalMarkerGroup.add(markerF);
    focalMarkerGroup.add(markerFPrime);
    scene.add(focalMarkerGroup);

    // 11. 3D Rays & Moving Photon Particles
    const rayLinesGroup = new THREE.Group();
    scene.add(rayLinesGroup);

    const MAX_PHOTONS = 90;
    const photonGeo = new THREE.SphereGeometry(0.23, 12, 12);
    const photonMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
    const photonInstanced = new THREE.InstancedMesh(photonGeo, photonMat, MAX_PHOTONS);
    photonInstanced.frustumCulled = false;
    photonInstanced.renderOrder = 4;
    scene.add(photonInstanced);

    const rebuildRaysAndScene = () => {
      const s = stateRef.current;
      const c = calcRef.current;

      // 1. Dynamic Ambient Room Light & Table Surface Brightness (Dark-Room Simulation)
      const ambRatio = Math.max(0, Math.min(100, s.ambientLightLevel ?? 45)) / 100;
      const darknessFactor = 1 - ambRatio; // 1.0 in pitch-dark room, 0.0 in bright room
      const tableRatio = Math.max(10, Math.min(100, s.tableBrightness ?? 65)) / 100;

      // Interpolate room background & fog from deep dark-room (0x03050a) to lit lab (0x121b2a)
      const bgR = Math.round(3 + ambRatio * 15);
      const bgG = Math.round(5 + ambRatio * 22);
      const bgB = Math.round(10 + ambRatio * 32);
      const bgHex = (bgR << 16) | (bgG << 8) | bgB;
      (scene.background as THREE.Color).setHex(bgHex);
      if (scene.fog instanceof THREE.FogExp2) {
        scene.fog.color.setHex(bgHex);
      }

      hemiLight.intensity = 0.08 + ambRatio * 0.95;
      keyLight.intensity = 0.14 + ambRatio * 2.35;
      rimLight.intensity = 0.12 + ambRatio * 0.85;
      scene.environmentIntensity = 0.12 + ambRatio * 0.95;

      // Adjust wooden laboratory table surface brightness & anti-glare roughness
      const woodScalar = 0.16 + tableRatio * 1.08;
      woodMat.color.setRGB(woodScalar, woodScalar * 0.96, woodScalar * 0.92);
      woodMat.roughness = 0.78 - tableRatio * 0.25;
      apronMat.color.setRGB(
        0.24 * woodScalar,
        0.14 * woodScalar,
        0.07 * woodScalar
      );

      // Update physical Lamp (1) beam illumination (stronger contrast in dark room)
      const voltFactor = Math.max(0.25, (s.voltage - 1.5) / 10.5);
      if (s.powerOn) {
        lampApertureGlowLight.intensity = (1.2 + darknessFactor * 2.4) * voltFactor;
        lampBeamSpotLight.intensity = (2.2 + darknessFactor * 6.5) * voltFactor;
        lampBeamSpotLight.target.position.set(
          60,
          OPTICAL_AXIS_Y - 1.0 + s.rayOffsetY * 2.5,
          0
        );
      } else {
        lampApertureGlowLight.intensity = 0;
        lampBeamSpotLight.intensity = 0;
      }

      lampGroup.position.x = s.lampPos;
      objectGroup.position.x = s.objectPos;
      objectGroup.visible = s.experimentMode === 'f_object';
      lensGroup.position.x = s.lensPos;
      screenGroup.position.x = s.screenPos;

      // Update movable Lens Box position on table
      lensBoxGroup.position.set(s.lensBoxPos[0], 0, s.lensBoxPos[1]);
      lensBoxGroup.updateMatrixWorld(true);

      // Update movable compact PSU position on table & raised switch state
      powerSupplyGroup.position.set(s.psuPos[0], 0, s.psuPos[1]);
      raisedSwitchCap.position.y = s.powerOn ? 5.12 : 5.38;
      raisedSwitchCapMat.color.setHex(s.powerOn ? 0x22c55e : 0xef4444);
      raisedSwitchCapMat.emissive.setHex(s.powerOn ? 0x16a34a : 0x7f1d1d);
      raisedSwitchCapMat.emissiveIntensity = s.powerOn ? 0.75 + darknessFactor * 0.45 : 0.35;

      // Update Lamp (1) front slit plate texture with vertical rayOffsetY
      lampSlitPlate.update(s.powerOn, s.experimentMode, s.beamMode, s.rayOffsetY);

      switchPivot.rotation.x = s.powerOn ? -0.35 : 0.35;
      psuLedMat.color.setHex(s.powerOn ? 0x22c55e : 0x475569);
      const knobAngle = ((s.voltage - 3) / 9) * Math.PI * 1.4 - Math.PI * 0.7;
      voltageKnob.rotation.y = -knobAngle;

      powerSupplyGroup.updateMatrixWorld(true);
      updatePowerWires(s.lampPos);

      // Hide the lens unit in the 3D Kit Box that is currently mounted on (3)
      Object.entries(kitSlotGroups).forEach(([id, grp]) => {
        grp.visible = id !== s.lensProfileId;
      });

      // Rebuild 3D glass lens if profile changed
      if (s.lensProfileId !== lastLensProfileId) {
        lastLensProfileId = s.lensProfileId;
        lensGlassMesh.geometry.dispose();
        lensGlassMesh.geometry = createProfileLensGeometry(s.lensProfileId);
      }

      // Update F and F' markers (hide F and F' when flat glass f = ∞ is mounted)
      const isFlat = s.lensType === 'flat' || !Number.isFinite(s.focalLength);
      focalMarkerGroup.visible = s.showLabels && !isFlat;
      if (!isFlat) {
        const fDist = s.focalLength;
        markerF.position.set(
          s.lensType === 'converging' ? s.lensPos - fDist : s.lensPos + fDist,
          OPTICAL_AXIS_Y,
          0
        );
        markerFPrime.position.set(
          s.lensType === 'converging' ? s.lensPos + fDist : s.lensPos - fDist,
          OPTICAL_AXIS_Y,
          0
        );
      }

      // Update 3D Virtual Image Ghost
      if (
        s.powerOn &&
        s.experimentMode === 'f_object' &&
        c.imageType === 'virtual' &&
        c.imageWorldX !== null &&
        c.magnification !== null &&
        s.showVirtualRays
      ) {
        virtualImageMesh.visible = true;
        virtualImageMesh.position.set(c.imageWorldX, OPTICAL_AXIS_Y, 0);
        const mag = Math.max(0.22, Math.min(2.8, Math.abs(c.magnification)));
        virtualImageMesh.scale.set(mag, mag, 1);
      } else {
        virtualImageMesh.visible = false;
      }

      screenProjector.update(s, c);

      // Clear previous ray meshes
      while (rayLinesGroup.children.length > 0) {
        const child = rayLinesGroup.children[0] as THREE.Mesh | THREE.Line;
        child.geometry.dispose();
        if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
        else child.material.dispose();
        rayLinesGroup.remove(child);
      }

      if (!s.powerOn) return;

      const addBeamCylinder = (
        p1: [number, number, number],
        p2: [number, number, number],
        hexColor: string,
        radius = 0.08,
        opacity = 0.94,
        isDraggableRay = false
      ) => {
        _vec3A.set(p1[0], p1[1], p1[2]);
        _vec3B.set(p2[0], p2[1], p2[2]);
        const dist = _vec3A.distanceTo(_vec3B);
        if (dist < 0.03) return;

        // Core bright ray cylinder
        const coreRadius = radius * (0.95 + darknessFactor * 0.25);
        const cylGeo = new THREE.CylinderGeometry(coreRadius, coreRadius, dist, 10, 1, false);
        const cylMat = new THREE.MeshBasicMaterial({
          color: hexColor,
          transparent: true,
          opacity: Math.min(1, opacity + darknessFactor * 0.06),
          depthWrite: false,
        });
        const cyl = new THREE.Mesh(cylGeo, cylMat);
        _vec3C.addVectors(_vec3A, _vec3B).multiplyScalar(0.5);
        cyl.position.copy(_vec3C);
        _vec3B.sub(_vec3A).normalize();
        _quatA.setFromUnitVectors(_upVec, _vec3B);
        cyl.quaternion.copy(_quatA);
        cyl.renderOrder = 3;
        if (isDraggableRay) {
          cyl.userData = { draggableId: 'ray_beam' };
        }
        rayLinesGroup.add(cyl);

        // Dark-room Tyndall / volumetric outer glow sheath around the ray
        const haloRadius = coreRadius * (2.1 + darknessFactor * 1.9);
        const haloOpacity = (0.14 + darknessFactor * 0.34) * voltFactor;
        const haloGeo = new THREE.CylinderGeometry(haloRadius, haloRadius, dist, 10, 1, false);
        const haloMat = new THREE.MeshBasicMaterial({
          color: hexColor,
          transparent: true,
          opacity: haloOpacity,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const haloMesh = new THREE.Mesh(haloGeo, haloMat);
        haloMesh.position.copy(_vec3C);
        haloMesh.quaternion.copy(_quatA);
        haloMesh.renderOrder = 2;
        rayLinesGroup.add(haloMesh);

        // Add wider invisible collider tube so grabbing and dragging the ray up/down is effortless
        if (isDraggableRay) {
          const hitGeo = new THREE.CylinderGeometry(0.65, 0.65, dist, 8, 1, false);
          const hitMat = new THREE.MeshBasicMaterial({
            transparent: true,
            opacity: 0,
            depthWrite: false,
          });
          const hitMesh = new THREE.Mesh(hitGeo, hitMat);
          hitMesh.position.copy(_vec3C);
          hitMesh.quaternion.copy(_quatA);
          hitMesh.userData = { draggableId: 'ray_beam' };
          rayLinesGroup.add(hitMesh);
        }
      };

      for (const ray of c.rays) {
        // 1. Incident Ray in Air (Directly grabbable & draggable up/down in laser_rays mode)
        addBeamCylinder(
          ray.start,
          ray.entryHit,
          ray.color,
          0.075,
          0.95,
          s.experimentMode === 'laser_rays'
        );
        // 2. Internal Refracted Ray inside Glass
        addBeamCylinder(ray.entryHit, ray.exitHit, '#e0f2fe', 0.1, 0.98, false);
        // 3. Emergent Refracted Ray in Air
        addBeamCylinder(
          ray.exitHit,
          ray.refractedEnd,
          ray.color,
          0.075,
          0.95,
          s.experimentMode === 'laser_rays'
        );

        // 4. Dashed Virtual Backward Extension Ray
        if (ray.virtualStart && ray.virtualEnd) {
          const vGeo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(...ray.virtualStart),
            new THREE.Vector3(...ray.virtualEnd),
          ]);
          const vLine = new THREE.Line(
            vGeo,
            new THREE.LineDashedMaterial({
              color: 0x38bdf8,
              dashSize: 0.75,
              gapSize: 0.55,
              transparent: true,
              opacity: 0.85,
            })
          );
          vLine.computeLineDistances();
          rayLinesGroup.add(vLine);
        }
      }
    };

    const applyCameraPreset = (preset: OpticsState['cameraPreset']) => {
      const s = stateRef.current;
      camTransition.active = true;
      if (preset === 'overview') {
        // Về trung tâm: Toàn cảnh đầy đủ cả cái bàn thí nghiệm
        camTransition.posTarget.set(0, 32, 78);
        camTransition.lookTarget.set(0, 5.5, 3);
      } else if (preset === 'left_view') {
        // Nhìn từ bên trái qua
        camTransition.posTarget.set(-76, 20, 8);
        camTransition.lookTarget.set(-2, 7.0, 2);
      } else if (preset === 'right_view') {
        // Nhìn từ bên phải qua
        camTransition.posTarget.set(72, 20, 8);
        camTransition.lookTarget.set(0, 7.0, 2);
      } else if (preset === 'top_down') {
        // Nhìn từ trên xuống
        camTransition.posTarget.set(0, 84, 2.5);
        camTransition.lookTarget.set(0, 4.0, 2);
      } else if (preset === 'back_view') {
        // Nhìn từ phía sau tới
        camTransition.posTarget.set(0, 26, -72);
        camTransition.lookTarget.set(0, 6.5, 0);
      } else if (preset === 'lens_macro') {
        camTransition.posTarget.set(s.lensPos - 2, OPTICAL_AXIS_Y + 3.5, 16.5);
        camTransition.lookTarget.set(s.lensPos + 1, OPTICAL_AXIS_Y, 0);
      } else if (preset === 'eye_view') {
        camTransition.posTarget.set(s.lensPos + 32, OPTICAL_AXIS_Y + 2.2, 8.5);
        camTransition.lookTarget.set(s.lensPos - 10, OPTICAL_AXIS_Y, 0);
      } else if (preset === 'screen_closeup') {
        camTransition.posTarget.set(s.screenPos - 16, OPTICAL_AXIS_Y + 3.5, 19);
        camTransition.lookTarget.set(s.screenPos, OPTICAL_AXIS_Y, 0);
      }
    };

    const onCustomCameraPreset = (ev: Event) => {
      const customEv = ev as CustomEvent<OpticsState['cameraPreset']>;
      if (customEv.detail) {
        applyCameraPreset(customEv.detail);
      }
    };
    window.addEventListener('optics-camera-preset', onCustomCameraPreset);

    sceneHandlesRef.current = {
      syncSceneWithState: rebuildRaysAndScene,
      applyCameraPreset,
    };

    rebuildRaysAndScene();
    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();
    let activeDragId: string | null = null;
    let pointerDownClientPos: [number, number] | null = null;
    let didMoveDuringDrag = false;
    const dragOffsetXZ = new THREE.Vector2(0, 0);
    let dragRayStartOffsetY = 0;
    let lastHoverBroadcast = 0;

    const interactiveGroups = [
      rayLinesGroup,
      lampGroup,
      objectGroup,
      lensGroup,
      screenGroup,
      powerSupplyGroup,
      lensBoxGroup,
    ];

    const getPointerNdc = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      getPointerNdc(e);
      raycaster.setFromCamera(pointerNdc, camera);
      const hits = raycaster.intersectObjects(interactiveGroups, true);
      if (hits.length > 0) {
        const hitId = hits[0].object.userData?.draggableId as string | undefined;
        if (!hitId) return;

        activeDragId = hitId;
        pointerDownClientPos = [e.clientX, e.clientY];
        didMoveDuringDrag = false;

        // Compute vertical grab offset when grabbing a light ray or the lamp slit aperture
        if (hitId === 'ray_beam' || hitId === 'lamp_slit_head') {
          if (raycaster.ray.intersectPlane(_railDragPlane, _intersectPt)) {
            dragRayStartOffsetY = stateRef.current.rayOffsetY - (_intersectPt.y - OPTICAL_AXIS_Y);
          } else {
            dragRayStartOffsetY = 0;
          }
        }

        // Compute table plane grab offset for smooth dragging of Power Supply (6) and Lens Box
        if (
          hitId === 'psu_box' ||
          hitId === 'power_switch' ||
          hitId === 'lens_box' ||
          hitId.startsWith('kit_lens_')
        ) {
          if (raycaster.ray.intersectPlane(_tableDragPlane, _intersectPt)) {
            const targetPos =
              hitId === 'psu_box' || hitId === 'power_switch'
                ? stateRef.current.psuPos
                : stateRef.current.lensBoxPos;
            dragOffsetXZ.set(targetPos[0] - _intersectPt.x, targetPos[1] - _intersectPt.z);
          } else {
            dragOffsetXZ.set(0, 0);
          }
        }

        controls.enabled = false;
        renderer.domElement.style.cursor =
          hitId === 'ray_beam' ? 'ns-resize' : 'grabbing';
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      getPointerNdc(e);
      if (activeDragId) {
        if (pointerDownClientPos) {
          const dx = e.clientX - pointerDownClientPos[0];
          const dy = e.clientY - pointerDownClientPos[1];
          if (Math.hypot(dx, dy) > 5) {
            didMoveDuringDrag = true;
          }
        }

        raycaster.setFromCamera(pointerNdc, camera);
        const s = stateRef.current;

        // 0. Dragging the Light Ray(s) or Lamp Slit Aperture Up / Down ("nắm kéo tia sáng di chuyển từ giữa lên trên hoặc xuống dưới")
        if (activeDragId === 'ray_beam' || activeDragId === 'lamp_slit_head') {
          if (didMoveDuringDrag && raycaster.ray.intersectPlane(_railDragPlane, _intersectPt)) {
            const rawRelY = (_intersectPt.y - OPTICAL_AXIS_Y) + dragRayStartOffsetY;
            const maxBound =
              s.beamMode === 'single'
                ? 2.6
                : s.beamMode === 'double'
                ? 1.35
                : s.beamMode === 'triple'
                ? 1.15
                : 0.85;
            const clampedY = Math.round(Math.max(-maxBound, Math.min(maxBound, rawRelY)) * 20) / 20;
            if (clampedY !== s.rayOffsetY) {
              onUpdateRef.current({
                experimentMode: 'laser_rays',
                rayOffsetY: clampedY,
              });
            }
          }
          return;
        }

        // 1. Dragging the compact Power Supply (6) across the wooden table
        if (activeDragId === 'psu_box' || activeDragId === 'power_switch') {
          if (didMoveDuringDrag && raycaster.ray.intersectPlane(_tableDragPlane, _intersectPt)) {
            const targetX = _intersectPt.x + dragOffsetXZ.x;
            const targetZ = _intersectPt.z + dragOffsetXZ.y;
            const clampedX = Math.max(-54, Math.min(46, Math.round(targetX * 2) / 2));
            const clampedZ = Math.max(-22, Math.min(22, Math.round(targetZ * 2) / 2));
            const safeZ =
              clampedX > -46 && Math.abs(clampedZ) < 6.0
                ? clampedZ >= 0
                  ? 6.0
                  : -6.0
                : clampedZ;
            if (clampedX !== s.psuPos[0] || safeZ !== s.psuPos[1]) {
              onUpdateRef.current({ psuPos: [clampedX, safeZ] });
            }
          }
          return;
        }

        // 2. Dragging the 3D Wooden Lens Box across the wooden table
        if (activeDragId === 'lens_box' || activeDragId.startsWith('kit_lens_')) {
          if (didMoveDuringDrag && raycaster.ray.intersectPlane(_tableDragPlane, _intersectPt)) {
            const targetX = _intersectPt.x + dragOffsetXZ.x;
            const targetZ = _intersectPt.z + dragOffsetXZ.y;
            const clampedX = Math.max(-44, Math.min(38, Math.round(targetX * 2) / 2));
            const clampedZ = Math.max(-21, Math.min(21, Math.round(targetZ * 2) / 2));
            const safeZ =
              Math.abs(clampedZ) < 7.0 ? (clampedZ >= 0 ? 7.0 : -7.0) : clampedZ;
            if (clampedX !== s.lensBoxPos[0] || safeZ !== s.lensBoxPos[1]) {
              onUpdateRef.current({ lensBoxPos: [clampedX, safeZ] });
            }
          }
          return;
        }

        // 3. Dragging components along the graduated optical rail (5)
        if (raycaster.ray.intersectPlane(_railDragPlane, _intersectPt)) {
          const rawX = Math.round(_intersectPt.x * 2) / 2;

          if (activeDragId === 'lamp') {
            const maxLamp = s.experimentMode === 'f_object' ? s.objectPos - 5 : s.lensPos - 6;
            const clamped = Math.max(-42, Math.min(maxLamp, rawX));
            if (clamped !== s.lampPos) {
              labAudio.playRailSlideTick();
              onUpdateRef.current({ lampPos: clamped });
            }
          } else if (activeDragId === 'object') {
            const clamped = Math.max(s.lampPos + 5, Math.min(s.lensPos - 3, rawX));
            if (clamped !== s.objectPos) {
              labAudio.playRailSlideTick();
              onUpdateRef.current({ objectPos: clamped });
            }
          } else if (activeDragId === 'lens') {
            const minL = s.experimentMode === 'f_object' ? s.objectPos + 3 : s.lampPos + 6;
            const clamped = Math.max(minL, Math.min(s.screenPos - 4, rawX));
            if (clamped !== s.lensPos) {
              labAudio.playRailSlideTick();
              onUpdateRef.current({ lensPos: clamped });
            }
          } else if (activeDragId === 'screen') {
            const clamped = Math.max(s.lensPos + 4, Math.min(42, rawX));
            if (clamped !== s.screenPos) {
              labAudio.playRailSlideTick();
              onUpdateRef.current({ screenPos: clamped });
            }
          }
        }
        return;
      }

      const now = performance.now();
      if (now - lastHoverBroadcast < 45) return;
      lastHoverBroadcast = now;

      raycaster.setFromCamera(pointerNdc, camera);
      const hits = raycaster.intersectObjects(interactiveGroups, true);
      if (hits.length > 0) {
        const hitId = hits[0].object.userData?.draggableId as string | undefined;
        renderer.domElement.style.cursor =
          hitId === 'ray_beam'
            ? 'ns-resize'
            : hitId === 'power_switch' || hitId === 'lamp_slit_head' || hitId?.startsWith('kit_lens_')
            ? 'pointer'
            : 'grab';
      } else {
        // Show hand cursor ("hiện bàn tay kéo màn hình di chuyển qua lại để xem từng vị trí")
        renderer.domElement.style.cursor = 'grab';
      }
    };

    const onPointerUp = () => {
      if (activeDragId) {
        // Clicking Lamp Slit Head without dragging cycles 1 tia -> 2 tia -> 3 tia -> Khe hẹp -> Vật F
        if (activeDragId === 'lamp_slit_head' && !didMoveDuringDrag) {
          const order: BeamMode[] = ['single', 'double', 'triple', 'bundle', 'f_rays'];
          const currMode =
            stateRef.current.experimentMode === 'f_object' ? 'f_rays' : stateRef.current.beamMode;
          const currIdx = order.indexOf(currMode);
          const nextMode = order[(currIdx + 1) % order.length];
          labAudio.playRailSlideTick();
          if (nextMode === 'f_rays') {
            onUpdateRef.current({ experimentMode: 'f_object', beamMode: 'f_rays' });
          } else {
            onUpdateRef.current({ experimentMode: 'laser_rays', beamMode: nextMode });
          }
        }

        // Clicking Power Supply (6) or its raised switch without dragging toggles power ON/OFF
        if (
          (activeDragId === 'power_switch' || activeDragId === 'psu_box') &&
          !didMoveDuringDrag
        ) {
          const nextPower = !stateRef.current.powerOn;
          labAudio.playPowerSwitch(nextPower);
          onUpdateRef.current({ powerOn: nextPower });
        }

        // Clicking a lens inside the 3D Lens Box without dragging selects that lens onto (3)
        if (activeDragId.startsWith('kit_lens_') && !didMoveDuringDrag) {
          const profileId = activeDragId.replace('kit_lens_', '') as LensProfileId;
          const spec = getLensSpec(profileId);
          labAudio.playLensSwap(spec.lensType === 'converging');
          onUpdateRef.current({
            lensProfileId: spec.id,
            lensType: spec.lensType,
            focalLength: spec.focalLengthCm,
            refractiveIndex: spec.refractiveIndex,
          });
        }

        activeDragId = null;
        pointerDownClientPos = null;
        didMoveDuringDrag = false;
        controls.enabled = true;
        renderer.domElement.style.cursor = 'grab';
      }
    };

    const zoomables = [
      rayLinesGroup,
      lampGroup,
      objectGroup,
      lensGroup,
      screenGroup,
      powerSupplyGroup,
      lensBoxGroup,
      benchGroup,
      tableGroup,
    ];
    const _zoomAnchor = new THREE.Vector3();
    const _tableCenter = new THREE.Vector3(0, 5.5, 3);
    const MAX_TABLE_CAM_DIST = 112;
    const MIN_TABLE_CAM_DIST = 5;

    const clampCameraToTable = () => {
      // Allow panning across the entire wooden table to inspect every position
      controls.target.x = Math.max(-52, Math.min(48, controls.target.x));
      controls.target.y = Math.max(0.5, Math.min(20.0, controls.target.y));
      controls.target.z = Math.max(-24, Math.min(24, controls.target.z));

      if (camera.position.y < 1.8) {
        camera.position.y = 1.8;
      }

      const distFromTableCenter = camera.position.distanceTo(_tableCenter);
      if (distFromTableCenter > MAX_TABLE_CAM_DIST) {
        camera.position
          .sub(_tableCenter)
          .setLength(MAX_TABLE_CAM_DIST)
          .add(_tableCenter);
      }
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      camTransition.active = false;

      const clampedDelta = Math.max(-120, Math.min(120, e.deltaY));
      const zoomFactor = Math.exp(clampedDelta * 0.0014);

      getPointerNdc(e as unknown as PointerEvent);
      raycaster.setFromCamera(pointerNdc, camera);

      const hits = raycaster.intersectObjects(zoomables, true);
      if (hits.length > 0) {
        _zoomAnchor.copy(hits[0].point);
      } else if (raycaster.ray.intersectPlane(_tableDragPlane, _intersectPt)) {
        _zoomAnchor.copy(_intersectPt);
      } else {
        _zoomAnchor.copy(controls.target);
      }

      // Clamp the zoom anchor onto the laboratory table area
      _zoomAnchor.x = Math.max(-50, Math.min(46, _zoomAnchor.x));
      _zoomAnchor.y = Math.max(0.5, Math.min(16.0, _zoomAnchor.y));
      _zoomAnchor.z = Math.max(-22, Math.min(22, _zoomAnchor.z));

      const currentDist = camera.position.distanceTo(_zoomAnchor);
      if (clampedDelta < 0 && currentDist <= MIN_TABLE_CAM_DIST) return;
      if (clampedDelta > 0 && camera.position.distanceTo(_tableCenter) >= MAX_TABLE_CAM_DIST) return;

      const nextDist = Math.max(MIN_TABLE_CAM_DIST, Math.min(MAX_TABLE_CAM_DIST, currentDist * zoomFactor));
      const actualScale = nextDist / Math.max(0.5, currentDist);

      camera.position.lerpVectors(_zoomAnchor, camera.position, actualScale);
      controls.target.lerpVectors(_zoomAnchor, controls.target, actualScale);

      clampCameraToTable();
      controls.update();
    };

    const domElem = renderer.domElement;
    domElem.addEventListener('pointerdown', onPointerDown);
    domElem.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    const clock = new THREE.Clock();
    let frameId = 0;
    let labelFrameCounter = 0;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        const status = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (status === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function updatePhotons(elapsed: number) {
      const s = stateRef.current;
      const c = calcRef.current;
      const rays = c.rays;

      if (!s.powerOn || !s.showPhotons || rays.length === 0) {
        photonInstanced.count = 0;
        return;
      }

      const speedC = 15 + (s.voltage / 12) * 14;
      const photonsPerRay = Math.min(10, Math.floor(MAX_PHOTONS / rays.length));
      let instanceIdx = 0;

      for (let r = 0; r < rays.length; r++) {
        const ray = rays[r];
        const nGlass = ray.refractiveIndexUsed || 1.5;

        _vec3A.set(ray.start[0], ray.start[1], ray.start[2]);
        _vec3B.set(ray.entryHit[0], ray.entryHit[1], ray.entryHit[2]);
        _vec3C.set(ray.exitHit[0], ray.exitHit[1], ray.exitHit[2]);
        _vec3D.set(ray.refractedEnd[0], ray.refractedEnd[1], ray.refractedEnd[2]);

        const len1 = _vec3A.distanceTo(_vec3B);
        const lenGlass = _vec3B.distanceTo(_vec3C) * nGlass;
        const len3 = _vec3C.distanceTo(_vec3D);

        const totalOpticalLen = len1 + lenGlass + len3;
        if (totalOpticalLen < 0.5) continue;

        for (let p = 0; p < photonsPerRay; p++) {
          if (instanceIdx >= MAX_PHOTONS) break;
          const phase =
            (elapsed * speedC + (p / photonsPerRay) * totalOpticalLen + r * 1.9) %
            totalOpticalLen;

          if (phase <= len1) {
            const t = len1 > 0.001 ? phase / len1 : 0;
            _vec3A.set(
              ray.start[0] + (ray.entryHit[0] - ray.start[0]) * t,
              ray.start[1] + (ray.entryHit[1] - ray.start[1]) * t,
              ray.start[2] + (ray.entryHit[2] - ray.start[2]) * t
            );
          } else if (phase <= len1 + lenGlass) {
            const t = lenGlass > 0.001 ? (phase - len1) / lenGlass : 0;
            _vec3A.set(
              ray.entryHit[0] + (ray.exitHit[0] - ray.entryHit[0]) * t,
              ray.entryHit[1] + (ray.exitHit[1] - ray.entryHit[1]) * t,
              ray.entryHit[2] + (ray.exitHit[2] - ray.entryHit[2]) * t
            );
          } else {
            const t = len3 > 0.001 ? (phase - len1 - lenGlass) / len3 : 0;
            _vec3A.set(
              ray.exitHit[0] + (ray.refractedEnd[0] - ray.exitHit[0]) * t,
              ray.exitHit[1] + (ray.refractedEnd[1] - ray.exitHit[1]) * t,
              ray.exitHit[2] + (ray.refractedEnd[2] - ray.exitHit[2]) * t
            );
          }

          const pulse = 0.85 + 0.22 * Math.sin(elapsed * 8 + p);
          _scaleA.setScalar(pulse);
          _quatA.identity();
          _mat4A.compose(_vec3A, _quatA, _scaleA);
          photonInstanced.setMatrixAt(instanceIdx, _mat4A);
          instanceIdx++;
        }
      }

      photonInstanced.count = instanceIdx;
      photonInstanced.instanceMatrix.needsUpdate = true;
    }

    function updateProjectedLabels() {
      const s = stateRef.current;
      const c = calcRef.current;
      const w = container!.clientWidth;
      const h = container!.clientHeight;

      const projectPoint = (wx: number, wy: number, wz: number) => {
        _vec3A.set(wx, wy, wz).project(camera);
        return {
          x: (_vec3A.x + 1) * 0.5 * w,
          y: (-_vec3A.y + 1) * 0.5 * h,
          visible: _vec3A.z < 1 && _vec3A.z > -1,
        };
      };

      const nextLabels: ProjectedLabel[] = [];

      // Always project individual parameter badges on the head of each lens inside the 3D Lens Box
      // ("mỗi thấu kính có thông số trên đầu riêng")
      LENS_CATALOG.forEach((item) => {
        if (item.id === s.lensProfileId) return; // Currently mounted on (3)
        const slotX = kitSlotXCoords[item.id];
        _vec3B.set(slotX, 5.2, 0).applyMatrix4(lensBoxGroup.matrixWorld);
        const pHead = projectPoint(_vec3B.x, _vec3B.y, _vec3B.z);
        nextLabels.push({
          id: `kit_head_${item.id}`,
          text: item.codeLabel.replace(' cm', ''),
          x: pHead.x,
          y: pHead.y,
          visible: pHead.visible,
          tone:
            item.lensType === 'converging'
              ? 'kit_head_conv'
              : item.lensType === 'diverging'
              ? 'kit_head_div'
              : 'kit_head_flat',
          lensId: item.id,
        });
      });

      if (!s.showLabels) {
        setLabels(nextLabels);
        return;
      }

      const spec = getLensSpec(s.lensProfileId);

      // Concise symbolic labels (1)-(6) and optical symbols (O, F, F')
      const p1 = projectPoint(s.lampPos, OPTICAL_AXIS_Y + 3.2, 0);
      nextLabels.push({ id: 'l1', text: '(1)', x: p1.x, y: p1.y, visible: p1.visible, tone: 'badge' });

      if (s.experimentMode === 'f_object') {
        const p2 = projectPoint(s.objectPos, OPTICAL_AXIS_Y + 4.4, 0);
        nextLabels.push({ id: 'l2', text: '(2) F', x: p2.x, y: p2.y, visible: p2.visible, tone: 'badge' });
      }

      const p3 = projectPoint(s.lensPos, OPTICAL_AXIS_Y + 5.5, 0);
      nextLabels.push({
        id: 'l3',
        text: `(3) f=${spec.codeLabel}`,
        x: p3.x,
        y: p3.y,
        visible: p3.visible,
        tone: 'badge',
      });

      const p4 = projectPoint(s.screenPos, OPTICAL_AXIS_Y + 5.8, 0);
      nextLabels.push({ id: 'l4', text: '(4)', x: p4.x, y: p4.y, visible: p4.visible, tone: 'badge' });

      const p5 = projectPoint(0, 1.0, 3.0);
      nextLabels.push({ id: 'l5', text: '(5)', x: p5.x, y: p5.y, visible: p5.visible, tone: 'badge' });

      const p6 = projectPoint(s.psuPos[0], 6.4, s.psuPos[1]);
      nextLabels.push({
        id: 'l6',
        text: s.powerOn ? '(6) ON' : '(6) OFF',
        x: p6.x,
        y: p6.y,
        visible: p6.visible,
        tone: 'kit',
      });

      const pO = projectPoint(s.lensPos, OPTICAL_AXIS_Y - 1.0, 0);
      nextLabels.push({ id: 'fO', text: 'O', x: pO.x, y: pO.y, visible: pO.visible, tone: 'focal' });

      if (s.lensType !== 'flat' && Number.isFinite(s.focalLength)) {
        const fDist = s.focalLength;
        const fX = s.lensType === 'converging' ? s.lensPos - fDist : s.lensPos + fDist;
        const fPrimeX = s.lensType === 'converging' ? s.lensPos + fDist : s.lensPos - fDist;

        const pF = projectPoint(fX, OPTICAL_AXIS_Y - 1.1, 0);
        nextLabels.push({ id: 'fF', text: 'F', x: pF.x, y: pF.y, visible: pF.visible, tone: 'focal' });

        const pFP = projectPoint(fPrimeX, OPTICAL_AXIS_Y - 1.1, 0);
        nextLabels.push({ id: 'fFP', text: "F'", x: pFP.x, y: pFP.y, visible: pFP.visible, tone: 'focal' });
      }

      if (
        s.powerOn &&
        s.experimentMode === 'f_object' &&
        c.imageType === 'virtual' &&
        c.imageWorldX !== null &&
        s.showVirtualRays
      ) {
        const pVirt = projectPoint(c.imageWorldX, OPTICAL_AXIS_Y + 4.0, 0);
        nextLabels.push({
          id: 'virt',
          text: "A'B' (Ảo)",
          x: pVirt.x,
          y: pVirt.y,
          visible: pVirt.visible,
          tone: 'virtual',
        });
      }

      setLabels(nextLabels);
    }

    function tick() {
      const rawDt = clock.getDelta();
      const dt = Math.min(rawDt, 0.05);
      const elapsed = clock.getElapsedTime();

      if (camTransition.active) {
        const alpha = 1 - Math.exp(-5.5 * dt);
        camera.position.lerp(camTransition.posTarget, alpha);
        controls.target.lerp(camTransition.lookTarget, alpha);
        if (
          camera.position.distanceTo(camTransition.posTarget) < 0.15 &&
          controls.target.distanceTo(camTransition.lookTarget) < 0.15
        ) {
          camTransition.active = false;
        }
      }

      clampCameraToTable();
      controls.update();
      updatePhotons(elapsed);
      renderer.render(scene, camera);

      labelFrameCounter = (labelFrameCounter + 1) % 3;
      if (labelFrameCounter === 0) {
        updateProjectedLabels();
      }

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    tick();

    const onResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('optics-camera-preset', onCustomCameraPreset);
      domElem.removeEventListener('pointerdown', onPointerDown);
      domElem.removeEventListener('wheel', onWheel);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      renderer.dispose();
      if (container.contains(domElem)) {
        container.removeChild(domElem);
      }
    };
  }, []);

  useEffect(() => {
    sceneHandlesRef.current?.syncSceneWithState();
  }, [state, calc]);

  useEffect(() => {
    sceneHandlesRef.current?.applyCameraPreset(state.cameraPreset);
  }, [state.cameraPreset]);

  return (
    <div className="relative w-full h-full overflow-hidden">
      <div ref={canvasMountRef} className="w-full h-full" />

      {/* Minimal Symbolic 3D World Labels & Per-Lens Head Tags on the 3D Lens Box */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden z-10">
        {labels.map((lbl) => {
          if (!lbl.visible) return null;

          // Individual clickable parameter badge right above each lens in the 3D Lens Box
          if (
            lbl.tone === 'kit_head_conv' ||
            lbl.tone === 'kit_head_div' ||
            lbl.tone === 'kit_head_flat'
          ) {
            const badgeStyle =
              lbl.tone === 'kit_head_conv'
                ? 'bg-amber-500 text-slate-950 border-amber-200 hover:bg-amber-400'
                : lbl.tone === 'kit_head_div'
                ? 'bg-sky-400 text-slate-950 border-sky-200 hover:bg-sky-300'
                : 'bg-slate-200 text-slate-950 border-white hover:bg-white';
            return (
              <button
                key={lbl.id}
                onClick={() => {
                  if (!lbl.lensId) return;
                  const spec = getLensSpec(lbl.lensId);
                  labAudio.playLensSwap(spec.lensType === 'converging');
                  onUpdateState({
                    lensProfileId: spec.id,
                    lensType: spec.lensType,
                    focalLength: spec.focalLengthCm,
                    refractiveIndex: spec.refractiveIndex,
                  });
                }}
                style={{ transform: `translate3d(${lbl.x}px, ${lbl.y}px, 0) translate(-50%, -100%)` }}
                className={`pointer-events-auto absolute top-0 left-0 font-mono-tabular text-[10px] font-bold px-1.5 py-0.2 rounded border shadow-sm transition-colors cursor-pointer ${badgeStyle}`}
                title={`Lắp thấu kính ${lbl.text} lên giá (3)`}
              >
                {lbl.text}
              </button>
            );
          }

          if (lbl.tone === 'focal') {
            return (
              <div
                key={lbl.id}
                style={{ transform: `translate3d(${lbl.x}px, ${lbl.y}px, 0) translate(-50%, 0)` }}
                className="absolute top-0 left-0 font-mono-tabular text-[11px] font-bold text-amber-300 bg-[#0b0f17]/85 px-1.5 py-0.2 rounded border border-amber-500/30"
              >
                {lbl.text}
              </div>
            );
          }
          if (lbl.tone === 'virtual') {
            return (
              <div
                key={lbl.id}
                style={{ transform: `translate3d(${lbl.x}px, ${lbl.y}px, 0) translate(-50%, -100%)` }}
                className="absolute top-0 left-0 font-mono-tabular text-[10px] font-semibold text-sky-300 bg-[#0b0f17]/90 px-1.5 py-0.5 rounded border border-sky-400/40 whitespace-nowrap"
              >
                {lbl.text}
              </div>
            );
          }
          if (lbl.tone === 'kit') {
            return (
              <div
                key={lbl.id}
                style={{ transform: `translate3d(${lbl.x}px, ${lbl.y}px, 0) translate(-50%, -100%)` }}
                className="absolute top-0 left-0 font-mono-tabular text-[10px] font-semibold text-amber-200 bg-[#0f172a]/90 px-1.5 py-0.5 rounded border border-amber-500/30 whitespace-nowrap"
              >
                {lbl.text}
              </div>
            );
          }
          return (
            <div
              key={lbl.id}
              style={{ transform: `translate3d(${lbl.x}px, ${lbl.y}px, 0) translate(-50%, -100%)` }}
              className="absolute top-0 left-0 font-mono-tabular text-[10px] font-semibold text-slate-200 bg-[#0f172a]/90 px-1.5 py-0.5 rounded border border-slate-700/80 whitespace-nowrap"
            >
              {lbl.text}
            </div>
          );
        })}
      </div>
    </div>
  );
};
