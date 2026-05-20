// tokens.jsx — Axis design system: tokens, theme, primitives, logo, icons.

// ─── Theme ──────────────────────────────────────────────────────────────────
const AXIS_LIGHT = {
  name: 'light',
  bg:        '#F5F1E8',   // ivoire
  bgSoft:    '#EDE7D6',
  surface:   '#FFFFFF',
  surface2:  '#FAF7EE',
  ink:       '#0B1A2F',
  inkSoft:   '#324358',
  muted:     '#6E7891',
  faint:     '#9CA3B3',
  line:      '#E4DCC6',
  lineSoft:  '#EEE6D0',
  navy:      '#0B2545',
  navyDeep:  '#06182E',
  gold:      '#C9A55C',
  goldHi:    '#F2D789',
  goldDeep:  '#8E6A22',
  good:      '#1F8A5B',
  warn:      '#B7791F',
  bad:       '#B23A48',
  // Selection: navy on light, gold on dark — lets active pills/tiles pop.
  select:    '#0B2545',
  selectInk: '#F5F1E8',
  shadow:    '0 1px 2px rgba(11,37,69,.05), 0 6px 24px rgba(11,37,69,.06)',
  shadowLg:  '0 8px 28px rgba(11,37,69,.10), 0 2px 6px rgba(11,37,69,.06)',
};

const AXIS_DARK = {
  name: 'dark',
  bg:        '#06182E',
  bgSoft:    '#0A2240',
  surface:   '#0F2B4D',
  surface2:  '#13345C',
  ink:       '#F1ECDC',
  inkSoft:   '#C7CFDE',
  muted:     '#8A95AB',
  faint:     '#5E6B83',
  line:      'rgba(255,255,255,0.10)',
  lineSoft:  'rgba(255,255,255,0.06)',
  navy:      '#0B2545',
  navyDeep:  '#06182E',
  gold:      '#D4B262',
  goldHi:    '#F2D789',
  goldDeep:  '#8E6A22',
  good:      '#2BB37A',
  warn:      '#E0B254',
  bad:       '#E36670',
  // Dark mode pops the gold for active selection (navy would vanish on navy bg).
  select:    '#D4B254',
  selectInk: '#06182E',
  shadow:    '0 1px 2px rgba(0,0,0,.4), 0 6px 24px rgba(0,0,0,.35)',
  shadowLg:  '0 8px 28px rgba(0,0,0,.5), 0 2px 6px rgba(0,0,0,.35)',
};

const AxisCtx = React.createContext(AXIS_LIGHT);
const useAxis = () => React.useContext(AxisCtx);
const AxisProvider = ({ dark = false, children }) => (
  <AxisCtx.Provider value={dark ? AXIS_DARK : AXIS_LIGHT}>{children}</AxisCtx.Provider>
);

// ─── Type ───────────────────────────────────────────────────────────────────
// Single sober grotesque. Display weight does the heavy lifting — no serif.
const AXIS_FONT = `"Manrope", -apple-system, system-ui, sans-serif`;
const AXIS_DISPLAY = AXIS_FONT;

// ─── Logo ───────────────────────────────────────────────────────────────────
// Your real brand asset. Source: uploads/logo.png; assets/axis-mark.png is the
// same mark retouched (4× supersample → recoloured to the app's gold ladder
// → alpha-channel sharpening to tighten contours → unsharp mask). The shape
// is untouched.
const AXIS_LOGO_URL = 'assets/axis-mark.png';

function AxisLogo({ size = 28, withWordmark = false, wordmarkColor, color, style }) {
  const t = useAxis();
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, ...style }}>
      <img src={AXIS_LOGO_URL} alt="Axis"
        width={size} height={size}
        style={{ display: 'block', objectFit: 'contain' }}/>
      {withWordmark && (
        <span style={{
          fontFamily: AXIS_DISPLAY, fontSize: size * 0.95, letterSpacing: '.16em',
          color: wordmarkColor || color || t.gold, fontWeight: 600, lineHeight: 1, paddingTop: 2,
        }}>AXIS</span>
      )}
    </div>
  );
}

