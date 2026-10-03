import React, { useState } from 'react';
import { WoodPalette } from '../theme/woodTheme';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Smartphone, Download } from 'lucide-react';
import { PWAInstallModal } from './PWAInstallModal';

interface PWAInstallButtonProps {
  palette: WoodPalette;
  variant?: 'appbar' | 'card' | 'badge';
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  palette,
  variant = 'appbar',
  className = '',
}) => {
  const { isInstalled, isInstallable, install } = usePWAInstall();
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Se já estiver rodando instalado em modo standalone, oculta apenas na barra superior
  if (isInstalled && variant !== 'card') {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      const installed = await install();
      if (!installed) {
        setIsModalOpen(true);
      }
    } else {
      setIsModalOpen(true);
    }
  };

  if (variant === 'card') {
    return (
      <>
        <div
          onClick={handleClick}
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 cursor-pointer hover:brightness-105 active:scale-98 transition-all ${className}`}
          style={{
            backgroundColor: `${palette.goldPrimary}15`,
            borderColor: `${palette.goldPrimary}70`,
          }}
        >
          <div className="flex items-center gap-3">
            <span
              className="p-2.5 rounded-lg flex items-center justify-center shadow-sm"
              style={{
                backgroundColor: palette.goldPrimary,
                color: palette.textOnGold,
              }}
            >
              <Smartphone size={20} />
            </span>
            <div>
              <h4
                className="font-serif font-bold text-sm leading-tight"
                style={{ color: palette.textOnPaper }}
              >
                Instalar no Celular
              </h4>
              <p
                className="text-xs font-serif mt-0.5"
                style={{ color: palette.textSecondaryOnPaper }}
              >
                Tenha o app direto na sua tela inicial, rápido e offline
              </p>
            </div>
          </div>

          <button
            type="button"
            className="px-3 py-1.5 rounded-lg font-serif font-bold text-xs shadow-sm flex items-center gap-1.5 shrink-0"
            style={{
              backgroundColor: palette.goldPrimary,
              color: palette.textOnGold,
            }}
          >
            <Download size={14} />
            Instalar
          </button>
        </div>

        <PWAInstallModal
          palette={palette}
          isOpen={isModalOpen}
          onDismiss={() => setIsModalOpen(false)}
        />
      </>
    );
  }

  // Variant 'appbar' (botão de topo discreto e elegante)
  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={`px-2.5 py-1 rounded-full font-serif font-bold text-xs border flex items-center gap-1.5 shadow-sm transition-all cursor-pointer hover:brightness-110 active:scale-95 ${className}`}
        style={{
          backgroundColor: `${palette.goldPrimary}30`,
          borderColor: palette.goldPrimary,
          color: palette.goldPrimary,
        }}
        title="Instalar Minha Estante no seu smartphone"
      >
        <Smartphone size={14} />
        <span className="hidden sm:inline">Instalar no Celular</span>
        <span className="sm:hidden">Instalar</span>
      </button>

      <PWAInstallModal
        palette={palette}
        isOpen={isModalOpen}
        onDismiss={() => setIsModalOpen(false)}
      />
    </>
  );
};
