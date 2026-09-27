// Planche moto Axis Import (roadster) — générateur SVG.
// Usage : node docs/planche-moto.js → planche2.svg (1400×900), à exporter en JPEG
// puis à coller dans mobile/src/utils/vehicleSketches.ts (VEHICLE_SKETCH_MOTO).
// Planche moto v2 — roadster moderne, traits techniques (contours 2.6 / détails 1.4).
const fs = require('fs');
const W = 'fill="#fff"';
const D = 'stroke-width="1.4"';
const r1 = (n) => Math.round(n * 10) / 10;
const P = (cx, cy, r, deg) => [r1(cx + r * Math.cos((deg * Math.PI) / 180)), r1(cy + r * Math.sin((deg * Math.PI) / 180))];

function wheel(cx, cy, { front }) {
  let s = `<circle cx="${cx}" cy="${cy}" r="84" ${W}/>`;          // pneu
  s += `<circle cx="${cx}" cy="${cy}" r="72" ${D}/>`;              // flanc
  s += `<circle cx="${cx}" cy="${cy}" r="68" ${W}/>`;              // jante
  s += `<circle cx="${cx}" cy="${cy}" r="63" ${D}/>`;
  // 5 bâtons fins (jante coulée)
  for (let k = 0; k < 5; k++) {
    const a = -90 + k * 72;
    const [x1, y1] = P(cx, cy, 17, a - 9), [x2, y2] = P(cx, cy, 63, a - 4);
    const [x3, y3] = P(cx, cy, 63, a + 4), [x4, y4] = P(cx, cy, 17, a + 9);
    s += `<path d="M${x1} ${y1} L${x2} ${y2} A63 63 0 0 1 ${x3} ${y3} L${x4} ${y4}" ${W} ${D}/>`;
  }
  if (front) {
    s += `<circle cx="${cx}" cy="${cy}" r="50" ${D}/><circle cx="${cx}" cy="${cy}" r="38" ${D}/>`;
    for (let k = 0; k < 18; k++) { const [x, y] = P(cx, cy, 44, k * 20 + 10); s += `<circle cx="${x}" cy="${y}" r="1.7" ${D}/>`; }
  } else {
    s += `<circle cx="${cx}" cy="${cy}" r="34" ${W} ${D}/>`; // couronne
    for (let k = 0; k < 36; k++) { const [x1, y1] = P(cx, cy, 31, k * 10), [x2, y2] = P(cx, cy, 34, k * 10 + 5); s += `<path d="M${x1} ${y1} L${x2} ${y2}" stroke-width="1"/>`; }
  }
  s += `<circle cx="${cx}" cy="${cy}" r="17" ${W}/><circle cx="${cx}" cy="${cy}" r="7" ${D}/>`;
  return s;
}

