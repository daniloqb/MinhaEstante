import React from 'react';

export interface MaShelfLogoProps {
  size?: number;
  className?: string;
  withContainer?: boolean;
}

export const MaShelfLogo: React.FC<MaShelfLogoProps> = ({
  size = 36,
  className = '',
  withContainer = true,
}) => {
  if (!withContainer) {
    // Apenas a estante arqueada, livros e prateleira (fundo 100% transparente)
    return (
      <svg
        width={size}
        height={size}
        viewBox="60 60 392 350"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`shrink-0 ${className}`}
      >
        {/* Arco branco superior */}
        <path
          d="M 112 372 L 112 250 A 144 144 0 0 1 400 250 L 400 372"
          stroke="#F4F3ED"
          stroke-width="26"
          strokeLinecap="round"
        />

        {/* Prateleira inferior âmbar */}
        <rect x="76" y="370" width="360" height="30" rx="15" fill="#E5A33A" />

        {/* Livro 1 (Esquerdo - Branco sólido) */}
        <rect x="160" y="218" width="44" height="152" rx="12" fill="#F4F3ED" />

        {/* Livro 2 (Central - Branco tracejado vazado) */}
        <rect
          x="218"
          y="242"
          width="54"
          height="128"
          rx="12"
          fill="none"
          stroke="#F4F3ED"
          strokeWidth="15"
          strokeDasharray="13 9"
        />

        {/* Livro 3 (Direito - Âmbar inclinado) */}
        <g transform="translate(328 304) rotate(14) translate(-328 -304)">
          <rect x="306" y="232" width="44" height="142" rx="12" fill="#E5A33A" />
        </g>
      </svg>
    );
  }

  // Logo completa oficial: Squircle azul-marinho com cantos externos 100% transparentes (sem fundo branco)
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
    >
      {/* Squircle azul-marinho com cantos transparentes */}
      <rect width="512" height="512" rx="128" fill="#1C2938" />

      {/* Arco branco superior */}
      <path
        d="M 112 372 L 112 250 A 144 144 0 0 1 400 250 L 400 372"
        stroke="#F4F3ED"
        strokeWidth="26"
        strokeLinecap="round"
      />

      {/* Prateleira inferior âmbar */}
      <rect x="76" y="370" width="360" height="30" rx="15" fill="#E5A33A" />

      {/* Livro 1 (Esquerdo - Branco sólido) */}
      <rect x="160" y="218" width="44" height="152" rx="12" fill="#F4F3ED" />

      {/* Livro 2 (Central - Branco tracejado vazado) */}
      <rect
        x="218"
        y="242"
        width="54"
        height="128"
        rx="12"
        fill="none"
        stroke="#F4F3ED"
        strokeWidth="15"
        strokeDasharray="13 9"
      />

      {/* Livro 3 (Direito - Âmbar inclinado) */}
      <g transform="translate(328 304) rotate(14) translate(-328 -304)">
        <rect x="306" y="232" width="44" height="142" rx="12" fill="#E5A33A" />
      </g>
    </svg>
  );
};

export const BookNookLogo = MaShelfLogo;

