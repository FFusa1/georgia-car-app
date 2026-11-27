package ge.carmarket.app;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * One-screen app: shows the dashboard page bundled in assets/index.html.
 * The page asks this activity to download data (Native.get / Native.post)
 * because some data services do not allow direct browser requests.
 */
public class MainActivity extends Activity {

    private WebView web;
    // One request at a time keeps us under the data service's rate limit.
    private final ExecutorService pool = Executors.newSingleThreadExecutor();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        web.addJavascriptInterface(new Bridge(), "Native");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                String scheme = u.getScheme();
                if ("http".equals(scheme) || "https".equals(scheme)) {
                    startActivity(new Intent(Intent.ACTION_VIEW, u));
                    return true;
                }
                return false;
            }
        });
        setContentView(web);
        web.loadUrl("file:///android_asset/index.html");
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        pool.shutdownNow();
        super.onDestroy();
    }

    /** Official data services the page may download from. */
    private static final String[] ALLOWED = {
            "https://comtradeapi.un.org/",
            "https://autoapi.geostat.ge/",
            "https://pc-axis.geostat.ge/",
            "https://nbg.gov.ge/",
            "https://api.worldbank.org/",
            "https://ec.europa.eu/eurostat/api/"
    };

    private static boolean allowed(String url) {
        for (String a : ALLOWED) if (url.startsWith(a)) return true;
        return false;
    }

    private class Bridge {
        @JavascriptInterface
        public void get(final String id, final String url) {
            fetch(id, url, null);
        }

        @JavascriptInterface
        public void post(final String id, final String url, final String json) {
            fetch(id, url, json);
        }

        private void fetch(final String id, final String url, final String json) {
            pool.execute(() -> {
                int code;
                String body;
                HttpURLConnection c = null;
                try {
                    if (!allowed(url)) {
                        throw new IllegalArgumentException("Blocked URL");
                    }
                    c = (HttpURLConnection) new URL(url).openConnection();
                    c.setConnectTimeout(20000);
                    c.setReadTimeout(60000);
                    c.setRequestProperty("User-Agent", "GeorgiaCarMarketApp/2.0");
                    c.setRequestProperty("Accept", "application/json, text/html");
                    if (json != null) {
                        c.setRequestMethod("POST");
                        c.setDoOutput(true);
                        c.setRequestProperty("Content-Type", "application/json");
                        byte[] out = json.getBytes(StandardCharsets.UTF_8);
                        c.setFixedLengthStreamingMode(out.length);
                        c.getOutputStream().write(out);
                    }
                    code = c.getResponseCode();
                    InputStream in = code >= 400 ? c.getErrorStream() : c.getInputStream();
                    body = in == null ? "" : read(in);
                } catch (Exception e) {
                    code = -1;
                    body = String.valueOf(e.getMessage());
                } finally {
                    if (c != null) c.disconnect();
                }
                final String js = "window.__nativeDone(" + JSONObject.quote(id) + "," + code + ","
                        + JSONObject.quote(body) + ")";
                runOnUiThread(() -> {
                    if (web != null) web.evaluateJavascript(js, null);
                });
            });
        }
    }

    private static String read(InputStream in) throws Exception {
        StringBuilder sb = new StringBuilder();
        try (BufferedReader r = new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8))) {
            char[] buf = new char[8192];
            int n;
            while ((n = r.read(buf)) > 0) sb.append(buf, 0, n);
        }
        return sb.toString();
    }
}
