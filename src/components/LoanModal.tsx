import React, { useState, useEffect } from 'react';
import { Book, BookLoan } from '../types/book';
import { WoodPalette } from '../theme/woodTheme';
import {
  Handshake,
  Calendar,
  Mail,
  User,
  X,
  CheckCircle2,
  AlertCircle,
  Clock,
  BookOpen,
} from 'lucide-react';

interface LoanModalProps {
  palette: WoodPalette;
  isOpen: boolean;
  book: Book | null;
  onClose: () => void;
  onSaveLoan: (book: Book, loan: BookLoan) => void;
  onReturnBook?: (book: Book) => void;
}

export const LoanModal: React.FC<LoanModalProps> = ({
  palette,
  isOpen,
  book,
  onClose,
  onSaveLoan,
  onReturnBook,
}) => {
  const getTodayString = () => new Date().toISOString().slice(0, 10);
  const getDefaultReturnDate = (daysAhead: number = 30) => {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    return d.toISOString().slice(0, 10);
  };

  const [nomePessoa, setNomePessoa] = useState('');
  const [emailPessoa, setEmailPessoa] = useState('');
  const [dataEmprestimo, setDataEmprestimo] = useState(getTodayString());
  const [dataDevolucao, setDataDevolucao] = useState(getDefaultReturnDate(30));
  const [observacoes, setObservacoes] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (book) {
      if (book.emprestimo && !book.emprestimo.devolvido) {
        setNomePessoa(book.emprestimo.nomePessoa || '');
        setEmailPessoa(book.emprestimo.emailPessoa || '');
        setDataEmprestimo(book.emprestimo.dataEmprestimo || getTodayString());
        setDataDevolucao(book.emprestimo.dataDevolucao || getDefaultReturnDate(30));
        setObservacoes(book.emprestimo.observacoes || '');
      } else {
        setNomePessoa('');
        setEmailPessoa('');
        setDataEmprestimo(getTodayString());
        setDataDevolucao(getDefaultReturnDate(30));
        setObservacoes('');
      }
      setError(null);
    }
  }, [book, isOpen]);

  if (!isOpen || !book) return null;

  const isAlreadyBorrowed = Boolean(book.emprestimo && !book.emprestimo.devolvido);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomePessoa.trim()) {
      setError('Por favor, informe o nome da pessoa que pegou o livro emprestado.');
      return;
    }
    if (!dataEmprestimo) {
      setError('Por favor, selecione a data do empréstimo.');
      return;
    }
    if (!dataDevolucao) {
      setError('Por favor, selecione a data prevista de devolução.');
      return;
    }

    const loan: BookLoan = {
      nomePessoa: nomePessoa.trim(),
      emailPessoa: emailPessoa.trim() ? emailPessoa.trim() : null,
      dataEmprestimo,
      dataDevolucao,
      devolvido: false,
      observacoes: observacoes.trim() ? observacoes.trim() : null,
    };

    onSaveLoan(book, loan);
    onClose();
  };

  const setDaysAhead = (days: number) => {
    const baseDate = dataEmprestimo ? new Date(dataEmprestimo) : new Date();
    baseDate.setDate(baseDate.getDate() + days);
    setDataDevolucao(baseDate.toISOString().slice(0, 10));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl p-5 sm:p-6 shadow-2xl border max-h-[92vh] overflow-y-auto animate-in zoom-in-95 duration-150"
        style={{
          backgroundColor: palette.paperSurface,
          borderColor: palette.woodBorder,
          color: palette.textOnPaper,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
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
              <Handshake size={22} />
            </span>
            <div>
              <h3
                className="font-serif font-bold text-xl leading-tight"
                style={{ color: palette.textOnPaper }}
              >
                {isAlreadyBorrowed ? 'Gerenciar Empréstimo' : 'Emprestar Livro'}
              </h3>
              <p
                className="text-xs font-serif opacity-75"
                style={{ color: palette.textSecondaryOnPaper }}
              >
                {isAlreadyBorrowed
                  ? 'Atualize os prazos ou registre a devolução'
                  : 'Registre para quem e até quando você emprestou'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-black/10 transition-colors cursor-pointer"
            aria-label="Fechar"
          >
            <X size={20} />
          </button>
        </div>

        {/* Informações do Livro */}
        <div
          className="mt-3.5 p-3 rounded-xl border flex items-center gap-3"
          style={{
            backgroundColor: palette.paperSurfaceElevated,
            borderColor: `${palette.woodBorder}30`,
          }}
        >
          <div
            className="w-12 h-16 rounded-md overflow-hidden shrink-0 shadow-sm flex items-center justify-center border"
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
              <BookOpen size={20} className="text-amber-200" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h4
              className="font-serif font-bold text-sm leading-snug line-clamp-1"
              style={{ color: palette.textOnPaper }}
            >
              {book.titulo}
            </h4>
            <p
              className="text-xs font-serif opacity-80 line-clamp-1 mt-0.5"
              style={{ color: palette.textSecondaryOnPaper }}
            >
              {book.autores.join(', ') || 'Autor desconhecido'}
            </p>
            <span
              className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded mt-1 font-bold"
              style={{
                backgroundColor: book.formato === 'ebook' ? '#7c3aed20' : `${palette.goldPrimary}20`,
                color: book.formato === 'ebook' ? '#7c3aed' : palette.woodBorder,
              }}
            >
              {book.formato === 'ebook' ? 'E-book Digital' : 'Exemplar Físico'}
            </span>
          </div>
        </div>

        {/* Mensagem de Erro */}
        {error && (
          <div className="mt-3 p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-2 text-xs text-red-900 animate-in fade-in">
            <AlertCircle size={16} className="shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Formulário de Empréstimo */}
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3.5">
          {/* Nome da Pessoa (Obrigatório) */}
          <div>
            <label
              className="block text-xs font-serif font-bold mb-1 flex items-center gap-1.5"
              style={{ color: palette.textOnPaper }}
            >
              <User size={14} className="opacity-80" />
              <span>Nome da Pessoa *</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              value={nomePessoa}
              onChange={(e) => {
                setNomePessoa(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Ex: João Silva, Maria, Primo Carlos..."
              className="w-full px-3 py-2 rounded-xl border text-sm font-serif focus:outline-none focus:ring-2 transition-all"
              style={{
                backgroundColor: palette.paperSurfaceElevated,
                borderColor: palette.woodBorder,
                color: palette.textOnPaper,
              }}
            />
          </div>

          {/* E-mail da Pessoa (Opcional) */}
          <div>
            <label
              className="block text-xs font-serif font-bold mb-1 flex items-center justify-between"
              style={{ color: palette.textOnPaper }}
            >
              <span className="flex items-center gap-1.5">
                <Mail size={14} className="opacity-80" />
                <span>E-mail da Pessoa</span>
              </span>
              <span className="text-[10px] font-sans font-normal opacity-60">
                Opcional
              </span>
            </label>
            <input
              type="email"
              value={emailPessoa}
              onChange={(e) => setEmailPessoa(e.target.value)}
              placeholder="exemplo@email.com (para contato ou lembrete)"
              className="w-full px-3 py-2 rounded-xl border text-sm font-serif focus:outline-none focus:ring-2 transition-all"
              style={{
                backgroundColor: palette.paperSurfaceElevated,
                borderColor: palette.woodBorder,
                color: palette.textOnPaper,
              }}
            />
          </div>

          {/* Datas: Empréstimo e Devolução */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                className="block text-xs font-serif font-bold mb-1 flex items-center gap-1.5"
                style={{ color: palette.textOnPaper }}
              >
                <Calendar size={14} className="opacity-80" />
                <span>Data do Empréstimo *</span>
              </label>
              <input
                type="date"
                required
                value={dataEmprestimo}
                onChange={(e) => setDataEmprestimo(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border text-xs sm:text-sm font-mono focus:outline-none focus:ring-2 transition-all"
                style={{
                  backgroundColor: palette.paperSurfaceElevated,
                  borderColor: palette.woodBorder,
                  color: palette.textOnPaper,
                }}
              />
            </div>

            <div>
              <label
                className="block text-xs font-serif font-bold mb-1 flex items-center gap-1.5"
                style={{ color: palette.textOnPaper }}
              >
                <Clock size={14} className="opacity-80" />
                <span>Data de Devolução *</span>
              </label>
              <input
                type="date"
                required
                value={dataDevolucao}
                onChange={(e) => setDataDevolucao(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border text-xs sm:text-sm font-mono focus:outline-none focus:ring-2 transition-all"
                style={{
                  backgroundColor: palette.paperSurfaceElevated,
                  borderColor: palette.woodBorder,
                  color: palette.textOnPaper,
                }}
              />
            </div>
          </div>

          {/* Atalhos rápidos de prazo */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-serif opacity-75 mr-1">Prazo sugerido:</span>
            <button
              type="button"
              onClick={() => setDaysAhead(15)}
              className="px-2.5 py-1 rounded-lg text-xs font-serif border hover:bg-black/5 cursor-pointer active:scale-95 transition-all"
              style={{ borderColor: `${palette.woodBorder}60`, color: palette.textOnPaper }}
            >
              +15 dias
            </button>
            <button
              type="button"
              onClick={() => setDaysAhead(30)}
              className="px-2.5 py-1 rounded-lg text-xs font-serif border hover:bg-black/5 cursor-pointer active:scale-95 transition-all"
              style={{ borderColor: `${palette.woodBorder}60`, color: palette.textOnPaper }}
            >
              +30 dias
            </button>
            <button
              type="button"
              onClick={() => setDaysAhead(60)}
              className="px-2.5 py-1 rounded-lg text-xs font-serif border hover:bg-black/5 cursor-pointer active:scale-95 transition-all"
              style={{ borderColor: `${palette.woodBorder}60`, color: palette.textOnPaper }}
            >
              +60 dias
            </button>
          </div>

          {/* Observações Opcionais */}
          <div>
            <label
              className="block text-xs font-serif font-bold mb-1"
              style={{ color: palette.textOnPaper }}
            >
              Observações (Opcional)
            </label>
            <textarea
              rows={2}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Ex: Emprestado durante o clube do livro, cuidar da capa..."
              className="w-full px-3 py-2 rounded-xl border text-xs font-serif focus:outline-none focus:ring-2 resize-none"
              style={{
                backgroundColor: palette.paperSurfaceElevated,
                borderColor: palette.woodBorder,
                color: palette.textOnPaper,
              }}
            />
          </div>

          {/* Botões de Ação */}
          <div className="pt-3 border-t flex flex-col sm:flex-row items-center justify-between gap-2.5" style={{ borderColor: `${palette.woodBorder}30` }}>
            {isAlreadyBorrowed && onReturnBook ? (
              <button
                type="button"
                onClick={() => {
                  onReturnBook(book);
                  onClose();
                }}
                className="w-full sm:w-auto px-3.5 py-2 rounded-xl font-serif font-bold text-xs border border-emerald-600 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all"
              >
                <CheckCircle2 size={15} />
                <span>Marcar como Devolvido</span>
              </button>
            ) : <div />}

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 sm:flex-none px-4 py-2 rounded-xl font-serif text-xs border cursor-pointer hover:bg-black/5"
                style={{
                  borderColor: palette.woodBorder,
                  color: palette.textOnPaper,
                }}
              >
                Cancelar
              </button>

              <button
                type="submit"
                className="flex-1 sm:flex-none px-5 py-2 rounded-xl font-serif font-bold text-xs shadow-md flex items-center justify-center gap-1.5 cursor-pointer hover:brightness-105 active:scale-95 transition-all"
                style={{
                  backgroundColor: palette.goldPrimary,
                  color: palette.textOnGold,
                }}
              >
                <Handshake size={15} />
                <span>Salvar Empréstimo</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
