import React from 'react';
import { Book, SearchResultBook } from '../types/book';
import { WoodPalette } from '../theme/woodTheme';
import { AlertCircle } from 'lucide-react';

interface DuplicateConflictModalProps {
  palette: WoodPalette;
  conflict: { newBook: SearchResultBook; existingBook: Book } | null;
  onDismiss: () => void;
  onOpenExisting: (existing: Book) => void;
  onAddAnyway: (newBook: SearchResultBook) => void;
}

export const DuplicateConflictModal: React.FC<DuplicateConflictModalProps> = ({
  palette,
  conflict,
  onDismiss,
  onOpenExisting,
  onAddAnyway,
}) => {
  if (!conflict) return null;

  const { newBook, existingBook } = conflict;
  const statusLabel =
    existingBook.status === 'meus_livros'
      ? 'Meus Livros'
      : existingBook.status === 'lido'
      ? 'Lido'
      : 'Quero Ler';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
      onClick={onDismiss}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 shadow-2xl border"
        style={{
          backgroundColor: palette.paperSurface,
          borderColor: palette.woodBorder,
          color: palette.textOnPaper,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-3">
          <AlertCircle size={22} color={palette.woodBorder} />
          <h2 className="font-serif font-bold text-2xl" style={{ color: palette.textOnPaper }}>
            Livro já cadastrado!
          </h2>
        </div>

        <p className="text-sm leading-relaxed mb-6" style={{ color: palette.textOnPaper }}>
          <strong>&ldquo;{existingBook.titulo}&rdquo;</strong> já consta na sua estante ({statusLabel}).
          Deseja abrir a obra existente ou cadastrar como nova obra?
        </p>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => onOpenExisting(existingBook)}
            className="w-full py-2.5 px-4 rounded-lg font-serif font-bold text-sm shadow-sm cursor-pointer"
            style={{
              backgroundColor: palette.goldPrimary,
              color: palette.textOnGold,
            }}
          >
            Abrir Existente
          </button>
          <button
            type="button"
            onClick={() => onAddAnyway(newBook)}
            className="w-full py-2 px-4 rounded-lg font-serif font-semibold text-xs border cursor-pointer hover:bg-black/5"
            style={{
              borderColor: palette.woodBorder,
              color: palette.textSecondaryOnPaper,
            }}
          >
            Adicionar mesmo assim
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="w-full py-1.5 text-xs font-serif text-center hover:underline cursor-pointer"
            style={{ color: palette.textSecondaryOnPaper }}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};
