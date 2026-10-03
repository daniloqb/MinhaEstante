#!/bin/bash
set -e

APP_ROOT="$(pwd)"
WORKDIR="/tmp/android_pkg"

echo "=== INICIANDO COMPILAÇÃO DO ZERO DO APK ==="

# 1. Limpar artefatos anteriores
rm -rf "$WORKDIR"
rm -f "$APP_ROOT/minha-estante.apk" "$APP_ROOT/app-debug.apk" "$APP_ROOT/public/minha-estante.apk" "$APP_ROOT/.build-outputs/app-debug.apk"
rm -f "$APP_ROOT"/*.idsig /minha-estante.apk /minha-estante.apk.idsig 2>/dev/null || true

mkdir -p "$WORKDIR/src/com/aistudio/minhaestante/vbrkxp"
mkdir -p "$WORKDIR/res/values"
mkdir -p "$WORKDIR/res/drawable"
mkdir -p "$WORKDIR/assets"
mkdir -p "$WORKDIR/bin"

# 2. Copiar assets do build web atual do Vite (sem incluir arquivos .apk para não inflar o pacote)
echo "2. Copiando assets do Vite..."
cp -r "$APP_ROOT/dist/"* "$WORKDIR/assets/"
rm -f "$WORKDIR/assets/"*.apk "$WORKDIR/assets/public/"*.apk 2>/dev/null || true

# 3. Ajustar index.html para compatibilidade total em WebViews Android
# Remove type="module" e crossorigin para que o bundle IIFE execute perfeitamente sem restrições CORS
sed -i 's/<script type="module" crossorigin src="/<script defer src="/g' "$WORKDIR/assets/index.html"
sed -i 's/<script type="module" src="/<script defer src="/g' "$WORKDIR/assets/index.html"

# 4. Copiar e redimensionar ícones
echo "3. Gerando ícones nativos..."
if [ -f "$APP_ROOT/public/pwa-192x192.png" ]; then
    convert "$APP_ROOT/public/pwa-192x192.png" -resize 192x192 "$WORKDIR/res/drawable/ic_launcher.png"
fi

# 5. Strings e Recursos
cat << 'XML' > "$WORKDIR/res/values/strings.xml"
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">Minha Estante</string>
</resources>
XML

# 6. AndroidManifest.xml com package original e versionCode elevado para upgrade garantido
cat << 'XML' > "$WORKDIR/AndroidManifest.xml"
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.aistudio.minhaestante.vbrkxp"
    android:versionCode="100"
    android:versionName="2.2">

    <uses-sdk android:minSdkVersion="24" android:targetSdkVersion="34" />
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

    <application
        android:label="@string/app_name"
        android:icon="@drawable/ic_launcher"
        android:theme="@android:style/Theme.NoTitleBar"
        android:hardwareAccelerated="true"
        android:usesCleartextTraffic="true">
        <activity
            android:name=".MainActivity"
            android:label="@string/app_name"
            android:configChanges="orientation|screenSize|keyboardHidden"
            android:windowSoftInputMode="adjustResize"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
        <activity-alias
            android:name="com.example.MainActivity"
            android:targetActivity=".MainActivity"
            android:label="@string/app_name"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity-alias>
    </application>
</manifest>
XML

# 7. MainActivity.java com suporte a shouldInterceptRequest e interceptação local https://appassets/
cat << 'JAVA' > "$WORKDIR/src/com/aistudio/minhaestante/vbrkxp/MainActivity.java"
package com.aistudio.minhaestante.vbrkxp;

import android.app.Activity;
import android.os.Bundle;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceResponse;
import android.graphics.Color;
import java.io.InputStream;
import java.net.URLConnection;

public class MainActivity extends Activity {
    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().setFlags(
            WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED,
            WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED
        );

        webView = new WebView(this);
        webView.setBackgroundColor(Color.parseColor("#2B1A0F"));

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
        settings.setLoadsImagesAutomatically(true);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setCacheMode(WebSettings.LOAD_NO_CACHE);

        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, String url) {
                if (url.startsWith("https://appassets/")) {
                    try {
                        String path = url.replace("https://appassets/", "");
                        if (path.isEmpty() || path.equals("/")) path = "index.html";
                        if (path.startsWith("/")) path = path.substring(1);
                        
                        String mime = URLConnection.guessContentTypeFromName(path);
                        if (path.endsWith(".js")) mime = "application/javascript";
                        else if (path.endsWith(".css")) mime = "text/css";
                        else if (path.endsWith(".html")) mime = "text/html";
                        else if (path.endsWith(".json")) mime = "application/json";
                        else if (path.endsWith(".svg")) mime = "image/svg+xml";
                        else if (path.endsWith(".png")) mime = "image/png";

                        InputStream is = getAssets().open(path);
                        return new WebResourceResponse(mime, "UTF-8", is);
                    } catch (Exception e) {
                        return null;
                    }
                }
                return super.shouldInterceptRequest(view, url);
            }
        });

        setContentView(webView);
        webView.loadUrl("https://appassets/index.html");
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
JAVA

echo "4. Gerando R.java..."
aapt package -f -m -J "$WORKDIR/src" -M "$WORKDIR/AndroidManifest.xml" -S "$WORKDIR/res" -I /usr/share/java/com.android.android-23.jar

echo "5. Compilando Java com javac (compatível com Android 8+)..."
javac -source 1.8 -target 1.8 -cp /usr/share/java/com.android.android-23.jar -d "$WORKDIR/bin" "$WORKDIR/src/com/aistudio/minhaestante/vbrkxp/"*.java

echo "6. Gerando Dalvik DEX (classes.dex)..."
java -jar /usr/share/java/com.android.dx.jar --dex --output="$WORKDIR/bin/classes.dex" "$WORKDIR/bin"

echo "7. Empacotando APK com aapt..."
aapt package -f -M "$WORKDIR/AndroidManifest.xml" -S "$WORKDIR/res" -A "$WORKDIR/assets" -I /usr/share/java/com.android.android-23.jar -F "$WORKDIR/unsigned_base.apk"

cd "$WORKDIR"
cp bin/classes.dex .
aapt add unsigned_base.apk classes.dex

echo "8. Alinhando APK com zipalign..."
zipalign -f -p 4 unsigned_base.apk aligned.apk

echo "9. Assinando APK com apksigner (v2/v3, sem idsig)..."
if [ -f "$APP_ROOT/debug.keystore.base64" ]; then
    base64 -d "$APP_ROOT/debug.keystore.base64" > /tmp/debug.keystore
    apksigner sign --v4-signing-enabled false --ks /tmp/debug.keystore --ks-pass pass:android --ks-key-alias androiddebugkey --key-pass pass:android --out "$APP_ROOT/minha-estante.apk" aligned.apk
else
    cp aligned.apk "$APP_ROOT/minha-estante.apk"
fi

# Limpar eventuais arquivos .idsig
rm -f "$APP_ROOT"/*.idsig /minha-estante.apk.idsig /app/applet/*.idsig 2>/dev/null || true

# 10. Copiar para todas as localizações esperadas
cp "$APP_ROOT/minha-estante.apk" "$APP_ROOT/app-debug.apk"
cp "$APP_ROOT/minha-estante.apk" "$APP_ROOT/public/minha-estante.apk"
mkdir -p "$APP_ROOT/.build-outputs"
cp "$APP_ROOT/minha-estante.apk" "$APP_ROOT/.build-outputs/app-debug.apk"
cp "$APP_ROOT/minha-estante.apk" /minha-estante.apk 2>/dev/null || true

echo "=== SUCESSO: APK COMPILADO DO ZERO NA RAIZ ==="
ls -lh "$APP_ROOT/minha-estante.apk"
