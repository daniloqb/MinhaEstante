import React, { useState, useEffect } from 'react';
import { SearchResultBook, ShelfTab, Book } from '../types/book';
import { WoodPalette } from '../theme/woodTheme';
import { WoodTopAppBar } from '../components/WoodTopAppBar';
import { BookCoverView } from '../components/BookCoverView';
import { PaperCard } from '../components/PaperCard';
import { areBooksDuplicate } from '../services/storage';
import { useI18n } from '../i18n/I18nContext';
import { ProviderStatus } from '../features/book-discovery';
import { DiscoveryNavigationContext } from '../features/home-feed/types';
import {
  Search,
  X,
  Loader2,
  BookOpen,
  Library,
  Camera,
  ScanBarcode,
  Tablet,
  Plus,
  Activity,
  Globe2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Key,
} from 'lucide-react';
import { BarcodeScannerModal } from '../components/BarcodeScannerModal';

interface SearchScreenProps {
  palette: WoodPalette;
  searchQuery: string;
  onQueryChange: (query: string) => void;
  onSearch: (query: string) => void;
  onCancelSearch?: () => void;
  isLoading: boolean;
  results: SearchResultBook[];
  errorMessage: string | null;
  onSelectBookToAdd: (book: SearchResultBook, targetAction?: ShelfTab) => void;
  onSelectBookDetail: (book: Book) => void;
  onOpenManualRegister: () => void;
  userBooks?: Book[];
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  providerStatuses?: ProviderStatus[];
  onGoToSettings?: () => void;
  discoveryContext?: DiscoveryNavigationContext;
  onClearDiscoveryContext?: () => void;
}

