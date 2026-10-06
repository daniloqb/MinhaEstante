import React, { useState, useMemo } from 'react';
import { Book, BookLoan } from '../types/book';
import { WoodPalette } from '../theme/woodTheme';
import { WoodTopAppBar } from '../components/WoodTopAppBar';
import { PaperCard } from '../components/PaperCard';
import {
  Handshake,
  Search,
  Calendar,
  Clock,
  User,
  Mail,
  CheckCircle2,
  AlertTriangle,
  BookOpen,
  Edit,
  ArrowRight,
  X,
  History,
} from 'lucide-react';

interface LoansScreenProps {
  palette: WoodPalette;
  books: Book[];
  onOpenBookDetail: (book: Book) => void;
  onOpenLoanModal: (book: Book) => void;
  onReturnBook: (book: Book) => void;
  onGoToShelf: () => void;
}

export const LoansScreen: React.FC<LoansScreenProps> = ({
  palette,
  books,
  onOpenBookDetail,
  onOpenLoanModal,
  onReturnBook,
  onGoToShelf,
}) => {
  const [activeTab, setActiveTab] = useState<'ativos' | 'historico'>('ativos');
  const [searchQuery, setSearchQuery] = useState('');
  const [isBookPickerOpen, setIsBookPickerOpen] = useState(false);
  const [bookPickerQuery, setBookPickerQuery] = useState('');

  // Livros atualmente emprestados (ativos)
  const activeBorrowedBooks = useMemo(() => {
    return books.filter((b) => b.emprestimo && !b.emprestimo.devolvido);
  }, [books]);

  // Livros disponíveis para empréstimo (todos os livros que não estão emprestados no momento)
  const availableBooksToLoan = useMemo(() => {
    const available = books.filter((b) => !b.emprestimo || b.emprestimo.devolvido);
    if (!bookPickerQuery.trim()) return available;
    const q = bookPickerQuery.toLowerCase().trim();
    return available.filter(
      (b) =>
        b.titulo.toLowerCase().includes(q) ||
        b.autores.some((a) => a.toLowerCase().includes(q))
    );
  }, [books, bookPickerQuery]);

  // Livros já devolvidos (histórico)
  const historyBorrowedBooks = useMemo(() => {
    return books.filter((b) => b.emprestimo && b.emprestimo.devolvido);
  }, [books]);

  // Lista filtrada pela busca
  const displayedBooks = useMemo(() => {
    const list = activeTab === 'ativos' ? activeBorrowedBooks : historyBorrowedBooks;
    if (!searchQuery.trim()) return list;

    const q = searchQuery.toLowerCase().trim();
    return list.filter((b) => {
      const titleMatch = b.titulo.toLowerCase().includes(q);
      const authorMatch = b.autores.some((a) => a.toLowerCase().includes(q));
      const personMatch = b.emprestimo?.nomePessoa?.toLowerCase().includes(q);
      const emailMatch = b.emprestimo?.emailPessoa?.toLowerCase().includes(q);
      return titleMatch || authorMatch || personMatch || emailMatch;
    });
  }, [activeTab, activeBorrowedBooks, historyBorrowedBooks, searchQuery]);

  // Métricas de prazo dos empréstimos ativos
  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let atrasados = 0;
    let proximos = 0;
    let noPrazo = 0;

    activeBorrowedBooks.forEach((b) => {
      if (!b.emprestimo?.dataDevolucao) return;
      const [year, month, day] = b.emprestimo.dataDevolucao.split('-').map(Number);
      const dueDate = new Date(year, month - 1, day);
      const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays < 0) {
        atrasados++;
      } else if (diffDays <= 3) {
        proximos++;
      } else {
        noPrazo++;
      }
    });

    return { total: activeBorrowedBooks.length, atrasados, proximos, noPrazo };
  }, [activeBorrowedBooks]);

  const formatDisplayDate = (isoString?: string | null) => {
    if (!isoString) return 'Não definida';
    const parts = isoString.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return isoString;
  };

  const getLoanDueStatus = (loan: BookLoan) => {
    if (loan.devolvido) {
      return {
        label: 'Devolvido',
        badgeColor: '#10b981',
        bgColor: '#10b98115',
        borderColor: '#10b98140',
        textColor: '#065f46',
      };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [year, month, day] = loan.dataDevolucao.split('-').map(Number);
    const dueDate = new Date(year, month - 1, day);
    const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      const daysOverdue = Math.abs(diffDays);
      return {
        label: `Atrasado (${daysOverdue} ${daysOverdue === 1 ? 'dia' : 'dias'})`,
        badgeColor: '#ef4444',
        bgColor: '#ef444415',
        borderColor: '#ef444440',
        textColor: '#991b1b',
        isOverdue: true,
      };
    }

    if (diffDays <= 3) {
      return {
        label: diffDays === 0 ? 'Devolução Hoje' : `Devolução em ${diffDays} ${diffDays === 1 ? 'dia' : 'dias'}`,
        badgeColor: '#f59e0b',
        bgColor: '#f59e0b15',
        borderColor: '#f59e0b40',
        textColor: '#92400e',
        isDueSoon: true,
      };
    }

    return {
      label: 'No Prazo',
      badgeColor: '#10b981',
      bgColor: '#10b98115',
      borderColor: '#10b98140',
      textColor: '#065f46',
      isOnTime: true,
    };
  };

  return (
    <div className="flex flex-col w-full flex-1 pb-20">
      {/* Top Bar */}
      <WoodTopAppBar
        palette={palette}
        title="Livros Emprestados"
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setBookPickerQuery('');
                setIsBookPickerOpen(true);
              }}
              className="px-3 py-1.5 rounded-xl font-serif font-bold text-xs shadow-md flex items-center gap-1.5 cursor-pointer hover:brightness-105 active:scale-95 transition-all"
              style={{
                backgroundColor: palette.goldPrimary,
                color: palette.textOnGold,
              }}
            >
              <Handshake size={14} />
              <span>+ Emprestar</span>
            </button>
            <span
              className="px-2.5 py-1 rounded-full text-xs font-mono font-bold flex items-center gap-1.5 shadow-inner"
              style={{
                backgroundColor: `${palette.goldPrimary}25`,
                color: palette.goldPrimary,
                border: `1px solid ${palette.goldPrimary}50`,
              }}
            >
              <span>{activeBorrowedBooks.length}</span>
            </span>
          </div>
        }
      />

      {/* Conteúdo Central */}
      <div className="flex-1 w-full max-w-2xl mx-auto px-4 py-5 flex flex-col gap-4">
        {/* Painel de Métricas de Empréstimos */}
        <PaperCard palette={palette} elevated className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Handshake size={20} color={palette.woodBorder} />
              <h3 className="font-serif font-bold text-lg" style={{ color: palette.textOnPaper }}>
                Controle de Empréstimos
              </h3>
            </div>
            <span
              className="text-[11px] font-mono px-2 py-0.5 rounded font-bold uppercase tracking-wider"
              style={{
                backgroundColor: `${palette.goldPrimary}20`,
                color: palette.goldPrimary,
              }}
            >
              Biblioteca Pessoal
            </span>
          </div>

          <p className="text-xs leading-relaxed" style={{ color: palette.textSecondaryOnPaper }}>
            Acompanhe para quem você emprestou seus livros físicos ou digitais, datas de entrega e histórico de devoluções.
          </p>

          <div className="grid grid-cols-3 gap-2 pt-1">
            <div
              className="p-2.5 rounded-xl border flex flex-col items-center justify-center text-center"
              style={{
                backgroundColor: '#10b98110',
                borderColor: '#10b98135',
              }}
            >
              <span className="text-lg font-bold font-mono text-emerald-800">
                {stats.noPrazo}
              </span>
              <span className="text-[10px] font-serif font-semibold text-emerald-950">
                No Prazo
              </span>
            </div>

            <div
              className="p-2.5 rounded-xl border flex flex-col items-center justify-center text-center"
              style={{
                backgroundColor: '#f59e0b10',
                borderColor: '#f59e0b35',
              }}
            >
              <span className="text-lg font-bold font-mono text-amber-800">
                {stats.proximos}
              </span>
              <span className="text-[10px] font-serif font-semibold text-amber-950">
                Próximos
              </span>
            </div>

            <div
              className="p-2.5 rounded-xl border flex flex-col items-center justify-center text-center"
              style={{
                backgroundColor: '#ef444410',
                borderColor: '#ef444435',
              }}
            >
              <span className="text-lg font-bold font-mono text-red-800">
                {stats.atrasados}
              </span>
              <span className="text-[10px] font-serif font-semibold text-red-950">
                Atrasados
              </span>
            </div>
          </div>
        </PaperCard>

        {/* Barra de Filtro e Busca */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          {/* Alternador de Sub-Aba: Emprestados Agora | Histórico */}
          <div
            className="flex items-center p-0.5 rounded-xl border"
            style={{
              backgroundColor: palette.woodDark,
              borderColor: `${palette.woodBorder}60`,
            }}
          >
            <button
              type="button"
              onClick={() => setActiveTab('ativos')}
              className="flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg font-serif font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
              style={{
                backgroundColor: activeTab === 'ativos' ? palette.goldPrimary : 'transparent',
                color: activeTab === 'ativos' ? palette.textOnGold : palette.textOnWood,
              }}
            >
              <Handshake size={14} />
              <span>Emprestados Agora ({activeBorrowedBooks.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('historico')}
              className="flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg font-serif font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
              style={{
                backgroundColor: activeTab === 'historico' ? palette.goldPrimary : 'transparent',
                color: activeTab === 'historico' ? palette.textOnGold : palette.textOnWood,
              }}
            >
              <History size={14} />
              <span>Histórico ({historyBorrowedBooks.length})</span>
            </button>
          </div>

          {/* Campo de Busca Rápida */}
          <div className="relative flex-1 max-w-xs">
            <Search
              size={15}
              className="absolute left-3 top-2.5 opacity-60"
              style={{ color: palette.textOnPaper }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por livro ou pessoa..."
              className="w-full pl-8 pr-7 py-1.5 rounded-xl border text-xs font-serif focus:outline-none focus:ring-1"
              style={{
                backgroundColor: palette.paperSurface,
                borderColor: `${palette.woodBorder}60`,
                color: palette.textOnPaper,
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 p-0.5 rounded-full hover:bg-black/10 cursor-pointer"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Lista de Empréstimos */}
        {displayedBooks.length === 0 ? (
          <PaperCard palette={palette} elevated className="text-center py-10 px-6 flex flex-col items-center gap-3">
            <span
              className="p-4 rounded-full flex items-center justify-center text-3xl shadow-inner"
              style={{ backgroundColor: `${palette.goldPrimary}15`, color: palette.woodBorder }}
            >
              {activeTab === 'ativos' ? '🤝' : '📚'}
            </span>
            <h4 className="font-serif font-bold text-lg" style={{ color: palette.textOnPaper }}>
              {activeTab === 'ativos'
                ? searchQuery
                  ? 'Nenhum empréstimo encontrado para esta busca'
                  : 'Nenhum livro emprestado no momento'
                : searchQuery
                ? 'Nenhum registro encontrado no histórico'
                : 'Nenhum histórico de devolução registrado'}
            </h4>
            <p className="text-xs max-w-sm leading-relaxed" style={{ color: palette.textSecondaryOnPaper }}>
              {activeTab === 'ativos'
                ? 'Para emprestar um livro, vá até a sua Estante, clique sobre qualquer livro e selecione "Emprestar Livro" para registrar o nome da pessoa e prazo de devolução.'
                : 'Quando você marcar um livro emprestado como devolvido, ele aparecerá arquivado nesta lista com a data em que voltou para sua estante.'}
            </p>
            {activeTab === 'ativos' && !searchQuery && (
              <div className="mt-2 flex flex-col sm:flex-row items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setBookPickerQuery('');
                    setIsBookPickerOpen(true);
                  }}
                  className="py-2.5 px-4 rounded-xl font-serif font-bold text-xs shadow-md flex items-center gap-2 cursor-pointer hover:brightness-105 active:scale-95 transition-all"
                  style={{ backgroundColor: palette.goldPrimary, color: palette.textOnGold }}
                >
                  <Handshake size={15} />
                  <span>Emprestar um Livro</span>
                </button>

                <button
                  type="button"
                  onClick={onGoToShelf}
                  className="py-2.5 px-4 rounded-xl font-serif font-semibold text-xs border flex items-center gap-2 cursor-pointer hover:bg-black/5 active:scale-95 transition-all"
                  style={{ borderColor: palette.woodBorder, color: palette.textOnPaper }}
                >
                  <BookOpen size={15} />
                  <span>Ir para Minha Estante</span>
                </button>
              </div>
            )}
          </PaperCard>
        ) : (
          <div className="flex flex-col gap-3">
            {displayedBooks.map((book) => {
              const loan = book.emprestimo!;
              const dueStatus = getLoanDueStatus(loan);

              return (
                <PaperCard
                  key={book.id}
                  palette={palette}
                  elevated
                  className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5 p-3.5 transition-all hover:shadow-lg"
                >
                  {/* Capa e Informações da Obra */}
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => onOpenBookDetail(book)}
                      className="w-14 h-20 rounded-md overflow-hidden shrink-0 shadow-md border hover:opacity-90 transition-opacity cursor-pointer flex items-center justify-center"
                      style={{
                        backgroundColor: palette.woodBorder,
                        borderColor: `${palette.goldPrimary}60`,
                      }}
                      title="Ver detalhes da obra"
                    >
                      {book.capaUrl ? (
                        <img
                          src={book.capaLocalPath || book.capaUrl}
                          alt={book.titulo}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <BookOpen size={24} className="text-amber-200" />
                      )}
                    </button>

                    <div className="flex flex-col gap-1 min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() => onOpenBookDetail(book)}
                          className="font-serif font-bold text-sm sm:text-base leading-snug hover:underline text-left cursor-pointer line-clamp-1"
                          style={{ color: palette.textOnPaper }}
                        >
                          {book.titulo}
                        </button>
                        <span
                          className="text-[10px] font-mono px-1.5 py-0.5 rounded font-bold"
                          style={{
                            backgroundColor:
                              book.formato === 'ebook' ? '#7c3aed20' : `${palette.goldPrimary}20`,
                            color: book.formato === 'ebook' ? '#7c3aed' : palette.woodBorder,
                          }}
                        >
                          {book.formato === 'ebook' ? 'E-book' : 'Físico'}
                        </span>
                      </div>

                      <p
                        className="text-xs font-serif italic line-clamp-1 opacity-80"
                        style={{ color: palette.textSecondaryOnPaper }}
                      >
                        {book.autores.join(', ') || 'Autor desconhecido'}
                      </p>

                      {/* Dados da pessoa e contato */}
                      <div className="mt-1 flex flex-col gap-0.5 text-xs">
                        <div className="flex items-center gap-1.5 font-bold" style={{ color: palette.textOnPaper }}>
                          <User size={13} className="opacity-70 text-amber-900" />
                          <span>Emprestado para: <strong className="underline decoration-amber-500/50">{loan.nomePessoa}</strong></span>
                        </div>

                        {loan.emailPessoa && (
                          <div className="flex items-center gap-1.5 text-[11px] opacity-80">
                            <Mail size={12} className="opacity-70" />
                            <a
                              href={`mailto:${loan.emailPessoa}?subject=Livro Emprestado: ${encodeURIComponent(book.titulo)}`}
                              className="hover:underline text-blue-700 dark:text-blue-400"
                              title="Enviar e-mail para esta pessoa"
                            >
                              {loan.emailPessoa}
                            </a>
                          </div>
                        )}
                      </div>

                      {/* Datas e Prazo */}
                      <div className="mt-1 flex items-center gap-2 flex-wrap text-[11px]">
                        <span className="flex items-center gap-1 opacity-75">
                          <Calendar size={12} />
                          <span>Desde: {formatDisplayDate(loan.dataEmprestimo)}</span>
                        </span>

                        <span className="flex items-center gap-1 font-semibold">
                          <Clock size={12} />
                          <span>Devolução: {formatDisplayDate(loan.dataDevolucao)}</span>
                        </span>

                        {/* Selo de Prazo */}
                        <span
                          className="px-2 py-0.5 rounded-full font-bold text-[10px] border flex items-center gap-1"
                          style={{
                            backgroundColor: dueStatus.bgColor,
                            borderColor: dueStatus.borderColor,
                            color: dueStatus.textColor,
                          }}
                        >
                          {dueStatus.isOverdue && <AlertTriangle size={11} />}
                          {dueStatus.label}
                        </span>
                      </div>

                      {loan.observacoes && (
                        <p className="text-[11px] italic opacity-75 mt-0.5 border-l-2 pl-2 border-amber-600/40">
                          &ldquo;{loan.observacoes}&rdquo;
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Ações do Empréstimo */}
                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-black/10 shrink-0">
                    {!loan.devolvido ? (
                      <>
                        <button
                          type="button"
                          onClick={() => onReturnBook(book)}
                          className="py-2 px-3 rounded-xl font-serif font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                          title="Confirmar que a pessoa devolveu o livro"
                        >
                          <CheckCircle2 size={14} />
                          <span>Marcar Devolvido</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => onOpenLoanModal(book)}
                          className="p-2 rounded-xl border hover:bg-black/5 cursor-pointer active:scale-95 transition-all"
                          style={{ borderColor: palette.woodBorder, color: palette.textOnPaper }}
                          title="Editar datas ou dados do empréstimo"
                        >
                          <Edit size={14} />
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onOpenLoanModal(book)}
                        className="py-1.5 px-3 rounded-xl font-serif font-bold text-xs border hover:bg-black/5 flex items-center gap-1.5 cursor-pointer"
                        style={{ borderColor: palette.woodBorder, color: palette.textOnPaper }}
                      >
                        <Handshake size={13} />
                        <span>Emprestar Novamente</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onOpenBookDetail(book)}
                      className="p-2 rounded-xl border hover:bg-black/5 cursor-pointer active:scale-95 transition-all"
                      style={{ borderColor: palette.woodBorder, color: palette.textOnPaper }}
                      title="Ver detalhes da obra"
                    >
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </PaperCard>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal de Seleção de Livro para Emprestar */}
      {isBookPickerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs animate-in fade-in"
          onClick={() => setIsBookPickerOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl p-5 sm:p-6 shadow-2xl border max-h-[85vh] flex flex-col animate-in zoom-in-95 duration-150"
            style={{
              backgroundColor: palette.paperSurface,
              borderColor: palette.woodBorder,
              color: palette.textOnPaper,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="flex items-center justify-between pb-3.5 border-b"
              style={{ borderColor: `${palette.woodBorder}35` }}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className="p-2 rounded-xl flex items-center justify-center shadow-xs"
                  style={{
                    backgroundColor: `${palette.goldPrimary}25`,
                    color: palette.woodBorder,
                  }}
                >
                  <Handshake size={20} />
                </span>
                <div>
                  <h3
                    className="font-serif font-bold text-xl leading-tight"
                    style={{ color: palette.textOnPaper }}
                  >
                    Selecionar Livro
                  </h3>
                  <p
                    className="text-xs font-serif opacity-75"
                    style={{ color: palette.textSecondaryOnPaper }}
                  >
                    Escolha um livro da sua estante para emprestar
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBookPickerOpen(false)}
                className="p-1.5 rounded-full hover:bg-black/10 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="relative my-3">
              <Search
                size={15}
                className="absolute left-3 top-2.5 opacity-60"
                style={{ color: palette.textOnPaper }}
              />
              <input
                type="text"
                autoFocus
                value={bookPickerQuery}
                onChange={(e) => setBookPickerQuery(e.target.value)}
                placeholder="Buscar livro por título ou autor..."
                className="w-full pl-8 pr-3 py-2 rounded-xl border text-xs font-serif focus:outline-none focus:ring-1"
                style={{
                  backgroundColor: palette.paperSurfaceElevated,
                  borderColor: palette.woodBorder,
                  color: palette.textOnPaper,
                }}
              />
            </div>

            <div className="flex-1 overflow-y-auto flex flex-col gap-2 max-h-[50vh] pr-1">
              {availableBooksToLoan.length === 0 ? (
                <div
                  className="text-center py-8 text-xs italic"
                  style={{ color: palette.textSecondaryOnPaper }}
                >
                  {books.length === 0
                    ? 'Sua biblioteca ainda não possui livros cadastrados.'
                    : 'Nenhum livro disponível encontrado para esta busca.'}
                </div>
              ) : (
                availableBooksToLoan.map((book) => (
                  <button
                    key={book.id}
                    type="button"
                    onClick={() => {
                      setIsBookPickerOpen(false);
                      onOpenLoanModal(book);
                    }}
                    className="w-full p-2.5 rounded-xl border text-left flex items-center gap-3 cursor-pointer hover:brightness-95 active:scale-98 transition-all"
                    style={{
                      backgroundColor: palette.paperSurfaceElevated,
                      borderColor: `${palette.woodBorder}40`,
                    }}
                  >
                    <div
                      className="w-10 h-14 rounded overflow-hidden shrink-0 shadow-xs flex items-center justify-center border"
                      style={{
                        backgroundColor: palette.woodBorder,
                        borderColor: `${palette.goldPrimary}50`,
                      }}
                    >
                      {book.capaUrl ? (
                        <img
                          src={book.capaLocalPath || book.capaUrl}
                          alt={book.titulo}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <BookOpen size={16} className="text-amber-200" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4
                        className="font-serif font-bold text-xs leading-snug line-clamp-1"
                        style={{ color: palette.textOnPaper }}
                      >
                        {book.titulo}
                      </h4>
                      <p
                        className="text-[11px] font-serif italic line-clamp-1 opacity-75"
                        style={{ color: palette.textSecondaryOnPaper }}
                      >
                        {book.autores.join(', ') || 'Autor desconhecido'}
                      </p>
                      <span
                        className="inline-block text-[9px] font-mono px-1.5 py-0.2 rounded mt-1 font-bold"
                        style={{
                          backgroundColor:
                            book.formato === 'ebook' ? '#7c3aed20' : `${palette.goldPrimary}20`,
                          color: book.formato === 'ebook' ? '#7c3aed' : palette.woodBorder,
                        }}
                      >
                        {book.formato === 'ebook' ? 'E-book' : 'Físico'}
                      </span>
                    </div>
                    <span
                      className="text-xs font-serif font-bold px-2.5 py-1 rounded-lg shrink-0 shadow-xs"
                      style={{
                        backgroundColor: palette.goldPrimary,
                        color: palette.textOnGold,
                      }}
                    >
                      Emprestar
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
