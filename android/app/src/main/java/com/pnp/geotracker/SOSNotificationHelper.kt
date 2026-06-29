package com.pnp.geotracker

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat

object SOSNotificationHelper {

    private const val CHANNEL_ID = "emergency-alerts-v4"

    fun showSOS(
        context: Context,
        title: String,
        body: String,
        senderName: String,
        phoneNumber: String,
        latitude: Double,
        longitude: Double
    ) {

        val manager =
            context.getSystemService(Context.NOTIFICATION_SERVICE)
                    as NotificationManager

        // Create channel (Android 8+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {

            val soundUri = Uri.parse(
                "android.resource://${context.packageName}/raw/sos_alert"
            )

            val attributes = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build()

            val channel = NotificationChannel(
                CHANNEL_ID,
                "Emergency Alerts",
                NotificationManager.IMPORTANCE_HIGH
            )

            channel.description = "Emergency SOS Alerts"
            channel.enableLights(true)
            channel.enableVibration(true)

            channel.vibrationPattern = longArrayOf(
                0,
                600,
                300,
                600,
                300,
                600
            )

            channel.setSound(soundUri, attributes)

            manager.createNotificationChannel(channel)
        }

        val intent = Intent(context, SOSActivity::class.java).apply {
            putExtra("senderName", senderName)
            putExtra("phoneNumber", phoneNumber)
            putExtra("latitude", latitude)
            putExtra("longitude", longitude)
        }

        val pendingIntent = PendingIntent.getActivity(
            context,
            100,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification =
            NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(title)
                .setContentText(body)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .setAutoCancel(false)
                .setOngoing(true)
                .setFullScreenIntent(pendingIntent, true)
                .build()

        manager.notify(9999, notification)
    }
}