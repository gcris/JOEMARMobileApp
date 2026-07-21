package com.pnp.geotracker

import android.content.Intent
import android.os.Build

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.pnp.geotracker.repository.PatrolRepository
import com.pnp.geotracker.sync.SyncManager
import com.pnp.geotracker.patrol.PatrolManager
import com.facebook.react.bridge.Arguments
import com.facebook.react.modules.core.DeviceEventManagerModule

class PatrolServiceModule(
    reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {
    private val repository by lazy {
        PatrolRepository(reactApplicationContext)
    }

    private val patrolManager by lazy {
        PatrolManager(reactApplicationContext)
    }

    private val syncManager by lazy {
        SyncManager(reactApplicationContext)
    }

    companion object {
        lateinit var reactContext: ReactApplicationContext

        fun sendEvent(
            event: String
        ) {

            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(event, null)
        }
    }

    init {
        Companion.reactContext = reactContext
    }

    override fun getName(): String {
        return "PatrolService"
    }

    @ReactMethod
    fun addListener(eventName: String) {
        // Required for NativeEventEmitter
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        // Required for NativeEventEmitter
    }

    @ReactMethod
    fun startPatrol(
        dutyType: String,
        personnelId: String,
        promise: Promise
    ) {

        try {

            if (PatrolManager.isRunning()) {
                promise.resolve(true)
                return
            }

            val intent = Intent(
                reactApplicationContext,
                PatrolForegroundService::class.java
            )

            intent.putExtra("dutyType", dutyType)
            intent.putExtra("personnelId", personnelId)

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                reactApplicationContext.startForegroundService(intent)
            } else {
                reactApplicationContext.startService(intent)
            }

            promise.resolve(true)

        } catch (e: Exception) {

            promise.reject(
                "START_ERROR",
                e
            )
        }
    }

    @ReactMethod
    fun stopService(promise: Promise) {

        try {

            val intent = Intent(
                reactApplicationContext,
                PatrolForegroundService::class.java
            )

            reactApplicationContext.stopService(intent)

            promise.resolve(true)

        } catch (e: Exception) {
            promise.reject("STOP_ERROR", e)
        }
    }

    @ReactMethod
    fun getTotalLocationCount(
        promise: Promise
    ) {

        try {

            promise.resolve(
                repository.getTotalLocationCount()
            )

        } catch (e: Exception) {

            promise.reject(
                "TOTAL_COUNT_ERROR",
                e
            )
        }
    }

    @ReactMethod
    fun uploadUnsyncedLogs(promise: Promise) {

        try {
            val uploaded = syncManager.sync()

            promise.resolve(uploaded)
        } catch (e: Exception) {

            promise.reject(
                "SYNC_ERROR",
                e
            )
        }
    }

    @ReactMethod
    fun getPatrolStatus(promise: Promise) {

        try {

            val map = Arguments.createMap()

            val total =
                repository.getTotalLocationCount()

            val pending =
                repository.getUnsyncedLocationCount()

            map.putBoolean(
                "running",
                PatrolManager.isRunning()
            )

            map.putString(
                "dutyType",
                PatrolManager.getDutyType()
            )

            map.putString(
                "personnelId",
                PatrolManager.getPersonnelId()
            )

            map.putInt(
                "totalLocations",
                total
            )

            map.putInt(
                "unsyncedLocations",
                pending
            )

            var synced = total.toInt() - pending.toInt()

            map.putInt(
                "syncedLocations",
                synced
            )

            map.putDouble(
                "startedAt",
                PatrolManager.getStartedAt().toDouble()
            )

            promise.resolve(map)

        } catch (e: Exception) {

            promise.reject(
                "STATUS_ERROR",
                e
            )
        }
    }

    @ReactMethod
    fun getUnsyncedLocationCount(
        promise: Promise
    ) {

        try {

            promise.resolve(
                repository.getUnsyncedLocationCount()
            )

        } catch (e: Exception) {

            promise.reject(
                "UNSYNCED_COUNT_ERROR",
                e
            )
        }
    }
}