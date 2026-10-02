import React, { useState } from 'react';
import { Book, BookStatus } from '../types/book';
import { WoodPalette } from '../theme/woodTheme';
import { StarRatingBar } from './StarRatingBar';
import { X, Plus } from 'lucide-react';

interface BookEditModalProps {
  palette: WoodPalette;
  book: Book | null;
  isOpen: boolean;
  onDismiss: () => void;
  onSave: (updatedBook: Book) => void;
}

export const BookEditModal: React.FC<BookEditModalProps> = ({
  palette,
  book,
  isOpen,
  onDismiss,
  onSave,
}) => {
  if (!isOpen || !book) return null;

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [status, setStatus] = useState<BookStatus>(book.status || 'lido');
  const [selectedRating, setSelectedRating] = useState<number | null>(book.nota ?? null);
  const [isSemData, setIsSemData] = useState<boolean>(book.anoLeitura == null && Boolean(book.id));
  const [anoText, setAnoText] = useState<string>(
    book.anoLeitura != null ? String(book.anoLeitura) : String(currentYear)
  );
  const [mesText, setMesText] = useState<string>(
    book.mesLeitura != null ? String(book.mesLeitura) : String(currentMonth)
  );
  const [genresList, setGenresList] = useState<string[]>(book.generos || []);
  const [newGenreInput, setNewGenreInput] = useState<string>('');
  const [observations, setObservations] = useState<string>(book.observacoes || '');

  const months = [
    { num: 1, name: 'Jan' },
    { num: 2, name: 'Fev' },
    { num: 3, name: 'Mar' },
    { num: 4, name: 'Abr' },
    { num: 5, name: 'Mai' },
    { num: 6, name: 'Jun' },
    { num: 7, name: 'Jul' },
    { num: 8, name: 'Ago' },
    { num: 9, name: 'Set' },
    { num: 10, name: 'Out' },
    { num: 11, name: 'Nov' },
    { num: 12, name: 'Dez' },
  ];

  const handleAddGenre = () => {
    const trimmed = newGenreInput.trim();
    if (trimmed && !genresList.some((g) => g.toLowerCase() === trimmed.toLowerCase())) {
      setGenresList([...genresList, trimmed]);
      setNewGenreInput('');
    }
  };

  const handleRemoveGenre = (genreToRemove: string) => {
    setGenresList(genresList.filter((g) => g !== genreToRemove));
  };

  const handleSave = () => {
    const parsedAno = isSemData ? null : parseInt(anoText, 10) || null;
    const parsedMes = isSemData
      ? null
      : Math.min(12, Math.max(1, parseInt(mesText, 10) || 0)) || null;

    const updated: Book = {
      ...book,
      status,
      nota: status === 'lido' ? selectedRating : null,
      anoLeitura: status === 'lido' ? parsedAno : null,
      mesLeitura: status === 'lido' ? parsedMes : null,
      generos: genresList,
      observacoes: observations.trim() ? observations.trim() : null,
      dataAtualizacao: Date.now(),
    };

    onSave(updated);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs"
      onClick={onDismiss}
    >
      <div
        className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl border max-h-[92vh] overflow-y-auto"
        style={{
          backgroundColor: palette.paperSurface,
          borderColor: palette.woodBorder,
          color: palette.textOnPaper,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle visual no mobile */}
        <div className="w-12 h-1.5 rounded-full mx-auto mb-4 bg-black/20 sm:hidden" />

        <div className="flex items-start justify-between pb-3 border-b" style={{ borderColor: `${palette.woodBorder}40` }}>
          <div>
            <h2 className="font-serif font-bold text-2xl" style={{ color: palette.textOnPaper }}>
              {status === 'lido' ? 'Registro de Leitura' : 'Quero Ler'}
            </h2>
            <p className="font-serif text-sm font-semibold line-clamp-1" style={{ color: palette.textSecondaryOnPaper }}>
              {book.titulo}
            </p>
          </div>
          <button
            onClick={onDismiss}
            className="p-1 rounded-full hover:bg-black/10 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-col gap-5 py-4">
          {/* Seletor de Status (Lido ou Quero Ler) */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStatus('lido')}
              className="flex-1 py-2 rounded-lg font-serif font-bold text-sm transition-all border cursor-pointer"
              style={{
                backgroundColor: status === 'lido' ? palette.goldPrimary : 'transparent',
                color: status === 'lido' ? palette.textOnGold : palette.textOnPaper,
                borderColor: palette.woodBorder,
              }}
            >
              Lido
            </button>
            <button
              type="button"
              onClick={() => setStatus('quero_ler')}
              className="flex-1 py-2 rounded-lg font-serif font-bold text-sm transition-all border cursor-pointer"
              style={{
                backgroundColor: status === 'quero_ler' ? palette.goldPrimary : 'transparent',
                color: status === 'quero_ler' ? palette.textOnGold : palette.textOnPaper,
                borderColor: palette.woodBorder,
              }}
            >
              Quero Ler
            </button>
          </div>

          {status === 'lido' && (
            <>
              {/* Avaliação 0 a 10 */}
              <div className="rounded-xl p-3 border" style={{ backgroundColor: palette.paperSurfaceElevated, borderColor: palette.paperBorder }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-serif font-bold text-base" style={{ color: palette.textOnPaper }}>
                    Sua Avaliação (0 a 10):
                  </span>
                  {selectedRating != null && (
                    <button
                      type="button"
                      onClick={() => setSelectedRating(null)}
                      className="text-xs font-serif underline hover:opacity-80 cursor-pointer"
                      style={{ color: palette.textSecondaryOnPaper }}
                    >
                      Limpar nota
                    </button>
                  )}
                </div>
                <StarRatingBar
                  palette={palette}
                  rating={selectedRating}
                  onRatingChanged={setSelectedRating}
                  starSize={22}
                />
              </div>

              {/* Data da Leitura */}
              <div className="rounded-xl p-3 border" style={{ backgroundColor: palette.paperSurfaceElevated, borderColor: palette.paperBorder }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-serif font-bold text-base" style={{ color: palette.textOnPaper }}>
                    Data da Leitura:
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsSemData(!isSemData)}
                    className="px-2.5 py-1 rounded-full text-xs font-serif font-semibold border cursor-pointer"
                    style={{
                      backgroundColor: isSemData ? palette.goldPrimary : 'transparent',
                      color: isSemData ? palette.textOnGold : palette.textSecondaryOnPaper,
                      borderColor: palette.woodBorder,
                    }}
                  >
                    Sem data
                  </button>
                </div>

                {!isSemData && (
                  <div className="flex flex-col gap-3 mt-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] font-semibold block mb-1" style={{ color: palette.textSecondaryOnPaper }}>
                          Ano da Leitura
                        </label>
                        <input
                          type="number"
                          value={anoText}
                          onChange={(e) => setAnoText(e.target.value.slice(0, 4))}
                          placeholder="Ex: 2026"
                          className="w-full px-3 py-1.5 rounded-lg border text-sm focus:outline-none focus:ring-1"
                          style={{
                            backgroundColor: palette.paperSurface,
                            borderColor: palette.woodBorder,
                            color: palette.textOnPaper,
                          }}
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold block mb-1" style={{ color: palette.textSecondaryOnPaper }}>
                          Mês (1 a 12)
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={12}
                          value={mesText}
                          onChange={(e) => setMesText(e.target.value.slice(0, 2))}
                          placeholder="1 a 12"
                          className="w-full px-3 py-1.5 rounded-lg border text-sm focus:outline-none focus:ring-1"
                          style={{
                            backgroundColor: palette.paperSurface,
                            borderColor: palette.woodBorder,
                            color: palette.textOnPaper,
                          }}
                        />
                      </div>
                    </div>

                    {/* Atalhos rápidos de Ano */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setAnoText(String(currentYear))}
                        className="px-2.5 py-1 rounded-full text-[11px] border cursor-pointer hover:bg-black/5"
                        style={{ borderColor: `${palette.woodBorder}80` }}
                      >
                        {currentYear} (Atual)
                      </button>
                      <button
                        type="button"
                        onClick={() => setAnoText(String(currentYear - 1))}
                        className="px-2.5 py-1 rounded-full text-[11px] border cursor-pointer hover:bg-black/5"
                        style={{ borderColor: `${palette.woodBorder}80` }}
                      >
                        {currentYear - 1}
                      </button>
                    </div>

                    {/* Atalhos rápidos de Meses */}
                    <div className="grid grid-cols-6 gap-1 pt-1">
                      {months.map((m) => {
                        const isSelected = mesText === String(m.num);
                        return (
                          <button
                            key={m.num}
                            type="button"
                            onClick={() => setMesText(isSelected ? '' : String(m.num))}
                            className="py-1 rounded text-xs font-serif font-semibold border cursor-pointer transition-colors"
                            style={{
                              backgroundColor: isSelected ? palette.goldPrimary : 'transparent',
                              color: isSelected ? palette.textOnGold : palette.textOnPaper,
                              borderColor: `${palette.woodBorder}60`,
                            }}
                          >
                            {m.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Gêneros */}
          <div>
            <label className="font-serif font-bold text-base block mb-1.5" style={{ color: palette.textOnPaper }}>
              Gêneros:
            </label>
            <div className="flex items-center gap-2 mb-2">
              <input
                type="text"
                value={newGenreInput}
                onChange={(e) => setNewGenreInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddGenre();
                  }
                }}
                placeholder="Novo gênero..."
                className="flex-1 px-3 py-1.5 rounded-lg border text-sm focus:outline-none focus:ring-1"
                style={{
                  backgroundColor: palette.paperSurfaceElevated,
                  borderColor: palette.woodBorder,
                  color: palette.textOnPaper,
                }}
              />
              <button
                type="button"
                onClick={handleAddGenre}
                className="p-2 rounded-lg text-white cursor-pointer hover:brightness-110 active:scale-95"
                style={{ backgroundColor: palette.woodBorder }}
                title="Adicionar gênero"
              >
                <Plus size={16} />
              </button>
            </div>

            {genresList.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {genresList.map((g) => (
                  <span
                    key={g}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-serif border"
                    style={{
                      backgroundColor: palette.paperSurfaceElevated,
                      borderColor: `${palette.woodBorder}60`,
                      color: palette.textOnPaper,
                    }}
                  >
                    {g}
                    <button
                      type="button"
                      onClick={() => handleRemoveGenre(g)}
                      className="hover:opacity-75 cursor-pointer ml-0.5"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Observações Pessoais */}
          <div>
            <label className="font-serif font-bold text-base block mb-1.5" style={{ color: palette.textOnPaper }}>
              Observações pessoais:
            </label>
            <textarea
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              placeholder="Citações favoritas, impressões ou onde leu..."
              rows={3}
              className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-1 resize-none"
              style={{
                backgroundColor: palette.paperSurfaceElevated,
                borderColor: palette.woodBorder,
                color: palette.textOnPaper,
              }}
            />
          </div>
        </div>

        {/* Botões do Rodapé */}
        <div className="flex items-center gap-3 pt-3 border-t" style={{ borderColor: `${palette.woodBorder}40` }}>
          <button
            type="button"
            onClick={onDismiss}
            className="flex-1 py-2.5 rounded-lg font-serif font-bold text-sm border cursor-pointer"
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
            className="flex-1 py-2.5 rounded-lg font-serif font-bold text-sm shadow-md cursor-pointer hover:brightness-105 active:scale-98"
            style={{
              backgroundColor: palette.goldPrimary,
              color: palette.textOnGold,
            }}
          >
            Salvar na Estante
          </button>
        </div>
      </div>
    </div>
  );
};
