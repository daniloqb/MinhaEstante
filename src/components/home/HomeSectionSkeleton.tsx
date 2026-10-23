import React from 'react';
import { WoodPalette } from '../../theme/woodTheme';

interface HomeSectionSkeletonProps {
  palette: WoodPalette;
}

export const HomeSectionSkeleton: React.FC<HomeSectionSkeletonProps> = ({ palette }) => {
  return (
    <div className="w-full flex flex-col gap-3 py-2 animate-pulse">
      <div className="flex items-center justify-between px-1">
        <div className="h-5 w-44 rounded bg-stone-700/30" />
        <div className="h-4 w-16 rounded bg-stone-700/20" />
      </div>

      <div className="flex gap-3.5 overflow-hidden px-1">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="shrink-0 w-28 sm:w-32 flex flex-col gap-2">
            <div
              className="w-full aspect-[2/3] rounded-lg shadow-sm"
              style={{ backgroundColor: `${palette.woodDark}80` }}
            />
            <div className="h-3 w-4/5 rounded bg-stone-700/30" />
            <div className="h-2.5 w-1/2 rounded bg-stone-700/20" />
          </div>
        ))}
      </div>
    </div>
  );
};
