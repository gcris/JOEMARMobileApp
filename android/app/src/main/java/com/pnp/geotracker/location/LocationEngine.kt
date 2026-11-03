package com.pnp.geotracker.location

import android.annotation.SuppressLint
import android.content.Context
import android.location.Location
import android.os.Build
import android.os.HandlerThread
import android.os.SystemClock
import android.util.Log
import com.google.android.gms.location.*
import com.pnp.geotracker.model.PatrolLocation
import com.pnp.geotracker.repository.PatrolRepository
import com.pnp.geotracker.signal.SignalStrengthHelper

class LocationEngine(
        private val context: Context,
        private val dutyType: String,
        private val personnelId: String
) {

    private val repository = PatrolRepository(context)

    // State is only touched from the single background looper thread,
    // so no locking is needed.
    private var lastSavedLocation: Location? = null
    private var lastSavedElapsedNanos = 0L

    private var handlerThread: HandlerThread? = null

    companion object {
        private const val TAG = "LocationEngine"

        // Accuracy gates
        private const val MAX_ACCURACY_M = 25f // normal fixes
        private const val HEARTBEAT_MAX_ACCURACY_M = 150f // only when a heartbeat is overdue

        // Freshness: reject cached / delayed fixes
        private const val MAX_FIX_AGE_MS = 20_000L

        // Saving rules
        private const val MOVING_SAVE_INTERVAL_MS = 5_000L
        private const val MIN_MOVE_M = 8f
        private const val HEARTBEAT_MS = 3 * 60_000L // well under the 10 min session gap

        // Jump filter: reject teleports between close-in-time fixes
        private const val MAX_PLAUSIBLE_SPEED_MPS = 55f // ~200 km/h
        private const val JUMP_CHECK_WINDOW_MS = 60_000L
    }

    private val fusedLocationClient = LocationServices.getFusedLocationProviderClient(context)

    private val locationRequest =
            LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 5_000L)
                    .setMinUpdateIntervalMillis(2_000L)
                    .setMinUpdateDistanceMeters(0f) // never suppress heartbeat callbacks
                    .setGranularity(Granularity.GRANULARITY_FINE)
                    // We filter accuracy ourselves, so don't let the system hold fixes back.
                    .setWaitForAccurateLocation(false)
                    .build()

    private val locationCallback =
            object : LocationCallback() {
                override fun onLocationResult(locationResult: LocationResult) {
                    locationResult.locations.sortedBy { it.elapsedRealtimeNanos }.forEach {
                        handleLocation(it)
                    }
                }
            }

    private fun handleLocation(location: Location) {
        // 1. Basic validity
        if (!location.latitude.isFinite() ||
                        !location.longitude.isFinite() ||
                        location.latitude !in -90.0..90.0 ||
                        location.longitude !in -180.0..180.0 ||
                        (location.latitude == 0.0 && location.longitude == 0.0) ||
                        !location.hasAccuracy() ||
                        !location.accuracy.isFinite()
        ) {
            Log.d(TAG, "Rejected: invalid fix")
            return
        }

        // 2. Reject mock locations
        val isMock =
                if (Build.VERSION.SDK_INT >= 31) {
                    location.isMock
                } else {
                    @Suppress("DEPRECATION") location.isFromMockProvider
                }
        if (isMock) {
            Log.w(TAG, "Rejected: mock location")
            return
        }

        // 3. Reject stale / cached fixes (monotonic clock, immune to clock changes)
        val nowNanos = SystemClock.elapsedRealtimeNanos()
        val ageMs = (nowNanos - location.elapsedRealtimeNanos) / 1_000_000L
        if (ageMs > MAX_FIX_AGE_MS) {
            Log.d(TAG, "Rejected: stale fix (${ageMs / 1000}s old)")
            return
        }

        // 4. Duplicate / out-of-order check on the monotonic clock
        if (lastSavedElapsedNanos > 0L && location.elapsedRealtimeNanos <= lastSavedElapsedNanos) {
            return
        }

        val previous = lastSavedLocation
        val elapsedMs =
                if (previous != null && lastSavedElapsedNanos > 0L) {
                    (location.elapsedRealtimeNanos - lastSavedElapsedNanos) / 1_000_000L
                } else {
                    Long.MAX_VALUE
                }

        // 5. Accuracy gate. A poor fix is allowed only to keep the heartbeat alive,
        //    so an officer inside a building doesn't look offline or split the session.
        val heartbeatOverdue = previous != null && elapsedMs >= HEARTBEAT_MS
        val accuracyLimit = if (heartbeatOverdue) HEARTBEAT_MAX_ACCURACY_M else MAX_ACCURACY_M
        if (location.accuracy > accuracyLimit) {
            Log.d(TAG, "Rejected: accuracy=${location.accuracy}m > ${accuracyLimit}m")
            return
        }
        val goodFix = location.accuracy <= MAX_ACCURACY_M

        // 6. Teleport filter (only meaningful for good fixes close in time)
        val distance = previous?.distanceTo(location) ?: Float.MAX_VALUE
        if (goodFix && previous != null && elapsedMs in 1 until JUMP_CHECK_WINDOW_MS) {
            val impliedSpeed = distance / (elapsedMs / 1000f)
            if (impliedSpeed > MAX_PLAUSIBLE_SPEED_MPS) {
                Log.w(TAG, "Rejected: jump of ${distance}m in ${elapsedMs / 1000}s")
                return
            }
        }

        // 7. Movement must exceed GPS noise, not just a fixed 5 m
        val moveThreshold = maxOf(MIN_MOVE_M, location.accuracy)
        val moving = previous != null && distance >= moveThreshold

        val shouldSave =
                previous == null ||
                        (moving && elapsedMs >= MOVING_SAVE_INTERVAL_MS) ||
                        heartbeatOverdue

        if (!shouldSave) return

        // 8. Save. A signal failure must never cost us the GPS point.
        val signalLevel =
                runCatching { SignalStrengthHelper.getSignal(context)?.level }.getOrNull() ?: 0

        try {
            val patrolLocation =
                    PatrolLocation(
                            latitude = location.latitude,
                            longitude = location.longitude,
                            dutyType = dutyType,
                            personnelId = personnelId,
                            accuracy = location.accuracy, // server can treat > 25 m as low-accuracy
                            // heartbeat
                            speed = if (location.hasSpeed()) location.speed else 0f,
                            networkSignal = signalLevel,
                            altitude = location.altitude,
                            bearing = if (location.hasBearing()) location.bearing else 0f,
                            timestamp =
                                    if (location.time > 0L) location.time
                                    else System.currentTimeMillis()
                    )

            val id = repository.saveLocation(patrolLocation)

            lastSavedLocation = location
            lastSavedElapsedNanos = location.elapsedRealtimeNanos

            Log.d(
                    TAG,
                    "Saved #$id | moving=$moving | accuracy=${location.accuracy}m | " +
                            "distance=${if (previous == null) "n/a" else "${distance}m"} | " +
                            "elapsed=${if (previous == null) "n/a" else "${elapsedMs / 1000}s"}"
            )
        } catch (e: Exception) {
            Log.e(TAG, "Failed to save patrol location", e)
        }
    }

    @SuppressLint("MissingPermission")
    @Synchronized
    fun startTracking() {
        if (handlerThread != null) return // already running

        Log.d(TAG, "Starting GPS tracking...")

        // New patrol: don't compare against a point from a previous run.
        lastSavedLocation = null
        lastSavedElapsedNanos = 0L

        // Callbacks (and the blocking save) run off the main thread.
        val thread = HandlerThread("LocationEngine").also { it.start() }
        handlerThread = thread

        fusedLocationClient.requestLocationUpdates(locationRequest, locationCallback, thread.looper)
    }

    @Synchronized
    fun stopTracking() {
        Log.d(TAG, "Stopping GPS tracking...")

        fusedLocationClient.removeLocationUpdates(locationCallback)
        handlerThread?.quitSafely()
        handlerThread = null
    }
}
