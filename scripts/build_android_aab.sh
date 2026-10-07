#!/bin/bash
set -e

APP_ROOT="$(pwd)"
WORKDIR="/tmp/aab_pkg"
ANDROID_JAR="/usr/local/lib/android.jar"
BUNDLETOOL="/usr/local/bin/bundletool.jar"
KEYSTORE_PATH="$APP_ROOT/booknook-release-key.jks"
KEYSTORE_PASS="booknook123"
KEY_ALIAS="booknook"

echo "=== INICIANDO CONSTRUÇÃO DO ANDROID APP BUNDLE (.AAB) PARA GOOGLE PLAY ==="

# 1. Verificar ferramentas
if ! command -v aapt2 &> /dev/null; then
    echo "Erro: aapt2 não encontrado."
    exit 1
fi

if [ ! -f "$BUNDLETOOL" ]; then
    echo "Erro: bundletool.jar não encontrado em $BUNDLETOOL."
    exit 1
fi

if [ ! -f "$ANDROID_JAR" ]; then
    echo "Erro: android.jar não encontrado em $ANDROID_JAR."
    exit 1
fi

# 2. Compilar assets do Vite se a pasta dist não existir
if [ ! -d "$APP_ROOT/dist" ]; then
    echo "Compilando web app com Vite..."
    npx vite build
fi

# 3. Limpar diretório temporário
rm -rf "$WORKDIR"
mkdir -p "$WORKDIR/res/values"
mkdir -p "$WORKDIR/res/drawable"
mkdir -p "$WORKDIR/assets"
mkdir -p "$WORKDIR/base_module/manifest"
mkdir -p "$WORKDIR/base_module/dex"
mkdir -p "$WORKDIR/base_module/assets"

# 4. Copiar assets do Vite para a pasta de assets do bundle
echo "Copiando assets do web app..."
cp -r "$APP_ROOT/dist/"* "$WORKDIR/base_module/assets/"
rm -f "$WORKDIR/base_module/assets/"*.apk "$WORKDIR/base_module/assets/"*.aab 2>/dev/null || true

# 5. Ajustar index.html para compatibilidade com WebView offline se necessário
if [ -f "$WORKDIR/base_module/assets/index.html" ]; then
    sed -i 's/<script type="module" crossorigin src="/<script defer src="/g' "$WORKDIR/base_module/assets/index.html" 2>/dev/null || true
    sed -i 's/<script type="module" src="/<script defer src="/g' "$WORKDIR/base_module/assets/index.html" 2>/dev/null || true
fi

# 6. Copiar ícones
if [ -f "$APP_ROOT/public/pwa-192x192.png" ]; then
    cp "$APP_ROOT/public/pwa-192x192.png" "$WORKDIR/res/drawable/ic_launcher.png"
fi

# 7. Recursos (strings.xml)
cat << 'XML' > "$WORKDIR/res/values/strings.xml"
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">BookNook</string>
</resources>
XML

# 8. AndroidManifest.xml em conformidade com Google Play Console
cat << 'XML' > "$WORKDIR/AndroidManifest.xml"
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.daniloqb.booknook"
    android:versionCode="1"
    android:versionName="1.0.0">

    <uses-sdk android:minSdkVersion="21" android:targetSdkVersion="34" />
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-feature android:name="android.hardware.camera" android:required="false" />
    <uses-feature android:name="android.hardware.camera.autofocus" android:required="false" />

    <application
        android:label="@string/app_name"
        android:icon="@drawable/ic_launcher"
        android:theme="@android:style/Theme.NoTitleBar"
        android:hardwareAccelerated="true"
        android:supportsRtl="true"
        android:usesCleartextTraffic="true">
        <activity
            android:name="com.aistudio.minhaestante.vbrkxp.MainActivity"
            android:label="@string/app_name"
            android:configChanges="orientation|screenSize|keyboardHidden"
            android:windowSoftInputMode="adjustResize"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
XML

# 9. Compilar recursos com aapt2
echo "Compilando recursos com aapt2..."
aapt2 compile --dir "$WORKDIR/res" -o "$WORKDIR/compiled_res.zip"