// Profil gauche, avant à gauche. Repère 620×380, sol y=370.
function side() {
  const FX = 142, RX = 482, Y = 286;
  let s = '';
  // ── Plan arrière ────────────────────────────────────────────
  s += wheel(RX, Y, { front: false });
  // Garde-boue arrière court
  s += `<path d="M${RX - 70} ${Y - 56} A90 90 0 0 1 ${RX - 4} ${Y - 90} L${RX - 4} ${Y - 82} A82 82 0 0 0 ${RX - 63} ${Y - 51} Z" ${W}/>`;
  // Chaîne
  s += `<path d="M372 244 L${RX - 2} ${Y - 34} M372 266 L${RX - 2} ${Y + 34}" ${D}/>`;
  // Amortisseur : corps + ressort
  s += `<g transform="rotate(-18 406 206)"><rect x="400" y="168" width="12" height="76" rx="4" ${W}/>`;
  for (let y = 182; y <= 226; y += 6) s += `<path d="M397 ${y} L415 ${y + 3}" ${D}/>`;
  s += `<circle cx="406" cy="172" r="4" ${W} ${D}/><circle cx="406" cy="240" r="4" ${W} ${D}/></g>`;
  // Boucle arrière (cadre sous la selle) + platine de cadre
  s += `<path d="M362 150 L380 214 M440 150 L386 212" stroke-width="3"/>`;
  s += `<path d="M352 152 Q374 150 378 168 L386 230 Q376 246 358 242 Q364 200 352 152 Z" ${W}/>`;
  s += `<circle cx="372" cy="176" r="3" ${D}/>`;
  // Bras oscillant (caisson effilé)
  s += `<path d="M362 220 Q420 244 ${RX} ${Y - 10} L${RX + 4} ${Y + 8} Q420 264 358 246 Z" ${W}/>`;
  s += `<path d="M380 238 Q428 254 ${RX - 20} ${Y}" ${D}/>`;
  s += `<rect x="${RX - 8}" y="${Y - 6}" width="18" height="12" rx="3" ${W} ${D}/>`;
  s += `<circle cx="366" cy="233" r="10" ${W}/><circle cx="366" cy="233" r="4" ${D}/>`;
  // ── Moteur bicylindre ───────────────────────────────────────
  // Cylindre + culasse inclinés vers l'avant
  s += `<path d="M262 206 L252 158 Q254 150 262 149 L330 146 Q338 146 338 154 L344 200 Z" ${W}/>`;
  for (let y = 160; y <= 192; y += 8) s += `<path d="M${258 + (y - 158) * 0.2} ${y} L${338 + (y - 158) * 0.13} ${y - 2}" ${D}/>`;
  // Carter
  s += `<path d="M244 206 L372 200 Q384 202 384 216 L380 250 Q376 272 354 278 L284 284 Q256 284 246 262 Z" ${W}/>`;
  s += `<circle cx="318" cy="244" r="26" ${D}/><circle cx="318" cy="244" r="17" ${D}/>`;
  s += `<path d="M340 214 Q364 212 372 226 Q376 244 360 252" ${D}/>`; // couvercle pignon
  s += `<circle cx="366" cy="232" r="4" ${D}/>`;
  // Échappement : collecteur sous le moteur + silencieux court
  s += `<path d="M258 196 C236 214 238 262 262 286 C276 300 300 304 322 302" stroke-width="9" stroke="#111"/>`;
  s += `<path d="M258 196 C236 214 238 262 262 286 C276 300 300 304 322 302" stroke-width="5.4" stroke="#fff"/>`;
  s += `<path d="M316 290 L372 286 Q384 286 384 298 L383 306 Q382 316 370 316 L320 318 Q310 318 310 308 L310 298 Q310 290 316 290 Z" ${W}/>`;
  s += `<path d="M364 288 L362 315" ${D}/><ellipse cx="384" cy="302" rx="3" ry="9" ${D}/>`;
  // Repose-pieds + platine + sélecteur
  s += `<path d="M360 252 Q372 262 386 262 L392 270 L360 272 Z" ${W} ${D}/>`;
  s += `<rect x="370" y="264" width="30" height="7" rx="3.5" ${W}/>`;
  s += `<path d="M348 268 L318 282" stroke-width="2.2"/><rect x="310" y="279" width="12" height="6" rx="3" ${W} ${D}/>`;
  // ── Partie cycle haute ──────────────────────────────────────
  // Boucle arrière + coque
  s += `<path d="M446 150 L490 138" stroke-width="3"/>`;
  s += `<path d="M436 128 Q500 110 572 98 Q582 98 578 108 Q548 132 496 148 L444 154 Z" ${W}/>`;
  s += `<path d="M470 132 Q520 120 560 108" ${D}/>`;
  s += `<path d="M566 100 L582 97 Q586 104 580 110 L568 112 Z" ${W} ${D}/>`; // feu
  // Support de plaque + clignotant + plaque
  s += `<path d="M504 146 Q528 158 540 188 L532 192 Q522 166 498 154 Z" ${W}/>`;
  s += `<path d="M522 162 L540 160 L541 167 L524 169" ${W} ${D}/>`;
  s += `<rect x="520" y="188" width="36" height="24" rx="2" transform="rotate(12 538 200)" ${W}/>`;
  // Selle (monobloc à deux niveaux)
  s += `<path d="M346 118 Q384 128 426 130 Q446 128 462 118 Q480 110 490 114 Q494 122 486 130 Q454 150 404 152 L362 150 Q346 146 342 132 Z" ${W}/>`;
  s += `<path d="M426 130 Q434 140 432 150" ${D}/>`;
  // Réservoir sculpté + écope de radiateur
  s += `<path d="M226 128 Q238 100 282 92 Q330 86 354 104 Q366 116 364 138 Q360 154 342 158 L250 162 Q228 158 226 128 Z" ${W}/>`;
  s += `<path d="M250 112 Q298 100 348 112" ${D}/><path d="M258 146 Q300 142 340 148" ${D}/>`;
  s += `<rect x="298" y="89" width="26" height="7" rx="3.5" ${W} ${D}/>`;
  // Écope (carénage de radiateur)
  s += `<path d="M226 150 L270 158 L262 204 Q250 214 236 206 L222 176 Q220 158 226 150 Z" ${W}/>`;
  s += `<path d="M232 170 L262 174 M234 184 L258 188" ${D}/>`;
  // ── Plan avant ──────────────────────────────────────────────
  s += wheel(FX, Y, { front: true });
  // Garde-boue avant
  s += `<path d="M82 226 Q110 196 150 198 Q182 200 200 222 L192 228 Q176 210 150 208 Q114 206 90 232 Z" ${W}/>`;
  // Fourche inversée : fourreau haut (gros) + tube bas (fin)
  const ang = Math.atan2(286 - 118, 142 - 216); // direction axe → té
  const ux = Math.cos(ang), uy = Math.sin(ang), nx = -uy, ny = ux;
  const pt = (t, off) => [r1(FX + (216 - FX) * t + nx * off), r1(Y + (118 - Y) * t + ny * off)];
  const quad = (t1, t2, w) => { const a = pt(t1, -w), b = pt(t2, -w), c = pt(t2, w), d = pt(t1, w); return `M${a[0]} ${a[1]} L${b[0]} ${b[1]} L${c[0]} ${c[1]} L${d[0]} ${d[1]} Z`; };
  s += `<path d="${quad(0.02, 0.5, 5)}" ${W}/>`;
  s += `<path d="${quad(0.42, 1.0, 9)}" ${W}/>`;
  s += `<path d="${quad(0.0, 0.12, 10)}" ${W}/>`; // pied de fourche
  // Étrier avant (radial) sur le disque
  s += `<path d="M168 232 Q184 238 190 254 L178 260 Q174 248 162 242 Z" ${W}/>`;
  // Tés + colonne
  s += `<path d="M204 124 L236 114 L240 126 L208 136 Z" ${W}/>`;
  s += `<path d="M210 106 L240 96 L243 106 L213 116 Z" ${W}/>`;
  // Phare compact + saute-vent
  s += `<path d="M204 124 Q176 126 170 150 Q170 170 188 174 L206 170 Z" ${W}/>`;
  s += `<path d="M180 150 Q182 160 192 164" ${D}/>`;
  s += `<path d="M198 124 L214 102 L222 108 L208 128" ${W} ${D}/>`;
  s += `<path d="M200 160 L182 166 L184 172 L202 168" ${W} ${D}/>`; // clignotant
  // Tableau de bord TFT
  s += `<rect x="214" y="90" width="24" height="16" rx="4" transform="rotate(-16 226 98)" ${W}/>`;
  // Guidon conique + poignée + levier
  s += `<path d="M236 100 Q246 86 256 80 L280 78" stroke-width="3.6"/>`;
  s += `<rect x="270" y="72" width="26" height="12" rx="5" ${W}/>`;
  s += `<path d="M258 82 Q274 74 292 78" stroke-width="1.8"/>`;
  // Rétroviseur
  s += `<path d="M252 84 Q248 66 240 54" stroke-width="2.2"/>`;
  s += `<path d="M218 44 Q228 32 250 36 Q262 40 256 50 Q244 58 226 54 Q214 50 218 44 Z" ${W}/>`;
  return s;
}

