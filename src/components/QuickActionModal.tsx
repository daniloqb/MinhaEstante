import React, { useState } from 'react';
import { Book, BookFormat, ReadingStatus, isBookBorrowed, hasBookFormat, isBookOwned } from '../types/book';
import { useI18n } from '../i18n/I18nContext';
import { WoodPalette } from '../theme/woodTheme';
import {
  BookOpen,
  Edit,
  CheckCircle,
  Bookmark,
  Library,
  Trash2,
  X,
  MinusCircle,
  Check,
  AlertTriangle,
  Tablet,
  Handshake,
  Headphones,
} from 'lucide-react';

interface QuickActionModalProps {
  palette: WoodPalette;
  book: Book | null;
  onDismiss: () => void;
  onViewDetails: (book: Book) => void;
  onEdit: (book: Book) => void;
  onTogglePosse: (book: Book) => void;
  onSetStatusLeitura: (book: Book, status: ReadingStatus) => void;
  onDelete: (book: Book) => void;
  onToggleFormato?: (book: Book, format: BookFormat) => void;
  onOpenLoanModal?: (book: Book) => void;
}

export const QuickActionModal: React.FC<QuickActionModalProps> = ({
  palette,
  book,
  onDismiss,
  onViewDetails,
  onEdit,
  onTogglePosse,
  onSetStatusLeitura,
  onDelete,
  onToggleFormato,
  onOpenLoanModal,
}) => {
  const { t } = useI18n();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (!book) return null;
  const isEbook = hasBookFormat(book, 'ebook');
  const isAudiobook = hasBookFormat(book, 'audiolivro');
  const isFisico = hasBookFormat(book, 'fisico');
  const owned = isBookOwned(book);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in"
      onClick={onDismiss}
    >
      {/* Confirmação de exclusão */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl p-6 shadow-2xl border"
            style={{
              backgroundColor: palette.paperSurface,
              borderColor: palette.woodBorder,
              color: palette.textOnPaper,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-3 text-red-700">
              <AlertTriangle size={24} />
              <h3 className="font-serif font-bold text-xl leading-tight">
                Excluir livro da estante?
              </h3>
            </div>

            <p className="text-base leading-relaxed mb-6" style={{ color: palette.textOnPaper }}>
              Tem certeza de que deseja excluir <strong>&ldquo;{book.titulo}&rdquo;</strong>? Esta ação apagará todos os dados, avaliações e registros deste livro.
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2.5 px-3 rounded-lg font-sans font-semibold text-sm border cursor-pointer hover:bg-black/5"
                style={{ borderColor: palette.woodBorder }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  onDismiss();
                  onDelete(book);
                }}
                className="flex-1 py-2.5 px-3 rounded-lg font-sans font-semibold text-sm bg-red-700 text-white cursor-pointer hover:bg-red-800"
              >
                Sim, excluir
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        className="w-full max-w-sm rounded-2xl p-5 shadow-2xl border"
        style={{
          backgroundColor: palette.paperSurface,
          borderColor: palette.woodBorder,
          color: palette.textOnPaper,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-2">
          <div>
            <h3
              className="font-serif font-bold text-xl sm:text-2xl leading-snug line-clamp-2"
              style={{ color: palette.textOnPaper }}
            >
              {book.titulo}
            </h3>
            <p className="font-sans font-medium text-sm sm:text-base mt-0.5" style={{ color: palette.textSecondaryOnPaper }}>
              {book.autores.join(', ') || 'Autor desconhecido'}
            </p>
          </div>
          <button
            onClick={onDismiss}
            className="p-1 rounded-full hover:bg-black/10 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Indicadores atuais do livro */}
        <div className="flex items-center gap-1.5 mb-3.5 flex-wrap">
          {isFisico && (
            <span
              className="text-xs font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-1"
              style={{
                backgroundColor: `${palette.goldPrimary}20`,
                borderColor: palette.goldPrimary,
                color: palette.woodBorder,
              }}
            >
              <BookOpen size={12} />
              Livro Físico
            </span>
          )}

          {isEbook && (
            <span
              className="text-xs font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-1 bg-purple-950/20 text-purple-700 border-purple-300/60"
            >
              <Tablet size={12} />
              E-book
            </span>
          )}

          {isAudiobook && (
          <span
            className="text-xs font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-1 bg-teal-950/20 text-teal-700 border-teal-300/60"
          >
            <Headphones size={12} />
            Audiolivro
          </span>
        )}

          <span
            className="text-xs font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-1"
            style={{
              backgroundColor: owned ? `${palette.goldPrimary}20` : '#00000008',
              borderColor: owned ? palette.goldPrimary : `${palette.woodBorder}40`,
              color: owned ? palette.woodBorder : palette.textSecondaryOnPaper,
            }}
          >
            <Library size={12} />
            {owned ? t.ownership.owned : t.ownership.notOwned}
          </span>

          <span
            className="text-xs font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-1"
            style={{
              backgroundColor:
                book.status_leitura === 'lido'
                  ? '#10b98120'
                  : book.status_leitura === 'quero_ler'
                  ? '#3b82f620'
                  : '#00000008',
              borderColor:
                book.status_leitura === 'lido'
                  ? '#10b98180'
                  : book.status_leitura === 'quero_ler'
                  ? '#3b82f680'
                  : `${palette.woodBorder}40`,
              color:
                book.status_leitura === 'lido'
                  ? '#065f46'
                  : book.status_leitura === 'quero_ler'
                  ? '#1e40af'
                  : palette.textSecondaryOnPaper,
            }}
          >
            {book.status_leitura === 'lido' ? (
              <>
                <Check size={12} /> Lido {book.nota != null ? `(★ ${book.nota})` : ''}
              </>
            ) : book.status_leitura === 'quero_ler' ? (
              <>
                <Bookmark size={12} /> Quero ler
              </>
            ) : (
              book.status_leitura === 'lendo' ? t.status.reading : book.status_leitura === 'abandonado' ? t.status.abandoned : t.status.none
            )}
          </span>
        </div>

        <div className="flex flex-col gap-2">
          {/* Ver Detalhes */}
          <button
            onClick={() => {
              onDismiss();
              onViewDetails(book);
            }}
            className="w-full py-3 px-4 rounded-xl font-sans font-semibold text-sm sm:text-base flex items-center justify-center gap-2 shadow-sm cursor-pointer hover:brightness-105 active:scale-98 transition-all select-none"
            style={{
              backgroundColor: palette.goldPrimary,
              color: palette.textOnGold,
            }}
          >
            <BookOpen size={18} />
            Ver Detalhes, IA & Preços
          </button>

          {/* Emprestar Livro / Gerenciar Empréstimo */}
          {onOpenLoanModal && (
            <button
              onClick={() => {
                onDismiss();
                onOpenLoanModal(book);
              }}
              className="w-full py-2.5 px-4 rounded-xl font-sans font-semibold text-sm flex items-center justify-center gap-2 border cursor-pointer hover:bg-black/5 active:scale-98 transition-all select-none"
              style={{
                borderColor: isBookBorrowed(book) ? '#f59e0b' : palette.woodBorder,
                backgroundColor: isBookBorrowed(book) ? '#f59e0b15' : 'transparent',
                color: isBookBorrowed(book) ? '#92400e' : palette.textOnPaper,
              }}
            >
              <Handshake size={17} className={isBookBorrowed(book) ? 'text-amber-600' : ''} />
              <span>
                {isBookBorrowed(book)
                  ? `Emprestado (${book.emprestimo?.nomePessoa}) — Gerenciar`
                  : 'Emprestar Livro'}
              </span>
            </button>
          )}

          {/* Modalidades independentes: mantém ao menos uma selecionada. */}
          {onToggleFormato && (
            <div className="flex flex-wrap gap-2">
              {(['fisico', 'ebook', 'audiolivro'] as BookFormat[]).map((format) => (
                <button
                  key={format}
                  type="button"
                  aria-pressed={hasBookFormat(book, format)}
                  onClick={() => onToggleFormato(book, format)}
                  className="flex-1 py-2 px-2 rounded-xl font-sans font-medium text-xs border cursor-pointer hover:bg-black/5 active:scale-98 transition-all"
                  style={{
                    borderColor: palette.woodBorder,
                    backgroundColor: hasBookFormat(book, format) ? `${palette.goldPrimary}25` : 'transparent',
                    color: palette.textOnPaper,
                  }}
                >
                  {format === 'fisico' ? t.format.physical : format === 'ebook' ? t.format.ebook : t.format.audiobook}
                </button>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              onDismiss();
              onTogglePosse(book);
            }}
            className="w-full py-2.5 px-4 rounded-xl font-sans font-medium text-xs sm:text-sm flex items-center justify-center gap-2 border cursor-pointer hover:bg-black/5 active:scale-98 transition-all select-none"
            style={{ borderColor: palette.woodBorder, color: palette.textOnPaper }}
          >
            {owned ? <MinusCircle size={16} /> : <Library size={16} />}
            {owned ? t.ownership.remove : t.ownership.add}
          </button>

          {/* Ação: Marcar como Lido */}
          {book.status_leitura !== 'lido' && (
            <button
              onClick={() => {
                onDismiss();
                onSetStatusLeitura(book, 'lido');
              }}
              className="w-full py-2.5 px-4 rounded-xl font-sans font-medium text-xs sm:text-sm flex items-center justify-center gap-2 border cursor-pointer hover:bg-black/5 active:scale-98 transition-all select-none"
              style={{
                borderColor: palette.woodBorder,
                color: palette.textOnPaper,
              }}
            >
              <CheckCircle size={16} />
              Marcar como Lido
            </button>
          )}

          {/* Ação: Quero Ler */}
          {book.status_leitura !== 'quero_ler' && (
            <button
              onClick={() => {
                onDismiss();
                onSetStatusLeitura(book, 'quero_ler');
              }}
              className="w-full py-2.5 px-4 rounded-xl font-sans font-medium text-xs sm:text-sm flex items-center justify-center gap-2 border cursor-pointer hover:bg-black/5 active:scale-98 transition-all select-none"
              style={{
                borderColor: palette.woodBorder,
                color: palette.textOnPaper,
              }}
            >
              <Bookmark size={16} />
              Marcar como Quero Ler
            </button>
          )}

          {/* Ação: Remover status de leitura */}
          {book.status_leitura !== 'nenhum' && (
            <button
              onClick={() => {
                onDismiss();
                onSetStatusLeitura(book, 'nenhum');
              }}
              className="w-full py-2 px-4 rounded-xl font-sans text-xs flex items-center justify-center gap-2 border cursor-pointer hover:bg-black/5 active:scale-98 transition-all select-none"
              style={{
                borderColor: `${palette.woodBorder}60`,
                color: palette.textSecondaryOnPaper,
              }}
            >
              Remover status de leitura (Nenhum)
            </button>
          )}

          {/* Editar completo */}
          <button
            onClick={() => {
              onDismiss();
              onEdit(book);
            }}
            className="w-full py-2.5 px-4 rounded-xl font-sans font-medium text-xs sm:text-sm flex items-center justify-center gap-2 border cursor-pointer hover:bg-black/5 active:scale-98 select-none"
            style={{
              borderColor: `${palette.woodBorder}80`,
              color: palette.textOnPaper,
            }}
          >
            <Edit size={15} />
            Editar Dados / Avaliação
          </button>

          {/* Excluir da Estante */}
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full py-2.5 px-4 rounded-xl font-sans font-medium text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors hover:bg-red-50 text-red-700 cursor-pointer mt-1 select-none"
          >
            <Trash2 size={15} />
            Excluir da Estante
          </button>
        </div>
      </div>
    </div>
  );
};
