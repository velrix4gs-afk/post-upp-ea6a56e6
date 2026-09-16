package com.postupp.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.postupp.app.plugins.DeviceGalleryPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(DeviceGalleryPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
