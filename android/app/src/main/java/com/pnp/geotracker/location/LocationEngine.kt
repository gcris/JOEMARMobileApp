package com.pnp.geotracker.location

import android.annotation.SuppressLint
import android.content.Context
import android.location.Location
import android.os.Looper
import android.util.Log

import com.google.android.gms.location.*
import com.pnp.geotracker.repository.PatrolRepository
import com.pnp.geotracker.model.PatrolLocation
import com.pnp.geotracker.signal.SignalStrengthHelper

class LocationEngine(
    context: Context,
    private val dutyType: String,
    private val personnelId: String
) {

    private val repository = PatrolRepository(context)
    private var lastSavedLocation: Location? = null
    private var lastSavedTime = 0L

    companion object {
        private const val TAG = "LocationEngine"
    }

    private val fusedLocationClient =
        LocationServices.getFusedLocationProviderClient(context)

    private val locationRequest =
        LocationRequest.Builder(
            Priority.PRIORITY_HIGH_ACCURACY,
            5000L
        )
            .setMinUpdateIntervalMillis(5000L)
            .setWaitForAccurateLocation(true)
            .build()

    
    private val locationCallback = object : LocationCallback() {
        override fun onLocationResult(locationResult: LocationResult) {
            super.onLocationResult(locationResult)

            // Process all delivered locations in chronological order.
            // Using only lastLocation can discard intermediate route points.
            locationResult.locations
                .sortedBy { it.time }
                .forEach { location ->
                    // 1. Reject invalid or inaccurate GPS fixes.
                    if (
                        !location.latitude.isFinite() ||
                        !location.longitude.isFinite() ||
                        location.latitude !in -90.0..90.0 ||
                        location.longitude !in -180.0..180.0 ||
                        location.latitude == 0.0 ||
                        location.longitude == 0.0 ||
                        !location.accuracy.isFinite() ||
                        location.accuracy > 30f
                    ) {
                        Log.d(
                            TAG,
                            "GPS fix rejected: accuracy=${location.accuracy}m"
                        )
                        return@forEach
                    }

                    val locationTime = location.time

                    // Ignore old or duplicate timestamps.
                    if (
                        locationTime <= 0L ||
                        locationTime <= lastSavedTime
                    ) {
                        return@forEach
                    }

                    val elapsed = if (lastSavedTime > 0L) {
                        locationTime - lastSavedTime
                    } else {
                        Long.MAX_VALUE
                    }

                    val previousLocation = lastSavedLocation

                    val distance = previousLocation
                        ?.distanceTo(location)
                        ?: Float.MAX_VALUE

                    // Use both speed and displacement as movement clues.
                    val moving =
                        location.hasSpeed() && location.speed >= 1.0f ||
                        distance >= 5f

                    val saveInterval = if (moving) {
                        5_000L
                    } else {
                        9 * 60_000L
                    }

                    val shouldSave = when {
                        // Always save the first valid fix.
                        previousLocation == null || lastSavedTime <= 0L -> true

                        // When moving, require elapsed time and displacement.
                        moving -> elapsed >= 5_000L && distance >= 5f

                        // When stationary, periodically save a heartbeat.
                        else -> elapsed >= saveInterval
                    }

                    if (!shouldSave) {
                        return@forEach
                    }

                    try {
                        val signal =
                            SignalStrengthHelper.getSignal(context)

                        val patrolLocation = PatrolLocation(
                            latitude = location.latitude,
                            longitude = location.longitude,
                            dutyType = dutyType,
                            personnelId = personnelId,
                            accuracy = location.accuracy,
                            speed = if (location.hasSpeed()) {
                                location.speed
                            } else {
                                0f
                            },
                            networkSignal = signal?.level ?: 0,
                            altitude = location.altitude,
                            bearing = if (location.hasBearing()) {
                                location.bearing
                            } else {
                                0f
                            },
                            timestamp = location.time
                        )

                        // Assumes saveLocation returns after local persistence.
                        val id = repository.saveLocation(patrolLocation)

                        // Update only after saveLocation completes successfully.
                        lastSavedLocation = location
                        lastSavedTime = locationTime

                        Log.d(
                            TAG,
                            "Saved location #$id | " +
                                "moving=$moving | " +
                                "speed=${location.speed} m/s | " +
                                "accuracy=${location.accuracy}m | " +
                                "distance=${distance}m | " +
                                "elapsed=${elapsed / 1000}s"
                        )

                    } catch (e: Exception) {
                        Log.e(TAG, "Failed to save patrol location", e)
                    }
                }
        }
    }

    @SuppressLint("MissingPermission")
    fun startTracking() {

        Log.d(TAG, "Starting GPS tracking...")

        fusedLocationClient.requestLocationUpdates(
            locationRequest,
            locationCallback,
            Looper.getMainLooper()
        )
    }

    fun stopTracking() {

        Log.d(TAG, "Stopping GPS tracking...")

        fusedLocationClient.removeLocationUpdates(locationCallback)
    }
}