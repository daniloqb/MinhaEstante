import { Capacitor } from '@capacitor/core';

// The public Vite build replaces this with false and removes the lazy UI entry.
export const attachmentsDevBuild = import.meta.env.DEV || __ATTACHMENTS_DEV_BUILD__;

export async function attachmentsDevEnabled(options: {
  build?: boolean;
  native?: boolean;
  platform?: string;
  hostname?: string;
  nativeGate?: () => Promise<boolean>;
} = {}): Promise<boolean> {
  if (!(options.build ?? attachmentsDevBuild)) return false;
  if (!(options.native ?? Capacitor.isNativePlatform())) {
    return ['localhost', '127.0.0.1', '[::1]', '::1'].includes(options.hostname ?? globalThis.location?.hostname);
  }
  if ((options.platform ?? Capacitor.getPlatform()) !== 'android') return false;
  try {
    return await (options.nativeGate ?? (async () => {
      const { AndroidSafPlugin } = await import('./android/bridge');
      const gate = await AndroidSafPlugin.getDevelopmentEnvironment();
      return gate.status === 'success' && gate.value.enabled === true;
    }))();
  } catch { return false; }
}
