import React, { useState } from 'react';
import { Book, ReadingStatus } from '../types/book';
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
  CheckCircle,
  Bookmark,
  Library,
  Check,
  MinusCircle,
  AlertTriangle,
} from 'lucide-react';

interface BookDetailScreenProps {
  palette: WoodPalette;
  book: Book;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePosse: () => void;
  onSetStatusLeitura: (status: ReadingStatus) => void;
}

export const BookDetailScreen: React.FC<BookDetailScreenProps> = ({
  palette,
  book,
  onBack,
  onEdit,
  onDelete,
  onTogglePosse,
  onSetStatusLeitura,
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
            <div className="flex items-center gap-2 mb-3 text-red-700">
              <AlertTriangle size={24} />
              <h3 className="font-serif font-bold text-xl leading-tight">
                Excluir livro da estante?
              </h3>
            </div>

            <p className="text-sm leading-relaxed mb-6" style={{ color: palette.textOnPaper }}>
              Tem certeza de que deseja excluir <strong>&ldquo;{book.titulo}&rdquo;</strong>? Esta ação apagará todos os dados, avaliações e registros deste livro.
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2 px-3 rounded-lg font-serif font-semibold text-sm border cursor-pointer hover:bg-black/5"
                style={{ borderColor: palette.woodBorder }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  onDelete();
                }}
                className="flex-1 py-2 px-3 rounded-lg font-serif font-bold text-sm bg-red-700 text-white cursor-pointer hover:bg-red-800"
              >
                Sim, excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top App Bar com estilo clássico */}
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
          <div className="flex items-center gap-1">
            <button
              onClick={onEdit}
              className="p-2 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
              title="Editar dados"
            >
              <Edit size={19} color={palette.goldPrimary} />
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-2 rounded-full hover:bg-white/10 transition-colors cursor-pointer text-red-400 hover:text-red-300"
              title="Excluir livro"
            >
              <Trash2 size={19} />
            </button>
          </div>
        }
      />

      {/* Área Central Rolável */}
      <div className="flex-1 w-full max-w-2xl mx-auto px-4 py-6 flex flex-col gap-6">
        {/* Bloco Hero: Capa 3D sobre a Prateleira de Madeira */}
        <div className="flex flex-col items-center">
          <div className="relative group">
            <BookCoverView
              palette={palette}
              title={book.titulo}
              author={book.autores[0]}
              coverUrl={book.capaUrl}
              width={160}
              height={240}
              className="shadow-2xl"
              badge={
                book.tenho_fisico ? (
                  <span
                    className="p-1 rounded-full shadow-md flex items-center justify-center border"
                    style={{
                      backgroundColor: palette.goldPrimary,
                      color: palette.textOnGold,
                      borderColor: '#FFFFFF60',
                    }}
                    title="Tenho este exemplar em casa"
                  >
                    <Library size={13} />
                  </span>
                ) : null
              }
            />
          </div>

          {/* Prateleira com detalhes em latão sob o livro */}
          <WoodShelf
            palette={palette}
            label={book.anoPublicacao ? `Publicado em ${book.anoPublicacao}` : null}
            sublabel={book.editora || null}
            className="mt-2 w-full max-w-sm"
          />
        </div>

        {/* Informações Bibliográficas em Cartão de Papel Envelhecido */}
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

          {/* Painel Independente 1: Posse Física (Switch com estado reativo) */}
          <div
            className="p-3.5 rounded-xl border flex items-center justify-between transition-colors"
            style={{
              backgroundColor: book.tenho_fisico ? `${palette.goldPrimary}18` : palette.paperSurfaceElevated,
              borderColor: book.tenho_fisico ? palette.goldPrimary : palette.paperBorder,
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="p-2 rounded-lg"
                style={{
                  backgroundColor: book.tenho_fisico ? palette.goldPrimary : `${palette.woodBorder}20`,
                  color: book.tenho_fisico ? palette.textOnGold : palette.woodBorder,
                }}
              >
                <Library size={18} />
              </div>
              <div>
                <span className="font-serif font-bold text-sm sm:text-base block" style={{ color: palette.textOnPaper }}>
                  Tenho este livro em casa
                </span>
                <span className="text-xs" style={{ color: palette.textSecondaryOnPaper }}>
                  {book.tenho_fisico
                    ? 'Exemplar físico no acervo pessoal (Aba Meus Livros)'
                    : 'Não possuo o exemplar físico no momento'}
                </span>
              </div>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={book.tenho_fisico}
              onClick={onTogglePosse}
              className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none"
              style={{
                backgroundColor: book.tenho_fisico ? palette.goldPrimary : '#9ca3af',
              }}
              title={book.tenho_fisico ? 'Remover de Meus Livros' : 'Adicionar a Meus Livros'}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  book.tenho_fisico ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Painel Independente 2: Status de Leitura & Avaliação */}
          <div
            className="flex flex-col gap-2 py-3 border-y"
            style={{ borderColor: `${palette.woodBorder}30` }}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase font-bold tracking-wider" style={{ color: palette.woodBorder }}>
                Status de leitura:
              </span>

              {book.status_leitura === 'lido' ? (
                <span
                  className="font-serif font-bold text-xs px-2.5 py-0.5 rounded-full border flex items-center gap-1"
                  style={{
                    borderColor: '#10b981',
                    backgroundColor: '#10b98120',
                    color: '#065f46',
                  }}
                >
                  <Check size={12} />
                  Lido
                </span>
              ) : book.status_leitura === 'quero_ler' ? (
                <span
                  className="font-serif font-bold text-xs px-2.5 py-0.5 rounded-full border flex items-center gap-1"
                  style={{
                    borderColor: '#3b82f6',
                    backgroundColor: '#3b82f620',
                    color: '#1e40af',
                  }}
                >
                  <Bookmark size={12} />
                  Quero Ler
                </span>
              ) : (
                <span className="text-xs italic" style={{ color: palette.textSecondaryOnPaper }}>
                  Nenhum plano registrado
                </span>
              )}
            </div>

            {book.status_leitura === 'lido' && (
              <div className="flex items-center justify-between pt-2">
                <div>
                  <span className="text-xs block font-semibold mb-0.5" style={{ color: palette.textSecondaryOnPaper }}>
                    Avaliação:
                  </span>
                  <StarRatingBar
                    palette={palette}
                    rating={book.nota}
                    starSize={18}
                    showLabel={true}
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
              </div>
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
          {book.generos && book.generos.length > 0 && (
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
          {/* Se não estiver lido: ação de Marcar como Lido */}
          {book.status_leitura !== 'lido' && (
            <button
              type="button"
              onClick={() => onSetStatusLeitura('lido')}
              className="w-full py-3.5 rounded-xl font-serif font-bold text-base shadow-lg flex items-center justify-center gap-2 cursor-pointer hover:brightness-105 active:scale-98 transition-all"
              style={{
                backgroundColor: palette.goldPrimary,
                color: palette.textOnGold,
              }}
            >
              <CheckCircle size={18} />
              Marcar como Lido
            </button>
          )}

          {/* Se estiver lido: botão de editar leitura & nota */}
          {book.status_leitura === 'lido' && (
            <button
              type="button"
              onClick={onEdit}
              className="w-full py-3 rounded-xl font-serif font-bold text-base shadow-lg cursor-pointer hover:brightness-105 active:scale-98 transition-all"
              style={{
                backgroundColor: palette.goldPrimary,
                color: palette.textOnGold,
              }}
            >
              Editar Avaliação & Data
            </button>
          )}

          {/* Se não estiver em Quero Ler: botão para Quero Ler */}
          {book.status_leitura !== 'quero_ler' && (
            <button
              type="button"
              onClick={() => onSetStatusLeitura('quero_ler')}
              className="w-full py-2.5 rounded-xl font-serif font-semibold text-sm border flex items-center justify-center gap-1.5 cursor-pointer hover:bg-white/5 active:scale-98 transition-all"
              style={{
                borderColor: palette.goldPrimary,
                color: palette.goldPrimary,
              }}
            >
              <Bookmark size={15} />
              Marcar como Quero Ler
            </button>
          )}

          {/* Se tiver status de leitura: opção de remover status */}
          {book.status_leitura !== 'nenhum' && (
            <button
              type="button"
              onClick={() => onSetStatusLeitura('nenhum')}
              className="w-full py-2 rounded-xl font-serif text-xs border flex items-center justify-center gap-1.5 cursor-pointer hover:bg-white/5 active:scale-98 transition-all"
              style={{
                borderColor: `${palette.woodBorder}60`,
                color: palette.textSecondaryOnWood,
              }}
            >
              <MinusCircle size={13} />
              Remover status de leitura (definir como Nenhum)
            </button>
          )}

          {/* Botão de editar todos os dados */}
          <button
            type="button"
            onClick={onEdit}
            className="w-full py-2.5 rounded-xl font-serif font-semibold text-sm border flex items-center justify-center gap-1.5 cursor-pointer hover:bg-white/5 active:scale-98 transition-all"
            style={{
              borderColor: palette.woodBorder,
              color: palette.textOnWood,
            }}
          >
            <Edit size={15} />
            Editar Todos os Dados da Obra
          </button>
        </div>
      </div>
    </div>
  );
};
