import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SITE, PROJECTS, ORDER } from './data.js';

const C = {
  stone: 0xF4F1EA, plaster: 0xE7E2D8, graphite: 0x1F2023, graphite2: 0x3A3B3F, concrete: 0x9C9A94,
  pink: 0xEE6FA8, cobalt: 0x3D63DD, lime: 0xB6D45C, violet: 0x7B66C8,
  sea: 0x00497C, gold: 0xCCA352, cherry: 0xE5243B, water: 0x7FB4C9,
};
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobile = innerWidth < 760;

document.getElementById('subtitle').textContent = SITE.subtitle;

/* ---------- Сцена ---------- */
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.1, 400);
const camHome = mobile ? new THREE.Vector3(30, 96, 76) : new THREE.Vector3(29, 29, 38);
camera.position.copy(camHome);

const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 0, mobile ? 3 : -1.5);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minPolarAngle = 0.55;
controls.maxPolarAngle = 1.12;
controls.minDistance = 22;
controls.maxDistance = mobile ? 150 : 82;
controls.enablePan = false;
controls.rotateSpeed = 0.55;
controls.enabled = false;

const hemi = new THREE.HemisphereLight(0xffffff, 0xd8cfc0, 1.4);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1e0, 2.2);
sun.position.set(-18, 30, 14);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 26, bottom: -26, near: 1, far: 90 });
sun.shadow.bias = -0.0006;
sun.shadow.radius = 4;
scene.add(sun);
const fill = new THREE.DirectionalLight(0xdce6ff, 0.5);
fill.position.set(20, 12, -10);
scene.add(fill);

/* ---------- Материали и блокчета ---------- */
const matCache = {};
function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!matCache[key]) matCache[key] = new THREE.MeshStandardMaterial({ color, roughness: 0.72, metalness: 0, ...opts });
  return matCache[key];
}
const geoCache = {};
function boxGeo(w, h, d) {
  const key = `${w}|${h}|${d}`;
  if (!geoCache[key]) geoCache[key] = new RoundedBoxGeometry(w, h, d, 3, Math.min(0.07, w / 6, h / 6, d / 6));
  return geoCache[key];
}
const studGeo = new RoundedBoxGeometry(0.42, 0.16, 0.42, 2, 0.06);

const allBlocks = [];   // за анимацията на сглобяване
const windows = [];     // светят нощем

function block(parent, x, y, z, w, h, d, color, { studs = false, delay = 0, emissive = null } = {}) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(boxGeo(w, h, d), mat(color));
  m.castShadow = true; m.receiveShadow = true;
  g.add(m);
  if (studs) {
    const nx = Math.max(1, Math.round(w)), nz = Math.max(1, Math.round(d));
    for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) {
      const s = new THREE.Mesh(studGeo, mat(color));
      s.position.set(-w / 2 + (i + 0.5) * (w / nx), h / 2 + 0.07, -d / 2 + (k + 0.5) * (d / nz));
      s.castShadow = true;
      g.add(s);
    }
  }
  g.position.set(x, y + h / 2, z);
  g.userData.finalY = g.position.y;
  g.userData.delay = delay;
  parent.add(g);
  allBlocks.push(g);
  if (emissive) windows.push(m);
  return g;
}

/* ---------- Детайли: малки части, слети в една геометрия на сграда ---------- */
const unitBox = new THREE.BoxGeometry(1, 1, 1);
const unitCyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 14);
const allDetails = [];
function details(g, delay) {
  const det = new THREE.Group();
  det.userData.finalY = 0; det.userData.delay = delay; det.userData.parts = [];
  g.add(det); allBlocks.push(det); allDetails.push(det);
  return det;
}
// y е долният ръб на частта
function part(det, x, y, z, w, h, dd, color, win = false, geo = unitBox, rz = 0) {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y + h / 2, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, rz)), new THREE.Vector3(w, h, dd));
  det.userData.parts.push({ m, color, win, geo });
}
const col = (det, x, y, z, r, h, color, win = false) => part(det, x, y, z, r * 2, h, r * 2, color, win, unitCyl);
function bakeAll() {
  for (const det of allDetails) {
    const by = {};
    for (const p of det.userData.parts) (by[p.color + (p.win ? 'w' : '')] ||= []).push(p);
    for (const list of Object.values(by)) {
      const merged = mergeGeometries(list.map(p => p.geo.clone().applyMatrix4(p.m)));
      const mesh = new THREE.Mesh(merged, list[0].win ? mat(list[0].color).clone() : mat(list[0].color));
      mesh.castShadow = true; mesh.receiveShadow = true;
      det.add(mesh);
      if (list[0].win) windows.push(mesh);
    }
    det.userData.parts = null;
  }
}
const GLASS = 0x9DBBCC, GLASS_D = 0x5F7F95, WHITE = 0xFBFAF6, ASPH = 0x6E7176, WALK = 0xD3CFC6, LAWN = 0xB5CC8A, HEDGE = 0x7FA65E, SAND = 0xE9DCC2, YEL = 0xF2C230, ROOF = 0x7D828A;

/* ---------- Земя: два бряга, река в средата, море отпред ---------- */
const world = new THREE.Group();
scene.add(world);
function slab(x, z, w, dd, color, h = 0.6, y = -0.6) {
  const m = new THREE.Mesh(boxGeo(w, h, dd), mat(color));
  m.position.set(x, y + h / 2, z); m.receiveShadow = true; world.add(m); return m;
}
const Z0 = -13, Z1 = 8, LEN = Z1 - Z0, ZC = (Z0 + Z1) / 2;
slab(-10.15, ZC, 15.7, LEN, C.plaster);              // ляв бряг
slab(10.15, ZC, 15.7, LEN, C.plaster);               // десен бряг
slab(0, ZC, 4.6, LEN, 0x8C99A0, 0.3, -0.75);         // дъно на реката
slab(0, 10.5, 36, 5, 0x8C99A0, 0.3, -0.75);          // дъно на морето
const waterMat = new THREE.MeshStandardMaterial({ color: C.water, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.88 });
for (const [x, z, w, dd] of [[0, ZC, 4.6, LEN + 0.2], [0, 10.5, 36, 5]]) {
  const wm = new THREE.Mesh(new RoundedBoxGeometry(w, 0.32, dd, 2, 0.06), waterMat);
  wm.position.set(x, -0.42, z); wm.receiveShadow = true; world.add(wm);
}

