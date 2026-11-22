import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export type DetectedPlatformOS =
  | 'smarttv'
  | 'android'
  | 'ios'
  | 'windows'
  | 'macos'
  | 'linux'
  | 'other';

export function detectDeviceOS(): DetectedPlatformOS {
  if (typeof window === 'undefined') return 'other';
  const ua = (window.navigator.userAgent || '').toLowerCase();
  const platform = (window.navigator.platform || '').toLowerCase();

  if (/smarttv|smart-tv|tizen|web0s|webos|netcast|hbbtv|android tv|bravia|appletv|firetv|aft/i.test(ua)) {
    return 'smarttv';
  }
  if (/iphone|ipad|ipod/.test(ua) || (platform === 'macintel' && (window.navigator.maxTouchPoints || 0) > 1)) {
    return 'ios';
  }
  if (/android/.test(ua)) {
    return 'android';
  }
  if (/win/.test(platform) || /windows/.test(ua)) {
    return 'windows';
  }
  if (/mac/.test(platform) || /macintosh|mac os x/.test(ua)) {
    return 'macos';
  }
  if (/linux/.test(platform) || /linux|x11/.test(ua)) {
    return 'linux';
  }
  return 'other';
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [detectedOS, setDetectedOS] = useState<DetectedPlatformOS>('other');

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    const os = detectDeviceOS();
    setDetectedOS(os);
    setIsIOS(os === 'ios');

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  };

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    detectedOS,
    install,
  };
}
