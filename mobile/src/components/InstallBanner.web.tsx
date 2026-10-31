// Bandeau « Installer l'appli » de la version web.
//
// L'application est distribuée par le site : il faut que chacun sache la
// poser sur son écran d'accueil, où elle s'ouvre ensuite en plein écran avec
// son icône. Android (Chrome) propose une installation en un geste via
// `beforeinstallprompt` ; iOS n'en a pas : on montre le chemin dans Safari.
//
// Android hors Chrome (Samsung Internet, Edge, Opera, Firefox, navigateur
// Xiaomi, navigateur intégré de Facebook…) : ces navigateurs fabriquent leur
// propre paquet d'installation, basé sur une ancienne version d'Android, et
// Android 14+ le bloque (« conçue pour une ancienne version d'Android »). On
// n'y propose donc pas d'installer : on envoie vers Chrome, dont le paquet
// est fabriqué par Google et s'installe sans alerte.
// Masqué une fois l'appli installée, ou pendant 14 jours après « Plus tard ».
import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { RADII, TYPO } from '../theme/tokens';
import { Button } from './Button';
import { Icons } from './Icons';

const DISMISS_KEY = 'axis.installBanner.dismissedAt';
const DISMISS_MS = 14 * 24 * 3600 * 1000;

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isInstalled(): boolean {
  try {
    return window.matchMedia('(display-mode: standalone)').matches
      || (navigator as unknown as { standalone?: boolean }).standalone === true;
  } catch {
    return false;
  }
}

function recentlyDismissed(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY) || 0);
    return at > 0 && Date.now() - at < DISMISS_MS;
  } catch {
    return false;
  }
}

type Kind = 'ios-safari' | 'ios-other' | 'android-prompt' | 'android-menu' | 'android-other' | null;

const ANDROID_NOT_CHROME =
  /SamsungBrowser|EdgA|OPR\/|Opera|OPT\/|Firefox|FxA|MiuiBrowser|XiaoMi|HuaweiBrowser|HeyTapBrowser|VivoBrowser|YaBrowser|UCBrowser|DuckDuckGo|FBAN|FBAV|FB_IAB|Instagram|Snapchat|TikTok|Line\/|; wv\)/;

/** Android avec un autre navigateur que Google Chrome. */
export function isAndroidNonChrome(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (!/Android/.test(ua)) return false;
  if (ANDROID_NOT_CHROME.test(ua)) return true;
  // Brave a la même signature que Chrome.
  if ((navigator as unknown as { brave?: unknown }).brave) return true;
  return !/Chrome\/\d+/.test(ua);
}

/** Ouvre la page courante dans Chrome (repli : Play Store de Chrome). */
export function openInChrome(): void {
  const { host, pathname, search, hash } = window.location;
  const fallback = encodeURIComponent('https://play.google.com/store/apps/details?id=com.android.chrome');
  window.location.href =
    `intent://${host}${pathname}${search}${hash}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${fallback};end`;
}

function detectKind(prompt: InstallPromptEvent | null): Kind {
  const ua = navigator.userAgent || '';
  const ios = /iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
  if (ios) return /CriOS|FxiOS|EdgiOS/.test(ua) ? 'ios-other' : 'ios-safari';
  if (/Android/.test(ua)) {
    if (isAndroidNonChrome()) return 'android-other';
    return prompt ? 'android-prompt' : 'android-menu';
  }
  return null; // ordinateur : pas de bandeau
}

export function InstallBanner() {
  const { theme } = useTheme();
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Hors Chrome sur Android, le bandeau revient malgré « Plus tard » :
    // c'est lui qui évite l'installation bloquée par Android.
    if (isInstalled() || (recentlyDismissed() && !isAndroidNonChrome())) return;
    const onPrompt = (e: Event) => {
      e.preventDefault();
      // Pas d'installation proposée par un navigateur dont le paquet est bloqué.
      if (!isAndroidNonChrome()) setPrompt(e as InstallPromptEvent);
    };
    const onInstalled = () => setVisible(false);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    const t = setTimeout(() => setVisible(true), 2500);
    return () => {
      clearTimeout(t);
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const kind = visible ? detectKind(prompt) : null;
  if (!kind) return null;

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* navigation privée */ }
    setVisible(false);
  };
  const install = async () => {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    setPrompt(null);
    if (outcome === 'accepted') setVisible(false);
  };

  const steps =
    kind === 'ios-safari'
      ? 'Touchez le bouton Partager (carré avec une flèche, en bas de Safari), puis «\u00a0Sur l\'écran d\'accueil\u00a0».'
      : kind === 'ios-other'
      ? 'Ouvrez cette page dans Safari, touchez Partager, puis «\u00a0Sur l\'écran d\'accueil\u00a0».'
      : kind === 'android-other'
      ? 'Ouvrez-la dans Google Chrome pour l\'installer : depuis ce navigateur, Android la bloque («\u00a0conçue pour une ancienne version d\'Android\u00a0»).'
      : kind === 'android-menu'
      ? 'Touchez le menu ⋮ de Chrome, puis «\u00a0Installer l\'application\u00a0» ou «\u00a0Ajouter à l\'écran d\'accueil\u00a0».'
      : 'Elle s\'ouvrira en plein écran depuis son icône, comme une application.';

  return (
    <View
      style={{
        position: 'absolute',
        left: 12,
        right: 12,
        bottom: 96,
        backgroundColor: theme.navy,
        borderRadius: RADII.xl,
        padding: 16,
        gap: 10,
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 8 },
        zIndex: 50,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: theme.gold, alignItems: 'center', justifyContent: 'center' }}>
          <Icons.plus size={20} color={theme.onGold} stroke={2.4} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ color: '#fff', fontSize: 15.5, fontFamily: TYPO.weights.bold }}>
            Installez l'appli Axis Import
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.82)', fontSize: 13, lineHeight: 18, fontFamily: TYPO.weights.medium }}>
            {steps}
          </Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Fermer" onPress={dismiss} hitSlop={10} style={{ padding: 4 }}>
          <Icons.x size={18} color="rgba(255,255,255,0.7)" stroke={2} />
        </Pressable>
      </View>
      {kind === 'android-other' ? (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button kind="gold" size="md" style={{ flex: 1.5 }} onPress={openInChrome}>
            Ouvrir dans Chrome
          </Button>
          <Pressable
            accessibilityRole="button"
            onPress={dismiss}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: RADII.lg, borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' }}
          >
            <Text style={{ color: '#fff', fontSize: 14.5, fontFamily: TYPO.weights.semibold }}>Plus tard</Text>
          </Pressable>
        </View>
      ) : null}
      {kind === 'android-prompt' ? (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button kind="gold" size="md" style={{ flex: 1 }} onPress={install}>
            Installer
          </Button>
          <Pressable
            accessibilityRole="button"
            onPress={dismiss}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: RADII.lg, borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' }}
          >
            <Text style={{ color: '#fff', fontSize: 14.5, fontFamily: TYPO.weights.semibold }}>Plus tard</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
