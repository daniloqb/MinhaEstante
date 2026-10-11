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
                    Toast.makeText(MainActivity.this, "Armazenamento via Storage Access Framework ativo!", Toast.LENGTH_SHORT).show();
                }
            });
        }

        @JavascriptInterface
        public boolean hasStoragePermission() {
            return true;
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

        // Status bar e Navigation bar combinando com o tema BookNook
        Window window = getWindow();
        window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        window.setStatusBarColor(Color.parseColor("#1E1008"));
        window.setNavigationBarColor(Color.parseColor("#2B1A0F"));

        webView = new WebView(this);
        webView.setBackgroundColor(Color.parseColor("#2B1A0F"));
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);

        // Registrar Bridge Javascript nativa para salvar backups
        webView.addJavascriptInterface(new AndroidBridge(), "AndroidBridge");

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                request.grant(request.getResources());
            }

            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, WebChromeClient.FileChooserParams fileChooserParams) {
                if (mUploadMessage != null) {
                    mUploadMessage.onReceiveValue(null);
                    mUploadMessage = null;
                }
                mUploadMessage = filePathCallback;

                Intent intent = fileChooserParams.createIntent();
                try {
                    startActivityForResult(intent, FILE_CHOOSER_RESULT_CODE);
                } catch (Exception e) {
                    mUploadMessage = null;
                    return false;
                }
                return true;
            }
        });

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, String url) {
                if (url != null && (url.startsWith("https://appassets.androidplatform.net/") || url.startsWith("file:///android_asset/"))) {
                    String cleanPath = url
                        .replace("https://appassets.androidplatform.net/", "")
                        .replace("file:///android_asset/", "");
                    int queryIdx = cleanPath.indexOf('?');
                    if (queryIdx >= 0) cleanPath = cleanPath.substring(0, queryIdx);
                    int hashIdx = cleanPath.indexOf('#');
                    if (hashIdx >= 0) cleanPath = cleanPath.substring(0, hashIdx);

                    if (cleanPath.isEmpty() || cleanPath.equals("/")) {
                        cleanPath = "index.html";
                    }

                    try {
                        InputStream stream = getAssets().open(cleanPath);
                        String mime = "application/octet-stream";
                        if (cleanPath.endsWith(".html")) mime = "text/html";
                        else if (cleanPath.endsWith(".js")) mime = "application/javascript";
                        else if (cleanPath.endsWith(".css")) mime = "text/css";
                        else if (cleanPath.endsWith(".png")) mime = "image/png";
                        else if (cleanPath.endsWith(".jpg") || cleanPath.endsWith(".jpeg")) mime = "image/jpeg";
                        else if (cleanPath.endsWith(".svg")) mime = "image/svg+xml";
                        else if (cleanPath.endsWith(".json")) mime = "application/json";
                        else if (cleanPath.endsWith(".woff2")) mime = "font/woff2";
                        else if (cleanPath.endsWith(".woff")) mime = "font/woff";
                        else if (cleanPath.endsWith(".ttf")) mime = "font/ttf";

                        Map<String, String> headers = new HashMap<>();
                        headers.put("Access-Control-Allow-Origin", "*");
                        headers.put("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
                        headers.put("Access-Control-Allow-Headers", "*");
                        return new WebResourceResponse(mime, "UTF-8", 200, "OK", headers, stream);
                    } catch (Exception ignored) {
                    }
                }
                return super.shouldInterceptRequest(view, url);
            }
        });

        if (checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.CAMERA}, 100);
        }

        webView.loadUrl("https://appassets.androidplatform.net/index.html");
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
                } else if (data.getClipData() != null) {
                    int count = data.getClipData().getItemCount();
                    results = new Uri[count];
                    for (int i = 0; i < count; i++) {
                        results[i] = data.getClipData().getItemAt(i).getUri();
                    }
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
        } else {
            super.onBackPressed();
        }
    }
}
