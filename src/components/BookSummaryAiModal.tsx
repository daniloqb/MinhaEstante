import React, { useState, useEffect } from 'react';
import { Sparkles, X, Copy, Check, BookmarkPlus, RefreshCw, AlertCircle, BookOpen, Tablet } from 'lucide-react';
import { Book } from '../types/book';
import { WoodPalette } from '../theme/woodTheme';
import { BookCoverView } from './BookCoverView';
import { generateBookSummary } from '../services/aiService';

interface BookSummaryAiModalProps {
  palette: WoodPalette;
  book: Book | null;
  isOpen: boolean;
  onDismiss?: () => void;
  onClose?: () => void;
  onSaveToNotes?: (notes: string) => void;
}

export const BookSummaryAiModal: React.FC<BookSummaryAiModalProps> = ({
  palette,
  book,
  isOpen,
  onDismiss,
  onClose,
  onSaveToNotes,
}) => {
  const handleClose = onDismiss || onClose || (() => {});
  const [summary, setSummary] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [savedToNotes, setSavedToNotes] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen || !book) {
      setSummary(null);
      setErrorMessage(null);
      return;
    }

    // Se o livro já possui um resumo gravado em suas anotações, carrega instantaneamente
    if (book.observacoes && book.observacoes.includes('=== RESUMO DA IA')) {
      const parts = book.observacoes.split(/=== RESUMO DA IA[^\n]*===\n\n/);
      if (parts.length > 1) {
        setSummary(parts[1].trim());
        setSavedToNotes(true);
        return;
      }
    }
  }, [isOpen, book]);

  if (!isOpen || !book) return null;

  const handleFetchSummary = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    setSavedToNotes(false);

    try {
      const resultText = await generateBookSummary({
        titulo: book.titulo,
        autores: book.autores,
        sinopse: book.descricao || book.observacoes,
        anoPublicacao: book.anoPublicacao,
        formato: book.formato || 'fisico',
      });

      if (!resultText) {
        throw new Error('Nenhum resumo retornado pela IA.');
      }

      setSummary(resultText);
    } catch (err: any) {
      console.error('Falha ao gerar resumo da IA:', err);
      setErrorMessage(
        err.message ||
          'Não foi possível conectar com a IA no momento. Verifique sua conexão com a internet e tente novamente.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!summary) return;
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
    }
  };

  const handleSaveNotes = () => {
    if (!summary || !onSaveToNotes) return;
    const header = `=== RESUMO DA IA (Gerado em ${new Date().toLocaleDateString('pt-BR')}) ===\n\n`;
    const newNotes = book.observacoes ? `${book.observacoes}\n\n${header}${summary}` : `${header}${summary}`;
    onSaveToNotes(newNotes);
    setSavedToNotes(true);
    setTimeout(() => setSavedToNotes(false), 3000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={handleClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl shadow-2xl border overflow-hidden"
        style={{
          backgroundColor: palette.paperSurface,
          borderColor: palette.woodBorder,
          color: palette.textOnPaper,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Topo / Cabeçalho */}
        <div
          className="p-4 sm:p-5 border-b flex items-start justify-between gap-3"
          style={{
            backgroundColor: palette.paperSurface,
            borderColor: `${palette.woodBorder}40`,
          }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="p-2 sm:p-2.5 rounded-xl shadow-md flex items-center justify-center shrink-0 border"
              style={{
                backgroundColor: `${palette.goldPrimary}20`,
                borderColor: `${palette.goldPrimary}50`,
                color: palette.goldPrimary,
              }}
            >
              <Sparkles size={24} className="animate-pulse" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-serif font-bold text-lg sm:text-xl truncate" style={{ color: palette.textOnPaper }}>
                  Resumo Literário com IA
                </h2>
                {book.formato === 'ebook' ? (
                  <span
                    className="inline-flex items-center gap-1 text-[11px] font-sans font-bold px-2 py-0.5 rounded-full border shrink-0"
                    style={{
                      backgroundColor: `${palette.goldPrimary}20`,
                      borderColor: palette.goldPrimary,
                      color: palette.goldPrimary,
                    }}
                  >
                    <Tablet size={11} /> E-book
                  </span>
                ) : (
                  <span
                    className="inline-flex items-center gap-1 text-[11px] font-sans font-bold px-2 py-0.5 rounded-full border shrink-0"
                    style={{
                      backgroundColor: `${palette.woodBorder}20`,
                      borderColor: palette.woodBorder,
                      color: palette.textOnPaper,
                    }}
                  >
                    <BookOpen size={11} /> Livro Físico
                  </span>
                )}
              </div>
              <p className="font-serif text-sm truncate opacity-85" style={{ color: palette.textSecondaryOnWood }}>
                {book.titulo} {book.autores[0] ? `• ${book.autores[0]}` : ''}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-full hover:bg-black/10 text-stone-500 hover:text-stone-800 transition-colors cursor-pointer shrink-0"
          >
            <X size={20} />
          </button>
        </div>

        {/* Corpo do Modal */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-sm leading-relaxed">
          {/* Card compacto com capa e metadados */}
          <div
            className="flex items-center gap-3.5 p-3 rounded-xl border shadow-sm"
            style={{
              backgroundColor: palette.paperSurfaceElevated,
              borderColor: `${palette.woodBorder}30`,
            }}
          >
            <div className="shrink-0 shadow-md rounded overflow-hidden">
              <BookCoverView
                palette={palette}
                title={book.titulo}
                author={book.autores[0]}
                coverUrl={book.capaUrl}
                width={52}
                height={76}
              />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-serif font-bold text-base line-clamp-1" style={{ color: palette.textOnPaper }}>
                {book.titulo}
              </h3>
              <p className="text-xs opacity-75 font-serif line-clamp-1">
                {book.autores.join(', ') || 'Autor desconhecido'}
                {book.anoPublicacao ? ` (${book.anoPublicacao})` : ''}
              </p>
              <p className="text-[11px] text-stone-500 mt-1 italic line-clamp-2">
                {book.descricao ? `"${book.descricao}"` : 'Obra da sua estante pessoal pronta para ser resumida.'}
              </p>
            </div>
          </div>

          {/* Estado Inicial: Nenhum resumo gerado ainda */}
          {!summary && !isLoading && !errorMessage && (
            <div className="py-8 flex flex-col items-center justify-center text-center space-y-3.5">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center border shadow-inner"
                style={{
                  backgroundColor: `${palette.goldPrimary}15`,
                  borderColor: `${palette.goldPrimary}40`,
                  color: palette.goldPrimary,
                }}
              >
                <Sparkles size={32} />
              </div>

              <div className="max-w-md space-y-1">
                <h4 className="font-serif font-bold text-base" style={{ color: palette.textOnPaper }}>
                  Relembre a história deste livro
                </h4>
                <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
                  A Inteligência Artificial analisará a obra para te apresentar a premissa central, os personagens marcantes,
                  o desenvolvimento dos momentos cruciais e por que vale a pena recordar esta leitura.
                </p>
              </div>

              <button
                type="button"
                onClick={handleFetchSummary}
                className="mt-2 py-3 px-6 rounded-xl font-serif font-bold text-sm shadow-lg flex items-center gap-2 cursor-pointer hover:brightness-105 active:scale-95 transition-all"
                style={{
                  backgroundColor: palette.goldPrimary,
                  color: palette.textOnGold,
                }}
              >
                <Sparkles size={18} />
                Gerar Resumo com IA
              </button>
            </div>
          )}

          {/* Estado de Carregamento */}
          {isLoading && (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
              <div className="relative">
                <div
                  className="w-14 h-14 rounded-full border-4 border-t-transparent animate-spin"
                  style={{ borderColor: `${palette.goldPrimary}40`, borderTopColor: palette.goldPrimary }}
                />
                <Sparkles
                  size={20}
                  className="absolute inset-0 m-auto animate-pulse"
                  style={{ color: palette.goldPrimary }}
                />
              </div>

              <div className="space-y-1">
                <p className="font-serif font-bold text-base" style={{ color: palette.textOnPaper }}>
                  Consultando o acervo literário...
                </p>
                <p className="text-xs text-stone-500">
                  Estruturando a visão geral, personagens e momentos marcantes de &ldquo;{book.titulo}&rdquo;.
                </p>
              </div>
            </div>
          )}

          {/* Erro */}
          {errorMessage && !isLoading && (
            <div className="p-4 rounded-xl border border-red-500/30 bg-red-50 text-red-800 space-y-2 text-xs sm:text-sm">
              <div className="flex items-center gap-2 font-bold">
                <AlertCircle size={18} className="text-red-600 shrink-0" />
                <span>Não foi possível gerar o resumo</span>
              </div>
              <p className="leading-relaxed">{errorMessage}</p>
              <button
                type="button"
                onClick={handleFetchSummary}
                className="mt-2 py-2 px-4 rounded-lg bg-red-700 text-white font-serif font-bold text-xs flex items-center gap-1.5 hover:bg-red-800 cursor-pointer"
              >
                <RefreshCw size={14} />
                Tentar novamente
              </button>
            </div>
          )}

          {/* Resumo Gerado com Sucesso */}
          {summary && !isLoading && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div
                className="p-4 sm:p-5 rounded-xl border shadow-inner whitespace-pre-wrap font-serif text-xs sm:text-sm leading-relaxed"
                style={{
                  backgroundColor: palette.paperSurface,
                  borderColor: `${palette.woodBorder}40`,
                  color: palette.textOnPaper,
                }}
              >
                {summary}
              </div>
            </div>
          )}
        </div>

        {/* Rodapé de Ações */}
        {summary && !isLoading && (
          <div
            className="p-3.5 sm:p-4 border-t flex flex-wrap items-center justify-between gap-2"
            style={{
              backgroundColor: palette.paperSurfaceElevated,
              borderColor: `${palette.woodBorder}40`,
            }}
          >
            <button
              type="button"
              onClick={handleFetchSummary}
              className="py-2 px-3 rounded-lg border font-serif text-xs font-semibold flex items-center gap-1.5 hover:bg-black/5 active:scale-95 transition-all cursor-pointer"
              style={{ borderColor: `${palette.woodBorder}60`, color: palette.textOnPaper }}
              title="Gerar uma nova versão do resumo"
            >
              <RefreshCw size={14} />
              Reescrever
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="py-2 px-3.5 rounded-lg border font-serif text-xs font-bold flex items-center gap-1.5 hover:bg-black/5 active:scale-95 transition-all cursor-pointer"
                style={{ borderColor: palette.woodBorder, color: palette.textOnPaper }}
              >
                {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                {copied ? 'Copiado!' : 'Copiar Texto'}
              </button>

              {onSaveToNotes && (
                <button
                  type="button"
                  onClick={handleSaveNotes}
                  className="py-2 px-3.5 rounded-lg font-serif text-xs font-bold shadow-md flex items-center gap-1.5 hover:brightness-105 active:scale-95 transition-all cursor-pointer"
                  style={{
                    backgroundColor: palette.goldPrimary,
                    color: palette.textOnGold,
                  }}
                  title="Salva este resumo nas observações/anotações do livro na sua estante"
                >
                  {savedToNotes ? <Check size={14} /> : <BookmarkPlus size={14} />}
                  {savedToNotes ? 'Salvo nas Anotações!' : 'Salvar nas Anotações'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
