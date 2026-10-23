package com.pnp.geotracker

import com.pnp.geotracker.patrol.PatrolManager
import com.pnp.geotracker.PatrolServiceModule

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

    private val handler = Handler(Looper.getMainLooper())

    companion object {
        const val TAG = "PatrolService"
        const val CHANNEL_ID = "patrol_tracking"
        const val NOTIFICATION_ID = 1001

        const val ACTION_STOP_PATROL =
            "com.pnp.geotracker.STOP_PATROL"

        const val ACTION_OPEN_APP =
            "com.pnp.geotracker.OPEN_APP"
    }

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

        handler.post(notificationChecker)

        Log.d(TAG, "Service created")
    }

    override fun onStartCommand(
        intent: Intent?,
        flags: Int,
        startId: Int
    ): Int {

        when (intent?.action) {

            ACTION_STOP_PATROL -> {
                patrolManager.stopPatrol()

                PatrolServiceModule.sendEvent("PATROL_STOPPED")

                handler.removeCallbacks(notificationChecker)

                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()

                return START_NOT_STICKY
            }

            ACTION_OPEN_APP -> {
                // Continue normal notification click handling.
            }
        }

        Log.d(TAG, "Service started")

        val dutyType =
            intent?.getStringExtra("dutyType") ?: ""

        val personnelId =
            intent?.getStringExtra("personnelId") ?: ""

        Log.d(TAG, "Duty Type: $dutyType")
        Log.d(TAG, "Personnel Id: $personnelId")

        val notification = createNotification()

        startForeground(
            NOTIFICATION_ID,
            notification
        )

        patrolManager.startPatrol(
            dutyType,
            personnelId
        )

        // Automatic Supabase synchronization has been removed.
        // GPS tracking and local patrol-location saving remain active.
        // Synchronization should run only when manually requested.

        return START_STICKY
    }

    override fun onDestroy() {
        handler.removeCallbacks(notificationChecker)

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