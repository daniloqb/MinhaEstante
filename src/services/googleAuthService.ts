import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/drive.file');
provider.setCustomParameters({
  prompt: 'consent select_account',
  access_type: 'offline',
  include_granted_scopes: 'true',
});

// Cache de token em memória (MANDATÓRIO pela política de segurança)
let cachedAccessToken: string | null = null;
let isSigningIn = false;

export const isLocalAndroidApp = (): boolean => {
  if (typeof window === 'undefined') return false;
  const win = window as any;
  if (win.AndroidApp) return true;
  if (window.location.hostname === 'appassets') return true;
  if (window.location.protocol === 'file:') return true;
  return false;
};

/**
 * Valida se o access token recebido possui de fato as permissões necessárias para o Google Drive.
 * Isso detecta imediatamente se o usuário desmarcou a caixinha de autorização do Drive na tela do Google.
 */
export const verifyDriveScope = async (token: string): Promise<boolean> => {
  try {
    const res = await fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${encodeURIComponent(token)}`);
    if (!res.ok) return false;
    const data = await res.json();
    const scopes: string = data.scope || '';
    return (
      scopes.includes('drive.file') ||
      scopes.includes('drive.appdata') ||
      scopes.includes('/auth/drive')
    );
  } catch (err) {
    console.warn('Não foi possível verificar escopos do tokeninfo:', err);
    // Em caso de falha de rede temporária no tokeninfo, deixa a API do Drive validar
    return true;
  }
};

export const initGoogleAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        if (onAuthSuccess) onAuthSuccess(user, '');
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const signInWithGoogle = async (): Promise<{ user: User; accessToken: string }> => {
  if (isLocalAndroidApp()) {
    throw new Error(
      'No aplicativo Android (.APK local), utilize a opção nativa "Salvar Backup JSON" para gravar diretamente no Google Drive do aparelho. O login web pop-up do Google requer um domínio público com certificado SSL registrado.'
    );
  }

  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error(
        'Não foi possível obter o token de acesso do Google Drive. Certifique-se de marcar a caixa de permissão do Drive na tela de login.'
      );
    }

    const token = credential.accessToken;

    // Validação ativa do escopo do Drive
    const hasDriveScope = await verifyDriveScope(token);
    if (!hasDriveScope) {
      throw new Error(
        'Atenção: A permissão para o Google Drive não foi selecionada! Ao fazer login, você deve marcar a caixinha de autorização que permite ao aplicativo criar e gerenciar arquivos no seu Google Drive. Toque em Sair e conecte novamente marcando a opção.'
      );
    }

    cachedAccessToken = token;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Erro ao conectar com Google:', error);
    if (error.code === 'auth/unauthorized-domain') {
      throw new Error(
        'Domínio não autorizado pelo Firebase. Este domínio precisa estar cadastrado na lista de Domínios Autorizados do console do Firebase/Google Cloud. No aplicativo Android, use a gravação local via Storage Access Framework.'
      );
    }
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getCachedAccessToken = (): string | null => {
  return cachedAccessToken;
};

export const setCachedAccessToken = (token: string | null) => {
  cachedAccessToken = token;
};

export const signOutGoogle = async (): Promise<void> => {
  await signOut(auth);
  cachedAccessToken = null;
};

export const getCurrentGoogleUser = (): User | null => {
  return auth.currentUser;
};
