import { Component, ErrorInfo, ReactNode } from 'react';
import { WoodPalette, DarkWalnutPalette } from '../theme/woodTheme';
import { RefreshCw, BookOpen, AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
  palette?: WoodPalette;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorMessage: '',
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error?.message || 'Erro inesperado na aplicação.',
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary capturou erro:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      const palette = this.props.palette || DarkWalnutPalette;

      return (
        <div
          className="min-h-screen w-full flex items-center justify-center p-4"
          style={{
            backgroundColor: palette.woodDark,
            color: palette.textOnWood,
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl p-6 shadow-2xl border text-center flex flex-col items-center gap-4"
            style={{
              backgroundColor: palette.paperSurface,
              borderColor: palette.woodBorder,
              color: palette.textOnPaper,
            }}
          >
            <div
              className="p-3 rounded-full"
              style={{
                backgroundColor: `${palette.goldPrimary}20`,
                color: palette.woodBorder,
              }}
            >
              <AlertTriangle size={36} className="text-amber-700" />
            </div>

            <h2 className="font-serif font-bold text-xl" style={{ color: palette.textOnPaper }}>
              Recuperação de Tela
            </h2>

            <p className="text-xs leading-relaxed" style={{ color: palette.textSecondaryOnPaper }}>
              Ocorreu uma instabilidade momentânea nesta tela, mas todos os seus livros e dados permanecem seguros na sua estante.
            </p>

            <div className="flex flex-col sm:flex-row gap-2.5 w-full pt-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="flex-1 py-2.5 px-4 rounded-xl font-serif font-bold text-xs shadow-md flex items-center justify-center gap-2 cursor-pointer hover:brightness-105 active:scale-98 transition-all"
                style={{
                  backgroundColor: palette.goldPrimary,
                  color: palette.textOnGold,
                }}
              >
                <BookOpen size={16} />
                Voltar à Estante
              </button>

              <button
                type="button"
                onClick={this.handleReload}
                className="flex-1 py-2.5 px-4 rounded-xl font-serif font-semibold text-xs border flex items-center justify-center gap-2 cursor-pointer hover:bg-black/5 active:scale-98 transition-all"
                style={{
                  borderColor: palette.woodBorder,
                  color: palette.textOnPaper,
                }}
              >
                <RefreshCw size={15} />
                Recarregar App
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