// улици, крайбрежни алеи, плаж, морава (статични, без анимация)
const ground = details(world, 0); ground.userData.finalY = 0; allBlocks.pop();
for (const s of [-1, 1]) {
  part(ground, s * 10.3, 0, -2.6, 15.4, 0.05, 1.5, ASPH);                              // улица към моста
  for (let i = 0; i < 7; i++) part(ground, s * (4.6 + i * 2), 0.05, -2.6, 0.9, 0.01, 0.1, WHITE); // маркировка
  part(ground, s * 3.05, 0, ZC - 0.5, 1.3, 0.06, LEN - 1, WALK);                        // алея
  part(ground, s * 2.38, 0, ZC, 0.16, 0.2, LEN, 0xD9D2C4);                              // кей
  part(ground, s * 10.15, 0, 7.45, 15.7, 0.04, 1.1, SAND);                              // плаж
}
// морави
for (const [x, z, w, dd] of [[-9.6, -12.2, 9.5, 1.4], [-15.6, -6.5, 3.4, 6], [16, -6.3, 3, 5.6], [-10.5, 0.2, 11, 0.6], [6.2, -12.4, 7, 1], [11.5, -0.3, 10, 0.7], [-4.4, 4.6, 2.2, 3.6]]) part(ground, x, 0, z, w, 0.05, dd, LAWN);
// площадче пред последното блокче
part(ground, 4.8, 0, 0.9, 2.8, 0.06, 2.8, WALK);
for (let i = 0; i < 4; i++) part(ground, 3.7 + i * 0.73, 0.06, 0.9, 0.06, 0.005, 2.6, 0xC2BDB2);

/* ---------- Сгради ---------- */
const buildings = {};
function building(id, x, z, labelText) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.userData.id = id; g.userData.label = labelText;
  world.add(g); buildings[id] = g;
  return g;
}
let d = 0; const nd = (step = 0.025) => (d += step);

// ДКС: Дворецът (модернистична зала с вертикални ребра)
{
  const g = building('dvorec', -9.5, -7.4, 'Брандбук на Двореца');
  block(g, 0, 0, 0, 9.4, 0.4, 6.6, 0xE2DCD0, { delay: nd() });
  block(g, 0, 0.4, -0.2, 8, 2.5, 5, C.stone, { delay: nd() });
  block(g, 0, 2.9, -0.2, 8.6, 0.3, 5.6, C.sea, { delay: nd() });
  block(g, 0, 3.2, -0.9, 3.4, 1.4, 2.8, C.stone, { delay: nd() });
  block(g, 0, 4.6, -0.9, 3.4, 0.25, 2.8, C.sea, { studs: true, delay: nd() });
  const t = details(g, nd());
  for (let i = 0; i < 3; i++) part(t, 0, 0.4 - (i + 1) * 0.13, 3.3 + i * 0.28, 5 + i * 0.4, 0.13, 0.3, 0xE2DCD0); // стълби
  part(t, 0, 0.5, 2.36, 7.6, 0.85, 0.06, GLASS, true);          // стъклен партер
  for (let i = 0; i < 9; i++) col(t, -3.6 + i * 0.9, 0.4, 2.55, 0.07, 1.0, WHITE); // тънки колони
  part(t, 0, 1.38, 2.42, 8.1, 0.14, 0.22, C.gold);               // златна лента
  part(t, 0, 1.52, 2.33, 7.7, 1.33, 0.05, GLASS_D, true);        // горно стъкло
  for (let i = 0; i < 17; i++) part(t, -3.8 + i * 0.475, 1.52, 2.45, 0.12, 1.33, 0.22, WHITE); // ребра отпред
  for (const s of [-1, 1]) {
    part(t, s * 4.02, 1.52, -0.2, 0.05, 1.33, 4.6, GLASS_D, true);
    for (let i = 0; i < 10; i++) part(t, s * 4.08, 1.52, -2.4 + i * 0.49, 0.18, 1.33, 0.12, WHITE);
  }
  for (const [vx, vz] of [[2.8, -1.6], [3.3, 1], [-3, 1.2]]) part(t, vx, 3.2, vz, 0.6, 0.3, 0.5, 0xC9C5BC); // покривни агрегати
  for (let i = 0; i < 3; i++) { col(t, -1.2 + i * 1.2, 0, 4.2, 0.04, 2.4, ROOF); part(t, -1.2 + i * 1.2 + 0.25, 1.95, 4.2, 0.5, 0.32, 0.03, [C.sea, C.gold, C.cherry][i]); }
}

// NEXT MOVE: арковиден мост; платното е високо, за да минава каякът отдолу
{
  const g = building('nextmove', 0, -2.6, 'NEXT MOVE · Еразъм+');
  const DT = 1.3; // горен ръб на платното
  for (const s of [-1, 1]) block(g, s * 2.55, -0.6, 0, 0.8, DT + 0.6 - 0.3, 2.1, 0xD9D2C4, { delay: nd() }); // устои на кея
  block(g, 0, DT - 0.3, 0, 5.9, 0.3, 1.8, C.graphite2, { delay: nd() });                                  // платно
  block(g, 0, 3.55, 0, 0.9, 0.22, 1.9, C.sea, { studs: true, delay: nd() });                               // ключ на арката
  const t = details(g, nd());
  for (const s of [-1, 1]) { // плавни рампи към улиците
    for (let k = 0; k < 12; k++) part(t, s * (3.03 + k * 0.15), 0, 0, 0.16, DT * (1 - (k + 0.5) / 12.5), 1.5, ASPH);
    part(t, s * 2.55, DT, 0, 0.8, 0.04, 1.5, ASPH);
    for (const z of [-0.9, 0.9]) part(t, s * 2.55, -0.6, z * 1.1, 0.95, DT + 0.75, 0.12, 0xC9C1B2); // каменни кейови стени
  }
  part(t, 0, DT, 0, 5.9, 0.012, 0.08, 0xffffff);
  for (const z of [-0.82, 0.82]) {
    // арка над платното
    const A = x => DT + 2.15 * (1 - (x / 2.95) ** 2);
    for (let i = -28; i <= 28; i++) { // плътна извита арка
      const x = i * 0.1, slope = -2 * 2.15 * x / 2.95 ** 2;
      part(t, x, A(x) - 0.11, z, 0.11 * Math.hypot(1, slope) + 0.02, 0.22, 0.2, WHITE, false, unitBox, Math.atan(slope));
    }
    for (let i = -8; i <= 8; i += 2) if (i) part(t, i * 0.31, DT, z, 0.045, A(i * 0.31) - DT - 0.1, 0.045, 0xB8BCC2); // въжета
    for (const s of [-1, 1]) part(t, s * 2.85, DT - 0.1, z, 0.36, 0.3, 0.3, WHITE);            // пети на арката
    for (let i = 0; i < 15; i++) part(t, -2.8 + i * 0.4, DT, z * 0.86, 0.05, 0.32, 0.05, WHITE); // парапет
    part(t, 0, DT + 0.32, z * 0.86, 5.7, 0.05, 0.07, WHITE);
    part(t, 0, DT - 0.3, z * 1.1, 5.9, 0.1, 0.06, C.sea);                                       // синя лента отстрани
  }
  for (const x of [-1.24, 0, 1.24]) part(t, x, DT + 2.15 * (1 - (x / 2.95) ** 2) + 0.05, 0, 0.12, 0.12, 1.64, WHITE); // връзки между арките
  // осем знамена по върха на арката
  [C.cobalt, C.cherry, C.lime, C.gold, C.violet, C.sea, C.pink, 0xffffff].forEach((c, i) => {
    const x = -2.17 + i * 0.62, top = DT + 2.15 * (1 - (x / 2.95) ** 2) + 0.18;
    if (Math.abs(x) < 0.5) return;
    part(t, x, top, -0.82, 0.035, 0.55, 0.035, C.graphite);
    part(t, x + 0.16, top + 0.32, -0.82, 0.3, 0.2, 0.025, c);
  });
  for (const s of [-1, 1]) { part(t, s * 2.6, DT, 0.72, 0.06, 1.1, 0.06, C.graphite); part(t, s * 2.6, DT + 1.1, 0.72, 0.2, 0.12, 0.2, 0xFFF4D6, true); }
}

