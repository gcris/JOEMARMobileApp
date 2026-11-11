package com.pnp.geotracker

import android.content.Context
import android.os.Build
import android.telephony.CellInfo
import android.telephony.CellSignalStrengthLte
import android.telephony.CellSignalStrengthNr
import android.telephony.TelephonyManager
import android.annotation.TargetApi

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

import com.pnp.geotracker.signal.SignalStrengthHelper

class SignalStrengthModule(
    reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "SignalStrengthModule"
    }

    @ReactMethod
    fun getSignalStrength(promise: Promise) {
        try {
            val signal = SignalStrengthHelper.getSignal(
                reactApplicationContext
            )

            if (signal == null) {
                promise.reject(
                    "NO_SIGNAL",
                    "Cellular signal unavailable or permission not granted."
                )
                return
            }

            val result = Arguments.createMap().apply {
                putString("networkType", signal.networkType)
                putInt("dbm", signal.dbm)
                putInt("level", signal.level)
            }

            promise.resolve(result)

        } catch (e: Exception) {
            promise.reject("SIGNAL_ERROR", e.message, e)
        }
    }
}