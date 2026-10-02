import React from 'react';
import { Book } from '../types/book';
import { WoodPalette } from '../theme/woodTheme';
import { BookOpen, Edit, ArrowRightLeft, Trash2, X } from 'lucide-react';

interface QuickActionModalProps {
  palette: WoodPalette;
  book: Book | null;
  onDismiss: () => void;
  onViewDetails: (book: Book) => void;
  onEdit: (book: Book) => void;
  onToggleStatus: (book: Book) => void;
  onDelete: (book: Book) => void;
}

export const QuickActionModal: React.FC<QuickActionModalProps> = ({
  palette,
  book,
  onDismiss,
  onViewDetails,
  onEdit,
  onToggleStatus,
  onDelete,
}) => {
  if (!book) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in"
      onClick={onDismiss}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-5 shadow-2xl border"
        style={{
          backgroundColor: palette.paperSurface,
          borderColor: palette.woodBorder,
          color: palette.textOnPaper,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3
              className="font-serif font-bold text-xl leading-snug line-clamp-2"
              style={{ color: palette.textOnPaper }}
            >
              {book.titulo}
            </h3>
            <p className="font-serif text-sm italic" style={{ color: palette.textSecondaryOnPaper }}>
              {book.autores.join(', ') || 'Autor desconhecido'}
            </p>
          </div>
          <button
            onClick={onDismiss}
            className="p-1 rounded-full hover:bg-black/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <p className="text-xs mb-4" style={{ color: palette.textSecondaryOnPaper }}>
          Escolha uma ação para esta obra:
        </p>

        <div className="flex flex-col gap-2">
          {/* Ver Detalhes */}
          <button
            onClick={() => {
              onDismiss();
              onViewDetails(book);
            }}
            className="w-full py-2.5 px-4 rounded-lg font-serif font-bold text-sm flex items-center justify-center gap-2 transition-transform active:scale-98 shadow-sm cursor-pointer"
            style={{
              backgroundColor: palette.goldPrimary,
              color: palette.textOnGold,
            }}
          >
            <BookOpen size={16} />
            Ver Detalhes
          </button>

          {/* Editar Leitura */}
          <button
            onClick={() => {
              onDismiss();
              onEdit(book);
            }}
            className="w-full py-2.5 px-4 rounded-lg font-serif font-semibold text-sm flex items-center justify-center gap-2 transition-transform active:scale-98 cursor-pointer text-white"
            style={{
              backgroundColor: palette.woodBorder,
            }}
          >
            <Edit size={16} />
            Editar Leitura
          </button>

          {/* Mover status */}
          <button
            onClick={() => {
              onDismiss();
              onToggleStatus(book);
            }}
            className="w-full py-2 px-4 rounded-lg font-serif font-semibold text-sm flex items-center justify-center gap-2 transition-transform active:scale-98 border cursor-pointer"
            style={{
              borderColor: palette.woodBorder,
              color: palette.textOnPaper,
            }}
          >
            <ArrowRightLeft size={16} />
            {book.status === 'lido' ? 'Mover para Quero Ler' : 'Marcar como Lido'}
          </button>

          {/* Excluir */}
          <button
            onClick={() => {
              onDismiss();
              onDelete(book);
            }}
            className="w-full py-2 px-4 rounded-lg font-serif font-medium text-xs flex items-center justify-center gap-2 transition-colors hover:bg-red-50 text-red-700 cursor-pointer mt-1"
          >
            <Trash2 size={14} />
            Excluir da Estante
          </button>
        </div>
      </div>
    </div>
  );
};
