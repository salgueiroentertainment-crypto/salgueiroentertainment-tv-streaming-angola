import { initializeApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  updateProfile,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
  User,
} from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { 
  initializeFirestore,
  getFirestore, 
  doc, 
  collection, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  getDoc,
  getDocFromServer 
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { MediaItem, UserProfile, UserDevice, InstalledStremioAddon, PlatformTheme, RecycledItem } from '../types/streaming';

// Initialize Firebase with forced long-polling to prevent WebChannel 10s timeout in sandboxed/proxy environments
const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(
  app,
  {
    experimentalForceLongPolling: true,
  },
  firebaseConfig.firestoreDatabaseId
);
export const auth = getAuth(app);
auth.languageCode = 'pt';
export const storage = getStorage(app);

// Test connection on boot
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && (error.message.includes('the client is offline') || error.message.includes('Could not reach Cloud Firestore') || error.message.includes('unavailable'))) {
      console.warn('Firebase Firestore connection notice:', error.message);
    }
  }
}
testConnection();

// Standard Error Handler per Firebase Integration Skill
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
}

// -------------------------------------------------------------
// Real-Time Global Synchronization Services
// -------------------------------------------------------------

/**
 * Real-time listener for all catalog items and deleted item tombstones.
 * Any admin change triggers an immediate update on ALL connected devices and users.
 */
export function subscribeToGlobalCatalog(
  onUpdate: (customMovies: MediaItem[], deletedIds: string[]) => void
) {
  let customMoviesMap: Record<string, MediaItem> = {};
  let deletedIdsSet = new Set<string>();

  // 1. Listen to active catalog additions and edits
  const unsubscribeCatalog = onSnapshot(
    collection(db, 'catalog'),
    (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        const id = change.doc.id;
        if (change.type === 'removed') {
          delete customMoviesMap[id];
        } else {
          customMoviesMap[id] = change.doc.data() as MediaItem;
        }
      });
      onUpdate(Object.values(customMoviesMap), Array.from(deletedIdsSet));
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'catalog')
  );

  // 2. Listen to deleted items tombstones
  const unsubscribeDeleted = onSnapshot(
    collection(db, 'deleted_content'),
    (snapshot) => {
      deletedIdsSet = new Set(snapshot.docs.map(doc => doc.id));
      onUpdate(Object.values(customMoviesMap), Array.from(deletedIdsSet));
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'deleted_content')
  );

  return () => {
    unsubscribeCatalog();
    unsubscribeDeleted();
  };
}

function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefinedDeep(item)) as unknown as T;
  }
  if (value && typeof value === 'object') {
    const cleaned: Record<string, any> = {};
    for (const [k, v] of Object.entries(value as Record<string, any>)) {
      if (v !== undefined) {
        cleaned[k] = stripUndefinedDeep(v);
      }
    }
    return cleaned as T;
  }
  return value;
}

/**
 * Save or update a movie/series globally for all users.
 */
export async function syncMovieToGlobalCatalog(movie: MediaItem, adminEmail: string) {
  try {
    const payload = stripUndefinedDeep({
      ...movie,
      updatedAt: new Date().toISOString(),
      updatedBy: adminEmail,
    });
    await setDoc(doc(db, 'catalog', movie.id), payload);
    // If it was previously marked as deleted, remove the tombstone
    await deleteDoc(doc(db, 'deleted_content', movie.id)).catch(() => {});
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `catalog/${movie.id}`);
    throw err;
  }
}

/**
 * Delete a movie/series globally for all users.
 */
export async function deleteMovieFromGlobalCatalog(id: string, adminEmail: string) {
  try {
    // 1. Remove from catalog collection if present
    await deleteDoc(doc(db, 'catalog', id)).catch(() => {});

    // 2. Add tombstone in deleted_content so default movies are also hidden for all users
    await setDoc(doc(db, 'deleted_content', id), {
      id,
      deletedAt: new Date().toISOString(),
      deletedBy: adminEmail,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `catalog/${id}`);
    throw err;
  }
}

/**
 * Remove deleted content tombstone when restoring a movie or series.
 */
export async function removeDeletedContentTombstone(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'deleted_content', id));
  } catch (err) {
    // ignore
  }
}


/**
 * Real-time listener for global IPTV lists and uploaded M3U files.
 */
