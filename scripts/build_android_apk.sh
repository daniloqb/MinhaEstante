#!/bin/bash
set -e

APP_ROOT="$(pwd)"
WORKDIR="/tmp/android_pkg"

ANDROID_JAR="/usr/lib/android-sdk/platforms/android-23/android.jar"
if [ ! -f "$ANDROID_JAR" ]; then
    ANDROID_JAR="/usr/share/java/com.android.android-23.jar"
fi

if ! command -v aapt &> /dev/null || ! command -v javac &> /dev/null || [ ! -f "$ANDROID_JAR" ]; then
    echo "Aviso: aapt, javac ou android.jar não encontrados no PATH. Mantendo APK existente."
    exit 0
fi

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
    android:versionCode="109"
    android:versionName="3.4">

    <uses-sdk android:minSdkVersion="21" android:targetSdkVersion="34" />
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
    <uses-feature android:name="android.hardware.camera" android:required="false" />
    <uses-feature android:name="android.hardware.camera.autofocus" android:required="false" />

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
    </application>
</manifest>
XML

# 7. MainActivity.java com suporte a shouldInterceptRequest, file chooser e bridge de criação/salvamento de arquivos
cat << 'JAVA' > "$WORKDIR/src/com/aistudio/minhaestante/vbrkxp/MainActivity.java"
package com.aistudio.minhaestante.vbrkxp;

import android.app.Activity;
import android.os.Bundle;
import android.os.Environment;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceResponse;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.JavascriptInterface;
import android.content.pm.PackageManager;
import android.content.Intent;
import android.content.DialogInterface;
import android.content.ActivityNotFoundException;
import android.net.Uri;
import android.Manifest;
import android.graphics.Color;
import android.widget.Toast;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.net.URLConnection;

public class MainActivity extends Activity {
    private WebView webView;
    private ValueCallback<Uri[]> mUploadMessage;
    private static final int FILE_CHOOSER_RESULT_CODE = 1001;
    private static final int CREATE_FILE_RESULT_CODE = 1002;
    private static final int STORAGE_PERMISSION_CODE = 1003;
    private String pendingFileContent = null;
    private String pendingFileName = null;

