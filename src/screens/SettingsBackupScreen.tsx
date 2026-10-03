import React, { useState, useRef } from 'react';
import { ViewMode, GroupByMode } from '../types/book';
import { WoodPalette } from '../theme/woodTheme';
import { WoodTopAppBar } from '../components/WoodTopAppBar';
import { PaperCard } from '../components/PaperCard';
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
}) => {
  const [showImportDialog, setShowImportDialog] = useState<'csv' | 'json' | null>(null);
  const [importText, setImportText] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isUsbGuideOpen, setIsUsbGuideOpen] = useState(false);
  const [copiedAdb, setCopiedAdb] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCopyAdb = () => {
    navigator.clipboard.writeText('adb install -r minha-estante.apk');
    setCopiedAdb(true);
    setTimeout(() => setCopiedAdb(false), 2500);
  };

  const handleDownloadApk = () => {
    const a = document.createElement('a');
    a.href = '/minha-estante.apk?v=' + Date.now();
    a.download = 'minha-estante.apk';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setStatusMessage('Download do .APK iniciado!');
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const downloadFile = (content: string, filename: string, mimeType: string) => {
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
      setStatusMessage(`Arquivo ${filename} baixado com sucesso!`);
      setTimeout(() => setStatusMessage(null), 3000);
    } catch {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(content);
      setStatusMessage('Conteúdo copiado para a área de transferência!');
      setTimeout(() => setStatusMessage(null), 3000);
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

            <div className="mb-3">
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
                className="px-3 py-1.5 rounded-lg border text-xs font-serif font-semibold cursor-pointer hover:bg-black/5"
                style={{ borderColor: palette.woodBorder }}
              >
                Escolher arquivo do computador...
              </button>
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
                  Versão 2.1 compilada e assinada na raiz do projeto
                </p>
              </div>
            </div>

            <span
              className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider"
              style={{
                backgroundColor: `${palette.goldPrimary}20`,
                color: palette.goldPrimary,
                border: `1px solid ${palette.goldPrimary}40`,
              }}
            >
              v2.1 .apk
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
                  Baixe o arquivo <strong>minha-estante.apk</strong> (ou use o arquivo já existente na raiz do projeto).
                </li>
                <li>Abra o terminal na pasta do arquivo e execute o comando:</li>
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

        {/* Backup e Sincronização Local */}
        <PaperCard palette={palette} elevated className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Share2 size={20} color={palette.woodBorder} />
            <h3 className="font-serif font-bold text-xl" style={{ color: palette.textOnPaper }}>
              Backup e Sincronização Local
            </h3>
          </div>
          <p className="text-xs leading-relaxed" style={{ color: palette.textSecondaryOnPaper }}>
            Exporte todos os seus livros em CSV (compatível com Excel e Google Sheets) ou JSON completo para restaurar quando quiser.
          </p>

          <div className="grid grid-cols-2 gap-2.5 mt-2">
            <button
              type="button"
              onClick={handleExportCsv}
              className="py-2.5 px-3 rounded-lg font-serif font-semibold text-xs flex items-center justify-center gap-1.5 shadow-sm cursor-pointer hover:brightness-105 text-white"
              style={{ backgroundColor: palette.woodBorder }}
            >
              <Download size={15} />
              Exportar CSV
            </button>

            <button
              type="button"
              onClick={handleExportJson}
              className="py-2.5 px-3 rounded-lg font-serif font-semibold text-xs flex items-center justify-center gap-1.5 shadow-sm cursor-pointer hover:brightness-105 text-white"
              style={{ backgroundColor: palette.woodBorder }}
            >
              <Download size={15} />
              Backup JSON
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setShowImportDialog('csv')}
              className="py-2 px-3 rounded-lg font-serif font-semibold text-xs flex items-center justify-center gap-1.5 border cursor-pointer hover:bg-black/5"
              style={{ borderColor: palette.woodBorder, color: palette.textOnPaper }}
            >
              <Upload size={14} />
              Importar CSV
            </button>

            <button
              type="button"
              onClick={() => setShowImportDialog('json')}
              className="py-2 px-3 rounded-lg font-serif font-semibold text-xs flex items-center justify-center gap-1.5 border cursor-pointer hover:bg-black/5"
              style={{ borderColor: palette.woodBorder, color: palette.textOnPaper }}
            >
              <Upload size={14} />
              Restaurar JSON
            </button>
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
