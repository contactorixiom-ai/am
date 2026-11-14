// client.jsx — Axis Client app. Self-contained mini-router + all client screens.

const CLIENT_TABS = [
  { id: 'home',    label: 'Accueil',   icon: I.home },
  { id: 'track',   label: 'Suivi',     icon: I.pin },
  { id: 'new',     label: 'Demander',  icon: I.plus, isCenter: true },
  { id: 'docs',    label: 'Documents', icon: I.doc },
  { id: 'msg',     label: 'Messages',  icon: I.chat },
];

// ─── Service types ──────────────────────────────────────────────────────────
const SERVICES = [
  { id: 'car',   icon: I.car,    title: 'Convoyage voiture',      sub: 'Particulier ou pro', tag: 'Europe',   delay: '2-5 jours' },
  { id: 'moto',  icon: I.bike,   title: 'Convoyage moto',         sub: 'Plateau ou roulé',   tag: 'Europe',   delay: '2-4 jours' },
  { id: 'colis', icon: I.box,    title: 'Colis & paquets',        sub: '< 30 kg, multi-points', tag: 'Eur ⇄ Afr', delay: '5-10 jours' },
  { id: 'merch', icon: I.pallet, title: 'Marchandise volumineuse', sub: 'Palettes, machines, mobilier', tag: 'Eur ⇄ Afr', delay: '7-21 jours' },
];

// ─── Sample shipment data (reused everywhere) ───────────────────────────────
const MISSION = {
  ref: 'AX-2847',
  service: 'Convoyage voiture',
  vehicle: 'BMW Série 3 · 2022 · GA-372-LM',
  from: 'Paris 15ᵉ',
  to: 'Bruxelles, Schaerbeek',
  driver: { name: 'Karim Diallo', rating: 4.9, missions: 142 },
  eta: '14h32',
  distance: '312 km',
  remaining: '47 km',
  progress: 0.78,
  status: 'en-route',
  picked: '11h08',
};

const MISSION_AFR = {
  ref: 'AX-2811',
  service: 'Marchandise · 4 palettes',
  vehicle: 'Conteneur 20"',
  from: 'Lyon, Vénissieux',
  to: 'Abidjan, Port Autonome',
  driver: { name: 'Souleymane B.', rating: 4.8, missions: 86 },
  eta: 'Lun. 24/05',
  status: 'douane',
  step: 'Douane Marseille — sortie maritime',
  progress: 0.42,
};

// ─── Screen: Onboarding ─────────────────────────────────────────────────────
function CL_Onboarding({ go }) {
  const t = useAxis();
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: t.bg }}>
      <div style={{ flex: 1, padding: '108px 28px 0', position: 'relative' }}>
        {/* Decorative gold arc */}
        <svg viewBox="0 0 400 400" style={{ position: 'absolute', top: -80, right: -160, width: 480, opacity: 0.18 }}>
          <circle cx="200" cy="200" r="190" stroke={t.gold} strokeWidth="1.2" fill="none"/>
          <circle cx="200" cy="200" r="140" stroke={t.gold} strokeWidth="1" fill="none"/>
          <circle cx="200" cy="200" r="90" stroke={t.gold} strokeWidth="1" fill="none"/>
        </svg>

        <AxisMark size={56}/>
        <div style={{ fontFamily: AXIS_DISPLAY, fontWeight: 700, fontSize: 46, lineHeight: 1.02, color: t.ink,
          marginTop: 56, letterSpacing: '-.02em',
        }}>
          Le transport,<br/>
          <span style={{ color: t.goldDeep, fontWeight: 700 }}>au cordeau.</span>
        </div>
        <p style={{ fontSize: 15.5, color: t.inkSoft, lineHeight: 1.5, marginTop: 18, maxWidth: 320 }}>
          Convoyage de véhicules en Europe, import-export de marchandises vers l'Afrique. Devis sur mesure, suivi en temps réel, documents officiels signés depuis ton téléphone.
        </p>
      </div>

      <div style={{ padding: '0 24px 36px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Button kind="gold" size="lg" full onClick={() => go('home')} iconRight={I.arrow({ size: 18 })}>
          Continuer en tant que client
        </Button>
        <Button kind="outline" size="lg" full onClick={() => go('home')}>
          Je suis chauffeur
        </Button>
        <div style={{ textAlign: 'center', marginTop: 10, fontSize: 13, color: t.muted }}>
          Déjà un compte ? <span style={{ color: t.ink, fontWeight: 540 }}>Connexion</span>
        </div>
      </div>
    </div>
  );
}