    public class AndroidBridge {
        @JavascriptInterface
        public void createFile(final String content, final String filename, final String mimeType) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        pendingFileContent = content;
                        pendingFileName = filename;

                        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                        intent.addCategory(Intent.CATEGORY_OPENABLE);
                        String type = (mimeType != null && !mimeType.isEmpty()) ? mimeType : "*/*";
                        intent.setType(type);
                        intent.putExtra(Intent.EXTRA_TITLE, filename);
                        startActivityForResult(intent, CREATE_FILE_RESULT_CODE);
                    } catch (Exception e) {
                        e.printStackTrace();
                        saveToDownloadsDirect(content, filename);
                    }
                }
            });
        }

        @JavascriptInterface
        public void saveOrShareFile(final String content, final String filename, final String mimeType) {
            createFile(content, filename, mimeType);
        }

        @JavascriptInterface
        public void shareFileText(final String content, final String filename) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        Intent sendIntent = new Intent();
                        sendIntent.setAction(Intent.ACTION_SEND);
                        sendIntent.putExtra(Intent.EXTRA_TEXT, content);
                        sendIntent.putExtra(Intent.EXTRA_TITLE, filename);
                        sendIntent.putExtra(Intent.EXTRA_SUBJECT, filename);
                        sendIntent.setType("text/plain");
                        startActivity(Intent.createChooser(sendIntent, "Salvar backup: " + filename));
                    } catch (Exception e) {
                        e.printStackTrace();
                    }
                }
            });
        }

        @JavascriptInterface
        public void requestStoragePermission() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    if (checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
                        requestPermissions(new String[]{
                            Manifest.permission.WRITE_EXTERNAL_STORAGE,
                            Manifest.permission.READ_EXTERNAL_STORAGE
                        }, STORAGE_PERMISSION_CODE);
                    } else {
                        Toast.makeText(MainActivity.this, "Permissão para salvar arquivos já está ativada!", Toast.LENGTH_SHORT).show();
                    }
                }
            });
        }

        @JavascriptInterface
        public boolean hasStoragePermission() {
            return checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED;
        }

        @JavascriptInterface
        public boolean isAndroidApp() {
            return true;
        }
    }

    private void saveToDownloadsDirect(String content, String filename) {
        try {
            File downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
            if (!downloadsDir.exists()) {
                downloadsDir.mkdirs();
            }
            File file = new File(downloadsDir, filename);
            FileOutputStream fos = new FileOutputStream(file);
            fos.write(content.getBytes("UTF-8"));
            fos.flush();
            fos.close();

            Toast.makeText(MainActivity.this, "✓ Backup salvo em Downloads: " + filename, Toast.LENGTH_LONG).show();
            if (webView != null) {
                webView.evaluateJavascript("window.onAndroidFileSaved && window.onAndroidFileSaved(true, '" + filename + "');", null);
            }
        } catch (Exception ex) {
            ex.printStackTrace();
            try {
                Intent sendIntent = new Intent();
                sendIntent.setAction(Intent.ACTION_SEND);
                sendIntent.putExtra(Intent.EXTRA_TEXT, content);
                sendIntent.putExtra(Intent.EXTRA_TITLE, filename);
                sendIntent.setType("text/plain");
                startActivity(Intent.createChooser(sendIntent, "Salvar backup: " + filename));
            } catch (Exception ignored) {
                Toast.makeText(MainActivity.this, "Erro ao gravar arquivo. Conceda permissão nas configurações.", Toast.LENGTH_LONG).show();
            }
        }
    }

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
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        settings.setSupportMultipleWindows(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);

        webView.addJavascriptInterface(new AndroidBridge(), "AndroidApp");

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                request.grant(request.getResources());
            }

            @Override
            public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, android.os.Message resultMsg) {
                WebView popupWebView = new WebView(MainActivity.this);
                popupWebView.getSettings().setJavaScriptEnabled(true);
                popupWebView.getSettings().setDomStorageEnabled(true);
                popupWebView.getSettings().setSupportMultipleWindows(true);
                popupWebView.getSettings().setJavaScriptCanOpenWindowsAutomatically(true);

                final android.app.Dialog popupDialog = new android.app.Dialog(MainActivity.this, android.R.style.Theme_Black_NoTitleBar_Fullscreen);
                popupDialog.setCancelable(true);
                popupDialog.setCanceledOnTouchOutside(true);
                popupDialog.setOnCancelListener(new DialogInterface.OnCancelListener() {
                    @Override
                    public void onCancel(DialogInterface dialog) {
                        try { popupWebView.destroy(); } catch (Exception ignored) {}
                    }
                });
                popupDialog.setContentView(popupWebView);
                popupDialog.show();

                popupWebView.setWebChromeClient(new WebChromeClient() {
                    @Override
                    public void onCloseWindow(WebView window) {
                        try {
                            popupDialog.dismiss();
                            window.destroy();
                        } catch (Exception ignored) {}
                    }
                });

                popupWebView.setWebViewClient(new WebViewClient() {
                    @Override
                    public boolean shouldOverrideUrlLoading(WebView view, String url) {
                        return false;
                    }
                });

                WebView.WebViewTransport transport = (WebView.WebViewTransport) resultMsg.obj;
                transport.setWebView(popupWebView);
                resultMsg.sendToTarget();
                return true;
            }

            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, WebChromeClient.FileChooserParams fileChooserParams) {
                if (mUploadMessage != null) {
                    mUploadMessage.onReceiveValue(null);
                    mUploadMessage = null;
                }
                mUploadMessage = filePathCallback;

                Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("*/*");
                String[] mimetypes = {"application/json", "text/csv", "text/plain"};
                intent.putExtra(Intent.EXTRA_MIME_TYPES, mimetypes);

                try {
                    startActivityForResult(Intent.createChooser(intent, "Selecionar Arquivo de Backup"), FILE_CHOOSER_RESULT_CODE);
                } catch (ActivityNotFoundException e) {
                    mUploadMessage = null;
                    return false;
                }
                return true;
            }
        });

        if (checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{
                Manifest.permission.WRITE_EXTERNAL_STORAGE,
                Manifest.permission.READ_EXTERNAL_STORAGE,
                Manifest.permission.CAMERA
            }, 101);
        }

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
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == STORAGE_PERMISSION_CODE || requestCode == 101) {
            boolean granted = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
            if (granted) {
                Toast.makeText(this, "✓ Permissão de arquivos ativada!", Toast.LENGTH_SHORT).show();
            }
            if (webView != null) {
                webView.evaluateJavascript("window.onAndroidPermissionUpdated && window.onAndroidPermissionUpdated(" + granted + ");", null);
            }
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == FILE_CHOOSER_RESULT_CODE) {
            if (mUploadMessage == null) return;
            Uri[] results = null;
            if (resultCode == RESULT_OK && data != null) {
                String dataString = data.getDataString();
                if (dataString != null) {
                    results = new Uri[]{Uri.parse(dataString)};
                }
            }
            mUploadMessage.onReceiveValue(results);
            mUploadMessage = null;
        } else if (requestCode == CREATE_FILE_RESULT_CODE) {
            if (resultCode == RESULT_OK && data != null && data.getData() != null) {
                Uri uri = data.getData();
                try {
                    OutputStream os = getContentResolver().openOutputStream(uri);
                    if (os != null && pendingFileContent != null) {
                        os.write(pendingFileContent.getBytes("UTF-8"));
                        os.flush();
                        os.close();
                        Toast.makeText(MainActivity.this, "✓ Backup salvo com sucesso no celular!", Toast.LENGTH_LONG).show();
                        if (webView != null) {
                            webView.evaluateJavascript("window.onAndroidFileSaved && window.onAndroidFileSaved(true, '" + (pendingFileName != null ? pendingFileName : "") + "');", null);
                        }
                    }
                } catch (Exception e) {
                    e.printStackTrace();
                    Toast.makeText(MainActivity.this, "Erro ao gravar arquivo: " + e.getMessage(), Toast.LENGTH_LONG).show();
                }
            }
            pendingFileContent = null;
            pendingFileName = null;
        }
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
aapt package -f -m -J "$WORKDIR/src" -M "$WORKDIR/AndroidManifest.xml" -S "$WORKDIR/res" -I "$ANDROID_JAR"

