import React from 'react';
import { EstanteStats } from '../types/book';
import { WoodPalette } from '../theme/woodTheme';
import { WoodTopAppBar } from '../components/WoodTopAppBar';
import { PaperCard } from '../components/PaperCard';

interface StatsScreenProps {
  palette: WoodPalette;
  stats: EstanteStats;
}

export const StatsScreen: React.FC<StatsScreenProps> = ({ palette, stats }) => {
  const currentYear = new Date().getFullYear();

  const yearEntries = Object.entries(stats.lidosPorAno)
    .map(([yearStr, count]) => ({ year: parseInt(yearStr, 10), count }))
    .sort((a, b) => a.year - b.year)
    .slice(-7);

  const maxYearCount = Math.max(...yearEntries.map((y) => y.count), 1);
  const maxAuthorCount = Math.max(...stats.topAutores.map((a) => a[1]), 1);
  const maxGenreCount = Math.max(...stats.topGeneros.map((g) => g[1]), 1);

  return (
    <div className="flex flex-col w-full flex-1">
      <WoodTopAppBar palette={palette} title="Estatísticas de Leitura" />

      <div className="flex-1 w-full max-w-2xl mx-auto px-4 py-4 flex flex-col gap-4 pb-12">
        {/* Distribuição do Acervo: Meus Livros | Lidos | Quero Ler */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <PaperCard palette={palette} className="flex flex-col text-center p-2.5 sm:p-3">
            <span
              className="text-[11px] sm:text-xs font-semibold"
              style={{ color: palette.textSecondaryOnPaper }}
            >
              Meus Livros
            </span>
            <span
              className="font-serif font-bold text-2xl sm:text-3xl my-0.5"
              style={{ color: palette.goldPrimary }}
            >
              {stats.totalMeusLivros}
            </span>
            <span
              className="text-[10px]"
              style={{ color: palette.textSecondaryOnPaper }}
            >
              No acervo
            </span>
          </PaperCard>

          <PaperCard palette={palette} className="flex flex-col text-center p-2.5 sm:p-3">
            <span
              className="text-[11px] sm:text-xs font-semibold"
              style={{ color: palette.textSecondaryOnPaper }}
            >
              Lidos
            </span>
            <span
              className="font-serif font-bold text-2xl sm:text-3xl my-0.5"
              style={{ color: palette.woodBorder }}
            >
              {stats.totalLidos}
            </span>
            <span
              className="text-[10px]"
              style={{ color: palette.textSecondaryOnPaper }}
            >
              Concluídos
            </span>
          </PaperCard>

          <PaperCard palette={palette} className="flex flex-col text-center p-2.5 sm:p-3">
            <span
              className="text-[11px] sm:text-xs font-semibold"
              style={{ color: palette.textSecondaryOnPaper }}
            >
              Quero Ler
            </span>
            <span
              className="font-serif font-bold text-2xl sm:text-3xl my-0.5"
              style={{ color: palette.textSecondaryOnPaper }}
            >
              {stats.totalQueroLer}
            </span>
            <span
              className="text-[10px]"
              style={{ color: palette.textSecondaryOnPaper }}
            >
              Desejados
            </span>
          </PaperCard>
        </div>

        {/* Grandes Números em Cormorant Garamond */}
        <div className="grid grid-cols-2 gap-3">
          <PaperCard palette={palette} className="flex flex-col">
            <span
              className="text-xs font-semibold"
              style={{ color: palette.textSecondaryOnPaper }}
            >
              Livros Lidos
            </span>
            <span
              className="font-serif font-bold text-3xl sm:text-4xl my-1"
              style={{ color: palette.woodBorder }}
            >
              {stats.totalLidos}
            </span>
            <span
              className="text-[11px]"
              style={{ color: palette.textSecondaryOnPaper }}
            >
              Total registrado
            </span>
          </PaperCard>

          <PaperCard palette={palette} className="flex flex-col">
            <span
              className="text-xs font-semibold"
              style={{ color: palette.textSecondaryOnPaper }}
            >
              Lidos em {currentYear}
            </span>
            <span
              className="font-serif font-bold text-3xl sm:text-4xl my-1"
              style={{ color: palette.woodBorder }}
            >
              {stats.livrosLidosAnoAtual}
            </span>
            <span
              className="text-[11px]"
              style={{ color: palette.textSecondaryOnPaper }}
            >
              Neste ano
            </span>
          </PaperCard>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <PaperCard palette={palette} className="flex flex-col">
            <span
              className="text-xs font-semibold"
              style={{ color: palette.textSecondaryOnPaper }}
            >
              Páginas Lidas
            </span>
            <span
              className="font-serif font-bold text-3xl sm:text-4xl my-1"
              style={{ color: palette.woodBorder }}
            >
              {stats.totalPaginasLidas.toLocaleString()}
            </span>
            <span
              className="text-[11px]"
              style={{ color: palette.textSecondaryOnPaper }}
            >
              {stats.paginasLidasAnoAtual.toLocaleString()} em {currentYear}
            </span>
          </PaperCard>

          <PaperCard palette={palette} className="flex flex-col">
            <span
              className="text-xs font-semibold"
              style={{ color: palette.textSecondaryOnPaper }}
            >
              Nota Média
            </span>
            <span
              className="font-serif font-bold text-3xl sm:text-4xl my-1"
              style={{ color: palette.woodBorder }}
            >
              {stats.notaMedia != null ? stats.notaMedia.toFixed(1) : '-'}
            </span>
            <span
              className="text-[11px]"
              style={{ color: palette.textSecondaryOnPaper }}
            >
              {stats.notaMedia != null ? 'de 10 pontos' : 'Sem notas'}
            </span>
          </PaperCard>
        </div>

        {/* Gráfico de Barras: Livros Lidos por Ano */}
        <PaperCard palette={palette} className="flex flex-col">
          <h3 className="font-serif font-bold text-xl mb-3" style={{ color: palette.textOnPaper }}>
            Livros Lidos por Ano
          </h3>

          {yearEntries.length === 0 ? (
            <p className="text-sm py-8 text-center italic" style={{ color: palette.textSecondaryOnPaper }}>
              Cadastre livros com data de leitura para ver o gráfico.
            </p>
          ) : (
            <div className="w-full pt-4 pb-2">
              <div className="h-44 w-full flex items-end justify-around gap-2 px-2 border-b" style={{ borderColor: `${palette.woodBorder}40` }}>
                {yearEntries.map((item) => {
                  const barHeightPct = Math.max(12, Math.round((item.count / maxYearCount) * 100));

                  return (
                    <div
                      key={item.year}
                      className="flex-1 max-w-[48px] flex flex-col items-center justify-end h-full group"
                    >
                      <span
                        className="text-xs font-serif font-bold mb-1 opacity-90 transition-transform group-hover:scale-110"
                        style={{ color: palette.textOnPaper }}
                      >
                        {item.count}
                      </span>
                      <div
                        className="w-full rounded-t-sm shadow-md transition-all duration-300"
                        style={{
                          height: `${barHeightPct}%`,
                          background: `linear-gradient(to bottom, ${palette.goldPrimary} 0%, ${palette.woodBorder} 50%, ${palette.woodShelf} 100%)`,
                        }}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Rótulos dos Anos */}
              <div className="flex items-center justify-around gap-2 px-2 mt-2">
                {yearEntries.map((item) => (
                  <span
                    key={item.year}
                    className="flex-1 max-w-[48px] text-center font-serif text-xs font-semibold"
                    style={{ color: palette.textSecondaryOnPaper }}
                  >
                    {item.year}
                  </span>
                ))}
              </div>
            </div>
          )}
        </PaperCard>

        {/* Ranking de Autores Mais Lidos */}
        <PaperCard palette={palette} className="flex flex-col">
          <h3 className="font-serif font-bold text-xl mb-3" style={{ color: palette.textOnPaper }}>
            Autores Mais Lidos
          </h3>

          {stats.topAutores.length === 0 ? (
            <p className="text-sm py-4 italic text-center" style={{ color: palette.textSecondaryOnPaper }}>
              Nenhum autor registrado ainda.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {stats.topAutores.map(([autor, count]) => {
                const fraction = Math.max(0.08, count / maxAuthorCount);

                return (
                  <div key={autor} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-xs sm:text-sm">
                      <span className="font-serif font-semibold truncate pr-2" style={{ color: palette.textOnPaper }}>
                        {autor}
                      </span>
                      <span className="font-serif text-xs whitespace-nowrap" style={{ color: palette.textSecondaryOnPaper }}>
                        {count} {count === 1 ? 'livro' : 'livros'}
                      </span>
                    </div>

                    <div
                      className="w-full h-2 rounded-full overflow-hidden"
                      style={{ backgroundColor: `${palette.paperBorder}60` }}
                    >
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.round(fraction * 100)}%`,
                          background: `linear-gradient(to right, ${palette.woodBorder}, ${palette.goldPrimary})`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </PaperCard>

        {/* Ranking de Gêneros Mais Lidos */}
        <PaperCard palette={palette} className="flex flex-col">
          <h3 className="font-serif font-bold text-xl mb-3" style={{ color: palette.textOnPaper }}>
            Gêneros Mais Lidos
          </h3>

          {stats.topGeneros.length === 0 ? (
            <p className="text-sm py-4 italic text-center" style={{ color: palette.textSecondaryOnPaper }}>
              Nenhum gênero registrado ainda.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {stats.topGeneros.map(([genero, count]) => {
                const fraction = Math.max(0.08, count / maxGenreCount);

                return (
                  <div key={genero} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-xs sm:text-sm">
                      <span className="font-serif font-semibold truncate pr-2" style={{ color: palette.textOnPaper }}>
                        {genero}
                      </span>
                      <span className="font-serif text-xs whitespace-nowrap" style={{ color: palette.textSecondaryOnPaper }}>
                        {count} {count === 1 ? 'livro' : 'livros'}
                      </span>
                    </div>

                    <div
                      className="w-full h-2 rounded-full overflow-hidden"
                      style={{ backgroundColor: `${palette.paperBorder}60` }}
                    >
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.round(fraction * 100)}%`,
                          background: `linear-gradient(to right, ${palette.woodBorder}, ${palette.goldPrimary})`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </PaperCard>
      </div>
    </div>
  );
};