// За мен: спортната зала (полукръгъл покрив)
{
  const g = building('zamen', -6.2, 1.7, 'За мен · спортната зала');
  block(g, 0, 0, 0, 5, 1.6, 3.4, C.stone, { delay: nd() });
  block(g, 0, 1.6, 0, 5.2, 0.3, 3.6, C.graphite, { delay: nd() });
  block(g, 0, 1.9, 0, 5.2, 0.3, 2.9, C.graphite, { delay: nd() });
  block(g, 0, 2.2, 0, 5.2, 0.28, 2.0, C.graphite, { delay: nd() });
  block(g, 0, 2.48, 0, 5.2, 0.26, 1.0, C.pink, { studs: true, delay: nd() });
  const t = details(g, nd());
  part(t, 0, 0.75, 1.72, 4.6, 0.55, 0.05, GLASS, true);
  for (let i = 0; i < 9; i++) part(t, -2.2 + i * 0.55, 0.75, 1.75, 0.06, 0.55, 0.06, WHITE);
  part(t, 0, 0, 1.72, 1.1, 0.7, 0.05, C.graphite);
  part(t, 0, 0.7, 2.1, 1.6, 0.08, 0.8, C.pink);
  for (const s of [-1, 1]) part(t, s * 0.7, 0, 2.4, 0.06, 0.7, 0.06, C.graphite);
  for (const s of [-1, 1]) part(t, s * 2.52, 0.75, 0, 0.05, 0.55, 2.8, GLASS, true);
  // кош до залата
  part(t, 3.15, 0, 1.2, 0.1, 1.9, 0.1, C.graphite); part(t, 3.15, 1.75, 1.0, 0.06, 0.45, 0.65, 0xffffff); part(t, 3.0, 1.75, 1.0, 0.2, 0.03, 0.2, 0xE8743B);
}

// Лаборатория: Markstrat (модерен стъклен офис)
{
  const g = building('markstrat', -13.2, 1.5, 'Markstrat · Лаборатория');
  block(g, 0, 0, 0, 4.4, 0.3, 2.8, 0xE2DCD0, { delay: nd() });
  block(g, 0, 0.3, 0, 4.2, 2.2, 2.6, GLASS_D, { delay: nd() });
  block(g, 0.9, 2.5, 0, 2.2, 0.35, 2.6, C.cobalt, { studs: true, delay: nd() });
  const t = details(g, nd());
  for (let i = 0; i < 9; i++) part(t, -2.05 + i * 0.51, 0.3, 1.33, 0.07, 2.2, 0.06, WHITE);
  for (const y of [1.0, 1.75, 2.45]) part(t, 0, y, 1.33, 4.25, 0.08, 0.08, WHITE);
  part(t, 0, 0.32, 1.3, 4.1, 0.65, 0.03, GLASS, true);
  part(t, -1.2, 2.5, 0, 1.6, 0.08, 2.6, WHITE);
  for (const x of [-1.6, -0.8]) part(t, x, 2.58, 0.2, 0.55, 0.32, 0.6, 0xC9C5BC);
}

// Работилница: строеж с кран
{
  const g = building('rabotilnica', -13.2, 5.4, 'Работилница · в строеж');
  block(g, 0, 0, 0, 2.6, 0.9, 2, C.violet, { delay: nd() });
  block(g, -0.5, 0.9, 0, 1.4, 0.5, 2, C.violet, { studs: true, delay: nd() });
  const t = details(g, nd());
  for (const [sx, sz] of [[-1.4, -1.1], [1.4, -1.1], [-1.4, 1.1], [1.4, 1.1]]) part(t, sx, 0, sz, 0.07, 1.9, 0.07, YEL);
  for (const y of [0.9, 1.8]) for (const z of [-1.1, 1.1]) part(t, 0, y, z, 2.9, 0.06, 0.06, YEL);
  // кулокран
  part(t, 1.9, 0, -0.6, 0.6, 0.15, 0.6, C.graphite2);
  for (let i = 0; i < 9; i++) part(t, 1.9, 0.15 + i * 0.45, -0.6, 0.28, 0.42, 0.28, YEL);
  part(t, 1.9, 4.2, -0.6, 0.36, 0.3, 0.36, 0xFFFFFF);
  part(t, 0.2, 4.5, -0.6, 4.4, 0.16, 0.22, YEL);
  part(t, 2.9, 4.4, -0.6, 0.6, 0.3, 0.5, C.graphite2);
  part(t, -0.8, 2.6, -0.6, 0.02, 1.9, 0.02, C.graphite);
  part(t, -0.8, 2.45, -0.6, 0.25, 0.15, 0.25, C.pink);
}

// Услуги: пазарът със сергии
{
  const g = building('uslugi', -8.4, 5.5, 'Услуги · пазарът');
  const cs = [C.pink, C.lime, C.cobalt];
  for (let i = 0; i < 3; i++) block(g, -1.9 + i * 1.9, 0, 0, 1.5, 0.75, 1.1, 0xC8A27A, { delay: nd() });
  block(g, 0, 0, -0.9, 0.9, 0.35, 0.6, cs[0], { studs: true, delay: nd() });
  const t = details(g, nd());
  for (let i = 0; i < 3; i++) {
    const x = -1.9 + i * 1.9;
    for (const s of [-1, 1]) part(t, x + s * 0.72, 0.75, 0.5, 0.06, 0.7, 0.06, C.graphite);
    for (let k = 0; k < 5; k++) part(t, x - 0.68 + k * 0.34, 1.42, 0.15, 0.34, 0.08, 1.4, k % 2 ? 0xffffff : cs[i]);
    for (let k = 0; k < 3; k++) part(t, x - 0.45 + k * 0.45, 0.75, -0.1, 0.32, 0.18, 0.32, [0xE8743B, 0x8DB36A, 0xD9C27A][k]);
  }
}

