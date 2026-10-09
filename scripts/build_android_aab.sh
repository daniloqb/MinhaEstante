#!/bin/bash
set -e

APP_ROOT="$(pwd)"
WORKDIR="/tmp/aab_pkg"
BUNDLETOOL="/usr/local/bin/bundletool.jar"
AAPT2="/usr/local/bin/aapt2"
ANDROID_JAR="/usr/local/lib/android.jar"
D8_JAR="/usr/local/lib/d8.jar"
KEYSTORE_PATH="$APP_ROOT/booknook-release-key.jks"
KEYSTORE_PASS="booknook123"
KEY_ALIAS="booknook"

VERSION_CODE="15"
VERSION_NAME="1.0.15"
PACKAGE_NAME="com.booknookapp"

echo "=== INICIANDO CONSTRUÇÃO OFICIAL DO ANDROID APP BUNDLE (.AAB) PARA GOOGLE PLAY ==="

# 1. Verificar ferramentas necessárias
if [ ! -f "$BUNDLETOOL" ]; then
    echo "Instalando bundletool.jar..."
    curl -s -L -o "$BUNDLETOOL" "https://github.com/google/bundletool/releases/download/1.18.3/bundletool-all-1.18.3.jar"
    chmod +x "$BUNDLETOOL"
fi

if [ ! -f "$AAPT2" ]; then
    echo "Instalando aapt2..."
    curl -s -L -o /tmp/aapt2.jar "https://dl.google.com/dl/android/maven2/com/android/tools/build/aapt2/8.2.2-10154469/aapt2-8.2.2-10154469-linux.jar"
    unzip -q -o /tmp/aapt2.jar aapt2 -d /usr/local/bin/
    chmod +x "$AAPT2"
fi

if [ ! -f "$ANDROID_JAR" ]; then
    echo "Instalando android.jar..."
    mkdir -p /usr/local/lib
    curl -s -L -o "$ANDROID_JAR" "https://github.com/Sable/android-platforms/raw/master/android-34/android.jar"
fi

if [ ! -f "$D8_JAR" ]; then
    echo "Instalando d8.jar..."
    mkdir -p /usr/local/lib
    curl -s -L -o "$D8_JAR" "https://dl.google.com/dl/android/maven2/com/android/tools/r8/8.2.42/r8-8.2.42.jar"
fi

# 2. Compilar Web App mais recente com Vite
echo "1. Compilando aplicação React/Vite com as últimas alterações..."
npx tsc --noEmit
npx vite build

# 3. Limpar diretório de trabalho
rm -rf "$WORKDIR"
mkdir -p "$WORKDIR/src/com/booknookapp"
mkdir -p "$WORKDIR/bin"
mkdir -p "$WORKDIR/res/values"
mkdir -p "$WORKDIR/res/drawable"
mkdir -p "$WORKDIR/base_module/manifest"
mkdir -p "$WORKDIR/base_module/dex"
mkdir -p "$WORKDIR/base_module/res"
mkdir -p "$WORKDIR/base_module/assets"

# 4. Ícone do Aplicativo
if [ -f "$APP_ROOT/public/pwa-192x192.png" ]; then
    cp "$APP_ROOT/public/pwa-192x192.png" "$WORKDIR/res/drawable/ic_launcher.png"
else
    cp "$APP_ROOT/public/favicon.png" "$WORKDIR/res/drawable/ic_launcher.png"
fi

# 5. Recursos e Strings
cat << 'XML' > "$WORKDIR/res/values/strings.xml"
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">BookNook</string>
</resources>
XML

# 6. AndroidManifest.xml
cat << XML > "$WORKDIR/AndroidManifest.xml"
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="$PACKAGE_NAME"
    android:versionCode="$VERSION_CODE"
    android:versionName="$VERSION_NAME">

    <uses-sdk android:minSdkVersion="24" android:targetSdkVersion="36" />
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
            android:name="com.booknookapp.MainActivity"
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

# 7. Compilar recursos e gerar AndroidManifest.xml em formato Protobuf via AAPT2
echo "2. Compilando recursos e manifesto em formato Protobuf via AAPT2..."
"$AAPT2" compile --dir "$WORKDIR/res" -o "$WORKDIR/compiled_res.zip"
"$AAPT2" link --proto-format -I "$ANDROID_JAR" \
    --manifest "$WORKDIR/AndroidManifest.xml" \
    --min-sdk-version 24 \
    --target-sdk-version 36 \
    --compile-sdk-version-code 36 \
    --compile-sdk-version-name "16" \
    -o "$WORKDIR/linked_res.apk" \
    "$WORKDIR/compiled_res.zip"

