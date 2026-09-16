package com.postupp.app.plugins;

import android.Manifest;
import android.content.ContentUris;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;
import android.provider.Settings;
import android.util.Base64;
import android.util.Size;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(
    name = "DeviceGallery",
    permissions = {
        @Permission(
            alias = "galleryLegacy",
            strings = { Manifest.permission.READ_EXTERNAL_STORAGE }
        ),
        @Permission(
            alias = "galleryModern",
            strings = {
                Manifest.permission.READ_MEDIA_IMAGES,
                Manifest.permission.READ_MEDIA_VIDEO
            }
        )
    }
)
public class DeviceGalleryPlugin extends Plugin {
    private final ExecutorService io = Executors.newSingleThreadExecutor();

    @PluginMethod
    public void checkAccess(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("granted", isGranted());
        call.resolve(ret);
    }

    @PluginMethod
    public void requestAccess(PluginCall call) {
        if (isGranted()) {
            JSObject ret = new JSObject();
            ret.put("granted", true);
            call.resolve(ret);
            return;
        }
        requestPermissionForAlias(galleryAlias(), call, "onGalleryPermission");
    }

    @PermissionCallback
    private void onGalleryPermission(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("granted", isGranted());
        call.resolve(ret);
    }

    @PluginMethod
    public void openSettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
        intent.setData(Uri.parse("package:" + getContext().getPackageName()));
        getActivity().startActivity(intent);
        call.resolve();
    }

    @PluginMethod
    public void listMedia(PluginCall call) {
        if (!isGranted()) {
            call.reject("Photo library permission is required", "accessDenied");
            return;
        }
        final int quantity = Math.min(Math.max(call.getInt("quantity", 120), 1), 400);
        final String types = call.getString("types", "all");
        io.execute(() -> {
            try {
                JSObject ret = new JSObject();
                ret.put("items", toJson(queryMedia(quantity, types)));
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("Could not read device media", "filesystemError");
            }
        });
    }

    @PluginMethod
    public void copyToCache(PluginCall call) {
        final String uriStr = call.getString("uri");
        if (uriStr == null || uriStr.isEmpty()) {
            call.reject("Media uri is required", "argumentError");
            return;
        }
        io.execute(() -> {
            try {
                Uri uri = Uri.parse(uriStr);
                String mime = getContext().getContentResolver().getType(uri);
                if (mime == null) mime = "application/octet-stream";
                String name = call.getString("name", "media");
                name = sanitizeName(name, mime);
                File out = new File(getContext().getCacheDir(), "gallery_" + System.currentTimeMillis() + "_" + name);
                try (InputStream in = getContext().getContentResolver().openInputStream(uri);
                     FileOutputStream fos = new FileOutputStream(out)) {
                    if (in == null) {
                        call.reject("Could not open media", "filesystemError");
                        return;
                    }
                    byte[] buf = new byte[8192];
                    int n;
                    while ((n = in.read(buf)) != -1) {
                        fos.write(buf, 0, n);
                    }
                }
                JSObject ret = new JSObject();
                ret.put("path", out.getAbsolutePath());
                ret.put("mimeType", mime);
                ret.put("name", name);
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("Could not copy media", "filesystemError");
            }
        });
    }

    private String galleryAlias() {
        return Build.VERSION.SDK_INT >= 33 ? "galleryModern" : "galleryLegacy";
    }

    private boolean isGranted() {
        if (Build.VERSION.SDK_INT >= 33) {
            boolean images = hasPermission(Manifest.permission.READ_MEDIA_IMAGES);
            boolean videos = hasPermission(Manifest.permission.READ_MEDIA_VIDEO);
            boolean selected =
                Build.VERSION.SDK_INT >= 34 &&
                hasPermission(Manifest.permission.READ_MEDIA_VISUAL_USER_SELECTED);
            return images || videos || selected;
        }
        return hasPermission(Manifest.permission.READ_EXTERNAL_STORAGE);
    }

    private boolean hasPermission(String permission) {
        return getContext().checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED;
    }

    private static class MediaItem {
        Uri uri;
        String name;
        String mime;
        String kind;
        long durationMs;
        long dateAdded;
        String thumbnail;
    }

    private List<MediaItem> queryMedia(int quantity, String types) {
        List<MediaItem> items = new ArrayList<>();
        boolean photos = "all".equals(types) || "photos".equals(types);
        boolean videos = "all".equals(types) || "videos".equals(types);
        if (photos) {
            collect(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, "image", items, quantity);
        }
        if (videos) {
            collect(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, "video", items, quantity);
        }
        Collections.sort(items, new Comparator<MediaItem>() {
            @Override
            public int compare(MediaItem a, MediaItem b) {
                return Long.compare(b.dateAdded, a.dateAdded);
            }
        });
        if (items.size() > quantity) {
            return items.subList(0, quantity);
        }
        return items;
    }

    private void collect(Uri collection, String kind, List<MediaItem> out, int quantity) {
        String[] projection = new String[] {
            MediaStore.MediaColumns._ID,
            MediaStore.MediaColumns.DISPLAY_NAME,
            MediaStore.MediaColumns.MIME_TYPE,
            MediaStore.MediaColumns.DATE_ADDED,
            MediaStore.MediaColumns.DURATION
        };
        String sort = MediaStore.MediaColumns.DATE_ADDED + " DESC";
        try (Cursor cursor = getContext().getContentResolver().query(collection, projection, null, null, sort)) {
            if (cursor == null) return;
            int idCol = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns._ID);
            int nameCol = cursor.getColumnIndex(MediaStore.MediaColumns.DISPLAY_NAME);
            int mimeCol = cursor.getColumnIndex(MediaStore.MediaColumns.MIME_TYPE);
            int dateCol = cursor.getColumnIndex(MediaStore.MediaColumns.DATE_ADDED);
            int durCol = cursor.getColumnIndex(MediaStore.MediaColumns.DURATION);
            int counted = 0;
            while (cursor.moveToNext() && counted < quantity) {
                long id = cursor.getLong(idCol);
                Uri uri = ContentUris.withAppendedId(collection, id);
                MediaItem item = new MediaItem();
                item.uri = uri;
                item.kind = kind;
                item.name = nameCol >= 0 ? cursor.getString(nameCol) : (kind + "-" + id);
                item.mime = mimeCol >= 0 ? cursor.getString(mimeCol) : ("image".equals(kind) ? "image/jpeg" : "video/mp4");
                item.dateAdded = dateCol >= 0 ? cursor.getLong(dateCol) : 0;
                item.durationMs = durCol >= 0 ? cursor.getLong(durCol) : 0;
                item.thumbnail = thumbnailDataUrl(uri);
                if (item.name == null) item.name = kind + "-" + id;
                if (item.mime == null) item.mime = "application/octet-stream";
                out.add(item);
                counted++;
            }
        }
    }

    private String thumbnailDataUrl(Uri uri) {
        Bitmap bmp = null;
        try {
            if (Build.VERSION.SDK_INT >= 29) {
                bmp = getContext().getContentResolver().loadThumbnail(uri, new Size(256, 256), null);
            } else {
                return "";
            }
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            bmp.compress(Bitmap.CompressFormat.JPEG, 70, baos);
            return "data:image/jpeg;base64," + Base64.encodeToString(baos.toByteArray(), Base64.NO_WRAP);
        } catch (Exception e) {
            return "";
        } finally {
            if (bmp != null) bmp.recycle();
        }
    }

    private JSArray toJson(List<MediaItem> items) {
        JSArray arr = new JSArray();
        for (MediaItem item : items) {
            JSObject obj = new JSObject();
            obj.put("id", item.uri.toString());
            obj.put("name", item.name);
            obj.put("mimeType", item.mime);
            obj.put("kind", item.kind);
            obj.put("durationMs", item.durationMs);
            obj.put("dateAdded", item.dateAdded);
            obj.put("thumbnail", item.thumbnail);
            arr.put(obj);
        }
        return arr;
    }

    private String sanitizeName(String name, String mime) {
        String clean = name.replaceAll("[^a-zA-Z0-9._-]", "_");
        if (!clean.contains(".")) {
            String ext = "bin";
            if (mime.contains("jpeg") || mime.contains("jpg")) ext = "jpg";
            else if (mime.contains("png")) ext = "png";
            else if (mime.contains("webp")) ext = "webp";
            else if (mime.contains("gif")) ext = "gif";
            else if (mime.contains("mp4")) ext = "mp4";
            else if (mime.contains("webm")) ext = "webm";
            else if (mime.contains("quicktime") || mime.contains("mov")) ext = "mov";
            clean = clean + "." + ext;
        }
        return clean.toLowerCase(Locale.US);
    }
}
