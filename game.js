// Мини игра „Каяк по реката“: три коридора, препятствия, блокчета и слалом врати.
import * as THREE from 'three';
import { makeKayak, stroke } from './kayak.js';

const LANES = [-1.9, 0, 1.9];
const PINK = 0xEE6FA8, STONE = 0xF4F1EA;
let api = null;

export function openGame(onExit) {
  if (!api) api = build();
  api.open(onExit);
}

function build() {
  // ---------- DOM ----------
  const wrap = document.createElement('div');
  wrap.id = 'game';
  wrap.innerHTML = `
<canvas></canvas>
<div class="g-hud"><span class="g-score">0</span><span class="g-best"></span></div>
<button class="g-x" aria-label="Затвори играта">×</button>
<div class="g-flash"></div>
<div class="g-card g-start">
  <p class="g-kicker">Мини игра</p>
  <h2>Каяк по реката</h2>
  <p>Гребете колкото се може по-далеч. Заобикаляйте камъните и шамандурите, събирайте розовите блокчета и минавайте през слалом вратите.</p>
  <ul class="g-keys">
    <li><b>← →</b> или плъзгане настрани – смяна на коридора</li>
    <li><b>↓</b> или плъзгане надолу – ескимоско преобръщане под ниските греди</li>
  </ul>
  <button class="btn pink g-go">Започни</button>
</div>
<div class="g-card g-over" hidden>
  <p class="g-kicker">Край на гребането</p>
  <h2 class="g-final">0</h2>
  <p class="g-rec"></p>
  <button class="btn pink g-go">Отново</button>
  <button class="btn ghost g-out">Обратно в града</button>
</div>`;
  document.body.appendChild(wrap);
  const $ = s => wrap.querySelector(s);
  const canvas = $('canvas');

  // ---------- сцена ----------
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xDCE9EE);
  scene.fog = new THREE.Fog(0xDCE9EE, 45, 110);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8C99A0, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2); sun.position.set(-6, 12, 4); scene.add(sun);

  const M = {};
  const mat = c => (M[c] ||= new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 }));
  const box = new THREE.BoxGeometry(1, 1, 1);
  const mesh = (geo, c, x, y, z, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Mesh(geo, mat(c)); m.position.set(x, y, z); m.scale.set(sx, sy, sz); return m; };

  // вода с подвижна текстура
  const tc = document.createElement('canvas'); tc.width = 64; tc.height = 256;
  const cx = tc.getContext('2d'); cx.fillStyle = '#5E9BB0'; cx.fillRect(0, 0, 64, 256);
  cx.strokeStyle = 'rgba(255,255,255,.35)'; cx.lineWidth = 2;
  for (let i = 0; i < 14; i++) { const x = Math.random() * 64, y = Math.random() * 256; cx.beginPath(); cx.moveTo(x, y); cx.lineTo(x + (Math.random() * 6 - 3), y + 10 + Math.random() * 18); cx.stroke(); }
  const wtex = new THREE.CanvasTexture(tc); wtex.wrapS = wtex.wrapT = THREE.RepeatWrapping; wtex.repeat.set(3, 24); wtex.colorSpace = THREE.SRGBColorSpace;
  const water = new THREE.Mesh(new THREE.PlaneGeometry(7.4, 240), new THREE.MeshStandardMaterial({ map: wtex, roughness: 0.3, metalness: 0.1 }));
  water.rotation.x = -Math.PI / 2; water.position.set(0, 0, -100); scene.add(water);

  // брегове: сегменти, които се рециклират
  const SEG = 24, NSEG = 6, banks = [];
  const pal = [0xE7E2D8, 0xF1E6D2, 0xC9C1B2];
  for (let i = 0; i < NSEG; i++) {
    const s = new THREE.Group();
    for (const side of [-1, 1]) {
      s.add(mesh(box, 0xD9D2C4, side * 3.95, -0.1, 0, 0.5, 0.9, SEG));         // кей
      s.add(mesh(box, 0xE7E2D8, side * 8.2, 0.05, 0, 8, 0.5, SEG));            // бряг
      s.add(mesh(box, 0xB5CC8A, side * 6.2, 0.31, 0, 2.6, 0.04, SEG));         // морава
      for (let k = 0; k < 3; k++) {
        const z = -SEG / 2 + 4 + k * 8 + Math.random() * 2;
        if (Math.random() < 0.65) { // дърво
          const x = side * (5.4 + Math.random() * 1.8);
          s.add(mesh(box, 0x8A6A4A, x, 0.7, z, 0.25, 0.9, 0.25));
          s.add(mesh(box, 0x8DB36A, x, 1.6, z, 1.3, 0.9, 1.3));
          s.add(mesh(box, 0x9CC174, x, 2.25, z, 0.8, 0.5, 0.8));
        }
        if (Math.random() < 0.55) { // сграда от блокчета
          const h = 1.5 + Math.random() * 3, x = side * (9.5 + Math.random() * 2);
          const b = mesh(box, pal[(Math.random() * 3) | 0], x, 0.3 + h / 2, z + 3, 3, h, 3); s.add(b);
          s.add(mesh(box, [PINK, 0x3D63DD, 0xB6D45C, 0x7B66C8][(Math.random() * 4) | 0], x, 0.45 + h, z + 3, 3.1, 0.3, 3.1));
        }
      }
      for (let k = 0; k < 2; k++) { // фенери
        const z = -SEG / 2 + 6 + k * 12;
        s.add(mesh(box, 0x1F2023, side * 4.5, 1, z, 0.08, 1.4, 0.08));
        s.add(mesh(box, 0xFFF4D6, side * 4.4, 1.7, z, 0.2, 0.15, 0.2));
      }
    }
    s.position.z = 10 - i * SEG; scene.add(s); banks.push(s);
  }

  // каякът
  const K = makeKayak();
  K.group.position.y = 0.05; scene.add(K.group);

  // ---------- препятствия ----------
  const things = [];
  const rockGeo = new THREE.DodecahedronGeometry(0.75, 0);
  const studGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.14, 16);
  function spawn(type, lane, z) {
    const g = new THREE.Group(); g.position.set(lane === null ? 0 : LANES[lane], 0, z);
    if (type === 'rock') {
      const r = new THREE.Mesh(rockGeo, new THREE.MeshStandardMaterial({ color: 0x8E9196, roughness: 0.9, flatShading: true }));
      r.scale.set(1.1, 0.7, 1); r.rotation.y = Math.random() * 3; r.position.y = 0.15; g.add(r);
    } else if (type === 'buoy') {
      g.add(mesh(new THREE.CylinderGeometry(0.4, 0.45, 0.7, 14), 0xF2A33C, 0, 0.2, 0));
      g.add(mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.14, 14), 0xFFFFFF, 0, 0.42, 0));
    } else if (type === 'bar') { // ниска греда през реката
      g.add(mesh(box, 0x8A5A2B, 0, 0.75, 0, 7.6, 0.28, 0.32));
      for (const s of [-1, 1]) g.add(mesh(box, 0x6E4A26, s * 3.75, 0.4, 0, 0.3, 1.1, 0.3));
      g.add(mesh(box, 0xE5243B, 0, 0.95, 0, 0.8, 0.12, 0.34));
    } else if (type === 'stud') {
      g.add(mesh(box, PINK, 0, 0.7, 0, 0.6, 0.36, 0.6));
      for (const [a, b] of [[-0.15, -0.15], [0.15, -0.15], [-0.15, 0.15], [0.15, 0.15]]) g.add(mesh(studGeo, PINK, a, 0.95, b));
    } else if (type === 'gate') { // слалом врата
      const green = lane % 2 === 0;
      g.add(mesh(box, 0x1F2023, 0, 3.2, 0, 2.2, 0.04, 0.04));
      for (const s of [-1, 1]) for (let k = 0; k < 6; k++) g.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.35, 8), k % 2 ? 0xFFFFFF : (green ? 0x2E9E5B : 0xE5243B), s * 0.75, 1.1 + k * 0.35, 0));
      g.add(mesh(box, 0xFFFFFF, 0, 2.75, 0, 0.5, 0.35, 0.03));
    }
    g.userData = { type, lane, done: false };
    scene.add(g); things.push(g);
  }
  let nextZ = -40;
  function pattern() {
    const z = nextZ, r = Math.random();
    if (score > 150 && r < 0.17) { spawn('bar', null, z); nextZ -= 16; return; }
    const free = (Math.random() * 3) | 0;
    const blocked = [0, 1, 2].filter(l => l !== free && Math.random() < 0.75);
    if (!blocked.length) blocked.push((free + 1) % 3);
    blocked.forEach(l => spawn(Math.random() < 0.6 ? 'rock' : 'buoy', l, z - Math.random() * 1.5));
    if (Math.random() < 0.3) spawn('gate', free, z);
    else for (let k = 0; k < 3; k++) spawn('stud', free, z + 3 + k * 2.2);
    nextZ -= Math.max(12, 20 - speed * 0.2);
  }

  // ---------- състояние ----------
  let running = false, speed = 16, dist = 0, bonus = 0, score = 0, lane = 1, roll = -1, t = 0, last = 0, dead = false, deadT = 0, exitCb = null;
  let best = 0; try { best = +localStorage.getItem('kayakBest') || 0; } catch {}
  const showBest = () => { $('.g-best').textContent = best ? `Рекорд ${best}` : ''; };
  showBest();
  const flash = txt => { const f = $('.g-flash'); f.textContent = txt; f.classList.remove('on'); void f.offsetWidth; f.classList.add('on'); };

  function reset() {
    things.splice(0).forEach(o => scene.remove(o));
    speed = 16; dist = 0; bonus = 0; score = 0; lane = 1; roll = -1; dead = false; nextZ = -40;
    K.group.position.set(0, 0.05, 0); K.group.rotation.set(0, 0, 0);
    while (nextZ > -130) pattern();
  }
  function start() { reset(); $('.g-start').hidden = true; $('.g-over').hidden = true; running = true; }
  function over() {
    running = false; dead = true; deadT = 0;
    const rec = score > best;
    if (rec) { best = score; try { localStorage.setItem('kayakBest', best); } catch {} }
    showBest();
    $('.g-final').textContent = score;
    $('.g-rec').textContent = rec ? 'Нов рекорд!' : `Рекорд: ${best}`;
    setTimeout(() => { $('.g-over').hidden = false; }, 700);
  }

  // ---------- управление ----------
  const move = d => { if (running) lane = Math.max(0, Math.min(2, lane + d)); };
  const doRoll = () => { if (running && roll < 0) roll = 0; };
  addEventListener('keydown', e => {
    if (!wrap.classList.contains('open')) return;
    const k = e.key;
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') move(-1);
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') move(1);
    else if (k === 'ArrowDown' || k === 's' || k === 'S') doRoll();
    else if ((k === ' ' || k === 'Enter') && !running) start();
    else if (k === 'Escape') close();
    else return;
    e.preventDefault(); e.stopPropagation();
  }, true);
  let sx = 0, sy = 0;
  canvas.addEventListener('touchstart', e => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  canvas.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dy) > 40 && dy > Math.abs(dx)) doRoll();
    else if (Math.abs(dx) > 30) move(dx > 0 ? 1 : -1);
    else move(sx > innerWidth / 2 ? 1 : -1);
  });
  canvas.addEventListener('mousedown', e => { if (running) move(e.clientX > innerWidth / 2 ? 1 : -1); });
  wrap.querySelectorAll('.g-go').forEach(b => (b.onclick = start));
  $('.g-out').onclick = () => close();
  $('.g-x').onclick = () => close();

  // ---------- цикъл ----------
  function resize() {
    const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.fov = w < h ? 70 : 55; camera.updateProjectionMatrix();
    camera.position.set(0, w < h ? 3.2 : 2.5, w < h ? 6.8 : 5.6); camera.lookAt(0, 0.7, -9);
  }
  addEventListener('resize', () => wrap.classList.contains('open') && resize());

  function frame(now) {
    if (!wrap.classList.contains('open')) return;
    const dt = Math.min(0.05, (now - last) / 1000 || 0); last = now; t += dt;
    const v = running ? speed : dead ? 0 : 6;
    if (running) {
      speed = Math.min(42, speed + dt * 0.45);
      dist += v * dt; score = Math.floor(dist / 2) + bonus;
      $('.g-score').textContent = score;
    }
    // фон
    wtex.offset.y += v * dt / 10;
    for (const b of banks) { b.position.z += v * dt; if (b.position.z > SEG + 10) b.position.z -= SEG * NSEG; }
    // каяк
    const k = K.group;
    const tx = LANES[lane];
    k.position.x += (tx - k.position.x) * Math.min(1, dt * 12);
    k.rotation.y = (k.position.x - tx) * 0.18;
    if (roll >= 0) {
      roll += dt / 0.65; k.rotation.z = roll * Math.PI * 2; k.position.y = 0.05 - Math.sin(roll * Math.PI) * 0.35;
      if (roll >= 1) { roll = -1; k.rotation.z = 0; k.position.y = 0.05; }
    } else if (dead) {
      deadT += dt; k.rotation.z = Math.min(Math.PI * 0.9, deadT * 6);
    } else {
      k.rotation.z = (k.position.x - tx) * 0.12; k.position.y = 0.05 + Math.sin(t * 5) * 0.025;
    }
    stroke(K, t, running ? 5 + speed * 0.1 : 3);
    // препятствия
    if (running) {
      if (nextZ > -130) pattern();
      for (const o of things) o.position.z += v * dt;
      nextZ += v * dt;
      for (let i = things.length - 1; i >= 0; i--) {
        const o = things[i], u = o.userData, dz = Math.abs(o.position.z);
        if (u.type === 'stud') o.rotation.y += dt * 2.5;
        if (o.position.z > 8) { scene.remove(o); things.splice(i, 1); continue; }
        if (u.done) continue;
        const sameLane = u.lane === null || Math.abs(o.position.x - k.position.x) < 1.0;
        if (u.type === 'rock' || u.type === 'buoy') {
          if (dz < 1.3 && sameLane) { over(); break; }
        } else if (u.type === 'bar') {
          if (dz < 0.4) { if (roll < 0) { over(); break; } u.done = true; bonus += 15; flash('Ескимоско! +15'); }
        } else if (u.type === 'stud') {
          if (dz < 0.9 && sameLane) { u.done = true; bonus += 10; o.visible = false; }
        } else if (u.type === 'gate') {
          if (dz < 0.4) { u.done = true; if (sameLane) { bonus += 25; flash('Врата! +25'); } }
        }
      }
    }
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  function open(cb) {
    exitCb = cb; wrap.classList.add('open'); resize();
    if (!running) { reset(); $('.g-start').hidden = false; $('.g-over').hidden = true; }
    last = performance.now(); requestAnimationFrame(frame);
  }
  function close() { running = false; dead = false; wrap.classList.remove('open'); exitCb && exitCb(); }
  return { open };
}
