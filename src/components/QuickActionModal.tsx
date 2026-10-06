import React, { useState } from 'react';
import { Book, ReadingStatus, isBookBorrowed } from '../types/book';
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
  onToggleFormato?: (book: Book) => void;
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (!book) return null;
  const isEbook = book.formato === 'ebook';

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
                className="flex-1 py-2.5 px-3 rounded-lg font-serif font-semibold text-base border cursor-pointer hover:bg-black/5"
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
                className="flex-1 py-2.5 px-3 rounded-lg font-serif font-bold text-base bg-red-700 text-white cursor-pointer hover:bg-red-800"
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
            <p className="font-serif text-base italic mt-0.5" style={{ color: palette.textSecondaryOnPaper }}>
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
          <span
            className="text-xs font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-1"
            style={{
              backgroundColor: isEbook ? '#7c3aed20' : `${palette.goldPrimary}20`,
              borderColor: isEbook ? '#7c3aed80' : palette.goldPrimary,
              color: isEbook ? '#7c3aed' : palette.woodBorder,
            }}
          >
            {isEbook ? <Tablet size={12} /> : <BookOpen size={12} />}
            {isEbook ? 'E-book Digital' : 'Livro Físico'}
          </span>

          {!isEbook && (
            <span
              className="text-xs font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-1"
              style={{
                backgroundColor: book.tenho_fisico ? `${palette.goldPrimary}20` : '#00000008',
                borderColor: book.tenho_fisico ? palette.goldPrimary : `${palette.woodBorder}40`,
                color: book.tenho_fisico ? palette.woodBorder : palette.textSecondaryOnPaper,
              }}
            >
              <Library size={12} />
              {book.tenho_fisico ? 'Tenho em casa' : 'Sem posse física'}
            </span>
          )}

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
              'Sem leitura'
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
            className="w-full py-3 px-4 rounded-xl font-serif font-bold text-base flex items-center justify-center gap-2 shadow-sm cursor-pointer hover:brightness-105 active:scale-98 transition-all"
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
              className="w-full py-2.5 px-4 rounded-xl font-serif font-bold text-sm flex items-center justify-center gap-2 border cursor-pointer hover:bg-black/5 active:scale-98 transition-all"
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

          {/* Trocar entre Físico e E-book */}
          {onToggleFormato && (
            <button
              onClick={() => {
                onToggleFormato(book);
              }}
              className="w-full py-2 px-4 rounded-xl font-serif font-medium text-xs sm:text-sm flex items-center justify-center gap-2 border cursor-pointer hover:bg-black/5 active:scale-98 transition-all"
              style={{
                borderColor: `${palette.woodBorder}70`,
                color: palette.textOnPaper,
              }}
            >
              {isEbook ? (
                <>
                  <BookOpen size={14} /> Mudar para Livro Físico
                </>
              ) : (
                <>
                  <Tablet size={14} /> Mudar para E-book Digital
                </>
              )}
            </button>
          )}

          {/* Ação de Posse Física (se for livro físico) */}
          {!isEbook && (
            <button
              onClick={() => {
                onDismiss();
                onTogglePosse(book);
              }}
              className="w-full py-2 px-4 rounded-xl font-serif font-semibold text-sm flex items-center justify-center gap-2 border cursor-pointer hover:bg-black/5 active:scale-98 transition-all"
              style={{
                borderColor: palette.woodBorder,
                color: palette.textOnPaper,
              }}
            >
              {book.tenho_fisico ? (
                <>
                  <MinusCircle size={16} />
                  Remover de Meus Livros (não tenho mais)
                </>
              ) : (
                <>
                  <Library size={16} />
                  Adicionar a Meus Livros (tenho físico)
                </>
              )}
            </button>
          )}

          {/* Ação: Marcar como Lido */}
          {book.status_leitura !== 'lido' && (
            <button
              onClick={() => {
                onDismiss();
                onSetStatusLeitura(book, 'lido');
              }}
              className="w-full py-2 px-4 rounded-xl font-serif font-semibold text-sm flex items-center justify-center gap-2 border cursor-pointer hover:bg-black/5 active:scale-98 transition-all"
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
              className="w-full py-2 px-4 rounded-xl font-serif font-semibold text-sm flex items-center justify-center gap-2 border cursor-pointer hover:bg-black/5 active:scale-98 transition-all"
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
              className="w-full py-2 px-4 rounded-xl font-serif text-xs flex items-center justify-center gap-2 border cursor-pointer hover:bg-black/5 active:scale-98 transition-all"
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
            className="w-full py-2 px-4 rounded-xl font-serif font-semibold text-sm flex items-center justify-center gap-2 border cursor-pointer hover:bg-black/5 active:scale-98"
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
            className="w-full py-2 px-4 rounded-xl font-serif font-medium text-xs flex items-center justify-center gap-2 transition-colors hover:bg-red-50 text-red-700 cursor-pointer mt-1"
          >
            <Trash2 size={15} />
            Excluir da Estante
          </button>
        </div>
      </div>
    </div>
  );
};
