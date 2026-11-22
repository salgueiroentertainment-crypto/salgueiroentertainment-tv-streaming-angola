import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import type { UserDevice } from '../types/streaming';

export type { UserDevice };

export const MAX_DEVICES_PER_ACCOUNT = 4;

function getDeviceDocId(email: string): string {
  return email.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
}

/**
 * Get or create a unique identifier for the current local browser/device
 */
export function getCurrentDeviceId(): string {
  let deviceId = localStorage.getItem('salgueiro_local_device_id');
  if (!deviceId) {
    deviceId = `dev-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem('salgueiro_local_device_id', deviceId);
  }
  return deviceId;
}

/**
 * Detect current platform / browser details
 */
export function detectCurrentDevice(): Omit<UserDevice, 'id' | 'lastActive' | 'isCurrent'> {
  const ua = navigator.userAgent;
  let type: 'desktop' | 'mobile' | 'tv' | 'tablet' = 'desktop';
  let name = 'Computador (Navegador Web)';
  let browserOrOs = 'Web';

  if (/smart-tv|tizen|webos|appletv|googletv|hbbtv/i.test(ua)) {
    type = 'tv';
    name = 'Smart TV';
    browserOrOs = 'TV OS';
  } else if (/ipad|tablet/i.test(ua)) {
    type = 'tablet';
    name = 'Tablet';
    browserOrOs = /ipad/i.test(ua) ? 'iPadOS' : 'Android Tablet';
  } else if (/iphone|android|mobile/i.test(ua)) {
    type = 'mobile';
    name = /iphone/i.test(ua) ? 'iPhone' : 'Smartphone Android';
    browserOrOs = /iphone/i.test(ua) ? 'iOS' : 'Android';
  } else if (/macintosh|mac os x/i.test(ua)) {
    name = 'Mac (Navegador Web)';
    browserOrOs = 'macOS';
  } else if (/windows/i.test(ua)) {
    name = 'PC Windows (Navegador)';
    browserOrOs = 'Windows';
  } else if (/linux/i.test(ua)) {
    name = 'Computador Linux';
    browserOrOs = 'Linux';
  }

  return {
    name,
    type,
    browserOrOs,
    location: 'Luanda, Angola',
    enabled: true,
  };
}

/**
 * Retrieve devices for a given user account
 */
export function getUserDevices(email: string): UserDevice[] {
  if (!email) return [];
  const currentId = getCurrentDeviceId();
  const key = `salgueiro_devices_${email.trim().toLowerCase()}`;
  const saved = localStorage.getItem(key) || localStorage.getItem(`salgueiro_devices_${email}`);

  if (saved) {
    try {
      const parsed: UserDevice[] = JSON.parse(saved);
      return parsed.map((d) => ({
        ...d,
        enabled: d.enabled !== false,
        isCurrent: d.id === currentId,
      }));
    } catch (e) {
      console.error('Error parsing devices:', e);
    }
  }

  const detected = detectCurrentDevice();
  const initialDevices: UserDevice[] = [
    {
      id: currentId,
      name: detected.name,
      type: detected.type,
      browserOrOs: detected.browserOrOs,
      location: detected.location,
      lastActive: 'Agora mesmo',
      isCurrent: true,
      enabled: true,
    },
  ];

  localStorage.setItem(key, JSON.stringify(initialDevices));
  return initialDevices;
}

export async function fetchUserDevicesFromFirestore(email: string): Promise<UserDevice[]> {
  if (!email) return [];
  const docId = getDeviceDocId(email);
  try {
    const snap = await getDoc(doc(db, 'user_devices', docId));
    if (snap.exists()) {
      const data = snap.data() as { devices?: UserDevice[] };
      if (Array.isArray(data.devices)) {
        const currentId = getCurrentDeviceId();
        const normalized = data.devices.map((d) => ({
          ...d,
          enabled: d.enabled !== false,
          isCurrent: d.id === currentId,
        }));
        localStorage.setItem(`salgueiro_devices_${email.trim().toLowerCase()}`, JSON.stringify(normalized));
        return normalized;
      }
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `user_devices/${docId}`);
  }
  return getUserDevices(email);
}

/**
 * Register or update the current device for this account.
 * Enforces max 4 devices policy and admin enabled/disabled status.
 */
export function registerCurrentDevice(
  email: string,
  knownDevices?: UserDevice[]
): {
  success: boolean;
  limitReached?: boolean;
  deviceDisabled?: boolean;
  devices: UserDevice[];
} {
  const currentId = getCurrentDeviceId();
  const currentInfo = detectCurrentDevice();
  const devices = (knownDevices && knownDevices.length > 0 ? knownDevices : getUserDevices(email)).map((d) => ({
    ...d,
    enabled: d.enabled !== false,
    isCurrent: d.id === currentId,
  }));

  const existingIndex = devices.findIndex((d) => d.id === currentId);

  if (existingIndex >= 0) {
    if (devices[existingIndex].enabled === false) {
      return { success: false, deviceDisabled: true, devices };
    }
    devices[existingIndex] = {
      ...devices[existingIndex],
      lastActive: 'Agora mesmo',
      isCurrent: true,
      enabled: true,
    };
    saveUserDevices(email, devices);
    return { success: true, devices };
  }

  if (devices.length < MAX_DEVICES_PER_ACCOUNT) {
    const newDevice: UserDevice = {
      id: currentId,
      name: currentInfo.name,
      type: currentInfo.type,
      browserOrOs: currentInfo.browserOrOs,
      location: currentInfo.location,
      lastActive: 'Agora mesmo',
      isCurrent: true,
      enabled: true,
    };
    const updated = [newDevice, ...devices];
    saveUserDevices(email, updated);
    return { success: true, devices: updated };
  }

  return {
    success: false,
    limitReached: true,
    devices,
  };
}

/**
 * Enable or disable a specific user device globally (Admin action).
 */
export function setUserDeviceEnabled(
  email: string,
  deviceId: string,
  enabled: boolean,
  currentList?: UserDevice[]
): UserDevice[] {
  const devices = currentList || getUserDevices(email);
  const updated = devices.map((d) =>
    d.id === deviceId ? { ...d, enabled } : d
  );
  saveUserDevices(email, updated);
  return updated;
}

/**
 * Disconnect/remove a device from an account
 */
export function disconnectDevice(
  email: string,
  deviceId: string,
  currentList?: UserDevice[]
): UserDevice[] {
  const devices = currentList || getUserDevices(email);
  const updated = devices.filter((d) => d.id !== deviceId);
  saveUserDevices(email, updated);
  return updated;
}

/**
 * Replace an existing device with the current device
 */
export function replaceDeviceWithCurrent(
  email: string,
  deviceIdToReplace: string,
  currentList?: UserDevice[]
): UserDevice[] {
  const currentId = getCurrentDeviceId();
  const currentInfo = detectCurrentDevice();
  const devices = currentList || getUserDevices(email);

  const filtered = devices.filter((d) => d.id !== deviceIdToReplace && d.id !== currentId);
  const newDevice: UserDevice = {
    id: currentId,
    name: currentInfo.name,
    type: currentInfo.type,
    browserOrOs: currentInfo.browserOrOs,
    location: currentInfo.location,
    lastActive: 'Agora mesmo',
    isCurrent: true,
    enabled: true,
  };

  const updated = [newDevice, ...filtered];
  saveUserDevices(email, updated);
  return updated;
}

/**
 * Add a custom device manually (e.g. Smart TV with code)
 */
export function addCustomDevice(
  email: string,
  name: string,
  type: 'tv' | 'mobile' | 'desktop',
  currentList?: UserDevice[]
): { success: boolean; devices: UserDevice[] } {
  const devices = currentList || getUserDevices(email);
  if (devices.length >= MAX_DEVICES_PER_ACCOUNT) {
    return { success: false, devices };
  }

  const newDevice: UserDevice = {
    id: `dev-custom-${Date.now()}`,
    name: name || 'Novo Dispositivo',
    type,
    browserOrOs: type === 'tv' ? 'Smart TV' : type === 'mobile' ? 'Mobile' : 'Desktop',
    location: 'Angola',
    lastActive: 'Agora mesmo',
    isCurrent: false,
    enabled: true,
  };

  const updated = [...devices, newDevice];
  saveUserDevices(email, updated);
  return { success: true, devices: updated };
}

/**
 * Save devices locally and asynchronously to Firestore
 */
export function saveUserDevices(email: string, devices: UserDevice[]) {
  const cleanEmail = email.trim().toLowerCase();
  localStorage.setItem(`salgueiro_devices_${cleanEmail}`, JSON.stringify(devices));

  const docId = getDeviceDocId(cleanEmail);
  try {
    setDoc(
      doc(db, 'user_devices', docId),
      {
        email: cleanEmail,
        devices: devices.map(({ isCurrent: _isCur, ...rest }) => ({
          ...rest,
          enabled: rest.enabled !== false,
        })),
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    ).catch((err) => handleFirestoreError(err, OperationType.WRITE, `user_devices/${docId}`));
  } catch {
    // ignore offline errors
  }
}