const style = 'fill="none" stroke="#111" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"';
// Parties symétriques : dessinées à gauche puis reflétées autour de x=130.
const sym = (inner) => `${inner}<g transform="translate(260 0) scale(-1 1)">${inner}</g>`;

function bars() {
  return sym(
    `<path d="M76 88 Q64 70 56 54" stroke-width="2.2"/>` +
    `<path d="M30 44 Q34 30 54 30 Q74 32 74 44 Q72 56 52 56 Q30 56 30 44 Z" ${W}/>` +
    `<path d="M130 84 Q90 84 44 92" stroke-width="3.6"/>` +
    `<rect x="12" y="86" width="32" height="13" rx="5" ${W}/>` +
    `<path d="M46 98 Q30 106 14 106" stroke-width="2"/>`,
  );
}

function front() {
  let s = bars();
  s += `<path d="M72 122 Q130 100 188 122 L182 150 L78 150 Z" ${W}/>`;              // épaules du réservoir
  s += `<rect x="110" y="94" width="40" height="20" rx="5" ${W}/>`;                   // TFT
  s += sym(`<path d="M58 150 L96 150 L98 212 L72 216 Q56 196 58 150 Z" ${W}/><path d="M66 172 L94 174 M68 190 L94 192" ${D}/>`); // écopes
  s += `<rect x="96" y="150" width="68" height="64" rx="4" ${W}/>`;
  for (let y = 160; y <= 206; y += 6) s += `<path d="M100 ${y} L160 ${y}" stroke-width="1"/>`;
  s += `<path d="M74 214 L186 214 L192 262 Q186 282 164 286 L96 286 Q74 282 68 262 Z" ${W}/>`; // carters
  s += sym(`<circle cx="86" cy="248" r="14" ${D}/>`);
  s += sym(`<path d="M68 290 L40 294" stroke-width="5"/>`);                           // repose-pieds
  s += `<rect x="114" y="214" width="32" height="156" rx="15" ${W}/><path d="M130 222 L130 364" stroke-width="1"/>`; // pneu
  s += sym(`<rect x="96" y="118" width="15" height="120" rx="5" ${W}/><rect x="99" y="236" width="9" height="62" rx="3" ${W}/><rect x="86" y="266" width="12" height="28" rx="3" ${W}/>`); // fourche + étriers
  s += `<path d="M104 238 Q130 218 156 238 L154 262 Q130 250 106 262 Z" ${W}/>`;     // garde-boue
  s += `<rect x="88" y="110" width="84" height="14" rx="5" ${W}/>`;                   // té
  s += `<path d="M110 128 Q130 114 150 128 L146 136 L114 136 Z" ${W}/>`;              // saute-vent
  s += `<circle cx="130" cy="158" r="28" ${W}/><circle cx="130" cy="158" r="20" ${D}/><path d="M112 150 Q130 138 148 150" ${D}/>`; // phare
  s += sym(`<path d="M104 166 L78 170 L78 178 L104 174" ${W} ${D}/>`);                // clignotants
  return s;
}

