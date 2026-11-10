import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import circuit from './data/interlagos.json';
import { loadCurrentTrack } from './track-api.js';
import './style.css';

const canvas = document.querySelector('canvas');
const section = document.querySelector('#track');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 600);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.35;

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.075;
controls.enablePan = false;
controls.minDistance = 65;
controls.maxDistance = 650;
controls.minPolarAngle = 0.15;
controls.maxPolarAngle = Math.PI / 2.12;
controls.enableZoom = false;
// Keep ordinary scrolling available; wheel zoom belongs to the focused viewer.
canvas.addEventListener('wheel', (event) => {
  if (document.activeElement !== canvas) return;
  event.preventDefault();
  camera.position.sub(controls.target).multiplyScalar(Math.exp(event.deltaY * 0.001));
  camera.position.clampLength(controls.minDistance, controls.maxDistance).add(controls.target);
  controls.update();
}, { passive: false });
controls.addEventListener('start', () => canvas.classList.add('dragging'));
controls.addEventListener('end', () => canvas.classList.remove('dragging'));
canvas.addEventListener('pointerdown', () => canvas.focus({ preventScroll: true }));

scene.add(new THREE.HemisphereLight(0xfffcf3, 0x707d5d, 3));
const sun = new THREE.DirectionalLight(0xfff8e9, 4);
sun.position.set(-45, 90, 35);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -80, right: 80, top: 80, bottom: -80, near: 1, far: 220 });
sun.shadow.normalBias = 0.08;
sun.shadow.bias = -0.0001;
sun.shadow.radius = 4;
scene.add(sun);

const model = new THREE.Group();
model.rotation.y = -0.48;
scene.add(model);
// Render the bundled model immediately while the schedule API warms its cache.
// Rebuild only the model when fresh circuit data arrives; keep camera controls.
function buildTrack(circuit) {
  const coordinates = circuit.features[0].geometry.coordinates.map(point => [...point]);
  const first = coordinates[0];
  const last = coordinates.at(-1);
  if (first[0] === last[0] && first[1] === last[1]) coordinates.pop();
  const longitudes = coordinates.map(([longitude]) => longitude);
  const latitudes = coordinates.map(([, latitude]) => latitude);
  const midLongitude = (Math.min(...longitudes) + Math.max(...longitudes)) / 2;
  const midLatitude = (Math.min(...latitudes) + Math.max(...latitudes)) / 2;
  const latitudeSpan = Math.max(...latitudes) - Math.min(...latitudes);
  const longitudeFactor = Math.cos(midLatitude * Math.PI / 180);
  const longitudeSpan = (Math.max(...longitudes) - Math.min(...longitudes)) * longitudeFactor;
  const scale = Math.min(100 / Math.max(latitudeSpan, 0.000001), 66 / Math.max(longitudeSpan, 0.000001));
  const points = coordinates.map(([longitude, latitude]) => new THREE.Vector3(
    (longitude - midLongitude) * longitudeFactor * scale,
    0,
    -(latitude - midLatitude) * scale,
  ));
  const path = new THREE.CatmullRomCurve3(points, true, 'centripetal');
  const samples = path.getSpacedPoints(1600);

  // A closed ribbon preserves the geographic outline without inflating tight corners.
  function ribbon(inner, outer, height, material, alternating = false) {
    const vertices = [];
    const colors = [];
    const indices = [];
    const red = new THREE.Color('#b54b3e');
    const white = new THREE.Color('#e9e7d8');
    for (let i = 0; i < samples.length; i++) {
      const p = samples[i];
      const tangent = path.getTangentAt(i / (samples.length - 1));
      const normal = new THREE.Vector3(-tangent.z, 0, tangent.x);
      for (const width of [inner, outer]) {
        vertices.push(p.x + normal.x * width, height, p.z + normal.z * width);
        const color = Math.floor(i / 5) % 2 ? red : white;
        colors.push(color.r, color.g, color.b);
      }
      if (i < samples.length - 1) {
        const n = i * 2;
        indices.push(n, n + 2, n + 1, n + 1, n + 2, n + 3);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    if (alternating) geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.receiveShadow = true;
    model.add(mesh);
  }

  const material = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.95, side: THREE.DoubleSide });
  ribbon(-1.6, 1.6, 0.04, material('#a5ac86'));
  ribbon(-0.88, 0.88, 0.09, material('#e7e5d5'));
  ribbon(-0.75, 0.75, 0.11, material('#343b39'));
  const curbMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, side: THREE.DoubleSide });
  ribbon(-1.02, -0.88, 0.12, curbMaterial, true);
  ribbon(0.88, 1.02, 0.12, curbMaterial, true);

  // A softly rounded plinth keeps the track readable as a physical model.
  const baseShape = new THREE.Shape();
  const width = 83;
  const depth = 117;
  const radius = 10;
  baseShape.moveTo(-width / 2 + radius, -depth / 2);
  baseShape.lineTo(width / 2 - radius, -depth / 2);
  baseShape.quadraticCurveTo(width / 2, -depth / 2, width / 2, -depth / 2 + radius);
  baseShape.lineTo(width / 2, depth / 2 - radius);
  baseShape.quadraticCurveTo(width / 2, depth / 2, width / 2 - radius, depth / 2);
  baseShape.lineTo(-width / 2 + radius, depth / 2);
  baseShape.quadraticCurveTo(-width / 2, depth / 2, -width / 2, depth / 2 - radius);
  baseShape.lineTo(-width / 2, -depth / 2 + radius);
  baseShape.quadraticCurveTo(-width / 2, -depth / 2, -width / 2 + radius, -depth / 2);
  const baseGeometry = new THREE.ExtrudeGeometry(baseShape, {
    depth: 3, bevelEnabled: true, bevelThickness: 0.65, bevelSize: 0.65, bevelSegments: 4, steps: 1, curveSegments: 16,
  });
  baseGeometry.rotateX(-Math.PI / 2);
  baseGeometry.translate(0, -3.65, 0);
  const base = new THREE.Mesh(baseGeometry, [material('#87936b'), material('#687557')]);
  base.castShadow = true;
  base.receiveShadow = true;
  model.add(base);

  // A small checkered start line, aligned to the first geographic coordinate.
  const start = path.getPointAt(0);
  const direction = path.getTangentAt(0);
  for (let row = 0; row < 2; row++) {
    for (let column = 0; column < 8; column++) {
      const tile = new THREE.Mesh(new THREE.PlaneGeometry(0.19, 0.19), material((row + column) % 2 ? '#ecebdf' : '#292e2d'));
      tile.rotation.x = -Math.PI / 2;
      const across = (column - 3.5) * 0.19;
      const along = (row - 0.5) * 0.19;
      tile.position.set(start.x - direction.z * across + direction.x * along, 0.14, start.z + direction.x * across + direction.z * along);
      tile.rotation.z = -Math.atan2(direction.z, direction.x) + Math.PI / 2;
      model.add(tile);
    }
  }
}