function AxisMark({ size = 36 }) {
  return <AxisLogo size={size}/>;
}

// ─── Icons ──────────────────────────────────────────────────────────────────
// Thin-stroke set (1.6px), 24×24 viewBox. Consume `size` and currentColor.
const Icon = ({ size = 22, stroke = 1.6, children, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={stroke}
    strokeLinecap="round" strokeLinejoin="round" style={style}>{children}</svg>
);

const I = {
  home:   (p) => <Icon {...p}><path d="M3 11 L12 4 L21 11"/><path d="M5 10v10h14V10"/><path d="M10 20v-5h4v5"/></Icon>,
  truck:  (p) => <Icon {...p}><path d="M2 7h12v9H2z"/><path d="M14 10h4l3 3v3h-7"/><circle cx="6.5" cy="18" r="1.8"/><circle cx="17.5" cy="18" r="1.8"/></Icon>,
  doc:    (p) => <Icon {...p}><path d="M7 3h8l4 4v14H7z"/><path d="M14 3v5h5"/><path d="M10 13h7M10 17h7M10 9h2"/></Icon>,
  chat:   (p) => <Icon {...p}><path d="M4 5h16v11H9l-4 4z"/></Icon>,
  bell:   (p) => <Icon {...p}><path d="M6 9a6 6 0 0 1 12 0v4l2 3H4l2-3z"/><path d="M10 19a2 2 0 0 0 4 0"/></Icon>,
  plus:   (p) => <Icon {...p}><path d="M12 5v14M5 12h14"/></Icon>,
  arrow:  (p) => <Icon {...p}><path d="M5 12h14M13 5l7 7-7 7"/></Icon>,
  arrowL: (p) => <Icon {...p}><path d="M19 12H5M11 5l-7 7 7 7"/></Icon>,
  arrowUR:(p) => <Icon {...p}><path d="M7 17 L17 7 M9 7h8v8"/></Icon>,
  chev:   (p) => <Icon {...p}><path d="M9 6l6 6-6 6"/></Icon>,
  chevD:  (p) => <Icon {...p}><path d="M6 9l6 6 6-6"/></Icon>,
  car:    (p) => <Icon {...p}><path d="M4 14l2-5a2 2 0 0 1 2-1.5h8a2 2 0 0 1 2 1.5l2 5v4h-3v-2H7v2H4z"/><circle cx="7.5" cy="14.5" r="1.4" fill="currentColor"/><circle cx="16.5" cy="14.5" r="1.4" fill="currentColor"/></Icon>,
  bike:   (p) => <Icon {...p}><circle cx="5.5" cy="16.5" r="3"/><circle cx="18.5" cy="16.5" r="3"/><path d="M5.5 16.5 L11 8 L14 8 L18.5 16.5 M11 8 L9 5 H7"/></Icon>,
  box:    (p) => <Icon {...p}><path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/></Icon>,
  pallet: (p) => <Icon {...p}><rect x="4" y="5" width="16" height="9" rx="1"/><path d="M4 14v4M20 14v4M9 5v9M15 5v9"/></Icon>,
  pin:    (p) => <Icon {...p}><path d="M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/></Icon>,
  map:    (p) => <Icon {...p}><path d="M9 4 L3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/></Icon>,
  camera: (p) => <Icon {...p}><path d="M4 8h3l2-2h6l2 2h3v11H4z"/><circle cx="12" cy="13.5" r="3.5"/></Icon>,
  edit:   (p) => <Icon {...p}><path d="M4 20h4L20 8l-4-4L4 16z"/><path d="M14 6l4 4"/></Icon>,
  check:  (p) => <Icon {...p}><path d="M4 12l5 5L20 6"/></Icon>,
  x:      (p) => <Icon {...p}><path d="M6 6l12 12M18 6L6 18"/></Icon>,
  sig:    (p) => <Icon {...p}><path d="M3 18c4-2 6-12 9-12s3 8 5 8 2-2 4-2"/><path d="M3 21h18"/></Icon>,
  shield: (p) => <Icon {...p}><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/></Icon>,
  search: (p) => <Icon {...p}><circle cx="11" cy="11" r="6"/><path d="M16 16l4 4"/></Icon>,
  filter: (p) => <Icon {...p}><path d="M4 5h16l-6 8v6l-4 2v-8z"/></Icon>,
  globe:  (p) => <Icon {...p}><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/></Icon>,
  star:   (p) => <Icon {...p}><path d="M12 4l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 17.4 6.8 20.1l1-5.8L3.5 10.2l5.9-.8z"/></Icon>,
  euro:   (p) => <Icon {...p}><path d="M18 7a6 6 0 1 0 0 10"/><path d="M4 10h10M4 14h10"/></Icon>,
  battery:(p) => <Icon {...p}><rect x="3" y="8" width="15" height="8" rx="1.5"/><rect x="20" y="10" width="2" height="4"/></Icon>,
  fuel:   (p) => <Icon {...p}><path d="M5 21V5a2 2 0 0 1 2-2h7v18"/><path d="M5 13h9"/><path d="M14 8l3 2v9a2 2 0 0 0 2 2"/></Icon>,
  speedo: (p) => <Icon {...p}><path d="M3 13a9 9 0 1 1 18 0"/><path d="M12 13l5-3"/><circle cx="12" cy="13" r="1.6" fill="currentColor"/></Icon>,
  user:   (p) => <Icon {...p}><circle cx="12" cy="8" r="4"/><path d="M4 20c1.5-4 5-6 8-6s6.5 2 8 6"/></Icon>,
  users:  (p) => <Icon {...p}><circle cx="9" cy="9" r="3.5"/><circle cx="17" cy="10" r="2.5"/><path d="M3 19c1-3 3.5-5 6-5s5 2 6 5M15 17c1-2 3-3 5-3"/></Icon>,
  lock:   (p) => <Icon {...p}><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></Icon>,
  mail:   (p) => <Icon {...p}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></Icon>,
  phone:  (p) => <Icon {...p}><path d="M5 4h4l2 5-3 2a12 12 0 0 0 5 5l2-3 5 2v4a2 2 0 0 1-2 2 16 16 0 0 1-15-15 2 2 0 0 1 2-2z"/></Icon>,
  calendar:(p)=> <Icon {...p}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></Icon>,
  card:   (p) => <Icon {...p}><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h4"/></Icon>,
  news:   (p) => <Icon {...p}><rect x="3" y="5" width="14" height="14" rx="1.5"/><path d="M17 9h3v8a2 2 0 0 1-2 2"/><path d="M6 9h8M6 13h8M6 17h5"/></Icon>,
  warn:   (p) => <Icon {...p}><path d="M12 4l9 16H3z"/><path d="M12 10v5M12 17.5v.5"/></Icon>,
  bolt:   (p) => <Icon {...p}><path d="M13 3 L4 14 H11 L10 21 L20 10 H13 Z"/></Icon>,
  flag:   (p) => <Icon {...p}><path d="M5 21V4M5 4l8 1 6-1v9l-6 1-8-1"/></Icon>,
  upload: (p) => <Icon {...p}><path d="M4 17v3h16v-3M12 4v12M6 10l6-6 6 6"/></Icon>,
  download:(p) => <Icon {...p}><path d="M4 17v3h16v-3M12 16V4M6 10l6 6 6-6"/></Icon>,
  print:  (p) => <Icon {...p}><path d="M7 9V4h10v5M7 18H4v-7h16v7h-3M7 14h10v6H7z"/></Icon>,
  refresh:(p) => <Icon {...p}><path d="M20 12a8 8 0 1 1-2.5-5.8L20 9M20 4v5h-5"/></Icon>,
  trash:  (p) => <Icon {...p}><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></Icon>,
  more:   (p) => <Icon {...p}><circle cx="6" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="18" cy="12" r="1.5" fill="currentColor"/></Icon>,
  sliders:(p) => <Icon {...p}><path d="M4 6h16M4 12h16M4 18h16"/><circle cx="8" cy="6" r="2" fill="currentColor"/><circle cx="16" cy="12" r="2" fill="currentColor"/><circle cx="10" cy="18" r="2" fill="currentColor"/></Icon>,
};

// ─── Primitives ─────────────────────────────────────────────────────────────

// Surface (card)
function Surface({ children, style, padded = false, soft = false, bordered = true }) {
  const t = useAxis();
  return (
    <div style={{
      background: soft ? t.surface2 : t.surface,
      borderRadius: 16,
      border: bordered ? `1px solid ${t.line}` : 'none',
      boxShadow: t.shadow,
      padding: padded ? 16 : 0,
      ...style,
    }}>{children}</div>
  );
}

// Pill / tag
function Pill({ children, tone = 'default', style }) {
  const t = useAxis();
  const map = {
    default: { bg: t.bgSoft, fg: t.inkSoft, bd: t.line },
    gold:    { bg: 'rgba(194,162,74,.14)', fg: t.goldDeep, bd: 'rgba(194,162,74,.35)' },
    navy:    { bg: t.navy, fg: '#F1ECDC', bd: t.navy },
    good:    { bg: 'rgba(31,138,91,.12)', fg: t.good, bd: 'rgba(31,138,91,.3)' },
    warn:    { bg: 'rgba(183,121,31,.12)', fg: t.warn, bd: 'rgba(183,121,31,.3)' },
    bad:     { bg: 'rgba(178,58,72,.12)', fg: t.bad, bd: 'rgba(178,58,72,.3)' },
    ghost:   { bg: 'transparent', fg: t.muted, bd: t.line },
  };
  const s = map[tone] || map.default;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '4px 10px', borderRadius: 999,
      background: s.bg, color: s.fg, border: `1px solid ${s.bd}`,
      fontSize: 11.5, fontWeight: 500, letterSpacing: '.02em',
      whiteSpace: 'nowrap', ...style,
    }}>{children}</span>
  );
}

