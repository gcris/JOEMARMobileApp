package com.pnp.geotracker

import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class PNPFirebaseMessagingService : FirebaseMessagingService() {

    override fun onMessageReceived(message: RemoteMessage) {

        val data = message.data

         SOSNotificationHelper.showSOS(
            this,
            data["title"] ?: "DISTRESS SIGNAL",
            data["body"] ?: "",
            data["senderName"] ?: "",
            data["phone_number"] ?: "",
            data["latitude"]?.toDouble() ?: 0.0,
            data["longitude"]?.toDouble() ?: 0.0
        )
    }

    override fun onNewToken(token: String) {
        super.onNewToken(token)

        println("FCM TOKEN = $token")

        // TODO:
        // upload to Supabase
    }
}