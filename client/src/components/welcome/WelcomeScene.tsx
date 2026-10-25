import * as THREE from 'three';
import { useEffect, useRef, useState, type JSX } from 'react';
import { WelcomeFallbackScene } from './WelcomeFallbackScene';

function isWebGLAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}

interface DocumentCardMeta {
  title: string;
  tag: string;
  badge: string;
  color: string;
  position: [number, number, number];
  rotation: [number, number, number];
  speed: number;
  phase: number;
}

const DOCUMENT_CARDS: DocumentCardMeta[] = [
  {
    title: 'Confidential_Audit.enc',
    tag: 'SHA-256 HASH CHAIN',
    badge: 'IMMUTABLE',
    color: '#38bdf8',
    position: [-2.45, 0.75, -0.4],
    rotation: [0.1, 0.28, -0.06],
    speed: 1.2,
    phase: 0,
  },
  {
    title: 'Enterprise_Vault.key',
    tag: 'ZERO-KNOWLEDGE',
    badge: 'RESTRICTED',
    color: '#818cf8',
    position: [2.45, -0.65, -0.2],
    rotation: [-0.08, -0.32, 0.05],
    speed: 1.4,
    phase: 1.8,
  },
  {
    title: 'Identity_Governance.pdf',
    tag: 'MULTI-TENANT ISOLATION',
    badge: 'VERIFIED',
    color: '#2dd4bf',
    position: [-2.1, -1.25, 0.3],
    rotation: [0.14, 0.22, 0.08],
    speed: 1.1,
    phase: 3.2,
  },
  {
    title: 'Tamper_Ledger_917384.log',
    tag: 'CRYPTOGRAPHIC PROOF',
    badge: 'PROTECTED',
    color: '#38bdf8',
    position: [2.2, 1.15, 0.2],
    rotation: [-0.12, -0.25, -0.05],
    speed: 1.3,
    phase: 4.5,
  },
];

function createDocumentCardTexture(meta: DocumentCardMeta): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 300;
  canvas.height = 400;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  // Background rounded rect
  const r = 16;
  const w = 300;
  const h = 400;

  ctx.clearRect(0, 0, w, h);

  // Card background with subtle gradient
  const bgGrad = ctx.createLinearGradient(0, 0, w, h);
  bgGrad.addColorStop(0, 'rgba(17, 28, 52, 0.92)');
  bgGrad.addColorStop(1, 'rgba(10, 18, 35, 0.96)');

  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(w - r, 0);
  ctx.quadraticCurveTo(w, 0, w, r);
  ctx.lineTo(w, h - r);
  ctx.quadraticCurveTo(w, h, w - r, h);
  ctx.lineTo(r, h);
  ctx.quadraticCurveTo(0, h, 0, h - r);
  ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();
  ctx.fillStyle = bgGrad;
  ctx.fill();

  // Border
  ctx.lineWidth = 3;
  ctx.strokeStyle = meta.color;
  ctx.stroke();

  // Header Badge
  ctx.fillStyle = 'rgba(56, 189, 248, 0.12)';
  ctx.fillRect(20, 22, 120, 28);
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(20, 22, 120, 28);

  ctx.font = 'bold 12px monospace';
  ctx.fillStyle = meta.color;
  ctx.fillText(`● ${meta.badge}`, 32, 41);

  // Document Icon / Shield dot
  ctx.beginPath();
  ctx.arc(260, 36, 6, 0, Math.PI * 2);
  ctx.fillStyle = meta.color;
  ctx.fill();

  // Document Title
  ctx.font = 'bold 17px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#f8fafc';
  ctx.fillText(meta.title, 20, 92);

  // Subtitle / Tag
  ctx.font = '12px monospace';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText(meta.tag, 20, 118);

  // Horizontal divider
  ctx.fillStyle = 'rgba(148, 163, 184, 0.18)';
  ctx.fillRect(20, 136, 260, 2);

  // Mock document lines
  const lines = [
    { w: 240, color: 'rgba(241, 245, 249, 0.7)' },
    { w: 210, color: 'rgba(148, 163, 184, 0.5)' },
    { w: 250, color: 'rgba(148, 163, 184, 0.5)' },
    { w: 180, color: 'rgba(148, 163, 184, 0.5)' },
    { w: 220, color: 'rgba(56, 189, 248, 0.6)' },
    { w: 190, color: 'rgba(148, 163, 184, 0.4)' },
    { w: 140, color: 'rgba(148, 163, 184, 0.35)' },
  ];

  let y = 165;
  lines.forEach((line) => {
    ctx.fillStyle = line.color;
    ctx.fillRect(20, y, line.w, 8);
    y += 24;
  });

  // Footer security seal
  ctx.fillStyle = 'rgba(56, 189, 248, 0.08)';
  ctx.fillRect(20, 345, 260, 32);
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.2)';
  ctx.lineWidth = 1;
  ctx.strokeRect(20, 345, 260, 32);

  ctx.font = '11px monospace';
  ctx.fillStyle = '#38bdf8';
  ctx.fillText('TRUSTVAULT ENCLAVE VERIFIED', 42, 366);

  const texture = new THREE.CanvasTexture(canvas);
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  return texture;
}