// Button
function Button({
  children, kind = 'primary', size = 'md', icon, iconRight, full,
  onClick, disabled, style,
}) {
  const t = useAxis();
  const map = {
    primary:   { bg: t.navy, fg: '#F5F1E8', bd: t.navy, hi: t.navyDeep },
    gold:      { bg: t.gold, fg: t.navyDeep, bd: t.gold, hi: t.goldHi },
    outline:   { bg: 'transparent', fg: t.ink, bd: t.line, hi: t.bgSoft },
    ghost:     { bg: 'transparent', fg: t.ink, bd: 'transparent', hi: t.bgSoft },
    danger:    { bg: 'transparent', fg: t.bad, bd: 'rgba(178,58,72,.3)', hi: 'rgba(178,58,72,.08)' },
  };
  const sz = {
    sm: { h: 32, px: 12, fs: 13 },
    md: { h: 42, px: 16, fs: 14.5 },
    lg: { h: 52, px: 20, fs: 16 },
  };
  const m = map[kind] || map.primary;
  const s = sz[size] || sz.md;
  return (
    <button onClick={onClick} disabled={disabled}
      onMouseEnter={(e) => !disabled && (e.currentTarget.style.background = m.hi)}
      onMouseLeave={(e) => !disabled && (e.currentTarget.style.background = m.bg)}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        gap: 8, height: s.h, padding: `0 ${s.px}px`,
        borderRadius: 12, border: `1px solid ${m.bd}`,
        background: m.bg, color: m.fg, fontFamily: AXIS_FONT,
        fontSize: s.fs, fontWeight: 540, letterSpacing: '-.005em',
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
        width: full ? '100%' : undefined, transition: 'background .12s, transform .08s',
        whiteSpace: 'nowrap', ...style,
      }}>
      {icon}{children}{iconRight}
    </button>
  );
}

