package com.pnp.geotracker.sync

import android.content.Context
import android.util.Log

import com.pnp.geotracker.repository.PatrolRepository
import com.pnp.geotracker.model.PatrolLocation
import com.pnp.geotracker.model.SupabaseLocation
import com.pnp.geotracker.network.SupabaseApi

class SyncManager(
    context: Context
) {

    companion object {
        private const val TAG = "SyncManager"
    }

    private val repository = PatrolRepository(context)
    private val api = SupabaseApi()

    fun sync(): Int {
        val locations =
            repository.getUnsyncedLocations()

        Log.d(TAG, "Pending = ${locations.size}")

        if (locations.isEmpty())
            return 0

        val success =
            api.upload(locations)

        if (success) {

            repository.markAsSynced(
                locations.map { it.id }
            )

            Log.d(
                TAG,
                "Uploaded ${locations.size} locations"
            )

        } else {

            Log.d(
                TAG,
                "Upload failed"
            )

        }

        return locations.size;
    }

    private fun convert(
        location: PatrolLocation
    ): SupabaseLocation {

        return SupabaseLocation(
            personnel_id = location.personnelId,
            duty_type = location.dutyType,
            latitude = location.latitude,
            longitude = location.longitude,
            accuracy = location.accuracy,
            speed = location.speed,
            network_signal = location.networkSignal,
            captured_at = location.timestamp
        )
    }
}