export function subscribeToGlobalIptv(
  onUpdate: (iptvUrls: string[], uploadedFiles: any[]) => void
) {
  return onSnapshot(
    doc(db, 'iptv_settings', 'main_config'),
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        onUpdate(data.iptvUrls || [], data.uploadedFiles || []);
      }
    },
    (err) => handleFirestoreError(err, OperationType.GET, 'iptv_settings/main_config')
  );
}

/**
 * Save global IPTV lists and uploaded M3U files for all users.
 */
export async function syncIptvToGlobal(
  iptvUrls: string[],
  uploadedFiles: any[],
  adminEmail: string
) {
  try {
    await setDoc(doc(db, 'iptv_settings', 'main_config'), {
      iptvUrls,
      uploadedFiles,
      updatedAt: new Date().toISOString(),
      updatedBy: adminEmail,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'iptv_settings/main_config');
    throw err;
  }
}

export interface GlobalMediaDomainSetting {
  customDomain: string;
  displayLabel: string;
  streamingEnabled: boolean;
  updatedAt?: string;
  updatedBy?: string;
}

export function subscribeToMediaDomainConfig(
  onUpdate: (config: GlobalMediaDomainSetting) => void
) {
  return onSnapshot(
    doc(db, 'platform_settings', 'media_domain'),
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as GlobalMediaDomainSetting;
        if (data.customDomain) {
          onUpdate({
            customDomain: data.customDomain,
            displayLabel: data.displayLabel || 'Salgueiro Media Cloud Angola',
            streamingEnabled: data.streamingEnabled !== false,
            updatedAt: data.updatedAt,
            updatedBy: data.updatedBy,
          });
        }
      }
    },
    (err) => handleFirestoreError(err, OperationType.GET, 'platform_settings/media_domain')
  );
}

export async function saveMediaDomainConfigToFirestore(
  config: GlobalMediaDomainSetting,
  adminEmail: string
) {
  try {
    await setDoc(doc(db, 'platform_settings', 'media_domain'), {
      customDomain: config.customDomain,
      displayLabel: config.displayLabel,
      streamingEnabled: config.streamingEnabled,
      updatedAt: new Date().toISOString(),
      updatedBy: adminEmail,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'platform_settings/media_domain');
    throw err;
  }
}

export interface GlobalPlatformConfig {
  appTitle?: string;
  heroImage?: string;
  blacklistedChannelIds?: string[];
  channelLogos?: Record<string, string>;
  movieArtworks?: Record<string, { thumbnailUrl: string; bannerUrl: string; originalTitle?: string; source?: string }>;
  installedAddons?: InstalledStremioAddon[];
  preferredTheme?: PlatformTheme;
  updatedAt?: string;
  updatedBy?: string;
}

export function subscribeToGlobalPlatformConfig(
  onUpdate: (config: GlobalPlatformConfig) => void
) {
  return onSnapshot(
    doc(db, 'platform_settings', 'global_config'),
    (snapshot) => {
      if (snapshot.exists()) {
        onUpdate(snapshot.data() as GlobalPlatformConfig);
      }
    },
    (err) => handleFirestoreError(err, OperationType.GET, 'platform_settings/global_config')
  );
}

export async function saveGlobalPlatformConfigToFirestore(
  config: Partial<GlobalPlatformConfig>,
  adminEmail: string
) {
  try {
    const payload = stripUndefinedDeep({
      ...config,
      updatedAt: new Date().toISOString(),
      updatedBy: adminEmail,
    });
    await setDoc(doc(db, 'platform_settings', 'global_config'), payload, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'platform_settings/global_config');
    throw err;
  }
}

// -------------------------------------------------------------
// User Account & Monthly Subscription Persistence
// -------------------------------------------------------------

function sanitizeEmailKey(email: string): string {
  return email.trim().toLowerCase().replace(/[^a-z0-9@._-]/g, '_');
}

export function getDefaultDatesForMonthlyPlan() {
  const today = new Date();
  const nextMonth = new Date(today);
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  return {
    paymentDate: today.toISOString().split('T')[0],
    expirationDate: nextMonth.toISOString().split('T')[0],
  };
}

export async function saveUserAccountPayment(user: UserProfile): Promise<void> {
  if (!user.email) return;
  const key = sanitizeEmailKey(user.email);
  const defaults = getDefaultDatesForMonthlyPlan();
  const isActive = user.accountActive !== false && user.paymentStatus !== 'Desativado';
  try {
    await setDoc(
      doc(db, 'user_accounts', key),
      {
        uid: user.uid || '',
        email: user.email,
        phone: user.phone || '',
        name: user.name,
        role: user.role,
        avatarUrl: user.avatarUrl || '',
        emailVerified: Boolean(user.emailVerified),
        phoneVerified: Boolean(user.phoneVerified),
        accountActive: isActive,
        planName: user.planName || 'Pacote Mensal Completo (4K UHD + TV ao Vivo)',
        monthlyPrice: user.monthlyPrice || '5.000 Kz / mês',
        paymentDate: user.paymentDate || defaults.paymentDate,
        expirationDate: user.expirationDate || defaults.expirationDate,
        paymentStatus: isActive ? (user.paymentStatus || 'Ativo') : 'Desativado',
        paymentMethod: user.paymentMethod || 'Multicaixa Express',
        ...(user.preferredTheme ? { preferredTheme: user.preferredTheme } : {}),
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `user_accounts/${key}`);
  }
}

export async function deleteUserAccountFromFirestore(email: string): Promise<void> {
  if (!email) return;
  const key = sanitizeEmailKey(email);
  try {
    await deleteDoc(doc(db, 'user_accounts', key));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `user_accounts/${key}`);
  }
}

export async function fetchUserAccountPayment(email: string): Promise<Partial<UserProfile> | null> {
  if (!email) return null;
  const key = sanitizeEmailKey(email);
  try {
    const snap = await getDoc(doc(db, 'user_accounts', key));
    if (snap.exists()) {
      return snap.data() as Partial<UserProfile>;
    }
    return null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `user_accounts/${key}`);
    return null;
  }
}

