package com.familygames.app;

import android.app.Activity;
import android.content.pm.ApplicationInfo;
import android.graphics.Color;
import android.os.Bundle;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * The whole Android side of the app: one full-screen web view that shows
 * the games from the games website. The website keeps a copy of itself on
 * the phone, so the games still work offline after the first visit.
 * You normally never need to touch this.
 */
public class MainActivity extends Activity {

    // Where the games live online (the "web" folder, published by GitHub).
    static final String GAMES_URL = "https://trey120234.github.io/family-games/index.html";

    // Shown only if there's no internet AND no saved copy yet (first launch offline).
    static final String OFFLINE_PAGE = "file:///android_asset/offline.html?retry=";

    private WebView web;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Test builds can be inspected from a computer at chrome://inspect
        boolean isDebugBuild = (getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
        WebView.setWebContentsDebuggingEnabled(isDebugBuild);

        web = new WebView(this);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);   // the games are written in JavaScript
        settings.setDomStorageEnabled(true);   // lets them remember stats and games
        settings.setTextZoom(100);             // the games are already large print

        // Keep every screen inside the app, and show the "Almost ready"
        // page if the very first visit happens without internet.
        web.setWebViewClient(new WebViewClient() {
            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) {
                    view.loadUrl(OFFLINE_PAGE + GAMES_URL);
                }
            }
        });

        web.setBackgroundColor(Color.parseColor("#eef3ee"));
        setContentView(web);
        web.loadUrl(GAMES_URL);  // the home screen
    }

    // Phone's Back button: go back a screen (e.g. game -> home) before closing the app.
    @Override
    public void onBackPressed() {
        boolean onOfflinePage = web != null && web.getUrl() != null && web.getUrl().startsWith("file:");
        if (web != null && web.canGoBack() && !onOfflinePage) {
            web.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
