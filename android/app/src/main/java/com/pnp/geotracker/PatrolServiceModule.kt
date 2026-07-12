package com.pnp.geotracker

import android.content.Intent
import android.os.Build

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class PatrolServiceModule(
    reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "PatrolService"
    }

    @ReactMethod
    fun startPatrol(promise: Promise) {

        try {

            val intent = Intent(
                reactApplicationContext,
                PatrolForegroundService::class.java
            )

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                reactApplicationContext.startForegroundService(intent)
            } else {
                reactApplicationContext.startService(intent)
            }

            promise.resolve(true)

        } catch (e: Exception) {
            promise.reject("START_ERROR", e)
        }
    }

    @ReactMethod
    fun stopService(promise: Promise) {

        try {

            val intent = Intent(
                reactApplicationContext,
                PatrolForegroundService::class.java
            )

            reactApplicationContext.stopService(intent)

            promise.resolve(true)

        } catch (e: Exception) {
            promise.reject("STOP_ERROR", e)
        }
    }
}