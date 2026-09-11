// client-menu.jsx — Sliding main menu drawer for the client app.

function ClientMenu({ open, onClose, go, dark, toggleDark }) {
  const t = useAxis();
  // Lock body scroll while open is implicit (panel covers full app area).
  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute', inset: 0, zIndex: 90,
          background: 'rgba(11,26,47,.45)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity .25s cubic-bezier(.2,.7,.3,1)',
        }}
      />
      {/* Panel */}
      <div
        style={{
          position: 'absolute', top: 0, bottom: 0, left: 0, width: '84%',
          zIndex: 91, background: t.surface, color: t.ink,
          display: 'flex', flexDirection: 'column',
          boxShadow: '8px 0 36px rgba(11,26,47,.18)',
          transform: open ? 'translateX(0)' : 'translateX(-105%)',
          transition: 'transform .28s cubic-bezier(.2,.7,.3,1)',
          fontFamily: AXIS_FONT,
        }}
      >
        {/* Header — profile */}
        <div style={{
          position: 'relative',
          padding: '54px 22px 22px',
          background: `linear-gradient(160deg, ${t.navy} 0%, ${t.navyDeep} 100%)`,
          color: '#F5F1E8',
          overflow: 'hidden',
        }}>
          {/* Decorative gold ring */}
          <svg viewBox="0 0 200 200" style={{ position: 'absolute', top: -40, right: -60, width: 220, opacity: .14, color: t.gold }}>
            <circle cx="100" cy="100" r="90" stroke="currentColor" strokeWidth="1" fill="none"/>
            <circle cx="100" cy="100" r="60" stroke="currentColor" strokeWidth="1" fill="none"/>
          </svg>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'relative' }}>
            <Avatar name="Léa Marchand" size={52} tone="gold"/>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-.01em' }}>Léa Marchand</div>
              <div style={{ fontSize: 12, color: 'rgba(245,241,232,.62)', marginTop: 2 }}>lea.marchand@gmail.com</div>
            </div>
            <button
              onClick={onClose}
              aria-label="Fermer"
              style={{
                width: 32, height: 32, borderRadius: 10, border: 'none',
                background: 'rgba(255,255,255,.08)', color: '#F5F1E8',
                display: 'grid', placeItems: 'center', cursor: 'pointer',
              }}
            >{I.x({ size: 16 })}</button>
          </div>

          {/* Stats strip */}
          <div style={{
            marginTop: 18, padding: '10px 14px', borderRadius: 12,
            background: 'rgba(255,255,255,.06)',
            border: '1px solid rgba(255,255,255,.08)',
            display: 'flex', alignItems: 'center', gap: 14,
          }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: t.goldHi }}>12</div>
              <div style={{ fontSize: 10, color: 'rgba(245,241,232,.55)', letterSpacing: '.04em', marginTop: 1 }}>Missions</div>
            </div>
            <div style={{ width: 1, alignSelf: 'stretch', background: 'rgba(255,255,255,.12)' }}/>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: t.goldHi }}>2 480 €</div>
              <div style={{ fontSize: 10, color: 'rgba(245,241,232,.55)', letterSpacing: '.04em', marginTop: 1 }}>Total dépensé</div>
            </div>
            <div style={{ flex: 1 }}/>
            <span style={{
              fontSize: 10.5, padding: '4px 9px', borderRadius: 999,
              background: 'rgba(194,162,74,.18)', color: t.goldHi,
              letterSpacing: '.06em', fontWeight: 600,
            }}>CLIENT OR</span>
          </div>
        </div>

        {/* Body — menu sections */}
        <div style={{ flex: 1, overflow: 'auto', padding: '14px 8px 24px' }}>
          <MenuSection label="Compte">
            <MenuRow icon={I.user}   label="Mon profil"               onClick={onClose}/>
            <MenuRow icon={I.pin}    label="Mes adresses"             trailing="3" onClick={onClose}/>
            <MenuRow icon={I.card}   label="Modes de paiement"        trailing="2" onClick={onClose}/>
          </MenuSection>

          <MenuSection label="Activité">
            <MenuRow icon={I.truck}  label="Mes missions"             trailing="12" onClick={() => { go('home'); onClose(); }}/>
            <MenuRow icon={I.doc}    label="Documents & factures"     trailing="3" onClick={() => { go('docs'); onClose(); }}/>
            <MenuRow icon={I.news}   label="Actualités transport"     onClick={() => { go('news'); onClose(); }}/>
          </MenuSection>

          <MenuSection label="Axis">
            <MenuRow icon={I.bolt}   label="Devenir chauffeur Axis"   badge="Nouveau" onClick={onClose}/>
            <MenuRow icon={I.star}   label="Parrainage"               sub="20 € par filleul" onClick={onClose}/>
            <MenuRow icon={I.shield} label="Centre d'aide"            onClick={onClose}/>
          </MenuSection>

          <MenuSection label="Préférences">
            <MenuRow icon={I.bell}   label="Notifications"            onClick={onClose}/>
            <MenuRow icon={I.globe}  label="Langue"                   trailing="Français" onClick={onClose}/>
            <MenuRowToggle
              icon={dark ? I.bolt : I.bolt}
              label="Mode sombre"
              value={dark}
              onChange={toggleDark}
            />
          </MenuSection>

          <div style={{ padding: '0 12px', marginTop: 6 }}>
            <button
              onClick={onClose}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                padding: '14px 14px', borderRadius: 12, border: `1px solid ${t.line}`,
                background: t.surface2, color: t.bad,
                fontFamily: AXIS_FONT, fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}
            >
              <span style={{ display: 'flex' }}>{I.arrowL({ size: 18 })}</span>
              Se déconnecter
            </button>
          </div>

          <div style={{
            textAlign: 'center', marginTop: 18,
            fontSize: 11, color: t.muted, letterSpacing: '.04em',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            <AxisLogo size={14}/>
            <span>Axis Mobility · v 2.1.0</span>
          </div>
        </div>
      </div>
    </>
  );
}

