package com.pnp.geotracker   // <-- Change this to match your package

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap

class SOSModule(
    reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "SOSModule"
    }

    @ReactMethod
    fun showSOS(data: ReadableMap) {

        val title = data.getString("title") ?: ""
        val body = data.getString("body") ?: ""
        val senderName = data.getString("senderName") ?: ""
        val phoneNumber = data.getString("phone_number") ?: ""

        val latitude =
            if (data.hasKey("latitude"))
                data.getDouble("latitude")
            else
                0.0

        val longitude =
            if (data.hasKey("longitude"))
                data.getDouble("longitude")
            else
                0.0

        SOSNotificationHelper.showSOS(
            reactApplicationContext,
            title,
            body,
            senderName,
            phoneNumber,
            latitude,
            longitude
        )
    }
}