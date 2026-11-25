import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { animated, useSpring } from '@react-spring/three';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export interface CourtAthlete3D {
  key: string;
  team: 'A' | 'B';
  slot: 1 | 2;
  name: string;
  isOnLeft: boolean;
  inBottom: boolean;
  isServing: boolean;
  isReceiving: boolean;
  boxLabel: string;
}

export interface PickleballCourt3DProps {
  athletes: CourtAthlete3D[];
  serverNumber: 1 | 2;
  scoreA: number;
  scoreB: number;
  servingTeam: 'A' | 'B';
  isAOnLeft: boolean;
  isLeftTopServing: boolean;
  isLeftBottomServing: boolean;
  isRightTopServing: boolean;
  isRightBottomServing: boolean;
  isLeftTopReceiving: boolean;
  isLeftBottomReceiving: boolean;
  isRightTopReceiving: boolean;
  isRightBottomReceiving: boolean;
  isDrawShaking?: boolean;
  isDrawSparkling?: boolean;
  onSelectAthlete: (team: 'A' | 'B', slot: 1 | 2) => void;
}

// Regulation Pickleball 20ft x 44ft scaled 1:2 -> X in [-11, 11] (22 units), Z in [-5, 5] (10 units)
const COURT_HALF_X = 11;
const COURT_HALF_Z = 5;
const NVZ_X = 3.5; // 7ft / 2 = 3.5 units from net
const LINE_W = 0.14;
const LINE_Y = 0.028;

// Pre-allocated scratch vectors (zero allocations inside useFrame)
const _vecStart = new THREE.Vector3();
const _vecEnd = new THREE.Vector3();
const _vecDir = new THREE.Vector3();
const _vecTrimStart = new THREE.Vector3();
const _vecTrimEnd = new THREE.Vector3();

function detectSoftwareWebGL(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (!ext) return false;
    const renderer = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '');
    return /SwiftShader|llvmpipe|Software/i.test(renderer);
  } catch {
    return false;
  }
}

function getAthleteTargetXZ(a: CourtAthlete3D): [number, number] {
  // Position near baseline when serving, centered in service box otherwise
  const x = a.isOnLeft
    ? a.isServing
      ? -9.6
      : -7.45
    : a.isServing
    ? 9.6
    : 7.45;
  const z = a.inBottom ? 2.45 : -2.45;
  return [x, z];
}

