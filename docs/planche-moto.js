// Générateur de la planche moto (vues profil G/D, face avant, face arrière, dessus).
const fs = require('fs');
const F = 'fill="#fff"';
const r2 = (n) => Math.round(n * 10) / 10;
const pol = (cx, cy, r, deg) => [cx + r * Math.cos((deg * Math.PI) / 180), cy + r * Math.sin((deg * Math.PI) / 180)];

function wheelSide(cx, cy, { disc = true, sprocket = false } = {}) {
  let s = `<circle cx="${cx}" cy="${cy}" r="84" ${F}/>`;
  s += `<circle cx="${cx}" cy="${cy}" r="71"/>`;
  s += `<circle cx="${cx}" cy="${cy}" r="65" stroke-width="1.6"/>`;
  // 3 bâtons doubles (jante coulée)
  for (const a of [-90, 30, 150]) {
    for (const off of [-7, 7]) {
      const [x1, y1] = pol(cx, cy, 16, a + off * 1.6);
      const [x2, y2] = pol(cx, cy, 64, a + off * 0.55);
      s += `<path d="M${r2(x1)} ${r2(y1)} L${r2(x2)} ${r2(y2)}" stroke-width="1.8"/>`;
    }
  }
  if (disc) {
    s += `<circle cx="${cx}" cy="${cy}" r="46" stroke-width="1.8"/><circle cx="${cx}" cy="${cy}" r="36" stroke-width="1.3"/>`;
    for (let k = 0; k < 12; k++) { const [x, y] = pol(cx, cy, 41, k * 30 + 15); s += `<circle cx="${r2(x)}" cy="${r2(y)}" r="1.6" stroke-width="1"/>`; }
  }
  if (sprocket) s += `<circle cx="${cx}" cy="${cy}" r="30" stroke-width="1.8" stroke-dasharray="2.5 2.5"/>`;
  s += `<circle cx="${cx}" cy="${cy}" r="14" ${F}/><circle cx="${cx}" cy="${cy}" r="5"/>`;
  return s;
}

