import React, { useState, useEffect } from 'react';
import {
  Cloud,
  CheckCircle2,
  AlertCircle,
  LogOut,
  DownloadCloud,
  ShieldCheck,
  Loader2,
} from 'lucide-react';
import { WoodPalette } from '../theme/woodTheme';
import { PaperCard } from './PaperCard';
import { Book } from '../types/book';
import { BookStorage } from '../services/storage';
import {
  initGoogleAuth,
  signInWithGoogle,
  signOutGoogle,
  getCachedAccessToken,
  setCachedAccessToken,
  getStoredGoogleUser,
  CachedGoogleUser,
} from '../services/googleAuthService';
import {
  findDriveBackupFile,
  downloadDriveBackup,
  uploadDriveBackup,
} from '../services/googleDriveService';

interface GoogleDriveSyncCardProps {
  palette: WoodPalette;
  books: Book[];
  onUpdateAllBooks: (books: Book[]) => void;
  onShowToast: (message: string) => void;
  onTriggerLocalBackup?: () => void;
}

export const GoogleDriveSyncCard: React.FC<GoogleDriveSyncCardProps> = ({
  palette,
  books,
  onUpdateAllBooks,
  onShowToast,
  onTriggerLocalBackup,
}) => {
  const [currentUser, setCurrentUser] = useState<CachedGoogleUser | null>(() => getStoredGoogleUser());
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [activeAction, setActiveAction] = useState<'saving' | 'recovering' | null>(null);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastSavedTime, setLastSavedTime] = useState<number | null>(() =>
    BookStorage.loadLastSyncTime()
  );
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    description: string;
    onConfirm: () => void;
  } | null>(null);

  useEffect(() => {
    const unsubscribe = initGoogleAuth(
      (user, token) => {
        setCurrentUser({
          displayName: user.displayName,
          email: user.email,
          photoURL: user.photoURL,
        });
        if (token) {
          setCachedAccessToken(token);
        }
        setIsAuthLoading(false);
      },
      () => {
        const stored = getStoredGoogleUser();
        if (stored && getCachedAccessToken()) {
          setCurrentUser(stored);
        } else {
          setCurrentUser(null);
        }
        setIsAuthLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleSignIn = async () => {
    setIsAuthLoading(true);
    setErrorMessage(null);
    setStatusText(null);
    try {
      const { user } = await signInWithGoogle();
      setCurrentUser(user);
      onShowToast(`Conectado com sucesso ao Google Drive como ${user.displayName || user.email}!`);
    } catch (err: any) {
      console.error('Falha no login Google:', err);
      if (err.message && !err.message.includes('cancelado')) {
        setErrorMessage(
          err.message || 'Não foi possível conectar ao Google Drive. Tente novamente.'
        );
      }
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOutGoogle();
      setCurrentUser(null);
      setStatusText(null);
      setErrorMessage(null);
      onShowToast('Desconectado do Google Drive.');
    } catch (err) {
      console.error('Erro ao desconectar:', err);
    }
  };

  const getValidAccessToken = async (): Promise<string> => {
    const cached = getCachedAccessToken();
    if (cached) return cached;
    const { accessToken } = await signInWithGoogle();
    return accessToken;
  };

  // 1. Salvar a Versão Atual no Google Drive
  const handleSaveCurrentVersion = async () => {
    setIsProcessing(true);
    setActiveAction('saving');
    setErrorMessage(null);
    setStatusText('Localizando backup no Google Drive...');

    try {
      const token = await getValidAccessToken();
      const existingFile = await findDriveBackupFile(token);

      setStatusText('Gravando versão atual no Google Drive...');
      const uploadedFile = await uploadDriveBackup(token, books, existingFile?.id || null);
      BookStorage.saveDriveFileId(uploadedFile.id);

      const now = Date.now();
      BookStorage.saveLastSyncTime(now);
      setLastSavedTime(now);

      const successMsg = `Versão atual salva com sucesso no Google Drive (${books.length} livros)!`;
      setStatusText(successMsg);
      onShowToast(successMsg);
    } catch (err: any) {
      console.error('Erro ao salvar versão atual no Drive:', err);
      setErrorMessage(err.message || 'Falha ao salvar a versão atual no Google Drive.');
    } finally {
      setIsProcessing(false);
      setActiveAction(null);
    }
  };

  // 2. Recuperar a Versão Atual do Google Drive
  const handleRecoverCurrentVersion = () => {
    setConfirmModal({
      title: 'Recuperar Versão do Google Drive?',
      description:
        'Esta ação baixará a versão salva no seu Google Drive e carregará seus livros neste aparelho. Se você tiver alterações recentes não salvas no aparelho, elas serão atualizadas pelos dados da nuvem.',
      onConfirm: async () => {
        setConfirmModal(null);
        setIsProcessing(true);
        setActiveAction('recovering');
        setErrorMessage(null);
        setStatusText('Buscando arquivo de backup no Google Drive...');

        try {
          const token = await getValidAccessToken();
          const existingFile = await findDriveBackupFile(token);
          if (!existingFile) {
            throw new Error('Nenhuma versão de backup encontrada no seu Google Drive. Salve uma versão primeiro.');
          }

          setStatusText('Baixando livros da nuvem...');
          const remoteBooks = await downloadDriveBackup(token, existingFile.id);
          BookStorage.saveDriveFileId(existingFile.id);

          // Salvar na memória e estado da aplicação
          BookStorage.saveAllBooks(remoteBooks);
          onUpdateAllBooks(remoteBooks);

          const now = Date.now();
          BookStorage.saveLastSyncTime(now);
          setLastSavedTime(now);

          const successMsg = `Versão recuperada com sucesso! ${remoteBooks.length} livro(s) carregados da nuvem.`;
          setStatusText(successMsg);
          onShowToast(successMsg);
        } catch (err: any) {
          console.error('Erro ao recuperar do Google Drive:', err);
          setErrorMessage(err.message || 'Falha ao recuperar a versão do Google Drive.');
        } finally {
          setIsProcessing(false);
          setActiveAction(null);
        }
      },
    });
  };

  return (
    <>
      <PaperCard palette={palette} elevated className="flex flex-col gap-3.5">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-blue-500/10 text-xl flex items-center justify-center">
              <svg className="w-5 h-5" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
                <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
                <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47"/>
                <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/>
                <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
                <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
                <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
              </svg>
            </span>
            <div>
              <h3 className="font-serif font-bold text-lg leading-tight" style={{ color: palette.textOnPaper }}>
                Sincronização com Google Drive
              </h3>
              <p className="text-xs font-serif" style={{ color: palette.textSecondaryOnPaper }}>
                Salve e recupere sua biblioteca na nuvem privada da sua conta Google
              </p>
            </div>
          </div>

          <span
            className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider"
            style={{
              backgroundColor: currentUser ? '#10b98115' : `${palette.woodBorder}20`,
              color: currentUser ? '#059669' : palette.textSecondaryOnPaper,
              border: `1px solid ${currentUser ? '#10b98135' : `${palette.woodBorder}35`}`,
            }}
          >
            {currentUser ? 'Conectado' : 'Nuvem Privada'}
          </span>
        </div>

        {/* Informação sobre Privacidade */}
        <div
          className="p-3 rounded-xl border text-xs leading-relaxed flex flex-col gap-1.5"
          style={{
            backgroundColor: palette.paperSurfaceElevated,
            borderColor: `${palette.woodBorder}35`,
            color: palette.textOnPaper,
          }}
        >
          <div className="flex items-center gap-1.5 font-bold text-amber-950 font-serif">
            <ShieldCheck size={15} className="text-emerald-600" />
            <span>Privacidade total & Arquivo seguro no seu Drive:</span>
          </div>
          <p className="opacity-90">
            O aplicativo cria e lê exclusivamente o seu arquivo <strong>minha-estante-backup.json</strong> no seu próprio Google Drive. Nenhum dado transita por servidores de terceiros.
          </p>
        </div>

        {/* 1. SE NÃO ESTIVER AUTENTICADO: Autentica uma única vez */}
        {!currentUser && (
          <div className="flex flex-col gap-3 pt-1">
            <p className="text-xs font-serif leading-relaxed" style={{ color: palette.textOnPaper }}>
              Conecte sua conta Google uma única vez. Após autenticado, você terá acesso imediato às opções de <strong>salvar a versão atual</strong> e <strong>recuperar a versão atual</strong> da sua biblioteca.
            </p>

            <button
              type="button"
              onClick={handleSignIn}
              disabled={isAuthLoading}
              className="w-full py-3 px-4 rounded-xl font-serif font-bold text-sm shadow-sm flex items-center justify-center gap-3 cursor-pointer hover:bg-stone-50 active:scale-98 transition-all disabled:opacity-60"
              style={{
                backgroundColor: '#FFFFFF',
                color: '#3c4043',
                border: '1px solid #dadce0',
              }}
            >
              {isAuthLoading ? (
                <>
                  <Loader2 size={18} className="animate-spin text-blue-600" />
                  <span>Conectando ao Google Drive...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 48 48">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                  </svg>
                  <span>Conectar com Google Drive</span>
                </>
              )}
            </button>

            {onTriggerLocalBackup && (
              <div className="pt-1 text-center">
                <button
                  type="button"
                  onClick={onTriggerLocalBackup}
                  className="text-xs font-serif opacity-75 hover:opacity-100 underline cursor-pointer"
                  style={{ color: palette.textSecondaryOnPaper }}
                >
                  Ou salvar backup JSON no armazenamento local do aparelho
                </button>
              </div>
            )}
          </div>
        )}

        {/* 2. SE ESTIVER AUTENTICADO: Somente opções de salvar e recuperar a versão atual */}
        {currentUser && (
          <div className="flex flex-col gap-3 pt-1">
            {/* Barra de Usuário Autenticado */}
            <div
              className="p-3 rounded-xl border flex items-center justify-between gap-3"
              style={{
                backgroundColor: palette.paperSurfaceElevated,
                borderColor: `${palette.woodBorder}40`,
              }}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {currentUser.photoURL ? (
                  <img
                    src={currentUser.photoURL}
                    alt={currentUser.displayName || 'Avatar'}
                    className="w-9 h-9 rounded-full border shadow-xs object-cover shrink-0"
                    style={{ borderColor: palette.woodBorder }}
                  />
                ) : (
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0"
                    style={{ backgroundColor: palette.goldPrimary, color: palette.textOnGold }}
                  >
                    {(currentUser.displayName || currentUser.email || 'U')[0].toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-serif font-bold text-xs truncate" style={{ color: palette.textOnPaper }}>
                    {currentUser.displayName || 'Conta Google Conectada'}
                  </p>
                  <p className="text-[11px] truncate opacity-80" style={{ color: palette.textSecondaryOnPaper }}>
                    {currentUser.email}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSignOut}
                className="py-1 px-2.5 rounded-lg border text-xs font-serif flex items-center gap-1.5 cursor-pointer hover:bg-red-500/10 text-red-700 active:scale-95 transition-all shrink-0"
                style={{ borderColor: '#ef444440' }}
                title="Desconectar do Google Drive"
              >
                <LogOut size={13} />
                <span>Desconectar</span>
              </button>
            </div>

            {/* Informação da última versão salva */}
            <div className="flex items-center justify-between text-xs px-1">
              <span className="flex items-center gap-1.5" style={{ color: palette.textSecondaryOnPaper }}>
                <Cloud size={14} className="text-blue-600" />
                {lastSavedTime ? (
                  <span>
                    Última versão salva:{' '}
                    <strong>{new Date(lastSavedTime).toLocaleDateString('pt-BR')}</strong> às{' '}
                    <strong>{new Date(lastSavedTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</strong>
                  </span>
                ) : (
                  <span>Nenhuma versão salva no Drive ainda</span>
                )}
              </span>

              <span className="font-mono text-[11px] opacity-75">
                {books.length} livro(s) no aparelho
              </span>
            </div>

            {/* SOMENTE AS DUAS OPÇÕES: Salvar a Versão Atual e Recuperar a Versão Atual */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              {/* Opção 1: Salvar a Versão Atual */}
              <button
                type="button"
                onClick={handleSaveCurrentVersion}
                disabled={isProcessing}
                className="py-3 px-4 rounded-xl font-serif font-bold text-xs shadow-md flex items-center justify-center gap-2 cursor-pointer hover:brightness-105 active:scale-98 transition-all disabled:opacity-60"
                style={{
                  backgroundColor: palette.goldPrimary,
                  color: palette.textOnGold,
                }}
                title="Salva os livros atuais da sua estante no Google Drive"
              >
                {isProcessing && activeAction === 'saving' ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Salvando versão atual...</span>
                  </>
                ) : (
                  <>
                    <Cloud size={16} />
                    <span>Salvar a Versão Atual</span>
                  </>
                )}
              </button>

              {/* Opção 2: Recuperar a Versão Atual */}
              <button
                type="button"
                onClick={handleRecoverCurrentVersion}
                disabled={isProcessing}
                className="py-3 px-4 rounded-xl font-serif font-bold text-xs border flex items-center justify-center gap-2 cursor-pointer hover:bg-black/5 active:scale-98 transition-all disabled:opacity-60"
                style={{
                  borderColor: palette.woodBorder,
                  color: palette.textOnPaper,
                  backgroundColor: palette.paperSurfaceElevated,
                }}
                title="Recupera o backup mais recente salvo no seu Google Drive"
              >
                {isProcessing && activeAction === 'recovering' ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Recuperando versão...</span>
                  </>
                ) : (
                  <>
                    <DownloadCloud size={16} />
                    <span>Recuperar a Versão Atual</span>
                  </>
                )}
              </button>
            </div>

            {onTriggerLocalBackup && (
              <div className="pt-0.5 text-right">
                <button
                  type="button"
                  onClick={onTriggerLocalBackup}
                  className="text-[11px] font-serif opacity-75 hover:opacity-100 underline cursor-pointer"
                  style={{ color: palette.textSecondaryOnPaper }}
                >
                  Fazer backup JSON local
                </button>
              </div>
            )}
          </div>
        )}

        {/* Mensagens de feedback */}
        {statusText && (
          <div className="flex items-center gap-2 text-xs font-serif font-semibold text-emerald-800 bg-emerald-50 border border-emerald-300 rounded-lg p-2.5 animate-in fade-in">
            <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
            <span>{statusText}</span>
          </div>
        )}

        {errorMessage && (
          <div className="flex flex-col gap-2 p-3 rounded-xl border border-red-300 bg-red-50 text-red-900 text-xs font-serif animate-in fade-in">
            <div className="flex items-start gap-2">
              <AlertCircle size={16} className="shrink-0 text-red-600 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold leading-tight">Aviso do Google Drive</p>
                <p className="text-[11px] leading-relaxed text-red-800">{errorMessage}</p>
              </div>
            </div>

            {onTriggerLocalBackup && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={onTriggerLocalBackup}
                  className="py-1.5 px-3 rounded-lg font-bold text-xs bg-amber-800 text-white shadow-xs cursor-pointer hover:bg-amber-900 active:scale-95 transition-all flex items-center gap-1.5"
                >
                  <Cloud size={13} />
                  <span>Salvar Backup JSON no Aparelho</span>
                </button>
              </div>
            )}
          </div>
        )}
      </PaperCard>

      {/* Modal de Confirmação para Recuperar a Versão */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div
            className="w-full max-w-md p-5 rounded-2xl border shadow-2xl flex flex-col gap-4"
            style={{
              backgroundColor: palette.paperSurface,
              borderColor: palette.woodBorder,
              color: palette.textOnPaper,
            }}
          >
            <div className="flex items-center gap-2 font-serif font-bold text-base text-amber-900">
              <AlertCircle size={20} className="text-amber-600" />
              <h4>{confirmModal.title}</h4>
            </div>

            <p className="text-xs leading-relaxed" style={{ color: palette.textOnPaper }}>
              {confirmModal.description}
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 rounded-lg font-serif text-xs border cursor-pointer hover:bg-black/5"
                style={{ borderColor: palette.woodBorder, color: palette.textOnPaper }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmModal.onConfirm}
                className="px-4 py-2 rounded-lg font-serif font-bold text-xs shadow-sm cursor-pointer hover:brightness-105 active:scale-95"
                style={{
                  backgroundColor: palette.goldPrimary,
                  color: palette.textOnGold,
                }}
              >
                Confirmar Recuperação
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