// Procedural high-DPI canvas texture for Vietnamese labels (court zones & player nameplates)
function createTextPlateTexture(
  primaryText: string,
  options: {
    width?: number;
    height?: number;
    bgColor?: string;
    borderColor?: string;
    textColor?: string;
    fontSize?: number;
    fontWeight?: string;
    radius?: number;
  } = {},
): THREE.CanvasTexture {
  const {
    width = 384,
    height = 104,
    bgColor = 'rgba(2, 6, 23, 0.9)',
    borderColor = 'rgba(255, 255, 255, 0.28)',
    textColor = '#ffffff',
    fontSize = 38,
    fontWeight = '800',
    radius = 24,
  } = options;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    ctx.clearRect(0, 0, width, height);

    if (bgColor !== 'transparent') {
      const pad = 4;
      const w = width - pad * 2;
      const h = height - pad * 2;
      ctx.beginPath();
      ctx.roundRect(pad, pad, w, h, radius);
      ctx.fillStyle = bgColor;
      ctx.fill();
      if (borderColor !== 'transparent') {
        ctx.lineWidth = 5;
        ctx.strokeStyle = borderColor;
        ctx.stroke();
      }
    }

    ctx.fillStyle = textColor;
    ctx.font = `${fontWeight} ${fontSize}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Truncate cleanly with ellipsis if text is very long
    let display = primaryText;
    const maxTextWidth = width - 32;
    if (ctx.measureText(display).width > maxTextWidth) {
      while (display.length > 3 && ctx.measureText(`${display}…`).width > maxTextWidth) {
        display = display.slice(0, -1);
      }
      display = `${display}…`;
    }
    ctx.fillText(display, width / 2, height / 2 + 1);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

function createNetMeshTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, 256, 64);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.42)';
    ctx.fillRect(0, 0, 256, 64);
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.65)';
    ctx.lineWidth = 2;
    for (let x = 0; x <= 256; x += 16) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 64);
      ctx.stroke();
    }
    for (let y = 0; y <= 64; y += 16) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(256, y);
      ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(16, 2);
  tex.needsUpdate = true;
  return tex;
}

function createPickleballTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    // High-visibility optic-lime Pickleball shell
    ctx.fillStyle = '#d9f99d';
    ctx.fillRect(0, 0, 256, 128);

    const grad = ctx.createLinearGradient(0, 0, 0, 128);
    grad.addColorStop(0, 'rgba(255,255,255,0.28)');
    grad.addColorStop(0.5, 'rgba(190,242,100,0.0)');
    grad.addColorStop(1, 'rgba(77,124,15,0.25)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 128);

    // Authentic perforated pickleball holes pattern
    ctx.fillStyle = '#1a2e05';
    for (let row = 0; row < 4; row++) {
      const y = 18 + row * 30;
      const offset = row % 2 === 0 ? 14 : 30;
      for (let x = offset; x < 256; x += 32) {
        ctx.beginPath();
        ctx.arc(x, y, 5.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

// Procedural RoomEnvironment + Responsive Overhead 3D Camera
const SceneLightingAndCamera: React.FC<{ isSoftwareGl: boolean }> = ({ isSoftwareGl }) => {
  const { gl, scene, camera, size } = useThree();

  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const roomEnv = new RoomEnvironment();
    const envRT = pmrem.fromScene(roomEnv, 0.04);
    scene.environment = envRT.texture;
    roomEnv.dispose();
    return () => {
      scene.environment = null;
      envRT.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);

  // Auto-fit overhead 3D court cleanly inside ANY phone portrait, landscape, or desktop container
  useEffect(() => {
    const persp = camera as THREE.PerspectiveCamera;
    const aspect = Math.max(size.width / Math.max(size.height, 1), 0.45);

    // Court bounds including outer apron & athlete labels
    const targetHalfWidth = 12.65;
    const targetHalfDepth = 6.7;

    const vFovRad = THREE.MathUtils.degToRad(persp.fov);
    const tanHalfV = Math.tan(vFovRad / 2);
    const tanHalfH = tanHalfV * aspect;

    // Tilt ~20 degrees from straight-down overhead for crisp 3D depth without wasting vertical space
    const tiltRad = THREE.MathUtils.degToRad(20);
    const distForWidth = targetHalfWidth / tanHalfH;
    const distForDepth = (targetHalfDepth * Math.cos(tiltRad)) / tanHalfV;
    const dist = Math.max(distForWidth, distForDepth) * 1.0;

    persp.position.set(0, Math.cos(tiltRad) * dist, Math.sin(tiltRad) * dist);
    persp.lookAt(0, 0, 0.18);
    persp.updateProjectionMatrix();
  }, [camera, size.width, size.height]);

  return (
    <>
      <color attach="background" args={['#052e23']} />
      <hemisphereLight args={['#e0f2fe', '#064e3b', 0.85]} />
      <directionalLight
        position={[7, 18, 9]}
        intensity={1.35}
        color="#fffbeb"
        castShadow={!isSoftwareGl}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={2}
        shadow-camera-far={45}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={9}
        shadow-camera-bottom={-9}
        shadow-bias={-0.0005}
      />
      <directionalLight position={[-9, 10, -7]} intensity={0.4} color="#bae6fd" />
    </>
  );
};

// Court Floor Surface, Crisp White Regulation Lines, Zone Highlights & Subtle Text Labels
const CourtSurfaceAndLines: React.FC<{
  isLeftTopServing: boolean;
  isLeftBottomServing: boolean;
  isRightTopServing: boolean;
  isRightBottomServing: boolean;
  isLeftTopReceiving: boolean;
  isLeftBottomReceiving: boolean;
  isRightTopReceiving: boolean;
  isRightBottomReceiving: boolean;
}> = ({
  isLeftTopServing,
  isLeftBottomServing,
  isRightTopServing,
  isRightBottomServing,
  isLeftTopReceiving,
  isLeftBottomReceiving,
  isRightTopReceiving,
  isRightBottomReceiving,
}) => {
  const zoneTextures = useMemo(() => {
    const oddTex = createTextPlateTexture('Ô LẺ', {
      width: 220,
      height: 76,
      bgColor: 'transparent',
      borderColor: 'transparent',
      textColor: 'rgba(255, 255, 255, 0.55)',
      fontSize: 36,
      fontWeight: '800',
    });
    const evenTex = createTextPlateTexture('Ô CHẴN', {
      width: 240,
      height: 76,
      bgColor: 'transparent',
      borderColor: 'transparent',
      textColor: 'rgba(255, 255, 255, 0.55)',
      fontSize: 36,
      fontWeight: '800',
    });
    const kitchenTex = createTextPlateTexture('BẾP · NVZ 7FT', {
      width: 340,
      height: 76,
      bgColor: 'transparent',
      borderColor: 'transparent',
      textColor: 'rgba(253, 230, 138, 0.65)',
      fontSize: 30,
      fontWeight: '800',
    });
    return { oddTex, evenTex, kitchenTex };
  }, []);

  useEffect(() => {
    return () => {
      zoneTextures.oddTex.dispose();
      zoneTextures.evenTex.dispose();
      zoneTextures.kitchenTex.dispose();
    };
  }, [zoneTextures]);

  const getQuadProps = (serving: boolean, receiving: boolean) => {
    if (serving) return { color: '#eab308', opacity: 0.32 };
    if (receiving) return { color: '#06b6d4', opacity: 0.28 };
    return { color: '#0369a1', opacity: 0 };
  };

  const lt = getQuadProps(isLeftTopServing, isLeftTopReceiving);
  const lb = getQuadProps(isLeftBottomServing, isLeftBottomReceiving);
  const rt = getQuadProps(isRightTopServing, isRightTopReceiving);
  const rb = getQuadProps(isRightBottomServing, isRightBottomReceiving);

  return (
    <group>
      {/* Stadium Dark Under-Plinth */}
      <mesh position={[0, -0.26, 0]} receiveShadow>
        <boxGeometry args={[25.8, 0.32, 13.4]} />
        <meshStandardMaterial color="#020617" roughness={0.85} metalness={0.1} />
      </mesh>

      {/* Outer Emerald Court Apron */}
      <mesh position={[0, -0.06, 0]} receiveShadow>
        <boxGeometry args={[25.2, 0.12, 12.8]} />
        <meshStandardMaterial color="#065f46" roughness={0.68} metalness={0.04} />
      </mesh>

      {/* Main Blue Acrylic Backcourt Base (22 x 10) */}
      <mesh position={[0, 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[COURT_HALF_X * 2, COURT_HALF_Z * 2]} />
        <meshStandardMaterial color="#075985" roughness={0.58} metalness={0.05} />
      </mesh>

      {/* Non-Volley Zones (Kitchen Left & Right: 7 x 10 total) */}
      <mesh position={[0, 0.009, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[NVZ_X * 2, COURT_HALF_Z * 2]} />
        <meshStandardMaterial color="#0f766e" roughness={0.6} metalness={0.04} />
      </mesh>

      {/* Active Serving / Receiving Quadrant Highlights */}
      {lt.opacity > 0 && (
        <mesh position={[-7.25, 0.014, -2.5]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[7.5, 5]} />
          <meshBasicMaterial color={lt.color} transparent opacity={lt.opacity} />
        </mesh>
      )}
      {lb.opacity > 0 && (
        <mesh position={[-7.25, 0.014, 2.5]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[7.5, 5]} />
          <meshBasicMaterial color={lb.color} transparent opacity={lb.opacity} />
        </mesh>
      )}
      {rt.opacity > 0 && (
        <mesh position={[7.25, 0.014, -2.5]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[7.5, 5]} />
          <meshBasicMaterial color={rt.color} transparent opacity={rt.opacity} />
        </mesh>
      )}
      {rb.opacity > 0 && (
        <mesh position={[7.25, 0.014, 2.5]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[7.5, 5]} />
          <meshBasicMaterial color={rb.color} transparent opacity={rb.opacity} />
        </mesh>
      )}

      {/* Regulation White Court Lines (Raised slightly to avoid Z-fighting) */}
      {/* Top & Bottom Sidelines */}
      <mesh position={[0, LINE_Y, -COURT_HALF_Z]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[COURT_HALF_X * 2 + LINE_W, LINE_W]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.4} polygonOffset polygonOffsetFactor={-1} />
      </mesh>
      <mesh position={[0, LINE_Y, COURT_HALF_Z]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[COURT_HALF_X * 2 + LINE_W, LINE_W]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.4} polygonOffset polygonOffsetFactor={-1} />
      </mesh>

      {/* Left & Right Baselines */}
      <mesh position={[-COURT_HALF_X, LINE_Y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[LINE_W, COURT_HALF_Z * 2]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.4} polygonOffset polygonOffsetFactor={-1} />
      </mesh>
      <mesh position={[COURT_HALF_X, LINE_Y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[LINE_W, COURT_HALF_Z * 2]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.4} polygonOffset polygonOffsetFactor={-1} />
      </mesh>

      {/* Left & Right Non-Volley Lines (NVZ) */}
      <mesh position={[-NVZ_X, LINE_Y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[LINE_W, COURT_HALF_Z * 2]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.4} polygonOffset polygonOffsetFactor={-1} />
      </mesh>
      <mesh position={[NVZ_X, LINE_Y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[LINE_W, COURT_HALF_Z * 2]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.4} polygonOffset polygonOffsetFactor={-1} />
      </mesh>

      {/* Center Service Lines (Strictly between Baseline and NVZ Line — regulation Pickleball) */}
      <mesh position={[-7.25, LINE_Y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[7.5, LINE_W]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.4} polygonOffset polygonOffsetFactor={-1} />
      </mesh>
      <mesh position={[7.25, LINE_Y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[7.5, LINE_W]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.4} polygonOffset polygonOffsetFactor={-1} />
      </mesh>

      {/* Subtle Net Shadow Line at X=0 */}
      <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.35, COURT_HALF_Z * 2 + 0.5]} />
        <meshBasicMaterial color="#020617" transparent opacity={0.38} />
      </mesh>

      {/* Painted Court Markings (Ô Lẻ / Ô Chẵn / BẾP) */}
      <mesh position={[-5.1, 0.022, -4.3]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.1, 0.72]} />
        <meshBasicMaterial map={zoneTextures.oddTex} transparent depthWrite={false} />
      </mesh>
      <mesh position={[-5.1, 0.022, 4.3]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.3, 0.72]} />
        <meshBasicMaterial map={zoneTextures.evenTex} transparent depthWrite={false} />
      </mesh>
      <mesh position={[5.1, 0.022, -4.3]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.3, 0.72]} />
        <meshBasicMaterial map={zoneTextures.evenTex} transparent depthWrite={false} />
      </mesh>
      <mesh position={[5.1, 0.022, 4.3]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.1, 0.72]} />
        <meshBasicMaterial map={zoneTextures.oddTex} transparent depthWrite={false} />
      </mesh>

      {/* NVZ Kitchen Labels rotated vertically inside each kitchen */}
      <mesh position={[-1.75, 0.022, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
        <planeGeometry args={[4.4, 0.95]} />
        <meshBasicMaterial map={zoneTextures.kitchenTex} transparent depthWrite={false} />
      </mesh>
      <mesh position={[1.75, 0.022, 0]} rotation={[-Math.PI / 2, 0, -Math.PI / 2]}>
        <planeGeometry args={[4.4, 0.95]} />
        <meshBasicMaterial map={zoneTextures.kitchenTex} transparent depthWrite={false} />
      </mesh>
    </group>
  );
};

// Multi-part 3D Pickleball Net Assembly at X=0
const PickleballNet3D: React.FC = () => {
  const netTexture = useMemo(() => createNetMeshTexture(), []);

  useEffect(() => {
    return () => {
      netTexture.dispose();
    };
  }, [netTexture]);

  return (
    <group position={[0, 0, 0]}>
      {/* Top & Bottom Weighted Base Feet */}
      {[-5.42, 5.42].map((zPos) => (
        <group key={zPos} position={[0, 0, zPos]}>
          {/* Steel Foot */}
          <mesh position={[0, 0.06, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.9, 0.12, 0.42]} />
            <meshStandardMaterial color="#1e293b" roughness={0.4} metalness={0.75} />
          </mesh>
          {/* Upright Net Post */}
          <mesh position={[0, 0.62, 0]} castShadow>
            <cylinderGeometry args={[0.14, 0.15, 1.16, 16]} />
            <meshStandardMaterial color="#f97316" roughness={0.3} metalness={0.55} />
          </mesh>
          {/* Post Top Cap */}
          <mesh position={[0, 1.22, 0]}>
            <cylinderGeometry args={[0.16, 0.16, 0.08, 16]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.35} metalness={0.2} />
          </mesh>
        </group>
      ))}

      {/* Translucent Woven Net Mesh */}
      <mesh position={[0, 0.56, 0]} rotation={[0, Math.PI / 2, 0]} castShadow>
        <planeGeometry args={[10.7, 0.82]} />
        <meshStandardMaterial
          map={netTexture}
          transparent
          opacity={0.92}
          side={THREE.DoubleSide}
          roughness={0.75}
        />
      </mesh>

      {/* Crisp White Top Headband Tape */}
      <mesh position={[0, 1.01, 0]} castShadow>
        <boxGeometry args={[0.11, 0.12, 10.82]} />
        <meshStandardMaterial color="#ffffff" roughness={0.3} metalness={0.05} />
      </mesh>

      {/* Bottom Tension Cable */}
      <mesh position={[0, 0.15, 0]}>
        <boxGeometry args={[0.04, 0.04, 10.72]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.35} metalness={0.8} />
      </mesh>

      {/* Center White Adjustment Strap */}
      <mesh position={[0, 0.52, 0]}>
        <boxGeometry args={[0.12, 0.96, 0.14]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.4} />
      </mesh>
    </group>
  );
};

// Shortened Diagonal Serve Arc (Explicitly trimmed outside athlete dots so it NEVER overlaps them)
const ShortDiagonalServeLine: React.FC<{
  servingAthlete?: CourtAthlete3D;
  receivingAthlete?: CourtAthlete3D;
}> = ({ servingAthlete, receivingAthlete }) => {
  const dashGroupRef = useRef<THREE.Group>(null);
  const pulseBeadRef = useRef<THREE.Mesh>(null);
  const [dashSegments, setDashSegments] = useState<
    Array<{ pos: [number, number, number]; quat: THREE.Quaternion; len: number }>
  >([]);

  const curveInfo = useMemo(() => {
    if (!servingAthlete || !receivingAthlete) return null;
    const [sx, sz] = getAthleteTargetXZ(servingAthlete);
    const [ex, ez] = getAthleteTargetXZ(receivingAthlete);

    _vecStart.set(sx, 0, sz);
    _vecEnd.set(ex, 0, ez);
    _vecDir.subVectors(_vecEnd, _vecStart);
    const fullDist = _vecDir.length();
    if (fullDist < 2) return null;
    _vecDir.normalize();

    // Trim strictly well outside both athlete dots & nameplates so the diagonal line never overlaps any player
    const trimMargin = Math.min(fullDist * 0.34, Math.max(0, (fullDist - 4.4) / 2));
    _vecTrimStart.copy(_vecStart).addScaledVector(_vecDir, trimMargin);
    _vecTrimEnd.copy(_vecEnd).addScaledVector(_vecDir, -trimMargin);

    const mid = new THREE.Vector3().addVectors(_vecTrimStart, _vecTrimEnd).multiplyScalar(0.5);
    mid.y = 1.48; // Arch cleanly above the 1.0m center net

    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(_vecTrimStart.x, 0.34, _vecTrimStart.z),
      mid,
      new THREE.Vector3(_vecTrimEnd.x, 0.34, _vecTrimEnd.z),
    );
    return curve;
  }, [servingAthlete, receivingAthlete]);

  const tipInfo = useMemo(() => {
    if (!curveInfo) return null;
    const tipPos = curveInfo.getPoint(1);
    const tangent = curveInfo.getTangent(1).normalize();
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);
    return { pos: [tipPos.x, tipPos.y, tipPos.z] as [number, number, number], quat };
  }, [curveInfo]);

  useEffect(() => {
    if (!curveInfo) {
      setDashSegments([]);
      return;
    }
    const numDashes = 7;
    const up = new THREE.Vector3(0, 1, 0);
    const segs: Array<{ pos: [number, number, number]; quat: THREE.Quaternion; len: number }> = [];
    for (let i = 0; i < numDashes; i++) {
      const t0 = i / numDashes + 0.02;
      const t1 = (i + 0.62) / numDashes;
      const p0 = curveInfo.getPoint(t0);
      const p1 = curveInfo.getPoint(t1);
      const center = new THREE.Vector3().addVectors(p0, p1).multiplyScalar(0.5);
      const diff = new THREE.Vector3().subVectors(p1, p0);
      const len = diff.length();
      const quat = new THREE.Quaternion().setFromUnitVectors(up, diff.normalize());
      segs.push({ pos: [center.x, center.y, center.z], quat, len });
    }
    setDashSegments(segs);
  }, [curveInfo]);

  if (!curveInfo || dashSegments.length === 0) return null;

  return (
    <group ref={dashGroupRef}>
      {dashSegments.map((seg, idx) => (
        <mesh key={idx} position={seg.pos} quaternion={seg.quat}>
          <cylinderGeometry args={[0.06, 0.06, seg.len, 8]} />
          <meshStandardMaterial
            color="#fde047"
            emissive="#facc15"
            emissiveIntensity={0.85}
            roughness={0.25}
          />
        </mesh>
      ))}
      {tipInfo && (
        <mesh position={tipInfo.pos} quaternion={tipInfo.quat}>
          <coneGeometry args={[0.17, 0.4, 12]} />
          <meshStandardMaterial
            color="#fde047"
            emissive="#facc15"
            emissiveIntensity={0.95}
            roughness={0.2}
          />
        </mesh>
      )}
    </group>
  );
};

// 3D Perforated Pickleball Ball animated smoothly via @react-spring/three on score changes
const SpringAnimatedBall3D: React.FC<{
  servingAthlete?: CourtAthlete3D;
  receivingAthlete?: CourtAthlete3D;
  scoreA: number;
  scoreB: number;
  servingTeam: 'A' | 'B';
  serverNumber: 1 | 2;
  isAOnLeft: boolean;
}> = ({
  servingAthlete,
  receivingAthlete,
  scoreA,
  scoreB,
  servingTeam,
  serverNumber,
  isAOnLeft,
}) => {
  const ballTexture = useMemo(() => createPickleballTexture(), []);

  useEffect(() => {
    return () => {
      ballTexture.dispose();
    };
  }, [ballTexture]);

  // Ready spot right in front of the active server
  const readySpot = useMemo<[number, number]>(() => {
    if (!servingAthlete) {
      const x = (servingTeam === 'A' ? isAOnLeft : !isAOnLeft) ? -8.2 : 8.2;
      return [x, 2.2];
    }
    const [sx, sz] = getAthleteTargetXZ(servingAthlete);
    const offsetTowardNet = servingAthlete.isOnLeft ? 1.25 : -1.25;
    return [sx + offsetTowardNet, sz];
  }, [servingAthlete, servingTeam, isAOnLeft]);

  const receiverSpot = useMemo<[number, number]>(() => {
    if (!receivingAthlete) {
      return [-readySpot[0] * 0.85, -readySpot[1]];
    }
    const [rx, rz] = getAthleteTargetXZ(receivingAthlete);
    const offsetTowardNet = receivingAthlete.isOnLeft ? 1.15 : -1.15;
    return [rx + offsetTowardNet, rz];
  }, [receivingAthlete, readySpot]);

  const prevScoreRef = useRef({ scoreA, scoreB, servingTeam, serverNumber });
  const flightRef = useRef<{
    from: [number, number];
    bounce: [number, number];
    to: [number, number];
  }>({
    from: readySpot,
    bounce: receiverSpot,
    to: readySpot,
  });

  const [spring, api] = useSpring(() => ({
    progress: 1,
    spin: 0,
    config: { mass: 0.9, tension: 82, friction: 16 },
  }));

  useEffect(() => {
    const prev = prevScoreRef.current;
    const scoreChanged = prev.scoreA !== scoreA || prev.scoreB !== scoreB;
    const serveChanged =
      prev.servingTeam !== servingTeam || prev.serverNumber !== serverNumber;

    if (scoreChanged || serveChanged) {
      // Determine which side won/hit the scoring shot so the ball flies convincingly over the net
      const aScored = scoreA > prev.scoreA;
      const bScored = scoreB > prev.scoreB;

      let hitterOnLeft = servingAthlete ? servingAthlete.isOnLeft : servingTeam === 'A' ? isAOnLeft : !isAOnLeft;
      if (aScored) hitterOnLeft = isAOnLeft;
      else if (bScored) hitterOnLeft = !isAOnLeft;

      const startX = hitterOnLeft ? -8.3 : 8.3;
      const startZ = readySpot[1];
      const bounceX = hitterOnLeft ? 7.0 : -7.0;
      const bounceZ = -startZ * 0.88;

      flightRef.current = {
        from: [startX, startZ],
        bounce: [bounceX, bounceZ],
        to: readySpot,
      };

      api.start({
        from: { progress: 0, spin: 0 },
        to: { progress: 1, spin: Math.PI * 6 },
        reset: true,
        config: { mass: 0.9, tension: 78, friction: 15 },
      });
    } else {
      flightRef.current = {
        from: readySpot,
        bounce: receiverSpot,
        to: readySpot,
      };
    }

    prevScoreRef.current = { scoreA, scoreB, servingTeam, serverNumber };
  }, [scoreA, scoreB, servingTeam, serverNumber, isAOnLeft, readySpot, receiverSpot, servingAthlete, api]);

  // Helper to evaluate 2-stage spring trajectory (0..0.66 cross-net shot -> bounce -> 0.66..1 settle to server)
  const sampleXZ = (p: number): [number, number] => {
    const { from, bounce, to } = flightRef.current;
    if (p <= 0.66) {
      const u = Math.max(0, Math.min(1, p / 0.66));
      return [
        THREE.MathUtils.lerp(from[0], bounce[0], u),
        THREE.MathUtils.lerp(from[1], bounce[1], u),
      ];
    }
    const u = Math.max(0, Math.min(1, (p - 0.66) / 0.34));
    return [
      THREE.MathUtils.lerp(bounce[0], to[0], u),
      THREE.MathUtils.lerp(bounce[1], to[1], u),
    ];
  };

  const sampleY = (p: number): number => {
    if (p <= 0.66) {
      const u = Math.max(0, Math.min(1, p / 0.66));
      // Parabolic arc peaking cleanly at y=2.45 over the 1.0m net, landing at bounce y=0.30
      return 0.32 + Math.sin(u * Math.PI) * 2.15;
    }
    const u = Math.max(0, Math.min(1, (p - 0.66) / 0.34));
    // Soft return hop to server's ready height y=0.38
    return 0.32 + Math.sin(u * Math.PI) * 1.15 + u * 0.06;
  };

  return (
    <>
      {/* Dynamic Ground Shadow tracking ball XZ & height */}
      <animated.mesh
        position-x={spring.progress.to((p) => sampleXZ(p)[0])}
        position-y={0.025}
        position-z={spring.progress.to((p) => sampleXZ(p)[1])}
        rotation={[-Math.PI / 2, 0, 0]}
        scale-x={spring.progress.to((p) => Math.max(0.55, 1.15 - sampleY(p) * 0.22))}
        scale-y={spring.progress.to((p) => Math.max(0.55, 1.15 - sampleY(p) * 0.22))}
      >
        <circleGeometry args={[0.34, 20]} />
        <meshBasicMaterial color="#020617" transparent opacity={0.48} />
      </animated.mesh>

      {/* 3D Perforated Pickleball Ball */}
      <animated.group
        position-x={spring.progress.to((p) => sampleXZ(p)[0])}
        position-y={spring.progress.to((p) => sampleY(p))}
        position-z={spring.progress.to((p) => sampleXZ(p)[1])}
        rotation-x={spring.spin}
        rotation-z={spring.spin.to((s) => s * 0.65)}
      >
        <mesh castShadow>
          <sphereGeometry args={[0.31, 22, 22]} />
          <meshStandardMaterial
            map={ballTexture}
            color="#ecfccb"
            emissive="#a3e635"
            emissiveIntensity={0.45}
            roughness={0.32}
            metalness={0.08}
          />
        </mesh>
      </animated.group>
    </>
  );
};

// Persistent 3D Athlete Token with Smooth Damped Glide + Blinking Role Aura + Draw Shake/Sparkle + Nameplate
const SPARKLE_ANGLES = [0, 1.05, 2.1, 3.14, 4.18, 5.24];

const AthleteToken3D: React.FC<{
  athlete: CourtAthlete3D;
  serverNumber: 1 | 2;
  isDrawShaking?: boolean;
  isDrawSparkling?: boolean;
  onSelect: (team: 'A' | 'B', slot: 1 | 2) => void;
}> = ({ athlete, serverNumber, isDrawShaking = false, isDrawSparkling = false, onSelect }) => {
  const groupRef = useRef<THREE.Group>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  const sparkleGroupRef = useRef<THREE.Group>(null);
  const puckMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const [hovered, setHovered] = useState(false);

  const [targetX, targetZ] = getAthleteTargetXZ(athlete);
  const initializedRef = useRef(false);

  const badgeTex = useMemo(() => {
    const label = `${athlete.team}${athlete.slot}`;
    return createTextPlateTexture(label, {
      width: 128,
      height: 128,
      bgColor: 'transparent',
      borderColor: 'transparent',
      textColor: athlete.isServing || athlete.isReceiving || athlete.team === 'A' ? '#020617' : '#ffffff',
      fontSize: 64,
      fontWeight: '900',
    });
  }, [athlete.team, athlete.slot, athlete.isServing, athlete.isReceiving]);

  const namePlateTex = useMemo(() => {
    const prefix = athlete.isServing ? `🎾 #${serverNumber} ` : athlete.isReceiving ? '◎ ' : '';
    const bgColor = athlete.isServing
      ? 'rgba(250, 204, 21, 0.96)'
      : athlete.isReceiving
      ? 'rgba(34, 211, 238, 0.96)'
      : 'rgba(2, 6, 23, 0.92)';
    const borderColor = athlete.isServing
      ? '#fef08a'
      : athlete.isReceiving
      ? '#a5f3fc'
      : 'rgba(255, 255, 255, 0.25)';
    const textColor = athlete.isServing || athlete.isReceiving ? '#020617' : '#f8fafc';

    return createTextPlateTexture(`${prefix}${athlete.name}`, {
      width: 440,
      height: 98,
      bgColor,
      borderColor,
      textColor,
      fontSize: 38,
      fontWeight: '800',
      radius: 22,
    });
  }, [athlete.name, athlete.isServing, athlete.isReceiving, serverNumber]);

  useEffect(() => {
    return () => {
      badgeTex.dispose();
    };
  }, [badgeTex]);

  useEffect(() => {
    return () => {
      namePlateTex.dispose();
    };
  }, [namePlateTex]);

  useEffect(() => {
    document.body.style.cursor = hovered ? 'pointer' : 'auto';
    return () => {
      document.body.style.cursor = 'auto';
    };
  }, [hovered]);

  useFrame(({ clock }, delta) => {
    const grp = groupRef.current;
    if (!grp) return;

    const t = clock.getElapsedTime();
    const phase = athlete.slot * 1.7 + (athlete.team === 'B' ? 2.4 : 0);

    if (!initializedRef.current) {
      grp.position.set(targetX, 0.04, targetZ);
      initializedRef.current = true;
    } else {
      const clampedDelta = Math.min(delta, 0.05);
      const shakeX = isDrawShaking ? Math.sin(t * 36 + phase) * 0.14 : 0;
      const shakeZ = isDrawShaking ? Math.cos(t * 32 + phase) * 0.1 : 0;
      grp.position.x = THREE.MathUtils.damp(grp.position.x, targetX + shakeX, 10, clampedDelta);
      grp.position.z = THREE.MathUtils.damp(grp.position.z, targetZ + shakeZ, 10, clampedDelta);
      grp.rotation.z = isDrawShaking ? Math.sin(t * 28 + phase) * 0.09 : THREE.MathUtils.damp(grp.rotation.z, 0, 12, clampedDelta);
    }

    if (haloRef.current && (athlete.isServing || athlete.isReceiving || isDrawSparkling)) {
      const wave = 0.5 + 0.5 * Math.sin(t * (isDrawSparkling ? 8.5 : 5.8));
      const s = 1 + wave * (isDrawSparkling ? 0.55 : 0.42);
      haloRef.current.scale.set(s, s, 1);
      const mat = haloRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.88 - wave * 0.58;
    }

    if (sparkleGroupRef.current && isDrawSparkling) {
      sparkleGroupRef.current.rotation.y = t * 2.4;
      sparkleGroupRef.current.children.forEach((child, idx) => {
        const twinkle = 0.45 + 0.75 * (0.5 + 0.5 * Math.sin(t * 9 + idx * 1.3));
        child.scale.setScalar(twinkle);
        child.position.y = 0.45 + Math.sin(t * 6 + idx) * 0.25;
      });
    }

    if (puckMatRef.current) {
      if (isDrawSparkling) {
        puckMatRef.current.emissiveIntensity = 0.6 + 0.55 * (0.5 + 0.5 * Math.sin(t * 10));
      } else if (athlete.isServing || athlete.isReceiving) {
        puckMatRef.current.emissiveIntensity = 0.35 + 0.45 * (0.5 + 0.5 * Math.sin(t * 6.5));
      } else {
        puckMatRef.current.emissiveIntensity = hovered ? 0.25 : 0.05;
      }
    }
  });

  const baseColor = athlete.isServing
    ? '#facc15'
    : athlete.isReceiving
    ? '#22d3ee'
    : athlete.team === 'A'
    ? '#10b981'
    : '#f97316';

  const emissiveColor = athlete.isServing
    ? '#eab308'
    : athlete.isReceiving
    ? '#06b6d4'
    : baseColor;

  return (
    <group
      ref={groupRef}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(athlete.team, athlete.slot);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      {/* Ground Soft Shadow Disc */}
      <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.92, 28]} />
        <meshBasicMaterial color="#020617" transparent opacity={0.45} />
      </mesh>

      {/* Blinking / Pulsing Halo Ring for Active Server, Receiver, or Draw Sparkle */}
      {(athlete.isServing || athlete.isReceiving || isDrawSparkling) && (
        <mesh ref={haloRef} position={[0, 0.025, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.78, 1.18, 32]} />
          <meshBasicMaterial
            color={isDrawSparkling ? '#fde047' : athlete.isServing ? '#fde047' : '#67e8f9'}
            transparent
            opacity={0.78}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {/* Orbiting Twinkling 3D Sparkle Stars when Draw Result Applies */}
      {isDrawSparkling && (
        <group ref={sparkleGroupRef}>
          {SPARKLE_ANGLES.map((angle, idx) => (
            <mesh
              key={idx}
              position={[Math.cos(angle) * 1.18, 0.48, Math.sin(angle) * 1.18]}
            >
              <octahedronGeometry args={[0.16, 0]} />
              <meshStandardMaterial
                color="#fef08a"
                emissive="#facc15"
                emissiveIntensity={1.6}
                roughness={0.15}
              />
            </mesh>
          ))}
        </group>
      )}

      {/* White Outer Trim Collar */}
      <mesh position={[0, 0.14, 0]} castShadow>
        <cylinderGeometry args={[0.76, 0.82, 0.2, 28]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.35} metalness={0.15} />
      </mesh>

      {/* Colored Athlete 3D Puck */}
      <mesh position={[0, 0.28, 0]} scale={hovered ? 1.08 : 1} castShadow>
        <cylinderGeometry args={[0.66, 0.72, 0.24, 28]} />
        <meshStandardMaterial
          ref={puckMatRef}
          color={baseColor}
          emissive={isDrawSparkling ? '#fde047' : emissiveColor}
          emissiveIntensity={0.25}
          roughness={0.28}
          metalness={0.22}
        />
      </mesh>

      {/* Top Code Badge (A1 / A2 / B1 / B2) */}
      <mesh position={[0, 0.41, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.95, 0.95]} />
        <meshBasicMaterial map={badgeTex} transparent depthWrite={false} />
      </mesh>

      {/* Tilted Readable Nameplate (Full Vietnamese Name + Active Role) */}
      <mesh position={[0, 0.45, 1.24]} rotation={[-Math.PI / 2.6, 0, 0]}>
        <planeGeometry args={[3.45, 0.78]} />
        <meshBasicMaterial map={namePlateTex} transparent depthWrite={false} />
      </mesh>
    </group>
  );
};

