// Мини игра „Чайките и баничките“: от лодката, с прашка. 45 секунди.
// Ударената чайка изпуска баничката, завърта се зашеметена и отлита.
let api = null;
export function openGulls(onExit) { if (!api) api = build(); api.open(onExit); }

function build() {
  const wrap = document.createElement('div');
  wrap.id = 'gulls';
  wrap.innerHTML = `
<canvas></canvas>
<div class="g-hud"><span class="g-score">0</span><span class="g-time"></span><span class="g-best"></span></div>
<button class="g-x" aria-label="Затвори играта">×</button>
<div class="g-card g-start">
  <p class="g-kicker">Мини игра</p>
  <h2>Чайките и баничките</h2>
  <p>Варненските чайки отново крадат банички. Имате прашка, лодка и 45 секунди.</p>
  <ul class="g-keys">
    <li><b>Клик</b> или <b>докосване</b> – изстрел натам. Камъчето лети малко, затова се цели пред чайката.</li>
    <li>Чайка с баничка – <b>+15</b>, без баничка – <b>+10</b>, златна чайка – <b>+50</b>.</li>
    <li>Поредни попадения без пропуск дават бонус.</li>
  </ul>
  <button class="btn pink g-go">Започни</button>
</div>
<div class="g-card g-over" hidden>
  <p class="g-kicker">Времето изтече</p>
  <h2 class="g-final">0</h2>
  <p class="g-rec"></p>
  <button class="btn pink g-go">Отново</button>
  <button class="btn ghost g-out">Обратно в града</button>
</div>`;
  document.body.appendChild(wrap);
  const $ = s => wrap.querySelector(s);
  const cv = $('canvas'), ctx = cv.getContext('2d');
  let W = 0, H = 0, DPR = 1;

  // ---------- състояние ----------
  const ROUND = 45;
  let running = false, timeLeft = ROUND, score = 0, combo = 0, saved = 0, t = 0, last = 0, spawnIn = 0, cool = 0, exitCb = null;
  let gulls = [], shots = [], bits = [], aim = { x: 0, y: 0 };
  let best = 0; try { best = +localStorage.getItem('gullsBest') || 0; } catch {}
  const showBest = () => { $('.g-best').textContent = best ? `Рекорд ${best}` : ''; };
  showBest();
  const sling = () => ({ x: W / 2, y: H - Math.min(150, H * 0.2) });
  const S = () => Math.min(1.6, Math.max(0.95, W / 760)); // мащаб на чайките

  function spawn() {
    const dir = Math.random() < 0.5 ? 1 : -1, gold = Math.random() < 0.07;
    gulls.push({
      x: dir > 0 ? -60 : W + 60, y: H * (0.12 + Math.random() * 0.42), dir,
      v: (90 + Math.random() * 110 + (ROUND - timeLeft) * 2.2) * (gold ? 1.7 : 1) * S(),
      ph: Math.random() * 6, amp: 10 + Math.random() * 25, food: !gold && Math.random() < 0.6, gold, hit: 0, spin: 0,
    });
  }
  function reset() { gulls = []; shots = []; bits = []; score = 0; combo = 0; saved = 0; timeLeft = ROUND; spawnIn = 0.3; }
  function start() { reset(); $('.g-start').hidden = true; $('.g-over').hidden = true; running = true; }
  function over() {
    running = false;
    const rec = score > best;
    if (rec) { best = score; try { localStorage.setItem('gullsBest', best); } catch {} }
    showBest();
    $('.g-final').textContent = score;
    $('.g-rec').textContent = `${rec ? 'Нов рекорд! ' : `Рекорд: ${best}. `}Спасени банички: ${saved}.`;
    $('.g-over').hidden = false;
  }
  function shoot(x, y) {
    if (!running || cool > 0) return;
    const s = sling();
    if (y > s.y - 20) return;
    shots.push({ x0: s.x, y0: s.y - 30, x1: x, y1: y, k: 0, hit: false });
    cool = 0.22;
  }

  // ---------- вход ----------
  const pos = e => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  cv.addEventListener('pointermove', e => { aim = pos(e); });
  cv.addEventListener('pointerdown', e => { aim = pos(e); shoot(aim.x, aim.y); });
  addEventListener('keydown', e => {
    if (!wrap.classList.contains('open')) return;
    if (e.key === 'Escape') { close(); e.stopPropagation(); }
    else if ((e.key === 'Enter' || e.key === ' ') && !running) { start(); e.preventDefault(); e.stopPropagation(); }
  }, true);
  wrap.querySelectorAll('.g-go').forEach(b => (b.onclick = start));
  $('.g-out').onclick = () => close();
  $('.g-x').onclick = () => close();

  // ---------- рисуване ----------
  function sky() {
    const g = ctx.createLinearGradient(0, 0, 0, H * 0.62);
    g.addColorStop(0, '#BFDCEB'); g.addColorStop(1, '#F4E9D8');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#FFE7B0'; ctx.beginPath(); ctx.arc(W * 0.8, H * 0.2, 46, 0, 7); ctx.fill();
    // бреговата линия: сгради от блокчета
    const base = H * 0.62;
    const blocks = [[0.02, 70, '#E7E2D8'], [0.07, 110, '#D9D2C4'], [0.13, 60, '#F1E6D2'], [0.2, 140, '#E7E2D8'], [0.27, 90, '#C9C1B2'],
      [0.34, 55, '#F1E6D2'], [0.55, 80, '#D9D2C4'], [0.61, 125, '#E7E2D8'], [0.68, 65, '#F1E6D2'], [0.74, 100, '#C9C1B2'], [0.86, 75, '#E7E2D8'], [0.92, 115, '#D9D2C4']];
    for (const [x, h, c] of blocks) {
      ctx.fillStyle = c; ctx.fillRect(x * W, base - h * 0.7, W * 0.05, h * 0.7);
      ctx.fillStyle = 'rgba(0,0,0,.06)'; for (let k = 1; k < h * 0.7 / 14; k++) ctx.fillRect(x * W + 6, base - k * 14, W * 0.05 - 12, 5);
    }
    // катедрала с купол (силует)
    ctx.fillStyle = '#C9C1B2'; const cx = W * 0.45;
    ctx.fillRect(cx - 40, base - 70, 80, 70); ctx.beginPath(); ctx.arc(cx, base - 70, 30, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#CCA352'; ctx.beginPath(); ctx.arc(cx, base - 92, 12, Math.PI, 0); ctx.fill(); ctx.fillRect(cx - 1.5, base - 118, 3, 18);
    // море
    const s = ctx.createLinearGradient(0, base, 0, H);
    s.addColorStop(0, '#5E9BB0'); s.addColorStop(1, '#3E7891');
    ctx.fillStyle = s; ctx.fillRect(0, base, W, H - base);
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 2;
    for (let r = 0; r < 7; r++) {
      const y = base + 14 + r * r * 9, off = (t * (20 + r * 10)) % 80;
      for (let x = -80 + off; x < W; x += 80) { ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 10, y - 4, x + 20, y); ctx.stroke(); }
    }
  }
  function gull(g) {
    const s = S() * (g.gold ? 1.1 : 1);
    ctx.save(); ctx.translate(g.x, g.y); ctx.scale(g.dir * s, s);
    if (g.hit) ctx.rotate(g.spin);
    const flap = Math.sin(t * 12 + g.ph) * (g.hit ? 0.2 : 1);
    const body = g.gold ? '#F2C230' : '#FFFFFF', wing = g.gold ? '#D9A21E' : '#A9AFB6';
    // задно крило
    ctx.fillStyle = wing; ctx.beginPath(); ctx.moveTo(-4, -2); ctx.quadraticCurveTo(-14, -26 * flap - 6, -36, -22 * flap - 4); ctx.lineTo(-10, 4); ctx.fill();
    // тяло
    ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(0, 0, 24, 10, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#2A2C30'; ctx.beginPath(); ctx.moveTo(-22, -3); ctx.lineTo(-34, -1); ctx.lineTo(-22, 4); ctx.fill(); // опашка
    ctx.fillStyle = body; ctx.beginPath(); ctx.arc(20, -6, 9, 0, 7); ctx.fill(); // глава
    ctx.fillStyle = '#1F2023'; ctx.beginPath(); ctx.arc(23, -8, 1.8, 0, 7); ctx.fill();
    ctx.fillStyle = '#F2A33C'; ctx.beginPath(); ctx.moveTo(27, -6); ctx.lineTo(38, -4); ctx.lineTo(27, -2); ctx.fill(); // човка
    // предно крило
    ctx.fillStyle = g.gold ? '#E8B52A' : '#C4C9CF'; ctx.beginPath(); ctx.moveTo(4, -2); ctx.quadraticCurveTo(-4, -30 * flap - 8, -26, -30 * flap - 6); ctx.lineTo(-6, 4); ctx.fill();
    if (g.food && !g.hit) banitsa(40, -2, 0.8);
    if (g.hit) { // звездички
      ctx.fillStyle = '#F2C230';
      for (let k = 0; k < 3; k++) { const a = t * 6 + k * 2.1; star(20 + Math.cos(a) * 14, -22 + Math.sin(a) * 5); }
    }
    ctx.restore();
  }
  function banitsa(x, y, s) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = '#E3B25B'; ctx.beginPath(); ctx.ellipse(0, 0, 12, 7, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = '#B9853A'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(0, 0, 7, 3.5, 0, 0, 7); ctx.stroke();
    ctx.restore();
  }
  function star(x, y) { ctx.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 2 : 5, a = i * Math.PI / 5; ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } ctx.fill(); }
  function boatAndSling() {
    const s = sling();
    // нос на лодката: остър, с бял борд и дъски
    const tip = s.y + 18;
    ctx.fillStyle = '#F4F4F2'; ctx.beginPath(); ctx.moveTo(W * 0.1, H); ctx.quadraticCurveTo(W * 0.3, tip + 70, W / 2, tip); ctx.quadraticCurveTo(W * 0.7, tip + 70, W * 0.9, H); ctx.fill();
    ctx.fillStyle = '#A8784E'; ctx.beginPath(); ctx.moveTo(W * 0.15, H); ctx.quadraticCurveTo(W * 0.32, tip + 84, W / 2, tip + 16); ctx.quadraticCurveTo(W * 0.68, tip + 84, W * 0.85, H); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.13)'; ctx.lineWidth = 2;
    for (let k = -3; k <= 3; k++) { ctx.beginPath(); ctx.moveTo(W / 2, tip + 16); ctx.lineTo(W / 2 + k * W * 0.1, H); ctx.stroke(); }
    ctx.fillStyle = '#C9CDD2'; ctx.beginPath(); ctx.arc(W / 2, tip + 8, 5, 0, 7); ctx.fill();
    // прашка
    const pull = running ? 0.12 + (cool > 0 ? 0 : 0.08) : 0.08;
    let px = s.x + (s.x - aim.x) * pull, py = (s.y - 30) + ((s.y - 30) - aim.y) * pull;
    const d = Math.hypot(px - s.x, py - s.y + 30); if (d > 55) { px = s.x + (px - s.x) * 55 / d; py = s.y - 30 + (py - s.y + 30) * 55 / d; }
    ctx.strokeStyle = '#6E4A26'; ctx.lineWidth = 10; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(s.x, s.y + 60); ctx.lineTo(s.x, s.y); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - 26, s.y - 38); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x + 26, s.y - 38); ctx.stroke();
    ctx.strokeStyle = '#EE6FA8'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(s.x - 26, s.y - 38); ctx.lineTo(px, py); ctx.lineTo(s.x + 26, s.y - 38); ctx.stroke();
    ctx.fillStyle = '#1F2023'; ctx.beginPath(); ctx.arc(px, py, 6, 0, 7); ctx.fill();
    // мерник
    if (running) { ctx.strokeStyle = 'rgba(31,32,35,.45)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(aim.x, aim.y, 12, 0, 7); ctx.moveTo(aim.x - 18, aim.y); ctx.lineTo(aim.x - 6, aim.y); ctx.moveTo(aim.x + 6, aim.y); ctx.lineTo(aim.x + 18, aim.y); ctx.stroke(); }
  }

  // ---------- цикъл ----------
  function frame(now) {
    if (!wrap.classList.contains('open')) return;
    const dt = Math.min(0.05, (now - last) / 1000 || 0); last = now; t += dt; cool -= dt;
    if (running) {
      timeLeft -= dt; if (timeLeft <= 0) { timeLeft = 0; over(); }
      spawnIn -= dt; if (spawnIn <= 0) { spawn(); spawnIn = Math.max(0.35, 1.1 - (ROUND - timeLeft) * 0.016) * (0.6 + Math.random() * 0.8); }
    }
    for (const g of gulls) {
      if (g.hit) { g.spin += dt * 9; g.y -= 200 * dt; g.x += g.dir * 60 * dt; }
      else { g.x += g.dir * g.v * dt; g.y += Math.cos(t * 2 + g.ph) * g.amp * dt; }
    }
    gulls = gulls.filter(g => g.x > -120 && g.x < W + 120 && g.y > -80);
    for (const p of shots) {
      p.k += dt / 0.38;
      const k = Math.min(1, p.k);
      p.x = p.x0 + (p.x1 - p.x0) * k; p.y = p.y0 + (p.y1 - p.y0) * k - Math.sin(k * Math.PI) * 30;
      if (!p.hit) for (const g of gulls) {
        if (g.hit) continue;
        if (Math.hypot(g.x - p.x, g.y - p.y) < 30 * S()) {
          g.hit = 1; p.hit = true; combo++;
          const pts = (g.gold ? 50 : g.food ? 15 : 10) + (combo >= 3 ? 5 * (combo - 2) : 0);
          score += pts;
          bits.push({ x: g.x, y: g.y, txt: `+${pts}`, life: 1 });
          if (g.food) { saved++; bits.push({ x: g.x + 30, y: g.y, food: true, vy: 0, life: 3 }); }
          break;
        }
      }
      if (p.k >= 1 && !p.hit && !p.miss) { p.miss = true; combo = 0; }
    }
    shots = shots.filter(p => p.k < 1.6 && !p.hit);
    for (const b of bits) { b.life -= dt; if (b.food) { b.vy += 600 * dt; b.y += b.vy * dt; } else b.y -= 40 * dt; }
    bits = bits.filter(b => b.life > 0 && b.y < H * 0.64);

    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    sky();
    gulls.forEach(gull);
    for (const b of bits) {
      if (b.food) banitsa(b.x, b.y, 1);
      else { ctx.globalAlpha = Math.max(0, b.life); ctx.fillStyle = '#EE6FA8'; ctx.font = '800 22px Manrope, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(b.txt, b.x, b.y); ctx.globalAlpha = 1; }
    }
    ctx.fillStyle = '#1F2023';
    for (const p of shots) { ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, 7); ctx.fill(); }
    boatAndSling();
    $('.g-score').textContent = score;
    $('.g-time').textContent = running ? `${Math.ceil(timeLeft)} с` : '';
    requestAnimationFrame(frame);
  }
  function resize() {
    DPR = Math.min(devicePixelRatio, 2); W = innerWidth; H = innerHeight;
    cv.width = W * DPR; cv.height = H * DPR; aim = { x: W / 2, y: H * 0.35 };
  }
  addEventListener('resize', () => wrap.classList.contains('open') && resize());
  function open(cb) {
    exitCb = cb; wrap.classList.add('open'); resize();
    if (!running) { reset(); $('.g-start').hidden = false; $('.g-over').hidden = true; }
    last = performance.now(); requestAnimationFrame(frame);
  }
  function close() { running = false; wrap.classList.remove('open'); exitCb && exitCb(); }
  return { open };
}
