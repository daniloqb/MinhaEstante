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

const TOKEN_KEY = 'minha_estante_drive_access_token';
const USER_KEY = 'minha_estante_drive_user_cache';

// Cache de token em memória e persistido localmente para manter a conexão ativa
let cachedAccessToken: string | null =
  typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
let isSigningIn = false;

export interface CachedGoogleUser {
  displayName?: string | null;
  email?: string | null;
  photoURL?: string | null;
}

export const getStoredGoogleUser = (): CachedGoogleUser | null => {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const setStoredGoogleUser = (user: CachedGoogleUser | null) => {
  if (typeof localStorage === 'undefined') return;
  if (user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(USER_KEY);
  }
};

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

    setCachedAccessToken(token);
    setStoredGoogleUser({
      displayName: result.user.displayName,
      email: result.user.email,
      photoURL: result.user.photoURL,
    });
    return { user: result.user, accessToken: token };
  } catch (error: any) {
    console.error('Erro ao conectar com Google:', error);
    if (error.code === 'auth/unauthorized-domain') {
      throw new Error(
        'Domínio não cadastrado no Firebase Auth. Adicione "appassets.androidplatform.net" no Firebase Console (Authentication > Settings > Authorized Domains).'
      );
    }
    if (error.code === 'auth/popup-blocked') {
      throw new Error(
        'A janela de login do Google foi bloqueada. Por favor, permita pop-ups para conectar com o Google Drive.'
      );
    }
    if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
      throw new Error('Login com o Google cancelado.');
    }
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getCachedAccessToken = (): string | null => {
  if (cachedAccessToken) return cachedAccessToken;
  if (typeof localStorage !== 'undefined') {
    return localStorage.getItem(TOKEN_KEY);
  }
  return null;
};

export const setCachedAccessToken = (token: string | null) => {
  cachedAccessToken = token;
  if (typeof localStorage !== 'undefined') {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  }
};

export const signOutGoogle = async (): Promise<void> => {
  try {
    await signOut(auth);
  } catch (e) {
    console.warn('Erro ao chamar signOut do Firebase:', e);
  }
  setCachedAccessToken(null);
  setStoredGoogleUser(null);
};

export const getCurrentGoogleUser = (): User | null => {
  return auth.currentUser;
};
