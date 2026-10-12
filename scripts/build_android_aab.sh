#!/usr/bin/env bash
# Minha Estante: AAB release via Vite + Capacitor + Gradle + jarsigner.
set -Eeuo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

fail() { echo "ERRO: $*" >&2; exit 1; }
require() { command -v "$1" >/dev/null 2>&1 || fail "Ferramenta ausente: $1"; }
require npm
require npx
require java
require keytool
require jarsigner

KEYSTORE="${ANDROID_KEYSTORE_PATH:-}"
if [[ -z "$KEYSTORE" ]]; then
  for candidate in "$HOME/.android/keystores/booknook-release-key.jks" "$ROOT/booknook-release-key.jks"; do
    if [[ -f "$candidate" ]]; then KEYSTORE="$candidate"; break; fi
  done
fi
if [[ -d "$KEYSTORE" ]]; then KEYSTORE="$KEYSTORE/booknook-release-key.jks"; fi
[[ -f "$KEYSTORE" ]] || fail "Keystore não encontrado. Configure ANDROID_KEYSTORE_PATH com o caminho do booknook-release-key.jks."
KEYSTORE="$(cd -- "$(dirname -- "$KEYSTORE")" && pwd)/$(basename -- "$KEYSTORE")"
KEY_ALIAS="${ANDROID_KEY_ALIAS:-booknook}"

if [[ -z "${ANDROID_KEYSTORE_PASSWORD:-}" ]]; then
  read -r -s -p "Senha do keystore: " ANDROID_KEYSTORE_PASSWORD </dev/tty || fail "Defina ANDROID_KEYSTORE_PASSWORD."
  echo >&2
fi
export ANDROID_KEYSTORE_PASSWORD
if [[ -z "${ANDROID_KEY_PASSWORD:-}" ]]; then
  ANDROID_KEY_PASSWORD="$ANDROID_KEYSTORE_PASSWORD"
fi
export ANDROID_KEY_PASSWORD

keytool -list -keystore "$KEYSTORE" -alias "$KEY_ALIAS" \
  -storepass:env ANDROID_KEYSTORE_PASSWORD >/dev/null || fail "Não foi possível abrir o keystore/alias."

[[ -x "$ROOT/android/gradlew" ]] || fail "android/gradlew não encontrado ou sem permissão de execução."

printf '\n==> TypeScript, Vite e sincronização Capacitor\n'
npm run lint
npx vite build
npx cap sync android

printf '\n==> Compilação Android App Bundle release (Gradle)\n'
(cd "$ROOT/android" && ./gradlew bundleRelease)

SOURCE_AAB="$ROOT/android/app/build/outputs/bundle/release/app-release.aab"
[[ -f "$SOURCE_AAB" ]] || fail "AAB não encontrado em $SOURCE_AAB"
OUT_DIR="$ROOT/release"
mkdir -p "$OUT_DIR"
TARGET="$OUT_DIR/minha-estante-release.aab"

printf '\n==> Assinando AAB com a chave existente\n'
rm -f -- "$TARGET"
jarsigner \
  -sigalg SHA256withRSA \
  -digestalg SHA-256 \
  -keystore "$KEYSTORE" \
  -storepass:env ANDROID_KEYSTORE_PASSWORD \
  -keypass:env ANDROID_KEY_PASSWORD \
  -signedjar "$TARGET" \
  "$SOURCE_AAB" "$KEY_ALIAS"

printf '\n==> Verificando assinatura AAB\n'
VERIFY_OUTPUT="$(jarsigner -verify "$TARGET")" || fail "Falha na verificação da assinatura AAB."
printf '%s\n' "$VERIFY_OUTPUT"
[[ "$VERIFY_OUTPUT" == *"jar verified."* ]] || fail "O AAB não foi verificado como assinado."
printf '\nAAB assinado e verificado: %s\n' "$TARGET"
