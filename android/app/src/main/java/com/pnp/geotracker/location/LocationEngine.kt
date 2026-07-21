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

            locationResult.lastLocation?.let { location ->
                // Ignore inaccurate GPS
                if (location.accuracy > 30f) return@let

                val distance = lastSavedLocation?.distanceTo(location) ?: Float.MAX_VALUE
                val elapsed = System.currentTimeMillis() - lastSavedTime

                // Minimum speed = 3.6 km/h
                val moving = location.speed >= 1.0f

                val shouldSave =
                    elapsed >= 5000 &&
                    distance >= 5f &&
                    moving

                if (shouldSave) {
                    val signal = SignalStrengthHelper.getSignal(context);

                    val patrolLocation = PatrolLocation(
                        latitude = location.latitude,
                        longitude = location.longitude,
                        dutyType = dutyType,
                        personnelId = personnelId,
                        accuracy = location.accuracy,
                        speed = location.speed,
                        networkSignal = signal?.level ?: 0,
                        altitude = location.altitude,
                        bearing = location.bearing,
                        timestamp = location.time
                    )
                    
                    var id = repository.saveLocation(patrolLocation);

                    Log.d(TAG, "Total records = ${repository.getLocationCount()}")

                    Log.d(
                        TAG,
                        "Saved location #$id (${location.latitude}, ${location.longitude})"
                    )
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