package com.pnp.geotracker.signal

import android.content.Context
import android.os.Build
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

    fun getSignal(context: Context): NetworkSignal? {

        val telephonyManager =
            context.getSystemService(Context.TELEPHONY_SERVICE)
                    as TelephonyManager

        val cells: List<CellInfo> = telephonyManager.allCellInfo

        for (cell in cells) {

            if (!cell.isRegistered) continue

            when {

                Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q &&
                        cell.cellSignalStrength is CellSignalStrengthNr -> {

                    val signal =
                        cell.cellSignalStrength as CellSignalStrengthNr

                    return NetworkSignal(
                        "5G",
                        signal.dbm,
                        signal.level
                    )
                }

                cell.cellSignalStrength is CellSignalStrengthLte -> {

                    val signal =
                        cell.cellSignalStrength as CellSignalStrengthLte

                    return NetworkSignal(
                        "LTE",
                        signal.dbm,
                        signal.level
                    )
                }
            }
        }

        return null
    }
}