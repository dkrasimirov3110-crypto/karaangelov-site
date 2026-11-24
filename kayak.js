// Черен карбонов каяк за спускане с гребец (общ за града и за играта).
// Дължина около 2.6 единици при мащаб 1; носът сочи към -z.
import * as THREE from 'three';

export function makeKayak() {
  const g = new THREE.Group();
  const carbon = new THREE.MeshStandardMaterial({ color: 0x121316, roughness: 0.22, metalness: 0.25 });
  const satin = new THREE.MeshStandardMaterial({ color: 0x1D1F23, roughness: 0.5 });
  const white = new THREE.MeshStandardMaterial({ color: 0xF4F4F2, roughness: 0.4 });
  const add = (geo, m, x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) => {
    const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.rotation.set(rx, ry, rz);
    o.castShadow = true; g.add(o); return o;
  };
  const sph = new THREE.SphereGeometry(1, 36, 18);
  const box = new THREE.BoxGeometry(1, 1, 1);

  // корпус: дълъг, тесен, остър нос и кърма
  add(sph, carbon, 0, 0, 0, 0.27, 0.15, 1.42);
  add(sph, carbon, 0, 0.05, -0.1, 0.19, 0.12, 1.2);              // палуба с ръб
  add(new THREE.TorusGeometry(0.19, 0.03, 8, 28), satin, 0, 0.14, 0.12, 1, 1.45, 1, Math.PI / 2); // отвор
  // графика: бели „отломки“ по задната палуба и цветни акценти до отвора
  [[0.55, 0.09, 0.75, -0.12], [0.85, 0.05, 0.5, 0.1], [0.62, -0.1, 0.55, 0.14], [1.05, -0.03, 0.3, -0.08]].forEach(([z, x, l, r]) =>
    add(box, white, x, 0.115, z, 0.05, 0.012, l, 0, r, 0));
  add(box, new THREE.MeshStandardMaterial({ color: 0xE5243B }), 0.17, 0.06, -0.35, 0.02, 0.05, 0.22, 0, 0, 0);
  add(box, new THREE.MeshStandardMaterial({ color: 0xF2C230 }), 0.17, 0.06, -0.12, 0.02, 0.05, 0.18, 0, 0, 0);
  add(box, white, -0.2, 0.05, -0.75, 0.02, 0.035, 0.45, 0, 0, 0);

  // гребец: синьо яке, черна жилетка, черна каска
  const body = new THREE.Group(); body.position.set(0, 0.14, 0.12); g.add(body);
  const put = (geo, m, x, y, z, sx, sy, sz) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.castShadow = true; body.add(o); return o; };
  const blue = new THREE.MeshStandardMaterial({ color: 0x2F6FD8, roughness: 0.55 });
  put(box, blue, 0, 0.26, 0, 0.34, 0.42, 0.24);
  put(box, satin, 0, 0.24, 0, 0.37, 0.3, 0.27);                    // жилетка
  put(sph, new THREE.MeshStandardMaterial({ color: 0xF0D2B6 }), 0, 0.58, 0, 0.12, 0.13, 0.12);
  put(sph, carbon, 0, 0.63, 0, 0.135, 0.1, 0.14);                   // каска
  for (const s of [-1, 1]) put(box, blue, s * 0.2, 0.36, -0.14, 0.08, 0.08, 0.3);

  // гребло: черен прът и лопати
  const paddle = new THREE.Group(); paddle.position.set(0, 0.48, -0.26); body.add(paddle);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.9, 8), carbon);
  shaft.rotation.z = Math.PI / 2; paddle.add(shaft);
  for (const s of [-1, 1]) {
    const b = new THREE.Mesh(sph, carbon); b.scale.set(0.2, 0.012, 0.09); b.position.x = s * 0.95; b.rotation.x = s * 0.6; paddle.add(b);
    const rim = new THREE.Mesh(sph, white); rim.scale.set(0.07, 0.014, 0.05); rim.position.x = s * 0.97; rim.rotation.x = s * 0.6; paddle.add(rim);
  }
  return { group: g, paddle, body };
}

// Анимация на загребване; t е време в секунди, rate – темпо.
export function stroke(k, t, rate = 4) {
  k.paddle.rotation.y = Math.sin(t * rate) * 0.55;
  k.paddle.rotation.z = Math.sin(t * rate) * 0.35;
  k.body.rotation.y = Math.sin(t * rate) * 0.12;
}
