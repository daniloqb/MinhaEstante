import React from 'react';
import { WoodPalette } from '../../theme/woodTheme';
import { ShelfTab } from '../../types/book';
import { Library, CheckCircle, Bookmark, Handshake } from 'lucide-react';

interface HomeQuickLinksProps {
  palette: WoodPalette;
  counts: {
    meusLivros: number;
    lidos: number;
    queroLer: number;
    emprestados: number;
  };
  onOpenShelf: (targetTab: ShelfTab) => void;
  onOpenLoans: () => void;
}

export const HomeQuickLinks: React.FC<HomeQuickLinksProps> = ({
  palette,
  counts,
  onOpenShelf,
  onOpenLoans,
}) => {
  const links = [
    {
      id: 'meus_livros',
      label: 'Minha Estante',
      count: counts.meusLivros,
      icon: Library,
      action: () => onOpenShelf('meus_livros'),
      color: palette.goldPrimary,
    },
    {
      id: 'lidos',
      label: 'Lidos',
      count: counts.lidos,
      icon: CheckCircle,
      action: () => onOpenShelf('lido'),
      color: '#10b981', // emerald
    },
    {
      id: 'quero_ler',
      label: 'Quero Ler',
      count: counts.queroLer,
      icon: Bookmark,
      action: () => onOpenShelf('quero_ler'),
      color: '#f59e0b', // amber
    },
    {
      id: 'emprestados',
      label: 'Emprestados',
      count: counts.emprestados,
      icon: Handshake,
      action: onOpenLoans,
      color: '#38bdf8', // sky
    },
  ];

  return (
    <div className="w-full grid grid-cols-2 sm:grid-cols-4 gap-2.5 py-1">
      {links.map((link) => {
        const IconComponent = link.icon;
        return (
          <button
            key={link.id}
            type="button"
            onClick={link.action}
            className="flex items-center justify-between p-3 rounded-xl border shadow-sm cursor-pointer hover:brightness-105 active:scale-95 transition-all text-left group"
            style={{
              backgroundColor: palette.paperSurface,
              borderColor: palette.woodBorder,
              color: palette.textOnPaper,
            }}
            title={`Abrir ${link.label} (${link.count} livros)`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-2xs"
                style={{
                  backgroundColor: `${link.color}20`,
                  color: link.color,
                }}
              >
                <IconComponent size={17} />
              </div>

              <div className="flex flex-col min-w-0">
                <span className="font-sans font-bold text-xs truncate leading-tight">
                  {link.label}
                </span>
                <span className="text-[11px] font-sans opacity-70 leading-none mt-0.5">
                  {link.count} {link.count === 1 ? 'obra' : 'obras'}
                </span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
};
