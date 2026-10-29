import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BookCoverView } from '../components/BookCoverView';
import { DarkWalnutPalette } from '../theme/woodTheme';

describe('book covers used to navigate to attachment details', () => {
  it('exposes an actionable cover with a name and a keyboard tab stop', () => {
    const html = renderToStaticMarkup(<BookCoverView palette={DarkWalnutPalette}
      title="Synthetic book" author="Synthetic author" onClick={() => {}} />);
    expect(html).toContain('role="button"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('aria-label="Synthetic book — Synthetic author"');
  });

  it('keeps a decorative cover out of the keyboard order and button semantics', () => {
    const html = renderToStaticMarkup(<BookCoverView palette={DarkWalnutPalette} title="Synthetic book" />);
    expect(html).not.toContain('role="button"');
    expect(html).not.toContain('tabindex=');
    expect(html).not.toContain('aria-label=');
  });
});
