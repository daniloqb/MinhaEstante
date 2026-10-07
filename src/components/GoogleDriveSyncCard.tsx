import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import {
  Cloud,
  RefreshCw,
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
  isLocalAndroidApp,
} from '../services/googleAuthService';
import {
  findDriveBackupFile,
  downloadDriveBackup,
  uploadDriveBackup,
  mergeBooks,
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
  const isAndroid = isLocalAndroidApp();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [copiedWebUrl, setCopiedWebUrl] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(() =>
    BookStorage.loadLastSyncTime()
  );
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    description: string;
    onConfirm: () => void;
    confirmLabel?: string;
  } | null>(null);

  useEffect(() => {
    // No APK local, não iniciamos listener de autenticação web para evitar checagens desnecessárias
    if (isAndroid) {
      setIsAuthLoading(false);
      return;
    }

    const unsubscribe = initGoogleAuth(
      (user, token) => {
        setCurrentUser(user);
        if (token) {
          setCachedAccessToken(token);
        }
        setIsAuthLoading(false);
      },
      () => {
        setCurrentUser(null);
        setCachedAccessToken(null);
        setIsAuthLoading(false);
      }
    );
    return () => unsubscribe();
  }, [isAndroid]);

  const handleSignIn = async () => {
    if (isAndroid) {
      if (onTriggerLocalBackup) {
        onTriggerLocalBackup();
      }
      return;
    }

    setIsAuthLoading(true);
    setSyncError(null);
    try {
      const { user, accessToken } = await signInWithGoogle();
      setCurrentUser(user);
      onShowToast(`Conectado como ${user.displayName || user.email}!`);
      // Ao conectar pela primeira vez, executa uma sincronização inteligente inicial
      await performSync(accessToken);
    } catch (err: any) {
      console.error('Falha no login Google:', err);
      if (err.code !== 'auth/popup-closed-by-user') {
        setSyncError(
          err.message || 'Não foi possível conectar ao Google. Verifique sua conexão e tente novamente.'
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
      setSyncStatus(null);
      setSyncError(null);
      onShowToast('Desconectado do Google Drive.');
    } catch (err) {
      console.error('Erro ao sair:', err);
    }
  };

  const handleCopyWebUrl = () => {
    const webUrl = window.location.origin;
    navigator.clipboard.writeText(webUrl);
    setCopiedWebUrl(true);
    onShowToast('Link da versão web copiado para a Área de Transferência!');
    setTimeout(() => setCopiedWebUrl(false), 3000);
  };

  const getValidAccessToken = async (): Promise<string> => {
    const cached = getCachedAccessToken();
    if (cached) return cached;
    // Se o token em memória expirou ou a página foi recarregada, solicita reautenticação
    const { accessToken } = await signInWithGoogle();
    return accessToken;
  };

  const performSync = async (providedToken?: string) => {
    setIsSyncing(true);
    setSyncError(null);
    setSyncStatus('Localizando backup no Google Drive...');

    try {
      const token = providedToken || (await getValidAccessToken());

      // 1. Procura se já existe um backup
      const existingFile = await findDriveBackupFile(token);

      if (!existingFile) {
        // Primeiro backup: envia todos os livros locais
        setSyncStatus('Criando primeiro backup no seu Google Drive...');
        const newFile = await uploadDriveBackup(token, books, null);
        BookStorage.saveDriveFileId(newFile.id);

        const now = Date.now();
        BookStorage.saveLastSyncTime(now);
        setLastSyncTime(now);

        const msg = `Backup criado no Google Drive com ${books.length} livro(s)!`;
        setSyncStatus(msg);
        onShowToast(msg);
        return;
      }

      // 2. Se já existe, baixa o conteúdo do Drive e mescla
      BookStorage.saveDriveFileId(existingFile.id);
      setSyncStatus('Baixando versão mais recente do Google Drive...');
      const remoteBooks = await downloadDriveBackup(token, existingFile.id);

      setSyncStatus('Mesclando livros sem perda de dados...');
      const { merged, addedFromRemote, uploadedToRemote } = mergeBooks(books, remoteBooks);

      // 3. Atualiza arquivo no Drive com a lista mesclada
      setSyncStatus('Atualizando arquivo seguro no Google Drive...');
      await uploadDriveBackup(token, merged, existingFile.id);

      // 4. Salva localmente
      BookStorage.saveAllBooks(merged);
      onUpdateAllBooks(merged);

      const now = Date.now();
      BookStorage.saveLastSyncTime(now);
      setLastSyncTime(now);

      let summaryMsg = 'Sincronização concluída com sucesso!';
      if (addedFromRemote > 0 && uploadedToRemote > 0) {
        summaryMsg = `${addedFromRemote} livro(s) baixados do Drive e ${uploadedToRemote} enviados!`;
      } else if (addedFromRemote > 0) {
        summaryMsg = `${addedFromRemote} novo(s) livro(s) importados do Google Drive!`;
      } else {
        summaryMsg = 'Todos os livros sincronizados com o Google Drive!';
      }

      setSyncStatus(summaryMsg);
      onShowToast(summaryMsg);
    } catch (err: any) {
      console.error('Erro na sincronização com Drive:', err);
      setSyncError(err.message || 'Falha ao sincronizar com o Google Drive.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleConfirmRestore = () => {
    setConfirmModal({
      title: 'Restaurar Biblioteca do Google Drive?',
      description:
        'Essa ação baixará o backup do Google Drive e substituirá os livros locais pelos dados da nuvem. Recomendamos fazer um backup JSON antes caso tenha alterações não salvas.',
      onConfirm: async () => {
        setConfirmModal(null);
        setIsSyncing(true);
        setSyncError(null);
        try {
          const token = await getValidAccessToken();
          const existingFile = await findDriveBackupFile(token);
          if (!existingFile) {
            throw new Error('Nenhum backup "minha-estante-backup.json" encontrado no seu Google Drive.');
          }
          const remoteBooks = await downloadDriveBackup(token, existingFile.id);
          BookStorage.saveAllBooks(remoteBooks);
          onUpdateAllBooks(remoteBooks);

          const now = Date.now();
          BookStorage.saveLastSyncTime(now);
          setLastSyncTime(now);

          onShowToast(`${remoteBooks.length} livro(s) restaurados do Google Drive com sucesso!`);
          setSyncStatus(`Restaurados ${remoteBooks.length} livro(s) do Google Drive.`);
        } catch (err: any) {
          setSyncError(err.message || 'Erro ao restaurar do Google Drive.');
        } finally {
          setIsSyncing(false);
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
                Seus livros sincronizados entre dispositivos pelo seu próprio Google Drive
              </p>
            </div>
          </div>

          <span
            className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider"
            style={{
              backgroundColor: '#10b98115',
              color: '#059669',
              border: '1px solid #10b98135',
            }}
          >
            Zero Servidor
          </span>
        </div>

        {/* Explicação de Privacidade e Custo */}
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
            <span>Privacidade total & Custo zero para você e seus amigos:</span>
          </div>
          <p className="opacity-90">
            O aplicativo conecta-se diretamente à conta Google de quem estiver usando. Cada usuário salva seu próprio arquivo <strong>minha-estante-backup.json</strong> no seu respectivo Google Drive, garantindo privacidade absoluta e sem depender de servidores centralizados.
          </p>
        </div>

        {/* Aviso e Modo Aplicativo Android (.APK) */}
        {isAndroid ? (
          <div className="flex flex-col gap-3 pt-1">
            <div
              className="p-3.5 rounded-xl border text-xs leading-relaxed flex flex-col gap-2.5"
              style={{
                backgroundColor: '#3b82f612',
                borderColor: '#3b82f635',
                color: palette.textOnPaper,
              }}
            >
              <div className="flex items-center gap-2 font-bold text-blue-950 font-serif text-sm">
                <ShieldCheck size={18} className="text-blue-600 shrink-0" />
                <span>Como usar o Google Drive no Aplicativo do Smartphone:</span>
              </div>
              <p className="opacity-95 leading-relaxed">
                Por diretrizes de segurança do Google (OAuth 2.0 / RFC 8252), logins com tela pop-up são bloqueados dentro de WebViews locais sem domínio web oficial registrado.
              </p>
              <div className="bg-white/80 dark:bg-black/20 p-2.5 rounded-lg border border-blue-200/50 flex flex-col gap-1.5">
                <div className="font-bold text-blue-900 font-serif flex items-center gap-1.5">
                  <span>✨ Método Nativo Recomendado (100% Grátis & Seguro):</span>
                </div>
                <p className="text-[11px] leading-relaxed opacity-90">
                  Toque no botão abaixo <strong>"Salvar Backup no Google Drive"</strong>. O seletor nativo de arquivos do seu Android se abrirá automaticamente: no menu lateral, toque na opção <strong>Google Drive</strong> e escolha sua pasta! O arquivo será salvo diretamente na nuvem da sua conta Google, sem senhas nem telas em branco.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  if (onTriggerLocalBackup) {
                    onTriggerLocalBackup();
                  } else {
                    const el = document.getElementById('sec-backup-local');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }
                }}
                className="w-full py-3 px-4 rounded-xl font-serif font-bold text-xs shadow-md flex items-center justify-center gap-2.5 cursor-pointer hover:brightness-105 active:scale-98 transition-all"
                style={{
                  backgroundColor: palette.goldPrimary,
                  color: palette.textOnGold,
                }}
              >
                <svg className="w-4 h-4" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
                  <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
                  <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47"/>
                  <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/>
                  <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
                  <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
                  <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
                </svg>
                <span>Salvar Backup no Google Drive</span>
              </button>

              <button
                type="button"
                onClick={handleCopyWebUrl}
                className="w-full py-3 px-3 rounded-xl font-serif font-bold text-xs border flex items-center justify-center gap-2 cursor-pointer hover:bg-black/5 active:scale-98 transition-all"
                style={{
                  borderColor: palette.woodBorder,
                  color: palette.textOnPaper,
                }}
              >
                <Cloud size={15} />
                <span>{copiedWebUrl ? 'Link Copiado!' : 'Copiar Link da Versão Web'}</span>
              </button>
            </div>
          </div>
        ) : (
          /* Modo Web (Navegador Desktop ou Mobile com suporte total a OAuth) */
          <>
            {!currentUser && (
              <div className="flex flex-col gap-2.5 pt-1">
                {/* Dica essencial para marcar a caixinha de permissão do Google */}
                <div
                  className="p-2.5 rounded-lg border text-[11px] leading-relaxed flex items-center gap-2"
                  style={{
                    backgroundColor: '#fef3c730',
                    borderColor: '#f59e0b40',
                    color: palette.textOnPaper,
                  }}
                >
                  <AlertCircle size={15} className="text-amber-600 shrink-0" />
                  <span>
                    <strong>Importante:</strong> Ao abrir a tela do Google, <u>marque a caixinha de autorização</u> para permitir que o BookNook crie o arquivo de backup no seu Drive.
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleSignIn}
                  disabled={isAuthLoading}
                  className="w-full py-3 px-4 rounded-xl font-serif font-bold text-sm shadow-md flex items-center justify-center gap-3 cursor-pointer hover:brightness-105 active:scale-98 transition-all disabled:opacity-60"
                  style={{
                    backgroundColor: '#FFFFFF',
                    color: '#3c4043',
                    border: '1px solid #dadce0',
                  }}
                >
                  {isAuthLoading ? (
                    <>
                      <Loader2 size={18} className="animate-spin text-blue-600" />
                      <span>Conectando com o Google...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" viewBox="0 0 48 48">
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                      </svg>
                      <span>Conectar com Google Drive</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </>
        )}

        {/* Estado: Usuário Autenticado */}
        {currentUser && (
          <div className="flex flex-col gap-3 pt-1">
            {/* Informações da Conta Conectada */}
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
                    className="w-9 h-9 rounded-full border shadow-xs object-cover"
                    style={{ borderColor: palette.woodBorder }}
                  />
                ) : (
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm"
                    style={{ backgroundColor: palette.goldPrimary, color: palette.textOnGold }}
                  >
                    {(currentUser.displayName || currentUser.email || 'U')[0].toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-serif font-bold text-xs truncate" style={{ color: palette.textOnPaper }}>
                    {currentUser.displayName || 'Usuário Google'}
                  </p>
                  <p className="text-[11px] truncate opacity-80" style={{ color: palette.textSecondaryOnPaper }}>
                    {currentUser.email}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSignOut}
                className="py-1 px-2.5 rounded-lg border text-xs font-serif flex items-center gap-1.5 cursor-pointer hover:bg-red-500/10 text-red-700 active:scale-95 transition-all"
                style={{ borderColor: '#ef444440' }}
                title="Desconectar conta Google"
              >
                <LogOut size={13} />
                <span>Sair</span>
              </button>
            </div>

            {/* Status e Timestamp de Sincronização */}
            <div className="flex items-center justify-between text-xs px-1">
              <span className="flex items-center gap-1.5" style={{ color: palette.textSecondaryOnPaper }}>
                <Cloud size={14} className="text-blue-600" />
                {lastSyncTime ? (
                  <span>
                    Última sincronização: <strong>{new Date(lastSyncTime).toLocaleDateString('pt-BR')}</strong> às{' '}
                    <strong>{new Date(lastSyncTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</strong>
                  </span>
                ) : (
                  <span>Nenhum backup enviado ainda</span>
                )}
              </span>

              <span className="font-mono text-[11px] opacity-75">
                {books.length} livro(s) na estante
              </span>
            </div>

            {/* Botão Principal de Sincronização */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => performSync()}
                disabled={isSyncing}
                className="py-2.5 px-4 rounded-xl font-serif font-bold text-xs shadow-md flex items-center justify-center gap-2 cursor-pointer hover:brightness-105 active:scale-98 transition-all disabled:opacity-60"
                style={{
                  backgroundColor: palette.goldPrimary,
                  color: palette.textOnGold,
                }}
              >
                {isSyncing ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Sincronizando com o Drive...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw size={15} />
                    <span>Sincronizar com Google Drive</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleConfirmRestore}
                disabled={isSyncing}
                className="py-2.5 px-3 rounded-xl font-serif font-bold text-xs border flex items-center justify-center gap-2 cursor-pointer hover:bg-black/5 active:scale-98 transition-all disabled:opacity-60"
                style={{
                  borderColor: palette.woodBorder,
                  color: palette.textOnPaper,
                }}
              >
                <DownloadCloud size={15} />
                <span>Restaurar do Drive</span>
              </button>
            </div>
          </div>
        )}

        {/* Mensagens de feedback */}
        {syncStatus && (
          <div className="flex items-center gap-2 text-xs font-serif font-semibold text-emerald-800 bg-emerald-50 border border-emerald-300 rounded-lg p-2.5 animate-in fade-in">
            <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
            <span>{syncStatus}</span>
          </div>
        )}

        {syncError && (
          <div className="flex items-center gap-2 text-xs font-serif font-semibold text-red-800 bg-red-50 border border-red-300 rounded-lg p-2.5 animate-in fade-in">
            <AlertCircle size={16} className="shrink-0 text-red-600" />
            <span>{syncError}</span>
          </div>
        )}
      </PaperCard>

      {/* Modal de Confirmação Obrigatório para Operações Destrutivas */}
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
                Confirmar Restauração
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