unzip -q "$WORKDIR/linked_res.apk" -d "$WORKDIR/proto_out"
cp "$WORKDIR/proto_out/AndroidManifest.xml" "$WORKDIR/base_module/manifest/"
cp "$WORKDIR/proto_out/resources.pb" "$WORKDIR/base_module/"
cp -r "$WORKDIR/proto_out/res/"* "$WORKDIR/base_module/res/"

# 8. MainActivity.java com suporte a bridge Android e headers CORS limpos
echo "3. Compilando código nativo Java e gerando classes.dex..."
cat << 'JAVA' > "$WORKDIR/src/com/booknookapp/MainActivity.java"
package com.booknookapp;

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
import java.util.HashMap;
import java.util.Map;

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

        @JavascriptInterface
        public void exitApp() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    finish();
                }
            });
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
                Toast.makeText(MainActivity.this, "Erro ao gravar arquivo.", Toast.LENGTH_LONG).show();
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
                        Map<String, String> responseHeaders = new HashMap<String, String>();
                        responseHeaders.put("Access-Control-Allow-Origin", "*");
                        responseHeaders.put("Access-Control-Allow-Methods", "GET, OPTIONS");
                        return new WebResourceResponse(mime, "UTF-8", 200, "OK", responseHeaders, is);
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
        if (webView != null) {
            webView.evaluateJavascript(
                "(function() { try { return !!(window.onAndroidBackPressed && window.onAndroidBackPressed()); } catch(e) { return false; } })()",
                new ValueCallback<String>() {
                    @Override
                    public void onReceiveValue(String value) {
                        if ("true".equalsIgnoreCase(value)) {
                            // Evento consumido pela navegação interna do app até a tela principal
                            return;
                        }
                        runOnUiThread(new Runnable() {
                            @Override
                            public void run() {
                                if (webView != null && webView.canGoBack()) {
                                    webView.goBack();
                                } else {
                                    MainActivity.super.onBackPressed();
                                }
                            }
                        });
                    }
                }
            );
            return;
        }
        super.onBackPressed();
    }
}
JAVA

javac -source 1.8 -target 1.8 -cp "$ANDROID_JAR" -d "$WORKDIR/bin" "$WORKDIR/src/com/booknookapp/MainActivity.java"
java -cp "$D8_JAR" com.android.tools.r8.D8 --lib "$ANDROID_JAR" --output "$WORKDIR/base_module/dex/" "$WORKDIR/bin/com/booknookapp/"*.class

# 9. Copiar e preparar assets web com as últimas alterações
echo "4. Copiando assets web do Vite para o bundle e ajustando index.html..."
cp -r "$APP_ROOT/dist/"* "$WORKDIR/base_module/assets/"
rm -f "$WORKDIR/base_module/assets/"*.apk "$WORKDIR/base_module/assets/"*.aab 2>/dev/null || true

# Remove crossorigin para evitar qualquer bloqueio em WebViews
sed -i 's/crossorigin//g' "$WORKDIR/base_module/assets/index.html"
# Remove o registro do Service Worker interno no app nativo para garantir que a versão embutida execute 100% direta
sed -i 's/<script id="vite-plugin-pwa:register-sw"[^>]*><\/script>//g' "$WORKDIR/base_module/assets/index.html"

# Injeta limpador de caches e garantia de versão no head do index.html
python3 -c "
with open('$WORKDIR/base_module/assets/index.html', 'r', encoding='utf-8') as f:
    html = f.read()

cleaner = '''<script>
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(function(regs) {
    for (var i = 0; i < regs.length; i++) regs[i].unregister();
  });
}
if ('caches' in window) {
  caches.keys().then(function(names) {
    for (var i = 0; i < names.length; i++) caches.delete(names[i]);
  });
}
</script>'''

if '<head>' in html:
    html = html.replace('<head>', '<head>' + cleaner, 1)

with open('$WORKDIR/base_module/assets/index.html', 'w', encoding='utf-8') as f:
    f.write(html)
"

# 10. Compactar base.zip para o bundletool
echo "5. Compactando módulo base..."
cd "$WORKDIR/base_module"
rm -f "$WORKDIR/base.zip"
zip -q -r "$WORKDIR/base.zip" .
cd "$APP_ROOT"

# 11. Construir o Android App Bundle (.aab) oficial com bundletool
echo "6. Construindo booknook-unsigned.aab com bundletool..."
java -jar "$BUNDLETOOL" build-bundle \
    --modules="$WORKDIR/base.zip" \
    --output="$WORKDIR/booknook-unsigned.aab" \
    --overwrite

