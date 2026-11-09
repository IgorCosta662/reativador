import React from 'react';

interface TrophyBrandIconProps {
  size?: number;
  className?: string;
}

export const TrophyBrandIcon: React.FC<TrophyBrandIconProps> = ({
  size = 36,
  className = '',
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Ícone Troféu Dourado com Selo Esmeralda (reativador.ico)"
    >
      {/* Fundo Dark Slate Gamer (#0B0F19) com borda #1E293B */}
      <rect
        x="2"
        y="2"
        width="60"
        height="60"
        rx="14"
        fill="#0B0F19"
        stroke="#1E293B"
        strokeWidth="2.5"
      />

      {/* Alças da Taça Dourada */}
      <path
        d="M17 18H11C9.89543 18 9 18.8954 9 20V24C9 28.4183 12.5817 32 17 32H18"
        stroke="#F59E0B"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <path
        d="M41 18H47C48.1046 18 49 18.8954 49 20V24C49 28.4183 45.4183 32 41 32H40"
        stroke="#D97706"
        strokeWidth="3.5"
        strokeLinecap="round"
      />

      {/* Corpo do Troféu Dourado (#F59E0B) */}
      <path
        d="M16 13C16 11.8954 16.8954 11 18 11H40C41.1046 11 42 11.8954 42 13V24C42 31.1797 36.1797 37 29 37C21.8203 37 16 31.1797 16 24V13Z"
        fill="url(#trophyGoldGrad)"
      />

      {/* Brilho lateral da Taça */}
      <path
        d="M21 15V23C21 26.866 23.2 30.1 26.5 31.5"
        stroke="#FDE68A"
        strokeWidth="2.2"
        strokeLinecap="round"
      />

      {/* Haste e Pedestal do Troféu */}
      <rect x="26" y="36" width="6" height="10" rx="1" fill="#D97706" />
      <rect x="20" y="45" width="18" height="4" rx="1.5" fill="#F59E0B" />
      <rect x="16" y="49" width="26" height="5" rx="2" fill="#B45309" />

      {/* Selo de Verificação Verde Esmeralda (#10B981) no canto inferior direito */}
      <circle
        cx="46"
        cy="46"
        r="13"
        fill="#10B981"
        stroke="#0B0F19"
        strokeWidth="3"
      />
      <path
        d="M40.5 46.2L44.2 49.8L51.8 42.2"
        stroke="#FFFFFF"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <defs>
        <linearGradient
          id="trophyGoldGrad"
          x1="16"
          y1="11"
          x2="42"
          y2="37"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#FBBF24" />
          <stop offset="55%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#D97706" />
        </linearGradient>
      </defs>
    </svg>
  );
};
