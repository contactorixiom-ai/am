// driver.jsx — Axis Driver (chauffeur) app: missions, état des lieux, contract.

// ─── Mission data (driver-side) ─────────────────────────────────────────────
const DR_AVAILABLE = [
  { ref: 'AX-2901', svc: 'Convoyage voiture', from: 'Paris 15ᵉ', to: 'Lyon Part-Dieu', vehicle: 'Audi A4 Avant · 2023', when: 'Demain · matin', km: 466, pay: 285, urgent: false },
  { ref: 'AX-2906', svc: 'Convoyage moto',    from: 'Bordeaux',  to: 'Toulouse', vehicle: 'Ducati Monster 937', when: 'Vend. 24 mai', km: 245, pay: 180, urgent: false },
  { ref: 'AX-2898', svc: 'Convoyage voiture', from: 'Anvers, BE', to: 'Marseille, port', vehicle: 'Mercedes Classe G · 2024', when: 'Sous 48h', km: 1180, pay: 720, urgent: true },
  { ref: 'AX-2911', svc: 'Marchandise',       from: 'Le Havre',  to: 'Bruxelles', vehicle: '6 palettes · 2 100 kg', when: 'Lun. 27 mai', km: 392, pay: 410, urgent: false },
];

const DR_ACTIVE = {
  ref: 'AX-2847',
  client: 'Léa Marchand',
  vehicle: 'BMW Série 3 · 320d · 2022',
  plate: 'GA-372-LM',
  from: 'Paris 15ᵉ — 42 rue Lecourbe',
  to:   'Bruxelles — 18 av. Schaerbeek',
  pickup: '22 mai · 11:00',
  pay: 320,
  km: 312,
};

