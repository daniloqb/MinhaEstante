import React, { useState, useRef, useEffect } from 'react';
import { ViewMode, GroupByMode, Book } from '../types/book';
import { WoodPalette } from '../theme/woodTheme';
import { WoodTopAppBar } from '../components/WoodTopAppBar';
import { PaperCard } from '../components/PaperCard';
import { cacheImageLocally, isDataUrl } from '../services/imageService';
import {
  Download,
  Upload,
  Share2,
  Key,
  Palette,
  Library,
  X,
  Image as ImageIcon,
  CheckCircle2,
  Loader2,
  Trash2,
  AlertTriangle,
  Globe,
  ChevronDown,
  Archive,
} from 'lucide-react';
import { MaShelfLogo } from '../components/MaShelfLogo';
import { useI18n } from '../i18n/I18nContext';
import { LocaleId } from '../i18n/types';
import { BackupService } from '../services/storage/backupService';
import { BookStorage } from '../services/storage';

interface SettingsBackupScreenProps {
  palette: WoodPalette;
  currentViewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  currentGroupBy: GroupByMode;
  onGroupByChange: (mode: GroupByMode) => void;
  isLightOak: boolean;
  onToggleTheme: () => void;
  apiKey: string;
  onApiKeyChange: (key: string) => void;
  onExportCsv?: () => string;
  onExportJson?: () => string;
  onImportCsv?: (csvContent: string) => { count: number } | Promise<{ count: number }>;
  onImportJson?: (jsonContent: string) => { count: number } | Promise<{ count: number }>;
  books?: Book[];
  onUpdateAllBooks?: (books: Book[]) => void | Promise<void>;
}