# 12. Garantir existência da keystore de produção
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

# 13. Assinar o .aab diretamente com jarsigner oficial
echo "7. Assinando booknook.aab com jarsigner e timestamp DigiCert..."
cp "$WORKDIR/booknook-unsigned.aab" "$WORKDIR/booknook.aab"
jarsigner \
    -sigalg SHA256withRSA \
    -digestalg SHA-256 \
    -tsa http://timestamp.digicert.com \
    -keystore "$KEYSTORE_PATH" \
    -storepass "$KEYSTORE_PASS" \
    -keypass "$KEYSTORE_PASS" \
    "$WORKDIR/booknook.aab" \
    "$KEY_ALIAS"

# 14. Verificar a assinatura JAR com jarsigner -verify
echo "8. Verificando integridade da assinatura com jarsigner -verify..."
jarsigner -verify -verbose -certs "$WORKDIR/booknook.aab" | tail -n 20

# 15. Validar estrutura do App Bundle com bundletool validate
echo "9. Validando conformidade com Google Play Console via bundletool validate..."
java -jar "$BUNDLETOOL" validate --bundle="$WORKDIR/booknook.aab"

# 16. Gerar APK Universal para testes diretos no celular físico
echo "10. Gerando APK universal oficial a partir do bundle..."
rm -f "$WORKDIR/test.apks" "$WORKDIR/universal.apk"
java -jar "$BUNDLETOOL" build-apks \
    --bundle="$WORKDIR/booknook.aab" \
    --output="$WORKDIR/test.apks" \
    --ks="$KEYSTORE_PATH" \
    --ks-pass=pass:"$KEYSTORE_PASS" \
    --ks-key-alias="$KEY_ALIAS" \
    --key-pass=pass:"$KEYSTORE_PASS" \
    --mode=universal

unzip -p "$WORKDIR/test.apks" universal.apk > "$WORKDIR/booknook.apk"

echo "11. Inspecionando manifesto final do pacote .aab:"
java -jar "$BUNDLETOOL" dump manifest --bundle="$WORKDIR/booknook.aab"

# 17. Distribuir pacote oficial assinado (sem NUNCA modificar o arquivo após assinado)
echo "12. Distribuindo pacotes .aab e .apk para raiz, public, dist e docs..."
mkdir -p "$APP_ROOT/public" "$APP_ROOT/dist" "$APP_ROOT/docs"

# .AAB para Google Play Console
cp "$WORKDIR/booknook.aab" "$APP_ROOT/booknook.aab"
cp "$WORKDIR/booknook.aab" "$APP_ROOT/minha-estante.aab"
cp "$WORKDIR/booknook.aab" "$APP_ROOT/public/booknook.aab"
cp "$WORKDIR/booknook.aab" "$APP_ROOT/public/minha-estante.aab"
cp "$WORKDIR/booknook.aab" "$APP_ROOT/dist/booknook.aab"
cp "$WORKDIR/booknook.aab" "$APP_ROOT/dist/minha-estante.aab"
cp "$WORKDIR/booknook.aab" "$APP_ROOT/docs/booknook.aab"

# .APK para instalação direta no smartphone Android
cp "$WORKDIR/booknook.apk" "$APP_ROOT/booknook.apk"
cp "$WORKDIR/booknook.apk" "$APP_ROOT/minha-estante.apk"
cp "$WORKDIR/booknook.apk" "$APP_ROOT/public/booknook.apk"
cp "$WORKDIR/booknook.apk" "$APP_ROOT/public/minha-estante.apk"
cp "$WORKDIR/booknook.apk" "$APP_ROOT/dist/booknook.apk"
cp "$WORKDIR/booknook.apk" "$APP_ROOT/dist/minha-estante.apk"
cp "$WORKDIR/booknook.apk" "$APP_ROOT/docs/booknook.apk"

echo ""
echo "=== SUCESSO! ARQUIVO .AAB E .APK GERADOS COM AS ÚLTIMAS ALTERAÇÕES ==="
ls -lh "$APP_ROOT/booknook.aab" "$APP_ROOT/booknook.apk"
echo ""
echo "=== CHAVE DE ASSINATURA / FINGERPRINTS PARA GOOGLE PLAY ==="
keytool -list -v -keystore "$KEYSTORE_PATH" -alias "$KEY_ALIAS" -storepass "$KEYSTORE_PASS" | grep -E "SHA1|SHA256" || true
echo "=========================================================="
