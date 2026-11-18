// Cena 3D da abertura: coração de rubi (modelado no Blender), anel em órbita e brilhos.
// Carregado sob demanda pelo script.js; se algo falhar, o pôster estático continua na tela.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const hero = document.getElementById("hero");
const canvas = document.getElementById("heroCanvas");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const coarse = matchMedia("(pointer: coarse)").matches;
const lowEnd = coarse && (navigator.hardwareConcurrency || 8) <= 4;

if (hero && canvas) init().catch((err) => console.warn("3D indisponível:", err));

async function init() {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !lowEnd, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, lowEnd ? 1.25 : coarse ? 1.75 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);

  const key = new THREE.DirectionalLight(0xffe2cf, 2.4);
  key.position.set(-3, 4, 5);
  const rim = new THREE.PointLight(0xff4f7d, 30, 12);
  rim.position.set(2.6, 1.4, -2.2);
  const under = new THREE.PointLight(0xffb37a, 10, 10);
  under.position.set(-1.5, -2.6, 2);
  scene.add(key, rim, under);

  // ---------- modelo ----------
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync(new URL("coracao.glb", document.baseURI).href);
  const heartMesh = gltf.scene.getObjectByName("Coracao");
  const ring = gltf.scene.getObjectByName("Anel");
  if (!heartMesh) throw new Error("modelo sem coração");

  heartMesh.material = new THREE.MeshPhysicalMaterial({
    color: 0x8c0624,
    roughness: 0.24,
    metalness: 0.08,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    sheen: 0.35,
    sheenColor: new THREE.Color(0xff5c80),
    sheenRoughness: 0.4,
    iridescence: 0.15,
    iridescenceIOR: 1.4,
    envMapIntensity: 0.75,
  });

  const heart = new THREE.Group();
  heartMesh.position.set(0, 0, 0);
  heart.add(heartMesh);

  const world = new THREE.Group(); // posição/escala controladas pelo layout e pela rolagem
  world.add(heart);
  scene.add(world);

  // anel de ouro rosé em órbita
  const orbit = new THREE.Group();
  world.add(orbit);
  if (ring) {
    ring.position.set(0, 0, 0);
    ring.traverse((o) => {
      if (!o.isMesh) return;
      if (o.name.startsWith("Diamante")) {
        o.material = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0, metalness: 0, flatShading: true, envMapIntensity: 3.2, clearcoat: 1 });
      } else {
        o.material = new THREE.MeshStandardMaterial({ color: 0xf2b79c, roughness: 0.16, metalness: 1, envMapIntensity: 1.4 });
      }
    });
    ring.scale.setScalar(0.62);
    orbit.add(ring);
  }

  // halo suave atrás do coração (um "bloom" barato)
  const glowTex = radialTexture([[0, "rgba(255,120,150,0.55)"], [0.35, "rgba(214,40,90,0.22)"], [1, "rgba(0,0,0,0)"]]);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  glow.scale.setScalar(5.2);
  glow.position.z = -1.2;
  world.add(glow);

  // brilhos dourados
  const sparkCount = lowEnd ? 70 : coarse ? 110 : 170;
  const pos = new Float32Array(sparkCount * 3);
  for (let i = 0; i < sparkCount; i++) {
    const r = 1.7 + Math.random() * 2.6;
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    pos.set([r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph) * 0.8, r * Math.sin(ph) * Math.sin(th) - 0.5], i * 3);
  }
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const sparks = new THREE.Points(sparkGeo, new THREE.PointsMaterial({
    size: 0.07,
    map: radialTexture([[0, "rgba(255,246,228,1)"], [0.25, "rgba(255,214,170,0.8)"], [1, "rgba(255,180,160,0)"]]),
    color: 0xffe0c4,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  }));
  world.add(sparks);

  // ---------- layout responsivo ----------
  let orbitR = 1.45;
  const resize = () => {
    const w = hero.clientWidth, h = hero.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // garante que o coração caiba na largura do celular e ocupe ~42% da altura
    const fovT = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const needH = Math.max(2 / 0.44, (2.1 / 0.62) / camera.aspect);
    camera.position.set(0, 0, needH / (2 * fovT));
    camera.updateProjectionMatrix();
    const visH = needH, visW = needH * camera.aspect;
    baseY = -visH * (camera.aspect < 0.8 ? 0.07 : 0.05);
    orbitR = Math.min(1.5, visW * 0.3);
  };
  let baseY = 0;
  resize();
  new ResizeObserver(resize).observe(hero);

  // ---------- interação ----------
  const target = { x: 0, y: 0 };
  let spinVel = 0, dragX = null, downAt = null, pulse = 0;
  if (!coarse) {
    addEventListener("pointermove", (e) => {
      target.y = (e.clientX / innerWidth - 0.5) * 0.9;
      target.x = (e.clientY / innerHeight - 0.5) * 0.35;
    }, { passive: true });
  }
  canvas.addEventListener("pointerdown", (e) => {
    dragX = e.clientX;
    downAt = { x: e.clientX, y: e.clientY, t: performance.now() };
  });
  canvas.addEventListener("pointermove", (e) => {
    if (dragX === null) return;
    spinVel += (e.clientX - dragX) * 0.0045;
    dragX = e.clientX;
  });
  const endDrag = () => { dragX = null; };
  canvas.addEventListener("pointercancel", endDrag);
  canvas.addEventListener("pointerleave", endDrag);

  const ray = new THREE.Raycaster();
  canvas.addEventListener("pointerup", (e) => {
    endDrag();
    if (!downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 10) return;
    const r = canvas.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
    if (ray.intersectObject(heartMesh, false).length) {
      pulse = 1;
      spinVel += 0.25;
      dispatchEvent(new CustomEvent("heart:tap", { detail: { x: e.clientX, y: e.clientY } }));
    }
  });

  // ---------- animação ----------
  const clock = new THREE.Clock();
  let intro = reducedMotion ? 1 : 0;
  let spin = 0;
  if (!reducedMotion) spinVel = 0.16; // giro de entrada
  let scrollP = 0;
  const onScroll = () => {
    const r = hero.getBoundingClientRect();
    scrollP = THREE.MathUtils.clamp(-r.top / Math.max(1, r.height), 0, 1);
  };
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  const beat = (t) => {
    // batida dupla a cada 1.7s
    const p = (t % 1.7) / 1.7;
    const b = (x, c, w) => Math.exp(-((x - c) ** 2) / w);
    return b(p, 0.08, 0.0012) * 0.9 + b(p, 0.22, 0.0016) * 0.55;
  };

  const tick = () => {
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    intro = Math.min(1, intro + dt / 1.6);
    const e = 1 - Math.pow(1 - intro, 4);

    spinVel *= Math.pow(0.08, dt);
    spin += spinVel;
    // depois de girar, volta suavemente a encarar a câmera
    const sway = Math.sin(t * 0.6) * 0.38;
    const wrapped = Math.atan2(Math.sin(spin), Math.cos(spin));
    if (Math.abs(spinVel) < 0.01) spin -= wrapped * Math.min(1, dt * 1.6);

    heart.rotation.y = spin + sway * (reducedMotion ? 0 : 1) + target.y * 0.6;
    heart.rotation.x = THREE.MathUtils.lerp(heart.rotation.x, target.x, 0.06);
    heart.rotation.z = Math.sin(t * 0.8) * 0.04;

    pulse = Math.max(0, pulse - dt * 1.8);
    const s = e * (1 + (reducedMotion ? 0 : beat(t) * 0.035) + Math.sin(pulse * Math.PI) * 0.12);
    heart.scale.setScalar(s);
    heart.position.y = reducedMotion ? 0 : Math.sin(t * 1.1) * 0.06;

    // órbita do anel: passa na frente e atrás do coração
    const a = t * (reducedMotion ? 0 : 0.55) + 0.9;
    orbit.position.set(Math.cos(a) * orbitR, Math.sin(a) * 0.42 + 0.15, Math.sin(a) * orbitR * 0.75);
    orbit.rotation.set(t * 0.7, t * 0.9, 0.4);
    orbit.scale.setScalar(e);

    sparks.rotation.y = t * 0.04;
    glow.material.opacity = 0.75 + beat(t) * 0.25;

    // rolagem: o coração sobe, diminui e some
    world.position.y = baseY + scrollP * 1.6 + (1 - e) * -0.6;
    world.scale.setScalar(1 - scrollP * 0.35);
    canvas.style.opacity = String(1 - Math.min(1, scrollP * 1.4));

    renderer.render(scene, camera);
  };

  // só renderiza enquanto a abertura estiver visível
  let running = false;
  const setRunning = (on) => {
    if (on === running) return;
    running = on;
    clock.getDelta();
    renderer.setAnimationLoop(on ? tick : null);
  };
  new IntersectionObserver(([en]) => setRunning(en.isIntersecting)).observe(hero);
  setRunning(true);

  // primeira imagem pronta: esconde o pôster
  requestAnimationFrame(() => requestAnimationFrame(() => hero.classList.add("is-3d")));
}

function radialTexture(stops) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  stops.forEach(([o, col]) => grd.addColorStop(o, col));
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