export const SearchScreen: React.FC<SearchScreenProps> = ({
  palette,
  searchQuery,
  onQueryChange,
  onSearch,
  onCancelSearch,
  isLoading,
  results,
  errorMessage,
  onSelectBookToAdd,
  onSelectBookDetail,
  onOpenManualRegister,
  userBooks = [],
  onLoadMore,
  hasMore = false,
  isLoadingMore = false,
  providerStatuses = [],
  onGoToSettings,
  discoveryContext,
  onClearDiscoveryContext,
}) => {
  const { t } = useI18n();
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [showDiagnosticModal, setShowDiagnosticModal] = useState(false);

  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (isScannerOpen) {
        setIsScannerOpen(false);
        e.stopImmediatePropagation();
      } else if (showDiagnosticModal) {
        setShowDiagnosticModal(false);
        e.stopImmediatePropagation();
      }
    };
    window.addEventListener('popstate', handlePopState, true);
    return () => window.removeEventListener('popstate', handlePopState, true);
  }, [isScannerOpen, showDiagnosticModal]);

  const handleCardClick = (item: SearchResultBook) => {
    const existingInLibrary = (userBooks || []).find((b) => areBooksDuplicate(b, item));
    if (existingInLibrary) {
      onSelectBookDetail(existingInLibrary);
    } else {
      const previewBook: Book = {
        id: 0,
        origem: item.origem,
        idExterno: item.idExterno,
        titulo: item.titulo,
        subtitulo: item.subtitulo,
        autores: item.autores,
        editora: item.editora,
        anoPublicacao: item.anoPublicacao,
        paginas: item.paginas,
        isbn10: item.isbn10,
        isbn13: item.isbn13,
        generos: item.generos,
        descricao: item.descricao,
        capaUrl: item.capaUrl,
        formato: 'fisico',
        tenho_fisico: false,
        status_leitura: 'nenhum',
        anoLeitura: null,
        mesLeitura: null,
        nota: null,
        dataCadastro: Date.now(),
        dataAtualizacao: Date.now(),
      };
      onSelectBookDetail(previewBook);
    }
  };

  const handleToggleAction = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (isLoading) {
      if (onCancelSearch) {
        onCancelSearch();
      }
    } else {
      const trimmed = searchQuery.trim();
      if (trimmed) {
        onSearch(trimmed);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) {
      if (onCancelSearch) {
        onCancelSearch();
      }
      return;
    }
    const trimmed = searchQuery.trim();
    if (trimmed) {
      onSearch(trimmed);
    }
  };

  const handleBarcodeDetected = (barcode: string) => {
    onQueryChange(barcode);
    setTimeout(() => {
      onSearch(barcode.trim());
    }, 50);
  };

  const hasExecutedSearch = Boolean(results.length > 0 || errorMessage || isLoading);

  return (
    <div className="flex flex-col w-full flex-1">
      <WoodTopAppBar palette={palette} title={t.search.title} />

      {/* Modal Leitor de Código de Barras */}
      <BarcodeScannerModal
        palette={palette}
        isOpen={isScannerOpen}
        onDismiss={() => setIsScannerOpen(false)}
        onDetected={handleBarcodeDetected}
      />

      {/* Modal de Diagnóstico de Descoberta Bibliográfica */}
      {showDiagnosticModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          onClick={() => setShowDiagnosticModal(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl p-5 shadow-2xl border flex flex-col gap-3 animate-in fade-in zoom-in-95 duration-150 max-h-[85vh] overflow-y-auto"
            style={{
              backgroundColor: palette.paperSurface,
              borderColor: palette.woodBorder,
              color: palette.textOnPaper,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b" style={{ borderColor: `${palette.woodBorder}40` }}>
              <div className="flex items-center gap-2">
                <Globe2 size={18} className="text-amber-800" />
                <h3 className="font-serif font-bold text-base" style={{ color: palette.textOnPaper }}>
                  Diagnóstico das Fontes Bibliográficas
                </h3>
              </div>
              <button
                onClick={() => setShowDiagnosticModal(false)}
                className="p-1 rounded-full hover:bg-black/10 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs leading-relaxed opacity-80 font-sans">
              Visão técnica da consulta agregada mundial em tempo real:
            </p>

            <div className="flex flex-col gap-2">
              {providerStatuses.length === 0 ? (
                <p className="text-xs sm:text-sm italic py-4 text-center opacity-70 font-sans">
                  Nenhuma consulta ativa no momento.
                </p>
              ) : (
                providerStatuses.map((p) => {
                  const isOk = p.status === 'success';
                  const isErr = p.status === 'error';
                  const isUnconf = p.status === 'unconfigured';
                  const isSkip = p.status === 'skipped';
                  const isEmpty = p.status === 'empty';

                  return (
                    <div
                      key={p.providerId}
                      className="p-2.5 rounded-xl border flex items-center justify-between text-xs sm:text-sm"
                      style={{
                        backgroundColor: palette.paperSurfaceElevated,
                        borderColor: `${palette.woodBorder}40`,
                      }}
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="font-semibold font-sans flex items-center gap-1.5 text-xs sm:text-sm">
                          {p.name}
                          {p.isOptional && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-stone-200 text-stone-800 font-sans font-medium">
                              Opcional
                            </span>
                          )}
                        </span>
                        <span className="text-xs opacity-80 font-sans">
                          {isOk && `✓ ${p.resultsCount} livros encontrados`}
                          {isEmpty && 'Nenhum registro retornado'}
                          {isErr && (p.errorMessage || 'Falha de comunicação')}
                          {isUnconf && 'Não configurado (chave não fornecida)'}
                          {isSkip && 'Ignorado nesta etapa'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {p.durationMs !== undefined && (
                          <span className="text-[11px] font-sans tabular-nums opacity-70">
                            {p.durationMs}ms
                          </span>
                        )}
                        {isOk && <CheckCircle2 size={16} className="text-emerald-700" />}
                        {isErr && <AlertCircle size={16} className="text-rose-700" />}
                        {(isEmpty || isSkip) && <HelpCircle size={16} className="text-amber-700 opacity-70" />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 w-full max-w-2xl mx-auto px-4 py-4 flex flex-col">
        {/* Campo de Busca Mundial */}
        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-2.5">
          <div className="relative w-full">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onQueryChange(e.target.value)}
              onFocus={(e) => {
                if (e.currentTarget.value.length > 0) {
                  e.currentTarget.select();
                }
              }}
              placeholder="Pesquisar por título, autor ou ISBN no catálogo mundial..."
              className="w-full pl-10 pr-24 py-2.5 rounded-xl text-xs sm:text-sm border focus:outline-none focus:ring-2 shadow-sm font-sans"
              style={{
                backgroundColor: palette.paperSurface,
                borderColor: palette.woodBorder,
                color: palette.textOnPaper,
              }}
            />
            <Search
              size={18}
              className="absolute left-3.5 top-3"
              style={{ color: palette.woodBorder }}
            />

            <div className="absolute right-2 top-2 flex items-center gap-1">
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    if (isLoading && onCancelSearch) {
                      onCancelSearch();
                    }
                    onQueryChange('');
                  }}
                  className="p-1 rounded-full hover:bg-black/10 cursor-pointer"
                  title={isLoading ? 'Cancelar e limpar busca' : 'Limpar busca'}
                >
                  <X size={15} />
                </button>
              )}
              {providerStatuses.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowDiagnosticModal(true)}
                  className="p-1.5 rounded-lg border flex items-center justify-center cursor-pointer shadow-xs hover:bg-black/5 active:scale-95 transition-all"
                  style={{
                    borderColor: `${palette.woodBorder}60`,
                    color: palette.woodBorder,
                  }}
                  title="Ver diagnóstico das fontes bibliográficas"
                >
                  <Activity size={15} />
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsScannerOpen(true)}
                className="px-2 py-1.5 rounded-lg border flex items-center justify-center cursor-pointer shadow-sm hover:brightness-110 active:scale-95 transition-all font-sans font-medium"
                style={{
                  backgroundColor: palette.goldPrimary,
                  borderColor: palette.woodBorder,
                  color: palette.textOnGold,
                }}
                title="Escanear código de barras com a câmera"
                aria-label="Escanear código de barras com a câmera"
              >
                <ScanBarcode size={17} />
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs px-1 flex-wrap gap-2.5">
            {/* Ações Complementares: Escanear e Cadastro Manual */}
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <button
                type="button"
                onClick={() => setIsScannerOpen(true)}
                className="flex items-center justify-center gap-1.5 px-3 sm:px-3.5 py-2 rounded-lg font-sans font-semibold text-xs sm:text-sm border shadow-sm cursor-pointer hover:brightness-110 active:scale-95 transition-all whitespace-nowrap min-h-[38px] select-none"
                style={{
                  backgroundColor: palette.goldPrimary,
                  borderColor: palette.woodBorder,
                  color: palette.textOnGold,
                }}
                title="Escanear código de barras com a câmera"
              >
                <Camera size={15} />
                <span className="hidden xs:inline">Escanear Código de Barras</span>
                <span className="xs:hidden">Escanear</span>
              </button>

              <button
                type="button"
                onClick={onOpenManualRegister}
                className="flex items-center justify-center gap-1.5 px-3 sm:px-3.5 py-2 rounded-lg font-sans font-semibold text-xs sm:text-sm border shadow-sm cursor-pointer hover:brightness-105 active:scale-95 transition-all whitespace-nowrap min-h-[38px] select-none"
                style={{
                  backgroundColor: palette.paperSurface,
                  borderColor: palette.woodBorder,
                  color: palette.textOnPaper,
                }}
                title="Cadastrar livro manualmente"
              >
                <Plus size={15} style={{ color: palette.woodBorder }} />
                <span className="hidden xs:inline">Cadastro Manual</span>
                <span className="xs:hidden">Manual</span>
              </button>
            </div>

            {/* Toggle entre Explorar e Cancelar */}
            {isLoading ? (
              <button
                key="btn-cancel-search"
                type="button"
                onClick={handleToggleAction}
                className="flex items-center justify-center gap-2 px-4 sm:px-5 py-2 rounded-lg font-sans font-semibold text-xs sm:text-sm border shadow-md cursor-pointer hover:bg-rose-700 active:scale-95 transition-all min-h-[38px] select-none text-white bg-rose-800 border-rose-900"
                title="Cancelar pesquisa em andamento"
                aria-label="Cancelar pesquisa em andamento"
              >
                <Loader2 size={15} className="animate-spin text-white/90 pointer-events-none" />
                <span className="pointer-events-none">Cancelar</span>
                <X size={15} className="stroke-[2.5] pointer-events-none" />
              </button>
            ) : (
              <button
                key="btn-explore-search"
                type="button"
                onClick={handleToggleAction}
                disabled={!searchQuery.trim()}
                className="flex items-center justify-center gap-2 px-5 py-2 rounded-lg font-sans font-semibold text-xs sm:text-sm border shadow-md cursor-pointer hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 min-h-[38px] select-none"
                style={{
                  backgroundColor: palette.goldPrimary,
                  borderColor: palette.woodBorder,
                  color: palette.textOnGold,
                }}
                title="Iniciar pesquisa bibliográfica"
                aria-label="Iniciar pesquisa bibliográfica"
              >
                <Search size={15} className="pointer-events-none" />
                <span className="pointer-events-none">Explorar</span>
              </button>
            )}
          </div>
        </form>

        {/* Resultados da Descoberta */}
        <div className="mt-5 flex-1 flex flex-col">
          {discoveryContext && (
            <div
              className="mb-4 p-3.5 rounded-xl border flex items-center justify-between gap-3 shadow-xs"
              style={{
                backgroundColor: `${palette.goldPrimary}18`,
                borderColor: `${palette.goldPrimary}60`,
              }}
            >
              <div className="flex flex-col">
                <span className="font-serif font-bold text-sm sm:text-base" style={{ color: palette.textOnWood }}>
                  {discoveryContext.title}
                </span>
                <span className="text-xs font-sans opacity-85 mt-0.5" style={{ color: palette.textSecondaryOnWood }}>
                  Fonte: {discoveryContext.sourceName} {discoveryContext.referenceDate ? `• ${discoveryContext.referenceDate}` : ''}
                </span>
              </div>
              {onClearDiscoveryContext && (
                <button
                  type="button"
                  onClick={onClearDiscoveryContext}
                  className="p-1.5 rounded-full hover:bg-black/10 transition-colors cursor-pointer select-none"
                  title="Limpar contexto de exploração"
                  aria-label="Limpar contexto de exploração"
                >
                  <X size={16} style={{ color: palette.textOnWood }} />
                </button>
              )}
            </div>
          )}

          {isLoading && results.length === 0 && (
            <div className="py-12 flex flex-col items-center justify-center gap-3">
              <Loader2 size={38} className="animate-spin" style={{ color: palette.goldPrimary }} />
              <p className="font-serif text-base font-semibold" style={{ color: palette.textOnWood }}>
                Consultando catálogos bibliográficos mundiais...
              </p>
              <p className="text-xs sm:text-sm text-center max-w-sm font-sans" style={{ color: palette.textSecondaryOnWood }}>
                Google Books, Open Library, Inventaire e bases integradas
              </p>
              {onCancelSearch && (
                <button
                  type="button"
                  onClick={onCancelSearch}
                  className="mt-2 flex items-center gap-1.5 px-4 py-2 rounded-lg font-sans font-semibold text-xs border shadow-sm cursor-pointer hover:bg-rose-700 active:scale-95 transition-all text-white bg-rose-800 border-rose-900"
                  title="Cancelar pesquisa"
                >
                  <X size={14} />
                  <span>Cancelar pesquisa</span>
                </button>
              )}
            </div>
          )}

          {!isLoading && errorMessage && results.length === 0 && (
            <div
              className="p-4 rounded-xl border text-center font-serif text-sm shadow-sm flex flex-col items-center gap-3"
              style={{
                backgroundColor: palette.paperSurfaceElevated,
                borderColor: palette.woodBorder,
                color: palette.textOnPaper,
              }}
            >
              <p className="leading-relaxed font-sans">{errorMessage}</p>
              {onGoToSettings && (errorMessage.includes('429') || errorMessage.includes('Configurações') || errorMessage.includes('Chave')) && (
                <button
                  type="button"
                  onClick={onGoToSettings}
                  className="px-4 py-2 rounded-lg font-sans font-semibold text-xs sm:text-sm border shadow-xs cursor-pointer hover:brightness-105 active:scale-95 transition-all flex items-center gap-2 select-none"
                  style={{
                    backgroundColor: palette.goldPrimary,
                    borderColor: palette.woodBorder,
                    color: palette.textOnGold,
                  }}
                >
                  <Key size={14} />
                  <span>Cadastrar Chave Google Books nas Configurações</span>
                </button>
              )}
            </div>
          )}

          {!hasExecutedSearch && (
            <div className="py-12 sm:py-16 flex flex-col items-center justify-center gap-4 text-center max-w-md mx-auto px-4">
              <div
                className="w-18 h-18 sm:w-20 sm:h-20 rounded-3xl flex items-center justify-center shadow-xl border transition-transform hover:scale-105"
                style={{
                  backgroundColor: `${palette.goldPrimary}22`,
                  borderColor: `${palette.goldPrimary}60`,
                  color: palette.goldPrimary,
                }}
              >
                <BookOpen size={42} strokeWidth={2.2} />
              </div>

              <div className="flex flex-col gap-2">
                <h3
                  className="font-serif font-bold text-xl sm:text-2xl leading-tight tracking-wide"
                  style={{ color: palette.textOnWood }}
                >
                  Explorar Catálogo Mundial
                </h3>
                <p
                  className="font-sans text-sm sm:text-base leading-relaxed font-normal max-w-sm mx-auto"
                  style={{ color: palette.textSecondaryOnWood }}
                >
                  Pesquise por título, autor ou código ISBN para descobrir livros e edições completas.
                </p>
              </div>

              <div className="flex items-center justify-center gap-2 flex-wrap pt-2">
                <span
                  className="px-3 py-1.5 rounded-full text-xs font-sans font-semibold border flex items-center gap-1.5 shadow-xs"
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    borderColor: `${palette.goldPrimary}40`,
                    color: palette.textOnWood,
                  }}
                >
                  <span>📖</span>
                  <span>Título</span>
                </span>
                <span
                  className="px-3 py-1.5 rounded-full text-xs font-sans font-semibold border flex items-center gap-1.5 shadow-xs"
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    borderColor: `${palette.goldPrimary}40`,
                    color: palette.textOnWood,
                  }}
                >
                  <span>✍️</span>
                  <span>Autor</span>
                </span>
                <span
                  className="px-3 py-1.5 rounded-full text-xs font-sans font-semibold border flex items-center gap-1.5 shadow-xs"
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    borderColor: `${palette.goldPrimary}40`,
                    color: palette.textOnWood,
                  }}
                >
                  <span>📷</span>
                  <span>Código de Barras</span>
                </span>
              </div>
            </div>
          )}

          {results.length > 0 && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between text-xs sm:text-sm px-1 pb-1 border-b" style={{ borderColor: `${palette.woodBorder}30` }}>
                <span className="font-sans font-semibold" style={{ color: palette.goldPrimary }}>
                  {results.length} {results.length === 1 ? 'edição encontrada' : 'edições encontradas'}
                </span>
                {providerStatuses.length > 0 && (
                  <button
                    onClick={() => setShowDiagnosticModal(true)}
                    className="flex items-center gap-1 font-sans text-xs underline opacity-90 hover:opacity-100 cursor-pointer"
                    style={{ color: palette.goldPrimary }}
                  >
                    <Activity size={12} />
                    Fontes consultadas
                  </button>
                )}
              </div>

              {results.map((item, idx) => {
                const existingInLibrary = (userBooks || []).find((b) => areBooksDuplicate(b, item));
                const provenanceSources = item.fontes || [item.origem];

                return (
                  <PaperCard
                    key={`${item.idExterno || item.isbn13 || item.titulo}_${idx}`}
                    palette={palette}
                    elevated
                    className="p-3.5 transition-all hover:translate-y-[-1px] cursor-pointer"
                    onClick={() => handleCardClick(item)}
                  >
                    <div className="flex gap-3.5">
                      {/* Capa */}
                      <div className="w-16 h-24 shrink-0 shadow-md rounded overflow-hidden">
                        <BookCoverView
                          coverUrl={item.capaUrl}
                          title={item.titulo}
                          author={item.autores?.[0]}
                          palette={palette}
                        />
                      </div>

                      {/* Informações Bibliográficas */}
                      <div className="flex-1 flex flex-col justify-between min-w-0">
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <h4
                              className="font-serif font-bold text-sm sm:text-base leading-snug line-clamp-2"
                              style={{ color: palette.textOnPaper }}
                            >
                              {item.titulo}
                            </h4>

                            {existingInLibrary && (
                              <span
                                className="shrink-0 text-[10px] font-sans px-2 py-0.5 rounded font-bold uppercase tracking-wider"
                                style={{
                                  backgroundColor: '#10b98120',
                                  color: '#065f46',
                                  border: '1px solid #10b98150',
                                }}
                              >
                                Na Estante
                              </span>
                            )}
                          </div>

                          {item.subtitulo && (
                            <p
                              className="text-xs sm:text-sm font-sans italic line-clamp-1 mt-0.5"
                              style={{ color: palette.textSecondaryOnPaper }}
                            >
                              {item.subtitulo}
                            </p>
                          )}

                          <p
                            className="text-xs sm:text-sm font-sans font-normal line-clamp-1 mt-1"
                            style={{ color: palette.textSecondaryOnPaper }}
                          >
                            {item.autores && item.autores.length > 0
                              ? item.autores.join(', ')
                              : 'Autor desconhecido'}
                          </p>

                          {/* Metadados e Edição */}
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap text-xs font-sans opacity-90">
                            {item.editora && <span>{item.editora}</span>}
                            {item.anoPublicacao && <span>• {item.anoPublicacao}</span>}
                            {item.paginas && <span>• {item.paginas} págs</span>}
                            {item.isbn13 && (
                              <span className="font-sans text-[11px] px-1.5 py-0.2 rounded bg-black/5 tabular-nums">
                                ISBN: {item.isbn13}
                              </span>
                            )}
                          </div>

                          {/* Badges de proveniência */}
                          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                            {provenanceSources.map((src) => (
                              <span
                                key={src}
                                className="text-[10px] font-sans font-semibold uppercase px-2 py-0.5 rounded border"
                                style={{
                                  borderColor: `${palette.woodBorder}40`,
                                  backgroundColor: `${palette.goldPrimary}15`,
                                  color: palette.woodDark,
                                }}
                              >
                                {src === 'google' ? 'Google Books' : src === 'openlibrary' ? 'Open Library' : src === 'brasilapi' ? 'BrasilAPI' : src === 'inventaire' ? 'Inventaire' : src}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Botões de Ação na Estante */}
                        <div className="mt-3 pt-2 border-t flex flex-wrap gap-1.5 items-center justify-end" style={{ borderColor: `${palette.woodBorder}20` }}>
                          {/* Físico */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectBookToAdd(item, 'meus_livros');
                            }}
                            className="px-2.5 py-1 rounded-md font-sans font-semibold text-xs flex items-center gap-1 border shadow-xs cursor-pointer hover:brightness-105 active:scale-95 transition-all select-none"
                            style={{
                              backgroundColor: existingInLibrary?.tenho_fisico ? palette.goldPrimary : 'transparent',
                              borderColor: palette.woodBorder,
                              color: existingInLibrary?.tenho_fisico ? palette.textOnGold : palette.textOnPaper,
                            }}
                          >
                            <Library size={12} />
                            {existingInLibrary?.tenho_fisico ? 'Físico ✓' : '+ Físico'}
                          </button>

                          {/* E-book */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectBookToAdd(item, 'ebook');
                            }}
                            className="px-2.5 py-1 rounded-md font-sans font-semibold text-xs flex items-center gap-1 border shadow-xs cursor-pointer hover:brightness-105 active:scale-95 transition-all select-none"
                            style={{
                              backgroundColor: existingInLibrary?.formato === 'ebook' ? '#6d28d9' : '#6d28d918',
                              borderColor: '#6d28d980',
                              color: existingInLibrary?.formato === 'ebook' ? '#ffffff' : '#6d28d9',
                            }}
                          >
                            <Tablet size={12} />
                            {existingInLibrary?.formato === 'ebook' ? 'E-book ✓' : '+ E-book'}
                          </button>

                          {/* Lido */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectBookToAdd(item, 'lido');
                            }}
                            className="px-2.5 py-1 rounded-md font-sans font-semibold text-xs border cursor-pointer hover:bg-black/5 active:scale-95 transition-all select-none"
                            style={{
                              borderColor: existingInLibrary?.status_leitura === 'lido' ? '#10b981' : palette.woodBorder,
                              color: existingInLibrary?.status_leitura === 'lido' ? '#065f46' : palette.textOnPaper,
                              backgroundColor: existingInLibrary?.status_leitura === 'lido' ? '#10b98115' : 'transparent',
                            }}
                          >
                            {existingInLibrary?.status_leitura === 'lido' ? 'Lido ✓' : 'Lido'}
                          </button>

                          {/* Quero Ler */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectBookToAdd(item, 'quero_ler');
                            }}
                            className="px-2.5 py-1 rounded-md font-sans font-semibold text-xs border cursor-pointer hover:bg-black/5 active:scale-95 transition-all select-none"
                            style={{
                              borderColor: existingInLibrary?.status_leitura === 'quero_ler' ? '#2563eb' : `${palette.woodBorder}80`,
                              color: existingInLibrary?.status_leitura === 'quero_ler' ? '#1d4ed8' : palette.textSecondaryOnPaper,
                              backgroundColor: existingInLibrary?.status_leitura === 'quero_ler' ? '#2563eb15' : 'transparent',
                            }}
                          >
                            {existingInLibrary?.status_leitura === 'quero_ler' ? 'Quero Ler ✓' : 'Quero Ler'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </PaperCard>
                );
              })}

              {/* Botão Carregar Mais / Paginação Progressiva */}
              {hasMore && onLoadMore && (
                <div className="pt-2 pb-6 flex justify-center">
                  <button
                    type="button"
                    onClick={onLoadMore}
                    disabled={isLoadingMore}
                    className="w-full sm:w-auto px-6 py-2.5 rounded-xl font-sans font-semibold text-xs sm:text-sm border shadow-sm flex items-center justify-center gap-2 cursor-pointer hover:brightness-105 active:scale-95 transition-all disabled:opacity-60 select-none"
                    style={{
                      backgroundColor: palette.paperSurfaceElevated,
                      borderColor: palette.woodBorder,
                      color: palette.textOnPaper,
                    }}
                  >
                    {isLoadingMore ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        <span>Carregando mais resultados...</span>
                      </>
                    ) : (
                      <>
                        <Plus size={14} style={{ color: palette.woodBorder }} />
                        <span>Carregar mais resultados</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {!hasMore && results.length > 0 && (
                <p className="text-center text-xs py-4 font-sans italic" style={{ color: palette.textSecondaryOnWood }}>
                  Fim dos resultados disponíveis nos catálogos.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
