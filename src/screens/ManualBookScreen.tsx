import React, { useState } from 'react';
import { Book, BookStatus } from '../types/book';
import { WoodPalette } from '../theme/woodTheme';
import { WoodTopAppBar } from '../components/WoodTopAppBar';
import { BookCoverView } from '../components/BookCoverView';
import { PaperCard } from '../components/PaperCard';
import { StarRatingBar } from '../components/StarRatingBar';
import { ArrowLeft, Check } from 'lucide-react';

interface ManualBookScreenProps {
  palette: WoodPalette;
  initialBook?: Book | null;
  onBack: () => void;
  onSave: (book: Book) => void;
}

export const ManualBookScreen: React.FC<ManualBookScreenProps> = ({
  palette,
  initialBook,
  onBack,
  onSave,
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

  const [status, setStatus] = useState<BookStatus>(initialBook?.status || 'lido');
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

  const handleSave = () => {
    if (!titulo.trim()) {
      setTituloError(true);
      return;
    }

    const autores = autoresStr
      .split(',')
      .map((a) => a.trim())
      .filter(Boolean);

    const generos = generosStr
      .split(',')
      .map((g) => g.trim())
      .filter(Boolean);

    const parsedAno =
      status === 'lido' && !isSemData ? parseInt(anoLeituraStr, 10) || null : null;
    const parsedMes =
      status === 'lido' && !isSemData
        ? Math.min(12, Math.max(1, parseInt(mesLeituraStr, 10) || 0)) || null
        : null;

    const cleanIsbn = isbnStr.trim();
    const isbn13 = cleanIsbn.replace(/[-\s]/g, '').length >= 13 ? cleanIsbn : null;
    const isbn10 = cleanIsbn.replace(/[-\s]/g, '').length < 13 && cleanIsbn ? cleanIsbn : null;

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
      status,
      nota: status === 'lido' ? selectedRating : null,
      anoLeitura: parsedAno,
      mesLeitura: parsedMes,
      observacoes: observacoes.trim() ? observacoes.trim() : null,
      dataCadastro: initialBook?.dataCadastro || now,
      dataAtualizacao: now,
    };

    onSave(finalBook);
  };

  return (
    <div className="flex flex-col w-full min-h-screen">
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
            onClick={handleSave}
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
              Título da obra *
            </label>
            <input
              type="text"
              value={titulo}
              onChange={(e) => {
                setTitulo(e.target.value);
                if (e.target.value.trim()) setTituloError(false);
              }}
              placeholder="Ex: Dom Casmurro"
              className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-1 ${
                tituloError ? 'border-red-500 ring-1 ring-red-500' : ''
              }`}
              style={{
                backgroundColor: palette.paperSurfaceElevated,
                borderColor: tituloError ? undefined : palette.woodBorder,
                color: palette.textOnPaper,
              }}
            />
            {tituloError && (
              <span className="text-xs text-red-600 mt-1 block">O título é obrigatório.</span>
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
              placeholder="Ex: Uma Biografia"
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
              Autor(es) (separados por vírgula)
            </label>
            <input
              type="text"
              value={autoresStr}
              onChange={(e) => setAutoresStr(e.target.value)}
              placeholder="Ex: Machado de Assis, José de Alencar"
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
                placeholder="Ex: Companhia das Letras"
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
                onChange={(e) => setAnoPublicacaoStr(e.target.value.slice(0, 4))}
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
                Páginas
              </label>
              <input
                type="number"
                value={paginasStr}
                onChange={(e) => setPaginasStr(e.target.value)}
                placeholder="Ex: 320"
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
                ISBN (10 ou 13)
              </label>
              <input
                type="text"
                value={isbnStr}
                onChange={(e) => setIsbnStr(e.target.value)}
                placeholder="Ex: 9788535902778"
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

        {/* Formulário: Status na Estante */}
        <PaperCard palette={palette} elevated className="flex flex-col gap-4">
          <h3 className="font-serif font-bold text-xl" style={{ color: palette.textOnPaper }}>
            Status na Estante
          </h3>

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
            <div className="flex flex-col gap-4">
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
                        Mês (1-12)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={12}
                        value={mesLeituraStr}
                        onChange={(e) => setMesLeituraStr(e.target.value.slice(0, 2))}
                        placeholder="1 a 12"
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
              Observações pessoais
            </label>
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Anotações, impressões..."
              rows={2}
              className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-1 resize-none"
              style={{
                backgroundColor: palette.paperSurfaceElevated,
                borderColor: palette.woodBorder,
                color: palette.textOnPaper,
              }}
            />
          </div>
        </PaperCard>

        {/* Botão Salvar Principal */}
        <button
          type="button"
          onClick={handleSave}
          className="w-full py-3.5 rounded-xl font-serif font-bold text-base shadow-xl cursor-pointer hover:brightness-105 active:scale-98 transition-all"
          style={{
            backgroundColor: palette.goldPrimary,
            color: palette.textOnGold,
          }}
        >
          Salvar na Estante
        </button>
      </div>
    </div>
  );
};
