package com.pnp.geotracker

import android.content.Intent
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class PNPFirebaseMessagingService : FirebaseMessagingService() {

    override fun onMessageReceived(message: RemoteMessage) {
        
        android.util.Log.e("PNP_FCM", "MESSAGE RECEIVED")

        android.util.Log.e(
            "PNP_FCM",
            message.data.toString()
        )

        val data = message.data

        if (data["type"] != "sos-incoming-alert") {
            return
        }

         SOSNotificationHelper.showSOS(
            this,
            data["title"] ?: "DISTRESS SIGNAL",
            (data["body"] ?: "") + " Tap to view details.",
            data["senderName"] ?: "",
            data["phone_number"] ?: "",
            data["latitude"]?.toDouble() ?: 0.0,
            data["longitude"]?.toDouble() ?: 0.0
        )

        val intent = Intent(this, SOSActivity::class.java).apply {

        flags =
            Intent.FLAG_ACTIVITY_NEW_TASK or
            Intent.FLAG_ACTIVITY_CLEAR_TOP

            putExtra("title", data["title"])
            putExtra("body", data["body"])
            putExtra("senderName", data["senderName"])
            putExtra("phone_number", data["phone_number"])
            putExtra("latitude", data["latitude"]?.toDouble() ?: 0.0)
            putExtra("longitude", data["longitude"]?.toDouble() ?: 0.0)
        }

        startActivity(intent)   
    }

    override fun onNewToken(token: String) {
        super.onNewToken(token)

        println("FCM TOKEN = $token")

        // TODO:
        // upload to Supabase
    }
}