export const PickleballCourt3D: React.FC<PickleballCourt3DProps> = ({
  athletes,
  serverNumber,
  scoreA,
  scoreB,
  servingTeam,
  isAOnLeft,
  isLeftTopServing,
  isLeftBottomServing,
  isRightTopServing,
  isRightBottomServing,
  isLeftTopReceiving,
  isLeftBottomReceiving,
  isRightTopReceiving,
  isRightBottomReceiving,
  isDrawShaking = false,
  isDrawSparkling = false,
  onSelectAthlete,
}) => {
  const isSoftwareGl = useMemo(() => detectSoftwareWebGL(), []);
  const servingAthlete = athletes.find((a) => a.isServing);
  const receivingAthlete = athletes.find((a) => a.isReceiving);

  return (
    <div className="relative w-full h-full min-h-[104px] rounded-xl overflow-hidden bg-emerald-950 border border-emerald-700/60 shadow-inner">
      <Canvas
        shadows={!isSoftwareGl}
        dpr={isSoftwareGl ? 1 : [1, 2]}
        camera={{ fov: 36, near: 0.5, far: 100, position: [0, 22, 9.8] }}
        gl={{
          antialias: !isSoftwareGl,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.05,
        }}
      >
        <SceneLightingAndCamera isSoftwareGl={isSoftwareGl} />

        <CourtSurfaceAndLines
          isLeftTopServing={isLeftTopServing}
          isLeftBottomServing={isLeftBottomServing}
          isRightTopServing={isRightTopServing}
          isRightBottomServing={isRightBottomServing}
          isLeftTopReceiving={isLeftTopReceiving}
          isLeftBottomReceiving={isLeftBottomReceiving}
          isRightTopReceiving={isRightTopReceiving}
          isRightBottomReceiving={isRightBottomReceiving}
        />

        <PickleballNet3D />

        <ShortDiagonalServeLine
          servingAthlete={servingAthlete}
          receivingAthlete={receivingAthlete}
        />

        <SpringAnimatedBall3D
          servingAthlete={servingAthlete}
          receivingAthlete={receivingAthlete}
          scoreA={scoreA}
          scoreB={scoreB}
          servingTeam={servingTeam}
          serverNumber={serverNumber}
          isAOnLeft={isAOnLeft}
        />

        {athletes.map((athlete) => (
          <AthleteToken3D
            key={athlete.key}
            athlete={athlete}
            serverNumber={serverNumber}
            isDrawShaking={isDrawShaking}
            isDrawSparkling={isDrawSparkling}
            onSelect={onSelectAthlete}
          />
        ))}
      </Canvas>
    </div>
  );
};
