import { lazy, Suspense, useEffect, useState } from 'react';
import { attachmentsDevEnabled } from '../services/storage/digital/attachmentsDevGate';
import type { WoodPalette } from '../theme/woodTheme';
// Keep the compile-time condition at the import site so Vite excludes the Worker before bundling assets.
const DevelopmentExport = (import.meta.env.DEV || __ATTACHMENTS_DEV_BUILD__) ? lazy(() => import('./BackupExportSection')) : null;
export function BackupExportGate(props: { palette: WoodPalette; legacyExport: () => Promise<void> }) {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => { let alive = true; if (DevelopmentExport) void attachmentsDevEnabled().then(value => { if (alive) setEnabled(value); }); return () => { alive = false; }; }, []);
  return enabled && DevelopmentExport ? <Suspense fallback={null}><DevelopmentExport {...props} /></Suspense> : null;
}
