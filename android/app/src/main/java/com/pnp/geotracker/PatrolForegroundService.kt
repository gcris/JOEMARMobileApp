package com.pnp.geotracker

import com.pnp.geotracker.patrol.PatrolManager
import com.pnp.geotracker.PatrolServiceModule
import com.pnp.geotracker.sync.SyncManager
import com.pnp.geotracker.sync.NetworkSyncMonitor

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.app.PendingIntent
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.os.Handler
import android.os.Looper
import android.util.Log

import androidx.core.app.NotificationCompat

class PatrolForegroundService : Service() {

    private lateinit var patrolManager: PatrolManager
    private lateinit var syncManager: SyncManager
    private lateinit var networkSyncMonitor: NetworkSyncMonitor

    private val handler = Handler(Looper.getMainLooper())

    @Volatile
    private var stopInProgress = false

    companion object {
        const val TAG = "PatrolService"
        const val CHANNEL_ID = "patrol_tracking"
        const val NOTIFICATION_ID = 1001

        const val ACTION_STOP_PATROL =
            "com.pnp.geotracker.STOP_PATROL"

        const val ACTION_OPEN_APP =
            "com.pnp.geotracker.OPEN_APP"

        private const val PREFS_NAME = "patrol_session"
        private const val KEY_DUTY_TYPE = "duty_type"
        private const val KEY_PERSONNEL_ID = "personnel_id"
    }

    // private val syncRunnable = object : Runnable {
    //    override fun run() {
    //        if (syncing.compareAndSet(false, true)) {
    //            Thread {
    //                try {
    //                    syncManager.sync()
    //                } catch (e: Exception) {
    //                    Log.e(TAG, "Periodic sync failed", e)
    //                } finally {
    //                    syncing.set(false)
    //                }
    //            }.start()
    //        }
    //        handler.postDelayed(this, 5_000L)
    //    }
    // }

    private val notificationChecker = object : Runnable {
        override fun run() {

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                val manager =
                    getSystemService(NotificationManager::class.java)

                val exists = manager.activeNotifications.any {
                    it.id == NOTIFICATION_ID
                }

                if (!exists && PatrolManager.isRunning()) {
                    startForeground(
                        NOTIFICATION_ID,
                        createNotification()
                    )

                    Log.d(TAG, "Foreground notification restored")
                }
            }

            handler.postDelayed(this, 5 * 60 * 1000L)
        }
    }

    override fun onCreate() {
        super.onCreate()

        createNotificationChannel()

        patrolManager = PatrolManager(this)
        syncManager = SyncManager(this)
        networkSyncMonitor = NetworkSyncMonitor(this) { syncManager.sync() == 0 }

        handler.post(notificationChecker)
        networkSyncMonitor.start()

        Log.d(TAG, "Service created")
    }

    override fun onStartCommand(
        intent: Intent?,
        flags: Int,
        startId: Int
    ): Int {

        if (intent?.action == ACTION_STOP_PATROL) {

            if (stopInProgress) {
                Log.d(TAG, "Patrol shutdown already requested")
                return START_NOT_STICKY
            }

            stopInProgress = true

            Log.i(TAG, "STOP PATROL: waiting for GPS shutdown")

            // Stop periodic notification checking immediately.
            handler.removeCallbacks(notificationChecker)

            patrolManager.stopPatrol { success ->

                Log.i(
                    TAG,
                    "PatrolManager shutdown completed: $success"
                )

                // Clear the saved patrol session only after GPS shutdown.
                getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
                    .edit()
                    .clear()
                    .apply()

                // Stop the network monitor, but do not delete
                // or cancel locally stored unsynchronized records.
                networkSyncMonitor.stop()

                stopForeground(STOP_FOREGROUND_REMOVE)

                // Notify React Native after GPS shutdown.
                try {
                    PatrolServiceModule.sendEvent("PATROL_STOPPED")
                } catch (e: Exception) {
                    Log.e(TAG, "Unable to send PATROL_STOPPED event", e)
                }

                // Resolve any pending React Native stop request.
                PatrolServiceModule.completeStop(success)

                Log.i(TAG, "PATROL SERVICE SHUTDOWN COMPLETE")

                stopSelf()
            }

            return START_NOT_STICKY
        }

        if (intent?.action == ACTION_OPEN_APP) {
            return START_STICKY
        }

        val preferences =
            getSharedPreferences(PREFS_NAME, MODE_PRIVATE)

        val suppliedDutyType =
            intent?.getStringExtra("dutyType")

        val suppliedPersonnelId =
            intent?.getStringExtra("personnelId")

        // Save a newly supplied patrol session.
        if (!suppliedDutyType.isNullOrBlank() &&
            !suppliedPersonnelId.isNullOrBlank()
        ) {
            preferences.edit()
                .putString(KEY_DUTY_TYPE, suppliedDutyType)
                .putString(KEY_PERSONNEL_ID, suppliedPersonnelId)
                .apply()
        }

        // Restore the previous patrol session if Android restarted the service.
        val dutyType = suppliedDutyType
            ?: preferences.getString(KEY_DUTY_TYPE, null)

        val personnelId = suppliedPersonnelId
            ?: preferences.getString(KEY_PERSONNEL_ID, null)

        if (dutyType.isNullOrBlank() || personnelId.isNullOrBlank()) {
            Log.e(TAG, "Cannot restore patrol: missing duty type or personnel ID")

            stopSelfResult(startId)
            return START_NOT_STICKY
        }

        Log.d(TAG, "Starting patrol: $dutyType")
        Log.d(TAG, "Personnel ID: $personnelId")

        startForeground(
            NOTIFICATION_ID,
            createNotification()
        )

        patrolManager.startPatrol(dutyType, personnelId)

        return START_STICKY
    }

    override fun onDestroy() {
        handler.removeCallbacks(notificationChecker)
        networkSyncMonitor.stop()

        patrolManager.stopPatrol()

        stopForeground(STOP_FOREGROUND_REMOVE)

        Log.d(TAG, "Patrol foreground service destroyed")

        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun createNotification(): Notification {

        val openIntent = packageManager
            .getLaunchIntentForPackage(packageName)

        val openPendingIntent = PendingIntent.getActivity(
            this,
            0,
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or
                PendingIntent.FLAG_IMMUTABLE
        )

        val stopIntent = Intent(
            this,
            PatrolForegroundService::class.java
        ).apply {
            action = ACTION_STOP_PATROL
        }

        val stopPendingIntent = PendingIntent.getService(
            this,
            1,
            stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or
                PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("Project PATROL")
            .setContentText("Patrol tracking is active")
            .setOngoing(true)
            .setContentIntent(openPendingIntent)
            .addAction(
                android.R.drawable.ic_menu_view,
                "Open",
                openPendingIntent
            )
            .addAction(
                android.R.drawable.ic_media_pause,
                "Stop Patrol",
                stopPendingIntent
            )
            .build()
    }

    private fun createNotificationChannel() {

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {

            val channel = NotificationChannel(
                CHANNEL_ID,
                "Patrol Tracking",
                NotificationManager.IMPORTANCE_LOW
            )

            val manager =
                getSystemService(NotificationManager::class.java)

            manager.createNotificationChannel(channel)
        }
    }
}