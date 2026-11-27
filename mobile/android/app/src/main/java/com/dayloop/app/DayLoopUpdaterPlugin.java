package com.dayloop.app;

import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.*;
import java.net.URL;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.concurrent.atomic.AtomicBoolean;
import javax.net.ssl.HttpsURLConnection;

@CapacitorPlugin(name="DayLoopUpdater")
public class DayLoopUpdaterPlugin extends Plugin {
    private final AtomicBoolean busy = new AtomicBoolean(false);
    private static final long MAX_BYTES = 100L * 1024 * 1024;
    private File apk() { return new File(new File(getContext().getCacheDir(), "updates"), "dayloop.apk"); }
    @PluginMethod public void canInstall(PluginCall call) {
        JSObject result = new JSObject();
        result.put("allowed", Build.VERSION.SDK_INT < 26 || getContext().getPackageManager().canRequestPackageInstalls());
        call.resolve(result);
    }
    @PluginMethod public void openInstallSettings(PluginCall call) {
        try {
            getActivity().startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse("package:" + getContext().getPackageName())));
            call.resolve();
        } catch (Exception e) { call.reject("Unable to open installation settings."); }
    }
    private static String hex(byte[] bytes) {
        StringBuilder result = new StringBuilder();
        for (byte b : bytes) result.append(String.format(java.util.Locale.ROOT,"%02x", b & 255));
        return result.toString();
    }
    private long version(PackageInfo p) { return Build.VERSION.SDK_INT >= 28 ? p.getLongVersionCode() : p.versionCode; }
    private Signature[] signers(PackageInfo p) {
        return Build.VERSION.SDK_INT >= 28 ? p.signingInfo.getApkContentsSigners() : p.signatures;
    }
    private void verify(File file, String hash, long code) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (InputStream in = new FileInputStream(file)) {
            byte[] b = new byte[65536]; int n;
            while ((n=in.read(b)) != -1) digest.update(b,0,n);
        }
        if (!hex(digest.digest()).equalsIgnoreCase(hash)) throw new IOException("APK checksum mismatch.");
        PackageManager pm = getContext().getPackageManager();
        int flags = Build.VERSION.SDK_INT >= 28 ? PackageManager.GET_SIGNING_CERTIFICATES : PackageManager.GET_SIGNATURES;
        PackageInfo installed = pm.getPackageInfo(getContext().getPackageName(), flags);
        PackageInfo candidate = pm.getPackageArchiveInfo(file.getAbsolutePath(), flags);
        if (candidate == null || !installed.packageName.equals(candidate.packageName)) throw new IOException("APK package identity mismatch.");
        if (version(candidate) != code || code <= version(installed)) throw new IOException("APK version is not a valid upgrade.");
        Signature[] a = signers(installed), b = signers(candidate);
        if (a == null || b == null || a.length != b.length || !Arrays.asList(a).containsAll(Arrays.asList(b))) throw new IOException("APK signing certificate mismatch.");
    }
    @PluginMethod public void downloadAndVerify(PluginCall call) {
        String address = call.getString("url"), hash = call.getString("sha256");
        Integer code = call.getInt("versionCode");
        if (address == null || hash == null || !hash.matches("[0-9a-fA-F]{64}") || code == null || code <= 0) {
            call.reject("Invalid release metadata."); return;
        }
        if (!busy.compareAndSet(false,true)) { call.reject("An update is already downloading."); return; }
        getBridge().execute(() -> {
            File file = apk(); HttpsURLConnection connection = null;
            try {
                URL url = new URL(address);
                if (!"https".equals(url.getProtocol()) || url.getUserInfo()!=null) throw new IOException("HTTPS required.");
                if (!file.getParentFile().isDirectory() && !file.getParentFile().mkdirs()) throw new IOException("Cannot create update directory.");
                if (file.exists() && !file.delete()) throw new IOException("Cannot replace old download.");
                for (int redirects=0; ; redirects++) {
                    String host=url.getHost().toLowerCase(java.util.Locale.ROOT);
                    if (!"https".equals(url.getProtocol()) || url.getUserInfo()!=null ||
                        !(host.equals("github.com") || host.equals("release-assets.githubusercontent.com") || host.equals("objects.githubusercontent.com"))) throw new IOException("Untrusted download host.");
                    connection=(HttpsURLConnection)url.openConnection();
                    connection.setInstanceFollowRedirects(false);
                    connection.setConnectTimeout(15000); connection.setReadTimeout(30000);
                    int status=connection.getResponseCode();
                    if(status==200)break;
                    String target=connection.getHeaderField("Location");
                    connection.disconnect();connection=null;
                    if(redirects>=4||target==null||!(status==301||status==302||status==303||status==307||status==308))throw new IOException("Download unavailable.");
                    url=new URL(url,target);
                }
                long total=connection.getContentLengthLong(), received=0;
                if (total>MAX_BYTES) throw new IOException("APK exceeds size limit.");
                try (InputStream in=connection.getInputStream(); FileOutputStream out=new FileOutputStream(file)) {
                    byte[] buffer=new byte[65536]; int n; long last=0;
                    while ((n=in.read(buffer))!=-1) {
                        received+=n;
                        if (received>MAX_BYTES) throw new IOException("APK exceeds size limit.");
                        out.write(buffer,0,n);
                        if (System.currentTimeMillis()-last>200) {
                            JSObject progress=new JSObject(); progress.put("received",received); progress.put("total",total);
                            notifyListeners("progress",progress); last=System.currentTimeMillis();
                        }
                    }
                    out.getFD().sync();
                }
                if (total>=0 && total!=received) throw new IOException("Incomplete download.");
                verify(file,hash,code);
                call.resolve();
            } catch (Exception e) {
                file.delete(); call.reject("Update download or verification failed: "+e.getMessage());
            } finally { if(connection!=null)connection.disconnect(); busy.set(false); }
        });
    }
    @PluginMethod public void installApk(PluginCall call) {
        String hash=call.getString("sha256"); Integer code=call.getInt("versionCode");
        if (busy.get() || hash==null || !hash.matches("[0-9a-fA-F]{64}") || code==null) {call.reject("Invalid installation request.");return;}
        if (Build.VERSION.SDK_INT>=26 && !getContext().getPackageManager().canRequestPackageInstalls()) {call.reject("Allow installations from DayLoop first.");return;}
        getBridge().execute(() -> {
            try {
                verify(apk(),hash,code);
                Uri uri=FileProvider.getUriForFile(getContext(),getContext().getPackageName()+".updates",apk());
                Intent intent=new Intent(Intent.ACTION_VIEW);
                intent.setDataAndType(uri,"application/vnd.android.package-archive");
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                getActivity().runOnUiThread(() -> {try {getActivity().startActivity(intent);call.resolve();}catch(Exception e){call.reject("Android installer unavailable.");}});
            } catch(Exception e){apk().delete();call.reject("APK verification failed: "+e.getMessage());}
        });
    }
}