// Кампус: Студентският съвет (неокласическа сграда с портик)
{
  const g = building('suvet', 9.6, -7.6, 'Студентският съвет');
  block(g, 0, 0, 0, 9.2, 0.5, 5.6, 0xE2DCD0, { delay: nd() });
  block(g, 0, 0.5, -0.4, 8.4, 2.6, 4, C.stone, { delay: nd() });
  block(g, 0, 3.1, -0.4, 8.8, 0.2, 4.4, 0xE2DCD0, { delay: nd() });
  block(g, 0, 3.3, -0.4, 8.2, 0.45, 3.8, ROOF, { delay: nd() });
  block(g, 0, 3.75, -0.4, 3.2, 0.35, 1.8, C.lime, { studs: true, delay: nd() });
  const t = details(g, nd());
  for (let i = 0; i < 3; i++) part(t, 0, 0.5 - (i + 1) * 0.16, 2.95 + i * 0.25, 4.6 + i * 0.5, 0.16, 0.3, 0xE2DCD0);
  for (let i = 0; i < 6; i++) { // колони с основа и капител
    const x = -1.75 + i * 0.7;
    part(t, x, 0.5, 2.15, 0.36, 0.12, 0.36, WHITE);
    col(t, x, 0.62, 2.15, 0.14, 1.96, WHITE);
    part(t, x, 2.58, 2.15, 0.38, 0.12, 0.38, WHITE);
  }
  part(t, 0, 2.7, 1.95, 4.6, 0.35, 0.8, WHITE);
  [4.6, 3.5, 2.4, 1.3].forEach((w, i) => part(t, 0, 3.05 + i * 0.2, 1.95, w, 0.2, 0.7, i === 3 ? C.lime : WHITE));
  part(t, 0, 0.5, 1.62, 1, 1.4, 0.04, C.graphite);
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) for (const y of [0.95, 2.0]) {
    const x = s * (2.65 + k * 0.62);
    part(t, x, y, 1.61, 0.36, 0.62, 0.04, GLASS, true);
    part(t, x, y - 0.06, 1.66, 0.46, 0.06, 0.1, WHITE);
    part(t, x, y + 0.66, 1.64, 0.44, 0.08, 0.06, 0xE2DCD0);
  }
  for (const s of [-1, 1]) for (let k = 0; k < 4; k++) part(t, s * 4.21, 1.0, -1.8 + k * 0.95, 0.04, 1.6, 0.36, GLASS, true);
  [C.cherry, C.lime, C.violet, 0xF2A33C].forEach((c, i) => { // четирите отдела
    const x = -3.9 + i * 0.55;
    part(t, x, 0.5, 2.6, 0.04, 2.0, 0.04, ROOF);
    part(t, x + 0.18, 2.1, 2.6, 0.34, 0.24, 0.03, c);
  });
}

// Последното блокче (контакт): на площадчето до моста
const keystone = new THREE.Group();
{
  const m = new THREE.Mesh(boxGeo(1.4, 0.9, 1.4), mat(C.pink));
  m.castShadow = true; keystone.add(m);
  for (const [sx, sz] of [[-0.35, -0.35], [0.35, -0.35], [-0.35, 0.35], [0.35, 0.35]]) {
    const s = new THREE.Mesh(studGeo, mat(C.pink)); s.position.set(sx, 0.52, sz); s.castShadow = true; keystone.add(s);
  }
  block(world, 4.8, 0, 0.9, 1.9, 0.5, 1.9, C.graphite, { delay: nd() });
  keystone.position.set(4.8, 9, 0.9);
  keystone.userData.finalY = 0.5 + 0.45;
  keystone.userData.id = 'kontakt';
  keystone.userData.label = 'Контакт · последното блокче';
  world.add(keystone);
  buildings.kontakt = keystone;
}

// MEN'S LEGO NIGHT: павилион с гигантско блокче на покрива
{
  const g = building('legonight', 9, 1.9, 'LEGO Night · предстои');
  block(g, 0, 0, 0, 3, 1.5, 2.3, C.stone, { delay: nd() });
  block(g, 0, 1.5, 0, 3.2, 0.15, 2.5, C.graphite, { delay: nd() });
  block(g, 0, 1.65, 0, 2, 0.6, 1, C.pink, { studs: true, delay: nd() });
  const t = details(g, nd());
  part(t, 0, 0.2, 1.17, 2.6, 1.1, 0.04, C.pink);                // банер
  for (let k = 0; k < 4; k++) col(t, -0.6 + k * 0.4, 0.75, 1.21, 0.1, 0.05, 0xffffff);
  part(t, -0.6, 0.5, 1.2, 1.4, 0.18, 0.02, 0xffffff);
  part(t, 0.9, 0, 1.17, 0.6, 0.9, 0.04, C.graphite);
  for (const [sx, sz] of [[-1.65, -1.3], [1.65, -1.3], [-1.65, 1.3], [1.65, 1.3]]) part(t, sx, 0, sz, 0.07, 2.5, 0.07, YEL);
  for (const z of [-1.3, 1.3]) part(t, 0, 2.3, z, 3.4, 0.07, 0.07, YEL);
}

// WTF: сцена с ферми, екран и тонколони
{
  const g = building('wtf', 13.6, 1.9, 'WTF · Welcome the Freshers');
  block(g, 0, 0, 0, 3.8, 0.55, 2.4, C.graphite, { delay: nd() });
  block(g, 0, 3.1, -0.9, 4, 0.3, 0.4, C.lime, { studs: true, delay: nd() });
  const t = details(g, nd());
  for (const s of [-1, 1]) for (const z of [-1.1, 0.9]) {
    part(t, s * 1.85, 0.55, z, 0.18, 2.55, 0.18, C.graphite2);
    for (let k = 0; k < 5; k++) part(t, s * 1.85, 0.8 + k * 0.5, z, 0.22, 0.04, 0.22, 0xA9ABB0);
  }
  for (const z of [-1.1, 0.9]) part(t, 0, 3.0, z, 3.9, 0.16, 0.18, C.graphite2);
  for (const s of [-1, 1]) part(t, s * 1.85, 3.0, -0.1, 0.18, 0.16, 2.0, C.graphite2);
  part(t, 0, 1.0, -1.0, 2.8, 1.6, 0.08, C.cobalt, true);
  part(t, 0, 1.0, -0.95, 2.6, 1.4, 0.02, 0x5C82F0, true);
  for (let k = 0; k < 5; k++) part(t, -1.4 + k * 0.7, 2.75, 0.9, 0.16, 0.22, 0.16, 0xFFF4D6, true);
  for (const s of [-1, 1]) { part(t, s * 2.35, 0, 0.6, 0.6, 1.4, 0.6, C.graphite); col(t, s * 2.35, 0.9, 0.91, 0.18, 0.02, 0x55575C); }
  part(t, 0, 0.55, 0.5, 0.05, 0.9, 0.05, C.graphite);
}

// Treasure Hunt: лабиринт от жив плет и сандък
{
  const g = building('treasure', 13.6, 5.7, 'Treasure Hunt');
  block(g, 0, 0, 0, 3.8, 0.15, 2.6, LAWN, { delay: nd() });
  block(g, 0.7, 0.15, 0.35, 0.8, 0.4, 0.5, 0x8A5A2B, { delay: nd() });
  block(g, 0.7, 0.55, 0.35, 0.84, 0.2, 0.54, C.gold, { studs: true, delay: nd() });
  const t = details(g, nd());
  for (const [hx, hz, hw, hd] of [[-1.75, 0, 0.3, 2.4], [1.75, 0.2, 0.3, 2.0], [0, -1.15, 3.8, 0.3], [-0.6, 0.55, 2.0, 0.3], [0.4, -0.45, 2.4, 0.3], [-0.9, -0.1, 0.3, 0.9]]) part(t, hx, 0.15, hz, hw, 0.55, hd, HEDGE);
  part(t, 0.7, 0.38, 0.62, 0.86, 0.08, 0.04, 0x5A3A1A);
  part(t, -1.1, 0.16, 1.05, 0.5, 0.02, 0.08, C.cherry); part(t, -1.1, 0.16, 1.05, 0.08, 0.02, 0.5, C.cherry);
}