// ─── Screen: Home ───────────────────────────────────────────────────────────
function CL_Home({ go, openMenu }) {
  const t = useAxis();
  return (
    <div style={{ background: t.bg, minHeight: '100%' }}>
      {/* Header */}
      <div style={{ padding: '62px 20px 8px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={openMenu} aria-label="Menu" style={{
          width: 42, height: 42, borderRadius: 12, border: `1px solid ${t.line}`,
          background: t.surface, color: t.ink,
          display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0,
        }}>
          {I.sliders({ size: 20 })}
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, color: t.muted, letterSpacing: '.02em' }}>Bonsoir,</div>
          <div style={{ fontSize: 17, fontWeight: 600, color: t.ink, lineHeight: 1.1 }}>Léa Marchand</div>
        </div>
        <button style={{
          width: 42, height: 42, borderRadius: 12, border: `1px solid ${t.line}`,
          background: t.surface, display: 'grid', placeItems: 'center', color: t.ink, position: 'relative', cursor: 'pointer',
        }}>
          {I.bell({ size: 20 })}
          <span style={{ position: 'absolute', top: 9, right: 11, width: 7, height: 7, borderRadius: '50%', background: t.gold, boxShadow: `0 0 0 2px ${t.surface}` }}/>
        </button>
      </div>

      <div style={{ padding: '6px 20px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* Active mission hero */}
        <Surface style={{ padding: 16, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Pill tone="navy">● En route</Pill>
            <span style={{ fontSize: 11.5, color: t.muted, letterSpacing: '.06em', textTransform: 'uppercase' }}>{MISSION.ref}</span>
          </div>
          <div style={{ fontFamily: AXIS_DISPLAY, fontWeight: 700, fontSize: 28, lineHeight: 1.05, color: t.ink, letterSpacing: '-.01em' }}>
            {MISSION.from}<br/>
            <span style={{ color: t.muted, fontWeight: 400 }}>vers</span> {MISSION.to}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginTop: 14, marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 10.5, color: t.muted, textTransform: 'uppercase', letterSpacing: '.08em' }}>Arrivée prévue</div>
              <div style={{ fontFamily: AXIS_DISPLAY, fontWeight: 700, fontSize: 26, color: t.ink, lineHeight: 1 }}>{MISSION.eta}</div>
            </div>
            <div style={{ flex: 1 }}/>
            <div>
              <div style={{ fontSize: 10.5, color: t.muted, textTransform: 'uppercase', letterSpacing: '.08em' }}>Restant</div>
              <div style={{ fontFamily: AXIS_DISPLAY, fontWeight: 700, fontSize: 26, color: t.ink, lineHeight: 1 }}>{MISSION.remaining}</div>
            </div>
          </div>
          {/* Progress */}
          <div style={{ height: 4, background: t.bgSoft, borderRadius: 2, overflow: 'hidden', marginBottom: 14 }}>
            <div style={{ width: `${MISSION.progress * 100}%`, height: '100%', background: t.gold, borderRadius: 2 }}/>
          </div>
          {/* Driver row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Avatar name={MISSION.driver.name} size={36} tone="gold"/>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 540, color: t.ink }}>{MISSION.driver.name}</div>
              <div style={{ fontSize: 11.5, color: t.muted, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ color: t.gold }}>{I.star({ size: 12 })}</span>{MISSION.driver.rating} · Ton chauffeur
              </div>
            </div>
            <Button kind="outline" size="sm" icon={I.phone({ size: 14 })}>Appeler</Button>
            <Button kind="primary" size="sm" onClick={() => go('track')}>Suivre</Button>
          </div>
        </Surface>

        {/* Quick actions */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 10 }}>
          <button onClick={() => go('new')} style={{
            border: `1px solid ${t.navy}`, background: t.navy, color: '#F5F1E8',
            padding: 16, borderRadius: 16, textAlign: 'left', cursor: 'pointer', position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', right: -20, top: -20, opacity: .12, color: t.gold }}>{I.bolt({ size: 90 })}</div>
            <div style={{ fontSize: 11.5, color: t.gold, letterSpacing: '.08em', textTransform: 'uppercase' }}>Nouvelle demande</div>
            <div style={{ fontFamily: AXIS_DISPLAY, fontWeight: 700, fontSize: 24, lineHeight: 1.05, marginTop: 6 }}>Convoyer ou expédier</div>
            <div style={{ fontSize: 12, color: 'rgba(245,241,232,.65)', marginTop: 10 }}>4 services · réponse sous 2h</div>
          </button>
          <button onClick={() => go('docs')} style={{
            border: `1px solid ${t.line}`, background: t.surface, color: t.ink,
            padding: 16, borderRadius: 16, textAlign: 'left', cursor: 'pointer',
          }}>
            <div style={{ color: t.gold }}>{I.doc({ size: 24 })}</div>
            <div style={{ fontSize: 14, fontWeight: 600, marginTop: 10, lineHeight: 1.15 }}>Documents<br/>& factures</div>
            <div style={{ fontSize: 11.5, color: t.muted, marginTop: 6 }}>3 à signer</div>
          </button>
        </div>

        {/* Second mission */}
        <Surface style={{ padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <Pill tone="gold">● Douane</Pill>
            <span style={{ fontSize: 11, color: t.muted }}>{MISSION_AFR.ref}</span>
          </div>
          <div style={{ fontSize: 14, fontWeight: 540, color: t.ink, marginBottom: 2 }}>
            {MISSION_AFR.from} → {MISSION_AFR.to}
          </div>
          <div style={{ fontSize: 12, color: t.muted, marginBottom: 10 }}>{MISSION_AFR.step}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, height: 3, background: t.bgSoft, borderRadius: 2 }}>
              <div style={{ width: `${MISSION_AFR.progress * 100}%`, height: '100%', background: t.gold, borderRadius: 2 }}/>
            </div>
            <span style={{ fontSize: 12, color: t.muted }}>Arrivée {MISSION_AFR.eta}</span>
          </div>
        </Surface>

        {/* News preview */}
        <div>
          <SectionHead title="Actualités transport" action={<span style={{ fontSize: 12.5, color: t.ink, fontWeight: 540 }}>Voir tout</span>}/>
          <Surface padded>
            <Pill tone="gold">Réglementation</Pill>
            <div style={{ fontSize: 14.5, fontWeight: 600, color: t.ink, marginTop: 10, lineHeight: 1.3, letterSpacing: '-.005em' }}>
              Nouveau document douanier obligatoire pour les exports véhicules vers le Sénégal
            </div>
            <div style={{ fontSize: 12, color: t.muted, marginTop: 6, display: 'flex', gap: 6 }}>
              <span>Il y a 2 j</span><span>·</span><span>Lecture 3 min</span>
            </div>
          </Surface>
        </div>
      </div>
    </div>
  );
}

// ─── Screen: New Demand · Type picker ───────────────────────────────────────
function CL_NewType({ go, setDraft, draft }) {
  const t = useAxis();
  return (
    <div style={{ background: t.bg, minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      <AppBar title="Nouvelle demande" subtitle="Étape 1 sur 2" onBack={() => go('home')}/>
      <div style={{ padding: '14px 20px 24px', flex: 1 }}>
        <div style={{ fontFamily: AXIS_DISPLAY, fontWeight: 700, fontSize: 28, lineHeight: 1.05, color: t.ink, letterSpacing: '-.01em', marginBottom: 6 }}>
          Que veux-tu <span style={{ color: t.goldDeep, fontWeight: 700 }}>transporter</span> ?
        </div>
        <p style={{ fontSize: 13.5, color: t.muted, marginBottom: 18 }}>
          Choisis le service, nos équipes te rappellent sous 2h avec un devis personnalisé.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {SERVICES.map((s) => {
            const sel = draft.service === s.id;
            return (
              <button key={s.id} onClick={() => setDraft({ ...draft, service: s.id })} style={{
                textAlign: 'left', cursor: 'pointer', padding: 14,
                background: sel ? t.surface : t.surface2,
                border: `1.5px solid ${sel ? t.select : t.line}`,
                borderRadius: 16, position: 'relative', minHeight: 152,
                display: 'flex', flexDirection: 'column', gap: 6, color: t.ink,
              }}>
                {sel && (
                  <div style={{ position: 'absolute', top: 10, right: 10, width: 22, height: 22, borderRadius: '50%', background: t.select, display: 'grid', placeItems: 'center', color: t.selectInk }}>
                    {I.check({ size: 14, stroke: 2.4 })}
                  </div>
                )}
                <div style={{ color: sel ? t.gold : t.navy, marginBottom: 4 }}>{s.icon({ size: 30, stroke: 1.5 })}</div>
                <div style={{ fontSize: 14.5, fontWeight: 600, lineHeight: 1.15, letterSpacing: '-.005em' }}>{s.title}</div>
                <div style={{ fontSize: 12, color: t.muted, lineHeight: 1.3 }}>{s.sub}</div>
                <div style={{ marginTop: 'auto', display: 'flex', gap: 6 }}>
                  <Pill tone="default" style={{ fontSize: 10.5, padding: '3px 7px' }}>{s.tag}</Pill>
                  <Pill tone="ghost" style={{ fontSize: 10.5, padding: '3px 7px' }}>{s.delay}</Pill>
                </div>
              </button>
            );
          })}
        </div>

        {/* Insurance preview */}
        <Surface style={{ marginTop: 18, padding: '14px 14px', display: 'flex', gap: 12, alignItems: 'center' }} soft>
          <div style={{ color: t.gold }}>{I.shield({ size: 28 })}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 540, color: t.ink }}>Assurance tous risques incluse</div>
            <div style={{ fontSize: 11.5, color: t.muted, marginTop: 2 }}>Jusqu'à 250 000 €, signature électronique des documents</div>
          </div>
        </Surface>
      </div>

      <div style={{ padding: '12px 20px 24px', background: t.surface, borderTop: `1px solid ${t.line}` }}>
        <Button kind="primary" full size="lg" disabled={!draft.service}
          onClick={() => go('newForm')} iconRight={I.arrow({ size: 18 })}>
          Continuer
        </Button>
      </div>
    </div>
  );
}

// ─── Screen: New Demand · Form ──────────────────────────────────────────────
function CL_NewForm({ go, draft }) {
  const t = useAxis();
  const svc = SERVICES.find(s => s.id === draft.service) || SERVICES[0];
  return (
    <div style={{ background: t.bg, minHeight: '100%' }}>
      <AppBar title={svc.title} subtitle="Étape 2 sur 2 · détails" onBack={() => go('new')}/>
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Surface padded>
          <SectionHead title="Trajet"/>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Field label="Départ" value="Paris 15ᵉ — 42 rue Lecourbe" icon={<span style={{ color: t.gold }}>●</span>}/>
            <div style={{ position: 'relative', marginLeft: 8 }}>
              <div style={{ position: 'absolute', left: -3, top: -10, bottom: -10, width: 1.5, borderLeft: `1.5px dashed ${t.line}` }}/>
            </div>
            <Field label="Arrivée" value="Bruxelles — Schaerbeek" icon={<span style={{ color: t.navy }}>◆</span>}/>
          </div>
        </Surface>

        <Surface padded>
          <SectionHead title="Quand"/>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Enlèvement" value="22 mai" icon={I.calendar({ size: 18 })}/>
            <Field label="Créneau" value="Matin (8h-12h)" suffix="▾"/>
          </div>
        </Surface>

        <Surface padded>
          <SectionHead title={svc.id === 'car' ? 'Véhicule' : svc.id === 'moto' ? 'Moto' : 'Marchandise'}/>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {svc.id === 'car' && (
              <>
                <Field label="Marque & modèle" value="BMW Série 3 — 320d"/>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 10 }}>
                  <Field label="Immatriculation" value="GA-372-LM"/>
                  <Field label="Année" value="2022"/>
                </div>
                <Field label="Notes (optionnel)" rows={2} placeholder="Particularités, accès, codes…"/>
              </>
            )}
            {svc.id === 'merch' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <Field label="Volume" value="4 palettes EUR"/>
                  <Field label="Poids estimé" value="1 250 kg"/>
                </div>
                <Field label="Description" rows={2} value="Mobilier de bureau, matériel informatique non dangereux"/>
              </>
            )}
            {(svc.id === 'colis' || svc.id === 'moto') && (
              <>
                <Field label="Description" value={svc.id === 'moto' ? 'Yamaha MT-07, 2021' : 'Carton 60×40×30, 12kg'}/>
                <Field label="Valeur déclarée" value="3 800 €" icon={I.euro({ size: 18 })}/>
              </>
            )}
          </div>
        </Surface>

        <Surface padded>
          <SectionHead title="Photos" action={<span style={{ fontSize: 12, color: t.muted }}>2 sur 6</span>}/>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {[0,1,2,3,4,5].map((i) => {
              const filled = i < 2;
              return (
                <div key={i} style={{
                  aspectRatio: '1', borderRadius: 10,
                  background: filled
                    ? `linear-gradient(135deg, ${t.navy} 0%, ${t.navyDeep} 100%)`
                    : t.bgSoft,
                  border: `1px ${filled ? 'solid' : 'dashed'} ${filled ? t.navy : t.line}`,
                  display: 'grid', placeItems: 'center', color: filled ? t.gold : t.muted,
                  cursor: 'pointer',
                }}>
                  {filled ? I.check({ size: 20, stroke: 2 }) : I.camera({ size: 22 })}
                </div>
              );
            })}
          </div>
        </Surface>
      </div>

      <div style={{ padding: '12px 20px 24px', background: t.surface, borderTop: `1px solid ${t.line}` }}>
        <Button kind="gold" full size="lg" onClick={() => go('quote')} iconRight={I.arrow({ size: 18 })}>
          Calculer le devis
        </Button>
        <div style={{ textAlign: 'center', fontSize: 11.5, color: t.muted, marginTop: 8 }}>
          Estimation instantanée · tarif TTC · sans engagement
        </div>
      </div>
    </div>
  );
}

