import React, { useState, useEffect } from 'react';
import { SearchResultBook, ShelfTab, Book } from '../types/book';
import { WoodPalette } from '../theme/woodTheme';
import { WoodTopAppBar } from '../components/WoodTopAppBar';
import { WoodShelf } from '../components/WoodShelf';
import { BookCoverView } from '../components/BookCoverView';
import { PaperCard } from '../components/PaperCard';
import { areBooksDuplicate } from '../services/storage';
import { useI18n } from '../i18n/I18nContext';
import {
  Search,
  X,
  Loader2,
  BookOpen,
  Plus,
  Check,
  Library,
  Bookmark,
  Camera,
  ScanBarcode,
  Tablet,
} from 'lucide-react';
import { BarcodeScannerModal } from '../components/BarcodeScannerModal';

interface SearchScreenProps {
  palette: WoodPalette;
  searchQuery: string;
  onQueryChange: (query: string) => void;
  onSearch: (query: string) => void;
  isLoading: boolean;
  results: SearchResultBook[];
  errorMessage: string | null;
  onSelectBookToAdd: (book: SearchResultBook, targetAction?: ShelfTab) => void;
  onSelectBookDetail: (book: Book) => void;
  onOpenManualRegister: () => void;
  userBooks?: Book[];
}

export const SearchScreen: React.FC<SearchScreenProps> = ({
  palette,
  searchQuery,
  onQueryChange,
  onSearch,
  isLoading,
  results,
  errorMessage,
  onSelectBookToAdd,
  onSelectBookDetail,
  onOpenManualRegister,
  userBooks = [],
}) => {
  const { t } = useI18n();
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (isScannerOpen) {
        setIsScannerOpen(false);
        e.stopImmediatePropagation();
      }
    };
    window.addEventListener('popstate', handlePopState, true);
    return () => window.removeEventListener('popstate', handlePopState, true);
  }, [isScannerOpen]);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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

      <div className="flex-1 w-full max-w-2xl mx-auto px-4 py-4 flex flex-col">
        {/* Campo de Busca em Papel Envelhecido */}
        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-2.5">
          <div className="relative w-full">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder={t.search.inputPlaceholder}
              className="w-full pl-10 pr-20 py-2.5 rounded-xl text-sm border focus:outline-none focus:ring-2 shadow-sm font-sans"
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
                  onClick={() => onQueryChange('')}
                  className="p-1 rounded-full hover:bg-black/10 cursor-pointer"
                  title="Limpar busca"
                >
                  <X size={15} />
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

          <div className="flex items-center justify-between text-xs px-1 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsScannerOpen(true)}
                className="flex items-center gap-2 px-3.5 py-2 rounded-lg font-serif font-bold text-xs border shadow-md cursor-pointer hover:brightness-110 active:scale-95 transition-all"
                style={{
                  backgroundColor: palette.goldPrimary,
                  borderColor: palette.woodBorder,
                  color: palette.textOnGold,
                }}
              >
                <Camera size={15} />
                <span>Escanear Código de Barras</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span
                className="font-serif italic text-[11px] hidden sm:inline"
                style={{ color: palette.textSecondaryOnWood }}
              >
                BrasilAPI (CBL), Google e Open Library
              </span>

              <button
                type="submit"
                disabled={Boolean(isLoading) || !searchQuery.trim()}
                className="px-4 py-1.5 rounded-lg font-serif font-bold text-xs shadow-sm cursor-pointer disabled:opacity-50 hover:brightness-105 active:scale-95 transition-all"
                style={{
                  backgroundColor: palette.goldPrimary,
                  color: palette.textOnGold,
                }}
              >
                Buscar
              </button>
            </div>
          </div>
        </form>

        {/* Conteúdo Dinâmico */}
        <div className="flex-1 w-full mt-4 flex flex-col pb-8">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <Loader2
                size={36}
                className="animate-spin mb-3"
                style={{ color: palette.goldPrimary }}
              />
              <p className="font-serif text-lg font-bold" style={{ color: palette.textOnWood }}>
                Consultando acervos brasileiros e internacionais...
              </p>
              <p
                className="font-serif italic text-xs mt-1"
                style={{ color: palette.textSecondaryOnWood }}
              >
                Buscando na CBL / BrasilAPI, Google Books e Open Library
              </p>
            </div>
          ) : errorMessage && results.length === 0 ? (
            /* Mensagem de Erro / Não Encontrado */
            <div className="p-6 my-auto text-center">
              <PaperCard palette={palette} className="flex flex-col items-center p-6">
                <BookOpen size={40} className="mb-2" style={{ color: palette.woodBorder }} />
                <p className="font-serif font-bold text-lg mb-2">{errorMessage}</p>
                <p className="text-xs font-serif italic mb-4 max-w-sm" style={{ color: palette.textSecondaryOnPaper }}>
                  Dica: tente buscar apenas pelo sobrenome do autor (ex: "Orwell", "Verne", "Machado") ou título simplificado.
                </p>
                <button
                  type="button"
                  onClick={onOpenManualRegister}
                  className="px-4 py-2 rounded-lg font-serif font-bold text-sm flex items-center gap-1.5 shadow-sm cursor-pointer"
                  style={{
                    backgroundColor: palette.goldPrimary,
                    color: palette.textOnGold,
                  }}
                >
                  <Plus size={16} />
                  Cadastrar manualmente
                </button>
              </PaperCard>
            </div>
          ) : results.length === 0 && !searchQuery.trim() ? (
            /* Estado Inicial */
            <div className="flex flex-col items-center justify-center p-6 my-auto text-center">
              <div
                className="p-4 rounded-full mb-3 shadow-md border"
                style={{
                  backgroundColor: `${palette.goldPrimary}15`,
                  borderColor: `${palette.goldPrimary}40`,
                  color: palette.goldPrimary,
                }}
              >
                <Search size={40} />
              </div>
              <p
                className="font-serif text-lg leading-snug mb-2 max-w-sm"
                style={{ color: palette.textOnWood }}
              >
                Encontre qualquer livro por título, autor ou código ISBN
              </p>
              <p
                className="font-serif italic text-xs mb-4"
                style={{ color: palette.textSecondaryOnWood }}
              >
                Digite o termo e clique em <strong>Buscar</strong> para pesquisar
              </p>

              {/* Sugestões rápidas de pesquisa */}
              <div className="flex flex-wrap justify-center gap-2 mb-6 max-w-md">
                {['Dom Casmurro', 'George Orwell', 'Júlio Verne', 'Machado de Assis', 'Clarice Lispector'].map((sug) => (
                  <button
                    key={sug}
                    type="button"
                    onClick={() => {
                      onQueryChange(sug);
                      onSearch(sug);
                    }}
                    className="px-3 py-1.5 rounded-full text-xs font-serif border shadow-xs hover:brightness-105 active:scale-95 transition-all cursor-pointer"
                    style={{
                      backgroundColor: palette.paperSurface,
                      borderColor: palette.woodBorder,
                      color: palette.textOnPaper,
                    }}
                  >
                    📚 {sug}
                  </button>
                ))}
              </div>

              <WoodShelf palette={palette} className="mb-6 max-w-sm" />
              <button
                type="button"
                onClick={onOpenManualRegister}
                className="px-5 py-2.5 rounded-xl font-serif font-bold text-sm shadow-md flex items-center gap-2 cursor-pointer hover:brightness-105 active:scale-95 transition-all"
                style={{
                  backgroundColor: palette.goldPrimary,
                  color: palette.textOnGold,
                }}
              >
                <Plus size={18} />
                Cadastrar um livro manualmente
              </button>
            </div>
          ) : (
            /* Lista de Resultados */
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between px-1">
                <span
                  className="font-serif text-sm"
                  style={{ color: palette.textSecondaryOnWood }}
                >
                  {results.length} livros encontrados
                </span>
                <button
                  type="button"
                  onClick={onOpenManualRegister}
                  className="font-serif text-xs font-semibold underline cursor-pointer hover:opacity-80"
                  style={{ color: palette.goldPrimary }}
                >
                  + Cadastro manual
                </button>
              </div>

              {results.map((item, idx) => {
                const existingInLibrary = (userBooks || []).find((b) => areBooksDuplicate(b, item));

                return (
                  <PaperCard
                    key={`${item.idExterno || item.isbn13 || idx}`}
                    palette={palette}
                    onClick={() => handleCardClick(item)}
                    className="group cursor-pointer hover:shadow-md transition-all hover:scale-[1.005]"
                    title="Toque para ver os detalhes da obra, resumo com IA e opções"
                  >
                    <div className="flex gap-3">
                      <BookCoverView
                        palette={palette}
                        book={existingInLibrary}
                        compact={true}
                        title={item.titulo || 'Sem título'}
                        author={(Array.isArray(item.autores) && item.autores[0]) || ''}
                        coverUrl={item.capaUrl}
                        width={64}
                        height={96}
                      />

                      <div className="flex-1 flex flex-col justify-between min-w-0">
                        <div>
                          <div className="flex items-center justify-between gap-1.5 mb-0.5 flex-wrap">
                            <span
                              className="text-[10px] font-bold px-1.5 py-0.5 rounded border"
                              style={{
                                borderColor: `${palette.woodBorder}60`,
                                color: palette.woodBorder,
                              }}
                            >
                              {item.origem === 'brasilapi'
                                ? '🇧🇷 BrasilAPI (CBL)'
                                : item.origem === 'manual'
                                ? '🇧🇷 Edição Brasileira'
                                : (item.isbn13?.startsWith('97885') || item.isbn13?.startsWith('97865'))
                                ? '🇧🇷 Edição Nacional'
                                : item.origem === 'google'
                                ? 'Google Books'
                                : 'Open Library'}
                            </span>

                            {existingInLibrary ? (
                              <div className="flex items-center gap-1">
                                {existingInLibrary.tenho_fisico && (
                                  <span
                                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1 border"
                                    style={{
                                      backgroundColor: `${palette.goldPrimary}20`,
                                      borderColor: palette.goldPrimary,
                                      color: palette.woodBorder,
                                    }}
                                  >
                                    <Library size={10} /> Tenho
                                  </span>
                                )}

                                {existingInLibrary.status_leitura === 'lido' && (
                                  <span
                                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1 border bg-emerald-50 text-emerald-800 border-emerald-300"
                                  >
                                    <Check size={10} /> Lido
                                  </span>
                                )}

                                {existingInLibrary.status_leitura === 'quero_ler' && (
                                  <span
                                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1 border bg-blue-50 text-blue-800 border-blue-300"
                                  >
                                    <Bookmark size={10} /> Quero
                                  </span>
                                )}
                              </div>
                            ) : item.anoPublicacao != null ? (
                              <span
                                className="font-serif text-xs font-semibold"
                                style={{ color: palette.textSecondaryOnPaper }}
                              >
                                {item.anoPublicacao}
                              </span>
                            ) : null}
                          </div>

                          <h3
                            className="font-serif font-bold text-base leading-tight line-clamp-2"
                            style={{ color: palette.textOnPaper }}
                          >
                            {item.titulo}
                          </h3>

                          {item.subtitulo && (
                            <p
                              className="text-xs truncate"
                              style={{ color: palette.textSecondaryOnPaper }}
                            >
                              {item.subtitulo}
                            </p>
                          )}

                          <p
                            className="font-serif text-xs font-medium mt-1 truncate"
                            style={{ color: palette.woodBorder }}
                          >
                            {Array.isArray(item.autores) && item.autores.length > 0
                              ? item.autores.join(', ')
                              : 'Autor desconhecido'}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-1.5 mt-2.5 pt-2 border-t border-black/5">
                          <span className="text-[11px]" style={{ color: palette.textSecondaryOnPaper }}>
                            {item.paginas ? `${item.paginas} págs` : ''}
                          </span>

                          <div className="flex flex-wrap items-center gap-1.5">
                            {/* Botão Tenho Físico */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectBookToAdd(item, 'meus_livros');
                              }}
                              className="px-2.5 py-1 rounded-md font-serif font-bold text-xs flex items-center gap-1 shadow-sm cursor-pointer hover:brightness-105 active:scale-95 transition-all"
                              style={{
                                backgroundColor: existingInLibrary?.tenho_fisico
                                  ? `${palette.goldPrimary}80`
                                  : palette.goldPrimary,
                                color: palette.textOnGold,
                              }}
                              title="Adicionar à estante de Livros Físicos"
                            >
                              <Library size={12} strokeWidth={2.5} />
                              {existingInLibrary?.tenho_fisico ? 'Físico ✓' : '+ Físico'}
                            </button>

                            {/* Botão E-book (Nova Estante de Livros Digitais) */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectBookToAdd(item, 'ebook');
                              }}
                              className="px-2.5 py-1 rounded-md font-serif font-bold text-xs flex items-center gap-1 border shadow-sm cursor-pointer hover:brightness-105 active:scale-95 transition-all"
                              style={{
                                backgroundColor: existingInLibrary?.formato === 'ebook'
                                  ? '#7c3aed'
                                  : '#7c3aed15',
                                borderColor: '#7c3aed80',
                                color: existingInLibrary?.formato === 'ebook'
                                  ? '#ffffff'
                                  : '#7c3aed',
                              }}
                              title="Adicionar à estante de E-books"
                            >
                              <Tablet size={12} strokeWidth={2.5} />
                              {existingInLibrary?.formato === 'ebook' ? 'E-book ✓' : '+ E-book'}
                            </button>

                            {/* Botão Lido (Status de leitura independente) */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectBookToAdd(item, 'lido');
                              }}
                              className="px-2 py-1 rounded-md font-serif font-semibold text-xs border cursor-pointer hover:bg-black/5 active:scale-95 transition-all"
                              style={{
                                borderColor:
                                  existingInLibrary?.status_leitura === 'lido'
                                    ? '#10b981'
                                    : palette.woodBorder,
                                color:
                                  existingInLibrary?.status_leitura === 'lido'
                                    ? '#065f46'
                                    : palette.textOnPaper,
                                backgroundColor:
                                  existingInLibrary?.status_leitura === 'lido'
                                    ? '#10b98115'
                                    : 'transparent',
                              }}
                              title="Registrar leitura desta obra"
                            >
                              {existingInLibrary?.status_leitura === 'lido' ? 'Lido ✓' : 'Lido'}
                            </button>

                            {/* Botão Quero Ler (Status de leitura independente) */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectBookToAdd(item, 'quero_ler');
                              }}
                              className="px-2 py-1 rounded-md font-serif font-semibold text-xs border cursor-pointer hover:bg-black/5 active:scale-95 transition-all"
                              style={{
                                borderColor:
                                  existingInLibrary?.status_leitura === 'quero_ler'
                                    ? '#3b82f6'
                                    : `${palette.woodBorder}80`,
                                color:
                                  existingInLibrary?.status_leitura === 'quero_ler'
                                    ? '#1e40af'
                                    : palette.textSecondaryOnPaper,
                                backgroundColor:
                                  existingInLibrary?.status_leitura === 'quero_ler'
                                    ? '#3b82f615'
                                    : 'transparent',
                              }}
                              title="Adicionar à lista Quero Ler"
                            >
                              {existingInLibrary?.status_leitura === 'quero_ler'
                                ? 'Quero Ler ✓'
                                : 'Quero Ler'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </PaperCard>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
