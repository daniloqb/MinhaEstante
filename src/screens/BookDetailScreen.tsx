import React, { useState } from 'react';
import { Book } from '../types/book';
import { WoodPalette } from '../theme/woodTheme';
import { WoodTopAppBar } from '../components/WoodTopAppBar';
import { WoodShelf } from '../components/WoodShelf';
import { BookCoverView } from '../components/BookCoverView';
import { PaperCard } from '../components/PaperCard';
import { StarRatingBar } from '../components/StarRatingBar';
import {
  ArrowLeft,
  Edit,
  Trash2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface BookDetailScreenProps {
  palette: WoodPalette;
  book: Book;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleStatus: () => void;
}

export const BookDetailScreen: React.FC<BookDetailScreenProps> = ({
  palette,
  book,
  onBack,
  onEdit,
  onDelete,
  onToggleStatus,
}) => {
  const [isDescExpanded, setIsDescExpanded] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const readingDateFormatted =
    book.anoLeitura != null
      ? `${book.mesLeitura ? book.mesLeitura + '/' : ''}${book.anoLeitura}`
      : 'Sem data';

  const isbn = book.isbn13 || book.isbn10;

  const originLabel =
    book.origem === 'google'
      ? 'Google Books'
      : book.origem === 'openlibrary'
      ? 'Open Library'
      : 'Cadastro Manual';

  return (
    <div className="flex flex-col w-full min-h-screen">
      {/* Diálogo de confirmação de exclusão */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
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
            <h3 className="font-serif font-bold text-xl mb-2">Remover Livro</h3>
            <p className="text-sm mb-5 leading-relaxed" style={{ color: palette.textSecondaryOnPaper }}>
              Tem certeza que deseja remover <strong>&ldquo;{book.titulo}&rdquo;</strong> da sua
              estante?
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 rounded-lg font-serif text-sm border cursor-pointer"
                style={{ borderColor: palette.woodBorder, color: palette.textOnPaper }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  onDelete();
                }}
                className="px-4 py-2 rounded-lg font-serif font-bold text-sm bg-red-700 text-white cursor-pointer hover:bg-red-800"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top App Bar */}
      <WoodTopAppBar
        palette={palette}
        title="Detalhes da Obra"
        navigationIcon={
          <button
            onClick={onBack}
            className="p-1.5 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
            title="Voltar"
          >
            <ArrowLeft size={20} color={palette.goldPrimary} />
          </button>
        }
        actions={
          <>
            <button
              onClick={onEdit}
              className="p-2 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
              title="Editar"
            >
              <Edit size={18} color={palette.goldPrimary} />
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-2 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
              title="Excluir"
            >
              <Trash2 size={18} color={palette.goldPrimary} />
            </button>
          </>
        }
      />

      {/* Conteúdo rolável */}
      <div className="flex-1 w-full max-w-2xl mx-auto px-4 py-6 flex flex-col gap-6">
        {/* Capa em destaque repousando sobre prateleira 3D */}
        <div className="w-full flex flex-col items-center">
          <BookCoverView
            palette={palette}
            title={book.titulo}
            author={book.autores[0]}
            coverUrl={book.capaUrl}
            width={160}
            height={240}
            className="shadow-2xl mb-1"
          />
          <WoodShelf palette={palette} className="w-full max-w-sm -mt-1" />
        </div>

        {/* Informações detalhadas em Cartão de Papel Envelhecido */}
        <PaperCard palette={palette} elevated className="flex flex-col gap-4">
          <div>
            <h2
              className="font-serif font-bold text-2xl sm:text-3xl leading-snug"
              style={{ color: palette.textOnPaper }}
            >
              {book.titulo}
            </h2>
            {book.subtitulo && (
              <p
                className="font-serif text-lg font-medium italic mt-0.5"
                style={{ color: palette.textSecondaryOnPaper }}
              >
                {book.subtitulo}
              </p>
            )}
            <p
              className="font-serif font-semibold text-base mt-2"
              style={{ color: palette.woodBorder }}
            >
              {book.autores.join(', ') || 'Autor desconhecido'}
            </p>
          </div>

          {/* Status e Avaliação */}
          <div
            className="flex items-center justify-between py-3 border-y"
            style={{ borderColor: `${palette.woodBorder}30` }}
          >
            {book.status === 'lido' ? (
              <>
                <div>
                  <span className="text-xs block font-semibold" style={{ color: palette.textSecondaryOnPaper }}>
                    Avaliação:
                  </span>
                  <StarRatingBar
                    palette={palette}
                    rating={book.nota}
                    starSize={18}
                  />
                </div>
                <div className="text-right">
                  <span className="text-xs block font-semibold" style={{ color: palette.textSecondaryOnPaper }}>
                    Lido em:
                  </span>
                  <span className="font-serif font-bold text-base" style={{ color: palette.textOnPaper }}>
                    {readingDateFormatted}
                  </span>
                </div>
              </>
            ) : (
              <span
                className="font-serif font-bold text-sm px-3 py-1 rounded-full border"
                style={{
                  borderColor: palette.woodBorder,
                  color: palette.woodBorder,
                }}
              >
                Na lista: Quero Ler
              </span>
            )}
          </div>

          {/* Bloco de Metadados */}
          <div
            className="rounded-xl p-3.5 flex flex-col gap-1.5 text-xs sm:text-sm border"
            style={{
              backgroundColor: palette.paperSurfaceElevated,
              borderColor: palette.paperBorder,
            }}
          >
            {book.paginas != null && book.paginas > 0 && (
              <div className="flex justify-between">
                <span style={{ color: palette.textSecondaryOnPaper }}>Páginas:</span>
                <span className="font-semibold">{book.paginas} páginas</span>
              </div>
            )}
            {book.editora && (
              <div className="flex justify-between">
                <span style={{ color: palette.textSecondaryOnPaper }}>Editora:</span>
                <span className="font-semibold">{book.editora}</span>
              </div>
            )}
            {book.anoPublicacao != null && (
              <div className="flex justify-between">
                <span style={{ color: palette.textSecondaryOnPaper }}>Ano de Publicação:</span>
                <span className="font-semibold">{book.anoPublicacao}</span>
              </div>
            )}
            {isbn && (
              <div className="flex justify-between">
                <span style={{ color: palette.textSecondaryOnPaper }}>ISBN:</span>
                <span className="font-semibold font-mono text-xs">{isbn}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span style={{ color: palette.textSecondaryOnPaper }}>Origem dos dados:</span>
              <span className="font-semibold">{originLabel}</span>
            </div>
          </div>

          {/* Gêneros */}
          {book.generos.length > 0 && (
            <div>
              <h4 className="font-serif font-bold text-base mb-1.5" style={{ color: palette.textOnPaper }}>
                Gêneros:
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {book.generos.map((gen) => (
                  <span
                    key={gen}
                    className="px-2.5 py-0.5 rounded-full text-xs font-serif border"
                    style={{
                      backgroundColor: palette.paperSurfaceElevated,
                      borderColor: `${palette.woodBorder}60`,
                      color: palette.textOnPaper,
                    }}
                  >
                    {gen}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Observações pessoais */}
          {book.observacoes && (
            <div>
              <h4 className="font-serif font-bold text-base mb-1" style={{ color: palette.textOnPaper }}>
                Suas Observações:
              </h4>
              <div
                className="p-3 rounded-lg text-sm leading-relaxed border"
                style={{
                  backgroundColor: palette.paperSurfaceElevated,
                  borderColor: palette.paperBorder,
                  color: palette.textOnPaper,
                }}
              >
                {book.observacoes}
              </div>
            </div>
          )}

          {/* Sinopse / Descrição */}
          {book.descricao && (
            <div>
              <button
                type="button"
                onClick={() => setIsDescExpanded(!isDescExpanded)}
                className="w-full flex items-center justify-between font-serif font-bold text-base cursor-pointer hover:opacity-85"
                style={{ color: palette.textOnPaper }}
              >
                <span>Sinopse:</span>
                {isDescExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>
              <p
                className={`text-sm leading-relaxed mt-1.5 transition-all ${
                  isDescExpanded ? '' : 'line-clamp-3'
                }`}
                style={{ color: palette.textSecondaryOnPaper }}
              >
                {book.descricao}
              </p>
            </div>
          )}
        </PaperCard>

        {/* Botões de Ação na Estante */}
        <div className="flex flex-col gap-2.5 pb-8">
          {book.status === 'quero_ler' ? (
            <button
              type="button"
              onClick={onEdit}
              className="w-full py-3.5 rounded-xl font-serif font-bold text-base shadow-lg cursor-pointer hover:brightness-105 active:scale-98 transition-all"
              style={{
                backgroundColor: palette.goldPrimary,
                color: palette.textOnGold,
              }}
            >
              Marcar como lido
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onEdit}
                className="w-full py-3 rounded-xl font-serif font-bold text-base shadow-lg cursor-pointer hover:brightness-105 active:scale-98 transition-all"
                style={{
                  backgroundColor: palette.goldPrimary,
                  color: palette.textOnGold,
                }}
              >
                Editar leitura & nota
              </button>

              <button
                type="button"
                onClick={onToggleStatus}
                className="w-full py-2.5 rounded-xl font-serif font-semibold text-sm border cursor-pointer hover:bg-white/5 active:scale-98 transition-all"
                style={{
                  borderColor: palette.goldPrimary,
                  color: palette.goldPrimary,
                }}
              >
                Mover para Quero Ler
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
