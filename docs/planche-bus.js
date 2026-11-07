// Génère la planche « bus / autocar » (même gabarit que la planche utilitaire).
const fs = require('fs');
const W = 1491, H = 1055;
const S = 2.4, s = 1.4; // épaisseurs de trait
const o = []; // éléments
const A = (x) => o.push(x);
const R = (x, y, w, h, r = 4, sw = s, extra = '') => A(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" ry="${r}" stroke-width="${sw}" ${extra}/>`);
const L = (x1, y1, x2, y2, sw = s, extra = '') => A(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke-width="${sw}" ${extra}/>`);
const P = (d, sw = s, extra = '') => A(`<path d="${d}" stroke-width="${sw}" ${extra}/>`);
const C = (cx, cy, r, sw = s, extra = '') => A(`<circle cx="${cx}" cy="${cy}" r="${r}" stroke-width="${sw}" ${extra}/>`);

// ───────── Profil (avant à gauche = côté gauche conducteur) ─────────
function profile(ox, oy, mirrored) {
  // Corps 560 × 170 ; côté droit (mirrored) = côté des portes.
  const doors = mirrored;
  const g = [];
  const t = (x) => (mirrored ? ox + 560 - (x - ox) : x);
  const pushR = (x, y, w, h, r = 3, sw = s, extra = '') => g.push(`<rect x="${mirrored ? t(x) - w : x}" y="${y}" width="${w}" height="${h}" rx="${r}" stroke-width="${sw}" ${extra}/>`);
  const pushL = (x1, y1, x2, y2, sw = s) => g.push(`<line x1="${t(x1)}" y1="${y1}" x2="${t(x2)}" y2="${y2}" stroke-width="${sw}"/>`);
  const x0 = ox, x1 = ox + 560, y0 = oy, y1 = oy + 170;
  g.push(`<path d="M${t(x0 + 46)} ${y0} H${t(x1 - 14)} Q${t(x1)} ${y0} ${t(x1)} ${y0 + 14} V${y1 - 10} Q${t(x1)} ${y1} ${t(x1 - 10)} ${y1} H${t(x0 + 10)} Q${t(x0)} ${y1} ${t(x0)} ${y1 - 10} V${y0 + 60} Q${t(x0)} ${y0 + 4} ${t(x0 + 46)} ${y0} Z" stroke-width="${S}"/>`);
  // Pare-brise vu de profil
  g.push(`<path d="M${t(x0 + 8)} ${y0 + 56} Q${t(x0 + 10)} ${y0 + 14} ${t(x0 + 48)} ${y0 + 9} V${y0 + 96} H${t(x0 + 9)} Z" stroke-width="${s}"/>`);
  const vy0 = y0 + 28, vy1 = y0 + 92;
  if (doors) {
    // Porte avant (double vantail vitré, pleine hauteur)
    pushR(x0 + 54, y0 + 16, 50, 150, 4, s);
    pushL(x0 + 79, y0 + 16, x0 + 79, y1 - 4);
    g.push(`<rect x="${mirrored ? t(x0 + 58) - 42 : x0 + 58}" y="${vy0}" width="42" height="${vy1 - vy0}" rx="3" stroke-width="${s * 0.8}"/>`);
    // Vitrage entre les deux portes
    pushR(x0 + 110, vy0, 306, vy1 - vy0, 4, s);
    for (const px of [x0 + 186, x0 + 262, x0 + 338]) pushL(px, vy0, px, vy1);
    // Porte médiane
    pushR(x0 + 422, y0 + 16, 48, 150, 4, s);
    pushL(x0 + 446, y0 + 16, x0 + 446, y1 - 4);
    g.push(`<rect x="${mirrored ? t(x0 + 426) - 40 : x0 + 426}" y="${vy0}" width="40" height="${vy1 - vy0}" rx="3" stroke-width="${s * 0.8}"/>`);
    // Vitrage arrière
    pushR(x0 + 476, vy0, 70, vy1 - vy0, 4, s);
  } else {
    // Vitre conducteur puis bandeau continu
    pushR(x0 + 54, vy0, 50, vy1 - vy0, 4, s);
    pushR(x0 + 110, vy0, 436, vy1 - vy0, 4, s);
    for (const px of [x0 + 186, x0 + 262, x0 + 338, x0 + 414, x0 + 470]) pushL(px, vy0, px, vy1);
  }
  // Soutes à bagages (deux trappes) entre les essieux
  pushR(x0 + 206, y0 + 106, 100, 52, 4, s);
  pushR(x0 + 314, y0 + 106, 100, 52, 4, s);
  g.push(`<rect x="${mirrored ? t(x0 + 246) - 20 : x0 + 246}" y="${y0 + 128}" width="20" height="5" rx="2" stroke-width="${s * 0.8}"/>`);
  g.push(`<rect x="${mirrored ? t(x0 + 354) - 20 : x0 + 354}" y="${y0 + 128}" width="20" height="5" rx="2" stroke-width="${s * 0.8}"/>`);
  // Ligne de bas de caisse
  pushL(x0 + 4, y1 - 12, x1 - 4, y1 - 12, s * 0.8);
  // Climatisation sur le toit
  g.push(`<rect x="${mirrored ? t(x0 + 230) - 120 : x0 + 230}" y="${y0 - 9}" width="120" height="9" rx="3" stroke-width="${s}"/>`);
  // Rétroviseur
  g.push(`<path d="M${t(x0 + 2)} ${y0 + 34} L${t(x0 - 14)} ${y0 + 26}" stroke-width="${s}"/>`);
  g.push(`<rect x="${mirrored ? t(x0 - 14) - 8 : x0 - 22}" y="${y0 + 20}" width="8" height="26" rx="3" stroke-width="${s}"/>`);
  // Roues
  for (const cx of [x0 + 150, x0 + 512]) {
    const cxx = t(cx);
    g.push(`<path d="M${cxx - 44} ${y1} A44 44 0 0 1 ${cxx + 44} ${y1}" stroke-width="${s}"/>`);
    g.push(`<circle cx="${cxx}" cy="${y1 + 2}" r="36" stroke-width="${S}" fill="#fff"/>`);
    g.push(`<circle cx="${cxx}" cy="${y1 + 2}" r="20" stroke-width="${s}"/>`);
    g.push(`<circle cx="${cxx}" cy="${y1 + 2}" r="5" stroke-width="${s}"/>`);
  }
  return g.join('\n');
}

// ───────── Face avant / arrière ─────────
function face(ox, oy, rear) {
  const g = [];
  const w = 220, h = 300;
  const x0 = ox, x1 = ox + w, y0 = oy, y1 = oy + h;
  g.push(`<path d="M${x0 + 18} ${y0} H${x1 - 18} Q${x1} ${y0} ${x1} ${y0 + 18} V${y1 - 8} Q${x1} ${y1} ${x1 - 8} ${y1} H${x0 + 8} Q${x0} ${y1} ${x0} ${y1 - 8} V${y0 + 18} Q${x0} ${y0} ${x0 + 18} ${y0} Z" stroke-width="${S}"/>`);
  if (!rear) {
    // Afficheur de destination
    g.push(`<rect x="${x0 + 22}" y="${y0 + 10}" width="${w - 44}" height="18" rx="3" stroke-width="${s}"/>`);
    // Pare-brise panoramique
    g.push(`<path d="M${x0 + 12} ${y0 + 36} H${x1 - 12} V${y0 + 158} Q${x1 - 12} ${y0 + 168} ${x1 - 22} ${y0 + 168} H${x0 + 22} Q${x0 + 12} ${y0 + 168} ${x0 + 12} ${y0 + 158} Z" stroke-width="${s}"/>`);
    // Essuie-glaces
    g.push(`<path d="M${x0 + 60} ${y0 + 164} L${x0 + 96} ${y0 + 72}" stroke-width="${s}"/>`);
    g.push(`<path d="M${x0 + 130} ${y0 + 164} L${x0 + 166} ${y0 + 72}" stroke-width="${s}"/>`);
    // Rétroviseurs à bras
    g.push(`<path d="M${x0 + 2} ${y0 + 44} L${x0 - 22} ${y0 + 44} V${y0 + 70}" stroke-width="${s}"/>`);
    g.push(`<rect x="${x0 - 36}" y="${y0 + 62}" width="22" height="46" rx="5" stroke-width="${s}"/>`);
    g.push(`<path d="M${x1 - 2} ${y0 + 44} L${x1 + 22} ${y0 + 44} V${y0 + 70}" stroke-width="${s}"/>`);
    g.push(`<rect x="${x1 + 14}" y="${y0 + 62}" width="22" height="46" rx="5" stroke-width="${s}"/>`);
    // Ligne de ceinture + logo
    g.push(`<line x1="${x0 + 4}" y1="${y0 + 184}" x2="${x1 - 4}" y2="${y0 + 184}" stroke-width="${s * 0.8}"/>`);
    g.push(`<circle cx="${x0 + w / 2}" cy="${y0 + 205}" r="9" stroke-width="${s}"/>`);
    // Phares
    g.push(`<path d="M${x0 + 12} ${y0 + 232} H${x0 + 70} Q${x0 + 78} ${y0 + 232} ${x0 + 78} ${y0 + 240} V${y0 + 254} Q${x0 + 78} ${y0 + 262} ${x0 + 70} ${y0 + 262} H${x0 + 12} Z" stroke-width="${s}"/>`);
    g.push(`<path d="M${x1 - 12} ${y0 + 232} H${x1 - 70} Q${x1 - 78} ${y0 + 232} ${x1 - 78} ${y0 + 240} V${y0 + 254} Q${x1 - 78} ${y0 + 262} ${x1 - 70} ${y0 + 262} H${x1 - 12} Z" stroke-width="${s}"/>`);
    g.push(`<circle cx="${x0 + 30}" cy="${y0 + 247}" r="8" stroke-width="${s * 0.8}"/>`);
    g.push(`<circle cx="${x1 - 30}" cy="${y0 + 247}" r="8" stroke-width="${s * 0.8}"/>`);
    // Calandre
    g.push(`<rect x="${x0 + 86}" y="${y0 + 236}" width="48" height="22" rx="3" stroke-width="${s}"/>`);
    for (let i = 1; i < 4; i++) g.push(`<line x1="${x0 + 86}" y1="${y0 + 236 + i * 5.5}" x2="${x0 + 134}" y2="${y0 + 236 + i * 5.5}" stroke-width="${s * 0.6}"/>`);
  } else {
    // Lunette arrière
    g.push(`<path d="M${x0 + 16} ${y0 + 24} H${x1 - 16} V${y0 + 112} Q${x1 - 16} ${y0 + 120} ${x1 - 24} ${y0 + 120} H${x0 + 24} Q${x0 + 16} ${y0 + 120} ${x0 + 16} ${y0 + 112} Z" stroke-width="${s}"/>`);
    // Feux de gabarit hauts
    g.push(`<rect x="${x0 + 10}" y="${y0 + 8}" width="16" height="6" rx="2" stroke-width="${s * 0.8}"/>`);
    g.push(`<rect x="${x1 - 26}" y="${y0 + 8}" width="16" height="6" rx="2" stroke-width="${s * 0.8}"/>`);
    // Trappe moteur avec grille
    g.push(`<rect x="${x0 + 30}" y="${y0 + 140}" width="${w - 60}" height="96" rx="4" stroke-width="${s}"/>`);
    for (let i = 1; i < 6; i++) g.push(`<line x1="${x0 + 44}" y1="${y0 + 140 + i * 16}" x2="${x1 - 44}" y2="${y0 + 140 + i * 16}" stroke-width="${s * 0.6}"/>`);
    // Feux arrière verticaux
    g.push(`<rect x="${x0 + 8}" y="${y0 + 150}" width="16" height="86" rx="4" stroke-width="${s}"/>`);
    g.push(`<rect x="${x1 - 24}" y="${y0 + 150}" width="16" height="86" rx="4" stroke-width="${s}"/>`);
    for (const yy of [y0 + 178, y0 + 206]) { g.push(`<line x1="${x0 + 8}" y1="${yy}" x2="${x0 + 24}" y2="${yy}" stroke-width="${s * 0.7}"/>`); g.push(`<line x1="${x1 - 24}" y1="${yy}" x2="${x1 - 8}" y2="${yy}" stroke-width="${s * 0.7}"/>`); }
    // Plaque
    g.push(`<rect x="${x0 + 80}" y="${y0 + 250}" width="60" height="16" rx="2" stroke-width="${s}"/>`);
  }
  // Pare-chocs
  g.push(`<line x1="${x0 + 2}" y1="${y0 + 272}" x2="${x1 - 2}" y2="${y0 + 272}" stroke-width="${s}"/>`);
  if (!rear) g.push(`<rect x="${x0 + 80}" y="${y0 + 278}" width="60" height="14" rx="2" stroke-width="${s}"/>`);
  // Roues
  for (const [a, b] of [[x0 + 22, x0 + 62], [x1 - 62, x1 - 22]]) g.push(`<rect x="${a}" y="${y1}" width="${b - a}" height="22" rx="4" stroke-width="${S}" fill="#fff"/>`);
  return g.join('\n');
}

// ───────── Vue de dessus (avant en haut) ─────────
function top(ox, oy, interior) {
  const g = [];
  const w = 150, h = 590;
  const x0 = ox, x1 = ox + w, y0 = oy, y1 = oy + h;
  g.push(`<path d="M${x0 + 30} ${y0} H${x1 - 30} Q${x1} ${y0} ${x1} ${y0 + 30} V${y1 - 10} Q${x1} ${y1} ${x1 - 10} ${y1} H${x0 + 10} Q${x0} ${y1} ${x0} ${y1 - 10} V${y0 + 30} Q${x0} ${y0} ${x0 + 30} ${y0} Z" stroke-width="${S}"/>`);
  // Rétroviseurs
  g.push(`<path d="M${x0} ${y0 + 44} L${x0 - 22} ${y0 + 38}" stroke-width="${s}"/>`);
  g.push(`<rect x="${x0 - 30}" y="${y0 + 32}" width="10" height="20" rx="3" stroke-width="${s}"/>`);
  g.push(`<path d="M${x1} ${y0 + 44} L${x1 + 22} ${y0 + 38}" stroke-width="${s}"/>`);
  g.push(`<rect x="${x1 + 20}" y="${y0 + 32}" width="10" height="20" rx="3" stroke-width="${s}"/>`);
  if (!interior) {
    // Pare-brise (bord de toit avant)
    g.push(`<path d="M${x0 + 6} ${y0 + 28} Q${x0 + 75} ${y0 + 8} ${x1 - 6} ${y0 + 28}" stroke-width="${s}"/>`);
    g.push(`<path d="M${x0 + 6} ${y0 + 40} Q${x0 + 75} ${y0 + 24} ${x1 - 6} ${y0 + 40}" stroke-width="${s * 0.8}"/>`);
    // Panneau de toit
    g.push(`<rect x="${x0 + 10}" y="${y0 + 52}" width="${w - 20}" height="${h - 72}" rx="6" stroke-width="${s * 0.8}"/>`);
    // Trappes d'évacuation
    g.push(`<rect x="${x0 + 40}" y="${y0 + 120}" width="70" height="46" rx="4" stroke-width="${s}"/>`);
    g.push(`<rect x="${x0 + 40}" y="${y0 + 400}" width="70" height="46" rx="4" stroke-width="${s}"/>`);
    // Bloc de climatisation
    g.push(`<rect x="${x0 + 24}" y="${y0 + 210}" width="102" height="150" rx="6" stroke-width="${s}"/>`);
    for (let i = 1; i < 6; i++) g.push(`<line x1="${x0 + 34}" y1="${y0 + 210 + i * 25}" x2="${x1 - 34}" y2="${y0 + 210 + i * 25}" stroke-width="${s * 0.6}"/>`);
    // Vitre arrière (bord)
    g.push(`<line x1="${x0 + 10}" y1="${y1 - 20}" x2="${x1 - 10}" y2="${y1 - 20}" stroke-width="${s * 0.8}"/>`);
  } else {
    // Pare-brise + tableau de bord
    g.push(`<path d="M${x0 + 6} ${y0 + 30} Q${x0 + 75} ${y0 + 10} ${x1 - 6} ${y0 + 30}" stroke-width="${s}"/>`);
    g.push(`<path d="M${x0 + 10} ${y0 + 54} Q${x0 + 75} ${y0 + 36} ${x1 - 10} ${y0 + 54}" stroke-width="${s * 0.8}"/>`);
    // Volant (conducteur à gauche) + siège conducteur
    g.push(`<circle cx="${x0 + 36}" cy="${y0 + 64}" r="12" stroke-width="${s}"/>`);
    g.push(`<circle cx="${x0 + 36}" cy="${y0 + 64}" r="3" stroke-width="${s * 0.8}"/>`);
    g.push(`<rect x="${x0 + 20}" y="${y0 + 80}" width="32" height="30" rx="6" stroke-width="${s}"/>`);
    g.push(`<rect x="${x0 + 22}" y="${y0 + 80}" width="28" height="8" rx="3" stroke-width="${s * 0.8}"/>`);
    // Porte avant (côté droit, en haut) : ouverture dans la paroi
    g.push(`<line x1="${x1}" y1="${y0 + 58}" x2="${x1}" y2="${y0 + 108}" stroke-width="${S + 2}" stroke="#fff"/>`);
    g.push(`<path d="M${x1} ${y0 + 58} L${x1 + 10} ${y0 + 58} M${x1} ${y0 + 108} L${x1 + 10} ${y0 + 108}" stroke-width="${s}"/>`);
    g.push(`<path d="M${x1 - 2} ${y0 + 58} A50 50 0 0 1 ${x1 - 2} ${y0 + 108}" stroke-width="${s * 0.6}" stroke-dasharray="3 3"/>`);
    // Porte médiane (côté droit)
    const md0 = y0 + 318, md1 = y0 + 362;
    g.push(`<line x1="${x1}" y1="${md0}" x2="${x1}" y2="${md1}" stroke-width="${S + 2}" stroke="#fff"/>`);
    g.push(`<path d="M${x1} ${md0} L${x1 + 10} ${md0} M${x1} ${md1} L${x1 + 10} ${md1}" stroke-width="${s}"/>`);
    g.push(`<path d="M${x1 - 2} ${md0} A44 44 0 0 1 ${x1 - 2} ${md1}" stroke-width="${s * 0.6}" stroke-dasharray="3 3"/>`);
    // Sièges 2+2 : aile gauche x0+10..x0+64, allée, aile droite x1-64..x1-10
    const seat = (sx, sy) => {
      g.push(`<rect x="${sx}" y="${sy}" width="26" height="24" rx="5" stroke-width="${s * 0.9}"/>`);
      g.push(`<rect x="${sx + 1.5}" y="${sy}" width="23" height="7" rx="3" stroke-width="${s * 0.7}"/>`);
    };
    let y = y0 + 122;
    const rowStep = 32;
    while (y + 24 < y1 - 40) {
      seat(x0 + 12, y); seat(x0 + 40, y);
      const skipRight = y + 24 > md0 - 4 && y < md1 + 4; // place de la porte médiane
      if (!skipRight) { seat(x1 - 66, y); seat(x1 - 38, y); }
      y += rowStep;
    }
    // Banquette arrière 5 places
    for (let i = 0; i < 5; i++) seat(x0 + 12 + i * 25.5, y1 - 34);
    // Allée
    g.push(`<line x1="${x0 + 75}" y1="${y0 + 118}" x2="${x0 + 75}" y2="${y1 - 40}" stroke-width="${s * 0.5}" stroke-dasharray="4 5"/>`);
  }
  return g.join('\n');
}

const svg = [];
svg.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`);
svg.push(`<rect width="${W}" height="${H}" fill="#fff"/>`);
svg.push(`<g fill="none" stroke="#161616" stroke-linecap="round" stroke-linejoin="round">`);
svg.push(face(90, 105, false));
svg.push(face(90, 470, true));
svg.push(profile(400, 165, false));
svg.push(profile(400, 500, true));
svg.push(top(1025, 120, false));
svg.push(top(1268, 120, true));
svg.push(`</g>`);
// Légendes discrètes
const cap = (x, y, t) => svg.push(`<text x="${x}" y="${y}" font-family="Arial, Helvetica, sans-serif" font-size="13" font-weight="700" fill="#444" text-anchor="middle">${t}</text>`);
cap(200, 84, 'FACE AVANT'); cap(200, 447, 'FACE ARRIÈRE');
cap(680, 132, 'CÔTÉ GAUCHE (CONDUCTEUR)'); cap(680, 468, 'CÔTÉ DROIT (PORTES)');
cap(1100, 98, 'TOIT'); cap(1343, 98, 'INTÉRIEUR');
// Observations
svg.push(`<text x="75" y="830" font-family="Arial, Helvetica, sans-serif" font-size="15" font-weight="700" fill="#111">OBSERVATIONS :</text>`);
for (const y of [826, 888, 950]) svg.push(`<line x1="${y === 826 ? 255 : 75}" y1="${y}" x2="1412" y2="${y}" stroke="#444" stroke-width="1.2" stroke-dasharray="1.5 4"/>`);
svg.push(`</svg>`);
fs.writeFileSync('bus.svg', svg.join('\n'));
console.log('ok');