// ─── Screen: Driver Home (dispatch) ─────────────────────────────────────────
function DR_Home({ go }) {
  const t = useAxis();
  const [tab, setTab] = React.useState('dispo');
  return (
    <div style={{ background: t.bg, minHeight: '100%' }}>
      {/* Header */}
      <div style={{
        padding: '62px 20px 20px',
        background: `linear-gradient(180deg, ${t.navy} 0%, ${t.navyDeep} 100%)`,
        color: '#F5F1E8',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar name="Karim Diallo" size={42} tone="gold"/>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: t.goldHi, letterSpacing: '.02em' }}>Chauffeur Axis · Niveau Or</div>
            <div style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.1 }}>Karim Diallo</div>
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
            borderRadius: 999, background: 'rgba(31,138,91,.25)', color: '#9DE0BA', fontSize: 12, fontWeight: 540,
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#34D17A' }}/>
            Disponible
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, marginTop: 18, background: 'rgba(255,255,255,.08)', borderRadius: 12, overflow: 'hidden' }}>
          {[
            { v: '142', l: 'Convoyages' },
            { v: '4,9', l: 'Note moyenne' },
            { v: '2 480 €', l: 'Ce mois-ci' },
          ].map((s) => (
            <div key={s.l} style={{ padding: '12px 10px', background: t.navyDeep, textAlign: 'center' }}>
              <div style={{ fontFamily: AXIS_DISPLAY, fontWeight: 700, fontSize: 22, color: t.goldHi, lineHeight: 1 }}>{s.v}</div>
              <div style={{ fontSize: 10.5, color: 'rgba(245,241,232,.6)', marginTop: 4, letterSpacing: '.04em' }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Active mission card */}
      <div style={{ padding: '14px 16px 0' }}>
        <Surface style={{ padding: 14, borderColor: t.gold, borderWidth: 1.5 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <Pill tone="gold">● Mission en cours</Pill>
            <span style={{ fontSize: 11, color: t.muted }}>{DR_ACTIVE.ref}</span>
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: t.ink, marginBottom: 2 }}>{DR_ACTIVE.vehicle}</div>
          <div style={{ fontSize: 12.5, color: t.muted, marginBottom: 10 }}>{DR_ACTIVE.from} → {DR_ACTIVE.to}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button kind="outline" size="sm" full onClick={() => go('etat')}>État des lieux</Button>
            <Button kind="primary" size="sm" full>Démarrer GPS</Button>
          </div>
        </Surface>
      </div>

      {/* Tabs */}
      <div style={{ padding: '20px 16px 0' }}>
        <div style={{
          display: 'flex', padding: 3, borderRadius: 12, background: t.bgSoft, border: `1px solid ${t.line}`,
        }}>
          {[
            { id: 'dispo',  label: 'Disponibles', n: DR_AVAILABLE.length },
            { id: 'attente', label: 'En attente', n: 1 },
            { id: 'hist',   label: 'Historique', n: 142 },
          ].map((x) => {
            const on = tab === x.id;
            return (
              <button key={x.id} onClick={() => setTab(x.id)} style={{
                flex: 1, padding: '8px 4px', borderRadius: 9, border: 'none',
                background: on ? t.surface : 'transparent',
                color: on ? t.ink : t.muted, fontFamily: AXIS_FONT, fontWeight: 540, fontSize: 13,
                cursor: 'pointer', boxShadow: on ? t.shadow : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              }}>
                {x.label}
                <span style={{ fontSize: 11, color: on ? t.muted : t.faint, fontWeight: 500 }}>{x.n}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Mission list */}
      <div style={{ padding: '14px 16px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {DR_AVAILABLE.map((m) => (
          <Surface key={m.ref} style={{ padding: 14, position: 'relative', overflow: 'hidden' }}>
            {m.urgent && (
              <div style={{ position: 'absolute', top: 0, right: 0, padding: '4px 10px 4px 12px', background: t.bad, color: '#fff', fontSize: 10, fontWeight: 600, letterSpacing: '.06em', borderBottomLeftRadius: 10 }}>URGENT</div>
            )}
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: t.muted }}>{m.ref}</span>
              <span style={{ fontSize: 11, color: t.muted }}>{m.when}</span>
            </div>
            <div style={{ fontSize: 13.5, fontWeight: 540, color: t.ink, marginBottom: 8 }}>{m.vehicle}</div>

            {/* Route line */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: t.gold }}/>
                <span style={{ width: 1, flex: 1, minHeight: 22, background: t.line, margin: '4px 0' }}/>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: t.navy }}/>
              </div>
              <div style={{ flex: 1, fontSize: 13, color: t.inkSoft, lineHeight: 1.6 }}>
                <div>{m.from}</div>
                <div style={{ color: t.ink, fontWeight: 540 }}>{m.to}</div>
              </div>
            </div>

            <div style={{ height: 1, background: t.lineSoft, margin: '10px 0' }}/>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 11, color: t.muted, letterSpacing: '.04em', textTransform: 'uppercase' }}>Trajet</span>
                <span style={{ fontSize: 14, color: t.ink, fontWeight: 540, fontVariantNumeric: 'tabular-nums' }}>{m.km} km</span>
              </div>
              <div style={{ flex: 1 }}/>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: t.muted, letterSpacing: '.04em', textTransform: 'uppercase' }}>Rémunération</div>
                <div style={{ fontFamily: AXIS_DISPLAY, fontWeight: 700, fontSize: 22, color: t.goldDeep, lineHeight: 1 }}>{m.pay} €</div>
              </div>
              <Button kind="primary" size="sm">Accepter</Button>
            </div>
          </Surface>
        ))}
      </div>
    </div>
  );
}

