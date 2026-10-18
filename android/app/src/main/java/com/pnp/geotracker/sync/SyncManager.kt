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
        Log.d(TAG, "================================")
        Log.d(TAG, "SYNC STARTED")

        try {
            val locations = repository.getUnsyncedLocations()

            Log.d(TAG, "Pending locations = ${locations.size}")

            if (locations.isEmpty()) {
                Log.d(TAG, "No pending locations to upload")
                Log.d(TAG, "SYNC FINISHED")
                return 0
            }

            // Print each pending location
            locations.forEachIndexed { index, location ->
                Log.d(
                    TAG,
                    """
                    Location #${index + 1}
                    ID: ${location.id}
                    Personnel ID: ${location.personnelId}
                    Duty Type: ${location.dutyType}
                    Latitude: ${location.latitude}
                    Longitude: ${location.longitude}
                    Accuracy: ${location.accuracy}
                    Speed: ${location.speed}
                    Network Signal: ${location.networkSignal}
                    Timestamp: ${location.timestamp}
                    """.trimIndent()
                )
            }

            Log.d(TAG, "Uploading ${locations.size} locations to Supabase...")

            val success = api.upload(locations)

            Log.d(TAG, "Upload result = $success")

            if (success) {
                Log.d(TAG, "Marking locations as synced...")

                repository.markAsSynced(
                    locations.map { it.id }
                )

                Log.d(
                    TAG,
                    "Successfully uploaded and marked ${locations.size} locations as synced"
                )
            } else {
                Log.e(TAG, "Upload failed; locations remain pending")
            }

            Log.d(TAG, "SYNC FINISHED")

            return locations.size

        } catch (e: Exception) {
            Log.e(TAG, "Unexpected error during sync", e)
            return 0
        }
    }

    private fun convert(
        location: PatrolLocation
    ): SupabaseLocation {

        Log.d(TAG, "Converting location ID=${location.id}")

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