// admin.jsx — Axis admin web dashboard.

function ADM_Sidebar({ active = 'dash' }) {
  const t = useAxis();
  const items = [
    { id: 'dash',    label: 'Tableau de bord', icon: I.home },
    { id: 'missions',label: 'Missions',        icon: I.truck, badge: 23 },
    { id: 'drivers', label: 'Chauffeurs',      icon: I.users },
    { id: 'clients', label: 'Clients',         icon: I.user },
    { id: 'docs',    label: 'Documents',       icon: I.doc, badge: 4 },
    { id: 'route',   label: 'Itinéraires',     icon: I.map },
    { id: 'invoice', label: 'Facturation',     icon: I.euro },
    { id: 'news',    label: 'Actualités',      icon: I.news },
  ];
  return (
    <div style={{
      width: 224, background: t.navyDeep, color: '#F5F1E8',
      display: 'flex', flexDirection: 'column', padding: '20px 0',
      borderRight: `1px solid rgba(255,255,255,.06)`,
    }}>
      <div style={{ padding: '0 22px 24px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <AxisLogo size={26} color={t.gold}/>
        <span style={{ fontFamily: AXIS_DISPLAY, fontWeight: 600, fontSize: 22, letterSpacing: '.18em', color: t.gold }}>AXIS</span>
        <span style={{ marginLeft: 'auto', fontSize: 9.5, padding: '2px 7px', borderRadius: 4, background: 'rgba(194,162,74,.18)', color: t.goldHi, letterSpacing: '.06em' }}>ADMIN</span>
      </div>

      <div style={{ padding: '0 12px', display: 'flex', flexDirection: 'column', gap: 1 }}>
        {items.map((it) => {
          const on = it.id === active;
          return (
            <button key={it.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', borderRadius: 8, border: 'none',
              background: on ? 'rgba(194,162,74,.14)' : 'transparent',
              color: on ? t.goldHi : 'rgba(245,241,232,.7)',
              fontFamily: AXIS_FONT, fontSize: 13.5, fontWeight: on ? 540 : 440,
              cursor: 'pointer', textAlign: 'left', position: 'relative',
            }}>
              {on && <span style={{ position: 'absolute', left: 0, top: 8, bottom: 8, width: 2, background: t.gold, borderRadius: 2 }}/>}
              <span style={{ display: 'flex' }}>{it.icon({ size: 18, stroke: on ? 1.8 : 1.5 })}</span>
              <span style={{ flex: 1 }}>{it.label}</span>
              {it.badge && (
                <span style={{ fontSize: 10.5, padding: '2px 7px', borderRadius: 999, background: t.gold, color: t.navyDeep, fontWeight: 600 }}>
                  {it.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: 'auto', padding: '20px 22px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, borderRadius: 10, background: 'rgba(255,255,255,.04)' }}>
          <Avatar name="Marc Beaudoin" size={32} tone="gold"/>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 540, color: '#F5F1E8' }}>Marc Beaudoin</div>
            <div style={{ fontSize: 11, color: 'rgba(245,241,232,.5)' }}>Ops manager</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ADM_KPI({ label, value, trend, sub, icon }) {
  const t = useAxis();
  return (
    <Surface style={{ padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ fontSize: 11.5, color: t.muted, letterSpacing: '.06em', textTransform: 'uppercase' }}>{label}</span>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: t.bgSoft, color: t.navy, display: 'grid', placeItems: 'center' }}>{icon}</div>
      </div>
      <div style={{ fontFamily: AXIS_DISPLAY, fontWeight: 700, fontSize: 34, color: t.ink, lineHeight: 1, letterSpacing: '-.01em' }}>{value}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
        {trend && (
          <span style={{
            fontSize: 11.5, padding: '2px 7px', borderRadius: 4,
            background: trend.startsWith('+') ? 'rgba(31,138,91,.12)' : 'rgba(178,58,72,.12)',
            color: trend.startsWith('+') ? t.good : t.bad, fontWeight: 540,
          }}>{trend}</span>
        )}
        <span style={{ fontSize: 11.5, color: t.muted }}>{sub}</span>
      </div>
    </Surface>
  );
}

function ADM_Dashboard() {
  const t = useAxis();
  const missions = [
    { ref: 'AX-2847', client: 'L. Marchand',  driver: 'K. Diallo',    route: 'Paris → Bruxelles',     svc: 'Voiture',  status: 'en-route', eta: '14:32', val: 320 },
    { ref: 'AX-2811', client: 'CIE Logistik', driver: 'S. Bamba',     route: 'Lyon → Abidjan',        svc: '4 palettes', status: 'douane', eta: '24/05', val: 4850 },
    { ref: 'AX-2842', client: 'P. Renaud',    driver: 'M. Tournier',  route: 'Anvers → Marseille',    svc: 'Voiture',   status: 'en-route', eta: 'demain', val: 720 },
    { ref: 'AX-2820', client: 'Senghor SARL', driver: 'A. Fofana',    route: 'Le Havre → Dakar',      svc: 'Conteneur', status: 'douane',  eta: '02/06', val: 6200 },
    { ref: 'AX-2853', client: 'L. Cassagne',  driver: 'À assigner',   route: 'Bordeaux → Toulouse',   svc: 'Moto',      status: 'en-attente', eta: '23/05', val: 180 },
    { ref: 'AX-2839', client: 'F. Diop',      driver: 'O. Mendy',     route: 'Paris → Cotonou',       svc: 'Véhicule + colis', status: 'douane',  eta: '28/05', val: 3400 },
  ];

  return (
    <div style={{ flex: 1, background: t.bg, color: t.ink, overflow: 'auto' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16,
        padding: '20px 32px', borderBottom: `1px solid ${t.line}`, background: t.surface,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, color: t.muted, letterSpacing: '.04em' }}>Vendredi 22 mai 2026</div>
          <div style={{ fontFamily: AXIS_DISPLAY, fontWeight: 700, fontSize: 26, color: t.ink, letterSpacing: '-.01em', marginTop: 2 }}>
            Bon retour, Marc.
          </div>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, height: 38, padding: '0 14px',
          borderRadius: 10, border: `1px solid ${t.line}`, background: t.bgSoft, color: t.muted, width: 320, fontSize: 13,
        }}>
          {I.search({ size: 16 })}
          <span>Rechercher une mission, un chauffeur…</span>
          <span style={{ marginLeft: 'auto', fontSize: 10.5, padding: '2px 6px', borderRadius: 4, border: `1px solid ${t.line}`, background: t.surface }}>⌘ K</span>
        </div>
        <button style={{ width: 38, height: 38, borderRadius: 10, border: `1px solid ${t.line}`, background: t.surface, color: t.ink, display: 'grid', placeItems: 'center', cursor: 'pointer', position: 'relative' }}>
          {I.bell({ size: 18 })}
          <span style={{ position: 'absolute', top: 8, right: 9, width: 7, height: 7, borderRadius: '50%', background: t.bad, boxShadow: `0 0 0 2px ${t.surface}` }}/>
        </button>
        <Button kind="gold" icon={I.plus({ size: 16, stroke: 2 })}>Nouvelle mission</Button>
      </div>

      <div style={{ padding: '24px 32px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          <ADM_KPI label="Missions en cours" value="23"   trend="+4" sub="vs hier" icon={I.truck({ size: 18 })}/>
          <ADM_KPI label="CA du mois"        value="142 350 €" trend="+18%" sub="vs avril" icon={I.euro({ size: 18 })}/>
          <ADM_KPI label="Chauffeurs actifs" value="38/52" trend="-2" sub="absences"   icon={I.users({ size: 18 })}/>
          <ADM_KPI label="Litiges ouverts"   value="2"    trend="-1" sub="vs semaine" icon={I.warn({ size: 18 })}/>
        </div>

        {/* Main grid: map + side */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.65fr 1fr', gap: 14 }}>
          <Surface style={{ padding: 18, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 11.5, color: t.muted, letterSpacing: '.06em', textTransform: 'uppercase' }}>Carte temps réel</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: t.ink, marginTop: 2 }}>23 missions actives</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <Pill tone="navy">Europe · 18</Pill>
                <Pill tone="gold">Afrique · 5</Pill>
              </div>
            </div>

            <div style={{
              height: 280, borderRadius: 12, background: t.bgSoft, border: `1px solid ${t.line}`,
              position: 'relative', overflow: 'hidden',
            }}>
              <svg viewBox="0 0 800 400" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
                <rect width="800" height="400" fill={t.bgSoft}/>
                {/* grid */}
                <g stroke="rgba(0,0,0,.04)" strokeWidth="1">
                  {[80,160,240,320].map(y => <line key={y} x1="0" y1={y} x2="800" y2={y}/>)}
                  {[100,200,300,400,500,600,700].map(x => <line key={x} x1={x} y1="0" x2={x} y2="400"/>)}
                </g>
                {/* Europe blob */}
                <path d="M280 60 Q 360 40 480 70 T 660 110 Q 680 150 640 180 L 560 175 Q 480 195 420 175 Q 360 195 320 175 L 270 130 Q 260 90 280 60Z" fill={t.surface} stroke={t.line}/>
                {/* Africa blob */}
                <path d="M340 200 Q 440 180 540 220 Q 600 260 580 340 Q 540 380 460 380 Q 380 360 340 320 Q 310 260 340 200Z" fill={t.surface} stroke={t.line}/>
                {/* labels */}
                <text x="450" y="120" fill={t.muted} fontSize="11" fontFamily={AXIS_FONT} letterSpacing="2">EUROPE</text>
                <text x="430" y="290" fill={t.muted} fontSize="11" fontFamily={AXIS_FONT} letterSpacing="2">AFRIQUE</text>
                {/* routes */}
                <g stroke={t.gold} fill="none" strokeWidth="1.5">
                  <path d="M370 95 Q 360 200 410 290" strokeDasharray="3 3"/>
                  <path d="M420 100 Q 440 200 480 320" strokeDasharray="3 3"/>
                  <path d="M380 90 L 470 100"/>
                  <path d="M470 100 L 540 130"/>
                </g>
                {/* mission dots: Europe (navy = en route) */}
                {[[370,95],[420,100],[470,100],[510,90],[540,130],[450,140],[400,120],[350,110],[480,80],[430,160],[510,150],[470,140],[380,130]].map((p, i) => (
                  <g key={i}>
                    <circle cx={p[0]} cy={p[1]} r="7" fill={t.navy} fillOpacity=".18"/>
                    <circle cx={p[0]} cy={p[1]} r="3.5" fill={t.navy}/>
                  </g>
                ))}
                {/* Africa dots (gold) */}
                {[[410,290],[480,320],[440,260],[510,300],[470,340]].map((p, i) => (
                  <g key={i}>
                    <circle cx={p[0]} cy={p[1]} r="8" fill={t.gold} fillOpacity=".22"/>
                    <circle cx={p[0]} cy={p[1]} r="3.5" fill={t.gold}/>
                  </g>
                ))}
              </svg>
              {/* Legend */}
              <div style={{ position: 'absolute', bottom: 12, left: 12, display: 'flex', gap: 12, padding: '6px 12px', borderRadius: 999, background: t.surface, border: `1px solid ${t.line}`, fontSize: 11.5, color: t.inkSoft }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: t.navy }}/>Convoyage</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: t.gold }}/>Import-export</span>
              </div>
            </div>
          </Surface>

          {/* Right column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Alerts */}
            <Surface padded>
              <SectionHead title="Alertes" action={<span style={{ fontSize: 12, color: t.muted }}>3 nouvelles</span>}/>
              {[
                { tone: 'bad',  title: 'Retard >2h · AX-2842', sub: 'Bouchon A1, ETA repoussée à 16:40', icon: I.warn },
                { tone: 'gold', title: 'Document douanier · AX-2820', sub: 'BSC à valider sous 24h', icon: I.doc },
                { tone: 'navy', title: 'Chauffeur K. Diallo', sub: 'Repos obligatoire dans 1h12', icon: I.user },
              ].map((a, i, ar) => (
                <div key={i} style={{
                  display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 0',
                  borderBottom: i === ar.length - 1 ? 'none' : `1px solid ${t.lineSoft}`,
                }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                    background: { bad: 'rgba(178,58,72,.12)', gold: 'rgba(194,162,74,.14)', navy: 'rgba(11,37,69,.08)' }[a.tone],
                    color: { bad: t.bad, gold: t.goldDeep, navy: t.navy }[a.tone],
                    display: 'grid', placeItems: 'center',
                  }}>{a.icon({ size: 16 })}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 540, color: t.ink }}>{a.title}</div>
                    <div style={{ fontSize: 11.5, color: t.muted, marginTop: 2 }}>{a.sub}</div>
                  </div>
                </div>
              ))}
            </Surface>

            {/* Mini chart */}
            <Surface padded>
              <SectionHead title="Missions 7 derniers jours" action={<Pill tone="good">+12%</Pill>}/>
              <svg viewBox="0 0 280 110" style={{ width: '100%', height: 100 }}>
                <defs>
                  <linearGradient id="ag" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0" stopColor={t.gold} stopOpacity=".35"/>
                    <stop offset="1" stopColor={t.gold} stopOpacity="0"/>
                  </linearGradient>
                </defs>
                {/* axis lines */}
                {[20, 50, 80].map(y => <line key={y} x1="0" x2="280" y1={y} y2={y} stroke={t.lineSoft}/>)}
                <path d="M 8 70 L 50 55 L 92 60 L 134 38 L 176 45 L 218 28 L 260 18 L 260 95 L 8 95 Z" fill="url(#ag)"/>
                <path d="M 8 70 L 50 55 L 92 60 L 134 38 L 176 45 L 218 28 L 260 18" fill="none" stroke={t.gold} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                {[[8,70],[50,55],[92,60],[134,38],[176,45],[218,28],[260,18]].map((p, i) => (
                  <circle key={i} cx={p[0]} cy={p[1]} r="3" fill={t.surface} stroke={t.gold} strokeWidth="2"/>
                ))}
                {/* x labels */}
                {['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].map((d, i) => (
                  <text key={d} x={8 + i*42} y="108" fontSize="9.5" fill={t.muted} textAnchor="middle" fontFamily={AXIS_FONT}>{d}</text>
                ))}
              </svg>
            </Surface>
          </div>
        </div>

        {/* Missions table */}
        <Surface>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px 12px', borderBottom: `1px solid ${t.line}` }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: t.ink }}>Missions en cours</div>
              <div style={{ fontSize: 12, color: t.muted, marginTop: 2 }}>Triées par priorité opérationnelle</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button kind="ghost" size="sm" icon={I.filter({ size: 15 })}>Filtres</Button>
              <Button kind="outline" size="sm" icon={I.download({ size: 15 })}>Export</Button>
            </div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: AXIS_FONT }}>
            <thead>
              <tr style={{ background: t.surface2 }}>
                {['Référence', 'Service', 'Client', 'Trajet', 'Chauffeur', 'Statut', 'ETA', 'Valeur', ''].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, fontWeight: 600, color: t.muted, letterSpacing: '.06em', textTransform: 'uppercase', borderBottom: `1px solid ${t.line}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {missions.map((m, i) => (
                <tr key={m.ref} style={{ borderBottom: i === missions.length - 1 ? 'none' : `1px solid ${t.lineSoft}` }}>
                  <td style={{ padding: '12px 16px', fontSize: 12.5, fontWeight: 600, color: t.navy, letterSpacing: '.02em', fontVariantNumeric: 'tabular-nums' }}>{m.ref}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: t.ink }}>{m.svc}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: t.inkSoft }}>{m.client}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: t.inkSoft }}>{m.route}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: m.driver.includes('assigner') ? t.bad : t.inkSoft }}>
                    {m.driver}
                  </td>
                  <td style={{ padding: '12px 16px' }}><StatusBadge status={m.status}/></td>
                  <td style={{ padding: '12px 16px', fontSize: 12.5, color: t.muted, fontVariantNumeric: 'tabular-nums' }}>{m.eta}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13.5, color: t.ink, fontWeight: 540, fontVariantNumeric: 'tabular-nums' }}>{m.val.toLocaleString('fr-FR')} €</td>
                  <td style={{ padding: '12px 16px' }}>
                    <button style={{ border: 'none', background: 'transparent', color: t.muted, cursor: 'pointer', padding: 4, display: 'grid', placeItems: 'center' }}>{I.more({ size: 16 })}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Surface>
      </div>
    </div>
  );
}

function AdminView({ dark = false }) {
  return (
    <AxisProvider dark={dark}>
      <div style={{ display: 'flex', height: '100%', fontFamily: AXIS_FONT }}>
        <ADM_Sidebar/>
        <ADM_Dashboard/>
      </div>
    </AxisProvider>
  );
}

Object.assign(window, { AdminView, ADM_Dashboard, ADM_Sidebar });