export const SettingsBackupScreen: React.FC<SettingsBackupScreenProps> = ({
  palette,
  currentViewMode,
  onViewModeChange,
  currentGroupBy,
  onGroupByChange,
  isLightOak,
  onToggleTheme,
  apiKey,
  onApiKeyChange,
  books = [],
  onUpdateAllBooks,
}) => {
  const { locale, setLocale, t, availableLocales, currentLocaleInfo } = useI18n();
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [isBatchCaching, setIsBatchCaching] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);
  const [isGeneratingZip, setIsGeneratingZip] = useState(false);
  const [isRestoringZip, setIsRestoringZip] = useState(false);
  const [zipProgress, setZipProgress] = useState<string | null>(null);
  const [showZipRestoreModal, setShowZipRestoreModal] = useState(false);
  const [pendingZipFile, setPendingZipFile] = useState<File | null>(null);
  const [restoreMode, setRestoreMode] = useState<'replace' | 'merge'>('replace');
  const zipFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const win = window as any;
    win.onAndroidFileSaved = (success: boolean, name: string) => {
      if (success) {
        setStatusMessage(`✓ Arquivo "${name || 'backup'}" salvo com sucesso no aparelho!`);
        setTimeout(() => setStatusMessage(null), 4000);
      }
    };
    return () => {
      delete win.onAndroidFileSaved;
    };
  }, []);

  const localCoversCount = books.filter((b) => b.capaUrl && isDataUrl(b.capaUrl)).length;
  const remoteCoversCount = books.filter((b) => b.capaUrl && !isDataUrl(b.capaUrl)).length;

  const handleBatchCacheCovers = async () => {
    const remoteBooks = books.filter((b) => b.capaUrl && !isDataUrl(b.capaUrl));
    if (remoteBooks.length === 0 || isBatchCaching || !onUpdateAllBooks) return;

    setIsBatchCaching(true);
    setBatchProgress({ current: 0, total: remoteBooks.length });

    let updatedList = [...books];
    let processed = 0;

    for (const b of remoteBooks) {
      try {
        const dataUrl = await cacheImageLocally(b.capaUrl!);
        if (dataUrl) {
          updatedList = updatedList.map((item) =>
            item.id === b.id ? { ...item, capaUrl: dataUrl, dataAtualizacao: Date.now() } : item
          );
        }
      } catch {
        // Ignora erro de livro específico
      }
      processed++;
      setBatchProgress({ current: processed, total: remoteBooks.length });
    }

    onUpdateAllBooks(updatedList);
    setIsBatchCaching(false);
    setBatchProgress(null);
    setStatusMessage(`${processed} capa(s) baixadas e salvas no armazenamento local!`);
    setTimeout(() => setStatusMessage(null), 4000);
  };





  const handleExportZip = async () => {
    try {
      setIsGeneratingZip(true);
      setZipProgress('Iniciando empacotamento da biblioteca...');

      const backup = await BackupService.exportZipBackup((step, current, total) => {
        setZipProgress(`${step} (${current}/${total})`);
      });

      setZipProgress('Entregando arquivo para download/compartilhamento...');
      const delivered = await BackupService.deliverBackupFile(backup);

      if (delivered) {
        setStatusMessage(`✓ Backup completo (${backup.booksCount} livros, ${backup.coversCount} capas) gerado com sucesso!`);
      } else {
        setStatusMessage(`✓ Arquivo "${backup.fileName}" gerado!`);
      }
      setTimeout(() => setStatusMessage(null), 5000);
    } catch (err: any) {
      alert(`Erro ao gerar backup ZIP: ${err.message}`);
    } finally {
      setIsGeneratingZip(false);
      setZipProgress(null);
    }
  };

  const handleSelectZipFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingZipFile(file);
    setShowZipRestoreModal(true);
  };

  const handleConfirmRestoreZip = async () => {
    if (!pendingZipFile) return;

    try {
      setIsRestoringZip(true);
      setShowZipRestoreModal(false);
      setZipProgress('Descompactando arquivo ZIP...');

      const result = await BackupService.restoreFromZip(
        pendingZipFile,
        restoreMode,
        (step) => setZipProgress(step)
      );

      // Recarrega livros imediatamente da base SQLite restaurada
      const reloaded = await BookStorage.loadBooksFromDatabase();
      if (onUpdateAllBooks) {
        await onUpdateAllBooks(reloaded);
      }

      setStatusMessage(
        `✓ Restauração concluída! ${result.booksRestored} livros e ${result.coversRestored} capas restaurados.`
      );
      if (result.warnings.length > 0) {
        console.warn('Avisos durante a restauração:', result.warnings);
      }
      setTimeout(() => setStatusMessage(null), 5000);
    } catch (err: any) {
      alert(`Falha na restauração: ${err.message}`);
    } finally {
      setIsRestoringZip(false);
      setPendingZipFile(null);
      setZipProgress(null);
      if (zipFileInputRef.current) zipFileInputRef.current.value = '';
    }
  };

  const handleConfirmClearAll = () => {
    if (onUpdateAllBooks) {
      onUpdateAllBooks([]);
    }
    setIsClearModalOpen(false);
    setStatusMessage('Todos os livros foram apagados. Sua estante está limpa!');
    setTimeout(() => setStatusMessage(null), 4000);
  };



  return (
    <div className="flex flex-col w-full flex-1">
      <WoodTopAppBar palette={palette} title={t.settings.title} />

      {/* Notificação Temporária de Sucesso */}
      {statusMessage && (
        <div
          className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl text-xs font-serif font-bold shadow-2xl border animate-bounce"
          style={{
            backgroundColor: palette.goldPrimary,
            color: palette.textOnGold,
            borderColor: palette.woodBorder,
          }}
        >
          {statusMessage}
        </div>
      )}



      {/* Modal de Restauração de Backup ZIP */}
      {showZipRestoreModal && pendingZipFile && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs"
          onClick={() => {
            setShowZipRestoreModal(false);
            setPendingZipFile(null);
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl p-6 shadow-2xl border flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150"
            style={{
              backgroundColor: palette.paperSurface,
              borderColor: palette.woodBorder,
              color: palette.textOnPaper,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b" style={{ borderColor: `${palette.woodBorder}40` }}>
              <div className="flex items-center gap-2">
                <Archive size={20} className="text-amber-800" />
                <h3 className="font-serif font-bold text-lg" style={{ color: palette.textOnPaper }}>
                  Restaurar Backup Completo (.ZIP)
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowZipRestoreModal(false);
                  setPendingZipFile(null);
                }}
                className="p-1 rounded-full hover:bg-black/10 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div
              className="p-3 rounded-xl border text-xs flex flex-col gap-1"
              style={{
                backgroundColor: palette.paperSurfaceElevated,
                borderColor: `${palette.woodBorder}30`,
              }}
            >
              <span className="font-bold font-serif text-sm truncate" style={{ color: palette.textOnPaper }}>
                📦 {pendingZipFile.name}
              </span>
              <span className="text-[11px] opacity-75">
                Tamanho: {(pendingZipFile.size / 1024).toFixed(1)} KB
              </span>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-serif font-bold" style={{ color: palette.textOnPaper }}>
                Escolha o modo de restauração:
              </label>

              {/* Modo Substituir */}
              <label
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  restoreMode === 'replace' ? 'ring-2 ring-amber-800 shadow-xs' : 'opacity-80'
                }`}
                style={{
                  backgroundColor: restoreMode === 'replace' ? `${palette.goldPrimary}20` : palette.paperSurfaceElevated,
                  borderColor: palette.woodBorder,
                }}
              >
                <input
                  type="radio"
                  name="restoreMode"
                  value="replace"
                  checked={restoreMode === 'replace'}
                  onChange={() => setRestoreMode('replace')}
                  className="mt-0.5 accent-amber-800"
                />
                <div className="flex flex-col gap-0.5 text-xs">
                  <span className="font-serif font-bold text-amber-950">
                    Substituir biblioteca atual (Recomendado para restauração completa)
                  </span>
                  <span className="text-[11px] text-stone-600">
                    A biblioteca atual será substituída integralmente pelos dados do backup, garantindo consistência total de capas e IDs.
                  </span>
                </div>
              </label>

              {/* Modo Mesclar */}
              <label
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  restoreMode === 'merge' ? 'ring-2 ring-amber-800 shadow-xs' : 'opacity-80'
                }`}
                style={{
                  backgroundColor: restoreMode === 'merge' ? `${palette.goldPrimary}20` : palette.paperSurfaceElevated,
                  borderColor: palette.woodBorder,
                }}
              >
                <input
                  type="radio"
                  name="restoreMode"
                  value="merge"
                  checked={restoreMode === 'merge'}
                  onChange={() => setRestoreMode('merge')}
                  className="mt-0.5 accent-amber-800"
                />
                <div className="flex flex-col gap-0.5 text-xs">
                  <span className="font-serif font-bold text-amber-950">
                    Mesclar com a biblioteca atual
                  </span>
                  <span className="text-[11px] text-stone-600">
                    Preserva os livros que já estão no aparelho e adiciona os registros e capas novos contidos no ZIP.
                  </span>
                </div>
              </label>
            </div>

            {restoreMode === 'replace' && (
              <div className="p-2.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-[11px] leading-relaxed flex items-start gap-2 text-amber-950">
                <AlertTriangle size={15} className="text-amber-700 shrink-0 mt-0.5" />
                <span>
                  <strong>Aviso de segurança:</strong> A biblioteca atual será substituída. Em caso de qualquer falha durante a leitura do ZIP, o sistema reverterá automaticamente a ação para manter seus dados seguros.
                </span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-black/10">
              <button
                type="button"
                onClick={() => {
                  setShowZipRestoreModal(false);
                  setPendingZipFile(null);
                }}
                className="px-4 py-2 rounded-lg font-serif text-xs border cursor-pointer hover:bg-black/5"
                style={{ borderColor: palette.woodBorder, color: palette.textOnPaper }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmRestoreZip}
                className="px-5 py-2 rounded-lg font-serif font-bold text-xs shadow-md cursor-pointer hover:brightness-105 active:scale-95 transition-all text-white"
                style={{ backgroundColor: palette.woodBorder }}
              >
                Iniciar Restauração
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação para Limpar Tudo */}
      {isClearModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div
            className="w-full max-w-md p-5 rounded-2xl border shadow-2xl flex flex-col gap-4 animate-in zoom-in-95 duration-150"
            style={{
              backgroundColor: palette.paperSurface,
              borderColor: palette.woodBorder,
              color: palette.textOnPaper,
            }}
          >
            <div className="flex items-center gap-2.5 font-serif font-bold text-base text-red-900">
              <span className="p-2 rounded-xl bg-red-100 text-red-600 flex items-center justify-center">
                <Trash2 size={20} />
              </span>
              <div>
                <h4 className="leading-tight">Atenção: Limpar todos os livros?</h4>
                <p className="text-[11px] font-sans font-normal opacity-70" style={{ color: palette.textSecondaryOnPaper }}>
                  Ação destrutiva irreversível sem backup
                </p>
              </div>
            </div>

            <p className="text-xs leading-relaxed" style={{ color: palette.textOnPaper }}>
              Você está prestes a apagar permanentemente todos os <strong>{books.length} {books.length === 1 ? 'livro' : 'livros'}</strong> da sua estante neste dispositivo.
            </p>

            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-950 text-xs flex flex-col gap-2">
              <span className="font-bold flex items-center gap-1.5 text-amber-900">
                <AlertTriangle size={15} className="text-amber-700 shrink-0" />
                Deseja salvar um backup antes?
              </span>
              <p className="text-[11px] opacity-90 leading-relaxed">
                Você pode exportar o arquivo de backup completo (.ZIP) com todas as capas agora para não perder sua coleção.
              </p>
              <button
                type="button"
                onClick={() => {
                  handleExportZip();
                }}
                className="mt-0.5 py-2 px-3 rounded-lg font-serif font-bold text-xs border border-amber-400/80 bg-amber-100 hover:bg-amber-200 active:scale-98 transition-all flex items-center justify-center gap-1.5 cursor-pointer text-amber-950 shadow-xs"
              >
                <Download size={14} />
                <span>Salvar Backup Completo (.ZIP) de Segurança</span>
              </button>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-black/10">
              <button
                type="button"
                onClick={() => setIsClearModalOpen(false)}
                className="px-4 py-2 rounded-lg font-serif text-xs border cursor-pointer hover:bg-black/5"
                style={{ borderColor: palette.woodBorder, color: palette.textOnPaper }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmClearAll}
                className="px-4 py-2 rounded-lg font-serif font-bold text-xs bg-red-600 hover:bg-red-700 text-white shadow-sm cursor-pointer active:scale-95 transition-all flex items-center gap-1.5"
              >
                <Trash2 size={14} />
                <span>Sim, Limpar Tudo</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Conteúdo Principal */}
      <div className="flex-1 w-full max-w-2xl mx-auto px-4 py-6 flex flex-col gap-5 pb-16">
        {/* Idioma e Região / Country & Language */}
        <PaperCard palette={palette} elevated className="flex flex-col gap-3.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <div
                className="p-2.5 rounded-xl border flex items-center justify-center shadow-xs"
                style={{
                  backgroundColor: `${palette.goldPrimary}20`,
                  borderColor: `${palette.goldPrimary}50`,
                  color: palette.goldPrimary,
                }}
              >
                <Globe size={24} />
              </div>
              <div>
                <h3
                  className="font-serif font-bold text-lg leading-tight"
                  style={{ color: palette.textOnPaper }}
                >
                  {t.settings.languageAndRegion}
                </h3>
                <p
                  className="text-xs font-serif opacity-80"
                  style={{ color: palette.textSecondaryOnPaper }}
                >
                  {t.settings.languageAndRegionDesc}
                </p>
              </div>
            </div>

            <span
              className="px-2.5 py-1 rounded-full text-xs font-serif font-bold border flex items-center gap-1.5 shrink-0"
              style={{
                backgroundColor: `${palette.goldPrimary}20`,
                borderColor: palette.goldPrimary,
                color: palette.woodBorder,
              }}
            >
              <span>{currentLocaleInfo.flag}</span>
              <span className="hidden sm:inline">{currentLocaleInfo.country}</span>
            </span>
          </div>

          {/* Combobox de Seleção de País e Idioma */}
          <div className="flex flex-col gap-2 pt-1">
            <label
              htmlFor="country-language-combobox"
              className="text-xs font-serif font-bold flex items-center justify-between"
              style={{ color: palette.textOnPaper }}
            >
              <span>{t.settings.currentLanguage}:</span>
              <span className="text-[11px] font-sans font-normal opacity-75">
                {currentLocaleInfo.name}
              </span>
            </label>

            <div className="relative w-full">
              <select
                id="country-language-combobox"
                value={locale}
                onChange={(e) => {
                  const newLoc = e.target.value as LocaleId;
                  const locInfo = availableLocales.find((l) => l.id === newLoc);
                  setLocale(newLoc);
                  setStatusMessage(`Idioma alterado para ${locInfo ? locInfo.name : newLoc}!`);
                  setTimeout(() => setStatusMessage(null), 3000);
                }}
                className="w-full appearance-none pl-11 pr-10 py-3 rounded-xl border text-sm sm:text-base font-serif font-bold shadow-xs focus:outline-none focus:ring-2 cursor-pointer transition-all"
                style={{
                  backgroundColor: palette.paperSurfaceElevated,
                  borderColor: palette.woodBorder,
                  color: palette.textOnPaper,
                }}
              >
                {availableLocales.map((loc) => (
                  <option
                    key={loc.id}
                    value={loc.id}
                    className="py-2 text-stone-900 bg-amber-50"
                  >
                    {loc.flag} {loc.country} — {loc.language} ({loc.name})
                  </option>
                ))}
              </select>

              {/* Bandeira no início do combobox */}
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-xl leading-none select-none">
                {currentLocaleInfo.flag}
              </div>

              {/* Seta / Chevron estilizado no final */}
              <div
                className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: palette.woodBorder }}
              >
                <ChevronDown size={18} />
              </div>
            </div>

            <div
              className="flex items-center justify-between px-3 py-2 rounded-lg border text-xs font-serif"
              style={{
                backgroundColor: `${palette.goldPrimary}12`,
                borderColor: `${palette.goldPrimary}35`,
                color: palette.textOnPaper,
              }}
            >
              <span className="flex items-center gap-1.5 font-medium">
                <CheckCircle2 size={14} className="text-emerald-700" />
                <span>Ativo: <strong>{currentLocaleInfo.country}</strong> ({currentLocaleInfo.language})</span>
              </span>
              <span className="opacity-75 font-mono text-[11px]">{locale}</span>
            </div>
          </div>
        </PaperCard>

        {/* Identidade Visual & Tema */}
        <PaperCard palette={palette} elevated className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Palette size={20} color={palette.woodBorder} />
            <h3 className="font-serif font-bold text-xl" style={{ color: palette.textOnPaper }}>
              Identidade Visual & Tema
            </h3>
          </div>

          <div className="flex items-center justify-between pt-1">
            <div>
              <p className="font-semibold text-sm" style={{ color: palette.textOnPaper }}>
                {isLightOak ? 'Carvalho Claro (Light Oak)' : 'Nogueira Escura Clássica'}
              </p>
              <p className="text-xs" style={{ color: palette.textSecondaryOnPaper }}>
                {isLightOak
                  ? 'Madeira suave com iluminação dourada'
                  : 'Madeira nobre escura de biblioteca clássica'}
              </p>
            </div>

            {/* Switch Toggle */}
            <button
              type="button"
              onClick={onToggleTheme}
              className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                isLightOak ? 'bg-amber-600' : 'bg-stone-600'
              }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  isLightOak ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </PaperCard>

        {/* Preferências da Estante */}
        <PaperCard palette={palette} elevated className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Library size={20} color={palette.woodBorder} />
            <h3 className="font-serif font-bold text-xl" style={{ color: palette.textOnPaper }}>
              Preferências da Estante
            </h3>
          </div>

          <div>
            <label className="text-xs font-semibold block mb-2" style={{ color: palette.textOnPaper }}>
              Modo de Exibição Padrão:
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onViewModeChange('CAPAS')}
                className="flex-1 py-2 rounded-lg font-serif font-semibold text-xs border cursor-pointer transition-colors"
                style={{
                  backgroundColor: currentViewMode === 'CAPAS' ? palette.goldPrimary : 'transparent',
                  color: currentViewMode === 'CAPAS' ? palette.textOnGold : palette.textOnPaper,
                  borderColor: palette.woodBorder,
                }}
              >
                Prateleiras de Capas
              </button>
              <button
                type="button"
                onClick={() => onViewModeChange('LISTA')}
                className="flex-1 py-2 rounded-lg font-serif font-semibold text-xs border cursor-pointer transition-colors"
                style={{
                  backgroundColor: currentViewMode === 'LISTA' ? palette.goldPrimary : 'transparent',
                  color: currentViewMode === 'LISTA' ? palette.textOnGold : palette.textOnPaper,
                  borderColor: palette.woodBorder,
                }}
              >
                Lista de Cartões
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold block mb-2" style={{ color: palette.textOnPaper }}>
              Agrupamento das Prateleiras:
            </label>
            <div className="flex gap-2">
              {[
                { id: 'ANO', label: 'Ano' },
                { id: 'AUTOR', label: 'Autor' },
                { id: 'GENERO', label: 'Gênero' },
              ].map((m) => {
                const isSelected = currentGroupBy === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onGroupByChange(m.id as GroupByMode)}
                    className="flex-1 py-2 rounded-lg font-serif font-semibold text-xs border cursor-pointer transition-colors"
                    style={{
                      backgroundColor: isSelected ? palette.woodBorder : 'transparent',
                      color: isSelected ? '#FFFFFF' : palette.textOnPaper,
                      borderColor: palette.woodBorder,
                    }}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>
        </PaperCard>

        {/* Chave da API Google Gemini & Google Books */}
        <PaperCard palette={palette} elevated className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Key size={20} color={palette.woodBorder} />
            <h3 className="font-serif font-bold text-xl" style={{ color: palette.textOnPaper }}>
              Chave da API Google Gemini & Books (Opcional)
            </h3>
          </div>
          <p className="text-xs leading-relaxed" style={{ color: palette.textSecondaryOnPaper }}>
            O aplicativo já conta com inteligência artificial e busca integradas gratuitamente. Se desejar prioridade máxima e resumos literários sem filas ou limites compartilhados de cota, você pode inserir sua própria chave gratuita gerada em <strong>aistudio.google.com</strong>.
          </p>

          <input
            type="text"
            value={apiKey}
            onChange={(e) => onApiKeyChange(e.target.value)}
            placeholder="AIzaSy... (Chave gratuita do Google AI Studio)"
            className="w-full px-3 py-2 rounded-lg border text-sm font-mono focus:outline-none focus:ring-1 mt-1"
            style={{
              backgroundColor: palette.paperSurfaceElevated,
              borderColor: palette.woodBorder,
              color: palette.textOnPaper,
            }}
          />
        </PaperCard>

        {/* Armazenamento de Capas e Backup Offline */}
        <PaperCard palette={palette} elevated className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ImageIcon size={20} color={palette.woodBorder} />
              <h3 className="font-serif font-bold text-xl" style={{ color: palette.textOnPaper }}>
                Capas e Armazenamento Local
              </h3>
            </div>
            <span
              className="text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase tracking-wider"
              style={{
                backgroundColor: '#10b98120',
                color: '#065f46',
                border: '1px solid #10b98150',
              }}
            >
              Proteção contra links quebrados
            </span>
          </div>

          <div
            className="p-3 rounded-xl border text-xs sm:text-sm leading-relaxed"
            style={{
              backgroundColor: palette.paperSurfaceElevated,
              borderColor: `${palette.woodBorder}40`,
              color: palette.textOnPaper,
            }}
          >
            <p className="font-bold mb-1 text-amber-950 font-serif">
              💡 As imagens dos livros ocupam muito espaço no celular?
            </p>
            <p className="mb-2">
              <strong>Não!</strong> As capas baixadas pelo app são comprimidas e otimizadas em alta resolução leve (~20KB a 40KB cada). 
              Uma estante com 100 livros ocupa <strong>menos de 4 Megabytes</strong> no armazenamento do aparelho — um tamanho minúsculo que não pesa nada na memória.
            </p>
            <p>
              <strong>Vantagem essencial:</strong> Ao guardar as capas no aparelho, as imagens passam a fazer parte direta do <strong>backup JSON</strong>. 
              Assim, se os sites onde estavam as capas mudarem de link ou saírem do ar, sua biblioteca e capas continuarão intactas para sempre!
            </p>
          </div>

          {/* Estatísticas de Capas */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div
              className="p-2.5 rounded-lg border flex flex-col gap-0.5"
              style={{
                backgroundColor: `${palette.goldPrimary}15`,
                borderColor: palette.goldPrimary,
              }}
            >
              <span className="font-bold text-base font-serif" style={{ color: palette.woodBorder }}>
                {localCoversCount}
              </span>
              <span className="text-[11px]" style={{ color: palette.textSecondaryOnPaper }}>
                Capas salvas localmente (seguras no backup)
              </span>
            </div>

            <div
              className="p-2.5 rounded-lg border flex flex-col gap-0.5"
              style={{
                backgroundColor: remoteCoversCount > 0 ? '#fef3c7' : palette.paperSurfaceElevated,
                borderColor: remoteCoversCount > 0 ? '#f59e0b' : palette.paperBorder,
              }}
            >
              <span className="font-bold text-base font-serif" style={{ color: palette.woodBorder }}>
                {remoteCoversCount}
              </span>
              <span className="text-[11px]" style={{ color: palette.textSecondaryOnPaper }}>
                {remoteCoversCount > 0
                  ? 'Ainda puxando por link externo da internet'
                  : 'Nenhum link externo pendente'}
              </span>
            </div>
          </div>

          {/* Barra de progresso se estiver baixando em lote */}
          {isBatchCaching && batchProgress && (
            <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-black/5 border border-black/10">
              <div className="flex items-center justify-between text-xs font-serif font-bold">
                <span className="flex items-center gap-1.5 text-amber-900">
                  <Loader2 size={13} className="animate-spin" />
                  Baixando e comprimindo capas...
                </span>
                <span>
                  {batchProgress.current} / {batchProgress.total}
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-black/10 overflow-hidden">
                <div
                  className="h-full transition-all duration-200"
                  style={{
                    backgroundColor: palette.goldPrimary,
                    width: `${(batchProgress.current / batchProgress.total) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Botão de Ação para Baixar Todas as Capas */}
          {remoteCoversCount > 0 && (
            <button
              type="button"
              onClick={handleBatchCacheCovers}
              disabled={isBatchCaching}
              className="w-full py-3 px-4 rounded-xl font-serif font-bold text-sm shadow-md flex items-center justify-center gap-2 cursor-pointer hover:brightness-105 active:scale-98 transition-all disabled:opacity-60"
              style={{
                backgroundColor: palette.goldPrimary,
                color: palette.textOnGold,
              }}
              title="Baixar todas as capas externas para o armazenamento do aparelho e incluir no backup"
            >
              {isBatchCaching ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Salvando Capas no Aparelho...
                </>
              ) : (
                <>
                  <Download size={16} />
                  Baixar e Guardar Todas as Capas no Aparelho ({remoteCoversCount})
                </>
              )}
            </button>
          )}

          {remoteCoversCount === 0 && localCoversCount > 0 && (
            <div className="flex items-center gap-2 text-xs font-serif font-semibold text-emerald-800 bg-emerald-50 border border-emerald-300 rounded-lg p-2.5">
              <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
              <span>Todas as capas da sua biblioteca já estão guardadas no aparelho e serão exportadas no backup JSON!</span>
            </div>
          )}
        </PaperCard>

        {/* Backup e Sincronização Local */}
        <div id="sec-backup-local">
          <PaperCard palette={palette} elevated className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Share2 size={20} color={palette.woodBorder} />
              <h3 className="font-serif font-bold text-xl" style={{ color: palette.textOnPaper }}>
                Backup e Sincronização Local
              </h3>
            </div>
            <span
              className="text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase tracking-wider"
              style={{
                backgroundColor: `${palette.goldPrimary}20`,
                color: palette.goldPrimary,
                border: `1px solid ${palette.goldPrimary}40`,
              }}
            >
              100% Offline
            </span>
          </div>

          <p className="text-xs leading-relaxed" style={{ color: palette.textSecondaryOnPaper }}>
            Salve ou restaure sua biblioteca inteira quando quiser. Funciona diretamente no seu aparelho, sem depender de nuvem de terceiros.
          </p>

          <div
            className="p-2.5 rounded-lg border text-[11px] leading-relaxed flex items-center gap-2"
            style={{
              backgroundColor: palette.paperSurfaceElevated,
              borderColor: `${palette.woodBorder}35`,
            }}
          >
            <Archive size={16} className="shrink-0 text-amber-800" />
            <span>
              <strong>Backup Portátil e Seguro:</strong> Salve o pacote completo (.ZIP) com seus livros e imagens no Google Drive, WhatsApp ou pasta de Downloads do celular.
            </span>
          </div>

          {/* 🌟 BACKUP COMPLETO PORTÁTIL (.ZIP COM CAPAS) */}
          <div
            className="p-3.5 rounded-xl border flex flex-col gap-3 shadow-xs"
            style={{
              backgroundColor: `${palette.goldPrimary}15`,
              borderColor: palette.goldPrimary,
            }}
          >
            <div className="flex items-center justify-between">
              <span className="font-serif font-bold text-sm flex items-center gap-2" style={{ color: palette.textOnPaper }}>
                <Archive size={18} className="text-amber-800" />
                Backup Completo Portátil (.ZIP)
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase tracking-wider bg-amber-800 text-white">
                Recomendado
              </span>
            </div>

            <p className="text-xs leading-relaxed" style={{ color: palette.textOnPaper }}>
              Exporta sua biblioteca inteira com <strong>manifesto estruturado, banco de livros e todos os arquivos de capas físicas</strong>. Compatível entre Android, iOS e Web.
            </p>

            {/* Progresso de exportação ou restauração do ZIP */}
            {(isGeneratingZip || isRestoringZip) && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-black/5 border border-black/10 text-xs font-serif font-bold animate-pulse">
                <Loader2 size={16} className="animate-spin text-amber-900 shrink-0" />
                <span>{zipProgress || 'Processando arquivo ZIP...'}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleExportZip}
                disabled={isGeneratingZip || isRestoringZip}
                className="py-3 px-3.5 rounded-xl font-serif font-bold text-xs flex items-center justify-center gap-2 shadow-md cursor-pointer hover:brightness-105 active:scale-98 transition-all disabled:opacity-60"
                style={{ backgroundColor: palette.goldPrimary, color: palette.textOnGold }}
              >
                <Download size={16} />
                Exportar Backup Completo (.ZIP)
              </button>

              <button
                type="button"
                onClick={() => zipFileInputRef.current?.click()}
                disabled={isGeneratingZip || isRestoringZip}
                className="py-3 px-3.5 rounded-xl font-serif font-bold text-xs flex items-center justify-center gap-2 shadow-sm cursor-pointer hover:brightness-105 active:scale-98 transition-all text-white disabled:opacity-60"
                style={{ backgroundColor: palette.woodBorder }}
              >
                <Upload size={16} />
                Restaurar Backup (.ZIP)
              </button>

              <input
                ref={zipFileInputRef}
                type="file"
                accept=".zip,application/zip,application/x-zip-compressed,application/json,text/json,.json"
                className="hidden"
                onChange={handleSelectZipFile}
              />
            </div>
          </div>



            {/* Gerenciamento / Limpar Tudo */}
            <div className="pt-2.5 mt-1 border-t border-black/10 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-serif font-bold text-red-900">
                  <Trash2 size={14} className="text-red-600" />
                  <span>Gerenciamento da Estante</span>
                </div>
                <span className="text-[11px] font-mono opacity-70" style={{ color: palette.textSecondaryOnPaper }}>
                  {books.length} {books.length === 1 ? 'livro salvo' : 'livros salvos'}
                </span>
              </div>

              <div
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border"
                style={{
                  backgroundColor: '#ef44440a',
                  borderColor: '#ef444430',
                }}
              >
                <div className="text-xs font-serif flex flex-col gap-0.5">
                  <span className="font-bold text-red-950">Limpar Tudo</span>
                  <span className="text-[11px] opacity-80" style={{ color: palette.textOnPaper }}>
                    Apaga todos os livros locais da estante para recomeçar sua biblioteca do zero.
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setIsClearModalOpen(true)}
                  disabled={books.length === 0}
                  className="px-3.5 py-2 rounded-lg font-serif font-bold text-xs flex items-center justify-center gap-1.5 border border-red-300 bg-red-100/90 text-red-900 hover:bg-red-200 active:scale-95 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0 shadow-xs"
                >
                  <Trash2 size={14} className="text-red-700" />
                  <span>Limpar Tudo</span>
                </button>
              </div>
            </div>
          </PaperCard>
        </div>

        {/* Sobre o App */}
        <div className="text-center py-4 flex flex-col items-center gap-2">
          <MaShelfLogo size={44} />
          <span
            className="font-serif font-bold text-lg"
            style={{ color: palette.goldPrimary }}
          >
            Minha Estante · v1.0.0 (Build 20)
          </span>
          <span
            className="text-xs opacity-80"
            style={{ color: palette.textSecondaryOnWood }}
          >
            {t.settings.footerText}
          </span>
        </div>
      </div>
    </div>
  );
};