function rear() {
  let s = bars();
  s += `<path d="M72 118 Q130 98 188 118 L182 146 L78 146 Z" ${W}/>`;
  s += `<path d="M74 200 L186 200 L194 250 L170 280 L90 280 L66 250 Z" ${W}/>`;
  s += `<path d="M164 282 L196 282 Q204 282 204 292 L204 300 Q204 308 196 308 L166 308 Z" ${W}/><ellipse cx="196" cy="295" rx="6" ry="8" ${D}/>`; // silencieux
  s += sym(`<path d="M86 256 L104 276" stroke-width="3.2"/><path d="M84 262 L58 266" stroke-width="5"/>`); // bras + repose-pieds passager
  s += `<rect x="100" y="228" width="60" height="142" rx="22" ${W}/><path d="M112 238 L112 360 M148 238 L148 360" stroke-width="1"/>`;
  s += `<path d="M98 236 Q130 214 162 236 L160 250 Q130 236 100 250 Z" ${W}/>`;     // lèche-roue
  s += `<path d="M86 134 Q130 116 174 134 L168 152 L92 152 Z" ${W}/>`;               // selle
  s += `<path d="M92 152 L168 152 L156 184 L104 184 Z" ${W}/>`;                       // coque
  s += `<rect x="108" y="160" width="44" height="12" rx="4" ${W}/><path d="M114 166 L146 166" stroke-width="1"/>`; // feu
  s += `<rect x="124" y="184" width="12" height="22" ${W}/>`;
  s += sym(`<path d="M106 192 L80 196 L80 204 L106 200" ${W} ${D}/>`);
  s += `<rect x="98" y="206" width="64" height="32" rx="3" ${W}/><rect x="103" y="211" width="54" height="22" rx="2" ${D}/>`; // plaque
  return s;
}

