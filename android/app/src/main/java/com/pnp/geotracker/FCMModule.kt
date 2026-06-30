package com.pnp.geotracker

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.google.firebase.messaging.FirebaseMessaging

class FCMModule(
    reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "FCMModule"
    }

    @ReactMethod
    fun getToken(promise: Promise) {

        FirebaseMessaging.getInstance().token
            .addOnCompleteListener { task ->

                if (!task.isSuccessful) {
                    promise.reject(
                        "FCM_ERROR",
                        task.exception?.message ?: "Unable to obtain FCM token"
                    )
                    return@addOnCompleteListener
                }

                val token = task.result

                if (token.isNullOrEmpty()) {
                    promise.reject(
                        "FCM_ERROR",
                        "FCM token is null."
                    )
                } else {
                    promise.resolve(token)
                }
            }
    }

    @ReactMethod
    fun deleteToken(promise: Promise) {

        FirebaseMessaging.getInstance()
            .deleteToken()
            .addOnCompleteListener { task ->

                if (task.isSuccessful) {
                    promise.resolve(true)
                } else {
                    promise.reject(
                        "FCM_ERROR",
                        task.exception?.message
                    )
                }
            }
    }
}