// ─── Profil gauche : avant à gauche. Repère 600×380, sol y=370 ───────────
function side() {
  const FX = 140, RX = 480, WY = 286;
  let s = '';
  s += wheelSide(RX, WY, { disc: false, sprocket: true });
  // Garde-boue arrière (lèche-roue)
  s += `<path d="M${RX - 52} ${WY - 78} A92 92 0 0 1 ${RX + 30} ${WY - 88} L${RX + 26} ${WY - 80} A84 84 0 0 0 ${RX - 48} ${WY - 70} Z" ${F}/>`;
  // Chaîne + pignon
  s += `<path d="M366 244 L${RX} ${WY - 30} M366 264 L${RX} ${WY + 30}" stroke-width="1.8"/>`;
  s += `<circle cx="366" cy="254" r="11" ${F}/>`;
  // Amortisseur arrière
  s += `<path d="M392 150 L414 236 M402 148 L424 234" /><path d="M398 176 l14 -4 M402 192 l14 -4 M406 208 l14 -4" stroke-width="1.4"/>`;
  // Bras oscillant (effilé)
  s += `<path d="M364 222 L${RX} ${WY - 9} L${RX} ${WY + 9} L360 246 Z" ${F}/><circle cx="366" cy="232" r="9" ${F}/><circle cx="366" cy="232" r="3.5"/>`;
  // Cadre (treillis visible sous la selle)
  s += `<path d="M226 128 L300 150 L392 150 M300 150 L366 226 M392 150 L366 226" stroke-width="2.2"/>`;
  // Échappement sous moteur (boîtier court)
  s += `<path d="M262 212 q-14 40 20 70 L318 294" stroke-width="7" stroke="#111"/>`;
  s += `<path d="M262 212 q-14 40 20 70 L318 294" stroke-width="3.6" stroke="#fff"/>`;
  s += `<path d="M312 284 L392 278 q10 0 10 10 L400 302 q-2 8 -12 8 L318 312 q-10 0 -10 -10 Z" ${F}/>`;
  s += `<path d="M390 284 L396 306" stroke-width="1.4"/>`;
  // Moteur : carters + cylindre
  s += `<path d="M252 196 L374 190 L382 244 L340 282 L276 282 L246 250 Z" ${F}/>`;
  s += `<path d="M260 196 L270 154 L334 150 L340 192" ${F}/>`;
  s += `<path d="M268 166 L336 162 M266 176 L337 172 M264 186 L338 182" stroke-width="1.4"/>`;
  s += `<circle cx="318" cy="240" r="24" stroke-width="2"/><circle cx="318" cy="240" r="9" stroke-width="1.6"/>`;
  s += `<path d="M262 256 L300 262" stroke-width="1.4"/>`;
  // Radiateur
  s += `<path d="M228 166 L252 166 L254 238 L232 240 Z" ${F}/>`;
  for (let y = 178; y <= 228; y += 10) s += `<path d="M232 ${y} L252 ${y}" stroke-width="1.2"/>`;
  // Repose-pieds pilote + sélecteur
  s += `<path d="M364 268 l30 -2" stroke-width="4"/><path d="M350 268 l-26 12" stroke-width="2"/>`;
  // Coque arrière + feu + support de plaque
  s += `<path d="M452 124 Q510 112 566 104 L570 114 Q532 138 486 150 L452 150 Z" ${F}/>`;
  s += `<path d="M556 104 L572 101 L574 112 L560 116 Z"/>`;
  s += `<path d="M500 146 Q524 160 536 190 L528 194 Q516 168 494 154" ${F}/>`;
  s += `<rect x="518" y="190" width="34" height="22" rx="2" transform="rotate(10 535 201)" ${F}/>`;
  s += `<path d="M534 166 l16 -2 l1 6 l-16 3" stroke-width="1.8"/>`;
  // Selle pilote + passager
  s += `<path d="M352 116 Q390 126 432 128 Q452 122 470 112 Q486 108 488 118 L484 130 Q440 150 380 150 Q356 148 348 136 Z" ${F}/>`;
  s += `<path d="M432 128 Q440 138 438 148" stroke-width="1.6"/>`;
  // Réservoir
  s += `<path d="M222 124 Q236 98 282 90 Q332 84 358 106 Q370 118 366 140 Q362 156 342 160 L242 164 Q222 160 222 124 Z" ${F}/>`;
  s += `<path d="M246 116 Q296 102 350 112" stroke-width="1.6"/>`;
  s += `<ellipse cx="312" cy="92" rx="13" ry="4" stroke-width="1.8"/>`;
  s += `<path d="M252 148 Q296 146 336 150" stroke-width="1.4"/>`;
  // Roue avant
  s += wheelSide(FX, WY);
  // Étrier avant sur le disque
  s += `<path d="M168 244 q16 8 20 24 l-12 5 q-5 -14 -17 -19 z" ${F}/>`;
  // Garde-boue avant
  s += `<path d="M84 222 A94 94 0 0 1 196 226 L188 232 A86 86 0 0 0 90 230 Z" ${F}/>`;
  // Fourche inversée (2 fourreaux)
  const top = [214, 120];
  s += `<path d="M${FX - 7} ${WY - 2} L${top[0] - 7} ${top[1]} L${top[0] + 7} ${top[1] + 4} L${FX + 7} ${WY + 2} Z" ${F}/>`;
  s += `<path d="M${FX + 12} ${WY - 50} L${FX + 44} ${WY - 140}" stroke-width="1.4"/>`;
  // Tés de fourche
  s += `<path d="M204 118 L234 110 L238 122 L208 130 Z" ${F}/><path d="M210 104 L238 96 L240 106 L212 114 Z" ${F}/>`;
  // Phare rond + clignotant
  s += `<circle cx="192" cy="146" r="23" ${F}/><circle cx="190" cy="146" r="15" stroke-width="1.6"/>`;
  s += `<path d="M204 164 l-20 8 l2 6 l20 -7" ${F} stroke-width="1.8"/>`;
  // Guidon + poignée + levier
  s += `<path d="M232 100 L250 78 L276 78" stroke-width="3.4"/>`;
  s += `<rect x="266" y="72" width="24" height="12" rx="5" ${F}/>`;
  s += `<path d="M252 80 q16 -8 30 -4" stroke-width="1.8"/>`;
  // Rétroviseur
  s += `<path d="M246 82 L236 50" stroke-width="2.2"/>`;
  s += `<ellipse cx="230" cy="42" rx="18" ry="10" transform="rotate(-10 230 42)" ${F}/>`;
  // Compteur
  s += `<rect x="212" y="84" width="22" height="16" rx="4" transform="rotate(-18 223 92)" ${F}/>`;
  return s;
}

