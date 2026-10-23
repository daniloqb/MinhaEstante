import React, { useState } from 'react';
import { WoodPalette } from '../../theme/woodTheme';
import { ReadingPreferences, STANDARD_GENRES } from '../../features/home-feed/types';
import { ReadingPreferencesService } from '../../features/home-feed/ReadingPreferencesService';
import { X, Check, Plus, SlidersHorizontal } from 'lucide-react';

interface ReadingPreferencesModalProps {
  palette: WoodPalette;
  isOpen: boolean;
  onClose: () => void;
  onSaved: (prefs: ReadingPreferences) => void;
}

export const ReadingPreferencesModal: React.FC<ReadingPreferencesModalProps> = ({
  palette,
  isOpen,
  onClose,
  onSaved,
}) => {
  const [prefs, setPrefs] = useState<ReadingPreferences>(() =>
    ReadingPreferencesService.getPreferences()
  );
  const [customGenreInput, setCustomGenreInput] = useState('');

  if (!isOpen) return null;

  const toggleGenre = (genre: string) => {
    setPrefs((prev) => {
      const exists = prev.favoriteGenres.includes(genre);
      const updated = exists
        ? prev.favoriteGenres.filter((g) => g !== genre)
        : [...prev.favoriteGenres, genre];
      return { ...prev, favoriteGenres: updated };
    });
  };

  const handleAddCustomGenre = () => {
    const trimmed = customGenreInput.trim();
    if (!trimmed) return;
    if (!prefs.favoriteGenres.includes(trimmed)) {
      setPrefs((prev) => ({
        ...prev,
        favoriteGenres: [...prev.favoriteGenres, trimmed],
      }));
    }
    setCustomGenreInput('');
  };

  const handleSave = () => {
    const saved = ReadingPreferencesService.savePreferences({
      ...prefs,
      hasCompletedOnboarding: true,
    });
    onSaved(saved);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl p-5 shadow-2xl border flex flex-col gap-4 max-h-[88vh] overflow-y-auto animate-in zoom-in-95 duration-150"
        style={{
          backgroundColor: palette.paperSurface,
          borderColor: palette.woodBorder,
          color: palette.textOnPaper,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="flex items-center justify-between pb-2 border-b" style={{ borderColor: `${palette.woodBorder}30` }}>
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={20} style={{ color: palette.goldPrimary }} />
            <h2 className="font-serif font-bold text-lg sm:text-xl">
              Preferências de Leitura & Descoberta
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full hover:bg-black/10 cursor-pointer"
            title="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Ativar/Desativar Recomendações */}
        <div className="flex items-center justify-between py-1 px-1">
          <div className="flex flex-col">
            <span className="font-sans font-bold text-xs sm:text-sm">
              Recomendações Personalizadas
            </span>
            <span className="text-xs opacity-75 font-sans">
              Exibir sugestões calculadas baseadas nos seus gêneros e histórico
            </span>
          </div>
          <button
            type="button"
            onClick={() => setPrefs((p) => ({ ...p, enableRecommendations: !p.enableRecommendations }))}
            className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
              prefs.enableRecommendations ? 'bg-amber-600' : 'bg-stone-400'
            }`}
          >
            <div
              className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                prefs.enableRecommendations ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Preferência Ficção / Não-ficção */}
        <div className="flex flex-col gap-1.5 px-1">
          <span className="font-sans font-bold text-xs sm:text-sm">
            Tipo de Obra Preferido
          </span>
          <div className="grid grid-cols-3 gap-2">
            {(['all', 'fiction', 'non-fiction'] as const).map((mode) => {
              const labels = {
                all: 'Ambos',
                fiction: 'Ficção',
                'non-fiction': 'Não-Ficção',
              };
              const isSelected = prefs.fictionPreference === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setPrefs((p) => ({ ...p, fictionPreference: mode }))}
                  className={`py-1.5 px-2 rounded-lg font-sans text-xs font-semibold border cursor-pointer transition-all ${
                    isSelected ? 'shadow-xs' : 'opacity-80 hover:opacity-100'
                  }`}
                  style={{
                    backgroundColor: isSelected ? palette.goldPrimary : palette.paperSurfaceElevated,
                    borderColor: palette.woodBorder,
                    color: isSelected ? palette.textOnGold : palette.textOnPaper,
                  }}
                >
                  {labels[mode]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Seleção de Gêneros Favoritos */}
        <div className="flex flex-col gap-2 px-1">
          <div className="flex items-center justify-between">
            <span className="font-sans font-bold text-xs sm:text-sm">
              Gêneros Favoritos ({prefs.favoriteGenres.length} selecionados)
            </span>
            {prefs.favoriteGenres.length > 0 && (
              <button
                type="button"
                onClick={() => setPrefs((p) => ({ ...p, favoriteGenres: [] }))}
                className="text-[11px] font-sans underline cursor-pointer opacity-75 hover:opacity-100"
              >
                Limpar todos
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto pr-1">
            {STANDARD_GENRES.map((genre) => {
              const isSelected = prefs.favoriteGenres.includes(genre);
              return (
                <button
                  key={genre}
                  type="button"
                  onClick={() => toggleGenre(genre)}
                  className={`px-2.5 py-1 rounded-full text-xs font-sans font-medium border flex items-center gap-1 cursor-pointer transition-all select-none ${
                    isSelected ? 'shadow-xs scale-[1.02]' : 'opacity-80 hover:opacity-100'
                  }`}
                  style={{
                    backgroundColor: isSelected ? palette.goldPrimary : palette.paperSurfaceElevated,
                    borderColor: isSelected ? palette.woodBorder : `${palette.woodBorder}40`,
                    color: isSelected ? palette.textOnGold : palette.textOnPaper,
                  }}
                >
                  {isSelected && <Check size={12} className="stroke-[3]" />}
                  <span>{genre}</span>
                </button>
              );
            })}
          </div>

          {/* Adicionar gênero personalizado */}
          <div className="flex items-center gap-2 mt-1">
            <input
              type="text"
              value={customGenreInput}
              onChange={(e) => setCustomGenreInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddCustomGenre();
                }
              }}
              placeholder="Adicionar outro gênero personalizado..."
              className="flex-1 px-3 py-1.5 rounded-lg border text-xs font-sans focus:outline-none focus:ring-1"
              style={{
                backgroundColor: palette.paperSurfaceElevated,
                borderColor: palette.woodBorder,
                color: palette.textOnPaper,
              }}
            />
            <button
              type="button"
              onClick={handleAddCustomGenre}
              disabled={!customGenreInput.trim()}
              className="px-3 py-1.5 rounded-lg border font-sans font-semibold text-xs flex items-center gap-1 cursor-pointer disabled:opacity-50 hover:brightness-110"
              style={{
                backgroundColor: palette.goldPrimary,
                borderColor: palette.woodBorder,
                color: palette.textOnGold,
              }}
            >
              <Plus size={14} />
              <span>Adicionar</span>
            </button>
          </div>
        </div>

        {/* Rodapé de Salvar */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t" style={{ borderColor: `${palette.woodBorder}30` }}>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg font-sans font-semibold text-xs border cursor-pointer hover:bg-black/5"
            style={{
              borderColor: palette.woodBorder,
              color: palette.textOnPaper,
            }}
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 rounded-lg font-sans font-semibold text-xs border shadow-sm cursor-pointer hover:brightness-110 active:scale-95 transition-all"
            style={{
              backgroundColor: palette.goldPrimary,
              borderColor: palette.woodBorder,
              color: palette.textOnGold,
            }}
          >
            Salvar Preferências
          </button>
        </div>
      </div>
    </div>
  );
};
