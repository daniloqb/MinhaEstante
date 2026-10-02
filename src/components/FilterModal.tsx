import React from 'react';
import { GroupByMode, SortOption } from '../types/book';
import { WoodPalette } from '../theme/woodTheme';
import { X, Filter } from 'lucide-react';

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
  onClearFilters,
}) => {
  if (!isOpen) return null;

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
            className="p-1 rounded-full hover:bg-black/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col gap-5 py-4">
          {/* Agrupamento */}
          <div>
            <label className="block text-xs uppercase font-bold tracking-wider mb-2" style={{ color: palette.woodBorder }}>
              Agrupamento das Prateleiras
            </label>
            <div className="flex flex-wrap gap-2">
              {(['ANO', 'AUTOR', 'GENERO'] as GroupByMode[]).map((mode) => {
                const isSelected = groupBy === mode;
                const labels: Record<GroupByMode, string> = {
                  ANO: 'Ano de Leitura',
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

          {/* Ordenação */}
          <div>
            <label className="block text-xs uppercase font-bold tracking-wider mb-2" style={{ color: palette.woodBorder }}>
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
            <label className="block text-xs uppercase font-bold tracking-wider mb-2" style={{ color: palette.woodBorder }}>
              Nota Mínima
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
        </div>

        {/* Botões do Rodapé */}
        <div className="flex items-center justify-between pt-4 border-t" style={{ borderColor: `${palette.woodBorder}40` }}>
          <button
            type="button"
            onClick={() => {
              onClearFilters();
              onDismiss();
            }}
            className="text-xs font-serif font-semibold underline cursor-pointer hover:opacity-80"
            style={{ color: palette.textSecondaryOnPaper }}
          >
            Limpar todos os filtros
          </button>

          <button
            type="button"
            onClick={onDismiss}
            className="px-5 py-2 rounded-lg font-serif font-bold text-sm shadow-sm cursor-pointer"
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
