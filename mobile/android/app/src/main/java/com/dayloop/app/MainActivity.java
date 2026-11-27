package com.dayloop.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

// Android back presses are handled by @capacitor/app in the React router.
public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(DayLoopGoogleSignInPlugin.class);
        registerPlugin(DayLoopUpdaterPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