// ─── Screen: État des lieux ─────────────────────────────────────────────────
function DR_Etat({ go }) {
  const t = useAxis();
  const [step, setStep] = React.useState(2); // current photo index

  // 8 guided photo angles + 4 form fields
  const angles = [
    { id: 0, label: 'Avant',         icon: '↑', done: true },
    { id: 1, label: 'Arrière',       icon: '↓', done: true },
    { id: 2, label: 'Côté gauche',   icon: '←', done: false, current: true },
    { id: 3, label: 'Côté droit',    icon: '→', done: false },
    { id: 4, label: 'Tableau de bord',icon: '◳', done: false },
    { id: 5, label: 'Compteur km',   icon: '◷', done: false },
    { id: 6, label: 'Niveau carburant',icon: '⛽', done: false },
    { id: 7, label: 'Coffre',        icon: '☐', done: false },
  ];
  const completed = angles.filter(a => a.done).length;

  return (
    <div style={{ background: t.bg, minHeight: '100%' }}>
      <AppBar title="État des lieux — Départ" subtitle={`${DR_ACTIVE.vehicle} · ${DR_ACTIVE.plate}`} onBack={() => go('home')}/>

      {/* Progress strip */}
      <div style={{ padding: '12px 20px 16px', background: t.surface, borderBottom: `1px solid ${t.lineSoft}` }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 12, color: t.muted, letterSpacing: '.04em', textTransform: 'uppercase' }}>Avancement</span>
          <span style={{ fontFamily: AXIS_DISPLAY, fontWeight: 700, fontSize: 18, color: t.ink }}>{completed}/{angles.length} photos</span>
        </div>
        <div style={{ height: 5, background: t.bgSoft, borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ width: `${(completed/angles.length)*100}%`, height: '100%', background: t.gold, borderRadius: 3 }}/>
        </div>
      </div>

      {/* Live camera viewfinder for current step */}
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{
          aspectRatio: '4/3', borderRadius: 16, position: 'relative', overflow: 'hidden',
          background: `linear-gradient(135deg, ${t.navy} 0%, ${t.navyDeep} 100%)`,
          border: `1px solid ${t.line}`,
        }}>
          {/* Faux vehicle silhouette */}
          <svg viewBox="0 0 360 270" preserveAspectRatio="xMidYMid meet" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
            <defs>
              <radialGradient id="vg" cx="50%" cy="60%" r="60%">
                <stop offset="0" stopColor={t.goldHi} stopOpacity=".18"/>
                <stop offset="1" stopColor={t.navyDeep} stopOpacity="0"/>
              </radialGradient>
            </defs>
            <rect width="360" height="270" fill="url(#vg)"/>
            {/* car side silhouette */}
            <g fill="none" stroke={t.goldHi} strokeWidth="2" opacity=".55" strokeLinecap="round" strokeLinejoin="round">
              <path d="M40 180 Q 60 160 90 160 L 130 130 Q 160 115 200 115 L 240 115 Q 270 115 290 145 L 320 165 Q 330 168 330 180 L 330 200 L 40 200 Z"/>
              <circle cx="100" cy="200" r="22"/>
              <circle cx="270" cy="200" r="22"/>
              <line x1="160" y1="135" x2="160" y2="170"/>
              <line x1="230" y1="125" x2="230" y2="170"/>
            </g>
            {/* viewfinder corners */}
            {[[20,20,1,1],[340,20,-1,1],[20,250,1,-1],[340,250,-1,-1]].map((c, i) => (
              <g key={i} stroke={t.goldHi} strokeWidth="2.5" fill="none" strokeLinecap="round">
                <path d={`M${c[0]} ${c[1]+18*c[3]} L${c[0]} ${c[1]} L${c[0]+18*c[2]} ${c[1]}`}/>
              </g>
            ))}
          </svg>
          {/* HUD */}
          <div style={{ position: 'absolute', top: 12, left: 12, padding: '4px 10px', borderRadius: 999, background: 'rgba(0,0,0,.5)', color: '#F5F1E8', fontSize: 11, fontWeight: 540, letterSpacing: '.05em' }}>
            ÉTAPE {step + 1}/{angles.length}
          </div>
          <div style={{ position: 'absolute', top: 12, right: 12, padding: '4px 10px', borderRadius: 999, background: 'rgba(0,0,0,.5)', color: '#F5F1E8', fontSize: 11, display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#E36670' }}/> REC
          </div>
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 16, textAlign: 'center', color: '#F5F1E8' }}>
            <div style={{ fontFamily: AXIS_DISPLAY, fontWeight: 700, fontSize: 24, lineHeight: 1 }}>{angles[step].label}</div>
            <div style={{ fontSize: 11.5, color: 'rgba(245,241,232,.7)', marginTop: 4 }}>Cadre tout le côté gauche, sans contre-jour</div>
          </div>
        </div>
      </div>

      {/* Capture controls */}
      <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center' }}>
        <button onClick={() => setStep(Math.max(0, step - 1))} style={{
          width: 44, height: 44, borderRadius: 12, border: `1px solid ${t.line}`, background: t.surface, color: t.ink, display: 'grid', placeItems: 'center', cursor: 'pointer',
        }}>{I.arrowL({ size: 18 })}</button>
        <button style={{
          width: 70, height: 70, borderRadius: '50%', border: `4px solid ${t.surface}`,
          background: t.gold, boxShadow: `0 0 0 2px ${t.gold}, ${t.shadow}`,
          cursor: 'pointer', color: t.navyDeep, display: 'grid', placeItems: 'center',
        }}>{I.camera({ size: 28, stroke: 2 })}</button>
        <button onClick={() => setStep(Math.min(angles.length - 1, step + 1))} style={{
          width: 44, height: 44, borderRadius: 12, border: `1px solid ${t.line}`, background: t.surface, color: t.ink, display: 'grid', placeItems: 'center', cursor: 'pointer',
        }}>{I.arrow({ size: 18 })}</button>
      </div>

      {/* Angle thumbs strip */}
      <div style={{ padding: '0 16px 16px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        {angles.map((a, i) => {
          const isCur = i === step;
          return (
            <button key={a.id} onClick={() => setStep(i)} style={{
              padding: '8px 4px 6px', borderRadius: 10,
              border: `1.5px solid ${isCur ? t.select : a.done ? 'transparent' : t.line}`,
              background: a.done ? t.select : isCur ? t.surface : t.bgSoft,
              color: a.done ? t.selectInk : isCur ? t.ink : t.muted,
              cursor: 'pointer', textAlign: 'center', fontFamily: AXIS_FONT,
            }}>
              <div style={{ fontSize: 18, lineHeight: 1, marginBottom: 4 }}>{a.done ? '✓' : a.icon}</div>
              <div style={{ fontSize: 10.5, fontWeight: 540, lineHeight: 1.1 }}>{a.label}</div>
            </button>
          );
        })}
      </div>

      {/* Form fields */}
      <div style={{ padding: '4px 16px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <SectionHead title="Relevés véhicule"/>
        <Surface padded>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Kilométrage" value="48 217 km" icon={I.speedo({ size: 18 })}/>
            <Field label="Carburant" value="3/4" icon={I.fuel({ size: 18 })}/>
          </div>
          <div style={{ marginTop: 12 }}>
            <Field label="Dégâts apparents" rows={3} value="Petit éclat sur l'aile avant droite (signalé par le client). Pare-chocs et jantes RAS."/>
          </div>
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10, padding: 10, background: t.surface2, borderRadius: 10, border: `1px solid ${t.lineSoft}` }}>
            <span style={{ width: 22, height: 22, borderRadius: '50%', background: t.gold, color: t.navyDeep, display: 'grid', placeItems: 'center' }}>{I.check({ size: 14, stroke: 3 })}</span>
            <span style={{ flex: 1, fontSize: 12.5, color: t.inkSoft }}>Contrat PDF généré automatiquement à la fin</span>
          </div>
        </Surface>

        <Button kind="gold" full size="lg" disabled={completed < 8} onClick={() => go('contract')}
          iconRight={I.arrow({ size: 18 })}>
          {completed < 8 ? `Continuer (${8 - completed} étapes restantes)` : 'Générer le contrat'}
        </Button>
      </div>
    </div>
  );
}

