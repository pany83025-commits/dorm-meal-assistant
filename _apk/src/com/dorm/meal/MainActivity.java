package com.dorm.meal;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ContentUris;
import android.content.ContentValues;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.JavascriptInterface;
import android.webkit.JsResult;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

public class MainActivity extends Activity {

    private WebView wv;
    private String pendingImg = null;
    private static final int REQ_PICK_IMAGE = 1001;
    private static final int REQ_PERM = 1002;
    private static final int PAGE_BG = 0xFFFBFAF7;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setupEdgeToEdge();

        wv = new WebView(this);
        WebSettings s = wv.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setTextZoom(100);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);

        wv.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                if (u != null && ("http".equals(u.getScheme()) || "https".equals(u.getScheme()))) {
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, u));
                    } catch (Exception ignored) {
                    }
                    return true;
                }
                return false;
            }
        });
        wv.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onJsAlert(WebView view, String url, String message, final JsResult result) {
                new AlertDialog.Builder(MainActivity.this)
                        .setMessage(message)
                        .setPositiveButton("知道了", new DialogInterface.OnClickListener() {
                            public void onClick(DialogInterface d, int w) {
                                result.confirm();
                            }
                        })
                        .setCancelable(false)
                        .show();
                return true;
            }

            @Override
            public boolean onJsConfirm(WebView view, String url, String message, final JsResult result) {
                new AlertDialog.Builder(MainActivity.this)
                        .setMessage(message)
                        .setPositiveButton("确定", new DialogInterface.OnClickListener() {
                            public void onClick(DialogInterface d, int w) {
                                result.confirm();
                            }
                        })
                        .setNegativeButton("取消", new DialogInterface.OnClickListener() {
                            public void onClick(DialogInterface d, int w) {
                                result.cancel();
                            }
                        })
                        .setCancelable(false)
                        .show();
                return true;
            }
        });
        wv.setBackgroundColor(PAGE_BG);
        wv.addJavascriptInterface(new Bridge(), "AndroidBridge");

        // 键盘：把 IME 高度（dp）告诉页面，页面用 --kb 抬高弹层
        if (Build.VERSION.SDK_INT >= 20) {
            wv.setOnApplyWindowInsetsListener(new View.OnApplyWindowInsetsListener() {
                @Override
                public WindowInsets onApplyWindowInsets(View v, WindowInsets ins) {
                    int imePx = 0;
                    try {
                        if (Build.VERSION.SDK_INT >= 30) {
                            imePx = ins.getInsets(WindowInsets.Type.ime()).bottom;
                        } else {
                            imePx = ins.getSystemWindowInsetBottom();
                        }
                    } catch (Exception ignored) {
                    }
                    float dn = getResources().getDisplayMetrics().density;
                    if (dn <= 0) dn = 1f;
                    final int kbDp = Math.round(Math.max(0, imePx) / dn);
                    if (wv != null) {
                        wv.evaluateJavascript("window.__setIme&&window.__setIme(" + kbDp + ")", null);
                    }
                    return ins;
                }
            });
        }

        setContentView(wv);
        wv.loadUrl("file:///android_asset/index.html");
        pushInsets();
    }

    /** 状态栏透明 + 内容延伸，导航栏与页面同色，图标反色 */
    private void setupEdgeToEdge() {
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(PAGE_BG);
        if (Build.VERSION.SDK_INT >= 28) {
            getWindow().setNavigationBarDividerColor(Color.TRANSPARENT);
            getWindow().setNavigationBarContrastEnforced(false);
        }
        View decor = getWindow().getDecorView();
        int f = View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
        if (Build.VERSION.SDK_INT >= 26) {
            f |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
        }
        decor.setSystemUiVisibility(f);
    }

    /** 把状态栏高度（换算成 dp）写给页面，CSS 用 var(--sat) */
    private void pushInsets() {
        View decor = getWindow().getDecorView();
        int topPx = -1;
        if (Build.VERSION.SDK_INT >= 23) {
            try {
                WindowInsets ins = decor.getRootWindowInsets();
                if (ins != null) topPx = ins.getSystemWindowInsetTop();
            } catch (Exception ignored) {
            }
        }
        if (topPx <= 0) {
            int id = getResources().getIdentifier("status_bar_height", "dimen", "android");
            if (id > 0) topPx = getResources().getDimensionPixelSize(id);
        }
        if (topPx < 0) topPx = 0;
        // 关键：Inset 是物理像素，WebView 的 CSS px 等于 dp，必须除以 density
        float dn = getResources().getDisplayMetrics().density;
        if (dn <= 0) dn = 1f;
        final int satDp = Math.round(topPx / dn);
        wv.postDelayed(new Runnable() {
            public void run() {
                if (wv != null) {
                    wv.evaluateJavascript(
                            "document.documentElement.style.setProperty('--sat','" + satDp + "px')", null);
                }
            }
        }, 120);
    }

    public class Bridge {

        /** 同步取一个只读 URL 的文本（给「检查更新」用；@JavascriptInterface 跑在子线程，可以直接联网） */
        @JavascriptInterface
        public String httpGet(String url) {
            java.net.HttpURLConnection c = null;
            try {
                c = (java.net.HttpURLConnection) new java.net.URL(url).openConnection();
                c.setConnectTimeout(8000);
                c.setReadTimeout(8000);
                c.setRequestProperty("Cache-Control", "no-cache");
                InputStream is = c.getResponseCode() >= 400 ? c.getErrorStream() : c.getInputStream();
                if (is == null) return "err:无响应";
                java.io.ByteArrayOutputStream bo = new java.io.ByteArrayOutputStream();
                byte[] buf = new byte[4096];
                int n;
                while ((n = is.read(buf)) > 0) bo.write(buf, 0, n);
                is.close();
                return bo.toString("UTF-8");
            } catch (Exception e) {
                return "err:" + e.getMessage();
            } finally {
                if (c != null) c.disconnect();
            }
        }

        /** 用系统浏览器打开链接（下载新版本 APK 用） */
        @JavascriptInterface
        public void openUrl(String url) {
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
            } catch (Exception ignored) {
            }
        }

        @JavascriptInterface
        public String save(String name, String content) {
            try {
                if (Build.VERSION.SDK_INT >= 29) {
                    ContentValues v = new ContentValues();
                    v.put(MediaStore.Downloads.DISPLAY_NAME, name);
                    v.put(MediaStore.Downloads.MIME_TYPE, "application/json");
                    v.put(MediaStore.Downloads.RELATIVE_PATH, "Download/DormMeal");
                    Uri uri = getContentResolver()
                            .insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
                    if (uri == null) return "err:无法创建文件";
                    OutputStream os = getContentResolver().openOutputStream(uri);
                    if (os == null) return "err:无法写入";
                    os.write(content.getBytes(StandardCharsets.UTF_8));
                    os.flush();
                    os.close();
                    return "ok:Download/DormMeal/" + name;
                }
                return "err:系统版本过低，请用浏览器版导出";
            } catch (Exception e) {
                return "err:" + e.getMessage();
            }
        }

        @JavascriptInterface
        public void aiGet(final String url, final String key) {
            new Thread(new Runnable() {
                public void run() {
                    String res;
                    try {
                        java.net.URL u = new java.net.URL(url);
                        java.net.HttpURLConnection c = (java.net.HttpURLConnection) u.openConnection();
                        c.setRequestMethod("GET");
                        c.setConnectTimeout(20000);
                        c.setReadTimeout(30000);
                        c.setRequestProperty("Authorization", "Bearer " + key);
                        int code = c.getResponseCode();
                        InputStream is = code >= 400 ? c.getErrorStream() : c.getInputStream();
                        java.io.ByteArrayOutputStream bo = new java.io.ByteArrayOutputStream();
                        byte[] buf = new byte[8192];
                        int n;
                        while (is != null && (n = is.read(buf)) > 0) bo.write(buf, 0, n);
                        if (is != null) is.close();
                        res = bo.toString("UTF-8");
                        if (code >= 400) res = "err:HTTP " + code + " " + res;
                    } catch (Exception e) {
                        res = "err:" + e.getMessage();
                    }
                    final String out = res;
                    runOnUiThread(new Runnable() {
                        public void run() {
                            if (wv != null) {
                                wv.evaluateJavascript(
                                    "window.__aiCb&&window.__aiCb(" + org.json.JSONObject.quote(out) + ")",
                                    null);
                            }
                        }
                    });
                }
            }).start();
        }

        @JavascriptInterface
        public void aiPost(final String url, final String key, final String body) {
            new Thread(new Runnable() {
                public void run() {
                    String res;
                    try {
                        java.net.URL u = new java.net.URL(url);
                        java.net.HttpURLConnection c = (java.net.HttpURLConnection) u.openConnection();
                        c.setRequestMethod("POST");
                        c.setConnectTimeout(20000);
                        c.setReadTimeout(90000);
                        c.setDoOutput(true);
                        c.setRequestProperty("Content-Type", "application/json; charset=utf-8");
                        c.setRequestProperty("Authorization", "Bearer " + key);
                        OutputStream os = c.getOutputStream();
                        os.write(body.getBytes("UTF-8"));
                        os.flush();
                        os.close();
                        int code = c.getResponseCode();
                        InputStream is = code >= 400 ? c.getErrorStream() : c.getInputStream();
                        java.io.ByteArrayOutputStream bo = new java.io.ByteArrayOutputStream();
                        byte[] buf = new byte[8192];
                        int n;
                        while (is != null && (n = is.read(buf)) > 0) bo.write(buf, 0, n);
                        if (is != null) is.close();
                        res = bo.toString("UTF-8");
                        if (code >= 400) res = "err:HTTP " + code + " " + res;
                    } catch (Exception e) {
                        res = "err:" + e.getMessage();
                    }
                    final String out = res;
                    runOnUiThread(new Runnable() {
                        public void run() {
                            if (wv != null) {
                                wv.evaluateJavascript(
                                    "window.__aiCb&&window.__aiCb(" + org.json.JSONObject.quote(out) + ")",
                                    null);
                            }
                        }
                    });
                }
            }).start();
        }

        /** 先要权限，再开相册 */
        @JavascriptInterface
        public void pickImage() {
            if (!hasReadPermission()) {
                if (Build.VERSION.SDK_INT >= 33) {
                    requestPermissions(new String[]{android.Manifest.permission.READ_MEDIA_IMAGES}, REQ_PERM);
                } else {
                    requestPermissions(new String[]{android.Manifest.permission.READ_EXTERNAL_STORAGE}, REQ_PERM);
                }
                return;
            }
            openGallery();
        }

        @JavascriptInterface
        public String takePickedImage() {
            String s = pendingImg;
            pendingImg = null;
            return s == null ? "" : s;
        }

        @JavascriptInterface
        public String load() {
            try {
                if (Build.VERSION.SDK_INT >= 29) {
                    Uri col = MediaStore.Downloads.EXTERNAL_CONTENT_URI;
                    String[] proj = {
                            MediaStore.Downloads._ID,
                            MediaStore.Downloads.DISPLAY_NAME
                    };
                    String sel = MediaStore.Downloads.RELATIVE_PATH + " LIKE ?";
                    String[] args = new String[]{"%DormMeal%"};
                    Cursor c = getContentResolver().query(
                            col, proj, sel, args,
                            MediaStore.Downloads.DATE_ADDED + " DESC");
                    if (c != null) {
                        try {
                            if (c.moveToFirst()) {
                                long id = c.getLong(0);
                                Uri u = ContentUris.withAppendedId(col, id);
                                InputStream is = getContentResolver().openInputStream(u);
                                if (is == null) return "err:读取失败";
                                ByteArrayOutputStream bo = new ByteArrayOutputStream();
                                byte[] buf = new byte[8192];
                                int n;
                                while ((n = is.read(buf)) > 0) bo.write(buf, 0, n);
                                is.close();
                                return bo.toString("UTF-8");
                            }
                        } finally {
                            c.close();
                        }
                    }
                    return "err:none";
                }
                return "err:系统版本过低";
            } catch (Exception e) {
                return "err:" + e.getMessage();
            }
        }
    }

    private boolean hasReadPermission() {
        if (Build.VERSION.SDK_INT >= 33) {
            return checkSelfPermission(android.Manifest.permission.READ_MEDIA_IMAGES)
                    == PackageManager.PERMISSION_GRANTED;
        }
        if (Build.VERSION.SDK_INT >= 23) {
            return checkSelfPermission(android.Manifest.permission.READ_EXTERNAL_STORAGE)
                    == PackageManager.PERMISSION_GRANTED;
        }
        return true;
    }

    /** 优先开系统相册；不行就退到文件选择器 */
    private void openGallery() {
        Intent i = new Intent(Intent.ACTION_PICK, MediaStore.Images.Media.EXTERNAL_CONTENT_URI);
        i.setType("image/*");
        try {
            startActivityForResult(i, REQ_PICK_IMAGE);
            return;
        } catch (Exception ignored) {
        }
        try {
            if (Build.VERSION.SDK_INT >= 33) {
                Intent p = new Intent(MediaStore.ACTION_PICK_IMAGES);
                p.setType("image/*");
                startActivityForResult(p, REQ_PICK_IMAGE);
                return;
            }
        } catch (Exception ignored) {
        }
        try {
            Intent g = new Intent(Intent.ACTION_GET_CONTENT);
            g.setType("image/*");
            g.addCategory(Intent.CATEGORY_OPENABLE);
            startActivityForResult(g, REQ_PICK_IMAGE);
        } catch (Exception e) {
            notifyImg(false);
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] perms, int[] results) {
        if (requestCode != REQ_PERM) {
            super.onRequestPermissionsResult(requestCode, perms, results);
            return;
        }
        // 拒绝了也还能用系统选择器（只授权单张），所以一律继续
        openGallery();
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != REQ_PICK_IMAGE) return;
        if (resultCode != RESULT_OK || data == null) {
            notifyImg(false);
            return;
        }
        Uri uri = data.getData();
        if (uri == null && data.getClipData() != null && data.getClipData().getItemCount() > 0) {
            uri = data.getClipData().getItemAt(0).getUri();
        }
        if (uri == null) {
            notifyImg(false);
            return;
        }
        try {
            BitmapFactory.Options o = new BitmapFactory.Options();
            o.inJustDecodeBounds = true;
            InputStream is = getContentResolver().openInputStream(uri);
            BitmapFactory.decodeStream(is, null, o);
            if (is != null) is.close();
            if (o.outWidth <= 0 || o.outHeight <= 0) {
                notifyImg(false);
                return;
            }

            int max = 1440;
            int sample = 1;
            while (Math.max(o.outWidth, o.outHeight) / (sample * 2) >= max) sample *= 2;

            BitmapFactory.Options o2 = new BitmapFactory.Options();
            o2.inSampleSize = sample;
            is = getContentResolver().openInputStream(uri);
            Bitmap bm = BitmapFactory.decodeStream(is, null, o2);
            if (is != null) is.close();
            if (bm == null) {
                notifyImg(false);
                return;
            }

            int w = bm.getWidth(), h = bm.getHeight();
            float sc = Math.min(1f, (float) max / Math.max(w, h));
            if (sc < 1f) {
                bm = Bitmap.createScaledBitmap(bm, Math.round(w * sc), Math.round(h * sc), true);
            }
            ByteArrayOutputStream bo = new ByteArrayOutputStream();
            bm.compress(Bitmap.CompressFormat.JPEG, 82, bo);
            pendingImg = Base64.encodeToString(bo.toByteArray(), Base64.NO_WRAP);
            notifyImg(true);
        } catch (Exception e) {
            pendingImg = null;
            notifyImg(false);
        }
    }

    private void notifyImg(final boolean ok) {
        runOnUiThread(new Runnable() {
            public void run() {
                if (wv != null) {
                    wv.evaluateJavascript(
                        "window.__imgCb&&window.__imgCb('" + (ok ? "ok" : "") + "')", null);
                }
            }
        });
    }

    /** 返回键交给页面：有弹层先关弹层，没有才退出 */
    @Override
    public void onBackPressed() {
        if (wv == null) {
            super.onBackPressed();
            return;
        }
        wv.evaluateJavascript("(window.__onBack&&window.__onBack())?'1':'0'",
            new ValueCallback<String>() {
                @Override
                public void onReceiveValue(String v) {
                    if (v == null || !v.contains("1")) {
                        MainActivity.super.onBackPressed();
                    }
                }
            });
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        return super.onKeyDown(keyCode, event);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) setupEdgeToEdge();
    }

    @Override
    protected void onDestroy() {
        if (wv != null) {
            wv.destroy();
            wv = null;
        }
        super.onDestroy();
    }
}
