package com.dayloop.app;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.auth.api.signin.GoogleSignIn;
import com.google.android.gms.auth.api.signin.GoogleSignInAccount;
import com.google.android.gms.auth.api.signin.GoogleSignInClient;
import com.google.android.gms.auth.api.signin.GoogleSignInOptions;
import com.google.android.gms.auth.api.signin.GoogleSignInStatusCodes;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.common.api.CommonStatusCodes;

@CapacitorPlugin(name = "DayLoopGoogleSignIn")
public class DayLoopGoogleSignInPlugin extends Plugin {
    @PluginMethod
    public void signIn(PluginCall call) {
        int clientIdResource = getContext().getResources().getIdentifier(
            "default_web_client_id", "string", getContext().getPackageName()
        );
        String clientId = clientIdResource == 0 ? "" : getContext().getString(clientIdResource).trim();
        if (clientId.isEmpty()) {
            call.reject("Google sign-in is unavailable in this APK.", "google/configuration");
            return;
        }

        GoogleSignInOptions options = new GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestIdToken(clientId)
            .build();
        Activity activity = getActivity();
        activity.runOnUiThread(() -> {
            if (activity.isFinishing() || activity.isDestroyed()) {
                call.reject("Google sign-in could not open.", "google/unavailable");
                return;
            }

            GoogleSignInClient client = GoogleSignIn.getClient(activity, options);
            try {
                startActivityForResult(call, client.getSignInIntent(), "handleSignInResult");
            } catch (ActivityNotFoundException exception) {
                call.reject("Google sign-in is unavailable on this device.", "google/unavailable");
            }
        });
    }

    @ActivityCallback
    private void handleSignInResult(PluginCall call, ActivityResult result) {
        if (call == null) return;

        if (result.getResultCode() == Activity.RESULT_CANCELED && result.getData() == null) {
            call.reject("Google sign-in was cancelled.", "google/cancelled");
            return;
        }

        try {
            GoogleSignInAccount account = GoogleSignIn.getSignedInAccountFromIntent(result.getData())
                .getResult(ApiException.class);
            String idToken = account == null ? null : account.getIdToken();
            if (idToken == null || idToken.isEmpty()) {
                call.reject("Google did not return an ID token.", "google/missing-token");
                return;
            }

            // No access token, server authorization code, or native Firebase login
            // is required to establish the existing Firebase Web session.
            JSObject response = new JSObject();
            response.put("idToken", idToken);
            call.resolve(response);
        } catch (ApiException exception) {
            int status = exception.getStatusCode();
            if (status == GoogleSignInStatusCodes.SIGN_IN_CANCELLED || status == CommonStatusCodes.CANCELED) {
                call.reject("Google sign-in was cancelled.", "google/cancelled");
            } else if (status == CommonStatusCodes.DEVELOPER_ERROR) {
                call.reject("The APK's Google sign-in configuration was rejected.", "google/configuration");
            } else if (status == CommonStatusCodes.NETWORK_ERROR) {
                call.reject("Google sign-in could not reach Google.", "google/network");
            } else {
                call.reject("Google sign-in failed.", "google/native-" + status);
            }
        }
    }
}
