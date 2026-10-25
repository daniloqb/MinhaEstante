import React, { useState, useRef } from 'react';
import { Book, ReadingStatus, ShelfTab, BookFormat, getBookFormats, toggleBookFormat, isBookOwned } from '../types/book';
import { WoodPalette } from '../theme/woodTheme';
import { WoodTopAppBar } from '../components/WoodTopAppBar';
import { BookCoverView } from '../components/BookCoverView';
import { PaperCard } from '../components/PaperCard';
import { StarRatingBar } from '../components/StarRatingBar';
import { BookSummaryAiModal } from '../components/BookSummaryAiModal';
import { BookOwnershipToggle } from '../components/BookOwnershipToggle';
import { useI18n } from '../i18n/I18nContext';
import { ImageService } from '../services/imageService';
import {
  ArrowLeft,
  Check,
  Tablet,
  BookOpen,
  Headphones,
  Sparkles,
  Upload,
  DownloadCloud,
  CheckCircle2,
  Image,
  Globe,
  Trash2,
} from 'lucide-react';

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
  initialTab,
  onBack,
  onSave,
}) => {
  const { t } = useI18n();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  // Formato: Físico, E-book ou Audiolivro (suporta múltiplos simultâneos)
  const defaultFormato: BookFormat =
    initialBook?.formato || (initialTab === 'ebook' ? 'ebook' : 'fisico');
  const [formatos, setFormatos] = useState<BookFormat[]>(() =>
    initialBook ? getBookFormats(initialBook) : [defaultFormato]
  );
  const [formato, setFormato] = useState<BookFormat>(defaultFormato);

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
  // Ao adicionar a partir de E-books: formato 'ebook', status em "Nenhum"
  // Ao adicionar a partir de Lidos: status em "Lido"
  // Ao adicionar a partir de Quero ler: status em "Quero ler"
  const defaultTenho = initialBook
    ? isBookOwned(initialBook)
    : initialTab === 'meus_livros' || initialTab === 'todos';
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

  // IA Modal e Gerenciamento de Capa
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isSavingCoverLocal, setIsSavingCoverLocal] = useState(false);
  const [coverStatusMessage, setCoverStatusMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSaveCoverLocal = async () => {
    if (!capaUrl.trim() || ImageService.isLocalImage(capaUrl)) return;
    setIsSavingCoverLocal(true);
    setCoverStatusMessage(null);
    try {
      const localDataUrl = await ImageService.downloadAndSaveCover(capaUrl.trim());
      setCapaUrl(localDataUrl);
      setCoverStatusMessage('✓ Capa salva localmente no aparelho!');
      setTimeout(() => setCoverStatusMessage(null), 3500);
    } catch {
      setCoverStatusMessage('Falha ao baixar imagem.');
      setTimeout(() => setCoverStatusMessage(null), 3000);
    } finally {
      setIsSavingCoverLocal(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressedDataUrl = await ImageService.fileToDataUrl(file);
      setCapaUrl(compressedDataUrl);
      setCoverStatusMessage('✓ Foto da capa carregada com sucesso!');
      setTimeout(() => setCoverStatusMessage(null), 3500);
    } catch {
      setCoverStatusMessage('Erro ao processar imagem.');
      setTimeout(() => setCoverStatusMessage(null), 3000);
    }
  };

  const executeSave = async (finalTenho: boolean, finalStatus: ReadingStatus) => {
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

    // Se tiver URL remota, tenta salvar localmente para garantir backup permanente
    let finalCapaUrl = capaUrl.trim() ? capaUrl.trim() : null;
    if (finalCapaUrl && !ImageService.isLocalImage(finalCapaUrl)) {
      try {
        finalCapaUrl = await ImageService.downloadAndSaveCover(finalCapaUrl);
      } catch {
        // mantém a remota se não conseguir no momento
      }
    }

    const now = Date.now();
    const finalFormato = formato || formatos[0] || 'fisico';

    const finalBook: Book = {
      ...initialBook,
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
      capaUrl: finalCapaUrl,
      formato: finalFormato,
      formatos,
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

  const handleToggleFormat = (fmt: BookFormat) => {
    const nextFormatos = toggleBookFormat(formatos, fmt);
    if (
      nextFormatos.length === formatos.length &&
      nextFormatos.every((f) => formatos.includes(f))
    ) {
      return;
    }
    setFormatos(nextFormatos);
    if (!nextFormatos.includes(formato)) {
      setFormato(nextFormatos[0]);
    }

  };

  const handleSaveClick = () => {
    if (!titulo.trim()) {
      setTituloError(true);
      return;
    }

    executeSave(tenhoFisico, statusLeitura);
  };

  const bookForAiSummary: Book = {
    id: initialBook?.id || 0,
    origem: 'manual',
    titulo: titulo.trim() || 'Obra',
    subtitulo: subtitulo.trim() || null,
    autores: autoresStr.split(',').map((a) => a.trim()).filter(Boolean),
    formato,
    tenho_fisico: tenhoFisico,
    status_leitura: statusLeitura,
    descricao: descricao.trim() || null,
    observacoes: observacoes.trim() || null,
    capaUrl: capaUrl.trim() || null,
    generos: generosStr.split(',').map((g) => g.trim()).filter(Boolean),
    dataCadastro: Date.now(),
    dataAtualizacao: Date.now(),
  };

  return (
    <div className="flex flex-col w-full flex-1">
      {/* Modal de Resumo com IA */}
      <BookSummaryAiModal
        palette={palette}
        book={bookForAiSummary}
        isOpen={isAiModalOpen}
        onDismiss={() => setIsAiModalOpen(false)}
        onSaveToNotes={(summary) => {
          setObservacoes((prev) => (prev ? `${prev}\n\n${summary}` : summary));
          setIsAiModalOpen(false);
        }}
      />

      <WoodTopAppBar
        palette={palette}
        title={initialBook ? 'Editar Livro' : 'Cadastrar Livro'}
        navigationIcon={
          <button
            onClick={onBack}
            className="p-1.5 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
            title="Voltar"
          >
            <ArrowLeft size={22} color={palette.goldPrimary} />
          </button>
        }
        actions={
          <button
            onClick={handleSaveClick}
            className="p-2 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
            title="Salvar"
          >
            <Check size={22} color={palette.goldPrimary} />
          </button>
        }
      />

      <div className="flex-1 w-full max-w-2xl mx-auto px-4 py-6 flex flex-col gap-6 pb-16">
        {/* Pré-visualização da Capa em Tempo Real */}
        <div className="flex flex-col items-center justify-center">
          <BookCoverView
            palette={palette}
            title={titulo.trim() || 'Título da Obra'}
            author={autoresStr.trim() || 'Autor do Livro'}
            coverUrl={capaUrl.trim() || null}
            width={120}
            height={180}
            className="shadow-2xl mb-2"
          />
          <span
            className="font-serif text-sm italic opacity-85"
            style={{ color: palette.textSecondaryOnWood }}
          >
            Pré-visualização da capa
          </span>
        </div>

        {/* Formulário: Dados Bibliográficos com Tipografia Aprimorada */}
        <PaperCard palette={palette} elevated className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="font-serif font-bold text-xl sm:text-2xl" style={{ color: palette.textOnPaper }}>
              Dados Bibliográficos
            </h3>

            {titulo.trim() && (
              <button
                type="button"
                onClick={() => setIsAiModalOpen(true)}
                className="py-1.5 px-3 rounded-lg border font-sans font-semibold text-xs flex items-center gap-1.5 shadow-xs hover:brightness-105 cursor-pointer select-none"
                style={{
                  backgroundColor: `${palette.goldPrimary}20`,
                  borderColor: palette.goldPrimary,
                  color: palette.woodBorder,
                }}
                title="Pedir resumo à IA para relembrar a história"
              >
                <Sparkles size={14} />
                <span>Resumo com IA</span>
              </button>
            )}
          </div>

          <div>
            <label className="text-sm font-sans font-semibold block mb-1" style={{ color: palette.textOnPaper }}>
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
              className="w-full px-3.5 py-2.5 rounded-lg border text-sm sm:text-base focus:outline-none focus:ring-2 font-sans font-medium"
              style={{
                backgroundColor: palette.paperSurfaceElevated,
                borderColor: tituloError ? '#ef4444' : palette.woodBorder,
                color: palette.textOnPaper,
              }}
            />
            {tituloError && (
              <span className="text-xs font-sans text-red-600 mt-1 block font-semibold">
                O título é obrigatório.
              </span>
            )}
          </div>

          <div>
            <label className="text-sm font-sans font-semibold block mb-1" style={{ color: palette.textOnPaper }}>
              Subtítulo (opcional)
            </label>
            <input
              type="text"
              value={subtitulo}
              onChange={(e) => setSubtitulo(e.target.value)}
              placeholder="Ex: Edição especial comentada"
              className="w-full px-3.5 py-2 rounded-lg border text-sm sm:text-base font-sans focus:outline-none focus:ring-1"
              style={{
                backgroundColor: palette.paperSurfaceElevated,
                borderColor: palette.woodBorder,
                color: palette.textOnPaper,
              }}
            />
          </div>

          <div>
            <label className="text-sm font-sans font-semibold block mb-1" style={{ color: palette.textOnPaper }}>
              Autores (separados por vírgula)
            </label>
            <input
              type="text"
              value={autoresStr}
              onChange={(e) => setAutoresStr(e.target.value)}
              placeholder="Ex: Machado de Assis"
              className="w-full px-3.5 py-2 rounded-lg border text-sm sm:text-base font-sans focus:outline-none focus:ring-1"
              style={{
                backgroundColor: palette.paperSurfaceElevated,
                borderColor: palette.woodBorder,
                color: palette.textOnPaper,
              }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-sans font-semibold block mb-1" style={{ color: palette.textOnPaper }}>
                Editora
              </label>
              <input
                type="text"
                value={editora}
                onChange={(e) => setEditora(e.target.value)}
                placeholder="Ex: Garnier"
                className="w-full px-3 py-2 rounded-lg border text-sm sm:text-base font-sans focus:outline-none focus:ring-1"
                style={{
                  backgroundColor: palette.paperSurfaceElevated,
                  borderColor: palette.woodBorder,
                  color: palette.textOnPaper,
                }}
              />
            </div>
            <div>
              <label className="text-sm font-sans font-semibold block mb-1" style={{ color: palette.textOnPaper }}>
                Ano de Publicação
              </label>
              <input
                type="number"
                value={anoPublicacaoStr}
                onChange={(e) => setAnoPublicacaoStr(e.target.value)}
                placeholder="Ex: 1899"
                className="w-full px-3 py-2 rounded-lg border text-sm sm:text-base font-sans focus:outline-none focus:ring-1 tabular-nums"
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
              <label className="text-sm font-sans font-semibold block mb-1" style={{ color: palette.textOnPaper }}>
                Número de Páginas
              </label>
              <input
                type="number"
                value={paginasStr}
                onChange={(e) => setPaginasStr(e.target.value)}
                placeholder="Ex: 256"
                className="w-full px-3 py-2 rounded-lg border text-sm sm:text-base font-sans focus:outline-none focus:ring-1 tabular-nums"
                style={{
                  backgroundColor: palette.paperSurfaceElevated,
                  borderColor: palette.woodBorder,
                  color: palette.textOnPaper,
                }}
              />
            </div>
            <div>
              <label className="text-sm font-sans font-semibold block mb-1" style={{ color: palette.textOnPaper }}>
                Código ISBN
              </label>
              <input
                type="text"
                value={isbnStr}
                onChange={(e) => setIsbnStr(e.target.value)}
                placeholder="ISBN-10 ou ISBN-13"
                className="w-full px-3 py-2 rounded-lg border text-sm sm:text-base focus:outline-none focus:ring-1 font-mono"
                style={{
                  backgroundColor: palette.paperSurfaceElevated,
                  borderColor: palette.woodBorder,
                  color: palette.textOnPaper,
                }}
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-sans font-semibold block mb-1" style={{ color: palette.textOnPaper }}>
              Gêneros (separados por vírgula)
            </label>
            <input
              type="text"
              value={generosStr}
              onChange={(e) => setGenerosStr(e.target.value)}
              placeholder="Ex: Ficção, Clássico, Literatura Brasileira"
              className="w-full px-3 py-2 rounded-lg border text-sm sm:text-base font-sans focus:outline-none focus:ring-1"
              style={{
                backgroundColor: palette.paperSurfaceElevated,
                borderColor: palette.woodBorder,
                color: palette.textOnPaper,
              }}
            />
          </div>

          {/* Gerenciamento da Capa: Link e Upload Local permanente com Miniatura Padronizada */}
          <div
            className="p-3.5 rounded-xl border flex flex-col gap-2.5"
            style={{
              backgroundColor: palette.paperSurface,
              borderColor: `${palette.woodBorder}40`,
            }}
          >
            <div className="flex items-center justify-between">
              <label className="text-xs font-sans font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: palette.woodBorder }}>
                <Image size={15} />
                Imagem / Capa do Livro (Armazenamento Local)
              </label>
              <div className="flex items-center gap-2">
                {ImageService.isLocalImage(capaUrl) && (
                  <span className="text-xs font-sans font-semibold text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 size={13} /> Salva localmente
                  </span>
                )}
                <a
                  href={`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(
                    (titulo.trim() || 'Livro') + ' ' + (autoresStr.split(',')[0]?.trim() || '') + ' capa livro'
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-sans font-medium underline flex items-center gap-1 hover:opacity-80"
                  style={{ color: palette.isLightOak ? '#5A3D24' : '#8B5A33' }}
                  title="Buscar imagens da capa no Google em nova aba"
                >
                  <Globe size={13} /> Buscar no Google
                </a>
              </div>
            </div>

            <div className="flex items-start gap-3">
              {/* Pré-visualização da capa (miniatura padronizada) */}
              <div className="shrink-0 shadow-md rounded overflow-hidden">
                <BookCoverView
                  palette={palette}
                  title={titulo.trim() || 'Título da Obra'}
                  author={autoresStr.split(',')[0]?.trim() || 'Autor do Livro'}
                  coverUrl={capaUrl.trim() || null}
                  width={64}
                  height={94}
                />
              </div>

              <div className="flex-1 flex flex-col gap-1.5">
                <input
                  type="url"
                  value={capaUrl}
                  onChange={(e) => setCapaUrl(e.target.value)}
                  placeholder="Cole a URL da capa (https://...)"
                  className="w-full px-3 py-2 rounded-lg border text-xs font-mono focus:outline-none focus:ring-1"
                  style={{
                    backgroundColor: palette.paperSurfaceElevated,
                    borderColor: palette.woodBorder,
                    color: palette.textOnPaper,
                  }}
                />

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  className="hidden"
                />

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="py-1.5 px-2.5 rounded-lg border text-xs font-sans font-semibold flex items-center gap-1.5 cursor-pointer hover:bg-black/5 select-none"
                    style={{ borderColor: palette.woodBorder, color: palette.textOnPaper }}
                  >
                    <Upload size={13} />
                    Foto do celular
                  </button>

                  {capaUrl.trim() && !ImageService.isLocalImage(capaUrl) && (
                    <button
                      type="button"
                      onClick={handleSaveCoverLocal}
                      disabled={isSavingCoverLocal}
                      className="py-1.5 px-2.5 rounded-lg font-sans font-semibold text-xs shadow-xs flex items-center gap-1.5 cursor-pointer hover:brightness-105 active:scale-95 select-none"
                      style={{
                        backgroundColor: palette.goldPrimary,
                        color: palette.textOnGold,
                      }}
                      title="Baixa a imagem agora para ficar salva mesmo se o site original sumir"
                    >
                      <DownloadCloud size={13} />
                      {isSavingCoverLocal ? 'Baixando...' : 'Salvar no aparelho'}
                    </button>
                  )}

                  {capaUrl.trim() && (
                    <button
                      type="button"
                      onClick={() => setCapaUrl('')}
                      className="text-xs font-sans font-medium flex items-center gap-1 text-red-600 hover:text-red-800 cursor-pointer select-none"
                    >
                      <Trash2 size={13} /> Remover
                    </button>
                  )}
                </div>

                {coverStatusMessage && (
                  <span className="text-xs font-sans font-semibold text-emerald-800">
                    {coverStatusMessage}
                  </span>
                )}
              </div>
            </div>

            <p className="text-xs text-stone-500 font-sans">
              Imagens salvas localmente são comprimidas (~25 KB) e ficam guardadas no backup do seu celular.
            </p>
          </div>

          <div>
            <label className="text-sm font-sans font-semibold block mb-1" style={{ color: palette.textOnPaper }}>
              Sinopse / Descrição
            </label>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={3}
              placeholder="Breve descrição ou sinopse da obra..."
              className="w-full px-3 py-2 rounded-lg border text-sm sm:text-base font-sans focus:outline-none focus:ring-1 resize-none"
              style={{
                backgroundColor: palette.paperSurfaceElevated,
                borderColor: palette.woodBorder,
                color: palette.textOnPaper,
              }}
            />
          </div>
        </PaperCard>

        {/* Escolha do Formato (Livro Físico, E-book, Audiolivro) */}
        <PaperCard palette={palette} elevated className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-sans font-bold uppercase tracking-wider" style={{ color: palette.woodBorder }}>
              Formatos da Obra na Estante
            </label>
            <span className="text-xs font-sans text-stone-500">
              Pode selecionar múltiplos formatos
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <button
              type="button"
              onClick={() => handleToggleFormat('fisico')}
              className="py-2.5 px-2 rounded-xl border flex flex-col sm:flex-row items-center justify-center gap-1.5 font-sans font-semibold text-xs sm:text-sm cursor-pointer transition-all shadow-sm select-none text-center"
              style={{
                backgroundColor: formatos.includes('fisico') ? palette.goldPrimary : 'transparent',
                color: formatos.includes('fisico') ? palette.textOnGold : palette.textOnPaper,
                borderColor: formatos.includes('fisico') ? palette.goldPrimary : palette.woodBorder,
              }}
            >
              <BookOpen size={17} />
              <span>Físico</span>
            </button>

            <button
              type="button"
              onClick={() => handleToggleFormat('ebook')}
              className="py-2.5 px-2 rounded-xl border flex flex-col sm:flex-row items-center justify-center gap-1.5 font-sans font-semibold text-xs sm:text-sm cursor-pointer transition-all shadow-sm select-none text-center"
              style={{
                backgroundColor: formatos.includes('ebook') ? palette.goldPrimary : 'transparent',
                color: formatos.includes('ebook') ? palette.textOnGold : palette.textOnPaper,
                borderColor: formatos.includes('ebook') ? palette.goldPrimary : palette.woodBorder,
              }}
            >
              <Tablet size={17} />
              <span>E-book</span>
            </button>

            <button
              type="button"
              onClick={() => handleToggleFormat('audiolivro')}
              className="py-2.5 px-2 rounded-xl border flex flex-col sm:flex-row items-center justify-center gap-1.5 font-sans font-semibold text-xs sm:text-sm cursor-pointer transition-all shadow-sm select-none text-center"
              style={{
                backgroundColor: formatos.includes('audiolivro') ? palette.goldPrimary : 'transparent',
                color: formatos.includes('audiolivro') ? palette.textOnGold : palette.textOnPaper,
                borderColor: formatos.includes('audiolivro') ? palette.goldPrimary : palette.woodBorder,
              }}
            >
              <Headphones size={17} />
              <span>Audiolivro</span>
            </button>
          </div>

          <p className="text-xs font-sans leading-relaxed text-stone-600">
            {t.format.selectionHint}
          </p>
        </PaperCard>

        {/* Formulário: Posse e Status de Leitura Independentes */}
        <PaperCard palette={palette} elevated className="flex flex-col gap-4">
          <h3 className="font-serif font-bold text-xl sm:text-2xl" style={{ color: palette.textOnPaper }}>
            Posse & Status de Leitura
          </h3>

          <BookOwnershipToggle
            palette={palette}
            owned={tenhoFisico}
            onChange={() => setTenhoFisico(!tenhoFisico)}
          />

          {/* SegmentedButton: Status de Leitura (Nenhum | Quero ler | Lido) */}
          <div>
            <label className="text-sm font-sans font-semibold block mb-1.5" style={{ color: palette.textOnPaper }}>
              Status de leitura:
            </label>
            <div className="flex gap-2">
              {(['nenhum', 'quero_ler', 'lido'] as ReadingStatus[]).map((st) => {
                const isSelected = statusLeitura === st;
                const labels: Record<ReadingStatus, string> = {
                  nenhum: 'Nenhum',
                  quero_ler: 'Quero ler',
                  lido: 'Lido',
                  lendo: 'Lendo',
                  abandonado: 'Abandonado',
                };

                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusLeitura(st)}
                    className="flex-1 py-2.5 rounded-lg font-sans font-semibold text-sm sm:text-base transition-all border cursor-pointer text-center select-none"
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
                <span className="text-sm font-sans font-semibold block mb-1.5" style={{ color: palette.textOnPaper }}>
                  Sua Avaliação (0 a 10):
                </span>
                <StarRatingBar
                  palette={palette}
                  rating={selectedRating}
                  onRatingChanged={setSelectedRating}
                  starSize={24}
                  showLabel={true}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-sans font-semibold" style={{ color: palette.textOnPaper }}>
                    Data da Leitura:
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsSemData(!isSemData)}
                    className="px-3 py-1 rounded-full text-xs font-sans font-medium border cursor-pointer select-none"
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
                      <label className="text-xs block mb-1 font-sans font-semibold" style={{ color: palette.textSecondaryOnPaper }}>
                        Ano de Leitura
                      </label>
                      <input
                        type="number"
                        value={anoLeituraStr}
                        onChange={(e) => setAnoLeituraStr(e.target.value.slice(0, 4))}
                        placeholder="Ex: 2026"
                        className="w-full px-3 py-2 rounded-lg border text-sm sm:text-base font-sans tabular-nums"
                        style={{
                          backgroundColor: palette.paperSurfaceElevated,
                          borderColor: palette.woodBorder,
                          color: palette.textOnPaper,
                        }}
                      />
                    </div>
                    <div>
                      <label className="text-xs block mb-1 font-sans font-semibold" style={{ color: palette.textSecondaryOnPaper }}>
                        Mês de Leitura (1-12)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={12}
                        value={mesLeituraStr}
                        onChange={(e) => setMesLeituraStr(e.target.value.slice(0, 2))}
                        placeholder="Ex: 10"
                        className="w-full px-3 py-2 rounded-lg border text-sm sm:text-base font-sans tabular-nums"
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
            <label className="text-sm font-sans font-semibold block mb-1" style={{ color: palette.textOnPaper }}>
              Observações Pessoais
            </label>
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={3}
              placeholder="Comentários sobre a edição, onde comprou, impressões..."
              className="w-full px-3 py-2 rounded-lg border text-sm sm:text-base font-sans focus:outline-none focus:ring-1 resize-none"
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
          className="w-full py-4 rounded-xl font-sans font-semibold text-base shadow-xl flex items-center justify-center gap-2 cursor-pointer hover:brightness-105 active:scale-98 transition-all select-none"
          style={{
            backgroundColor: palette.goldPrimary,
            color: palette.textOnGold,
          }}
        >
          <Check size={22} />
          {initialBook ? 'Salvar Alterações' : 'Cadastrar Livro na Estante'}
        </button>
      </div>
    </div>
  );
};
