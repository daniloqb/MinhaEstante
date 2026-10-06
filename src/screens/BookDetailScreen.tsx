import React, { useState } from 'react';
import { Book, ReadingStatus, BookFormat } from '../types/book';
import { WoodPalette } from '../theme/woodTheme';
import { WoodTopAppBar } from '../components/WoodTopAppBar';
import { WoodShelf } from '../components/WoodShelf';
import { BookCoverView } from '../components/BookCoverView';
import { PaperCard } from '../components/PaperCard';
import { StarRatingBar } from '../components/StarRatingBar';
import { BookSummaryAiModal } from '../components/BookSummaryAiModal';
import { BookShoppingModal } from '../components/BookShoppingModal';
import { cacheImageLocally, isDataUrl } from '../services/imageService';
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
  Sparkles,
  ShoppingBag,
  Tablet,
  BookOpen,
  Download,
  CheckCircle2,
  Loader2,
  Handshake,
  User,
  Mail,
  Calendar,
  Clock,
} from 'lucide-react';

interface BookDetailScreenProps {
  palette: WoodPalette;
  book: Book;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePosse: () => void;
  onSetStatusLeitura: (status: ReadingStatus) => void;
  onUpdateBook?: (book: Book) => void;
  onOpenLoanModal?: (book: Book) => void;
  onReturnBook?: (book: Book) => void;
}