echo "5. Compilando Java com javac (compatível com Android 8+)..."
javac -source 1.8 -target 1.8 -cp "$ANDROID_JAR" -d "$WORKDIR/bin" "$WORKDIR/src/com/aistudio/minhaestante/vbrkxp/"*.java

echo "6. Gerando Dalvik DEX (classes.dex)..."
if command -v dx &> /dev/null; then
    dx --dex --output="$WORKDIR/bin/classes.dex" "$WORKDIR/bin"
elif command -v dalvik-exchange &> /dev/null; then
    dalvik-exchange --dex --output="$WORKDIR/bin/classes.dex" "$WORKDIR/bin"
else
    java -jar /usr/share/java/com.android.dx.jar --dex --output="$WORKDIR/bin/classes.dex" "$WORKDIR/bin"
fi

echo "7. Empacotando APK com aapt..."
aapt package -f -0 arsc -M "$WORKDIR/AndroidManifest.xml" -S "$WORKDIR/res" -A "$WORKDIR/assets" -I "$ANDROID_JAR" -F "$WORKDIR/unsigned_base.apk"

cd "$WORKDIR"
cp bin/classes.dex .
aapt add unsigned_base.apk classes.dex

echo "8. Alinhando APK com zipalign (alinhamento de 4 bytes)..."
zipalign -f 4 unsigned_base.apk aligned.apk

echo "9. Assinando APK com apksigner (v1 JAR, v2 APK Scheme, v3 Scheme)..."
if [ -f "$APP_ROOT/debug.keystore.base64" ]; then
    base64 -d "$APP_ROOT/debug.keystore.base64" > /tmp/debug.keystore
    apksigner sign \
        --min-sdk-version 21 \
        --v1-signing-enabled true \
        --v2-signing-enabled true \
        --v3-signing-enabled true \
        --v4-signing-enabled false \
        --ks /tmp/debug.keystore \
        --ks-pass pass:android \
        --ks-key-alias androiddebugkey \
        --key-pass pass:android \
        --out "$APP_ROOT/minha-estante.apk" aligned.apk
else
    cp aligned.apk "$APP_ROOT/minha-estante.apk"
fi

# Limpar eventuais arquivos .idsig
rm -f "$APP_ROOT"/*.idsig /minha-estante.apk.idsig /app/applet/*.idsig 2>/dev/null || true

echo "10. Validando assinatura e alinhamento do APK final..."
apksigner verify --verbose --min-sdk-version 21 "$APP_ROOT/minha-estante.apk"
zipalign -c 4 "$APP_ROOT/minha-estante.apk"

# 11. Copiar para todas as localizações esperadas
cp "$APP_ROOT/minha-estante.apk" "$APP_ROOT/app-debug.apk"
cp "$APP_ROOT/minha-estante.apk" "$APP_ROOT/public/minha-estante.apk"
mkdir -p "$APP_ROOT/dist"
cp "$APP_ROOT/minha-estante.apk" "$APP_ROOT/dist/minha-estante.apk"
cp "$APP_ROOT/minha-estante.apk" "$APP_ROOT/dist/app-debug.apk"
mkdir -p "$APP_ROOT/.build-outputs"
cp "$APP_ROOT/minha-estante.apk" "$APP_ROOT/.build-outputs/app-debug.apk"
cp "$APP_ROOT/minha-estante.apk" /minha-estante.apk 2>/dev/null || true

echo "=== SUCESSO: APK COMPILADO DO ZERO NA RAIZ ==="
ls -lh "$APP_ROOT/minha-estante.apk"
