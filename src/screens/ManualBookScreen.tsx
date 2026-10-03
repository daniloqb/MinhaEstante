import React, { useState } from 'react';
import { Book, ReadingStatus, ShelfTab } from '../types/book';
import { WoodPalette } from '../theme/woodTheme';
import { WoodTopAppBar } from '../components/WoodTopAppBar';
import { BookCoverView } from '../components/BookCoverView';
import { PaperCard } from '../components/PaperCard';
import { StarRatingBar } from '../components/StarRatingBar';
import { ArrowLeft, Check, Library, AlertTriangle } from 'lucide-react';

interface ManualBookScreenProps {
  palette: WoodPalette;
  initialBook?: Book | null;
  initialTab?: ShelfTab;
  onBack: () => void;
  onSave: (book: Book) => void;
  onDelete?: (book: Book) => void;
}

export const ManualBookScreen: React.FC<ManualBookScreenProps> = ({
  palette,
  initialBook,
  initialTab = 'meus_livros',
  onBack,
  onSave,
  onDelete,
}) => {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [titulo, setTitulo] = useState(initialBook?.titulo || '');
  const [subtitulo, setSubtitulo] = useState(initialBook?.subtitulo || '');
  const [autoresStr, setAutoresStr] = useState(initialBook?.autores?.join(', ') || '');
  const [editora, setEditora] = useState(initialBook?.editora || '');
  const [anoPublicacaoStr, setAnoPublicacaoStr] = useState(
    initialBook?.anoPublicacao != null ? String(initialBook.anoPublicacao) : ''
  );
  const [paginasStr, setPaginasStr] = useState(
    initialBook?.paginas != null ? String(initialBook.paginas) : ''
  );
  const [isbnStr, setIsbnStr] = useState(initialBook?.isbn13 || initialBook?.isbn10 || '');
  const [generosStr, setGenerosStr] = useState(initialBook?.generos?.join(', ') || '');
  const [descricao, setDescricao] = useState(initialBook?.descricao || '');
  const [capaUrl, setCapaUrl] = useState(initialBook?.capaUrl || '');

  // Regra de contexto ao adicionar:
  // Ao adicionar a partir de Meus Livros: switch de posse ligado, status em "Nenhum"
  // Ao adicionar a partir de Lidos: posse desligada, status em "Lido"
  // Ao adicionar a partir de Quero ler: posse desligada, status em "Quero ler"
  const defaultTenho = initialBook ? initialBook.tenho_fisico : initialTab === 'meus_livros';
  const defaultStatus: ReadingStatus = initialBook
    ? initialBook.status_leitura
    : initialTab === 'lido'
    ? 'lido'
    : initialTab === 'quero_ler'
    ? 'quero_ler'
    : 'nenhum';

  const [tenhoFisico, setTenhoFisico] = useState<boolean>(defaultTenho);
  const [statusLeitura, setStatusLeitura] = useState<ReadingStatus>(defaultStatus);

  const [selectedRating, setSelectedRating] = useState<number | null>(initialBook?.nota ?? null);
  const [isSemData, setIsSemData] = useState<boolean>(
    initialBook?.anoLeitura == null && Boolean(initialBook)
  );
  const [anoLeituraStr, setAnoLeituraStr] = useState(
    initialBook?.anoLeitura != null ? String(initialBook.anoLeitura) : String(currentYear)
  );
  const [mesLeituraStr, setMesLeituraStr] = useState(
    initialBook?.mesLeitura != null ? String(initialBook.mesLeitura) : String(currentMonth)
  );
  const [observacoes, setObservacoes] = useState(initialBook?.observacoes || '');

  const [tituloError, setTituloError] = useState(false);
  const [showOrphanPrompt, setShowOrphanPrompt] = useState(false);

  const executeSave = (finalTenho: boolean, finalStatus: ReadingStatus) => {
    const autores = autoresStr
      .split(/[;,]/)
      .map((a) => a.trim())
      .filter(Boolean);

    const generos = generosStr
      .split(/[;,]/)
      .map((g) => g.trim())
      .filter(Boolean);

    const cleanIsbn = isbnStr.replace(/[-\s]/g, '').trim();
    let isbn10: string | null = null;
    let isbn13: string | null = null;
    if (cleanIsbn.length === 10) isbn10 = cleanIsbn;
    if (cleanIsbn.length === 13) isbn13 = cleanIsbn;

    const parsedAno = isSemData ? null : parseInt(anoLeituraStr, 10) || null;
    const parsedMes = isSemData
      ? null
      : Math.min(12, Math.max(1, parseInt(mesLeituraStr, 10) || 0)) || null;

    const now = Date.now();
    const finalBook: Book = {
      id: initialBook?.id || 0,
      origem: initialBook?.origem || 'manual',
      idExterno: initialBook?.idExterno || null,
      titulo: titulo.trim(),
      subtitulo: subtitulo.trim() ? subtitulo.trim() : null,
      autores,
      editora: editora.trim() ? editora.trim() : null,
      anoPublicacao: parseInt(anoPublicacaoStr, 10) || null,
      paginas: parseInt(paginasStr, 10) || null,
      isbn10,
      isbn13,
      generos,
      descricao: descricao.trim() ? descricao.trim() : null,
      capaUrl: capaUrl.trim() ? capaUrl.trim() : null,
      tenho_fisico: finalTenho,
      status_leitura: finalStatus,
      nota: finalStatus === 'lido' ? selectedRating : initialBook?.nota ?? null,
      anoLeitura: finalStatus === 'lido' ? parsedAno : initialBook?.anoLeitura ?? null,
      mesLeitura: finalStatus === 'lido' ? parsedMes : initialBook?.mesLeitura ?? null,
      observacoes: observacoes.trim() ? observacoes.trim() : null,
      dataCadastro: initialBook?.dataCadastro || now,
      dataAtualizacao: now,
    };

    onSave(finalBook);
  };

  const handleSaveClick = () => {
    if (!titulo.trim()) {
      setTituloError(true);
      return;
    }

    if (!tenhoFisico && statusLeitura === 'nenhum') {
      setShowOrphanPrompt(true);
      return;
    }

    executeSave(tenhoFisico, statusLeitura);
  };

  return (
    <div className="flex flex-col w-full min-h-screen">
      {/* Diálogo de livro sem lista ativa */}
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
                  if (initialBook && onDelete) {
                    onDelete(initialBook);
                  } else {
                    onBack();
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

      <WoodTopAppBar
        palette={palette}
        title={initialBook ? 'Editar Livro' : 'Cadastrar Livro'}
        navigationIcon={
          <button
            onClick={onBack}
            className="p-1.5 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
            title="Voltar"
          >
            <ArrowLeft size={20} color={palette.goldPrimary} />
          </button>
        }
        actions={
          <button
            onClick={handleSaveClick}
            className="p-2 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
            title="Salvar"
          >
            <Check size={20} color={palette.goldPrimary} />
          </button>
        }
      />

      <div className="flex-1 w-full max-w-2xl mx-auto px-4 py-6 flex flex-col gap-6 pb-12">
        {/* Pré-visualização da Capa em Tempo Real */}
        <div className="flex flex-col items-center justify-center">
          <BookCoverView
            palette={palette}
            title={titulo.trim() || 'Título da Obra'}
            author={autoresStr.trim() || 'Autor do Livro'}
            coverUrl={capaUrl.trim() || null}
            width={110}
            height={165}
            className="shadow-xl mb-1.5"
          />
          <span
            className="font-serif text-xs italic opacity-80"
            style={{ color: palette.textSecondaryOnWood }}
          >
            Pré-visualização da capa
          </span>
        </div>

        {/* Formulário: Dados Bibliográficos */}
        <PaperCard palette={palette} elevated className="flex flex-col gap-4">
          <h3 className="font-serif font-bold text-xl" style={{ color: palette.textOnPaper }}>
            Dados Bibliográficos
          </h3>

          <div>
            <label className="text-xs font-bold block mb-1" style={{ color: palette.textOnPaper }}>
              Título da Obra *
            </label>
            <input
              type="text"
              value={titulo}
              onChange={(e) => {
                setTitulo(e.target.value);
                if (tituloError) setTituloError(false);
              }}
              placeholder="Ex: Dom Casmurro"
              className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-1"
              style={{
                backgroundColor: palette.paperSurfaceElevated,
                borderColor: tituloError ? '#ef4444' : palette.woodBorder,
                color: palette.textOnPaper,
              }}
            />
            {tituloError && (
              <span className="text-xs text-red-600 mt-1 block">
                O título é obrigatório.
              </span>
            )}
          </div>

          <div>
            <label className="text-xs font-bold block mb-1" style={{ color: palette.textOnPaper }}>
              Subtítulo (opcional)
            </label>
            <input
              type="text"
              value={subtitulo}
              onChange={(e) => setSubtitulo(e.target.value)}
              placeholder="Ex: Edição especial comentada"
              className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-1"
              style={{
                backgroundColor: palette.paperSurfaceElevated,
                borderColor: palette.woodBorder,
                color: palette.textOnPaper,
              }}
            />
          </div>

          <div>
            <label className="text-xs font-bold block mb-1" style={{ color: palette.textOnPaper }}>
              Autores (separados por vírgula)
            </label>
            <input
              type="text"
              value={autoresStr}
              onChange={(e) => setAutoresStr(e.target.value)}
              placeholder="Ex: Machado de Assis"
              className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-1"
              style={{
                backgroundColor: palette.paperSurfaceElevated,
                borderColor: palette.woodBorder,
                color: palette.textOnPaper,
              }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold block mb-1" style={{ color: palette.textOnPaper }}>
                Editora
              </label>
              <input
                type="text"
                value={editora}
                onChange={(e) => setEditora(e.target.value)}
                placeholder="Ex: Garnier"
                className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-1"
                style={{
                  backgroundColor: palette.paperSurfaceElevated,
                  borderColor: palette.woodBorder,
                  color: palette.textOnPaper,
                }}
              />
            </div>
            <div>
              <label className="text-xs font-bold block mb-1" style={{ color: palette.textOnPaper }}>
                Ano de Publicação
              </label>
              <input
                type="number"
                value={anoPublicacaoStr}
                onChange={(e) => setAnoPublicacaoStr(e.target.value)}
                placeholder="Ex: 1899"
                className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-1"
                style={{
                  backgroundColor: palette.paperSurfaceElevated,
                  borderColor: palette.woodBorder,
                  color: palette.textOnPaper,
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold block mb-1" style={{ color: palette.textOnPaper }}>
                Número de Páginas
              </label>
              <input
                type="number"
                value={paginasStr}
                onChange={(e) => setPaginasStr(e.target.value)}
                placeholder="Ex: 256"
                className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-1"
                style={{
                  backgroundColor: palette.paperSurfaceElevated,
                  borderColor: palette.woodBorder,
                  color: palette.textOnPaper,
                }}
              />
            </div>
            <div>
              <label className="text-xs font-bold block mb-1" style={{ color: palette.textOnPaper }}>
                Código ISBN
              </label>
              <input
                type="text"
                value={isbnStr}
                onChange={(e) => setIsbnStr(e.target.value)}
                placeholder="ISBN-10 ou ISBN-13"
                className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-1"
                style={{
                  backgroundColor: palette.paperSurfaceElevated,
                  borderColor: palette.woodBorder,
                  color: palette.textOnPaper,
                }}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold block mb-1" style={{ color: palette.textOnPaper }}>
              Gêneros (separados por vírgula)
            </label>
            <input
              type="text"
              value={generosStr}
              onChange={(e) => setGenerosStr(e.target.value)}
              placeholder="Ex: Ficção, Clássico, Literatura Brasileira"
              className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-1"
              style={{
                backgroundColor: palette.paperSurfaceElevated,
                borderColor: palette.woodBorder,
                color: palette.textOnPaper,
              }}
            />
          </div>

          <div>
            <label className="text-xs font-bold block mb-1" style={{ color: palette.textOnPaper }}>
              URL da Capa (opcional)
            </label>
            <input
              type="url"
              value={capaUrl}
              onChange={(e) => setCapaUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-1"
              style={{
                backgroundColor: palette.paperSurfaceElevated,
                borderColor: palette.woodBorder,
                color: palette.textOnPaper,
              }}
            />
          </div>

          <div>
            <label className="text-xs font-bold block mb-1" style={{ color: palette.textOnPaper }}>
              Sinopse / Descrição
            </label>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={3}
              placeholder="Breve descrição ou sinopse da obra..."
              className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-1 resize-none"
              style={{
                backgroundColor: palette.paperSurfaceElevated,
                borderColor: palette.woodBorder,
                color: palette.textOnPaper,
              }}
            />
          </div>
        </PaperCard>

        {/* Formulário: Posse e Status de Leitura Independentes */}
        <PaperCard palette={palette} elevated className="flex flex-col gap-4">
          <h3 className="font-serif font-bold text-xl" style={{ color: palette.textOnPaper }}>
            Posse & Status de Leitura
          </h3>

          {/* Switch: Tenho este livro em casa */}
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
                  {tenhoFisico ? 'Exemplar físico no acervo (Aba Meus Livros)' : 'Não possuo o exemplar físico'}
                </span>
              </div>
            </div>

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

          {/* SegmentedButton: Status de Leitura (Nenhum | Quero ler | Lido) */}
          <div>
            <label className="text-xs font-bold block mb-1.5" style={{ color: palette.textOnPaper }}>
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
                    className="flex-1 py-2 rounded-lg font-serif font-bold text-sm transition-all border cursor-pointer text-center"
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
          </div>

          {/* Campos opcionais de mês/ano e avaliação ao escolher 'Lido' */}
          {statusLeitura === 'lido' && (
            <div className="flex flex-col gap-4 pt-2 border-t border-black/5 animate-in fade-in duration-200">
              <div>
                <span className="text-xs font-bold block mb-1.5" style={{ color: palette.textOnPaper }}>
                  Avaliação:
                </span>
                <StarRatingBar
                  palette={palette}
                  rating={selectedRating}
                  onRatingChanged={setSelectedRating}
                  starSize={22}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold" style={{ color: palette.textOnPaper }}>
                    Data da Leitura:
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsSemData(!isSemData)}
                    className="px-2.5 py-0.5 rounded-full text-xs font-serif border cursor-pointer"
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
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] block mb-1" style={{ color: palette.textSecondaryOnPaper }}>
                        Ano de Leitura
                      </label>
                      <input
                        type="number"
                        value={anoLeituraStr}
                        onChange={(e) => setAnoLeituraStr(e.target.value.slice(0, 4))}
                        placeholder="Ex: 2026"
                        className="w-full px-3 py-1.5 rounded-lg border text-sm"
                        style={{
                          backgroundColor: palette.paperSurfaceElevated,
                          borderColor: palette.woodBorder,
                          color: palette.textOnPaper,
                        }}
                      />
                    </div>
                    <div>
                      <label className="text-[11px] block mb-1" style={{ color: palette.textSecondaryOnPaper }}>
                        Mês de Leitura (1-12)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={12}
                        value={mesLeituraStr}
                        onChange={(e) => setMesLeituraStr(e.target.value.slice(0, 2))}
                        placeholder="Ex: 10"
                        className="w-full px-3 py-1.5 rounded-lg border text-sm"
                        style={{
                          backgroundColor: palette.paperSurfaceElevated,
                          borderColor: palette.woodBorder,
                          color: palette.textOnPaper,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-bold block mb-1" style={{ color: palette.textOnPaper }}>
              Observações Pessoais
            </label>
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={3}
              placeholder="Comentários sobre a edição, onde comprou, impressões..."
              className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-1 resize-none"
              style={{
                backgroundColor: palette.paperSurfaceElevated,
                borderColor: palette.woodBorder,
                color: palette.textOnPaper,
              }}
            />
          </div>
        </PaperCard>

        {/* Botão de Salvar no Rodapé */}
        <button
          type="button"
          onClick={handleSaveClick}
          className="w-full py-3.5 rounded-xl font-serif font-bold text-base shadow-xl flex items-center justify-center gap-2 cursor-pointer hover:brightness-105 active:scale-98 transition-all"
          style={{
            backgroundColor: palette.goldPrimary,
            color: palette.textOnGold,
          }}
        >
          <Check size={20} />
          {initialBook ? 'Salvar Alterações' : 'Cadastrar Livro na Estante'}
        </button>
      </div>
    </div>
  );
};
