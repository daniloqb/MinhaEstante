import React, { useState, useEffect } from 'react';
import { GroupByMode, SortOption } from '../types/book';
import { WoodPalette } from '../theme/woodTheme';
import { X, Filter, BookOpen, Tablet } from 'lucide-react';

interface FilterModalProps {
  palette: WoodPalette;
  isOpen: boolean;
  onDismiss: () => void;
  groupBy: GroupByMode;
  onGroupByChange: (mode: GroupByMode) => void;
  sortOption: SortOption;
  onSortChange: (option: SortOption) => void;
  selectedRatingMin: number | null;
  onRatingFilterChange: (min: number | null) => void;
  selectedYear: number | null;
  onYearFilterChange: (year: number | null) => void;
  selectedFormat?: 'fisico' | 'ebook' | null;
  onFormatFilterChange?: (format: 'fisico' | 'ebook' | null) => void;
  onClearFilters: () => void;
}

export const FilterModal: React.FC<FilterModalProps> = ({
  palette,
  isOpen,
  onDismiss,
  groupBy,
  onGroupByChange,
  sortOption,
  onSortChange,
  selectedRatingMin,
  onRatingFilterChange,
  selectedYear,
  onYearFilterChange,
  selectedFormat = null,
  onFormatFilterChange,
  onClearFilters,
}) => {
  const currentYear = new Date().getFullYear();
  const [yearInput, setYearInput] = useState<string>(selectedYear ? String(selectedYear) : '');
  const [yearError, setYearError] = useState<string | null>(null);

  useEffect(() => {
    setYearInput(selectedYear ? String(selectedYear) : '');
    setYearError(null);
  }, [selectedYear, isOpen]);

  if (!isOpen) return null;

  const handleYearChange = (raw: string) => {
    const digitsOnly = raw.replace(/\D/g, '').slice(0, 4);
    setYearInput(digitsOnly);

    if (!digitsOnly) {
      setYearError(null);
      onYearFilterChange(null);
      return;
    }

    if (digitsOnly.length === 4) {
      const yearNum = parseInt(digitsOnly, 10);
      if (yearNum >= 1900 && yearNum <= currentYear) {
        setYearError(null);
        onYearFilterChange(yearNum);
      } else {
        setYearError(`Ano inválido. Digite entre 1900 e ${currentYear}.`);
        onYearFilterChange(null);
      }
    } else {
      setYearError(null);
      onYearFilterChange(null);
    }
  };

  const handleClearYear = () => {
    setYearInput('');
    setYearError(null);
    onYearFilterChange(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
      onClick={onDismiss}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 shadow-2xl border max-h-[90vh] overflow-y-auto"
        style={{
          backgroundColor: palette.paperSurface,
          borderColor: palette.woodBorder,
          color: palette.textOnPaper,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: `${palette.woodBorder}40` }}>
          <div className="flex items-center gap-2">
            <Filter size={20} color={palette.woodBorder} />
            <h2 className="font-serif font-bold text-2xl" style={{ color: palette.textOnPaper }}>
              Filtrar Estante
            </h2>
          </div>
          <button
            onClick={onDismiss}
            className="p-1 rounded-full hover:bg-black/10 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col gap-5 py-4">
          {/* Agrupamento */}
          <div>
            <label className="block text-xs uppercase font-bold tracking-wider mb-2 font-sans" style={{ color: palette.woodBorder }}>
              Agrupamento das Prateleiras
            </label>
            <div className="flex flex-wrap gap-2">
              {(['ANO', 'AUTOR', 'GENERO'] as GroupByMode[]).map((mode) => {
                const isSelected = groupBy === mode;
                const labels: Record<GroupByMode, string> = {
                  ANO: 'Ano de Leitura / Publicação',
                  AUTOR: 'Autor',
                  GENERO: 'Gênero',
                };
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => onGroupByChange(mode)}
                    className="px-3.5 py-1.5 rounded-full text-xs font-serif font-bold transition-all border cursor-pointer"
                    style={{
                      backgroundColor: isSelected ? palette.goldPrimary : 'transparent',
                      color: isSelected ? palette.textOnGold : palette.textOnPaper,
                      borderColor: palette.woodBorder,
                    }}
                  >
                    {labels[mode]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Formato do Livro (Físicos vs E-books) */}
          <div>
            <label className="block text-xs uppercase font-bold tracking-wider mb-2 font-sans" style={{ color: palette.woodBorder }}>
              Formato da Obra
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                { val: null, label: 'Todos os Formatos', icon: null },
                { val: 'fisico', label: 'Livros Físicos', icon: BookOpen },
                { val: 'ebook', label: 'E-books Digitais', icon: Tablet },
              ].map((fmt) => {
                const isSelected = selectedFormat === fmt.val;
                const IconComp = fmt.icon;
                return (
                  <button
                    key={fmt.label}
                    type="button"
                    onClick={() => onFormatFilterChange && onFormatFilterChange(fmt.val as any)}
                    className="px-3.5 py-1.5 rounded-full text-xs font-serif font-bold transition-all border cursor-pointer flex items-center gap-1.5"
                    style={{
                      backgroundColor: isSelected ? palette.goldPrimary : 'transparent',
                      color: isSelected ? palette.textOnGold : palette.textOnPaper,
                      borderColor: palette.woodBorder,
                    }}
                  >
                    {IconComp && <IconComp size={13} />}
                    <span>{fmt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Ordenação */}
          <div>
            <label className="block text-xs uppercase font-bold tracking-wider mb-2 font-sans" style={{ color: palette.woodBorder }}>
              Ordenação
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'DATA_LEITURA', label: 'Data da Leitura' },
                { id: 'TITULO', label: 'Título (A-Z)' },
                { id: 'AUTOR', label: 'Autor (A-Z)' },
                { id: 'NOTA', label: 'Maior Nota' },
                { id: 'DATA_CADASTRO', label: 'Recentes' },
              ].map((opt) => {
                const isSelected = sortOption === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onSortChange(opt.id as SortOption)}
                    className="px-3.5 py-1.5 rounded-full text-xs font-serif font-bold transition-all border cursor-pointer"
                    style={{
                      backgroundColor: isSelected ? palette.woodBorder : 'transparent',
                      color: isSelected ? '#FFFFFF' : palette.textOnPaper,
                      borderColor: palette.woodBorder,
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Nota Mínima */}
          <div>
            <label className="block text-xs uppercase font-bold tracking-wider mb-2 font-sans" style={{ color: palette.woodBorder }}>
              Avaliação (Nota Mínima)
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                { val: null, label: 'Todas' },
                { val: 7, label: '★ 7+' },
                { val: 8, label: '★ 8+' },
                { val: 9, label: '★ 9+' },
                { val: 10, label: '★ 10' },
              ].map((item) => {
                const isSelected = selectedRatingMin === item.val;
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => onRatingFilterChange(item.val)}
                    className="px-3.5 py-1.5 rounded-full text-xs font-serif font-bold transition-all border cursor-pointer"
                    style={{
                      backgroundColor: isSelected ? palette.goldPrimary : 'transparent',
                      color: isSelected ? palette.textOnGold : palette.textOnPaper,
                      borderColor: palette.woodBorder,
                    }}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Nova Seção: Ano de leitura (logo abaixo da seção de avaliação) */}
          <div>
            <label className="block text-xs uppercase font-bold tracking-wider mb-2 font-sans" style={{ color: palette.woodBorder }}>
              Ano de leitura
            </label>
            <div className="relative">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                value={yearInput}
                onChange={(e) => handleYearChange(e.target.value)}
                placeholder="Ex.: 2025"
                className="w-full px-3.5 py-2 rounded-xl text-sm font-sans border focus:outline-none focus:ring-1"
                style={{
                  backgroundColor: palette.paperSurfaceElevated,
                  borderColor: yearError ? '#dc2626' : palette.woodBorder,
                  color: palette.textOnPaper,
                }}
              />
              {yearInput && (
                <button
                  type="button"
                  onClick={handleClearYear}
                  className="absolute right-3 top-2.5 p-0.5 rounded-full hover:bg-black/10 cursor-pointer"
                >
                  <X size={15} />
                </button>
              )}
            </div>

            {yearError ? (
              <p className="text-xs font-sans mt-1.5 text-red-600 font-semibold">
                {yearError}
              </p>
            ) : (
              <p className="text-[11px] font-serif italic mt-1" style={{ color: palette.textSecondaryOnPaper }}>
                Filtra obras lidas no ano informado (1900 a {currentYear}).
              </p>
            )}
          </div>
        </div>

        {/* Botões do Rodapé */}
        <div className="flex items-center justify-between pt-4 border-t" style={{ borderColor: `${palette.woodBorder}40` }}>
          <button
            type="button"
            onClick={() => {
              onClearFilters();
              setYearInput('');
              setYearError(null);
              onDismiss();
            }}
            className="text-xs font-serif font-semibold underline cursor-pointer hover:opacity-80"
            style={{ color: palette.textSecondaryOnPaper }}
          >
            Limpar filtros
          </button>

          <button
            type="button"
            onClick={onDismiss}
            className="px-5 py-2 rounded-lg font-serif font-bold text-sm shadow-sm cursor-pointer hover:brightness-105 active:scale-95 transition-all"
            style={{
              backgroundColor: palette.goldPrimary,
              color: palette.textOnGold,
            }}
          >
            Aplicar
          </button>
        </div>
      </div>
    </div>
  );
};