// Avatar (initials)
function Avatar({ name = '?', size = 36, src, tone }) {
  const t = useAxis();
  const initials = name.split(' ').slice(0, 2).map(s => s[0]).join('').toUpperCase();
  if (src) return (
    <img src={src} alt={name} style={{
      width: size, height: size, borderRadius: '50%', objectFit: 'cover',
      border: `1px solid ${t.line}`,
    }}/>
  );
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: tone === 'gold' ? 'rgba(194,162,74,.18)' : t.navy,
      color: tone === 'gold' ? t.goldDeep : '#F5F1E8',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 600, fontSize: size * 0.36, letterSpacing: '.04em',
      fontFamily: AXIS_FONT,
    }}>{initials}</div>
  );
}

// Faux input
function Field({ label, value, placeholder, icon, hint, suffix, rows, onClick, style }) {
  const t = useAxis();
  return (
    <label onClick={onClick} style={{ display: 'flex', flexDirection: 'column', gap: 6, ...style }}>
      {label && <span style={{ fontSize: 12, fontWeight: 540, color: t.inkSoft, letterSpacing: '.02em', textTransform: 'uppercase' }}>{label}</span>}
      <div style={{
        display: 'flex', alignItems: rows ? 'flex-start' : 'center', gap: 10,
        minHeight: rows ? rows * 22 + 24 : 48, padding: rows ? '12px 14px' : '0 14px',
        borderRadius: 12, border: `1px solid ${t.line}`, background: t.surface,
        color: value ? t.ink : t.faint, fontSize: 15, cursor: onClick ? 'pointer' : 'text',
      }}>
        {icon && <span style={{ color: t.muted, display: 'flex' }}>{icon}</span>}
        <span style={{ flex: 1, fontFamily: AXIS_FONT, lineHeight: 1.4 }}>{value || placeholder}</span>
        {suffix && <span style={{ color: t.muted, fontSize: 13 }}>{suffix}</span>}
      </div>
      {hint && <span style={{ fontSize: 11.5, color: t.muted }}>{hint}</span>}
    </label>
  );
}