// Резервиран парцел за УЕВА (бъдеща сграда): ограда и табела
{
  const t = details(world, nd());
  part(t, 8.6, 0, 5.7, 3.6, 0.04, 2.5, SAND);
  for (let i = 0; i <= 6; i++) for (const z of [4.45, 6.95]) part(t, 6.8 + i * 0.6, 0, z, 0.05, 0.45, 0.05, 0xE8743B);
  for (let i = 0; i <= 4; i++) for (const x of [6.8, 10.4]) part(t, x, 0, 4.45 + i * 0.625, 0.05, 0.45, 0.05, 0xE8743B);
  for (const z of [4.45, 6.95]) part(t, 8.6, 0.38, z, 3.6, 0.04, 0.03, 0xffffff);
  part(t, 7.3, 0, 4.4, 0.05, 0.7, 0.05, C.graphite); part(t, 7.3, 0.6, 4.42, 0.9, 0.45, 0.04, 0xffffff);
}

/* ---------- Декор ---------- */
function tree(x, z, kind = 0) {
  const t = details(world, nd(0.006));
  if (kind === 0) {
    part(t, x, 0, z, 0.18, 0.6, 0.18, 0x8A6A4A);
    part(t, x, 0.6, z, 1.0, 0.6, 1.0, 0x8DB36A); part(t, x, 1.2, z, 0.75, 0.4, 0.75, 0x9CC174); part(t, x, 1.6, z, 0.4, 0.25, 0.4, 0x9CC174);
  } else {
    part(t, x, 0, z, 0.16, 0.4, 0.16, 0x8A6A4A);
    [0.9, 0.7, 0.5, 0.3].forEach((w, i) => part(t, x, 0.4 + i * 0.4, z, w, 0.4, w, 0x5F8F55));
  }
}
const treeSpots = [[-15.5, -11.5, 1], [-14.2, -4.2, 0], [-16.2, -1, 1], [-4.2, -11.8, 0], [-4, -4.6, 1], [-16.3, 3.6, 0], [-11, 3.9, 0],
  [3.9, -11.8, 1], [15.8, -11.6, 0], [16, -4, 1], [4.2, -4.4, 0], [16.3, 4.6, 1], [11.2, 4.7, 0], [6, 3.6, 1], [16.4, -0.4, 0]];
treeSpots.forEach(([x, z, k], i) => (!mobile || i % 3) && tree(x, z, k));
for (const s of [-1, 1]) { // фенери и пейки по алеите
  const t = details(world, nd(0.006));
  for (let i = 0; i < 6; i++) {
    const z = -11.5 + i * 3.4;
    if (Math.abs(z + 2.6) < 1.2) continue;
    part(t, s * 3.6, 0, z, 0.06, 1.1, 0.06, C.graphite); part(t, s * 3.5, 1.1, z, 0.28, 0.06, 0.14, C.graphite); part(t, s * 3.42, 0.98, z, 0.14, 0.1, 0.12, 0xFFF4D6, true);
    part(t, s * 3.55, 0.18, z + 1.4, 0.3, 0.06, 0.9, 0xA8784E); part(t, s * 3.7, 0.24, z + 1.4, 0.06, 0.3, 0.9, 0xA8784E);
  }
}
// коли
function car(x, z, color, rot = 0) {
  const t = details(world, nd(0.006));
  const c = Math.cos(rot) > 0.5;
  const W = c ? 0.95 : 0.48, D = c ? 0.48 : 0.95;
  part(t, x, 0.08, z, W, 0.26, D, color);
  part(t, x, 0.34, z, W * (c ? 0.55 : 0.9), 0.2, D * (c ? 0.9 : 0.55), 0x3A4652);
  for (const a of [-1, 1]) for (const b of [-1, 1]) part(t, x + a * W * 0.32, 0, z + b * D * 0.42, c ? 0.18 : 0.08, 0.16, c ? 0.08 : 0.18, 0x222326);
}
car(-12, -2.95, C.cherry, 0); car(-7.4, -2.25, 0xffffff, 0); car(7.2, -2.95, C.cobalt, 0); car(15.5, -2.25, 0xF2A33C, 0);
// фигурки (собствен стил: блокче-тяло и кръгла глава)
const headGeo = new THREE.SphereGeometry(0.17, 16, 12);
function figure(x, z, color) {
  const b = block(world, x, 0, z, 0.34, 0.5, 0.24, color, { delay: nd(0.01) });
  const h = new THREE.Mesh(headGeo, mat(0xF0D2B6));
  h.position.y = 0.42; h.castShadow = true; b.add(h);
}
[[12.6, 3.9, C.cobalt], [13.3, 4.0, C.pink], [14.4, 3.8, C.lime], [3.1, -6, C.graphite], [-3.1, 0.6, C.violet], [6.4, -1.6, 0xF2A33C]].forEach(([x, z, c]) => figure(x, z, c));
// каяк по реката
const kayak = new THREE.Group();
kayak.add(new THREE.Mesh(new RoundedBoxGeometry(0.6, 0.3, 2.2, 3, 0.14), mat(0xF2A33C)));
const rower = new THREE.Mesh(new RoundedBoxGeometry(0.3, 0.45, 0.3, 2, 0.06), mat(C.graphite));
rower.position.y = 0.35; kayak.add(rower);
const rh = new THREE.Mesh(headGeo, mat(0xF0D2B6)); rh.position.y = 0.72; kayak.add(rh);
const paddle = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.05, 0.12), mat(C.graphite)); paddle.position.y = 0.45; kayak.add(paddle);
kayak.children.forEach(m => (m.castShadow = true));
kayak.position.set(0.8, -0.18, 4);
kayak.userData.id = 'kayak';
world.add(kayak);

// Кей и кану-каяк клуб: оттук тръгва каякът
{
  const t = details(world, nd());
  // дървен кей във водата
  for (let i = 0; i < 6; i++) part(t, -2.1 + i * 0.26, -0.02, 5.4, 0.24, 0.1, 1.1, i % 2 ? 0xB98A5C : 0xA8784E);
  part(t, -0.85, -0.02, 5.4, 0.9, 0.1, 0.24, 0xA8784E);
  for (const x of [-1.9, -1.2, -0.5]) for (const z of [4.9, 5.9]) part(t, x, -0.6, z, 0.1, 0.72, 0.1, 0x7A5634);
  for (const x of [-0.4]) part(t, x, -0.6, 5.4, 0.12, 0.8, 0.12, 0x7A5634);
  // вързан червен каяк
  part(t, -1.2, -0.27, 6.35, 1.6, 0.18, 0.4, C.cherry); part(t, -1.2, -0.1, 6.35, 0.3, 0.05, 0.25, C.graphite);
  // стълба към водата
  for (let k = 0; k < 3; k++) part(t, -2.25, -0.5 + k * 0.17, 4.6, 0.04, 0.03, 0.35, 0xB8BCC2);
  // лодкарница
  part(t, -4.6, 0, 5.6, 2.2, 1.0, 1.6, 0xF1E6D2);
  for (let k = 0; k < 8; k++) part(t, -5.65 + k * 0.3, 0, 6.42, 0.04, 1.0, 0.04, 0xD9C7A8);
  part(t, -4.6, 1.0, 5.6, 2.5, 0.12, 1.9, C.sea); part(t, -4.6, 1.12, 5.6, 1.8, 0.12, 1.3, C.sea);
  part(t, -4.0, 0, 6.42, 0.6, 0.75, 0.03, C.graphite);
  part(t, -5.1, 0.55, 6.42, 0.5, 0.3, 0.03, GLASS, true);
  part(t, -4.6, 0.8, 6.46, 1.0, 0.16, 0.02, 0xffffff);
  // стойка с каяци
  for (const x of [-6.1, -5.95]) part(t, x, 0, 4.9, 0.05, 0.75, 0.05, C.graphite);
  [0xF2A33C, C.lime, C.pink].forEach((c, k) => part(t, -6.03, 0.18 + k * 0.2, 5.55, 0.16, 0.12, 1.5, c));
  for (const x of [-6.1, -5.95]) part(t, x, 0, 6.2, 0.05, 0.75, 0.05, C.graphite);
}