export const BookDetailScreen: React.FC<BookDetailScreenProps> = ({
  palette,
  book,
  onBack,
  onEdit,
  onDelete,
  onTogglePosse,
  onSetStatusLeitura,
  onUpdateBook,
  onOpenLoanModal,
  onReturnBook,
}) => {
  const [isDescExpanded, setIsDescExpanded] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isAiSummaryOpen, setIsAiSummaryOpen] = useState(false);
  const [isShoppingOpen, setIsShoppingOpen] = useState(false);
  const [isCachingCover, setIsCachingCover] = useState(false);
  const [cacheSuccessMessage, setCacheSuccessMessage] = useState<string | null>(null);

  const readingDateFormatted =
    book.anoLeitura != null
      ? `${book.mesLeitura ? book.mesLeitura + '/' : ''}${book.anoLeitura}`
      : 'Sem data';

  const isbn = book.isbn13 || book.isbn10;
  const isEbook = book.formato === 'ebook';
  const hasLocalCover = isDataUrl(book.capaUrl);

  const handleDownloadCoverLocally = async () => {
    if (!book.capaUrl || hasLocalCover || isCachingCover) return;
    setIsCachingCover(true);
    setCacheSuccessMessage(null);
    try {
      const dataUrl = await cacheImageLocally(book.capaUrl);
      if (dataUrl && onUpdateBook) {
        onUpdateBook({
          ...book,
          capaUrl: dataUrl,
          dataAtualizacao: Date.now(),
        });
        setCacheSuccessMessage('Capa salva no armazenamento local com sucesso!');
        setTimeout(() => setCacheSuccessMessage(null), 3500);
      }
    } catch {
      // Ignora erro
    } finally {
      setIsCachingCover(false);
    }
  };

  const handleToggleFormat = (newFormat: BookFormat) => {
    if (newFormat === book.formato || !onUpdateBook) return;
    onUpdateBook({
      ...book,
      formato: newFormat,
      tenho_fisico: newFormat === 'fisico' ? book.tenho_fisico : false,
      dataAtualizacao: Date.now(),
    });
  };

  const originLabel =
    book.origem === 'brasilapi'
      ? '🇧🇷 BrasilAPI (Câmara Brasileira do Livro)'
      : book.origem === 'google'
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
              width={170}
              height={255}
              className="shadow-2xl"
              badge={
                isEbook ? (
                  <span
                    className="p-1.5 rounded-full shadow-md flex items-center justify-center border"
                    style={{
                      backgroundColor: '#7c3aed',
                      color: '#ffffff',
                      borderColor: '#FFFFFF70',
                    }}
                    title="E-book Digital"
                  >
                    <Tablet size={14} />
                  </span>
                ) : book.tenho_fisico ? (
                  <span
                    className="p-1.5 rounded-full shadow-md flex items-center justify-center border"
                    style={{
                      backgroundColor: palette.goldPrimary,
                      color: palette.textOnGold,
                      borderColor: '#FFFFFF60',
                    }}
                    title="Tenho este exemplar físico"
                  >
                    <Library size={14} />
                  </span>
                ) : null
              }
            />
          </div>

          {/* Seletor Rápido de Formato: Físico vs E-book */}
          <div className="mt-3 flex items-center gap-2 p-1 rounded-xl bg-black/25 border border-white/10 backdrop-blur-sm">
            <button
              type="button"
              onClick={() => handleToggleFormat('fisico')}
              className={`px-3 py-1.5 rounded-lg font-serif text-sm font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                !isEbook ? 'shadow-md' : 'opacity-65 hover:opacity-90'
              }`}
              style={{
                backgroundColor: !isEbook ? palette.goldPrimary : 'transparent',
                color: !isEbook ? palette.textOnGold : palette.textOnWood,
              }}
            >
              <BookOpen size={15} />
              Livro Físico
            </button>
            <button
              type="button"
              onClick={() => handleToggleFormat('ebook')}
              className={`px-3 py-1.5 rounded-lg font-serif text-sm font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                isEbook ? 'shadow-md' : 'opacity-65 hover:opacity-90'
              }`}
              style={{
                backgroundColor: isEbook ? '#7c3aed' : 'transparent',
                color: '#ffffff',
              }}
            >
              <Tablet size={15} />
              E-book Digital
            </button>
          </div>

          {/* Status de Armazenamento Local da Capa */}
          {book.capaUrl && (
            <div className="mt-2 flex flex-col items-center">
              {hasLocalCover ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-serif px-2.5 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/40 text-emerald-300">
                  <CheckCircle2 size={13} />
                  Capa guardada no aparelho (salva no backup)
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleDownloadCoverLocally}
                  disabled={isCachingCover}
                  className="inline-flex items-center gap-1.5 text-xs font-serif px-3 py-1 rounded-full border bg-black/30 hover:bg-black/45 text-amber-200 border-amber-400/40 transition-colors cursor-pointer"
                  title="Baixar a imagem da capa para não depender de link de internet externo"
                >
                  {isCachingCover ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                  Salvar capa no aparelho (garantir no backup)
                </button>
              )}
              {cacheSuccessMessage && (
                <span className="text-xs text-emerald-300 mt-1 font-serif">
                  {cacheSuccessMessage}
                </span>
              )}
            </div>
          )}

          {/* Prateleira com detalhes em latão sob o livro */}
          <WoodShelf
            palette={palette}
            label={book.anoPublicacao ? `Publicado em ${book.anoPublicacao}` : null}
            sublabel={book.editora || null}
            className="mt-2 w-full max-w-sm"
          />
        </div>

        {/* 2 Novos Cards Inteligentes: Resumo IA & Onde Comprar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Ação 1: Resumo com Inteligência Artificial */}
          <button
            type="button"
            onClick={() => setIsAiSummaryOpen(true)}
            className="p-4 rounded-2xl border text-left flex items-start gap-3.5 shadow-lg cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99]"
            style={{
              backgroundColor: palette.paperSurface,
              borderColor: palette.goldPrimary,
            }}
          >
            <div
              className="p-2.5 rounded-xl shrink-0"
              style={{
                backgroundColor: `${palette.goldPrimary}25`,
                color: palette.goldPrimary,
              }}
            >
              <Sparkles size={22} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-serif font-bold text-base" style={{ color: palette.textOnPaper }}>
                  Resumo da Obra (IA)
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-700">
                  Online
                </span>
              </div>
              <p className="text-xs leading-relaxed mt-1" style={{ color: palette.textSecondaryOnPaper }}>
                Relembre o enredo, personagens e pontos centrais sem spoilers.
              </p>
            </div>
          </button>

          {/* Ação 2: Pesquisar Onde Comprar na Internet */}
          <button
            type="button"
            onClick={() => setIsShoppingOpen(true)}
            className="p-4 rounded-2xl border text-left flex items-start gap-3.5 shadow-lg cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99]"
            style={{
              backgroundColor: palette.paperSurface,
              borderColor: palette.woodBorder,
            }}
          >
            <div
              className="p-2.5 rounded-xl shrink-0"
              style={{
                backgroundColor: `${palette.woodBorder}20`,
                color: palette.woodBorder,
              }}
            >
              <ShoppingBag size={22} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-serif font-bold text-base" style={{ color: palette.textOnPaper }}>
                  Onde Comprar
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-700">
                  Lojas
                </span>
              </div>
              <p className="text-xs leading-relaxed mt-1" style={{ color: palette.textSecondaryOnPaper }}>
                Buscar preços na Amazon, Estante Virtual, Google Shopping e mais.
              </p>
            </div>
          </button>
        </div>

        {/* Informações Bibliográficas em Cartão de Papel Envelhecido */}
        <PaperCard palette={palette} elevated className="flex flex-col gap-4">
          {/* Banner de Obra Pesquisada (Ainda não salva na estante) */}
          {book.id === 0 && (
            <div
              className="p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in"
              style={{
                backgroundColor: `${palette.goldPrimary}15`,
                borderColor: palette.goldPrimary,
              }}
            >
              <div>
                <span className="font-serif font-bold text-xs block text-amber-950">
                  🔍 Obra Encontrada na Pesquisa
                </span>
                <span className="text-[11px] opacity-85" style={{ color: palette.textOnPaper }}>
                  Esta obra ainda não foi adicionada. Escolha como deseja salvá-la na sua estante:
                </span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={onTogglePosse}
                  className="px-3 py-1.5 rounded-lg font-serif font-bold text-xs shadow-xs cursor-pointer hover:brightness-105 active:scale-95 transition-all flex items-center gap-1"
                  style={{ backgroundColor: palette.goldPrimary, color: palette.textOnGold }}
                >
                  <Library size={13} />
                  <span>+ Livro Físico</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleFormat('ebook')}
                  className="px-3 py-1.5 rounded-lg font-serif font-bold text-xs shadow-xs cursor-pointer hover:brightness-105 active:scale-95 transition-all flex items-center gap-1 bg-purple-700 text-white"
                >
                  <Tablet size={13} />
                  <span>+ E-book</span>
                </button>
                <button
                  type="button"
                  onClick={() => onSetStatusLeitura('quero_ler')}
                  className="px-3 py-1.5 rounded-lg font-serif font-bold text-xs shadow-xs cursor-pointer hover:brightness-105 active:scale-95 transition-all flex items-center gap-1 bg-blue-700 text-white"
                >
                  <Bookmark size={13} />
                  <span>+ Quero Ler</span>
                </button>
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <span
                className="text-xs font-serif font-bold uppercase tracking-wider px-2 py-0.5 rounded-md"
                style={{
                  backgroundColor: isEbook ? '#7c3aed20' : `${palette.goldPrimary}20`,
                  color: isEbook ? '#7c3aed' : palette.goldPrimary,
                }}
              >
                {isEbook ? '📱 E-book Digital' : '📖 Livro Físico'}
              </span>
            </div>
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
              className="font-serif font-semibold text-lg mt-2"
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
                <Library size={19} />
              </div>
              <div>
                <span className="font-serif font-bold text-base block" style={{ color: palette.textOnPaper }}>
                  Tenho este exemplar em casa
                </span>
                <span className="text-xs sm:text-sm" style={{ color: palette.textSecondaryOnPaper }}>
                  {book.tenho_fisico
                    ? 'Exemplar físico no acervo pessoal (Aba Livros Físicos)'
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
              title={book.tenho_fisico ? 'Remover de Livros Físicos' : 'Adicionar a Livros Físicos'}
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

        {/* Card de Empréstimo Ativo */}
        {book.emprestimo && !book.emprestimo.devolvido && (
          <PaperCard palette={palette} elevated className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className="p-2 rounded-xl"
                  style={{ backgroundColor: `${palette.goldPrimary}25`, color: palette.woodBorder }}
                >
                  <Handshake size={20} />
                </div>
                <div>
                  <h4 className="font-serif font-bold text-base leading-tight" style={{ color: palette.textOnPaper }}>
                    Livro Emprestado
                  </h4>
                  <p className="text-[11px] opacity-75 font-serif" style={{ color: palette.textSecondaryOnPaper }}>
                    Este exemplar está com outra pessoa
                  </p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-900 border border-amber-400/50">
                Ativo
              </span>
            </div>

            <div
              className="p-3 rounded-xl border flex flex-col gap-1.5 text-xs"
              style={{ backgroundColor: palette.paperSurfaceElevated, borderColor: palette.paperBorder }}
            >
              <div className="flex items-center gap-1.5 font-bold" style={{ color: palette.textOnPaper }}>
                <User size={14} className="opacity-70 text-amber-900 shrink-0" />
                <span>Emprestado para: <strong className="underline decoration-amber-500/50">{book.emprestimo.nomePessoa}</strong></span>
              </div>

              {book.emprestimo.emailPessoa && (
                <div className="flex items-center gap-1.5 text-[11px]">
                  <Mail size={13} className="opacity-70 shrink-0" />
                  <a
                    href={`mailto:${book.emprestimo.emailPessoa}?subject=Livro Emprestado: ${encodeURIComponent(book.titulo)}`}
                    className="hover:underline text-blue-700"
                  >
                    {book.emprestimo.emailPessoa}
                  </a>
                </div>
              )}

              <div className="flex items-center gap-3 flex-wrap text-[11px] pt-0.5">
                <span className="flex items-center gap-1 opacity-75">
                  <Calendar size={12} />
                  <span>Desde: {book.emprestimo.dataEmprestimo}</span>
                </span>
                <span className="flex items-center gap-1 font-semibold">
                  <Clock size={12} />
                  <span>Devolução prevista: {book.emprestimo.dataDevolucao}</span>
                </span>
              </div>

              {book.emprestimo.observacoes && (
                <p className="text-[11px] italic opacity-80 mt-0.5 border-l-2 pl-2 border-amber-600/40">
                  &ldquo;{book.emprestimo.observacoes}&rdquo;
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 pt-1">
              {onReturnBook && (
                <button
                  type="button"
                  onClick={() => onReturnBook(book)}
                  className="flex-1 py-2.5 px-3 rounded-xl font-serif font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-98 transition-all"
                >
                  <CheckCircle2 size={15} />
                  <span>Marcar como Devolvido</span>
                </button>
              )}
              {onOpenLoanModal && (
                <button
                  type="button"
                  onClick={() => onOpenLoanModal(book)}
                  className="py-2.5 px-3.5 rounded-xl font-serif font-semibold text-xs border flex items-center justify-center gap-1.5 cursor-pointer hover:bg-black/5 active:scale-98 transition-all"
                  style={{ borderColor: palette.woodBorder, color: palette.textOnPaper }}
                >
                  <Edit size={14} />
                  <span>Editar Empréstimo</span>
                </button>
              )}
            </div>
          </PaperCard>
        )}

        {/* Botões de Ação na Estante */}
        <div className="flex flex-col gap-2.5 pb-8">
          {/* Ação: Emprestar Livro (se não estiver com empréstimo ativo) */}
          {(!book.emprestimo || book.emprestimo.devolvido) && onOpenLoanModal && (
            <button
              type="button"
              onClick={() => onOpenLoanModal(book)}
              className="w-full py-3 rounded-xl font-serif font-bold text-sm shadow-md flex items-center justify-center gap-2 border cursor-pointer hover:brightness-105 active:scale-98 transition-all"
              style={{
                backgroundColor: `${palette.goldPrimary}15`,
                borderColor: palette.goldPrimary,
                color: palette.goldPrimary,
              }}
            >
              <Handshake size={17} />
              <span>Emprestar este Livro</span>
            </button>
          )}

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

      {/* Modal de Resumo com Inteligência Artificial */}
      <BookSummaryAiModal
        isOpen={isAiSummaryOpen}
        onClose={() => setIsAiSummaryOpen(false)}
        book={book}
        palette={palette}
      />

      {/* Modal de Pesquisa de Lojas / Onde Comprar */}
      <BookShoppingModal
        isOpen={isShoppingOpen}
        onClose={() => setIsShoppingOpen(false)}
        book={book}
        palette={palette}
      />
    </div>
  );
};