export function subscribeToAllUserAccounts(
  onUpdate: (accounts: UserProfile[]) => void
) {
  return onSnapshot(
    collection(db, 'user_accounts'),
    (snapshot) => {
      const list: UserProfile[] = snapshot.docs.map(d => d.data() as UserProfile);
      onUpdate(list);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'user_accounts')
  );
}

export function subscribeToAllUserDevices(
  onUpdate: (devicesByEmail: Record<string, UserDevice[]>) => void
) {
  return onSnapshot(
    collection(db, 'user_devices'),
    (snapshot) => {
      const map: Record<string, UserDevice[]> = {};
      snapshot.docs.forEach((d) => {
        const data = d.data() as { email?: string; devices?: UserDevice[] };
        if (data?.email && Array.isArray(data.devices)) {
          map[data.email.trim().toLowerCase()] = data.devices;
        }
      });
      onUpdate(map);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'user_devices')
  );
}

export function subscribeToUserDevicesByEmail(
  email: string,
  onUpdate: (devices: UserDevice[]) => void
) {
  const docId = email.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  return onSnapshot(
    doc(db, 'user_devices', docId),
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as { devices?: UserDevice[] };
        if (Array.isArray(data.devices)) {
          onUpdate(data.devices);
        }
      }
    },
    (err) => handleFirestoreError(err, OperationType.GET, `user_devices/${docId}`)
  );
}

// -------------------------------------------------------------
// Real-Time Online Presence & Geo-Location / Provinces Tracking
// -------------------------------------------------------------

export interface OnlinePresenceRecord {
  sessionId: string;
  email: string;
  userName: string;
  role: string;
  isGuest: boolean;
  deviceName: string;
  city: string;
  province: string;
  country: string;
  currentView: string;
  lastSeenMs: number;
  startedAt: string;
}

export async function upsertOnlinePresence(record: OnlinePresenceRecord): Promise<void> {
  if (!record.sessionId) return;
  try {
    await setDoc(
      doc(db, 'online_presence', record.sessionId),
      stripUndefinedDeep({
        ...record,
        lastSeenMs: record.lastSeenMs || Date.now(),
      }),
      { merge: true }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `online_presence/${record.sessionId}`);
  }
}

