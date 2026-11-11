
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

object PatrolSyncRunner {

    private const val TAG = "PatrolSyncRunner"

    fun syncPending(context: Context): Boolean {
        return try {
            SyncManager(context.applicationContext).syncPendingAll()
        } catch (e: Exception) {
            Log.e(TAG, "Unable to sync pending patrol records", e)
            false
        }
    }
}

class SyncWorker(
    context: Context,
    params: WorkerParameters
) : Worker(context, params) {

    override fun doWork(): Result {
        Log.i("SyncWorker", "Patrol sync worker started")

        return try {
            if (PatrolSyncRunner.syncPending(applicationContext)) {
                Log.i("SyncWorker", "Patrol sync completed")
                Result.success()
            } else {
                Log.w("SyncWorker", "Patrol sync unsuccessful; retrying")
                Result.retry()
            }
        } catch (e: Exception) {
            Log.e("SyncWorker", "Sync worker failed", e)
            Result.retry()
        }
    }

    companion object {
        private const val UNIQUE_NAME = "patrol_sync"

        fun enqueue(context: Context) {
            val request =
                OneTimeWorkRequestBuilder<SyncWorker>()
                    .setConstraints(
                        Constraints.Builder()
                            .setRequiredNetworkType(NetworkType.CONNECTED)
                            .build()
                    )
                    .setBackoffCriteria(
                        BackoffPolicy.EXPONENTIAL,
                        30,
                        TimeUnit.SECONDS
                    )
                    .build()

            WorkManager.getInstance(context.applicationContext)
                .enqueueUniqueWork(
                    UNIQUE_NAME,
                    ExistingWorkPolicy.KEEP,
                    request
                )
        }
    }
}