// ─── Screen: Contract preview + signature ───────────────────────────────────
function DR_Contract({ go }) {
  const t = useAxis();
  const [signed, setSigned] = React.useState(false);
  return (
    <div style={{ background: t.bg, minHeight: '100%' }}>
      <AppBar title="Contrat de convoyage" subtitle={`Référence ${DR_ACTIVE.ref} · PDF`} onBack={() => go('etat')}
        trailing={<button style={{ width: 36, height: 36, borderRadius: 10, border: 'none', background: t.bgSoft, color: t.ink, display: 'grid', placeItems: 'center', cursor: 'pointer' }}>{I.download({ size: 18 })}</button>}/>

      <div style={{ padding: '16px 16px 0' }}>
        {/* Faux PDF page */}
        <div style={{
          background: t.surface, borderRadius: 12, border: `1px solid ${t.line}`,
          boxShadow: t.shadow, overflow: 'hidden',
        }}>
          {/* PDF header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: `1px solid ${t.lineSoft}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AxisLogo size={22} color={t.navy}/>
              <span style={{ fontFamily: AXIS_DISPLAY, fontWeight: 600, fontSize: 14, letterSpacing: '.18em', color: t.navy }}>AXIS</span>
            </div>
            <span style={{ fontSize: 10.5, color: t.muted, letterSpacing: '.06em' }}>CONTRAT • {DR_ACTIVE.ref}</span>
          </div>
          {/* PDF body — abstracted lines */}
          <div style={{ padding: '16px 18px 20px' }}>
            <div style={{ fontFamily: AXIS_DISPLAY, fontWeight: 700, fontSize: 18, color: t.ink, marginBottom: 14 }}>Contrat de convoyage — Europe</div>
            <div style={{ fontSize: 10.5, color: t.muted, marginBottom: 4, letterSpacing: '.04em', textTransform: 'uppercase' }}>Parties</div>
            <div style={{ fontSize: 12, color: t.ink, marginBottom: 14, lineHeight: 1.6 }}>
              <strong style={{ color: t.navy }}>Donneur d'ordre :</strong> Léa Marchand · Paris, France<br/>
              <strong style={{ color: t.navy }}>Convoyeur :</strong> Karim Diallo · Axis Mobility SAS<br/>
              <strong style={{ color: t.navy }}>Véhicule :</strong> {DR_ACTIVE.vehicle} — {DR_ACTIVE.plate}
            </div>

            <div style={{ fontSize: 10.5, color: t.muted, marginBottom: 4, letterSpacing: '.04em', textTransform: 'uppercase' }}>Trajet</div>
            <div style={{ fontSize: 12, color: t.ink, marginBottom: 14, lineHeight: 1.6 }}>
              Enlèvement : {DR_ACTIVE.from} le {DR_ACTIVE.pickup}<br/>
              Livraison : {DR_ACTIVE.to} avant le 22 mai · 16:00<br/>
              Distance : {DR_ACTIVE.km} km — Rémunération : {DR_ACTIVE.pay} € TTC
            </div>

            <div style={{ fontSize: 10.5, color: t.muted, marginBottom: 4, letterSpacing: '.04em', textTransform: 'uppercase' }}>État des lieux — départ</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4, marginBottom: 12 }}>
              {[0,1,2,3,4,5,6,7].map(i => (
                <div key={i} style={{
                  aspectRatio: '1', borderRadius: 4, background: `linear-gradient(135deg, ${t.navy} 0%, ${t.navyDeep} 100%)`,
                  display: 'grid', placeItems: 'center', color: t.gold,
                }}>{I.camera({ size: 14, stroke: 1.6 })}</div>
              ))}
            </div>
            <div style={{ fontSize: 11.5, color: t.inkSoft, lineHeight: 1.5, marginBottom: 12 }}>
              Kilométrage relevé : <strong>48 217 km</strong> · Carburant : <strong>3/4</strong><br/>
              Observations : éclat aile AV droite (préexistant). Pare-chocs RAS, intérieur propre.
            </div>

            <div style={{ height: 1, background: t.line, margin: '14px 0' }}/>

            <div style={{ fontSize: 10.5, color: t.muted, marginBottom: 4, letterSpacing: '.04em', textTransform: 'uppercase' }}>Signatures</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 6 }}>
              <div style={{ borderTop: `1px dashed ${t.line}`, paddingTop: 8 }}>
                <div style={{ fontSize: 10.5, color: t.muted }}>Donneur d'ordre</div>
                <div style={{ fontSize: 12, fontWeight: 540, color: t.ink, marginTop: 2 }}>L. Marchand</div>
                <div style={{ fontFamily: AXIS_DISPLAY, fontSize: 20, color: t.navy, marginTop: 2, fontWeight: 500, letterSpacing: '-.01em' }}>Léa M.</div>
              </div>
              <div style={{ borderTop: `1px dashed ${t.line}`, paddingTop: 8, opacity: signed ? 1 : 0.45 }}>
                <div style={{ fontSize: 10.5, color: t.muted }}>Convoyeur</div>
                <div style={{ fontSize: 12, fontWeight: 540, color: t.ink, marginTop: 2 }}>K. Diallo</div>
                <div style={{ fontFamily: AXIS_DISPLAY, fontSize: 20, color: t.gold, marginTop: 2, fontWeight: 500, letterSpacing: '-.01em' }}>
                  {signed ? 'Karim D.' : '—'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Signature pad */}
      <div style={{ padding: 16 }}>
        <SectionHead title="Signature électronique" action={signed ? <Pill tone="good">Signé · {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</Pill> : <Pill tone="warn">À signer</Pill>}/>
        <div style={{
          height: 130, borderRadius: 12, border: `1.5px dashed ${signed ? t.gold : t.line}`,
          background: signed ? 'rgba(194,162,74,.08)' : t.surface,
          display: 'grid', placeItems: 'center', color: t.muted, cursor: 'pointer',
          position: 'relative', overflow: 'hidden',
        }} onClick={() => setSigned(!signed)}>
          {signed ? (
            <svg viewBox="0 0 300 100" style={{ width: '70%', height: '100%' }}>
              <path d="M20 70 Q 40 30 65 60 T 110 50 Q 130 35 140 60 T 200 55 Q 220 40 230 70 T 280 40"
                stroke={t.gold} strokeWidth="3" fill="none" strokeLinecap="round"/>
            </svg>
          ) : (
            <div style={{ textAlign: 'center', color: t.muted, fontSize: 13 }}>
              {I.sig({ size: 28, stroke: 1.5 })}
              <div style={{ marginTop: 6 }}>Signe ici avec ton doigt</div>
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: '0 16px 24px', display: 'flex', gap: 10 }}>
        <Button kind="outline" size="lg" full>Refaire</Button>
        <Button kind="gold" size="lg" full disabled={!signed} onClick={() => go('home')}
          iconRight={I.check({ size: 18, stroke: 2.4 })}>
          Valider & envoyer
        </Button>
      </div>
    </div>
  );
}