// Section header (small label + optional action)
function SectionHead({ title, action, style }) {
  const t = useAxis();
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
      padding: '0 4px', marginBottom: 10, ...style,
    }}>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: t.muted, letterSpacing: '.06em', textTransform: 'uppercase' }}>{title}</span>
      {action}
    </div>
  );
}

// Bottom tab bar (mobile)
function TabBar({ items, active, onChange, dark }) {
  const t = useAxis();
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-around',
      padding: '8px 12px 28px',
      background: t.surface, borderTop: `1px solid ${t.line}`,
    }}>
      {items.map((it) => {
        const on = it.id === active;
        return (
          <button key={it.id} onClick={() => onChange(it.id)} style={{
            border: 'none', background: 'transparent', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            padding: '6px 8px', color: on ? t.select : t.muted,
            fontFamily: AXIS_FONT, fontSize: 10.5, fontWeight: on ? 600 : 500, letterSpacing: '.01em',
          }}>
            <span style={{ display: 'flex' }}>{it.icon({ size: 22, stroke: on ? 1.9 : 1.5 })}</span>
            <span>{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// Top bar for non-large-title screens
function AppBar({ title, subtitle, leading, trailing, onBack, style }) {
  const t = useAxis();
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '54px 14px 12px', background: t.surface,
      borderBottom: `1px solid ${t.lineSoft}`,
      ...style,
    }}>
      {(onBack || leading) ? (onBack ? (
        <button onClick={onBack} style={{
          border: 'none', background: t.bgSoft, color: t.ink,
          width: 36, height: 36, borderRadius: 10, display: 'grid', placeItems: 'center', cursor: 'pointer',
        }}>{I.arrowL({ size: 18 })}</button>
      ) : leading) : <div style={{ width: 36 }} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: t.ink, letterSpacing: '-.01em' }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12, color: t.muted, marginTop: 1 }}>{subtitle}</div>}
      </div>
      {trailing || <div style={{ width: 36 }} />}
    </div>
  );
}