export async function removeOnlinePresence(sessionId: string): Promise<void> {
  if (!sessionId) return;
  try {
    await deleteDoc(doc(db, 'online_presence', sessionId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `online_presence/${sessionId}`);
  }
}

export function subscribeToOnlinePresence(
  onUpdate: (sessions: OnlinePresenceRecord[]) => void
) {
  return onSnapshot(
    collection(db, 'online_presence'),
    (snapshot) => {
      const list: OnlinePresenceRecord[] = snapshot.docs.map(
        (d) => d.data() as OnlinePresenceRecord
      );
      onUpdate(list);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'online_presence')
  );
}

// -------------------------------------------------------------
// Real Email Link & Phone SMS Verification Services (Firebase Auth)
// -------------------------------------------------------------

export async function validateRealEmailDomain(email: string): Promise<{ valid: boolean; reason?: string }> {
  const clean = email.trim().toLowerCase();
  const res = await fetch(`/api/validate-email?email=${encodeURIComponent(clean)}`);
  const data = await res.json().catch(() => ({ valid: false, reason: 'Erro ao validar domínio do e-mail.' }));
  if (!res.ok) {
    return { valid: false, reason: data.reason || 'E-mail inválido ou domínio inexistente.' };
  }
  return { valid: Boolean(data.valid), reason: data.reason };
}

export async function registerWithRealEmailVerification(
  email: string,
  password: string,
  displayName: string
): Promise<{ user: User; alreadyVerified: boolean }> {
  const cleanEmail = email.trim().toLowerCase();
  const actionCodeSettings = {
    url: window.location.origin,
    handleCodeInApp: false,
  };

  try {
    const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
    if (displayName.trim()) {
      await updateProfile(cred.user, { displayName: displayName.trim() }).catch(() => {});
    }
    await sendEmailVerification(cred.user, actionCodeSettings);
    return { user: cred.user, alreadyVerified: false };
  } catch (err: any) {
    if (err?.code === 'auth/email-already-in-use') {
      try {
        const existingCred = await signInWithEmailAndPassword(auth, cleanEmail, password);
        if (existingCred.user.emailVerified) {
          return { user: existingCred.user, alreadyVerified: true };
        }
        await sendEmailVerification(existingCred.user, actionCodeSettings);
        return { user: existingCred.user, alreadyVerified: false };
      } catch {
        throw err;
      }
    }
    throw err;
  }
}

export async function checkCurrentEmailVerified(): Promise<{ verified: boolean; user: User | null }> {
  const current = auth.currentUser;
  if (!current) return { verified: false, user: null };
  await current.reload();
  const refreshed = auth.currentUser;
  return { verified: Boolean(refreshed?.emailVerified), user: refreshed };
}

export async function resendEmailVerificationLink(): Promise<void> {
  const current = auth.currentUser;
  if (!current) throw new Error('Nenhuma sessão pendente encontrada. Preencha os dados novamente.');
  await sendEmailVerification(current, {
    url: window.location.origin,
    handleCodeInApp: false,
  });
}

let activeRecaptcha: RecaptchaVerifier | null = null;

export function clearPhoneRecaptcha() {
  if (activeRecaptcha) {
    try {
      activeRecaptcha.clear();
    } catch {}
    activeRecaptcha = null;
  }
}

export async function sendPhoneSmsVerification(
  rawPhone: string,
  containerId: string
): Promise<{ confirmationResult: ConfirmationResult; normalizedPhone: string }> {
  let digits = rawPhone.replace(/[^\d+]/g, '');
  if (!digits.startsWith('+')) {
    const justDigits = digits.replace(/\D/g, '');
    if (justDigits.length === 9 && justDigits.startsWith('9')) {
      digits = `+244${justDigits}`;
    } else {
      digits = `+${justDigits}`;
    }
  }

  clearPhoneRecaptcha();
  const container = document.getElementById(containerId);
  if (container) container.innerHTML = '';

  activeRecaptcha = new RecaptchaVerifier(auth, containerId, {
    size: 'invisible',
  });

  const confirmationResult = await signInWithPhoneNumber(auth, digits, activeRecaptcha);
  return { confirmationResult, normalizedPhone: digits };
}

export async function verifyPhoneSmsCode(
  confirmationResult: ConfirmationResult,
  code: string,
  displayName: string
): Promise<User> {
  const cred = await confirmationResult.confirm(code.trim());
  if (displayName.trim()) {
    await updateProfile(cred.user, { displayName: displayName.trim() }).catch(() => {});
  }
  return cred.user;
}

export async function signInWithFirebaseEmail(
  email: string,
  password: string
): Promise<{ user: User; emailVerified: boolean }> {
  const cred = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
  await cred.user.reload();
  return { user: cred.user, emailVerified: cred.user.emailVerified };
}

export function formatFirebaseAuthError(err: any): string {
  const code = err?.code || '';
  switch (code) {
    case 'auth/invalid-email':
      return 'O endereço de e-mail inserido não é válido.';
    case 'auth/email-already-in-use':
      return 'Este e-mail já se encontra registado. Use "Entrar" para aceder à sua conta.';
    case 'auth/weak-password':
      return 'A palavra-passe deve ter pelo menos 6 caracteres.';
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Palavra-passe ou e-mail incorretos.';
    case 'auth/user-not-found':
      return 'Nenhuma conta encontrada com este e-mail.';
    case 'auth/invalid-phone-number':
      return 'Número de telefone inválido. Use o formato internacional (ex: +244 923 000 000).';
    case 'auth/invalid-verification-code':
      return 'O código SMS inserido está incorreto. Verifique a mensagem recebida.';
    case 'auth/code-expired':
      return 'O código SMS expirou. Clique em "Reenviar SMS" para receber um novo.';
    case 'auth/too-many-requests':
      return 'Muitas tentativas seguidas. Aguarde alguns minutos e tente novamente.';
    case 'auth/operation-not-allowed':
      return `O provedor de autenticação ainda não está ativado na Consola Firebase (${firebaseConfig.projectId}). Ative E-mail/Palavra-passe e Telefone (SMS) em Authentication > Sign-in method.`;
    case 'auth/billing-not-enabled':
      return `O envio de SMS requer o plano Blaze ativado na Consola Firebase do projeto (${firebaseConfig.projectId}).`;
    default:
      return err?.message || 'Ocorreu um erro na autenticação. Tente novamente.';
  }
}

const LOCAL_RECYCLE_BIN_KEY = 'salgueiro_recycle_bin';

export function getLocalRecycleBin(): RecycledItem[] {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_RECYCLE_BIN_KEY) || '[]');
  } catch {
    return [];
  }
}

