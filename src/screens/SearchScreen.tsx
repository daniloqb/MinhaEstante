import React from 'react';
import { SearchResultBook, ShelfTab, Book } from '../types/book';
import { WoodPalette } from '../theme/woodTheme';
import { WoodTopAppBar } from '../components/WoodTopAppBar';
import { WoodShelf } from '../components/WoodShelf';
import { BookCoverView } from '../components/BookCoverView';
import { PaperCard } from '../components/PaperCard';
import { areBooksDuplicate } from '../services/storage';
import { Search, X, Loader2, BookOpen, Plus, Check, Library, Bookmark } from 'lucide-react';

interface SearchScreenProps {
  palette: WoodPalette;
  searchQuery: string;
  onQueryChange: (query: string) => void;
  onSearch: (query: string) => void;
  isLoading: boolean;
  results: SearchResultBook[];
  errorMessage: string | null;
  onSelectBookToAdd: (book: SearchResultBook, targetAction?: ShelfTab) => void;
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
  onOpenManualRegister,
  userBooks = [],
}) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      onSearch(searchQuery);
    }
  };

  return (
    <div className="flex flex-col w-full flex-1">
      <WoodTopAppBar palette={palette} title="Buscar Livros" />

      <div className="flex-1 w-full max-w-2xl mx-auto px-4 py-4 flex flex-col">
        {/* Campo de Busca em Papel Envelhecido */}
        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-2">
          <div className="relative w-full">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="Digite título, autor ou ISBN..."
              className="w-full pl-10 pr-9 py-2.5 rounded-xl text-sm border focus:outline-none focus:ring-2 shadow-sm font-sans"
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
            {searchQuery && (
              <button
                type="button"
                onClick={() => onQueryChange('')}
                className="absolute right-3 top-3 p-0.5 rounded-full hover:bg-black/10 cursor-pointer"
              >
                <X size={16} />
              </button>
            )}
          </div>

          <div className="flex items-center justify-between text-xs px-1">
            <span
              className="font-serif italic text-[11px] sm:text-xs"
              style={{ color: palette.textSecondaryOnWood }}
            >
              Busca simultânea no Google Books e Open Library
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
              <p className="font-serif text-lg" style={{ color: palette.textOnWood }}>
                Consultando os arquivos da biblioteca...
              </p>
            </div>
          ) : errorMessage && results.length === 0 ? (
            /* Mensagem de Erro / Não Encontrado */
            <div className="p-6 my-auto text-center">
              <PaperCard palette={palette} className="flex flex-col items-center p-6">
                <BookOpen size={40} className="mb-2" style={{ color: palette.woodBorder }} />
                <p className="font-serif font-bold text-lg mb-4">{errorMessage}</p>
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
            <div className="flex flex-col items-center justify-center p-8 my-auto text-center">
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
                className="font-serif text-lg leading-snug mb-5 max-w-sm"
                style={{ color: palette.textOnWood }}
              >
                Encontre qualquer livro por título, autor ou código ISBN
              </p>
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
                const existingInLibrary = userBooks.find((b) => areBooksDuplicate(b, item));

                return (
                  <PaperCard
                    key={`${item.idExterno || item.isbn13 || idx}`}
                    palette={palette}
                    onClick={() => onSelectBookToAdd(item, 'meus_livros')}
                    className="group"
                  >
                    <div className="flex gap-3">
                      <BookCoverView
                        palette={palette}
                        title={item.titulo}
                        author={item.autores[0]}
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
                              {item.origem === 'google' ? 'Google Books' : 'Open Library'}
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
                            {item.autores.join(', ') || 'Autor desconhecido'}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-1.5 mt-2.5 pt-2 border-t border-black/5">
                          <span className="text-[11px]" style={{ color: palette.textSecondaryOnPaper }}>
                            {item.paginas ? `${item.paginas} págs` : ''}
                          </span>

                          <div className="flex items-center gap-1.5">
                            {/* Botão Tenho (Posse física independente) */}
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
                              title="Adicionar exemplar físico em casa (Aba Meus Livros)"
                            >
                              <Library size={12} strokeWidth={2.5} />
                              {existingInLibrary?.tenho_fisico ? 'Tenho ✓' : 'Tenho'}
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
