import React from 'react';
import { WoodPalette } from '../../theme/woodTheme';
import { Sparkles, X } from 'lucide-react';

interface ReadingPreferencesPromptProps {
  palette: WoodPalette;
  onOpenPreferences: () => void;
  onUseLibrarySuggestions: () => void;
  onDismiss: () => void;
}

export const ReadingPreferencesPrompt: React.FC<ReadingPreferencesPromptProps> = ({
  palette,
  onOpenPreferences,
  onUseLibrarySuggestions,
  onDismiss,
}) => {
  return (
    <div
      className="w-full p-4 rounded-xl border shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 my-1 relative overflow-hidden"
      style={{
        backgroundColor: palette.paperSurfaceElevated,
        borderColor: palette.goldPrimary,
        color: palette.textOnPaper,
      }}
    >
      <div className="flex items-start gap-3 min-w-0 pr-6 sm:pr-0">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 mt-0.5 shadow-xs"
          style={{
            backgroundColor: `${palette.goldPrimary}30`,
            color: palette.goldPrimary,
          }}
        >
          <Sparkles size={18} />
        </div>

        <div className="flex flex-col">
          <h3 className="font-serif font-bold text-sm sm:text-base leading-snug">
            Quais livros você gosta de ler?
          </h3>
          <p className="font-sans text-xs opacity-80 mt-0.5 max-w-lg">
            Personalize suas recomendações selecionando seus gêneros favoritos ou usando os títulos da sua estante.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 flex-wrap sm:flex-nowrap">
        <button
          type="button"
          onClick={onUseLibrarySuggestions}
          className="flex-1 sm:flex-initial px-3 py-1.5 rounded-lg border font-sans font-semibold text-xs cursor-pointer hover:brightness-105 active:scale-95 transition-all text-center whitespace-nowrap shadow-xs"
          style={{
            backgroundColor: palette.paperSurface,
            borderColor: palette.woodBorder,
            color: palette.textOnPaper,
          }}
          title="Detectar gêneros favoritos a partir dos livros que você já possui"
        >
          Usar da minha estante
        </button>

        <button
          type="button"
          onClick={onOpenPreferences}
          className="flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg font-sans font-semibold text-xs cursor-pointer hover:brightness-110 active:scale-95 transition-all text-center whitespace-nowrap shadow-sm"
          style={{
            backgroundColor: palette.goldPrimary,
            borderColor: palette.woodBorder,
            color: palette.textOnGold,
          }}
        >
          Escolher gêneros
        </button>

        {/* Botão Dispensar */}
        <button
          type="button"
          onClick={onDismiss}
          className="p-1 rounded-full hover:bg-black/10 cursor-pointer absolute sm:static top-2 right-2 text-stone-500 hover:text-stone-700"
          title="Dispensar por enquanto"
          aria-label="Dispensar convite de preferências"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};
