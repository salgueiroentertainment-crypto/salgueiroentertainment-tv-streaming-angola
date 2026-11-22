import React, { createContext, useContext } from 'react';
import { PlatformTheme } from '../types/streaming';

export interface PlatformThemeDefinition {
  id: PlatformTheme;
  name: string;
  shortName: string;
  tagline: string;
  description: string;
  isNew?: boolean;
  accentColor: string;
  bgColor: string;
  surfaceColor: string;
  secondaryColor: string;
  highlights: string[];
}

export const PLATFORM_THEMES: PlatformThemeDefinition[] = [
  {
    id: 'default',
    name: 'Salgueiro Clássico',
    shortName: 'Clássico',
    tagline: 'Identidade Original Angola',
    description: 'Interface escura equilibrada em obsidiana e violeta elétrico com grelha de pósteres e canais em direto.',
    accentColor: '#7b5be4',
    bgColor: '#0c0d10',
    surfaceColor: '#161a22',
    secondaryColor: '#38bdf8',
    highlights: ['Grelha clássica 6 colunas', 'Acentos Violeta #7b5be4', 'Equilíbrio cinema e TV'],
  },
  {
    id: 'netflix',
    name: 'Flix',
    shortName: 'Flix',
    tagline: 'Tema Flix',
    description: 'Tema cinematográfico preto absoluto (#141414) com destaques vermelho (#E50914), carrosséis contínuos e Top 10 numerado.',
    isNew: true,
    accentColor: '#E50914',
    bgColor: '#141414',
    surfaceColor: '#181818',
    secondaryColor: '#ffffff',
    highlights: ['Billboard cinema Flix', 'Ranking Top 10 numerado', 'Barras de progresso vermelhas'],
  },
  {
    id: 'prime',
    name: 'prime',
    shortName: 'prime',
    tagline: 'Tema prime',
    description: 'Interface azul-marinho (#00050d) com realces ciano (#00A8E1), cartões widescreen 16:9 e selo Incluído.',
    isNew: true,
    accentColor: '#00A8E1',
    bgColor: '#00050d',
    surfaceColor: '#0f171e',
    secondaryColor: '#79b8f3',
    highlights: ['Cartões panorâmicos 16:9', 'Selo azul prime Incluído', 'Carrosséis horizontais'],
  },
  {
    id: 'stremio',
    name: 'stream',
    shortName: 'stream',
    tagline: 'Tema stream',
    description: 'Skin roxa noturna (#0e0b1a) com barra lateral vertical de ícones, Board horizontal e pósteres nítidos.',
    isNew: true,
    accentColor: '#7b5bf5',
    bgColor: '#0e0b1a',
    surfaceColor: '#17132b',
    secondaryColor: '#22b365',
    highlights: ['Dock lateral estilo stream', 'Board horizontal de pósteres', 'Vidro roxo translúcido'],
  },
];

export interface InterfacePreferences {
  compactCards: boolean;
  showQualityBadges: boolean;
  autoHeroRotation: boolean;
}

export const DEFAULT_INTERFACE_PREFS: InterfacePreferences = {
  compactCards: false,
  showQualityBadges: true,
  autoHeroRotation: true,
};

export const ThemeContext = createContext<{
  theme: PlatformTheme;
  setTheme: (next: PlatformTheme) => void;
  prefs: InterfacePreferences;
  setPrefs: (next: InterfacePreferences) => void;
}>({
  theme: 'default',
  setTheme: () => {},
  prefs: DEFAULT_INTERFACE_PREFS,
  setPrefs: () => {},
});

export const usePlatformTheme = () => useContext(ThemeContext);

export function getThemeStorageKey(email?: string | null): string {
  const clean = (email || '').trim().toLowerCase();
  return clean ? `salgueiro_theme_user_${clean}` : 'salgueiro_theme_guest';
}

export function loadSavedThemeForUser(email?: string | null): PlatformTheme {
  try {
    const perUser = localStorage.getItem(getThemeStorageKey(email));
    if (perUser && isValidPlatformTheme(perUser)) return perUser;
    const globalSaved = localStorage.getItem('salgueiro_active_theme');
    if (globalSaved && isValidPlatformTheme(globalSaved)) return globalSaved;
  } catch {
    // ignore storage errors
  }
  return 'default';
}

export function saveThemeForUser(theme: PlatformTheme, email?: string | null): void {
  try {
    localStorage.setItem(getThemeStorageKey(email), theme);
    localStorage.setItem('salgueiro_active_theme', theme);
  } catch {
    // ignore storage errors
  }
}

export function isValidPlatformTheme(val: unknown): val is PlatformTheme {
  return val === 'default' || val === 'netflix' || val === 'prime' || val === 'stremio';
}

export function loadInterfacePreferences(): InterfacePreferences {
  try {
    const raw = localStorage.getItem('salgueiro_interface_prefs');
    if (raw) {
      return { ...DEFAULT_INTERFACE_PREFS, ...JSON.parse(raw) };
    }
  } catch {
    // ignore
  }
  return DEFAULT_INTERFACE_PREFS;
}

export function saveInterfacePreferences(prefs: InterfacePreferences): void {
  try {
    localStorage.setItem('salgueiro_interface_prefs', JSON.stringify(prefs));
  } catch {
    // ignore
  }
}
