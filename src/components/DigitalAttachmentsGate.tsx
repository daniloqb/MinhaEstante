import { lazy, Suspense, useEffect, useState } from 'react';
import type { Book } from '../types/book';
import type { WoodPalette } from '../theme/woodTheme';
import { attachmentsDevBuild, attachmentsDevEnabled } from '../services/storage/digital/attachmentsDevGate';

const DevelopmentSection = attachmentsDevBuild ? lazy(() => import('./DigitalAttachmentsSection')) : null;

/** Public bundles have no UI entry; native debug additionally requires the plugin's DEV gate. */
export function DigitalAttachmentsGate(props: { book: Book; palette: WoodPalette }) {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let active = true;
    if (DevelopmentSection) void attachmentsDevEnabled().then(value => { if (active) setEnabled(value); });
    return () => { active = false; };
  }, []);
  if (!enabled || !DevelopmentSection || !props.book.uuid || props.book.id <= 0) return null;
  return <Suspense fallback={null}><DevelopmentSection {...props} /></Suspense>;
}
