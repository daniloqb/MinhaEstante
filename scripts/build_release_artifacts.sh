#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

fail() { printf '\nERRO: %s\n' "$*" >&2; exit 1; }
usage() {
  cat <<'USAGE'
Uso:
  npm run build:release -- --version-code 19 --version-name 1.0.19
  bash scripts/build_release_artifacts.sh --version-code 19 --version-name 1.0.19

A versão é gravada em android/app/build.gradle (versionCode/versionName).
Use um versionCode MAIOR do que os códigos enviados anteriormente à Play Console.
Variáveis opcionais:
  ANDROID_HOME               (padrão: $HOME/Android/Sdk)
  ANDROID_KEYSTORE_PATH      (padrão: booknook-release-key.jks na raiz)
  ANDROID_KEY_ALIAS          (padrão: booknook)
  ANDROID_KEYSTORE_PASSWORD  (solicitada se ausente)
  ANDROID_KEY_PASSWORD       (solicitada separadamente se ausente)
USAGE
}

VERSION_CODE=''
VERSION_NAME=''
while (($#)); do
  case "$1" in
    --version-code) (($# >= 2)) || fail 'Falta valor de --version-code'; VERSION_CODE="$2"; shift 2 ;;
    --version-name) (($# >= 2)) || fail 'Falta valor de --version-name'; VERSION_NAME="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) fail "Argumento não reconhecido: $1" ;;
  esac
done
[[ "$VERSION_CODE" =~ ^[1-9][0-9]*$ ]] || fail 'Informe --version-code como inteiro positivo.'
(( ${#VERSION_CODE} <= 10 )) || fail 'versionCode fora do intervalo permitido.'
(( 10#$VERSION_CODE <= 2100000000 )) || fail 'versionCode deve ser <= 2100000000.'
[[ "$VERSION_NAME" =~ ^[0-9]+\.[0-9]+(\.[0-9]+)?([.-][A-Za-z0-9]+)*$ ]] || fail 'Informe --version-name, ex.: 1.0.19.'

for binary in java keytool npm npx python3; do
  command -v "$binary" >/dev/null 2>&1 || fail "Ferramenta não encontrada: $binary"
done
[[ -f "$ROOT/android/app/build.gradle" ]] || fail 'android/app/build.gradle não encontrado; projeto Groovy Gradle esperado.'
[[ -f "$ROOT/android/gradlew" ]] || fail 'android/gradlew não encontrado.'

SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Android/Sdk}}"
[[ -d "$SDK/platforms" && -d "$SDK/build-tools" ]] || fail "Android SDK não encontrado em $SDK"
export ANDROID_HOME="$SDK" ANDROID_SDK_ROOT="$SDK"
printf 'sdk.dir=%s\n' "$SDK" > "$ROOT/android/local.properties"

# Resolver apksigner e apkanalyzer instalados no SDK (sem baixar nada).
BUILD_TOOLS="$(find "$SDK/build-tools" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort -V | tail -n 1)"
[[ -n "$BUILD_TOOLS" ]] || fail 'Nenhuma versão de Android Build Tools encontrada.'
APKSIGNER="$SDK/build-tools/$BUILD_TOOLS/apksigner"
[[ -x "$APKSIGNER" ]] || fail "apksigner não encontrado: $APKSIGNER"
APKANALYZER="$SDK/cmdline-tools/latest/bin/apkanalyzer"
AAPT="$SDK/build-tools/$BUILD_TOOLS/aapt"

KEYSTORE="${ANDROID_KEYSTORE_PATH:-$ROOT/booknook-release-key.jks}"
[[ -f "$KEYSTORE" ]] || fail "Keystore existente não encontrado: $KEYSTORE (nunca será criado automaticamente)"
KEY_ALIAS="${ANDROID_KEY_ALIAS:-booknook}"
[[ -n "$KEY_ALIAS" ]] || fail 'Alias não pode ser vazio.'
export ANDROID_KEYSTORE_PATH="$KEYSTORE" ANDROID_KEY_ALIAS="$KEY_ALIAS"

if [[ -z "${ANDROID_KEYSTORE_PASSWORD:-}" ]]; then
  [[ -t 0 ]] || fail 'ANDROID_KEYSTORE_PASSWORD ausente e terminal não interativo.'
  read -r -s -p 'Senha do keystore: ' ANDROID_KEYSTORE_PASSWORD; printf '\n'
  export ANDROID_KEYSTORE_PASSWORD
fi
if [[ -z "${ANDROID_KEY_PASSWORD:-}" ]]; then
  [[ -t 0 ]] || fail 'ANDROID_KEY_PASSWORD ausente e terminal não interativo.'
  read -r -s -p 'Senha da chave privada (pode ser igual à do keystore): ' ANDROID_KEY_PASSWORD; printf '\n'
  export ANDROID_KEY_PASSWORD
fi
[[ -n "$ANDROID_KEYSTORE_PASSWORD" && -n "$ANDROID_KEY_PASSWORD" ]] || fail 'Senhas vazias não são permitidas.'
keytool -list -keystore "$KEYSTORE" -alias "$KEY_ALIAS" -storepass:env ANDROID_KEYSTORE_PASSWORD >/dev/null \
  || fail 'Não foi possível abrir o keystore/alias. Confira a senha e o alias.'

printf '\n==> Atualizando versão Android: code=%s, name=%s\n' "$VERSION_CODE" "$VERSION_NAME"
# Grava a versão NATIVA persistente, nunca somente no nome do arquivo.
# Rejeita sintaxes desconhecidas para evitar builds com versões incorretas.
VERSION_CODE="$VERSION_CODE" VERSION_NAME="$VERSION_NAME" python3 - "$ROOT/android/app/build.gradle" <<'PY'
import os, pathlib, re, sys
p = pathlib.Path(sys.argv[1]); source = p.read_text()
match = re.search(r'\bdefaultConfig\s*\{', source)
if not match:
    sys.exit('ERRO: defaultConfig não encontrado no build.gradle')
start = match.end(); level = 1; i = start
while i < len(source) and level:
    if source[i] == '{': level += 1
    elif source[i] == '}': level -= 1
    i += 1
if level: sys.exit('ERRO: chaves do defaultConfig inválidas')
part = source[start:i-1]
patterns = {
    'versionCode': (r'(?m)^(\s*versionCode\s*(?:=\s*)?)([^\r\n]+)', os.environ['VERSION_CODE']),
    'versionName': (r'(?m)^(\s*versionName\s*(?:=\s*)?)([^\r\n]+)', '"'+os.environ['VERSION_NAME']+'"'),
}
for field, (pattern, replacement) in patterns.items():
    matches = list(re.finditer(pattern, part))
    if len(matches) != 1:
        sys.exit(f'ERRO: esperado exatamente um {field} em defaultConfig; encontrados {len(matches)}. Nenhuma alteração feita.')
    part = re.sub(pattern, lambda m: m.group(1)+replacement, part, count=1)
updated = source[:start]+part+source[i-1:]
if updated != source:
    p.write_text(updated)
print('android/app/build.gradle atualizado.')
PY

echo '==> Verificando TypeScript e testes'
npm run lint
npm test

echo '==> Compilando frontend e sincronizando plugins Capacitor'
npx vite build
npx cap sync android

echo '==> Gerando APK e AAB com Gradle e assinatura nativa configurada'
(
  cd "$ROOT/android"
  bash ./gradlew clean assembleRelease bundleRelease --no-daemon
)

SOURCE_APK="$ROOT/android/app/build/outputs/apk/release/app-release.apk"
SOURCE_AAB="$ROOT/android/app/build/outputs/bundle/release/app-release.aab"
[[ -s "$SOURCE_APK" ]] || fail "APK release assinado não encontrado: $SOURCE_APK. Verifique signingConfigs.release no Gradle."
[[ -s "$SOURCE_AAB" ]] || fail "AAB release não encontrado: $SOURCE_AAB"
"$APKSIGNER" verify --verbose --print-certs "$SOURCE_APK" || fail 'Assinatura APK inválida.'
# AAB é um JAR assinado. Não reinscrever assinatura: o Gradle é fonte única.
command -v jarsigner >/dev/null || fail 'jarsigner não encontrado.'
jarsigner -verify "$SOURCE_AAB" || fail 'Assinatura AAB inválida.'

if [[ -x "$APKANALYZER" ]]; then
  REAL_CODE="$("$APKANALYZER" manifest version-code "$SOURCE_APK")"
  REAL_NAME="$("$APKANALYZER" manifest version-name "$SOURCE_APK")"
elif [[ -x "$AAPT" ]]; then
  BADGING="$("$AAPT" dump badging "$SOURCE_APK")"
  REAL_CODE="$(sed -n "s/.*versionCode='\([^']*\)'.*/\1/p" <<< "$BADGING" | head -1)"
  REAL_NAME="$(sed -n "s/.*versionName='\([^']*\)'.*/\1/p" <<< "$BADGING" | head -1)"
else
  fail 'Nem apkanalyzer nem aapt disponíveis para confirmar a versão real.'
fi
[[ "$REAL_CODE" == "$VERSION_CODE" && "$REAL_NAME" == "$VERSION_NAME" ]] || \
  fail "Versão real do APK ($REAL_CODE/$REAL_NAME) diferente da solicitada ($VERSION_CODE/$VERSION_NAME)."

OUT_DIR="$ROOT/release"
mkdir -p "$OUT_DIR"
APK_FINAL="$OUT_DIR/booknook-v${VERSION_NAME}-build${VERSION_CODE}.apk"
AAB_FINAL="$OUT_DIR/booknook-v${VERSION_NAME}-build${VERSION_CODE}.aab"
cp -f "$SOURCE_APK" "$APK_FINAL"
cp -f "$SOURCE_AAB" "$AAB_FINAL"

printf '\n=== SUCESSO ===\nAPK: %s\nAAB: %s\nVersion Code: %s\nVersion Name: %s\n' \
  "$APK_FINAL" "$AAB_FINAL" "$REAL_CODE" "$REAL_NAME"
echo 'Confirme na Play Console que este versionCode não foi utilizado anteriormente.'