export function WelcomeScene({ forceFallback = false }: { forceFallback?: boolean } = {}): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const [useFallback, setUseFallback] = useState(() => {
    if (forceFallback) return true;
    if (typeof window === 'undefined') return true;
    const prefersReducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    return !isWebGLAvailable() || prefersReducedMotion;
  });

  useEffect(() => {
    if (useFallback) return;

    // Check WebGL availability and user motion preference
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!isWebGLAvailable() || prefersReducedMotion) {
      setUseFallback(true);
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    let width = container.clientWidth || window.innerWidth;
    let height = container.clientHeight || window.innerHeight;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x070b14, 0.045);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0, 7.6);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    // 2. Lighting
    const ambientLight = new THREE.AmbientLight(0x0f1c3f, 1.4);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0x38bdf8, 2.8);
    keyLight.position.set(4, 5, 5);
    scene.add(keyLight);

    const rimLight = new THREE.PointLight(0x818cf8, 3.5, 15);
    rimLight.position.set(-4, -2, -3);
    scene.add(rimLight);

    const glowLight = new THREE.PointLight(0x38bdf8, 2.5, 8);
    glowLight.position.set(0, 0, 1.6);
    scene.add(glowLight);

    // 3. 3D Metallic Security Shield with Glowing Edge
    const shieldGroup = new THREE.Group();
    scene.add(shieldGroup);

    // Shield Shape
    const shieldShape = new THREE.Shape();
    shieldShape.moveTo(0, 1.55);
    shieldShape.lineTo(1.25, 1.15);
    shieldShape.lineTo(1.25, 0.15);
    shieldShape.bezierCurveTo(1.25, -0.65, 0.75, -1.35, 0, -1.65);
    shieldShape.bezierCurveTo(-0.75, -1.35, -1.25, -0.65, -1.25, 0.15);
    shieldShape.lineTo(-1.25, 1.15);
    shieldShape.lineTo(0, 1.55);

    const extrudeSettings: THREE.ExtrudeGeometryOptions = {
      depth: 0.22,
      bevelEnabled: true,
      bevelSegments: 5,
      steps: 1,
      bevelSize: 0.08,
      bevelThickness: 0.08,
    };

    const shieldGeo = new THREE.ExtrudeGeometry(shieldShape, extrudeSettings);
    shieldGeo.center();

    // Metallic material
    const shieldMat = new THREE.MeshStandardMaterial({
      color: 0x0c162b,
      metalness: 0.88,
      roughness: 0.22,
      emissive: 0x091428,
      emissiveIntensity: 0.45,
    });
    const shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
    shieldGroup.add(shieldMesh);

    // Glowing cyan edge contour
    const edgesGeo = new THREE.EdgesGeometry(shieldGeo, 24);
    const edgeMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      linewidth: 2,
      transparent: true,
      opacity: 0.85,
    });
    const edgeLines = new THREE.LineSegments(edgesGeo, edgeMat);
    shieldGroup.add(edgeLines);

    // Front Checkmark Crest
    const checkShape = new THREE.Shape();
    checkShape.moveTo(-0.45, 0.05);
    checkShape.lineTo(-0.15, -0.32);
    checkShape.lineTo(0.5, 0.45);
    checkShape.lineTo(0.5, 0.28);
    checkShape.lineTo(-0.15, -0.48);
    checkShape.lineTo(-0.45, -0.1);
    checkShape.closePath();

    const checkGeo = new THREE.ExtrudeGeometry(checkShape, {
      depth: 0.06,
      bevelEnabled: true,
      bevelSegments: 3,
      steps: 1,
      bevelSize: 0.02,
      bevelThickness: 0.02,
    });
    checkGeo.center();

    const checkMat = new THREE.MeshStandardMaterial({
      color: 0x5eead4,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.85,
      metalness: 0.9,
      roughness: 0.15,
    });
    const checkMesh = new THREE.Mesh(checkGeo, checkMat);
    checkMesh.position.z = 0.2;
    shieldGroup.add(checkMesh);

    // Subtle Cyan Aura Ring behind shield
    const auraCanvas = document.createElement('canvas');
    auraCanvas.width = 128;
    auraCanvas.height = 128;
    const auraCtx = auraCanvas.getContext('2d');
    if (auraCtx) {
      const grad = auraCtx.createRadialGradient(64, 64, 0, 64, 64, 64);
      grad.addColorStop(0, 'rgba(56, 189, 248, 0.4)');
      grad.addColorStop(0.5, 'rgba(129, 140, 248, 0.15)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      auraCtx.fillStyle = grad;
      auraCtx.fillRect(0, 0, 128, 128);
    }
    const auraTexture = new THREE.CanvasTexture(auraCanvas);
    const auraMat = new THREE.SpriteMaterial({
      map: auraTexture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      opacity: 0.7,
    });
    const auraSprite = new THREE.Sprite(auraMat);
    auraSprite.scale.set(4.8, 4.8, 1);
    auraSprite.position.set(0, 0, -0.2);
    shieldGroup.add(auraSprite);

    // 4. Subtle Digital Particles
    const particleCount = 700;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    const particleColors = new Float32Array(particleCount * 3);
    const particleVelocities = new Float32Array(particleCount);

    const cCyan = new THREE.Color(0x38bdf8);
    const cTeal = new THREE.Color(0x5eead4);
    const cIndigo = new THREE.Color(0x818cf8);

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      particlePositions[i3] = (Math.random() - 0.5) * 16;
      particlePositions[i3 + 1] = (Math.random() - 0.5) * 12;
      particlePositions[i3 + 2] = (Math.random() - 0.5) * 8 - 1;

      const pick = Math.random();
      const col = pick < 0.45 ? cCyan : pick < 0.8 ? cTeal : cIndigo;
      particleColors[i3] = col.r;
      particleColors[i3 + 1] = col.g;
      particleColors[i3 + 2] = col.b;

      particleVelocities[i] = 0.004 + Math.random() * 0.008;
    }

    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    particleGeo.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));

    // Particle sprite
    const pCanvas = document.createElement('canvas');
    pCanvas.width = 32;
    pCanvas.height = 32;
    const pCtx = pCanvas.getContext('2d');
    if (pCtx) {
      const pGrad = pCtx.createRadialGradient(16, 16, 0, 16, 16, 16);
      pGrad.addColorStop(0, 'rgba(255, 255, 255, 1)');
      pGrad.addColorStop(0.3, 'rgba(56, 189, 248, 0.8)');
      pGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
      pCtx.fillStyle = pGrad;
      pCtx.fillRect(0, 0, 32, 32);
    }
    const pTexture = new THREE.CanvasTexture(pCanvas);

    const particleMat = new THREE.PointsMaterial({
      size: 0.15,
      vertexColors: true,
      map: pTexture,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const particleSystem = new THREE.Points(particleGeo, particleMat);
    scene.add(particleSystem);

    // 5. Floating Document Panels
    const cardMeshes: {
      mesh: THREE.Mesh;
      meta: DocumentCardMeta;
      initialPos: [number, number, number];
      initialRot: [number, number, number];
    }[] = [];

    const cardGeo = new THREE.BoxGeometry(1.0, 1.34, 0.015);
    const texturesToDispose: THREE.CanvasTexture[] = [auraTexture, pTexture];

    DOCUMENT_CARDS.forEach((meta) => {
      const tex = createDocumentCardTexture(meta);
      texturesToDispose.push(tex);

      const cardMat = new THREE.MeshStandardMaterial({
        map: tex,
        transparent: true,
        opacity: 0.88,
        roughness: 0.25,
        metalness: 0.35,
      });

      const mesh = new THREE.Mesh(cardGeo, cardMat);
      mesh.position.set(...meta.position);
      mesh.rotation.set(...meta.rotation);

      scene.add(mesh);
      cardMeshes.push({
        mesh,
        meta,
        initialPos: meta.position,
        initialRot: meta.rotation,
      });
    });

    // 6. Interactive Parallax & Animation
    let mouseX = 0;
    let mouseY = 0;
    let targetMouseX = 0;
    let targetMouseY = 0;

    const handlePointerMove = (e: MouseEvent) => {
      targetMouseX = (e.clientX / window.innerWidth) * 2 - 1;
      targetMouseY = -(e.clientY / window.innerHeight) * 2 + 1;
    };

    window.addEventListener('mousemove', handlePointerMove, { passive: true });

    let animationFrameId: number;
    let startTime = performance.now();
    let isTabVisible = true;

    const handleVisibilityChange = () => {
      isTabVisible = !document.hidden;
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const render = (now: number) => {
      animationFrameId = requestAnimationFrame(render);
      if (!isTabVisible) return;

      const elapsed = (now - startTime) / 1000;

      // Smooth camera intro reveal: ease from 7.6 to 5.2
      const targetCamZ = 5.25;
      camera.position.z += (targetCamZ - camera.position.z) * 0.035;

      // Smooth mouse parallax
      mouseX += (targetMouseX - mouseX) * 0.04;
      mouseY += (targetMouseY - mouseY) * 0.04;

      camera.position.x = mouseX * 0.35;
      camera.position.y = mouseY * 0.25;
      camera.lookAt(0, 0, 0);

      // Shield floating & smooth rotation
      shieldGroup.position.y = Math.sin(elapsed * 1.2) * 0.12;
      shieldGroup.rotation.y = Math.sin(elapsed * 0.6) * 0.28 + mouseX * 0.25;
      shieldGroup.rotation.x = Math.sin(elapsed * 0.8) * 0.06 - mouseY * 0.15;
      shieldGroup.rotation.z = Math.sin(elapsed * 0.5) * 0.02;

      // Glowing light intensity breathing
      glowLight.intensity = 2.2 + Math.sin(elapsed * 2.0) * 0.6;

      // Floating document cards
      cardMeshes.forEach(({ mesh, meta, initialPos, initialRot }) => {
        const t = elapsed * meta.speed + meta.phase;
        mesh.position.y = initialPos[1] + Math.sin(t) * 0.14;
        mesh.position.x = initialPos[0] + Math.cos(t * 0.8) * 0.06;
        mesh.rotation.y = initialRot[1] + Math.sin(t * 0.7) * 0.08 + mouseX * 0.1;
        mesh.rotation.x = initialRot[0] + Math.cos(t * 0.9) * 0.05 - mouseY * 0.08;
        mesh.rotation.z = initialRot[2] + Math.sin(t * 0.5) * 0.03;
      });

      // Digital particles upward float
      const posAttr = particleGeo.getAttribute('position') as THREE.BufferAttribute | undefined;
      if (posAttr) {
        for (let i = 0; i < particleCount; i++) {
          const i3 = i * 3;
          const v = particleVelocities[i] ?? 0.005;
          const currentY = particlePositions[i3 + 1] ?? 0;
          if (currentY + v > 6) {
            particlePositions[i3 + 1] = -6;
            particlePositions[i3] = (Math.random() - 0.5) * 16;
          } else {
            particlePositions[i3 + 1] = currentY + v;
          }
        }
        posAttr.needsUpdate = true;
      }

      renderer.render(scene, camera);
    };

    animationFrameId = requestAnimationFrame(render);

    // 7. Responsive Resize
    const handleResize = () => {
      if (!container) return;
      width = container.clientWidth || window.innerWidth;
      height = container.clientHeight || window.innerHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    window.addEventListener('resize', handleResize);

    // 8. Cleanup on Unmount
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);

      if (container && renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }

      // Dispose Three.js resources
      renderer.dispose();
      shieldGeo.dispose();
      shieldMat.dispose();
      edgesGeo.dispose();
      edgeMat.dispose();
      checkGeo.dispose();
      checkMat.dispose();
      auraMat.dispose();
      cardGeo.dispose();
      particleGeo.dispose();
      particleMat.dispose();
      texturesToDispose.forEach((tex) => tex.dispose());
    };
  }, []);

  if (useFallback) {
    return <WelcomeFallbackScene />;
  }

  return (
    <div
      ref={containerRef}
      className="welcome-scene-container"
      aria-hidden="true"
    />
  );
}