// Плаж: чадъри и шезлонги; море: лодка и шамандури
{
  const t = details(world, nd());
  [[-15, C.pink], [-12.4, 0xffffff], [-9.8, C.cobalt], [5.2, C.lime], [11.8, C.pink], [15.6, 0xffffff]].forEach(([x, c], i) => {
    part(t, x, 0, 7.4, 0.05, 1.0, 0.05, 0xEDEDED);
    part(t, x, 0.95, 7.4, 0.9, 0.08, 0.9, c); part(t, x, 1.03, 7.4, 0.5, 0.08, 0.5, c);
    part(t, x + 0.6, 0.03, 7.35, 0.35, 0.1, 0.8, i % 2 ? 0xffffff : 0x9DBBCC);
  });
  for (const [x, z] of [[-10, 10.6], [-4, 11.2], [4, 11.2], [10, 10.6], [15, 10.3]]) { part(t, x, -0.4, z, 0.28, 0.4, 0.28, 0xF2A33C); part(t, x, 0, z, 0.18, 0.08, 0.18, 0xffffff); }
}
const sail = new THREE.Group();
{
  const add = (w, h, dd, c, x, y, z) => { const m = new THREE.Mesh(boxGeo(w, h, dd), mat(c)); m.position.set(x, y, z); m.castShadow = true; sail.add(m); };
  add(2.0, 0.3, 0.7, 0xffffff, 0, 0, 0); add(1.6, 0.06, 0.55, 0xA8784E, 0, 0.17, 0);
  add(0.06, 2.2, 0.06, C.graphite, 0.2, 1.2, 0);
  const tri = new THREE.Shape(); tri.moveTo(0, 0); tri.lineTo(1.1, 0); tri.lineTo(0, 1.8); tri.closePath();
  const sg = new THREE.Mesh(new THREE.ShapeGeometry(tri), new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide, roughness: 0.6 }));
  sg.position.set(0.25, 0.35, 0); sg.castShadow = true; sail.add(sg);
  const sg2 = sg.clone(); sg2.scale.set(-0.6, 0.85, 1); sg2.position.x = 0.15; sail.add(sg2);
  sail.position.set(7.5, -0.15, 10.8); world.add(sail);
}

// Повече живот: зебри, улично осветление, цветни лехи, жив плет, велостойка
{
  const t = details(world, nd());
  for (const s of [-1, 1]) for (let k = 0; k < 5; k++) part(t, s * 5.3, 0.05, -3.2 + k * 0.3, 0.7, 0.01, 0.15, 0xffffff); // зебри
  for (const s of [-1, 1]) for (const x of [6.8, 11, 15.2]) { // улични лампи
    part(t, s * x, 0, -1.6, 0.06, 1.3, 0.06, C.graphite); part(t, s * x, 1.3, -1.75, 0.08, 0.06, 0.4, C.graphite); part(t, s * x, 1.2, -1.95, 0.16, 0.1, 0.16, 0xFFF4D6, true);
  }
  const flowers = [C.pink, 0xF2C230, 0xffffff, C.cherry, C.violet];
  const bed = (x, z, w, dd) => { part(t, x, 0, z, w, 0.14, dd, 0x8A6A4A); let n = 0; for (let i = 0; i < Math.floor(w / 0.3); i++) for (let k = 0; k < Math.floor(dd / 0.3); k++) part(t, x - w / 2 + 0.15 + i * 0.3, 0.14, z - dd / 2 + 0.15 + k * 0.3, 0.14, 0.1, 0.14, (i + k) % 3 ? 0x6E9F55 : flowers[n++ % 5]); };
  bed(-12.8, -3.5, 2.4, 0.6); bed(-6.2, -3.5, 2.4, 0.6);   // пред Двореца
  bed(6.2, -3.6, 1.8, 0.6); bed(13, -3.6, 1.8, 0.6);       // пред университета
  bed(-6.2, 3.95, 3, 0.45);                                 // пред залата
  for (const [x, z, w, dd] of [[-14.3, -3.9, 0.3, 0.3], [4.95, -6.5, 0.4, 4.5], [14.4, -6.5, 0.4, 4.5], [-15.6, 1.4, 0.3, 2.8], [4.3, 2.2, 0.3, 1.3]]) part(t, x, 0, z, w, 0.4, dd, HEDGE);
  for (let k = 0; k < 4; k++) { const x = 3.7 + k * 0.22; part(t, x, 0.12, -5.0, 0.03, 0.3, 0.42, [C.cobalt, C.cherry, C.lime, 0x222326][k]); part(t, x, 0, -4.85, 0.04, 0.3, 0.04, 0x222326); part(t, x, 0, -5.15, 0.04, 0.3, 0.04, 0x222326); }
}

bakeAll();

/* ---------- Етикети ---------- */
const labels = {};
for (const [id, g] of Object.entries(buildings)) {
  const el = document.createElement('div');
  el.className = 'label';
  el.textContent = g.userData.label;
  document.body.appendChild(el);
  labels[id] = el;
  const box = new THREE.Box3().setFromObject(g);
  g.userData.top = new THREE.Vector3((box.min.x + box.max.x) / 2, box.max.y + 0.6, (box.min.z + box.max.z) / 2);
}
const tmpV = new THREE.Vector3();
function placeLabels() {
  for (const [id, g] of Object.entries(buildings)) {
    const el = labels[id];
    tmpV.copy(g.userData.top);
    if (id === 'kontakt') tmpV.y = keystone.position.y + 1.4;
    tmpV.project(camera);
    el.style.left = ((tmpV.x + 1) / 2 * innerWidth) + 'px';
    el.style.top = ((1 - tmpV.y) / 2 * innerHeight) + 'px';
  }
}

