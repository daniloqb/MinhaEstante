import React from 'react';
import { Star } from 'lucide-react';
import { WoodPalette } from '../theme/woodTheme';

interface StarRatingBarProps {
  palette: WoodPalette;
  rating?: number | null; // 0 a 10
  onRatingChanged?: (rating: number | null) => void;
  starSize?: number;
  isOnWood?: boolean;
  showLabel?: boolean;
  className?: string;
}

export const StarRatingBar: React.FC<StarRatingBarProps> = ({
  palette,
  rating,
  onRatingChanged,
  starSize = 18,
  isOnWood = false,
  showLabel = true,
  className = '',
}) => {
  const isInteractive = Boolean(onRatingChanged);
  const activeColor = isOnWood ? palette.starGold : palette.starWood;
  const inactiveColor = isOnWood ? 'rgba(255, 255, 255, 0.25)' : '#C7B39B';
  const textColor = isOnWood ? palette.textOnWood : palette.textOnPaper;

  return (
    <div className={`flex items-center flex-wrap gap-1 select-none ${className}`}>
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((starNum) => {
          const isFilled = rating != null && rating >= starNum;
          return (
            <button
              key={starNum}
              type="button"
              disabled={!isInteractive}
              onClick={() => {
                if (onRatingChanged) {
                  if (rating === starNum) {
                    onRatingChanged(null);
                  } else {
                    onRatingChanged(starNum);
                  }
                }
              }}
              className={`p-0.5 transition-transform ${
                isInteractive ? 'hover:scale-125 cursor-pointer active:scale-95' : 'cursor-default'
              }`}
              title={`Nota ${starNum}`}
            >
              <Star
                size={starSize}
                fill={isFilled ? activeColor : 'none'}
                color={isFilled ? activeColor : inactiveColor}
                strokeWidth={isFilled ? 0.5 : 1.5}
              />
            </button>
          );
        })}
      </div>

      {showLabel && (
        <span
          className="font-serif font-semibold text-sm ml-1"
          style={{ color: textColor }}
        >
          {rating != null ? `${rating}/10` : 'Sem nota'}
        </span>
      )}
    </div>
  );
};
