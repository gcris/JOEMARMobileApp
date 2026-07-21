package com.pnp.geotracker

import android.content.Context
import android.os.Build
import android.telephony.CellInfo
import android.telephony.CellSignalStrengthLte
import android.telephony.CellSignalStrengthNr
import android.telephony.TelephonyManager

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class SignalStrengthModule(
    reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "SignalStrengthModule"
    }

    @ReactMethod
    fun getSignalStrength(promise: Promise) {

        try {

            val telephonyManager =
                reactApplicationContext.getSystemService(Context.TELEPHONY_SERVICE)
                        as TelephonyManager

            val cellInfoList: List<CellInfo> =
                telephonyManager.allCellInfo

            if (cellInfoList.isEmpty()) {
                promise.reject("NO_SIGNAL", "No cellular signal found.")
                return
            }

            val result = Arguments.createMap()

            for (cell in cellInfoList) {

                if (!cell.isRegistered) continue

                when {

                    Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q &&
                            cell.cellSignalStrength is CellSignalStrengthNr -> {

                        val signal =
                            cell.cellSignalStrength as CellSignalStrengthNr

                        result.putString("networkType", "5G")
                        result.putInt("dbm", signal.dbm)
                        result.putInt("level", signal.level)

                        promise.resolve(result)
                        return
                    }

                    cell.cellSignalStrength is CellSignalStrengthLte -> {

                        val signal =
                            cell.cellSignalStrength as CellSignalStrengthLte

                        result.putString("networkType", "LTE")
                        result.putInt("dbm", signal.dbm)
                        result.putInt("level", signal.level)

                        promise.resolve(result)
                        return
                    }
                }
            }

            promise.reject("NO_SIGNAL", "Registered network not found.")

        } catch (e: Exception) {

            promise.reject("ERROR", e.message)

        }
    }
}