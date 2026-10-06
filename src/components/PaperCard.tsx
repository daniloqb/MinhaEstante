import React from 'react';
import { WoodPalette } from '../theme/woodTheme';

interface PaperCardProps {
  palette: WoodPalette;
  children: React.ReactNode;
  onClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  className?: string;
  elevated?: boolean;
  title?: string;
}

export const PaperCard: React.FC<PaperCardProps> = ({
  palette,
  children,
  onClick,
  onContextMenu,
  className = '',
  elevated = false,
  title,
}) => {
  return (
    <div
      title={title}
      onClick={onClick}
      onContextMenu={onContextMenu}
      className={`rounded-xl p-3.5 transition-all duration-200 border ${
        onClick ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99]' : ''
      } ${className}`}
      style={{
        backgroundColor: elevated ? palette.paperSurfaceElevated : palette.paperSurface,
        borderColor: `${palette.woodBorder}40`,
        boxShadow: elevated
          ? '0 4px 14px -2px rgba(0, 0, 0, 0.25), 0 2px 6px -1px rgba(0, 0, 0, 0.15)'
          : '0 2px 8px -2px rgba(0, 0, 0, 0.2), 0 1px 4px -1px rgba(0, 0, 0, 0.1)',
        color: palette.textOnPaper,
      }}
    >
      {children}
    </div>
  );
};
