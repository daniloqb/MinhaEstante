#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

# Dedicated temporary assets, no cap sync, no personal public/ assets, no install.
SAF_ASSETS_DIR=$(mktemp -d /tmp/minhaestante-saf-debug.XXXXXX)
node_modules/.bin/tsc --noEmit
node_modules/.bin/vite build --config vite.saf-diagnostics.config.ts --outDir "$SAF_ASSETS_DIR/public" --emptyOutDir
cp android/app/src/main/assets/capacitor.plugins.json "$SAF_ASSETS_DIR/capacitor.plugins.json"
python3 - "$SAF_ASSETS_DIR" <<'PY'
import json, pathlib, sys
config = json.loads(pathlib.Path('android/app/src/main/assets/capacitor.config.json').read_text())
config.update(appId='com.booknookapp.dev', appName='MinhaEstante DEV')
config.pop('server', None)  # No external dev server overrides; serve only packaged assets.
config['android'] = {'loggingBehavior': 'none', 'webContentsDebuggingEnabled': True}
pathlib.Path(sys.argv[1], 'capacitor.config.json').write_text(json.dumps(config))
PY

# GRADLE_BIN may name an existing local Gradle executable. No wrapper download required.
"${GRADLE_BIN:-android/gradlew}" -p android :app:assembleDebug --offline --no-daemon \
  "-PdigitalDiagnosticAssets=$SAF_ASSETS_DIR" "$@"
echo 'APK debug isolado: android/app/build/outputs/apk/debug/app-debug.apk'
echo 'Verifique applicationId e assinatura do APK antes de instalar. Este script não instala.'
