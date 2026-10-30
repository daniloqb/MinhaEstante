package com.booknookapp;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import com.getcapacitor.BridgeActivity;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

public class MainActivity extends BridgeActivity {
    private static final int CREATE_FILE_RESULT_CODE = 9021;
    private String pendingFileContent = null;
    private String pendingFileName = null;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(DigitalLibraryStoragePlugin.class);
        if (BuildConfig.DEBUG && getPackageName().equals("com.booknookapp.dev")) {
            try {
                registerPlugin(Class.forName("com.booknookapp.BackupV2ExportPlugin").asSubclass(com.getcapacitor.Plugin.class));
            } catch (ClassNotFoundException ignored) { /* Companion exists only in src/debug. */ }
        }
        super.onCreate(savedInstanceState);
        if (bridge != null && bridge.getWebView() != null) {
            bridge.getWebView().addJavascriptInterface(new AndroidBridge(), "AndroidApp");
        }
    }

    public class AndroidBridge {
        @JavascriptInterface
        public boolean isAndroidApp() {
            return true;
        }

        @JavascriptInterface
        public void createFile(final String content, final String filename, final String mimeType) {
            pendingFileContent = content;
            pendingFileName = filename;

            runOnUiThread(() -> {
                try {
                    Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    intent.setType(mimeType != null && !mimeType.isEmpty() ? mimeType : "application/zip");
                    intent.putExtra(Intent.EXTRA_TITLE, filename != null && !filename.isEmpty() ? filename : "MinhaEstante_Backup.zip");
                    startActivityForResult(intent, CREATE_FILE_RESULT_CODE);
                } catch (Exception e) {
                    notifySaveResult(false, filename);
                }
            });
        }
    }

    @Override
    public void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);

        if (requestCode == CREATE_FILE_RESULT_CODE) {
            if (resultCode == Activity.RESULT_OK && data != null && data.getData() != null) {
                final Uri uri = data.getData();
                final String content = pendingFileContent;
                final String fileName = pendingFileName;
                pendingFileContent = null;
                pendingFileName = null;

                new Thread(() -> {
                    boolean success = false;
                    if (content != null) {
                        try (OutputStream os = getContentResolver().openOutputStream(uri, "wt")) {
                            if (os != null) {
                                byte[] bytes;
                                if (content.startsWith("data:")) {
                                    int commaIdx = content.indexOf(',');
                                    String raw = commaIdx >= 0 ? content.substring(commaIdx + 1) : content;
                                    bytes = Base64.decode(raw, Base64.DEFAULT);
                                } else {
                                    try {
                                        bytes = Base64.decode(content, Base64.DEFAULT);
                                    } catch (Exception ex) {
                                        bytes = content.getBytes(StandardCharsets.UTF_8);
                                    }
                                }
                                os.write(bytes);
                                os.flush();
                                success = true;
                            }
                        } catch (Exception ignored) {
                            success = false;
                        }
                    }
                    final boolean finalSuccess = success;
                    final String finalFileName = fileName;
                    runOnUiThread(() -> notifySaveResult(finalSuccess, finalFileName));
                }).start();
            } else {
                final String fileName = pendingFileName;
                pendingFileContent = null;
                pendingFileName = null;
                notifySaveResult(false, fileName);
            }
        }
    }

    private void notifySaveResult(boolean success, String fileName) {
        if (bridge != null && bridge.getWebView() != null) {
            String escapedName = fileName != null ? fileName.replace("'", "\\'") : "";
            String js = "window.onAndroidFileSaved && window.onAndroidFileSaved(" + success + ", '" + escapedName + "');";
            bridge.getWebView().evaluateJavascript(js, null);
        }
    }
}
