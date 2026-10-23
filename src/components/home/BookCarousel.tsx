import React, { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { WoodPalette } from '../../theme/woodTheme';

interface BookCarouselProps {
  palette: WoodPalette;
  children: React.ReactNode;
}

export const BookCarousel: React.FC<BookCarouselProps> = ({ palette, children }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 10);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 10);
  };

  useEffect(() => {
    checkScroll();
    const el = containerRef.current;
    if (!el) return;

    el.addEventListener('scroll', checkScroll, { passive: true });
    window.addEventListener('resize', checkScroll);
    return () => {
      el.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, [children]);

  const scrollBy = (offset: number) => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollBy({ left: offset, behavior: 'smooth' });
  };

  return (
    <div className="relative group/carousel w-full">
      {/* Botão Seta Esquerda (Aparece no hover/desktop quando há conteúdo anterior) */}
      {canScrollLeft && (
        <button
          type="button"
          onClick={() => scrollBy(-280)}
          className="hidden sm:flex absolute -left-3 top-1/3 -translate-y-1/2 z-20 w-8 h-8 rounded-full items-center justify-center shadow-lg border cursor-pointer hover:scale-110 active:scale-95 transition-all opacity-90 hover:opacity-100"
          style={{
            backgroundColor: palette.paperSurface,
            borderColor: palette.woodBorder,
            color: palette.textOnPaper,
          }}
          aria-label="Rolar para esquerda"
          title="Rolar livros para a esquerda"
        >
          <ChevronLeft size={18} />
        </button>
      )}

      {/* Faixa de rolagem horizontal com scroll-snap */}
      <div
        ref={containerRef}
        className="flex gap-3.5 sm:gap-4 overflow-x-auto overflow-y-hidden pb-3 pt-1 px-1 snap-x scrollbar-none scroll-smooth touch-pan-x"
        style={{
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {children}
      </div>

      {/* Botão Seta Direita */}
      {canScrollRight && (
        <button
          type="button"
          onClick={() => scrollBy(280)}
          className="hidden sm:flex absolute -right-3 top-1/3 -translate-y-1/2 z-20 w-8 h-8 rounded-full items-center justify-center shadow-lg border cursor-pointer hover:scale-110 active:scale-95 transition-all opacity-90 hover:opacity-100"
          style={{
            backgroundColor: palette.paperSurface,
            borderColor: palette.woodBorder,
            color: palette.textOnPaper,
          }}
          aria-label="Rolar para direita"
          title="Rolar livros para a direita"
        >
          <ChevronRight size={18} />
        </button>
      )}
    </div>
  );
};