// Status badge (used for shipments)
function StatusBadge({ status }) {
  const map = {
    'en-attente':   { tone: 'warn', label: 'En attente' },
    'confirmee':    { tone: 'good', label: 'Confirmée' },
    'en-route':     { tone: 'navy', label: 'En route' },
    'livree':       { tone: 'good', label: 'Livrée' },
    'douane':       { tone: 'gold', label: 'Douane' },
    'incident':     { tone: 'bad',  label: 'Incident' },
    'brouillon':    { tone: 'default', label: 'Brouillon' },
  };
  const m = map[status] || map.brouillon;
  return <Pill tone={m.tone}>● {m.label}</Pill>;
}

// Mini map / hero map placeholder — abstracted Europe→Africa route.
function RouteMap({ height = 180, dark = false, progress = 0.4, from = 'Paris', to = 'Dakar' }) {
  const t = useAxis();
  const bg = dark ? t.navyDeep : '#E8E0CD';
  const land = dark ? '#0F2B4D' : '#FAF5E6';
  const sea = dark ? '#06182E' : '#E0D7BD';
  return (
    <div style={{
      position: 'relative', height, borderRadius: 14, overflow: 'hidden',
      background: bg, border: `1px solid ${t.line}`,
    }}>
      <svg viewBox="0 0 360 180" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        <rect width="360" height="180" fill={sea}/>
        {/* Stylised Europe + Africa silhouettes */}
        <path d="M40 40 Q 60 20 100 30 T 200 35 Q 240 30 270 50 L 250 70 Q 220 60 180 70 L 140 60 Q 100 70 80 60 Q 50 60 40 40 Z" fill={land} opacity="0.95"/>
        <path d="M120 100 Q 150 85 200 95 Q 240 105 250 130 Q 240 165 200 175 Q 160 175 140 160 Q 110 140 120 100 Z" fill={land} opacity="0.95"/>
        {/* Grid */}
        <g stroke={dark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.05)'} strokeWidth="1">
          {[40, 80, 120, 160].map((y) => <line key={y} x1="0" y1={y} x2="360" y2={y}/>)}
          {[60, 120, 180, 240, 300].map((x) => <line key={x} x1={x} y1="0" x2={x} y2="180"/>)}
        </g>
        {/* Route path Paris → Dakar */}
        <path id="route" d="M170 45 Q 130 80 130 130" stroke={t.gold} strokeWidth="2.5" strokeDasharray="4 4" fill="none"/>
        <path d="M170 45 Q 150 65 142 90" stroke={t.gold} strokeWidth="2.8" fill="none" strokeLinecap="round"/>
        {/* origin / destination */}
        <circle cx="170" cy="45" r="6" fill={t.gold}/>
        <circle cx="170" cy="45" r="11" fill="none" stroke={t.gold} strokeOpacity=".35" strokeWidth="2"/>
        <circle cx="130" cy="130" r="6" fill={t.navy}/>
        {/* current position */}
        <circle cx={170 - 40 * progress} cy={45 + 65 * progress} r="7" fill="#fff" stroke={t.gold} strokeWidth="3"/>
      </svg>
      <div style={{
        position: 'absolute', bottom: 10, left: 10, right: 10,
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
        fontFamily: AXIS_FONT,
      }}>
        <div>
          <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '.08em' }}>Départ</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: t.ink }}>{from}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '.08em' }}>Destination</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: t.ink }}>{to}</div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  AXIS_LIGHT, AXIS_DARK, AxisCtx, AxisProvider, useAxis,
  AXIS_FONT, AXIS_DISPLAY,
  AxisLogo, AxisMark, I, Icon,
  Surface, Pill, Button, Avatar, Field, SectionHead, TabBar, AppBar,
  StatusBadge, RouteMap,
});
