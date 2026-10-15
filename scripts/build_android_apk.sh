#!/usr/bin/env bash
# Minha Estante: APK release via Vite + Capacitor + Gradle + apksigner.
set -Eeuo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

fail() { echo "ERRO: $*" >&2; exit 1; }
require() { command -v "$1" >/dev/null 2>&1 || fail "Ferramenta ausente: $1"; }
require npm
require npx
require java
require keytool
require find
require sort

# Aceita caminho para o arquivo .jks ou para a pasta que o contém.
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
  # Caso não exista senha separada, assume a mesma senha do keystore.
  ANDROID_KEY_PASSWORD="$ANDROID_KEYSTORE_PASSWORD"
fi
export ANDROID_KEY_PASSWORD

keytool -list -keystore "$KEYSTORE" -alias "$KEY_ALIAS" \
  -storepass:env ANDROID_KEYSTORE_PASSWORD >/dev/null || fail "Não foi possível abrir o keystore/alias."

# Gradle precisa localizar o SDK inclusive quando o script e chamado pelo npm.
SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Android/Sdk}}"
[[ -d "$SDK/platforms" && -d "$SDK/build-tools" ]] || fail "Android SDK invalido: $SDK"
SDK="$(cd -- "$SDK" && pwd)"
export ANDROID_HOME="$SDK"
export ANDROID_SDK_ROOT="$SDK"
# local.properties e especifico desta maquina e nao deve ser versionado.
printf 'sdk.dir=%s\n' "$SDK" > "$ROOT/android/local.properties"

BUILD_TOOLS="$(find "$SDK/build-tools" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort -V | tail -n 1)"
[[ -n "$BUILD_TOOLS" ]] || fail "Nenhuma versão de Android Build Tools instalada."
ZIPALIGN="$SDK/build-tools/$BUILD_TOOLS/zipalign"
APKSIGNER="$SDK/build-tools/$BUILD_TOOLS/apksigner"
[[ -x "$ZIPALIGN" && -x "$APKSIGNER" ]] || fail "zipalign/apksigner não disponíveis em $SDK/build-tools/$BUILD_TOOLS"
[[ -x "$ROOT/android/gradlew" ]] || fail "android/gradlew não encontrado ou sem permissão de execução."


printf '\n==> TypeScript, Vite e sincronização Capacitor\n'
npm run lint
npx vite build
npx cap sync android

printf '\n==> Compilação Android release (Gradle)\n'
(cd "$ROOT/android" && ./gradlew assembleRelease)

APK_DIR="$ROOT/android/app/build/outputs/apk/release"
SOURCE_APK="$APK_DIR/app-release-unsigned.apk"
[[ -f "$SOURCE_APK" ]] || SOURCE_APK="$APK_DIR/app-release.apk"
[[ -f "$SOURCE_APK" ]] || fail "APK release não encontrado em $APK_DIR"

OUT_DIR="$ROOT/release"
mkdir -p "$OUT_DIR"
ALIGNED="$OUT_DIR/.minha-estante-aligned.apk"
TARGET="$OUT_DIR/minha-estante-release.apk"
trap 'rm -f -- "$ALIGNED"' EXIT

printf '\n==> Alinhando e assinando com a chave existente\n'
"$ZIPALIGN" -f -p 4 "$SOURCE_APK" "$ALIGNED"
"$APKSIGNER" sign \
  --ks "$KEYSTORE" \
  --ks-key-alias "$KEY_ALIAS" \
  --ks-pass env:ANDROID_KEYSTORE_PASSWORD \
  --key-pass env:ANDROID_KEY_PASSWORD \
  --out "$TARGET" "$ALIGNED"
"$APKSIGNER" verify --verbose --print-certs "$TARGET"
"$ZIPALIGN" -c -p 4 "$TARGET"
printf '\nAPK assinado e verificado: %s\n' "$TARGET"