// ─── Face avant. Repère 260×380 ────────────────────────────────────────
function front() {
  let s = '';
  // Pneu arrière (derrière) + pneu avant
  s += `<rect x="112" y="226" width="36" height="140" rx="16" ${F}/>`;
  s += `<rect x="116" y="232" width="28" height="138" rx="12" ${F}/>`;
  s += `<path d="M130 236 L130 368" stroke-width="1.2"/>`;
  // Échappement / carters (larges)
  s += `<path d="M72 200 L188 200 L196 262 L168 290 L92 290 L64 262 Z" ${F}/>`;
  s += `<circle cx="84" cy="246" r="16" stroke-width="1.6"/><circle cx="176" cy="246" r="16" stroke-width="1.6"/>`;
  // Radiateur
  s += `<rect x="92" y="150" width="76" height="66" rx="6" ${F}/>`;
  for (let y = 162; y <= 206; y += 8) s += `<path d="M98 ${y} L162 ${y}" stroke-width="1.1"/>`;
  // Réservoir (vu de face, derrière)
  s += `<path d="M70 118 Q130 96 190 118 L182 150 L78 150 Z" ${F}/>`;
  // Fourche
  s += `<rect x="96" y="120" width="14" height="190" rx="5" ${F}/><rect x="150" y="120" width="14" height="190" rx="5" ${F}/>`;
  // Garde-boue avant
  s += `<path d="M104 244 Q130 222 156 244 L154 276 Q130 262 106 276 Z" ${F}/>`;
  // Étriers
  s += `<rect x="86" y="266" width="12" height="26" rx="3" ${F}/><rect x="162" y="266" width="12" height="26" rx="3" ${F}/>`;
  // Tés + phare
  s += `<rect x="88" y="110" width="84" height="14" rx="5" ${F}/>`;
  s += `<circle cx="130" cy="150" r="30" ${F}/><circle cx="130" cy="150" r="21" stroke-width="1.6"/><circle cx="130" cy="150" r="7" stroke-width="1.2"/>`;
  // Clignotants
  s += `<path d="M96 160 L66 166 L66 176 L96 172" ${F}/><path d="M164 160 L194 166 L194 176 L164 172" ${F}/>`;
  // Guidon + poignées + leviers
  s += `<path d="M40 88 Q130 70 220 88" stroke-width="3.4"/>`;
  s += `<rect x="14" y="80" width="30" height="13" rx="5" ${F}/><rect x="216" y="80" width="30" height="13" rx="5" ${F}/>`;
  s += `<path d="M46 96 L20 104 M214 96 L240 104" stroke-width="2"/>`;
  // Rétroviseurs
  s += `<path d="M58 84 L44 42 M202 84 L216 42" stroke-width="2.2"/>`;
  s += `<ellipse cx="40" cy="34" rx="20" ry="12" ${F}/><ellipse cx="220" cy="34" rx="20" ry="12" ${F}/>`;
  // Compteur
  s += `<rect x="112" y="90" width="36" height="20" rx="5" ${F}/>`;
  // Repose-pieds
  s += `<path d="M58 300 L40 302 M202 300 L220 302" stroke-width="4"/>`;
  return s;
}

// ─── Face arrière. Repère 260×380 ──────────────────────────────────────
function rear() {
  let s = '';
  // Guidon et rétros (derrière)
  s += `<path d="M40 88 Q130 72 220 88" stroke-width="3"/>`;
  s += `<path d="M58 84 L44 42 M202 84 L216 42" stroke-width="2"/>`;
  s += `<ellipse cx="40" cy="34" rx="20" ry="12" ${F}/><ellipse cx="220" cy="34" rx="20" ry="12" ${F}/>`;
  s += `<rect x="14" y="80" width="30" height="13" rx="5" ${F}/><rect x="216" y="80" width="30" height="13" rx="5" ${F}/>`;
  // Réservoir
  s += `<path d="M66 114 Q130 94 194 114 L186 146 L74 146 Z" ${F}/>`;
  // Carters + échappement (côté droit)
  s += `<path d="M72 196 L188 196 L196 256 L168 286 L92 286 L64 256 Z" ${F}/>`;
  s += `<path d="M170 268 L208 268 L210 300 L172 302 Z" ${F}/><ellipse cx="190" cy="285" rx="12" ry="10" stroke-width="1.6"/>`;
  // Pneu arrière (large)
  s += `<rect x="102" y="230" width="56" height="140" rx="20" ${F}/>`;
  s += `<path d="M112 240 L112 360 M148 240 L148 360" stroke-width="1.2"/>`;
  // Bras oscillant
  s += `<path d="M86 250 L102 262 M174 250 L158 262" stroke-width="3"/>`;
  // Selle + coque arrière
  s += `<path d="M84 136 Q130 120 176 136 L172 156 L88 156 Z" ${F}/>`;
  s += `<path d="M96 156 L164 156 L154 186 L106 186 Z" ${F}/>`;
  // Feu arrière
  s += `<rect x="112" y="162" width="36" height="14" rx="4" ${F}/><path d="M118 169 L142 169" stroke-width="1.2"/>`;
  // Support + plaque
  s += `<path d="M122 186 L122 204 M138 186 L138 204" stroke-width="2"/>`;
  s += `<rect x="100" y="204" width="60" height="30" rx="2" ${F}/>`;
  // Clignotants
  s += `<path d="M104 192 L76 196 L76 206 L104 202" ${F}/><path d="M156 192 L184 196 L184 206 L156 202" ${F}/>`;
  // Repose-pieds passager
  s += `<path d="M76 262 L52 264 M184 262 L208 264" stroke-width="4"/>`;
  return s;
}

