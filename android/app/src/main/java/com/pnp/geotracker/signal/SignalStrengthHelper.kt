
package com.pnp.geotracker.signal

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.SystemClock
import android.telephony.CellInfo
import android.telephony.CellSignalStrengthLte
import android.telephony.CellSignalStrengthNr
import android.telephony.TelephonyManager

data class NetworkSignal(
    val networkType: String,
    val dbm: Int,
    val level: Int
)

object SignalStrengthHelper {

    private const val CACHE_DURATION_MS = 30_000L

    private var cachedSignal: NetworkSignal? = null
    private var lastReadTime = 0L

    @Synchronized
    fun getSignal(context: Context): NetworkSignal? {

        val now = SystemClock.elapsedRealtime()

        // Reuse the previous reading for 30 seconds.
        if (now - lastReadTime < CACHE_DURATION_MS) {
            return cachedSignal
        }

        val result = try {

            if (
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.M &&
                context.checkSelfPermission(
                    Manifest.permission.ACCESS_FINE_LOCATION
                ) != PackageManager.PERMISSION_GRANTED
            ) {
                null
            } else {

                val telephonyManager =
                    context.applicationContext.getSystemService(
                        Context.TELEPHONY_SERVICE
                    ) as? TelephonyManager

                val cells: List<CellInfo> =
                    telephonyManager?.allCellInfo ?: emptyList()

                val registeredCell = cells.firstOrNull {
                    it.isRegistered
                }

                if (registeredCell == null) {
                    null
                } else {

                    val strength = registeredCell.cellSignalStrength

                    val networkType = when {

                        Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q &&
                            strength is CellSignalStrengthNr -> "5G"

                        strength is CellSignalStrengthLte -> "LTE"

                        else -> "CELLULAR"
                    }

                    NetworkSignal(
                        networkType = networkType,
                        dbm = strength.dbm,
                        level = strength.level.coerceIn(0, 4)
                    )
                }
            }

        } catch (e: SecurityException) {
            null
        } catch (e: Exception) {
            null
        }

        cachedSignal = result
        lastReadTime = now

        return result
    }

    fun getSignalLevel(context: Context): Int {
        return getSignal(context)?.level ?: -1
    }
}