function replaceTrack(circuit) {
  const geometries = new Set();
  const materials = new Set();
  model.traverse(node => {
    if (node.geometry) geometries.add(node.geometry);
    if (node.material) {
      for (const material of Array.isArray(node.material) ? node.material : [node.material]) materials.add(material);
    }
  });
  model.clear();
  geometries.forEach(geometry => geometry.dispose());
  materials.forEach(material => material.dispose());
  buildTrack(circuit);
}

buildTrack(circuit);
async function refreshTrack() {
  try {
    const data = await loadCurrentTrack();
    const feature = data.circuit.features[0];
    if (section.dataset.circuit !== feature.properties.id) replaceTrack(data.circuit);
    section.dataset.circuit = feature.properties.id;
    section.dataset.source = 'fastf1';
    section.setAttribute('aria-label', `Current track: ${feature.properties.Name}, ${data.event.location}`);
    canvas.setAttribute('aria-label', `Interactive 3D ${feature.properties.Name} circuit. Drag to rotate, scroll or pinch to zoom, use arrow keys to rotate, plus and minus to zoom, or Home to reset.`);
  } catch (error) {
    // Retain the last valid model, without claiming it is the current circuit.
    section.dataset.source = section.dataset.source || 'bundled-fallback';
    section.setAttribute('aria-label', 'Track preview (current schedule unavailable)');
    console.warn('Current track could not be refreshed; retaining the track preview.', error);
  }
}
void refreshTrack();
setInterval(() => { if (!document.hidden) void refreshTrack(); }, 300000);

const ground = new THREE.Mesh(new THREE.PlaneGeometry(1000, 1000), new THREE.ShadowMaterial({ opacity: 0.12 }));
ground.rotation.x = -Math.PI / 2;
ground.position.y = -4.35;
ground.receiveShadow = true;
scene.add(ground);

function resetView() {
  controls.target.set(0, 0, 0);
  const aspect = section.clientWidth / section.clientHeight;
  camera.position.set(100, 115, 115).multiplyScalar(Math.max(1, 0.95 / aspect));
  controls.update();
}
document.querySelector('.reset').addEventListener('click', resetView);
canvas.addEventListener('keydown', (event) => {
  const angle = { ArrowLeft: -0.08, ArrowRight: 0.08 }[event.key];
  if (angle) camera.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
  else if (event.key === '+' || event.key === '=') camera.position.multiplyScalar(0.92);
  else if (event.key === '-') camera.position.multiplyScalar(1.08);
  else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
    const spherical = new THREE.Spherical().setFromVector3(camera.position);
    spherical.phi += event.key === 'ArrowUp' ? -0.08 : 0.08;
    spherical.phi = THREE.MathUtils.clamp(spherical.phi, controls.minPolarAngle, controls.maxPolarAngle);
    camera.position.setFromSpherical(spherical);
  } else if (event.key === 'Home') resetView();
  else return;
  event.preventDefault();
  camera.position.clampLength(controls.minDistance, controls.maxDistance);
  controls.update();
});

// OrbitControls handles touch rotation; a two-finger pinch adjusts distance.
const touches = new Map();
let pinchDistance = 0;
canvas.addEventListener('pointerdown', (event) => { if (event.pointerType === 'touch') touches.set(event.pointerId, new THREE.Vector2(event.clientX, event.clientY)); });
canvas.addEventListener('pointermove', (event) => {
  if (!touches.has(event.pointerId)) return;
  touches.set(event.pointerId, new THREE.Vector2(event.clientX, event.clientY));
  if (touches.size !== 2) return;
  const [first, second] = [...touches.values()];
  const distance = first.distanceTo(second);
  if (pinchDistance) camera.position.multiplyScalar(pinchDistance / distance).clampLength(controls.minDistance, controls.maxDistance);
  pinchDistance = distance;
  controls.update();
});
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  canvas.addEventListener(type, (event) => { touches.delete(event.pointerId); pinchDistance = 0; });
}

new ResizeObserver(() => {
  camera.aspect = section.clientWidth / section.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(section.clientWidth, section.clientHeight, false);
}).observe(section);
resetView();
let visible = false;
new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }).observe(section);
renderer.setAnimationLoop(() => {
  if (!visible || document.hidden) return;
  controls.update();
  renderer.render(scene, camera);
});