function MenuSection({ label, children }) {
  const t = useAxis();
  return (
    <div style={{ padding: '14px 12px 6px' }}>
      <div style={{
        fontSize: 10.5, fontWeight: 600, color: t.muted,
        letterSpacing: '.08em', textTransform: 'uppercase',
        padding: '0 6px 8px',
      }}>{label}</div>
      <div style={{
        background: t.surface, borderRadius: 14,
        border: `1px solid ${t.lineSoft}`, overflow: 'hidden',
      }}>{children}</div>
    </div>
  );
}

function MenuRow({ icon, label, sub, trailing, badge, onClick }) {
  const t = useAxis();
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 14px', border: 'none', background: 'transparent', color: t.ink,
        borderBottom: `1px solid ${t.lineSoft}`,
        fontFamily: AXIS_FONT, textAlign: 'left', cursor: 'pointer',
      }}
    >
      <div style={{
        width: 32, height: 32, borderRadius: 9, flexShrink: 0,
        background: t.bgSoft, color: t.navy,
        display: 'grid', placeItems: 'center',
      }}>{icon({ size: 17, stroke: 1.6 })}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: t.ink, lineHeight: 1.2 }}>{label}</div>
        {sub && <div style={{ fontSize: 11.5, color: t.muted, marginTop: 2 }}>{sub}</div>}
      </div>
      {badge && (
        <span style={{
          fontSize: 10, padding: '2px 7px', borderRadius: 999,
          background: 'rgba(194,162,74,.18)', color: t.goldDeep,
          fontWeight: 600, letterSpacing: '.04em',
        }}>{badge}</span>
      )}
      {trailing && <span style={{ fontSize: 12.5, color: t.muted, fontWeight: 500 }}>{trailing}</span>}
      <span style={{ color: t.faint, display: 'flex' }}>{I.chev({ size: 16 })}</span>
    </button>
  );
}

function MenuRowToggle({ icon, label, value, onChange }) {
  const t = useAxis();
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 14px', borderBottom: `1px solid ${t.lineSoft}`,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 9, flexShrink: 0,
        background: t.bgSoft, color: t.navy,
        display: 'grid', placeItems: 'center',
      }}>{icon({ size: 17, stroke: 1.6 })}</div>
      <div style={{ flex: 1, fontSize: 14, fontWeight: 500, color: t.ink }}>{label}</div>
      <button
        onClick={() => onChange(!value)}
        style={{
          position: 'relative', width: 42, height: 26, borderRadius: 999, border: 'none',
          background: value ? t.navy : t.bgSoft, cursor: 'pointer', padding: 0,
          transition: 'background .15s',
        }}
        aria-checked={value}
        role="switch"
      >
        <span style={{
          position: 'absolute', top: 3, left: value ? 19 : 3,
          width: 20, height: 20, borderRadius: '50%',
          background: value ? t.gold : '#FFF',
          boxShadow: '0 1px 3px rgba(11,26,47,.25)',
          transition: 'left .15s',
        }}/>
      </button>
    </div>
  );
}

Object.assign(window, { ClientMenu });
