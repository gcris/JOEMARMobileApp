
package com.pnp.geotracker.signal

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.SystemClock
import android.telephony.CellInfo
import android.telephony.CellInfoCdma
import android.telephony.CellInfoGsm
import android.telephony.CellInfoLte
import android.telephony.CellInfoWcdma
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
                    getSignalFromCell(registeredCell)
                }
            }

        } catch (e: SecurityException) {
            null
        } catch (e: LinkageError) {
            // Prevent unavailable Android APIs from crashing patrol tracking.
            null
        } catch (e: Exception) {
            null
        }

        cachedSignal = result
        lastReadTime = now

        return result
    }

    private fun getSignalFromCell(cell: CellInfo): NetworkSignal? {

        return when (cell) {

            is CellInfoLte -> {
                val strength = cell.cellSignalStrength

                NetworkSignal(
                    networkType = "LTE",
                    dbm = strength.dbm,
                    level = strength.level.coerceIn(0, 4)
                )
            }

            is CellInfoGsm -> {
                val strength = cell.cellSignalStrength

                NetworkSignal(
                    networkType = "CELLULAR",
                    dbm = strength.dbm,
                    level = strength.level.coerceIn(0, 4)
                )
            }

            is CellInfoWcdma -> {
                val strength = cell.cellSignalStrength

                NetworkSignal(
                    networkType = "CELLULAR",
                    dbm = strength.dbm,
                    level = strength.level.coerceIn(0, 4)
                )
            }

            is CellInfoCdma -> {
                val strength = cell.cellSignalStrength

                NetworkSignal(
                    networkType = "CELLULAR",
                    dbm = strength.dbm,
                    level = strength.level.coerceIn(0, 4)
                )
            }

            else -> null
        }
    }

    fun getSignalLevel(context: Context): Int {
        return getSignal(context)?.level ?: -1
    }
}