/* ---------- Ден и нощ ---------- */
let night = false;
function setNight(on) {
  night = on;
  document.body.classList.toggle('night', on);
  document.getElementById('dayBtn').textContent = on ? '☀ Ден' : '☾ Нощ';
  scene.background = new THREE.Color(on ? 0x14182A : C.stone);
  scene.fog = new THREE.Fog(on ? 0x14182A : C.stone, mobile ? 120 : 70, mobile ? 240 : 140);
  hemi.intensity = on ? 0.35 : 1.4;
  hemi.color.set(on ? 0x8090c0 : 0xffffff);
  sun.intensity = on ? 0.35 : 2.2;
  sun.color.set(on ? 0x9fb0ff : 0xfff1e0);
  fill.intensity = on ? 0.15 : 0.5;
  windows.forEach(w => {
    w.material = w.material.clone();
    w.material.emissive = new THREE.Color(on ? 0xFFD98A : 0x000000);
    w.material.emissiveIntensity = on ? 1.1 : 0;
  });
  waterMat.color.set(on ? 0x1F3A5A : C.water);
}
const hour = new Date().getHours();
setNight(hour < 7 || hour >= 19);
document.getElementById('dayBtn').onclick = () => setNight(!night);

/* ---------- Звук ---------- */
let soundOn = false, actx = null;
function click(pitch = 1) {
  if (!soundOn) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const t = actx.currentTime;
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = 'square'; o.frequency.setValueAtTime(900 * pitch, t); o.frequency.exponentialRampToValueAtTime(220 * pitch, t + 0.05);
    g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    o.connect(g).connect(actx.destination); o.start(t); o.stop(t + 0.08);
  } catch (e) { /* без звук */ }
}
const soundBtn = document.getElementById('soundBtn');
soundBtn.onclick = () => {
  soundOn = !soundOn;
  soundBtn.textContent = soundOn ? 'Тишина' : 'Нека щрака';
  soundBtn.setAttribute('aria-pressed', soundOn);
  click(1.2);
};

/* ---------- Сглобяване (интро) ---------- */
const intro = document.getElementById('intro');
let introStart = performance.now(), introDone = false, keyPlaced = false, keyDrop = null;
allBlocks.forEach(b => { b.position.y = b.userData.finalY + 14; b.visible = false; });
const ASSEMBLE = 2200;
function finishAssembly() {
  allBlocks.forEach(b => { b.position.y = b.userData.finalY; b.visible = true; });
  introDone = true;
  intro.querySelector('.msg').textContent = 'Остана едно блокче. То е ваше.';
  intro.querySelector('.cta').style.display = 'block';
}
function placeKeystone() {
  if (keyPlaced) return;
  keyPlaced = true;
  keyDrop = performance.now();
  intro.style.opacity = 0;
  setTimeout(() => (intro.style.display = 'none'), 500);
  controls.enabled = true;
  Object.values(labels).forEach(l => l.classList.add('on'));
  setTimeout(() => Object.values(labels).forEach(l => l.classList.remove('on')), 3500);
  setTimeout(() => toast(mobile ? 'Докоснете сграда, за да я отворите.' : 'Кликнете върху сграда, за да я отворите. Плъзнете, за да завъртите града.'), 900);
}
document.getElementById('placeBtn').onclick = () => { soundOn || (soundOn = false); placeKeystone(); };
document.getElementById('skipBtn').onclick = () => { finishAssembly(); placeKeystone(); };
if (reduced) { finishAssembly(); }

/* ---------- Взаимодействие ---------- */
const ray = new THREE.Raycaster();
const ptr = new THREE.Vector2();
let hovered = null;
function pick(ev) {
  const r = canvas.getBoundingClientRect();
  ptr.x = ((ev.clientX - r.left) / r.width) * 2 - 1;
  ptr.y = -((ev.clientY - r.top) / r.height) * 2 + 1;
  ray.setFromCamera(ptr, camera);
  const hits = ray.intersectObjects([...Object.values(buildings), kayak], true);
  for (const h of hits) {
    let o = h.object;
    while (o && !o.userData.id) o = o.parent;
    if (o) return o;
  }
  return null;
}
canvas.addEventListener('pointermove', ev => {
  if (!keyPlaced) return;
  const o = pick(ev);
  if (o !== hovered) {
    if (hovered && hovered.userData.id !== 'kayak') labels[hovered.userData.id].classList.remove('hot', 'on');
    hovered = o;
    if (o && o.userData.id !== 'kayak') { labels[o.userData.id].classList.add('hot', 'on'); click(1.6); }
    canvas.style.cursor = o ? 'pointer' : 'grab';
  }
});
let downAt = null;
canvas.addEventListener('pointerdown', ev => (downAt = [ev.clientX, ev.clientY]));
canvas.addEventListener('pointerup', ev => {
  if (!downAt) return;
  const moved = Math.hypot(ev.clientX - downAt[0], ev.clientY - downAt[1]);
  downAt = null;
  if (moved > 6) return;
  if (!keyPlaced) { if (introDone) placeKeystone(); return; }
  const o = pick(ev);
  if (!o) return;
  if (o.userData.id === 'kayak') { kayakBoost = 1; click(0.7); toast('Гребане, кану-каяк, плуване. Морето е винаги тук.'); return; }
  openProject(o.userData.id);
});

/* ---------- Панел ---------- */
const panel = document.getElementById('panel');
const inner = document.getElementById('panelInner');
const seen = new Set();
const total = ORDER.length - 1;
function updateCounter() {
  document.getElementById('counter').textContent = `Разгледани: ${Math.min(seen.size, total)}/${total}`;
  if (seen.size === total) toast('Разгледахте целия град. Ако искате да работим заедно, пишете ми.');
}
let focusTarget = null;
function openProject(id) {
  const p = PROJECTS[id];
  if (!p) return;
  if (id !== 'kontakt') seen.add(id);
  labels[id]?.classList.add('seen');
  updateCounter();
  click(1);
  const idx = ORDER.indexOf(id);
  const next = ORDER[(idx + 1) % ORDER.length];
  let html = `<button class="btn ghost back" data-close>← Обратно на улицата</button>
    <div class="district">${p.district}</div>
    <h2 id="pTitle">${p.title}</h2>
    <div class="meta">${p.meta}</div>
    <div class="tags">${p.tags.map(t => `<span class="tag">${t}</span>`).join('')}</div>`;
  if (p.cover) html += `<img class="cover" src="${p.cover}" alt="${p.title}" onerror="this.remove()">`;
  html += p.body;
  if (p.contact) html += contactHTML();
  const gal = list => `<div class="gallery">${list.map(([s, c]) => `<figure><img src="${s}" alt="${c}" loading="lazy" onerror="this.parentNode.remove()"><figcaption>${c}</figcaption></figure>`).join('')}</div>`;
  if (p.gallery) html += gal(p.gallery);
  if (p.gallery2) html += `<h3>${p.gallery2Title}</h3>` + gal(p.gallery2);
  html += `<div class="next"><button class="btn ghost" data-close>← Обратно на улицата</button><button class="btn" data-open="${next}">${PROJECTS[next].title.split(':')[0]} →</button></div>`;
  inner.innerHTML = html;
  panel.classList.add('open');
  panel.setAttribute('aria-hidden', 'false');
  panel.scrollTop = 0;
  if (p.contact) wireContact();
  // камерата се приближава към сградата
  const g = buildings[id];
  if (g && !mobile) focusTarget = new THREE.Box3().setFromObject(g).getCenter(new THREE.Vector3());
  inner.querySelector('.back').focus({ preventScroll: true });
}
function closePanel() {
  panel.classList.remove('open');
  panel.setAttribute('aria-hidden', 'true');
  focusTarget = new THREE.Vector3(0, 0, mobile ? 3 : -1.5);
  click(0.8);
}
document.addEventListener('click', e => {
  const gi = e.target.closest('.gallery img');
  if (gi) { const lb = document.getElementById('lightbox'); lb.querySelector('img').src = gi.src; lb.querySelector('img').alt = gi.alt; lb.classList.add('on'); return; }
  if (e.target.closest('#lightbox')) { document.getElementById('lightbox').classList.remove('on'); return; }
  const o = e.target.closest('[data-open]');
  if (o) { e.preventDefault(); document.getElementById('flat').classList.remove('open'); openProject(o.dataset.open); return; }
  if (e.target.closest('[data-close]')) closePanel();
});
addEventListener('keydown', e => { if (e.key === 'Escape') { closePanel(); document.getElementById('flat').classList.remove('open'); } });
document.getElementById('homeBtn').onclick = () => { closePanel(); camera.position.copy(camHome); };

