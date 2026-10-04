import React, { useState } from 'react';
import { WoodPalette } from '../theme/woodTheme';
import { usePWAInstall } from '../hooks/usePWAInstall';
import {
  Smartphone,
  Download,
  Share,
  PlusSquare,
  CheckCircle2,
  Copy,
  Check,
  X,
  ExternalLink,
  Usb,
  Terminal,
} from 'lucide-react';

interface PWAInstallModalProps {
  palette: WoodPalette;
  isOpen: boolean;
  onDismiss: () => void;
}

export const PWAInstallModal: React.FC<PWAInstallModalProps> = ({
  palette,
  isOpen,
  onDismiss,
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [copied, setCopied] = useState(false);
  const [copiedAdb, setCopiedAdb] = useState(false);
  const [showUsbDetails, setShowUsbDetails] = useState(false);
  const [installSuccess, setInstallSuccess] = useState(false);

  if (!isOpen) return null;

  // URL para abrir no celular
  const currentAppUrl =
    typeof window !== 'undefined' && window.location.href.includes('http')
      ? window.location.href
      : 'https://ais-pre-g2mb5tva336oymqwbu2x5e-445986927053.us-west2.run.app';

  const handleInstallClick = async () => {
    const success = await install();
    if (success) {
      setInstallSuccess(true);
      setTimeout(() => {
        onDismiss();
      }, 2000);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(currentAppUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleCopyAdb = () => {
    navigator.clipboard.writeText('adb install -r minha-estante.apk');
    setCopiedAdb(true);
    setTimeout(() => setCopiedAdb(false), 2500);
  };

  const handleDownloadApk = (e: React.MouseEvent) => {
    e.preventDefault();
    const link = document.createElement('a');
    link.href = '/minha-estante.apk?v=' + Date.now();
    link.download = 'minha-estante.apk';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn"
      onClick={onDismiss}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 shadow-2xl border max-h-[90vh] overflow-y-auto"
        style={{
          backgroundColor: palette.paperSurface,
          borderColor: palette.woodBorder,
          color: palette.textOnPaper,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div
          className="flex items-center justify-between pb-3 border-b"
          style={{ borderColor: `${palette.woodBorder}40` }}
        >
          <div className="flex items-center gap-2.5">
            <span
              className="p-2 rounded-xl flex items-center justify-center"
              style={{
                backgroundColor: `${palette.goldPrimary}25`,
                color: palette.woodBorder,
              }}
            >
              <Smartphone size={22} />
            </span>
            <div>
              <h2
                className="font-serif font-bold text-xl leading-tight"
                style={{ color: palette.textOnPaper }}
              >
                Instalar no Smartphone
              </h2>
              <p
                className="text-xs font-serif italic"
                style={{ color: palette.textSecondaryOnPaper }}
              >
                App nativo, rápido e sem anúncios
              </p>
            </div>
          </div>
          <button
            onClick={onDismiss}
            className="p-1 rounded-full hover:bg-black/10 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="py-4 flex flex-col gap-4">
          {isInstalled || installSuccess ? (
            <div
              className="p-4 rounded-xl flex items-center gap-3 border"
              style={{
                backgroundColor: '#10b98115',
                borderColor: '#10b98160',
                color: '#065f46',
              }}
            >
              <CheckCircle2 size={24} className="shrink-0 text-emerald-600" />
              <div>
                <p className="font-serif font-bold text-sm">Aplicativo já instalado!</p>
                <p className="text-xs">
                  O Minha Estante já está pronto na sua tela inicial como um app nativo.
                </p>
              </div>
            </div>
          ) : isInstallable ? (
            /* Botão de Instalação Direta (Android Chrome / Edge / navegadores compatíveis) */
            <div className="flex flex-col gap-3">
              <div
                className="p-3.5 rounded-xl border flex items-start gap-3"
                style={{
                  backgroundColor: `${palette.goldPrimary}15`,
                  borderColor: `${palette.goldPrimary}60`,
                }}
              >
                <Download size={20} className="shrink-0 mt-0.5" style={{ color: palette.woodBorder }} />
                <p className="text-xs leading-relaxed" style={{ color: palette.textOnPaper }}>
                  Seu navegador permite a instalação direta com 1 toque. O app funcionará em tela cheia,
                  com ícone na gaveta de aplicativos e inicialização rápida.
                </p>
              </div>

              <button
                type="button"
                onClick={handleInstallClick}
                className="w-full py-3 px-4 rounded-xl font-serif font-bold text-base shadow-md flex items-center justify-center gap-2 cursor-pointer hover:brightness-105 active:scale-98 transition-all"
                style={{
                  backgroundColor: palette.goldPrimary,
                  color: palette.textOnGold,
                }}
              >
                <Download size={18} strokeWidth={2.5} />
                Instalar Aplicativo Agora
              </button>
            </div>
          ) : isIOS ? (
            /* Instruções para iPhone / iPad (Safari) */
            <div className="flex flex-col gap-3">
              <p className="text-xs leading-relaxed" style={{ color: palette.textOnPaper }}>
                No iOS (iPhone/iPad), a Apple permite a instalação através do Safari em apenas 2 passos:
              </p>

              <div
                className="p-3.5 rounded-xl border flex flex-col gap-2.5 text-xs"
                style={{
                  backgroundColor: palette.paperSurfaceElevated,
                  borderColor: `${palette.woodBorder}40`,
                }}
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-black/10 flex items-center justify-center font-bold text-xs shrink-0">
                    1
                  </span>
                  <p className="flex-1">
                    Toque no botão <strong>Compartilhar</strong>{' '}
                    <Share size={14} className="inline mx-1 text-blue-600" /> na barra inferior do Safari.
                  </p>
                </div>

                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-black/10 flex items-center justify-center font-bold text-xs shrink-0">
                    2
                  </span>
                  <p className="flex-1">
                    Role as opções e toque em{' '}
                    <strong>Adicionar à Tela de Início</strong>{' '}
                    <PlusSquare size={14} className="inline mx-1 text-stone-700" />.
                  </p>
                </div>

                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-black/10 flex items-center justify-center font-bold text-xs shrink-0">
                    3
                  </span>
                  <p className="flex-1">
                    Confirme em <strong>Adicionar</strong> no canto superior direito.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* Guia Geral (Chrome no Android ou abrindo no celular a partir de outro dispositivo) */
            <div className="flex flex-col gap-3">
              <p className="text-xs leading-relaxed" style={{ color: palette.textOnPaper }}>
                Para instalar no seu smartphone Android ou iPhone:
              </p>

              {/* Guia Android */}
              <div
                className="p-3 rounded-xl border text-xs"
                style={{
                  backgroundColor: palette.paperSurfaceElevated,
                  borderColor: `${palette.woodBorder}30`,
                }}
              >
                <strong className="block mb-1 font-serif text-sm" style={{ color: palette.woodBorder }}>
                  📱 No Android (Google Chrome):
                </strong>
                <ol className="list-decimal list-inside space-y-1 text-xs">
                  <li>Abra o link do aplicativo no Chrome do celular.</li>
                  <li>
                    Toque nos <strong>três pontinhos (⋮)</strong> no canto superior direito.
                  </li>
                  <li>
                    Selecione <strong>&ldquo;Instalar aplicativo&rdquo;</strong> ou{' '}
                    <strong>&ldquo;Adicionar à tela inicial&rdquo;</strong>.
                  </li>
                </ol>
              </div>

              {/* Guia iPhone */}
              <div
                className="p-3 rounded-xl border text-xs"
                style={{
                  backgroundColor: palette.paperSurfaceElevated,
                  borderColor: `${palette.woodBorder}30`,
                }}
              >
                <strong className="block mb-1 font-serif text-sm" style={{ color: palette.woodBorder }}>
                  🍎 No iPhone (Safari):
                </strong>
                <ol className="list-decimal list-inside space-y-1 text-xs">
                  <li>Abra o link no Safari do iPhone.</li>
                  <li>Toque no ícone de Compartilhar (quadrado com seta para cima).</li>
                  <li>Selecione &ldquo;Adicionar à Tela de Início&rdquo;.</li>
                </ol>
              </div>
            </div>
          )}

          {/* Link para copiar e abrir no celular */}
          <div className="pt-2 border-t" style={{ borderColor: `${palette.woodBorder}30` }}>
            <label
              className="block text-[11px] font-serif font-bold uppercase tracking-wider mb-1.5"
              style={{ color: palette.woodBorder }}
            >
              Link do App para o Celular
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={currentAppUrl}
                className="flex-1 px-3 py-2 rounded-lg text-xs font-mono border focus:outline-none"
                style={{
                  backgroundColor: palette.paperSurfaceElevated,
                  borderColor: palette.woodBorder,
                  color: palette.textOnPaper,
                }}
              />
              <button
                type="button"
                onClick={handleCopyLink}
                className="px-3.5 py-2 rounded-lg font-serif font-bold text-xs border flex items-center gap-1.5 shrink-0 cursor-pointer hover:bg-black/5 active:scale-95 transition-all"
                style={{
                  borderColor: palette.woodBorder,
                  color: palette.woodBorder,
                  backgroundColor: copied ? `${palette.goldPrimary}20` : 'transparent',
                }}
                title="Copiar link"
              >
                {copied ? <Check size={14} className="text-emerald-700" /> : <Copy size={14} />}
                {copied ? 'Copiado!' : 'Copiar'}
              </button>
            </div>
          </div>

          {/* Download Direto do APK (.apk Android) & Instalação via USB */}
          <div
            className="p-3.5 rounded-xl border flex flex-col gap-3 mt-1"
            style={{
              backgroundColor: `${palette.goldPrimary}15`,
              borderColor: `${palette.goldPrimary}70`,
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">🤖</span>
                <div>
                  <h4 className="font-serif font-bold text-xs" style={{ color: palette.textOnPaper }}>
                    Arquivo .APK Android (v2.1)
                  </h4>
                  <p className="text-[11px]" style={{ color: palette.textSecondaryOnPaper }}>
                    Pacote nativo assinado na raiz
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleDownloadApk}
                  className="px-3 py-1.5 rounded-lg font-serif font-bold text-xs shadow-sm flex items-center gap-1.5 cursor-pointer hover:brightness-105 active:scale-95 transition-all"
                  style={{
                    backgroundColor: palette.goldPrimary,
                    color: palette.textOnGold,
                  }}
                  title="Baixar arquivo .APK no computador"
                >
                  <Download size={14} />
                  Baixar .APK
                </button>
                <button
                  type="button"
                  onClick={() => setShowUsbDetails(!showUsbDetails)}
                  className="px-2.5 py-1.5 rounded-lg font-serif font-semibold text-xs border flex items-center gap-1 cursor-pointer hover:bg-black/5 active:scale-95 transition-all"
                  style={{
                    borderColor: palette.woodBorder,
                    color: palette.textOnPaper,
                    backgroundColor: showUsbDetails ? `${palette.goldPrimary}30` : 'transparent',
                  }}
                  title="Instalar via cabo USB com ADB"
                >
                  <Usb size={14} />
                  Via USB
                </button>
              </div>
            </div>

            {/* Painel expansível com instruções para instalar via USB */}
            {showUsbDetails && (
              <div
                className="p-3 rounded-lg border flex flex-col gap-2.5 text-xs animate-in fade-in duration-200"
                style={{
                  backgroundColor: palette.paperSurface,
                  borderColor: `${palette.woodBorder}40`,
                }}
              >
                <div className="flex items-center gap-1.5 font-serif font-bold text-xs" style={{ color: palette.woodBorder }}>
                  <Terminal size={14} />
                  <span>Como instalar via Cabo USB (ADB):</span>
                </div>

                <ol className="list-decimal list-inside space-y-1 text-[11px] leading-relaxed" style={{ color: palette.textOnPaper }}>
                  <li>Conecte o smartphone ao computador via <strong>cabo USB</strong>.</li>
                  <li>Ative a <strong>Depuração USB</strong> no celular (em <em>Opções do Desenvolvedor</em>).</li>
                  <li>Baixe o <strong>minha-estante.apk</strong> ou use o arquivo gerado na raiz.</li>
                  <li>Execute o comando no terminal do seu computador:</li>
                </ol>

                <div className="flex items-center gap-1.5 p-2 rounded bg-black/85 text-emerald-400 font-mono text-[11px]">
                  <span className="flex-1 select-all break-all">adb install -r minha-estante.apk</span>
                  <button
                    type="button"
                    onClick={handleCopyAdb}
                    className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-white text-[10px] font-sans font-bold flex items-center gap-1 shrink-0 cursor-pointer transition-colors"
                  >
                    {copiedAdb ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                    {copiedAdb ? 'Copiado!' : 'Copiar'}
                  </button>
                </div>

                <div className="p-2 rounded border bg-amber-500/10 border-amber-500/25 flex flex-col gap-0.5 text-[10.5px] text-amber-950">
                  <span className="font-bold">⚠️ Erro INSTALL_PARSE_FAILED_NOT_APK?</span>
                  <span className="text-[10px] leading-tight">
                    Desinstale a versão anterior conflitante e reinstale:
                  </span>
                  <code className="p-1 rounded bg-black/80 text-emerald-400 font-mono text-[10px] select-all break-all mt-0.5">
                    adb uninstall com.aistudio.minhaestante.vbrkxp &amp;&amp; adb install minha-estante.apk
                  </code>
                </div>

                <p className="text-[10px] text-stone-500 italic">
                  Dica: Você também pode usar ferramentas WebUSB direto pelo navegador Google Chrome (como o{' '}
                  <a
                    href="https://webadb.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline font-semibold hover:opacity-80"
                    style={{ color: palette.goldPrimary }}
                  >
                    WebADB
                  </a>
                  ) para instalar o APK sem precisar de linha de comando.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Rodapé */}
        <div
          className="flex items-center justify-between pt-3 border-t"
          style={{ borderColor: `${palette.woodBorder}40` }}
        >
          <a
            href={currentAppUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-serif font-semibold underline flex items-center gap-1 hover:opacity-80"
            style={{ color: palette.textSecondaryOnPaper }}
          >
            Abrir em nova aba <ExternalLink size={12} />
          </a>

          <button
            type="button"
            onClick={onDismiss}
            className="px-4 py-1.5 rounded-lg font-serif font-bold text-xs border cursor-pointer hover:bg-black/5 active:scale-95"
            style={{
              borderColor: palette.woodBorder,
              color: palette.textOnPaper,
            }}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