export function saveLocalRecycleBin(items: RecycledItem[]): void {
  try {
    localStorage.setItem(LOCAL_RECYCLE_BIN_KEY, JSON.stringify(items));
  } catch {
    // quota safe
  }
}

/**
 * Real-time listener for the platform Recycle Bin (Lixeira) items.
 */
export function subscribeToRecycleBin(
  onUpdate: (items: RecycledItem[]) => void
) {
  // First notify with local cache immediately
  const localItems = getLocalRecycleBin();
  if (localItems.length > 0) {
    onUpdate(localItems);
  }

  return onSnapshot(
    collection(db, 'recycle_bin'),
    (snapshot) => {
      const items: RecycledItem[] = snapshot.docs.map((d) => d.data() as RecycledItem);
      // Sort newest first
      items.sort((a, b) => new Date(b.deletedAt || 0).getTime() - new Date(a.deletedAt || 0).getTime());
      saveLocalRecycleBin(items);
      onUpdate(items);
    },
    (err) => {
      console.warn('Recycle bin Firestore listener notice:', err?.message);
      onUpdate(getLocalRecycleBin());
    }
  );
}

/**
 * Save an item to the global Recycle Bin in Firestore and local mirror.
 */
export async function addRecycleBinItem(item: RecycledItem): Promise<void> {
  const current = getLocalRecycleBin().filter((i) => i.id !== item.id);
  const updated = [item, ...current];
  saveLocalRecycleBin(updated);

  try {
    const payload = stripUndefinedDeep({
      ...item,
      deletedAt: item.deletedAt || new Date().toISOString(),
    });
    await setDoc(doc(db, 'recycle_bin', item.id), payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `recycle_bin/${item.id}`);
  }
}

/**
 * Remove an item from the Recycle Bin when restored or permanently deleted.
 */
export async function restoreRecycleBinItem(itemId: string): Promise<void> {
  const updated = getLocalRecycleBin().filter((i) => i.id !== itemId);
  saveLocalRecycleBin(updated);

  try {
    await deleteDoc(doc(db, 'recycle_bin', itemId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `recycle_bin/${itemId}`);
  }
}

export async function permanentDeleteRecycleBinItem(itemId: string): Promise<void> {
  await restoreRecycleBinItem(itemId);
}

/**
 * Permanently empty all items from the Recycle Bin.
 */
export async function emptyRecycleBin(itemIds: string[]): Promise<void> {
  saveLocalRecycleBin([]);

  try {
    await Promise.allSettled(
      itemIds.map((id) => deleteDoc(doc(db, 'recycle_bin', id)))
    );
  } catch (err) {
    console.warn('Failed to empty recycle bin in Firestore:', err);
  }
}



