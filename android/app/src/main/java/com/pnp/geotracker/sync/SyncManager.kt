
package com.pnp.geotracker.sync

import android.content.Context
import android.util.Log
import com.pnp.geotracker.network.SupabaseApi
import com.pnp.geotracker.repository.PatrolRepository

class SyncManager(context: Context) {

    companion object {
        private const val TAG = "SyncManager"
        private const val BATCH_SIZE = 100

        // Shared lock across all SyncManager instances.
        private val syncLock = Any()
    }

    private val repository =
        PatrolRepository(context.applicationContext)

    private val api = SupabaseApi()

    /**
     * Manual synchronization.
     * Uploads one batch and returns the number of
     * successfully uploaded records.
     */
    fun sync(): Int {
        return synchronized(syncLock) {

            Log.d(TAG, "Manual sync started")

            val locations =
                repository.getUnsyncedLocations(BATCH_SIZE)

            if (locations.isEmpty()) {
                Log.d(TAG, "No pending locations")
                return@synchronized 0
            }

            if (locations.any { it.personnelId.isBlank() }) {
                Log.e(
                    TAG,
                    "Sync stopped: batch contains an empty personnel ID"
                )
                return@synchronized 0
            }

            try {
                val success = api.upload(locations)

                if (!success) {
                    Log.e(
                        TAG,
                        "Upload failed; records remain pending"
                    )
                    return@synchronized 0
                }

                repository.markAsSynced(
                    locations.map { it.id }
                )

                Log.i(
                    TAG,
                    "Manual sync uploaded ${locations.size} locations"
                )

                locations.size

            } catch (e: Exception) {
                Log.e(TAG, "Manual sync failed", e)
                0
            }
        }
    }

    /**
     * WorkManager synchronization.
     * Continues uploading batches until the local
     * unsynced queue is empty.
     *
     * true  = all pending records uploaded
     * false = an upload failed or invalid records exist
     */
    fun syncPendingAll(): Boolean {
        return synchronized(syncLock) {

            Log.i(TAG, "Background sync started")

            var totalUploaded = 0

            try {
                while (true) {

                    val locations =
                        repository.getUnsyncedLocations(BATCH_SIZE)

                    // No more pending records.
                    if (locations.isEmpty()) {
                        Log.i(
                            TAG,
                            "Background sync completed. " +
                                "Total uploaded: $totalUploaded"
                        )

                        return@synchronized true
                    }

                    // Do not upload a partially valid batch.
                    if (locations.any { it.personnelId.isBlank() }) {
                        Log.e(
                            TAG,
                            "Background sync stopped: " +
                                "batch contains an empty personnel ID"
                        )

                        return@synchronized false
                    }

                    Log.d(
                        TAG,
                        "Uploading batch of ${locations.size} locations"
                    )

                    val success = api.upload(locations)

                    if (!success) {
                        Log.e(
                            TAG,
                            "Batch upload failed. " +
                                "Records remain pending."
                        )

                        return@synchronized false
                    }

                    // Only mark records synced after successful upload.
                    repository.markAsSynced(
                        locations.map { it.id }
                    )

                    totalUploaded += locations.size

                    Log.i(
                        TAG,
                        "Batch uploaded. Total uploaded: $totalUploaded"
                    )
                }

                @Suppress("UNREACHABLE_CODE")
                true

            } catch (e: Exception) {
                Log.e(TAG, "Background sync failed", e)
                false
            }
        }
    }
}