// Dessus : avant à gauche, axe y=110. Côté droit de la moto en haut.
function top() {
  const m = (inner) => `${inner}<g transform="translate(0 220) scale(1 -1)">${inner}</g>`; // symétrie haut/bas
  let s = '';
  s += `<rect x="40" y="98" width="170" height="24" rx="11" ${W}/>`;                 // pneu avant
  s += `<rect x="402" y="94" width="170" height="32" rx="14" ${W}/>`;                // pneu arrière
  s += m(`<path d="M376 86 L488 96" stroke-width="3.4"/>`);                           // bras oscillant
  s += `<path d="M318 44 L392 46 Q404 48 404 56 Q404 64 392 66 L318 66 Z" ${W}/><ellipse cx="404" cy="56" rx="3" ry="8" ${D}/>`; // silencieux (côté droit)
  s += m(`<rect x="376" y="42" width="8" height="24" rx="4" ${W}/><rect x="440" y="52" width="7" height="20" rx="3.5" ${W}/>`); // repose-pieds
  s += `<rect x="246" y="62" width="138" height="96" rx="18" ${W}/>`;                 // carters
  s += `<path d="M462 82 Q524 90 582 104 Q588 110 582 116 Q524 130 462 138 Z" ${W}/>`; // coque arrière
  s += `<rect x="576" y="100" width="10" height="20" rx="4" ${W} ${D}/>`;
  s += `<path d="M356 80 Q416 74 470 86 L470 134 Q416 146 356 140 Q344 110 356 80 Z" ${W}/>`; // selle
  s += `<path d="M436 80 L436 140" ${D}/>`;
  s += m(`<path d="M242 72 L276 64 L280 80 L246 86 Z" ${W}/>`);                         // écopes
  s += `<path d="M242 84 Q270 56 314 58 Q360 62 370 90 Q374 110 370 130 Q360 158 314 162 Q270 164 242 136 Q232 110 242 84 Z" ${W}/>`; // réservoir
  s += `<path d="M268 82 Q314 70 354 88 M268 138 Q314 150 354 132" ${D}/>`;
  s += `<ellipse cx="310" cy="110" rx="11" ry="9" ${D}/>`;
  s += `<rect x="56" y="100" width="128" height="20" rx="9" ${W}/>`;                  // garde-boue
  s += m(`<rect x="156" y="90" width="44" height="9" rx="4" ${W}/>`);                 // fourreaux
  s += `<path d="M180 94 L160 96 Q152 110 160 124 L180 126 Z" ${W}/>`;                // phare
  s += `<rect x="190" y="84" width="20" height="52" rx="5" ${W}/>`;                   // té
  s += `<rect x="212" y="100" width="18" height="20" rx="4" ${W} ${D}/>`;             // TFT
  s += m(`<path d="M204 100 Q216 60 228 14" stroke-width="3.6"/><rect x="220" y="0" width="14" height="28" rx="5" transform="rotate(14 227 14)" ${W}/><path d="M218 26 Q208 20 198 18" stroke-width="2"/>`); // guidon
  s += m(`<path d="M214 52 Q204 44 196 38" stroke-width="2.2"/><ellipse cx="188" cy="34" rx="9" ry="15" transform="rotate(-20 188 34)" ${W}/>`); // rétros
  return s;
}

const planche =
  `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="900" viewBox="0 0 1400 900"><rect width="1400" height="900" fill="#fff"/>` +
  `<g ${style}>` +
  `<g transform="translate(20 30)">${side()}</g>` +
  `<g transform="translate(640 470) scale(-1 1)">${side()}</g>` +
  `<g transform="translate(740 30)">${front()}</g>` +
  `<g transform="translate(1080 30)">${rear()}</g>` +
  `<g transform="translate(740 550)">${top()}</g>` +
  `</g></svg>`;
fs.writeFileSync('planche2.svg', planche);
console.log('ok');
