package com.pnp.geotracker.sync

import android.content.Context
import android.util.Log
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import java.util.concurrent.TimeUnit

/**
 * ONE place that talks to your existing manual sync code.
 * Both the live monitor and the WorkManager job call this.
 *
 * Rules for the function you connect here:
 *  - Blocking (it is always called off the main thread).
 *  - Upload oldest first, in batches (for example 100 rows).
 *  - Delete or mark a local row as synced ONLY after the server confirms it.
 *  - Safe to run twice: use an upsert on (personnel_id, timestamp) on the server.
 *  - Return true when nothing is left, false if something failed.
 */
object PatrolSyncRunner {

    private const val TAG = "PatrolSyncRunner"

    fun syncPending(context: Context): Boolean {
        // TODO: call your existing manual sync here, for example:
        //   return PatrolRepository(context).syncPendingLocations()
        Log.w(TAG, "syncPending() is not connected to the real sync code yet")
        return false
    }
}

/**
 * Safety net: runs as soon as the phone has a network connection, even if the
 * foreground service has stopped, the app was closed, or the phone rebooted.
 * WorkManager retries with backoff by itself while this returns Result.retry().
 */
class SyncWorker(
    context: Context,
    params: WorkerParameters
) : Worker(context, params) {

    override fun doWork(): Result {
        return try {
            if (PatrolSyncRunner.syncPending(applicationContext)) {
                Result.success()
            } else {
                Result.retry()
            }
        } catch (e: Exception) {
            Log.e("SyncWorker", "Sync failed", e)
            Result.retry()
        }
    }

    companion object {
        private const val UNIQUE_NAME = "patrol_sync"

        /** Safe to call as often as you like: only one job is ever queued. */
        fun enqueue(context: Context) {
            val request = OneTimeWorkRequestBuilder<SyncWorker>()
                .setConstraints(
                    Constraints.Builder()
                        .setRequiredNetworkType(NetworkType.CONNECTED)
                        .build()
                )
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
                .build()

            WorkManager.getInstance(context.applicationContext)
                .enqueueUniqueWork(UNIQUE_NAME, ExistingWorkPolicy.KEEP, request)
        }
    }
}