function contactHTML() {
  return `
<p>Имате идея, проект или въпрос? Ще се радвам да ми пишете.</p>
<div class="contact-row">
  <a class="btn pink" href="mailto:${SITE.email}">Имейл</a>
  <button class="btn" id="copyMail">Копирай имейла</button>
</div>
<p class="note">${SITE.email}</p>
<form id="cform">
  <input name="name" placeholder="Вашето име" required>
  <select name="what" aria-label="Тема на запитването">
    <option>С какво мога да ви бъда полезен?</option>
    <option>Социални мрежи</option><option>ПР и събития</option><option>Дизайн и брандинг</option><option>Работа или стаж</option><option>Друго</option>
  </select>
  <textarea name="msg" placeholder="Опишете накратко" required></textarea>
  <button class="btn" type="submit">Подготви имейла</button>
  <div class="status" id="cstatus" aria-live="polite"></div>
</form>`;
}
function wireContact() {
  document.getElementById('copyMail').onclick = async () => {
    try { await navigator.clipboard.writeText(SITE.email); toast('Имейлът е копиран.'); } catch { toast(SITE.email); }
  };
  document.getElementById('cform').onsubmit = e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const subj = encodeURIComponent(`${f.get('what')} – ${f.get('name')}`);
    const body = encodeURIComponent(f.get('msg'));
    location.href = `mailto:${SITE.email}?subject=${subj}&body=${body}`;
    document.getElementById('cstatus').textContent = `Ако имейл програмата ви не се отвори, пишете ми на ${SITE.email}.`;
  };
}

/* ---------- Само съдържание ---------- */
const flat = document.getElementById('flat');
document.getElementById('flatBtn').onclick = () => {
  document.getElementById('flatInner').innerHTML = `
    <button class="btn ghost" id="flatClose">← Обратно в града</button>
    <h1>Built to connect</h1><div class="sub">${SITE.subtitle}</div>
    ${ORDER.map(id => `<button class="card" data-open="${id}"><small>${PROJECTS[id].district}</small><strong>${PROJECTS[id].title}</strong>${PROJECTS[id].meta}</button>`).join('')}`;
  flat.classList.add('open');
  document.getElementById('flatClose').onclick = () => flat.classList.remove('open');
};

/* ---------- Дребни ---------- */
let toastT;
function toast(t) {
  const el = document.getElementById('toast');
  el.textContent = t; el.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), 3200);
}
const baseTitle = document.title;
document.addEventListener('visibilitychange', () => { document.title = document.hidden ? 'Забравихте едно блокче' : baseTitle; });
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

/* ---------- Цикъл ---------- */
let kayakBoost = 0;
const clock = new THREE.Clock();
function frame(now) {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  // сглобяване
  if (!introDone) {
    const el = now - introStart;
    let all = true;
    for (const b of allBlocks) {
      const start = b.userData.delay * 1000 * (ASSEMBLE / 2200);
      const k = Math.min(1, Math.max(0, (el - start) / 420));
      if (k > 0) b.visible = true;
      const e = 1 - Math.pow(1 - k, 3);
      b.position.y = b.userData.finalY + (1 - e) * 14;
      if (k < 1) all = false;
    }
    if (all) finishAssembly();
  }
  // последното блокче
  if (!keyPlaced) {
    keystone.position.y = 7 + Math.sin(t * 2) * 0.25;
    keystone.rotation.y += dt * 0.6;
  } else if (keyDrop) {
    const k = Math.min(1, (now - keyDrop) / 650);
    const bounce = k < 1 ? Math.abs(Math.sin(k * Math.PI * 2.5)) * (1 - k) * 1.2 : 0;
    keystone.position.y = THREE.MathUtils.lerp(7, keystone.userData.finalY, Math.min(1, k * 1.6)) + bounce;
    keystone.rotation.y *= 0.85;
    if (k >= 1) { keyDrop = null; keystone.rotation.y = 0; click(0.9); }
  }
  // повдигане при hover
  for (const g of Object.values(buildings)) {
    if (g === keystone) continue;
    const target = hovered === g ? 0.35 : 0;
    g.position.y += (target - g.position.y) * 0.15;
  }
  // каяк
  kayakBoost *= 0.985;
  const kp = t * (0.18 + kayakBoost * 0.6);
  kayak.position.z = -3.2 + Math.sin(kp) * 8;
  kayak.position.x = 0.4 + Math.sin(kp * 0.5) * 0.35;
  sail.position.y = -0.15 + Math.sin(t * 1.3) * 0.05; sail.rotation.z = Math.sin(t * 1.1) * 0.04; sail.position.x = 7.5 + Math.sin(t * 0.07) * 4;
  kayak.rotation.y = Math.cos(kp) > 0 ? 0 : Math.PI;
  paddle.rotation.x = Math.sin(t * 4) * 0.5;
  kayak.position.y = -0.18 + Math.sin(t * 2) * 0.04;
  // камера към фокус
  if (focusTarget) {
    controls.target.lerp(focusTarget, 0.06);
    if (controls.target.distanceTo(focusTarget) < 0.05) focusTarget = null;
  }
  controls.update();
  if (keyPlaced) placeLabels();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

/* ---------- Изглед „Човек / AI“ ---------- */
{
  const ag = document.getElementById('agent'), h = document.getElementById('mHuman'), m = document.getElementById('mAgent');
  let loaded = false;
  const set = on => {
    ag.classList.toggle('open', on); document.body.classList.toggle('agent', on);
    h.setAttribute('aria-pressed', String(!on)); m.setAttribute('aria-pressed', String(on));
    if (on && !loaded) fetch('ai.md').then(r => r.text()).then(t => { document.getElementById('agentText').textContent = t; loaded = true; })
      .catch(() => { document.getElementById('agentText').textContent = 'Текстовата версия е на адрес /ai.md'; });
    if (on) history.replaceState(null, '', '#ai'); else if (location.hash === '#ai') history.replaceState(null, '', location.pathname);
  };
  h.onclick = () => set(false); m.onclick = () => set(true);
  document.querySelectorAll('nav button, #homeBtn').forEach(b => b.addEventListener('click', () => set(false)));
  if (location.hash === '#ai') set(true);
}
