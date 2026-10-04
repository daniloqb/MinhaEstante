import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { WoodPalette } from '../theme/woodTheme';
import { Camera, X, RefreshCw, Upload, AlertCircle, CheckCircle2, Zap } from 'lucide-react';

interface BarcodeScannerModalProps {
  palette: WoodPalette;
  isOpen: boolean;
  onDismiss: () => void;
  onDetected: (barcode: string) => void;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  palette,
  isOpen,
  onDismiss,
  onDetected,
}) => {
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [detectedCode, setDetectedCode] = useState<string | null>(null);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [selectedCameraIndex, setSelectedCameraIndex] = useState<number>(0);
  const [manualIsbn, setManualIsbn] = useState<string>('');

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isStoppingRef = useRef<boolean>(false);

  // Sintetizador de bip de confirmação via Web Audio
  const playBeep = useCallback(() => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // Tom lá agudo agradável
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } catch {
      // Ignorar caso o navegador restrinja áudio
    }
  }, []);

  const handleScanSuccess = useCallback(
    (decodedText: string) => {
      if (isStoppingRef.current || detectedCode) return;
      const clean = decodedText.trim().replace(/[-\s]/g, '');

      // Aceita códigos comuns de livros (EAN-13, ISBN-10, UPC)
      if (clean.length >= 8 && clean.length <= 14) {
        isStoppingRef.current = true;
        setDetectedCode(clean);
        playBeep();
        if (navigator.vibrate) {
          try {
            navigator.vibrate([100, 50, 100]);
          } catch {}
        }

        // Parar o leitor de forma assíncrona segura
        const finish = async () => {
          try {
            if (scannerRef.current && (scannerRef.current as any).isScanning) {
              await scannerRef.current.stop().catch(() => {});
            }
          } catch {}

          // Pequeno timeout para o usuário visualizar o feedback verde
          setTimeout(() => {
            onDetected(clean);
            onDismiss();
          }, 350);
        };

        finish();
      }
    },
    [detectedCode, onDetected, onDismiss, playBeep]
  );

  // Iniciar scanner
  const startScanner = useCallback(
    async (cameraId?: string) => {
      try {
        setIsInitializing(true);
        setScannerError(null);
        isStoppingRef.current = false;

        const viewportEl = document.getElementById('barcode-camera-viewport');
        if (!viewportEl) {
          setIsInitializing(false);
          return;
        }

        if (scannerRef.current) {
          try {
            if ((scannerRef.current as any).isScanning) {
              await scannerRef.current.stop().catch(() => {});
            }
          } catch {}
        }

        const scanner =
          scannerRef.current ||
          new Html5Qrcode('barcode-camera-viewport', {
            formatsToSupport: [
              Html5QrcodeSupportedFormats.EAN_13,
              Html5QrcodeSupportedFormats.EAN_8,
              Html5QrcodeSupportedFormats.UPC_A,
              Html5QrcodeSupportedFormats.UPC_E,
              Html5QrcodeSupportedFormats.CODE_128,
              Html5QrcodeSupportedFormats.CODE_39,
            ],
            verbose: false,
          });

        scannerRef.current = scanner;

        // Listar câmeras se ainda não listadas
        const devices = await Html5Qrcode.getCameras().catch(() => []);
        if (devices && devices.length > 0) {
          setCameras(devices);
        }

        const cameraConfig = cameraId
          ? { deviceId: { exact: cameraId } }
          : { facingMode: 'environment' };

        await scanner.start(
          cameraConfig,
          {
            fps: 12,
            qrbox: { width: 280, height: 160 },
            aspectRatio: 1.333333,
          },
          (decodedText) => handleScanSuccess(decodedText),
          () => {} // falhas por frame são silenciosas
        );

        setIsInitializing(false);
      } catch (err: any) {
        setIsInitializing(false);
        const msg = String(err?.message || err || '');
        if (msg.includes('NotAllowedError') || msg.includes('Permission')) {
          setScannerError(
            'Permissão de câmera negada. Ative a câmera nas permissões do seu dispositivo para escanear.'
          );
        } else if (msg.includes('NotFoundError') || msg.includes('no camera')) {
          setScannerError('Nenhuma câmera encontrada no dispositivo.');
        } else {
          setScannerError(
            'Não foi possível inicializar a câmera. Você também pode enviar uma foto do código de barras ou digitar os números abaixo.'
          );
        }
      }
    },
    [handleScanSuccess]
  );

  useEffect(() => {
    let isMounted = true;
    let timer: any = null;

    if (isOpen) {
      setDetectedCode(null);
      setScannerError(null);
      isStoppingRef.current = false;

      timer = setTimeout(() => {
        if (isMounted) {
          startScanner();
        }
      }, 150);
    }

    return () => {
      isMounted = false;
      if (timer) clearTimeout(timer);
      isStoppingRef.current = true;
      if (scannerRef.current) {
        try {
          if ((scannerRef.current as any).isScanning) {
            scannerRef.current.stop().catch(() => {});
          }
        } catch {}
      }
    };
  }, [isOpen, startScanner]);

  const handleSwitchCamera = () => {
    if (cameras.length > 1) {
      const nextIndex = (selectedCameraIndex + 1) % cameras.length;
      setSelectedCameraIndex(nextIndex);
      startScanner(cameras[nextIndex].id);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !scannerRef.current) return;

    try {
      setIsInitializing(true);
      const decoded = await scannerRef.current.scanFile(file, true);
      setIsInitializing(false);
      handleScanSuccess(decoded);
    } catch {
      setIsInitializing(false);
      setScannerError('Não foi possível identificar um código de barras legível nesta imagem.');
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = manualIsbn.trim().replace(/[-\s]/g, '');
    if (clean) {
      onDetected(clean);
      onDismiss();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onDismiss}
    >
      <div
        className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl border flex flex-col"
        style={{
          backgroundColor: palette.paperSurface,
          borderColor: palette.woodBorder,
          color: palette.textOnPaper,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div
          className="px-4 py-3 flex items-center justify-between border-b"
          style={{
            backgroundColor: palette.woodDark,
            borderColor: palette.woodBorder,
            color: palette.goldPrimary,
          }}
        >
          <div className="flex items-center gap-2">
            <Camera size={18} />
            <h3 className="font-serif font-bold text-base tracking-wide">
              Leitor de Código de Barras (ISBN)
            </h3>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className="p-1.5 rounded-full hover:bg-white/10 text-white cursor-pointer transition-colors"
            title="Fechar leitor"
          >
            <X size={18} />
          </button>
        </div>

        {/* Viewfinder da Câmera */}
        <div className="relative w-full bg-black aspect-4/3 overflow-hidden flex items-center justify-center">
          {/* Elemento de renderização do html5-qrcode */}
          <div id="barcode-camera-viewport" className="w-full h-full" />

          {/* Mira / Moldura do Código de Barras */}
          {!scannerError && (
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6">
              {/* Moldura retangular */}
              <div
                className="w-64 h-36 border-2 rounded-xl relative overflow-hidden shadow-lg"
                style={{ borderColor: palette.goldPrimary }}
              >
                {/* Linha de laser animada */}
                <div
                  className="absolute left-0 right-0 h-0.5 animate-pulse"
                  style={{
                    backgroundColor: '#ef4444',
                    boxShadow: '0 0 10px 2px #ef4444',
                    top: '50%',
                    animation: 'scanLaser 2s infinite ease-in-out',
                  }}
                />

                {/* Cantoneiras douradas */}
                <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-amber-400" />
                <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-amber-400" />
                <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-amber-400" />
                <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-amber-400" />
              </div>

              <p className="mt-3 text-xs font-serif font-semibold text-white/90 bg-black/60 px-3 py-1 rounded-full drop-shadow">
                Enquadre o código de barras na contracapa
              </p>
            </div>
          )}

          {/* Feedback de sucesso */}
          {detectedCode && (
            <div className="absolute inset-0 bg-emerald-950/80 backdrop-blur-xs flex flex-col items-center justify-center p-4 text-white z-10 animate-in fade-in duration-200">
              <CheckCircle2 size={48} className="text-emerald-400 mb-2" />
              <p className="font-serif font-bold text-lg">Código Detectado!</p>
              <p className="font-mono text-sm tracking-wider text-emerald-300 mt-1">
                {detectedCode}
              </p>
              <p className="text-xs text-white/80 mt-2">Buscando informações do livro...</p>
            </div>
          )}

          {/* Estado de carregamento da câmera */}
          {isInitializing && !scannerError && (
            <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white gap-2">
              <RefreshCw size={24} className="animate-spin text-amber-400" />
              <span className="font-serif text-xs">Ativando câmera...</span>
            </div>
          )}

          {/* Mensagem de Erro de Câmera */}
          {scannerError && (
            <div className="absolute inset-0 bg-stone-900/95 flex flex-col items-center justify-center p-6 text-center gap-3 text-white">
              <AlertCircle size={36} className="text-amber-500" />
              <p className="text-xs leading-relaxed max-w-xs">{scannerError}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => startScanner()}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold border border-white/20 hover:bg-white/10"
                >
                  Tentar Novamente
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white"
                >
                  Carregar Foto
                </button>
              </div>
            </div>
          )}

          {/* Controles de Câmera sobrepostos */}
          {!scannerError && cameras.length > 1 && (
            <button
              type="button"
              onClick={handleSwitchCamera}
              className="absolute top-3 right-3 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 cursor-pointer shadow-md transition-all"
              title="Trocar câmera"
            >
              <RefreshCw size={16} />
            </button>
          )}
        </div>

        {/* Barra de Ferramentas e Entrada Manual */}
        <div className="p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between text-xs">
            <span
              className="flex items-center gap-1 font-serif font-semibold"
              style={{ color: palette.textSecondaryOnPaper }}
            >
              <Zap size={14} className="text-amber-600" />
              Compatível com EAN-13 e ISBN
            </span>

            {/* Upload de foto do código de barras */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-xs font-serif font-bold underline flex items-center gap-1 hover:opacity-80 cursor-pointer"
              style={{ color: palette.woodBorder }}
            >
              <Upload size={12} />
              Enviar foto do código
            </button>
          </div>

          {/* Entrada Manual de ISBN */}
          <form onSubmit={handleManualSubmit} className="pt-2 border-t flex flex-col gap-1.5" style={{ borderColor: `${palette.woodBorder}30` }}>
            <label
              className="block text-[11px] font-serif font-bold uppercase tracking-wider"
              style={{ color: palette.woodBorder }}
            >
              Ou digite o código de barras / ISBN:
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={manualIsbn}
                onChange={(e) => setManualIsbn(e.target.value)}
                placeholder="Ex: 9788535902778"
                className="flex-1 px-3 py-2 rounded-lg text-xs font-mono border focus:outline-none focus:ring-1"
                style={{
                  backgroundColor: palette.paperSurfaceElevated,
                  borderColor: palette.woodBorder,
                  color: palette.textOnPaper,
                }}
              />
              <button
                type="submit"
                disabled={!manualIsbn.trim()}
                className="px-4 py-2 rounded-lg font-serif font-bold text-xs shadow-sm cursor-pointer disabled:opacity-40 transition-all"
                style={{
                  backgroundColor: palette.goldPrimary,
                  color: palette.textOnGold,
                }}
              >
                Buscar
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