# 10. Linkar em proto format (obrigatório para App Bundle)
echo "Linkando em formato proto..."
aapt2 link --proto-format \
    -o "$WORKDIR/base_proto.apk" \
    -I "$ANDROID_JAR" \
    --manifest "$WORKDIR/AndroidManifest.xml" \
    "$WORKDIR/compiled_res.zip" \
    --auto-add-overlay

# 11. Montar estrutura do módulo base para bundletool
echo "Montando módulo base..."
unzip -q "$WORKDIR/base_proto.apk" -d "$WORKDIR/unpacked_proto/"
mv "$WORKDIR/unpacked_proto/AndroidManifest.xml" "$WORKDIR/base_module/manifest/"
mv "$WORKDIR/unpacked_proto/resources.pb" "$WORKDIR/base_module/"
if [ -d "$WORKDIR/unpacked_proto/res" ]; then
    mv "$WORKDIR/unpacked_proto/res" "$WORKDIR/base_module/"
fi

# Incluir classes.dex
if [ -f "$APP_ROOT/public/minha-estante.apk" ]; then
    unzip -p "$APP_ROOT/public/minha-estante.apk" classes.dex > "$WORKDIR/base_module/dex/classes.dex"
elif [ -f "$APP_ROOT/app-debug.apk" ]; then
    unzip -p "$APP_ROOT/app-debug.apk" classes.dex > "$WORKDIR/base_module/dex/classes.dex"
fi

# Compactar base.zip
cd "$WORKDIR/base_module"
zip -q -r "$WORKDIR/base.zip" .
cd "$APP_ROOT"

# 12. Construir o Android App Bundle (.aab)
echo "Construindo arquivo .aab com bundletool..."
java -jar "$BUNDLETOOL" build-bundle \
    --modules="$WORKDIR/base.zip" \
    --output="$WORKDIR/booknook-unsigned.aab" \
    --overwrite

# 13. Gerar Keystore de Upload se ainda não existir
if [ ! -f "$KEYSTORE_PATH" ]; then
    echo "Gerando Keystore de Produção (booknook-release-key.jks)..."
    keytool -genkeypair -v \
        -keystore "$KEYSTORE_PATH" \
        -alias "$KEY_ALIAS" \
        -keyalg RSA \
        -keysize 2048 \
        -validity 10000 \
        -storepass "$KEYSTORE_PASS" \
        -keypass "$KEYSTORE_PASS" \
        -dname "CN=Danilo Queiroz Barbosa, OU=BookNook, O=BookNook, L=Sao Paulo, ST=SP, C=BR"
fi

# 14. Assinar o .aab com jarsigner
echo "Assinando o arquivo .aab com a chave de upload..."
cp "$WORKDIR/booknook-unsigned.aab" "$WORKDIR/booknook.aab"
jarsigner \
    -keystore "$KEYSTORE_PATH" \
    -storepass "$KEYSTORE_PASS" \
    -keypass "$KEYSTORE_PASS" \
    "$WORKDIR/booknook.aab" \
    "$KEY_ALIAS"

# 15. Validar o .aab gerado
echo "Validando App Bundle com bundletool..."
java -jar "$BUNDLETOOL" validate --bundle="$WORKDIR/booknook.aab"

# 16. Copiar para a raiz, public e docs
cp "$WORKDIR/booknook.aab" "$APP_ROOT/booknook.aab"
mkdir -p "$APP_ROOT/public" "$APP_ROOT/docs"
cp "$WORKDIR/booknook.aab" "$APP_ROOT/public/booknook.aab"
cp "$WORKDIR/booknook.aab" "$APP_ROOT/docs/booknook.aab"

echo "=== SUCESSO! ARQUIVO .AAB GERADO COM SUCESSO ==="
ls -lh "$APP_ROOT/booknook.aab"

# 17. Obter Fingerprints SHA-256 e SHA-1
echo ""
echo "=== CHAVE DE ASSINATURA / FINGERPRINTS PARA GOOGLE PLAY ==="
keytool -list -v -keystore "$KEYSTORE_PATH" -alias "$KEY_ALIAS" -storepass "$KEYSTORE_PASS" | grep -E "SHA1|SHA256" || true
echo "=========================================================="