// ─── Screen: Tracking (real-time) ───────────────────────────────────────────
function CL_Track({ go }) {
  const t = useAxis();
  return (
    <div style={{ background: t.bg, minHeight: '100%', position: 'relative' }}>
      <AppBar
        title="Suivi en temps réel"
        subtitle={`${MISSION.ref} · ${MISSION.vehicle}`}
        onBack={() => go('home')}
        trailing={<button style={{ width: 36, height: 36, borderRadius: 10, border: 'none', background: t.bgSoft, color: t.ink, display: 'grid', placeItems: 'center', cursor: 'pointer' }}>{I.more({ size: 18 })}</button>}
      />
      {/* Large map */}
      <div style={{ padding: '12px 16px 0' }}>
        <RouteMap height={300} dark={t.name === 'dark'} progress={MISSION.progress} from={MISSION.from} to={MISSION.to}/>
      </div>

      {/* Status strip */}
      <div style={{ padding: '14px 20px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
        <StatusBadge status={MISSION.status}/>
        <Pill tone="default">{MISSION.distance}</Pill>
        <div style={{ flex: 1 }}/>
        <span style={{ fontSize: 11.5, color: t.muted }}>MAJ il y a 12 s</span>
      </div>

      {/* Sheet */}
      <Surface style={{ margin: 16, padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar name={MISSION.driver.name} size={48} tone="gold"/>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14.5, fontWeight: 600, color: t.ink }}>{MISSION.driver.name}</div>
            <div style={{ fontSize: 12, color: t.muted, display: 'flex', alignItems: 'center', gap: 6, marginTop: 1 }}>
              <span style={{ color: t.gold, display: 'inline-flex' }}>{I.star({ size: 12 })}</span>
              {MISSION.driver.rating} · {MISSION.driver.missions} convoyages · Chauffeur Axis
            </div>
          </div>
          <button style={{ width: 40, height: 40, borderRadius: 12, border: `1px solid ${t.line}`, background: t.surface, color: t.ink, display: 'grid', placeItems: 'center', cursor: 'pointer' }}>{I.phone({ size: 18 })}</button>
          <button onClick={() => go('msg')} style={{ width: 40, height: 40, borderRadius: 12, border: 'none', background: t.navy, color: '#F5F1E8', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>{I.chat({ size: 18 })}</button>
        </div>

        <div style={{ height: 1, background: t.line, margin: '14px 0' }}/>

        {/* Timeline */}
        {[
          { label: 'Demande validée', time: '20 mai · 09:14', done: true },
          { label: 'État des lieux signé', time: '22 mai · 11:08', done: true, sub: 'Par le chauffeur — état impeccable' },
          { label: 'En route', time: 'Maintenant', current: true, sub: `${MISSION.remaining} restants · ${MISSION.eta}` },
          { label: 'État des lieux d\'arrivée', time: 'Prévu 14:32', done: false },
          { label: 'Livré', time: '—', done: false },
        ].map((step, i, a) => (
          <div key={i} style={{ display: 'flex', gap: 12, paddingBottom: i === a.length - 1 ? 0 : 14 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{
                width: 18, height: 18, borderRadius: '50%',
                background: step.done ? t.good : step.current ? t.gold : t.bgSoft,
                border: `2px solid ${step.done ? t.good : step.current ? t.gold : t.line}`,
                display: 'grid', placeItems: 'center', color: '#fff',
                boxShadow: step.current ? `0 0 0 4px rgba(194,162,74,.18)` : 'none',
              }}>
                {step.done && I.check({ size: 10, stroke: 3 })}
              </div>
              {i < a.length - 1 && <div style={{ flex: 1, width: 1.5, background: step.done ? t.good : t.line, marginTop: 2 }}/>}
            </div>
            <div style={{ flex: 1, paddingBottom: 4 }}>
              <div style={{ fontSize: 13.5, fontWeight: step.current ? 600 : 540, color: step.done || step.current ? t.ink : t.muted }}>{step.label}</div>
              <div style={{ fontSize: 11.5, color: t.muted, marginTop: 1 }}>{step.time}</div>
              {step.sub && <div style={{ fontSize: 12, color: t.inkSoft, marginTop: 4 }}>{step.sub}</div>}
            </div>
          </div>
        ))}
      </Surface>
    </div>
  );
}

// ─── Screen: Documents ──────────────────────────────────────────────────────
function CL_Docs({ go }) {
  const t = useAxis();
  const [tab, setTab] = React.useState('all');
  const filters = [
    { id: 'all',    label: 'Tous',     count: 12 },
    { id: 'contrat',label: 'Contrats', count: 4 },
    { id: 'fact',   label: 'Factures', count: 5 },
    { id: 'cmr',    label: 'CMR',      count: 2 },
    { id: 'douane', label: 'Douane',   count: 1 },
  ];
  const docs = [
    { id: 1, type: 'À signer', tone: 'warn', title: 'Contrat de convoyage', ref: 'AX-2847 · BMW Série 3', date: '22 mai 2026', size: '178 ko', icon: I.sig },
    { id: 2, type: 'Contrat',   tone: 'navy', title: 'État des lieux — départ', ref: 'AX-2847 · BMW Série 3', date: '22 mai 2026', size: '2,1 Mo', icon: I.doc },
    { id: 3, type: 'CMR',       tone: 'gold', title: 'Lettre de voiture internationale', ref: 'AX-2811 · 4 palettes', date: '18 mai 2026', size: '320 ko', icon: I.globe },
    { id: 4, type: 'Douane',    tone: 'gold', title: 'Déclaration export — Sénégal', ref: 'AX-2811', date: '17 mai 2026', size: '440 ko', icon: I.globe },
    { id: 5, type: 'Facture',   tone: 'good', title: 'FA-2026-0184',  ref: '512,00 € · Payé', date: '14 mai 2026', size: '64 ko',  icon: I.euro },
    { id: 6, type: 'Facture',   tone: 'warn', title: 'FA-2026-0179',  ref: '1 240,00 € · À régler', date: '08 mai 2026', size: '68 ko',  icon: I.euro },
  ];
  return (
    <div style={{ background: t.bg, minHeight: '100%' }}>
      <AppBar title="Documents" subtitle="Signature, factures, douane" onBack={() => go('home')}
        trailing={<button style={{ width: 36, height: 36, borderRadius: 10, border: 'none', background: t.bgSoft, color: t.ink, display: 'grid', placeItems: 'center', cursor: 'pointer' }}>{I.search({ size: 18 })}</button>}
      />

      {/* Filter rail */}
      <div style={{ padding: '8px 16px 6px', display: 'flex', gap: 8, overflowX: 'auto' }}>
        {filters.map((f) => {
          const on = f.id === tab;
          return (
            <button key={f.id} onClick={() => setTab(f.id)} style={{
              flexShrink: 0, padding: '8px 14px', borderRadius: 999,
              border: `1px solid ${on ? t.select : t.line}`,
              background: on ? t.select : t.surface,
              color: on ? t.selectInk : t.ink,
              fontSize: 13, fontWeight: 540, fontFamily: AXIS_FONT, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              {f.label}
              <span style={{ fontSize: 11, opacity: .7 }}>{f.count}</span>
            </button>
          );
        })}
      </div>

      {/* Pending signature highlight */}
      <div style={{ padding: '12px 16px 4px' }}>
        <Surface style={{
          padding: 14, background: `linear-gradient(135deg, ${t.navy} 0%, ${t.navyDeep} 100%)`,
          border: 'none', color: '#F5F1E8',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(194,162,74,.18)', color: t.goldHi, display: 'grid', placeItems: 'center' }}>{I.sig({ size: 22 })}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, color: t.goldHi, letterSpacing: '.08em', textTransform: 'uppercase' }}>À signer</div>
              <div style={{ fontSize: 14.5, fontWeight: 600, lineHeight: 1.2, marginTop: 2 }}>Contrat de convoyage AX-2847</div>
            </div>
            <Button kind="gold" size="sm">Signer</Button>
          </div>
        </Surface>
      </div>

      <div style={{ padding: '8px 16px 24px' }}>
        {docs.map((d, i) => (
          <div key={d.id} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '14px 4px', borderBottom: i === docs.length - 1 ? 'none' : `1px solid ${t.lineSoft}`,
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 10, flexShrink: 0,
              background: t.bgSoft, color: t.navy, display: 'grid', placeItems: 'center',
            }}>{d.icon({ size: 22 })}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <Pill tone={d.tone} style={{ fontSize: 10, padding: '2px 7px' }}>{d.type}</Pill>
                <span style={{ fontSize: 11, color: t.muted }}>· {d.size}</span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 540, color: t.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.title}</div>
              <div style={{ fontSize: 11.5, color: t.muted, marginTop: 2 }}>{d.ref} · {d.date}</div>
            </div>
            <button style={{ width: 36, height: 36, borderRadius: 10, border: 'none', background: 'transparent', color: t.muted, display: 'grid', placeItems: 'center', cursor: 'pointer' }}>{I.download({ size: 18 })}</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Screen: Messages ───────────────────────────────────────────────────────
function CL_Msg({ go }) {
  const t = useAxis();
  return (
    <div style={{ background: t.bg, minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      <AppBar
        title={MISSION.driver.name}
        subtitle={`En route · ${MISSION.ref}`}
        onBack={() => go('track')}
        leading={<Avatar name={MISSION.driver.name} size={36} tone="gold"/>}
        trailing={<button style={{ width: 36, height: 36, borderRadius: 10, border: 'none', background: t.bgSoft, color: t.ink, display: 'grid', placeItems: 'center', cursor: 'pointer' }}>{I.phone({ size: 18 })}</button>}
      />

      <div style={{ flex: 1, padding: 18, display: 'flex', flexDirection: 'column', gap: 10, overflow: 'auto' }}>
        <div style={{ textAlign: 'center', fontSize: 11, color: t.muted, padding: '6px 0' }}>Aujourd'hui, 13:42</div>

        {/* System bubble */}
        <Surface style={{ alignSelf: 'center', padding: '6px 12px', borderRadius: 999, fontSize: 12, color: t.inkSoft, background: t.surface2, boxShadow: 'none' }} bordered={false}>
          {MISSION.driver.name.split(' ')[0]} a démarré le trajet
        </Surface>

        {/* Driver msg */}
        <div style={{ alignSelf: 'flex-start', maxWidth: '78%' }}>
          <Surface style={{ padding: '10px 14px', borderRadius: '14px 14px 14px 4px', background: t.surface }}>
            <div style={{ fontSize: 14, color: t.ink, lineHeight: 1.4 }}>Bonjour Léa, je viens de récupérer la voiture. Tout est en ordre, l'état des lieux est dans l'app.</div>
          </Surface>
          <div style={{ fontSize: 10.5, color: t.muted, marginTop: 4, marginLeft: 8 }}>13:42</div>
        </div>

        {/* My msg */}
        <div style={{ alignSelf: 'flex-end', maxWidth: '78%' }}>
          <div style={{ padding: '10px 14px', borderRadius: '14px 14px 4px 14px', background: t.navy, color: '#F5F1E8', fontSize: 14, lineHeight: 1.4 }}>
            Parfait, merci ! L'arrivée est prévue vers 14h30 ?
          </div>
          <div style={{ fontSize: 10.5, color: t.muted, marginTop: 4, marginRight: 8, textAlign: 'right' }}>13:43 ✓✓</div>
        </div>

        {/* Photo + text from driver */}
        <div style={{ alignSelf: 'flex-start', maxWidth: '78%' }}>
          <div style={{ borderRadius: '14px 14px 14px 4px', overflow: 'hidden', border: `1px solid ${t.line}`, background: t.surface }}>
            <div style={{
              height: 120, background: `linear-gradient(135deg, ${t.navy} 0%, ${t.navyDeep} 100%)`,
              display: 'grid', placeItems: 'center', color: t.gold,
            }}>{I.camera({ size: 32 })}</div>
            <div style={{ padding: '8px 14px 10px', fontSize: 13.5, color: t.ink, lineHeight: 1.4 }}>
              Oui, 14h32 normalement. Petit bouchon au sud de Lille, je te tiens au courant.
            </div>
          </div>
          <div style={{ fontSize: 10.5, color: t.muted, marginTop: 4, marginLeft: 8 }}>13:48</div>
        </div>

        {/* Quick replies */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
          {['Merci 🙏', 'Tout va bien ?', 'Préviens à 10 min', 'Photos arrivée'].map(q => (
            <Pill key={q} tone="ghost" style={{ padding: '6px 12px', cursor: 'pointer' }}>{q}</Pill>
          ))}
        </div>
      </div>

      {/* Composer */}
      <div style={{ padding: '10px 14px 14px', borderTop: `1px solid ${t.lineSoft}`, background: t.surface, display: 'flex', alignItems: 'center', gap: 10 }}>
        <button style={{ width: 36, height: 36, borderRadius: 10, border: 'none', background: t.bgSoft, color: t.ink, display: 'grid', placeItems: 'center', cursor: 'pointer' }}>{I.plus({ size: 18 })}</button>
        <div style={{
          flex: 1, height: 40, padding: '0 14px', borderRadius: 999,
          background: t.bgSoft, border: `1px solid ${t.line}`,
          display: 'flex', alignItems: 'center', color: t.faint, fontSize: 14,
        }}>Écrire un message…</div>
        <button style={{ width: 40, height: 40, borderRadius: 12, border: 'none', background: t.gold, color: t.navyDeep, display: 'grid', placeItems: 'center', cursor: 'pointer' }}>{I.arrow({ size: 18 })}</button>
      </div>
    </div>
  );
}

// ─── Screen: News (Actualités) ──────────────────────────────────────────────
function CL_News({ go }) {
  const t = useAxis();
  const news = [
    { tone: 'gold',    cat: 'Réglementation', title: 'Nouveau document douanier obligatoire pour les exports véhicules vers le Sénégal', summary: 'À partir du 1ᵉʳ juin 2026, le BSC (Bordereau de Suivi de Cargaison) devient obligatoire pour tout véhicule expédié vers Dakar.', date: 'Il y a 2 j', read: '3 min', tag: 'Afrique de l\'Ouest' },
    { tone: 'navy',    cat: 'Convoyage Europe', title: 'Crit\'Air 3 désormais interdit dans 4 nouvelles ZFE françaises', summary: 'Marseille, Strasbourg, Rouen et Reims rejoignent les ZFE strictes au 1ᵉʳ juillet. Impacts sur nos itinéraires sud-est.', date: 'Il y a 3 j', read: '4 min', tag: 'France' },
    { tone: 'good',    cat: 'Maritime',   title: 'Nouvelle ligne Marseille-Abidjan : -3 jours de transit', summary: 'CMA CGM ouvre une rotation hebdomadaire dédiée aux véhicules et aux conteneurs depuis le port d\'Anvers et de Marseille.', date: 'Il y a 5 j', read: '2 min', tag: 'Afrique' },
    { tone: 'default', cat: 'Pratique',   title: 'État des lieux : 5 angles à ne jamais oublier', summary: 'Notre équipe de convoyeurs partage la check-list complète d\'un état des lieux qui résiste aux litiges.', date: '12 mai', read: '5 min', tag: 'Guide' },
  ];
  return (
    <div style={{ background: t.bg, minHeight: '100%' }}>
      <AppBar title="Actualités transport" subtitle="Europe · Afrique · Réglementation" onBack={() => go('home')}
        trailing={<button style={{ width: 36, height: 36, borderRadius: 10, border: 'none', background: t.bgSoft, color: t.ink, display: 'grid', placeItems: 'center', cursor: 'pointer' }}>{I.filter({ size: 18 })}</button>}/>

      {/* Featured */}
      <div style={{ padding: '12px 16px 0' }}>
        <Surface style={{
          padding: 0, overflow: 'hidden',
          background: `linear-gradient(180deg, ${t.navy} 0%, ${t.navyDeep} 100%)`,
          border: 'none', color: '#F5F1E8',
        }}>
          <div style={{ height: 130, position: 'relative', overflow: 'hidden' }}>
            <svg viewBox="0 0 360 130" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: .5 }}>
              <defs>
                <linearGradient id="ng" x1="0" x2="1" y1="0" y2="1">
                  <stop offset="0" stopColor={t.gold} stopOpacity=".7"/>
                  <stop offset="1" stopColor={t.navyDeep}/>
                </linearGradient>
              </defs>
              <rect width="360" height="130" fill="url(#ng)"/>
              <path d="M-20 90 Q 90 50 180 80 T 380 70" stroke={t.goldHi} strokeWidth="1.5" fill="none" opacity=".6"/>
              <path d="M-20 110 Q 90 70 180 100 T 380 90" stroke={t.goldHi} strokeWidth="1.5" fill="none" opacity=".4"/>
              <circle cx="60" cy="40" r="4" fill={t.goldHi}/>
              <circle cx="280" cy="50" r="4" fill={t.goldHi}/>
            </svg>
            <Pill tone="gold" style={{ position: 'absolute', top: 14, left: 14, background: 'rgba(194,162,74,.25)', borderColor: 'rgba(194,162,74,.5)', color: '#F5F1E8' }}>À LA UNE</Pill>
          </div>
          <div style={{ padding: '14px 16px 16px' }}>
            <div style={{ fontFamily: AXIS_DISPLAY, fontWeight: 700, fontSize: 21, lineHeight: 1.15, letterSpacing: '-.01em' }}>
              Nouveau document douanier obligatoire pour les exports véhicules vers le Sénégal
            </div>
            <div style={{ fontSize: 12, color: 'rgba(245,241,232,.6)', marginTop: 8, display: 'flex', gap: 6 }}>
              <span>Il y a 2 j</span><span>·</span><span>Lecture 3 min</span>
            </div>
          </div>
        </Surface>
      </div>

      <div style={{ padding: '16px 16px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {news.slice(1).map((n, i) => (
          <Surface key={i} padded>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              <Pill tone={n.tone}>{n.cat}</Pill>
              <Pill tone="ghost">{n.tag}</Pill>
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: t.ink, lineHeight: 1.25, letterSpacing: '-.005em' }}>{n.title}</div>
            <div style={{ fontSize: 12.5, color: t.inkSoft, marginTop: 6, lineHeight: 1.4 }}>{n.summary}</div>
            <div style={{ fontSize: 11.5, color: t.muted, marginTop: 8, display: 'flex', gap: 6 }}>
              <span>{n.date}</span><span>·</span><span>Lecture {n.read}</span>
            </div>
          </Surface>
        ))}
      </div>
    </div>
  );
}

// ─── Screen: Quote (devis automatique) ─────────────────────────
function CL_Quote({ go, draft }) {
  const t = useAxis();
  const svc = SERVICES.find(s => s.id === draft.service) || SERVICES[0];
  const [express, setExpress] = React.useState(false);
  const [premium, setPremium] = React.useState(false);

  // Per-service pricing model. Europe convoyage = fixed instant.
  // Afrique = estimated, with disclaimer that customs may adjust it.
  const models = {
    car:   { base: 49,  km: 0.95, label: 'Convoyage routier',  unit: '/ km parcouru', isInstant: true,  distance: 312, distanceLabel: 'Paris 15ᵉ → Bruxelles' },
    moto:  { base: 39,  km: 0.78, label: 'Convoyage plateau', unit: '/ km parcouru', isInstant: true,  distance: 245, distanceLabel: 'Bordeaux → Toulouse' },
    colis: { base: 28,  km: 0.18, label: 'Acheminement multimodal', unit: '/ kg facturable', isInstant: false, distance: 12,  distanceLabel: 'Carton 60×40×30 · 12 kg' },
    merch: { base: 285, km: 1.40, label: 'Fret palettes', unit: '/ palette', isInstant: false, distance: 4,   distanceLabel: '4 palettes EUR · 1 250 kg' },
  };
  const m = models[svc.id];
  const tarif = Math.round(m.base + m.km * m.distance * (svc.id === 'colis' || svc.id === 'merch' ? 100 : 1));
  const expressFee = express ? Math.round(tarif * 0.22) : 0;
  const premiumFee = premium ? 35 : 0;
  const total = tarif + expressFee + premiumFee;

  return (
    <div style={{ background: t.bg, minHeight: '100%' }}>
      <AppBar title="Ton devis" subtitle={`${svc.title} · calculé en temps réel`} onBack={() => go('newForm')}
        trailing={<button style={{ width: 36, height: 36, borderRadius: 10, border: 'none', background: t.bgSoft, color: t.ink, display: 'grid', placeItems: 'center', cursor: 'pointer' }}>{I.download({ size: 18 })}</button>}/>

      <div style={{ padding: '14px 16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Hero quote card */}
        <div style={{
          padding: 20, borderRadius: 18, position: 'relative', overflow: 'hidden',
          background: `linear-gradient(150deg, ${t.navy} 0%, ${t.navyDeep} 70%)`,
          color: '#F5F1E8',
        }}>
          <svg viewBox="0 0 220 220" style={{ position: 'absolute', top: -50, right: -60, width: 260, opacity: .14, color: t.gold }}>
            <circle cx="110" cy="110" r="100" stroke="currentColor" strokeWidth="1" fill="none"/>
            <circle cx="110" cy="110" r="70"  stroke="currentColor" strokeWidth="1" fill="none"/>
            <circle cx="110" cy="110" r="40"  stroke="currentColor" strokeWidth="1" fill="none"/>
          </svg>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, position: 'relative' }}>
            {m.isInstant
              ? <Pill tone="gold" style={{ background: 'rgba(194,162,74,.2)', borderColor: 'rgba(194,162,74,.4)', color: t.goldHi }}>⚡ Devis instantané</Pill>
              : <Pill tone="gold" style={{ background: 'rgba(194,162,74,.2)', borderColor: 'rgba(194,162,74,.4)', color: t.goldHi }}>Devis estimé</Pill>}
            <span style={{ fontSize: 11, color: 'rgba(245,241,232,.5)' }}>Valable 48 h</span>
          </div>
          <div style={{ fontSize: 12, color: 'rgba(245,241,232,.65)', position: 'relative' }}>Prix tout compris TTC</div>
          <div style={{
            display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4,
            fontFamily: AXIS_DISPLAY, color: t.goldHi, letterSpacing: '-.02em',
            position: 'relative',
          }}>
            <span style={{ fontSize: 56, fontWeight: 700, lineHeight: 1 }}>{total.toLocaleString('fr-FR')}</span>
            <span style={{ fontSize: 24, fontWeight: 600 }}>€</span>
          </div>
          <div style={{ fontSize: 12, color: 'rgba(245,241,232,.6)', marginTop: 8, position: 'relative' }}>
            soit <strong style={{ color: '#F5F1E8' }}>{(total / (svc.id === 'merch' ? 4 : 1)).toFixed(svc.id === 'merch' ? 0 : 2).replace('.', ',')} €{svc.id === 'merch' ? ' / palette' : ''}</strong> · enlèvement sous 24-48 h
          </div>
        </div>

        {/* Breakdown */}
        <Surface padded>
          <SectionHead title="Détail du tarif"/>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {[
              { l: m.label, sub: `${m.distance} ${svc.id === 'colis' ? 'kg' : svc.id === 'merch' ? 'palettes' : 'km'} × ${m.km.toString().replace('.', ',')} € ${m.unit}`, v: Math.round(m.km * m.distance * (svc.id === 'colis' || svc.id === 'merch' ? 100 : 1)) + ' €' },
              { l: 'Forfait enlèvement & remise', sub: 'Créneau 2h, contact direct', v: m.base + ' €' },
              { l: 'Assurance tous risques', sub: `Jusqu'à 250 000 € · ${m.isInstant ? 'AXA Transport' : 'Allianz Marine'}`, v: 'Inclus', incl: true },
              { l: 'Suivi GPS temps réel', sub: 'MAJ toutes les 30 s', v: 'Inclus', incl: true },
              { l: 'Contrat & état des lieux PDF', sub: 'Signé électroniquement', v: 'Inclus', incl: true },
              ...(svc.id === 'colis' || svc.id === 'merch' ? [
                { l: 'Démarches douanières', sub: 'BSC, déclaration export', v: 'Inclus', incl: true },
              ] : []),
              ...(express ? [{ l: 'Option Express', sub: 'Livraison sous 24 h', v: '+ ' + expressFee + ' €', add: true }] : []),
              ...(premium ? [{ l: 'Assurance Premium', sub: 'Plafond porté à 500 000 €', v: '+ ' + premiumFee + ' €', add: true }] : []),
            ].map((row, i, a) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 0',
                borderBottom: i === a.length - 1 ? 'none' : `1px solid ${t.lineSoft}`,
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 500, color: t.ink }}>{row.l}</div>
                  <div style={{ fontSize: 11.5, color: t.muted, marginTop: 1 }}>{row.sub}</div>
                </div>
                <div style={{
                  fontSize: 13.5, fontVariantNumeric: 'tabular-nums', fontWeight: 540,
                  color: row.incl ? t.good : row.add ? t.goldDeep : t.ink,
                }}>{row.v}</div>
              </div>
            ))}
            <div style={{ display: 'flex', alignItems: 'baseline', padding: '14px 0 0', borderTop: `1.5px solid ${t.line}`, marginTop: 6 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: t.muted, letterSpacing: '.06em', textTransform: 'uppercase' }}>Total TTC</div>
                <div style={{ fontSize: 11, color: t.muted, marginTop: 2 }}>TVA 20 % incluse</div>
              </div>
              <div style={{ fontFamily: AXIS_DISPLAY, fontSize: 28, fontWeight: 700, color: t.ink, letterSpacing: '-.01em' }}>
                {total.toLocaleString('fr-FR')} €
              </div>
            </div>
          </div>
        </Surface>

        {/* Add-ons */}
        <Surface padded>
          <SectionHead title="Options"/>
          <AddOn
            label="Express — livraison sous 24 h"
            sub="Priorité absolue, chauffeur dédié"
            price={`+ ${Math.round(tarif * 0.22)} €`}
            icon={I.bolt}
            value={express}
            onChange={() => setExpress(!express)}
          />
          <AddOn
            label="Assurance Premium"
            sub="Plafond 250 000 € → 500 000 €"
            price="+ 35 €"
            icon={I.shield}
            value={premium}
            onChange={() => setPremium(!premium)}
          />
        </Surface>

        {/* Disclaimer Afrique */}
        {!m.isInstant && (
          <div style={{
            padding: '12px 14px', borderRadius: 12,
            background: 'rgba(194,162,74,.10)', border: `1px solid rgba(194,162,74,.3)`,
            display: 'flex', gap: 10, alignItems: 'flex-start',
          }}>
            <span style={{ color: t.goldDeep, flexShrink: 0, marginTop: 1 }}>{I.warn({ size: 18 })}</span>
            <div style={{ fontSize: 12.5, color: t.inkSoft, lineHeight: 1.45 }}>
              <strong style={{ color: t.ink }}>Estimation · transport vers l'Afrique.</strong> Le tarif final est confirmé sous 12h après vérification des documents douaniers (BSC, certificat origine). Marge ± 8 %.
            </div>
          </div>
        )}

        {/* Comparison strip */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            { ic: I.shield, l: 'Assurance 250k€' },
            { ic: I.pin,    l: 'Suivi temps réel' },
            { ic: I.doc,    l: 'Contrat signé PDF' },
            { ic: I.camera, l: 'État des lieux x16' },
          ].map(b => (
            <div key={b.l} style={{
              flex: '1 1 calc(50% - 4px)', minWidth: 0,
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 12px', borderRadius: 12,
              background: t.surface, border: `1px solid ${t.line}`,
            }}>
              <span style={{ color: t.gold, display: 'flex', flexShrink: 0 }}>{b.ic({ size: 16 })}</span>
              <span style={{ fontSize: 12, color: t.inkSoft, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.l}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Sticky CTA */}
      <div style={{ padding: '12px 16px 24px', background: t.surface, borderTop: `1px solid ${t.line}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button kind="outline" size="lg" full onClick={() => go('home')}>Sauvegarder</Button>
          <Button kind="gold" size="lg" full onClick={() => go('home')} iconRight={I.arrow({ size: 18 })}>
            Réserver
          </Button>
        </div>
        <button onClick={() => go('msg')} style={{
          border: 'none', background: 'transparent', color: t.muted,
          fontFamily: AXIS_FONT, fontSize: 12.5, cursor: 'pointer', padding: '4px 0',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          {I.chat({ size: 14 })}
          Tarif spécifique ? Parle à un conseiller
        </button>
      </div>
    </div>
  );
}

function AddOn({ label, sub, price, icon, value, onChange }) {
  const t = useAxis();
  return (
    <button onClick={onChange} style={{
      width: '100%', display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 4px', border: 'none', background: 'transparent',
      borderBottom: `1px solid ${t.lineSoft}`,
      cursor: 'pointer', textAlign: 'left',
    }}>
      <div style={{
        width: 34, height: 34, borderRadius: 10, flexShrink: 0,
        background: value ? t.gold : t.bgSoft,
        color: value ? t.navyDeep : t.navy,
        display: 'grid', placeItems: 'center',
      }}>{icon({ size: 17 })}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 540, color: t.ink, lineHeight: 1.2 }}>{label}</div>
        <div style={{ fontSize: 11.5, color: t.muted, marginTop: 2 }}>{sub}</div>
      </div>
      <div style={{ fontSize: 13, fontWeight: 540, color: value ? t.goldDeep : t.muted, fontVariantNumeric: 'tabular-nums' }}>{price}</div>
      <div style={{
        width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
        border: `1.8px solid ${value ? t.gold : t.line}`,
        background: value ? t.gold : 'transparent',
        color: t.navyDeep, display: 'grid', placeItems: 'center',
      }}>{value && I.check({ size: 13, stroke: 3 })}</div>
    </button>
  );
}

// ─── Router shell ───────────────────────────────────────────────────────────
function ClientApp({ initialRoute = 'home', initialDraft, dark: darkProp = false }) {
  const [route, setRoute] = React.useState(initialRoute);
  const [dark, setDark] = React.useState(darkProp);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [draft, setDraft] = React.useState(initialDraft || { service: 'car' });
  // Tweaks-driven dark prop overrides local until user toggles in-menu.
  React.useEffect(() => setDark(darkProp), [darkProp]);
  const t = dark ? AXIS_DARK : AXIS_LIGHT;

  const screens = {
    onboarding: <CL_Onboarding go={setRoute}/>,
    home:       <CL_Home go={setRoute} openMenu={() => setMenuOpen(true)}/>,
    new:        <CL_NewType go={setRoute} draft={draft} setDraft={setDraft}/>,
    newForm:    <CL_NewForm go={setRoute} draft={draft}/>,
    quote:      <CL_Quote go={setRoute} draft={draft}/>,
    track:      <CL_Track go={setRoute}/>,
    docs:       <CL_Docs go={setRoute}/>,
    msg:        <CL_Msg go={setRoute}/>,
    news:       <CL_News go={setRoute}/>,
  };

  const showTabs = !['onboarding'].includes(route);
  const tabActive = ({ new: 'new', newForm: 'new', quote: 'new', track: 'track', docs: 'docs', msg: 'msg', home: 'home' })[route] || 'home';

  return (
    <AxisProvider dark={dark}>
      <div style={{
        height: '100%', display: 'flex', flexDirection: 'column',
        background: t.bg, fontFamily: AXIS_FONT, color: t.ink,
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ flex: 1, overflow: 'auto' }}>{screens[route]}</div>
        {showTabs && <TabBar items={CLIENT_TABS} active={tabActive} onChange={(id) => setRoute(id)}/>}
        <ClientMenu
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          go={setRoute}
          dark={dark}
          toggleDark={() => setDark(d => !d)}
        />
      </div>
    </AxisProvider>
  );
}

Object.assign(window, { ClientApp });