// ─── Driver router ──────────────────────────────────────────────────────────
function DriverApp({ initialRoute = 'home', dark = false }) {
  const [route, setRoute] = React.useState(initialRoute);
  const t = dark ? AXIS_DARK : AXIS_LIGHT;

  const screens = {
    home:     <DR_Home go={setRoute}/>,
    etat:     <DR_Etat go={setRoute}/>,
    contract: <DR_Contract go={setRoute}/>,
  };

  const tabs = [
    { id: 'home',     label: 'Missions',  icon: I.truck },
    { id: 'etat',     label: 'États lieux', icon: I.camera },
    { id: 'contract', label: 'Contrats',  icon: I.doc },
    { id: 'msg',      label: 'Messages',  icon: I.chat },
    { id: 'profile',  label: 'Profil',    icon: I.user },
  ];
  const tabActive = ({ home: 'home', etat: 'etat', contract: 'contract' })[route] || 'home';

  return (
    <AxisProvider dark={dark}>
      <div style={{
        height: '100%', display: 'flex', flexDirection: 'column',
        background: t.bg, fontFamily: AXIS_FONT, color: t.ink,
      }}>
        <div style={{ flex: 1, overflow: 'auto' }}>{screens[route]}</div>
        <TabBar items={tabs} active={tabActive} onChange={(id) => screens[id] && setRoute(id)}/>
      </div>
    </AxisProvider>
  );
}

Object.assign(window, { DriverApp });
