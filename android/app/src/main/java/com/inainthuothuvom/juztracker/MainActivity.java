package com.inainthuothuvom.juztracker;

import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onBackPressed() {
        WebView wv = bridge != null ? bridge.getWebView() : null;
        if (wv == null) {
            super.onBackPressed();
            return;
        }
        if (wv.canGoBack()) {
            wv.goBack();
        } else {
            wv.evaluateJavascript("handleBack('native')", null);
        }
    }
}
