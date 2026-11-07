// app.jsx — Main canvas that mounts all Axis app artboards.

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "light",
  "showWordmark": true
}/*EDITMODE-END*/;

// Wrap a screen in an iOS frame on a tinted backdrop (for the artboard bg)
function Phone({ children, statusDark = false, dark = false, theme }) {
  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: dark
        ? 'radial-gradient(circle at 30% 20%, #142847 0%, #06182E 80%)'
        : 'radial-gradient(circle at 30% 20%, #FAF6EA 0%, #ECE3CB 100%)',
      padding: 24,
    }}>
      <IOSDevice width={372} height={804} dark={statusDark}>
        {children}
      </IOSDevice>
    </div>
  );
}

function Canvas() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const dark = t.theme === 'dark';

  return (
    <>
      <DesignCanvas>
        {/* ─── Section 1 · Client app ─────────────────────────────────── */}
        <DCSection id="client" title="App Client" subtitle="Particuliers et entreprises · iPhone — priorité du livrable">
          <DCArtboard id="cl-onboarding" label="01 · Bienvenue" width={420} height={840}>
            <Phone dark={dark}><ClientApp initialRoute="onboarding" dark={dark}/></Phone>
          </DCArtboard>
          <DCArtboard id="cl-home" label="02 · Accueil" width={420} height={840}>
            <Phone dark={dark}><ClientApp initialRoute="home" dark={dark}/></Phone>
          </DCArtboard>
          <DCArtboard id="cl-new-type" label="03 · Nouvelle demande" width={420} height={840}>
            <Phone dark={dark}><ClientApp initialRoute="new" dark={dark}/></Phone>
          </DCArtboard>
          <DCArtboard id="cl-new-form" label="04 · Détails de la demande" width={420} height={840}>
            <Phone dark={dark}><ClientApp initialRoute="newForm" dark={dark}/></Phone>
          </DCArtboard>
          <DCArtboard id="cl-quote" label="05 · Devis convoyage voiture" width={420} height={840}>
            <Phone dark={dark}><ClientApp initialRoute="quote" initialDraft={{ service: 'car' }} dark={dark}/></Phone>
          </DCArtboard>
          <DCArtboard id="cl-quote-colis" label="06 · Devis colis Europe → Afrique" width={420} height={840}>
            <Phone dark={dark}><ClientApp initialRoute="quote" initialDraft={{ service: 'colis' }} dark={dark}/></Phone>
          </DCArtboard>
          <DCArtboard id="cl-track" label="07 · Suivi temps réel" width={420} height={840}>
            <Phone dark={dark}><ClientApp initialRoute="track" dark={dark}/></Phone>
          </DCArtboard>
          <DCArtboard id="cl-docs" label="08 · Documents & factures" width={420} height={840}>
            <Phone dark={dark}><ClientApp initialRoute="docs" dark={dark}/></Phone>
          </DCArtboard>
          <DCArtboard id="cl-msg" label="09 · Messagerie chauffeur" width={420} height={840}>
            <Phone dark={dark}><ClientApp initialRoute="msg" dark={dark}/></Phone>
          </DCArtboard>
          <DCArtboard id="cl-news" label="10 · Actualités transport" width={420} height={840}>
            <Phone dark={dark}><ClientApp initialRoute="news" dark={dark}/></Phone>
          </DCArtboard>
        </DCSection>

        {/* ─── Section 2 · Driver app ─────────────────────────────────── */}
        <DCSection id="driver" title="App Chauffeur" subtitle="Convoyeurs Axis + chauffeurs externes inscrits — iPhone">
          <DCArtboard id="dr-home" label="01 · Missions" width={420} height={840}>
            <Phone dark={dark} statusDark><DriverApp initialRoute="home" dark={dark}/></Phone>
          </DCArtboard>
          <DCArtboard id="dr-etat" label="02 · État des lieux guidé" width={420} height={840}>
            <Phone dark={dark}><DriverApp initialRoute="etat" dark={dark}/></Phone>
          </DCArtboard>
          <DCArtboard id="dr-contract" label="03 · Contrat & signature" width={420} height={840}>
            <Phone dark={dark}><DriverApp initialRoute="contract" dark={dark}/></Phone>
          </DCArtboard>
        </DCSection>

        {/* ─── Section 3 · Admin web ──────────────────────────────────── */}
        <DCSection id="admin" title="Admin Web" subtitle="Outils opérations — Marc, dispatchers, gestion litiges">
          <DCArtboard id="adm-dashboard" label="Tableau de bord" width={1280} height={820}>
            <div style={{
              width: '100%', height: '100%',
              background: dark ? '#06182E' : '#E8E0CD',
              padding: 18, boxSizing: 'border-box',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <ChromeWindow
                width={1244} height={780}
                tabs={[{ title: 'Axis Ops · Tableau de bord' }, { title: 'Mission AX-2847' }]}
                activeIndex={0}
                url="ops.axis-mobility.com/dashboard"
              >
                <AdminView dark={dark}/>
              </ChromeWindow>
            </div>
          </DCArtboard>
        </DCSection>

        {/* Post-it note */}
        <DCPostIt top={24} right={36} rotate={2.5} width={220}>
          <strong>Note design</strong><br/>
          Palette ivoire+navy+or, typo Geist/Instrument Serif.
          Tu peux basculer clair/sombre, masquer le wordmark via Tweaks.
        </DCPostIt>
      </DesignCanvas>

      <TweaksPanel>
        <TweakSection label="Thème"/>
        <TweakRadio label="Mode" value={t.theme} options={['light', 'dark']}
          onChange={(v) => setTweak('theme', v)}/>
        <TweakSection label="Identité"/>
        <TweakToggle label="Wordmark visible" value={t.showWordmark}
          onChange={(v) => setTweak('showWordmark', v)}/>
      </TweaksPanel>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<Canvas/>);
