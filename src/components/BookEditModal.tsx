import React, { useState } from 'react';
import { Book, ReadingStatus } from '../types/book';
import { WoodPalette } from '../theme/woodTheme';
import { StarRatingBar } from './StarRatingBar';
import { X, Plus, Library, AlertTriangle } from 'lucide-react';

interface BookEditModalProps {
  palette: WoodPalette;
  book: Book | null;
  isOpen: boolean;
  onDismiss: () => void;
  onSave: (updatedBook: Book) => void;
  onDelete?: (book: Book) => void;
}

export const BookEditModal: React.FC<BookEditModalProps> = ({
  palette,
  book,
  isOpen,
  onDismiss,
  onSave,
  onDelete,
}) => {
  if (!isOpen || !book) return null;

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  // Controles independentes
  const [tenhoFisico, setTenhoFisico] = useState<boolean>(Boolean(book.tenho_fisico));
  const [statusLeitura, setStatusLeitura] = useState<ReadingStatus>(
    book.status_leitura || (book.status === 'lido' ? 'lido' : book.status === 'quero_ler' ? 'quero_ler' : 'nenhum')
  );

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

  // Confirmação para livro órfão (sem posse e sem leitura)
  const [showOrphanPrompt, setShowOrphanPrompt] = useState(false);

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

  const executeSave = (finalTenho: boolean, finalStatus: ReadingStatus) => {
    const parsedAno = isSemData ? null : parseInt(anoText, 10) || null;
    const parsedMes = isSemData
      ? null
      : Math.min(12, Math.max(1, parseInt(mesText, 10) || 0)) || null;

    const updated: Book = {
      ...book,
      tenho_fisico: finalTenho,
      status_leitura: finalStatus,
      nota: finalStatus === 'lido' ? selectedRating : book.nota,
      anoLeitura: finalStatus === 'lido' ? parsedAno : book.anoLeitura,
      mesLeitura: finalStatus === 'lido' ? parsedMes : book.mesLeitura,
      generos: genresList,
      observacoes: observations.trim() ? observations.trim() : null,
      dataAtualizacao: Date.now(),
    };

    onSave(updated);
  };

  const handleSaveClick = () => {
    // Se o livro ficar sem posse física E sem status de leitura: perguntar o que deseja fazer
    if (!tenhoFisico && statusLeitura === 'nenhum') {
      setShowOrphanPrompt(true);
      return;
    }

    executeSave(tenhoFisico, statusLeitura);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs"
      onClick={onDismiss}
    >
      {/* Modal de confirmação quando o livro fica sem posse e sem status de leitura */}
      {showOrphanPrompt && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs"
          onClick={() => setShowOrphanPrompt(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl p-6 shadow-2xl border"
            style={{
              backgroundColor: palette.paperSurface,
              borderColor: palette.woodBorder,
              color: palette.textOnPaper,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 mb-3 text-amber-700">
              <AlertTriangle size={24} />
              <h3 className="font-serif font-bold text-xl leading-tight">
                Livro sem lista ativa
              </h3>
            </div>

            <p className="text-sm leading-relaxed mb-6" style={{ color: palette.textOnPaper }}>
              Este livro não está mais em nenhuma lista (não é posse física em casa e não possui status de leitura). Deseja excluí-lo do aplicativo?
            </p>

            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setShowOrphanPrompt(false);
                  if (onDelete) {
                    onDelete(book);
                  } else {
                    onDismiss();
                  }
                }}
                className="w-full py-2.5 px-4 rounded-lg font-serif font-bold text-sm bg-red-700 text-white cursor-pointer hover:bg-red-800 active:scale-98 transition-colors"
              >
                Excluir livro definitivamente
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowOrphanPrompt(false);
                  executeSave(false, 'nenhum');
                }}
                className="w-full py-2.5 px-4 rounded-lg font-serif font-semibold text-sm border cursor-pointer hover:bg-black/5 active:scale-98"
                style={{
                  borderColor: palette.woodBorder,
                  color: palette.textOnPaper,
                }}
              >
                Manter oculto no arquivo
              </button>
            </div>
          </div>
        </div>
      )}

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
              Editar Obra & Leitura
            </h2>
            <p className="font-serif text-sm font-semibold line-clamp-1" style={{ color: palette.textSecondaryOnPaper }}>
              {book.titulo}
            </p>
          </div>
          <button
            onClick={onDismiss}
            className="p-1 rounded-full hover:bg-black/10 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-col gap-5 py-4">
          {/* Controle Independente 1: Switch de Posse Física */}
          <div
            className="p-3.5 rounded-xl border flex items-center justify-between transition-colors"
            style={{
              backgroundColor: tenhoFisico ? `${palette.goldPrimary}15` : palette.paperSurfaceElevated,
              borderColor: tenhoFisico ? palette.goldPrimary : palette.paperBorder,
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="p-2 rounded-lg"
                style={{
                  backgroundColor: tenhoFisico ? palette.goldPrimary : `${palette.woodBorder}20`,
                  color: tenhoFisico ? palette.textOnGold : palette.woodBorder,
                }}
              >
                <Library size={20} />
              </div>
              <div>
                <span className="font-serif font-bold text-base block" style={{ color: palette.textOnPaper }}>
                  Tenho este livro em casa
                </span>
                <span className="text-xs" style={{ color: palette.textSecondaryOnPaper }}>
                  {tenhoFisico ? 'Exemplar físico no acervo (Aba Meus Livros)' : 'Não possuo o exemplar físico no momento'}
                </span>
              </div>
            </div>

            {/* Switch Toggle */}
            <button
              type="button"
              role="switch"
              aria-checked={tenhoFisico}
              onClick={() => setTenhoFisico(!tenhoFisico)}
              className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none"
              style={{
                backgroundColor: tenhoFisico ? palette.goldPrimary : '#9ca3af',
              }}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  tenhoFisico ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Controle Independente 2: Status de Leitura (SegmentedButton) */}
          <div>
            <label className="font-serif font-bold text-base block mb-2" style={{ color: palette.textOnPaper }}>
              Status de leitura:
            </label>
            <div className="flex gap-2">
              {(['nenhum', 'quero_ler', 'lido'] as ReadingStatus[]).map((st) => {
                const isSelected = statusLeitura === st;
                const labels: Record<ReadingStatus, string> = {
                  nenhum: 'Nenhum',
                  quero_ler: 'Quero ler',
                  lido: 'Lido',
                };

                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusLeitura(st)}
                    className="flex-1 py-2 rounded-lg font-serif font-bold text-xs sm:text-sm transition-all border cursor-pointer text-center"
                    style={{
                      backgroundColor: isSelected ? palette.goldPrimary : 'transparent',
                      color: isSelected ? palette.textOnGold : palette.textOnPaper,
                      borderColor: isSelected ? palette.goldPrimary : palette.woodBorder,
                    }}
                  >
                    {labels[st]}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] font-serif italic mt-1.5" style={{ color: palette.textSecondaryOnPaper }}>
              {statusLeitura === 'lido'
                ? 'Obra lida. Aparece na aba Lidos.'
                : statusLeitura === 'quero_ler'
                ? 'Obra desejada para futuras leituras. Aparece na aba Quero Ler.'
                : 'Sem plano de leitura registrado.'}
            </p>
          </div>

          {/* Se status_leitura === 'lido': campos opcionais de mês/ano e nota 0-10 */}
          {statusLeitura === 'lido' && (
            <div className="flex flex-col gap-4 animate-in fade-in duration-200">
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
                  starSize={24}
                  showLabel={true}
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
            </div>
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
            className="flex-1 py-2.5 rounded-lg font-serif font-bold text-sm border cursor-pointer hover:bg-black/5"
            style={{
              borderColor: palette.woodBorder,
              color: palette.textOnPaper,
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSaveClick}
            className="flex-1 py-2.5 rounded-lg font-serif font-bold text-sm shadow-md cursor-pointer hover:brightness-105 active:scale-98 transition-all"
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
