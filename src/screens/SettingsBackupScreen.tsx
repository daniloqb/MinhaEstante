import React, { useState, useRef } from 'react';
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
  Usb,
  Terminal,
  Check,
  Copy,
  ExternalLink,
  Clipboard,
  HelpCircle,
  ShieldCheck,
  FileText,
  Image as ImageIcon,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { PWAInstallButton } from '../components/PWAInstallButton';

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
  onExportCsv: () => string;
  onExportJson: () => string;
  onImportCsv: (csvContent: string) => { count: number };
  onImportJson: (jsonContent: string) => { count: number };
  books?: Book[];
  onUpdateAllBooks?: (books: Book[]) => void;
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
  onExportCsv,
  onExportJson,
  onImportCsv,
  onImportJson,
  books = [],
  onUpdateAllBooks,
}) => {
  const [showImportDialog, setShowImportDialog] = useState<'csv' | 'json' | null>(null);
  const [importText, setImportText] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isUsbGuideOpen, setIsUsbGuideOpen] = useState(false);
  const [isPermissionGuideOpen, setIsPermissionGuideOpen] = useState(false);
  const [copiedAdb, setCopiedAdb] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [isBatchCaching, setIsBatchCaching] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleCopyAdb = () => {
    navigator.clipboard.writeText('adb install -r minha-estante.apk');
    setCopiedAdb(true);
    setTimeout(() => setCopiedAdb(false), 2500);
  };

  const handleDownloadApk = () => {
    const a = document.createElement('a');
    a.href = '/minha-estante.apk?v=3.0.' + Date.now();
    a.download = 'minha-estante.apk';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setStatusMessage('Download do .APK v3.0 iniciado!');
    setTimeout(() => setStatusMessage(null), 3500);
  };

  const downloadFile = async (content: string, filename: string, mimeType: string) => {
    // 1. Android Native App Bridge (dentro do APK compilado)
    const win = window as any;
    if (win.AndroidApp && typeof win.AndroidApp.saveOrShareFile === 'function') {
      try {
        win.AndroidApp.saveOrShareFile(content, filename, mimeType);
        setStatusMessage(`Abrindo opções de salvamento para "${filename}"...`);
        setTimeout(() => setStatusMessage(null), 3500);
        return;
      } catch (err) {
        console.warn('Erro ao invocar bridge Android:', err);
      }
    }

    // 2. Web Share API para mobile (PWA ou navegadores que suportam envio de arquivos)
    if (navigator.share) {
      try {
        const file = new File([content], filename, { type: mimeType });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: filename,
            text: `Backup Minha Estante: ${filename}`,
          });
          setStatusMessage('Arquivo compartilhado com sucesso!');
          setTimeout(() => setStatusMessage(null), 3000);
          return;
        }
      } catch (e: any) {
        if (e.name === 'AbortError') return;
      }
    }

    // 3. Download convencional via Blob
    try {
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatusMessage(`Arquivo ${filename} salvo com sucesso!`);
      setTimeout(() => setStatusMessage(null), 3000);
    } catch {
      // 4. Fallback absoluto: copia para a área de transferência
      try {
        await navigator.clipboard.writeText(content);
        setStatusMessage('Conteúdo do backup copiado para a Área de Transferência!');
        setTimeout(() => setStatusMessage(null), 3500);
      } catch {
        setStatusMessage('Não foi possível salvar o arquivo.');
      }
    }
  };

  const handleExportCsv = () => {
    const csv = onExportCsv();
    downloadFile(csv, `minha_estante_${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8;');
  };

  const handleExportJson = () => {
    const json = onExportJson();
    downloadFile(json, `minha_estante_backup_${new Date().toISOString().slice(0, 10)}.json`, 'application/json');
  };

  const handleCopyJsonToClipboard = async () => {
    try {
      const json = onExportJson();
      await navigator.clipboard.writeText(json);
      setCopiedJson(true);
      setStatusMessage('JSON copiado! Cole no Google Drive, WhatsApp ou Bloco de Notas.');
      setTimeout(() => {
        setCopiedJson(false);
        setStatusMessage(null);
      }, 4000);
    } catch {
      setStatusMessage('Erro ao acessar a área de transferência.');
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        setImportText(text.trim());
        setStatusMessage('Texto colado da Área de Transferência!');
        setTimeout(() => setStatusMessage(null), 3000);
      } else {
        alert('A área de transferência está vazia. Copie o texto do backup primeiro.');
      }
    } catch {
      alert('Não foi possível ler automaticamente a área de transferência. Por favor, toque e segure na caixa de texto abaixo e toque em "Colar".');
    }
  };

  const handleImportSubmit = () => {
    try {
      if (!importText.trim()) return;
      if (showImportDialog === 'csv') {
        const { count } = onImportCsv(importText);
        setStatusMessage(`${count} livros importados via CSV com sucesso!`);
      } else {
        const { count } = onImportJson(importText);
        setStatusMessage(`${count} livros restaurados do JSON com sucesso!`);
      }
      setShowImportDialog(null);
      setImportText('');
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (e: any) {
      alert(`Erro ao importar: ${e.message}`);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setImportText(content);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex flex-col w-full flex-1">
      <WoodTopAppBar palette={palette} title="Configurações & Backup" />

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

      {/* Modal de Importação */}
      {showImportDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          onClick={() => {
            setShowImportDialog(null);
            setImportText('');
          }}
        >
          <div
            className="w-full max-w-lg rounded-2xl p-6 shadow-2xl border"
            style={{
              backgroundColor: palette.paperSurface,
              borderColor: palette.woodBorder,
              color: palette.textOnPaper,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: `${palette.woodBorder}40` }}>
              <h3 className="font-serif font-bold text-xl" style={{ color: palette.textOnPaper }}>
                {showImportDialog === 'csv' ? 'Importar Livros via CSV' : 'Restaurar Backup JSON'}
              </h3>
              <button
                onClick={() => {
                  setShowImportDialog(null);
                  setImportText('');
                }}
                className="p-1 rounded-full hover:bg-black/10 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs leading-relaxed my-3" style={{ color: palette.textSecondaryOnPaper }}>
              {showImportDialog === 'csv'
                ? 'Cole o conteúdo do CSV abaixo ou selecione um arquivo. As colunas suportadas incluem: titulo, autor, ano_leitura, mes_leitura, nota, paginas, status.'
                : 'Cole o JSON completo exportado anteriormente ou selecione o arquivo de backup:'}
            </p>

            <div className="flex flex-wrap items-center gap-2 mb-3">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept={showImportDialog === 'csv' ? '.csv,text/csv' : '.json,application/json'}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 min-w-[150px] px-3 py-2 rounded-lg border text-xs font-serif font-bold flex items-center justify-center gap-1.5 cursor-pointer hover:bg-black/5"
                style={{ borderColor: palette.woodBorder, color: palette.textOnPaper }}
              >
                <FileText size={14} />
                Escolher Arquivo do Dispositivo
              </button>

              <button
                type="button"
                onClick={handlePasteFromClipboard}
                className="px-3 py-2 rounded-lg border text-xs font-serif font-bold flex items-center justify-center gap-1.5 cursor-pointer hover:bg-black/5"
                style={{
                  borderColor: palette.goldPrimary,
                  color: palette.woodBorder,
                  backgroundColor: `${palette.goldPrimary}15`,
                }}
              >
                <Clipboard size={14} />
                Colar da Área de Transferência
              </button>
            </div>

            <div className="p-2.5 rounded-lg bg-amber-900/10 text-[11px] leading-relaxed mb-3 flex items-start gap-2 text-stone-700">
              <ShieldCheck size={16} className="shrink-0 text-amber-700 mt-0.5" />
              <span>
                <strong>Sem necessidade de permissões manuais:</strong> Você pode selecionar o arquivo ou simplesmente copiar o texto do backup de onde você guardou (WhatsApp, Google Drive ou Bloco de Notas) e tocar em <em>"Colar da Área de Transferência"</em> acima!
              </span>
            </div>

            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={
                showImportDialog === 'csv'
                  ? 'titulo,autor,ano,mes,nota\nDom Casmurro,Machado de Assis,2026,5,10'
                  : '[\n  {\n    "titulo": "..."\n  }\n]'
              }
              rows={6}
              className="w-full px-3 py-2 rounded-lg border text-xs font-mono focus:outline-none focus:ring-1 resize-none"
              style={{
                backgroundColor: palette.paperSurfaceElevated,
                borderColor: palette.woodBorder,
                color: palette.textOnPaper,
              }}
            />

            <div className="flex items-center justify-end gap-2 pt-4">
              <button
                type="button"
                onClick={() => {
                  setShowImportDialog(null);
                  setImportText('');
                }}
                className="px-4 py-2 rounded-lg font-serif text-xs border cursor-pointer"
                style={{ borderColor: palette.woodBorder, color: palette.textOnPaper }}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!importText.trim()}
                onClick={handleImportSubmit}
                className="px-5 py-2 rounded-lg font-serif font-bold text-xs shadow-sm cursor-pointer disabled:opacity-50"
                style={{
                  backgroundColor: palette.goldPrimary,
                  color: palette.textOnGold,
                }}
              >
                Importar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Conteúdo Principal */}
      <div className="flex-1 w-full max-w-2xl mx-auto px-4 py-6 flex flex-col gap-5 pb-16">
        {/* Instalação no Android (.APK / Cabo USB) */}
        <PaperCard palette={palette} elevated className="flex flex-col gap-3.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-lg bg-amber-900/10 text-xl flex items-center justify-center">
                🤖
              </span>
              <div>
                <h3 className="font-serif font-bold text-lg leading-tight" style={{ color: palette.textOnPaper }}>
                  Instalar no Android (.APK & Via USB)
                </h3>
                <p className="text-xs font-serif" style={{ color: palette.textSecondaryOnPaper }}>
                  Versão 3.0 compilada com E-books, Texturas, Resumos com IA e Onde Comprar
                </p>
              </div>
            </div>

            <span
              className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider"
              style={{
                backgroundColor: `${palette.goldPrimary}20`,
                color: palette.goldPrimary,
                border: `1px solid ${palette.goldPrimary}40`,
              }}
            >
              v3.0 Atualizado .apk
            </span>
          </div>

          <p className="text-xs leading-relaxed" style={{ color: palette.textOnPaper }}>
            Você pode baixar o arquivo <strong>.apk</strong> diretamente para instalar no celular ou conectar o aparelho via cabo USB ao computador e instalar com depuração USB (ADB).
          </p>

          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={handleDownloadApk}
              className="flex-1 min-w-[140px] py-2.5 px-4 rounded-xl font-serif font-bold text-xs shadow-md flex items-center justify-center gap-2 cursor-pointer hover:brightness-105 active:scale-98 transition-all"
              style={{
                backgroundColor: palette.goldPrimary,
                color: palette.textOnGold,
              }}
              title="Baixar minha-estante.apk diretamente no computador ou celular"
            >
              <Download size={15} strokeWidth={2.5} />
              Baixar .APK Direto
            </button>

            <button
              type="button"
              onClick={() => setIsUsbGuideOpen(!isUsbGuideOpen)}
              className="flex-1 min-w-[140px] py-2.5 px-4 rounded-xl font-serif font-bold text-xs border flex items-center justify-center gap-2 cursor-pointer hover:bg-black/5 active:scale-98 transition-all"
              style={{
                borderColor: palette.woodBorder,
                color: palette.textOnPaper,
                backgroundColor: isUsbGuideOpen ? `${palette.goldPrimary}25` : 'transparent',
              }}
              title="Ver instruções para instalação via cabo USB com ADB"
            >
              <Usb size={15} />
              {isUsbGuideOpen ? 'Ocultar Guia USB' : 'Instalar via USB (ADB)'}
            </button>
          </div>

          {/* Painel com Instruções e Linha de Comando para Instalação via Cabo USB */}
          {isUsbGuideOpen && (
            <div
              className="p-3.5 rounded-xl border flex flex-col gap-3 text-xs animate-in fade-in slide-in-from-top-2 duration-200 mt-1"
              style={{
                backgroundColor: palette.paperSurfaceElevated,
                borderColor: `${palette.woodBorder}50`,
              }}
            >
              <div className="flex items-center gap-2 font-serif font-bold text-xs" style={{ color: palette.woodBorder }}>
                <Terminal size={15} />
                <span>Instalação rápida via Cabo USB (ADB):</span>
              </div>

              <ol className="list-decimal list-inside space-y-1.5 text-xs leading-relaxed" style={{ color: palette.textOnPaper }}>
                <li>Conecte o smartphone Android ao computador usando o <strong>cabo USB</strong>.</li>
                <li>
                  No celular, ative a <strong>Depuração USB</strong> em:{' '}
                  <em>Configurações &gt; Opções do Desenvolvedor &gt; Depuração USB</em>.
                </li>
                <li>
                  Baixe o arquivo <strong>minha-estante.apk</strong> (ou use o arquivo na raiz do projeto).
                </li>
                <li>Abra o terminal na pasta do arquivo e execute:</li>
              </ol>

              {/* Bloco de Comando com botão Copiar */}
              <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-black/90 text-emerald-400 font-mono text-xs shadow-inner">
                <span className="select-all break-all">adb install -r minha-estante.apk</span>
                <button
                  type="button"
                  onClick={handleCopyAdb}
                  className="px-2.5 py-1 rounded bg-white/15 hover:bg-white/25 text-white font-sans text-[11px] font-bold flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors"
                >
                  {copiedAdb ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                  {copiedAdb ? 'Copiado!' : 'Copiar'}
                </button>
              </div>

              {/* Dica para erro INSTALL_PARSE_FAILED_NOT_APK */}
              <div className="p-2.5 rounded-lg border bg-amber-500/10 border-amber-500/30 flex flex-col gap-1 text-[11px] text-amber-950">
                <span className="font-bold flex items-center gap-1">
                  ⚠️ Deu erro INSTALL_PARSE_FAILED_NOT_APK?
                </span>
                <p className="leading-snug">
                  Isso acontece quando há uma versão anterior instalada com assinatura ou cache conflitante. Execute para limpar e reinstalar:
                </p>
                <code className="p-1.5 rounded bg-black/80 text-emerald-400 font-mono text-[10.5px] select-all break-all">
                  adb uninstall com.aistudio.minhaestante.vbrkxp &amp;&amp; adb install minha-estante.apk
                </code>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1 border-t border-black/10 text-[11px]">
                <span className="text-stone-500">
                  Sem terminal? Use o instalador no navegador:
                </span>
                <a
                  href="https://webadb.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-serif font-bold underline flex items-center gap-1 hover:opacity-80"
                  style={{ color: palette.goldPrimary }}
                >
                  Abrir WebADB <ExternalLink size={11} />
                </a>
              </div>
            </div>
          )}
        </PaperCard>

        {/* Instalação no Smartphone */}
        <PWAInstallButton variant="card" palette={palette} />

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

        {/* Chave da API Google Books */}
        <PaperCard palette={palette} elevated className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Key size={20} color={palette.woodBorder} />
            <h3 className="font-serif font-bold text-xl" style={{ color: palette.textOnPaper }}>
              Chave da API Google Books (Opcional)
            </h3>
          </div>
          <p className="text-xs leading-relaxed" style={{ color: palette.textSecondaryOnPaper }}>
            A busca já funciona gratuitamente sem chave. Adicione sua chave pessoal caso atinja o limite público de requisições.
          </p>

          <input
            type="text"
            value={apiKey}
            onChange={(e) => onApiKeyChange(e.target.value)}
            placeholder="AIzaSy..."
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

          {/* Opções de Exportação e Backup */}
          <div className="flex flex-col gap-2.5 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleExportJson}
                className="py-2.5 px-3 rounded-lg font-serif font-bold text-xs flex items-center justify-center gap-1.5 shadow-md cursor-pointer hover:brightness-105 active:scale-98 transition-all"
                style={{ backgroundColor: palette.goldPrimary, color: palette.textOnGold }}
              >
                <Download size={15} />
                Salvar / Compartilhar Backup JSON
              </button>

              <button
                type="button"
                onClick={handleCopyJsonToClipboard}
                className="py-2.5 px-3 rounded-lg font-serif font-bold text-xs flex items-center justify-center gap-1.5 border shadow-xs cursor-pointer hover:bg-black/5 active:scale-98 transition-all"
                style={{ borderColor: palette.woodBorder, color: palette.textOnPaper }}
              >
                {copiedJson ? <Check size={15} className="text-emerald-600" /> : <Copy size={15} />}
                {copiedJson ? 'JSON Copiado!' : 'Copiar Texto JSON (Sem arquivo)'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={handleExportCsv}
                className="py-2 px-3 rounded-lg font-serif font-semibold text-xs flex items-center justify-center gap-1.5 border cursor-pointer hover:bg-black/5"
                style={{ borderColor: palette.woodBorder, color: palette.textOnPaper }}
              >
                <FileText size={14} />
                Exportar CSV
              </button>

              <button
                type="button"
                onClick={() => setShowImportDialog('json')}
                className="py-2 px-3 rounded-lg font-serif font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer hover:brightness-105 text-white"
                style={{ backgroundColor: palette.woodBorder }}
              >
                <Upload size={14} />
                Restaurar JSON
              </button>

              <button
                type="button"
                onClick={() => setShowImportDialog('csv')}
                className="py-2 px-3 rounded-lg font-serif font-semibold text-xs flex items-center justify-center gap-1.5 border cursor-pointer hover:bg-black/5"
                style={{ borderColor: palette.woodBorder, color: palette.textOnPaper }}
              >
                <Upload size={14} />
                Importar CSV
              </button>
            </div>
          </div>

          {/* Dúvidas e Ajuda com Permissões no Celular */}
          <div className="pt-2 border-t border-black/10">
            <button
              type="button"
              onClick={() => setIsPermissionGuideOpen(!isPermissionGuideOpen)}
              className="text-xs font-serif font-bold flex items-center justify-between w-full text-left py-1 hover:opacity-80 cursor-pointer"
              style={{ color: palette.woodBorder }}
            >
              <span className="flex items-center gap-1.5">
                <HelpCircle size={15} />
                Dúvidas sobre Permissões de Arquivos no Celular?
              </span>
              <span className="text-[11px] underline">
                {isPermissionGuideOpen ? 'Ocultar' : 'Ver como funciona'}
              </span>
            </button>

            {isPermissionGuideOpen && (
              <div
                className="p-3.5 rounded-xl border flex flex-col gap-2 text-xs animate-in fade-in slide-in-from-top-1 duration-200 mt-2"
                style={{
                  backgroundColor: palette.paperSurfaceElevated,
                  borderColor: `${palette.woodBorder}40`,
                  color: palette.textOnPaper,
                }}
              >
                <p className="font-semibold text-stone-800">
                  Por que a permissão de armazenamento não aparece nas configurações do Android?
                </p>
                <ul className="list-disc list-inside space-y-1.5 text-xs text-stone-700 leading-relaxed">
                  <li>
                    <strong>Novo padrão do Android (Scoped Storage):</strong> Em versões modernas do Android (11, 12, 13 e 14), o Google substituiu a permissão de "Acesso total à memória". O sistema abre diretamente a tela segura de arquivos ou o menu de compartilhamento.
                  </li>
                  <li>
                    <strong>No novo APK (v2.4):</strong> O seletor de arquivos e a permissão de armazenamento foram ativados.
                  </li>
                  <li>
                    <strong>Método mais simples (Sem precisar de arquivo):</strong>
                    <br />
                    1. Toque em <strong>"Copiar Texto JSON"</strong> acima.
                    <br />
                    2. Cole no seu WhatsApp, bloco de notas ou Google Drive.
                    <br />
                    3. Para restaurar, basta abrir <strong>"Restaurar JSON"</strong> e tocar em <strong>"Colar da Área de Transferência"</strong>!
                  </li>
                </ul>
              </div>
            )}
          </div>
        </PaperCard>

        {/* Sobre o App */}
        <div className="text-center py-4 flex flex-col items-center">
          <span
            className="font-serif font-bold text-lg"
            style={{ color: palette.goldPrimary }}
          >
            Minha Estante
          </span>
          <span
            className="text-xs mt-0.5 opacity-80"
            style={{ color: palette.textSecondaryOnWood }}
          >
            Registro clássico de leituras · 100% Offline & Seguro
          </span>
        </div>
      </div>
    </div>
  );
};