// ─── Dessus : avant à gauche. Repère 600×220 ───────────────────────────
function top() {
  let s = '';
  // Pneus (vus du dessus)
  s += `<rect x="50" y="96" width="176" height="28" rx="12" ${F}/>`;
  s += `<rect x="392" y="92" width="176" height="36" rx="14" ${F}/>`;
  // Échappement (côté droit = bas en vue de dessus, avant à gauche)
  s += `<path d="M300 134 L380 148 L384 170 L304 160 Z" ${F}/>`;
  // Bras oscillant
  s += `<path d="M360 90 L470 98 M360 130 L470 122" stroke-width="2.4"/>`;
  // Moteur (dépasse sous le réservoir)
  s += `<rect x="236" y="66" width="120" height="88" rx="14" ${F}/>`;
  // Coque arrière + feu
  s += `<path d="M440 86 L560 96 Q572 110 560 124 L440 134 Z" ${F}/><rect x="556" y="100" width="10" height="20" rx="3" ${F}/>`;
  // Selle
  s += `<path d="M340 78 Q400 72 450 88 L450 132 Q400 148 340 142 Q326 110 340 78 Z" ${F}/>`;
  s += `<path d="M420 84 L420 136" stroke-width="1.4"/>`;
  // Réservoir
  s += `<path d="M232 70 Q300 52 346 76 Q356 110 346 144 Q300 168 232 150 Q216 110 232 70 Z" ${F}/>`;
  s += `<ellipse cx="300" cy="110" rx="12" ry="9" stroke-width="1.8"/>`;
  s += `<path d="M252 84 Q300 72 334 88 M252 136 Q300 148 334 132" stroke-width="1.3"/>`;
  // Garde-boue avant + fourche
  s += `<rect x="80" y="100" width="100" height="20" rx="9" ${F}/>`;
  s += `<rect x="150" y="90" width="60" height="10" rx="4" ${F}/><rect x="150" y="120" width="60" height="10" rx="4" ${F}/>`;
  // Phare + compteur
  s += `<path d="M170 96 L154 96 Q146 110 154 124 L170 124 Z" ${F}/>`;
  s += `<rect x="204" y="98" width="18" height="24" rx="4" ${F}/>`;
  // Guidon + poignées + leviers
  s += `<path d="M226 22 Q214 110 226 198" stroke-width="3.4"/>`;
  s += `<rect x="219" y="6" width="14" height="28" rx="5" ${F}/><rect x="219" y="186" width="14" height="28" rx="5" ${F}/>`;
  s += `<path d="M212 30 L196 20 M212 190 L196 200" stroke-width="2"/>`;
  // Rétroviseurs
  s += `<path d="M224 50 L206 40 M224 170 L206 180" stroke-width="2"/>`;
  s += `<ellipse cx="196" cy="36" rx="10" ry="16" ${F}/><ellipse cx="196" cy="184" rx="10" ry="16" ${F}/>`;
  // Repose-pieds
  s += `<path d="M366 60 L366 48 M366 160 L366 172" stroke-width="4"/>`;
  return s;
}

const style = 'fill="none" stroke="#111" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"';
// Planche 1400×900 :
//  - profil G :    x 40..640,   y 30..410   (600×380)
//  - profil D :    x 40..640,   y 470..850  (miroir)
//  - face avant :  x 740..1000, y 30..410   (260×380)
//  - face arrière: x 1080..1340,y 30..410
//  - dessus :      x 740..1340, y 540..760  (600×220)
const planche =
  `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="900" viewBox="0 0 1400 900"><rect width="1400" height="900" fill="#fff"/>` +
  `<g ${style}>` +
  `<g transform="translate(40 30)">${side()}</g>` +
  `<g transform="translate(640 470) scale(-1 1)">${side()}</g>` +
  `<g transform="translate(740 30)">${front()}</g>` +
  `<g transform="translate(1080 30)">${rear()}</g>` +
  `<g transform="translate(740 540)">${top()}</g>` +
  `</g></svg>`;
fs.writeFileSync('planche.svg', planche);
console.log('ok');
