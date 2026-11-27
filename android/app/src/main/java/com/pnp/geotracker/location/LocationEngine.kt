
package com.pnp.geotracker.location

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.os.HandlerThread
import android.os.Looper
import android.os.SystemClock
import android.util.Log

import androidx.core.content.ContextCompat

import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority

import com.pnp.geotracker.model.PatrolLocation
import com.pnp.geotracker.repository.PatrolRepository
import com.pnp.geotracker.sync.SyncWorker
import com.pnp.geotracker.signal.SignalStrengthHelper

import kotlin.math.abs

class LocationEngine(
    context: Context,
    private val dutyType: String,
    private val personnelId: String
) {

    companion object {
        private const val TAG = "LocationEngine"

        private const val INITIAL_MAX_ACCURACY_METERS = 200f

        // GPS update configuration
        private const val GPS_INTERVAL_MS = 5_000L
        private const val GPS_MIN_INTERVAL_MS = 3_000L

        // Location validation
        private const val MAX_ACCURACY_METERS = 25f
        private const val HEARTBEAT_MAX_ACCURACY_METERS = 150f
        private const val MAX_LOCATION_AGE_MS = 20_000L
        private const val MAX_SPEED_METERS_PER_SECOND = 55f

        // Saving rules
        private const val MIN_SAVE_INTERVAL_MS = 5_000L
        private const val MIN_MOVEMENT_METERS = 8f
        private const val STATIONARY_INTERVAL_MS = 8 * 60 * 1_000L
        private const val HEARTBEAT_INTERVAL_MS = 3 * 60 * 1_000L

        // Movement detection
        private const val MOVEMENT_SPEED_THRESHOLD = 1.0f
        private const val STATIONARY_SPEED_THRESHOLD = 0.5f

        private const val DUTY_HIDDEN_INTEL = "Intel-Driven Operation"
        private const val DUTY_HIDDEN_LAWS = "Special Laws"

        private enum class TrackingMode {
            MOVING,
            STATIONARY,
            OFFICE_DUTY,
            HIDDEN_DUTY
        }
    }

    private val appContext: Context = context.applicationContext

    private val repository = PatrolRepository(appContext)

    private val fusedLocationClient =
        LocationServices.getFusedLocationProviderClient(appContext)

    @Volatile
    private var locationThread: HandlerThread? = null

    @Volatile
    private var isTracking = false

    @Volatile
    private var isStopping = false

    @Volatile
    private var trackingGeneration = 0

    private var trackingMode = TrackingMode.STATIONARY

    // Prevent processing the same GPS fix more than once.
    private var lastProcessedElapsedNanos = 0L

    // Last successfully saved location.
    private var lastSavedLocation: Location? = null
    private var lastSavedElapsedNanos = 0L

    // Last valid GPS location used for movement detection.
    private var previousLocation: Location? = null

    // Movement anchor used to avoid saving GPS jitter.
    private var movementAnchor: Location? = null

    // Last successful database timestamp.
    private var lastSavedTimestamp = 0L

    // Last heartbeat timestamp.
    private var lastHeartbeatElapsedNanos = 0L

    private val isHiddenDuty: Boolean
        get() = dutyType.equals(
            DUTY_HIDDEN_INTEL,
            ignoreCase = true
        ) || dutyType.equals(
            DUTY_HIDDEN_LAWS,
            ignoreCase = true
        )

    private val isOfficeDuty: Boolean
        get() = dutyType.equals(
            "Remain in Office",
            ignoreCase = true
        )

    private val locationRequest: LocationRequest =
        LocationRequest.Builder(
            Priority.PRIORITY_HIGH_ACCURACY,
            GPS_INTERVAL_MS
        )
            .setMinUpdateIntervalMillis(GPS_MIN_INTERVAL_MS)
            .setWaitForAccurateLocation(false)
            .build()

    
    private val locationCallback = object : LocationCallback() {

        override fun onLocationResult(result: LocationResult) {
            super.onLocationResult(result)

            if (!isTracking || isStopping) {
                Log.d(TAG, "GPS callback ignored: patrol is stopping or stopped")
                return
            }

            Log.i(
                TAG,
                "GPS CALLBACK: received ${result.locations.size} location(s)"
            )

            if (result.locations.isEmpty()) {
                Log.w(TAG, "GPS CALLBACK: No location received")
                return
            }

            for (location in result.locations) {
                val ageMs =
                    (SystemClock.elapsedRealtimeNanos() -
                        location.elapsedRealtimeNanos) / 1_000_000L

                Log.i(
                    TAG,
                    "GPS FIX: lat=${location.latitude}, " +
                        "lon=${location.longitude}, " +
                        "accuracy=${location.accuracy}m, " +
                        "age=${ageMs}ms, " +
                        "hasAccuracy=${location.hasAccuracy()}"
                )

                processLocation(location)
            }
        }

        override fun onLocationAvailability(
            availability: com.google.android.gms.location.LocationAvailability
        ) {
            super.onLocationAvailability(availability)

            Log.i(
                TAG,
                "GPS AVAILABLE: ${availability.isLocationAvailable}"
            )
        }
    }


    /**
     * Starts GPS tracking.
     */
    @SuppressLint("MissingPermission")
    @Synchronized
    fun startTracking() {

        if (isTracking || isStopping) {
            Log.d(TAG, "Cannot start: tracking already active or stopping")
            return
        }

        if (personnelId.isBlank()) {
            Log.e(TAG, "Cannot start tracking: personnel ID is empty")
            return
        }

        if (!hasLocationPermission()) {
            Log.e(TAG, "Location permission not granted")
            return
        }

        val generation = ++trackingGeneration

        try {
            locationThread = HandlerThread(
                "INPPO_PATROL_LOCATION_THREAD"
            ).apply {
                start()
            }

            val looper = locationThread?.looper
                ?: Looper.getMainLooper()

            // Mark tracking active before requesting updates.
            isTracking = true

            fusedLocationClient.requestLocationUpdates(
                locationRequest,
                locationCallback,
                looper
            ).addOnSuccessListener {

                if (
                    generation != trackingGeneration ||
                    !isTracking ||
                    isStopping
                ) {
                    Log.w(TAG, "GPS start completed after stop request")

                    fusedLocationClient.removeLocationUpdates(
                        locationCallback
                    )

                    return@addOnSuccessListener
                }

                Log.i(TAG, "GPS tracking started. Duty: $dutyType")

            }.addOnFailureListener { exception ->

                if (generation == trackingGeneration) {
                    isTracking = false
                }

                Log.e(TAG, "Failed to start GPS tracking", exception)

                stopLocationThread()
            }

        } catch (e: Exception) {
            isTracking = false
            Log.e(TAG, "Unable to initialize GPS tracking", e)
            stopLocationThread()
        }
    }

    /**
     * Stops GPS tracking and releases the background thread.
     */
    @Synchronized
    fun stopTracking(onComplete: (Boolean) -> Unit) {

        if (isStopping) {
            Log.w(TAG, "GPS shutdown is already in progress")
            onComplete(false)
            return
        }

        if (!isTracking && locationThread == null) {
            Log.d(TAG, "GPS tracking is already stopped")
            onComplete(true)
            return
        }

        // Immediately prevent additional GPS processing.
        isStopping = true
        isTracking = false

        Log.i(TAG, "STOP REQUESTED: removing GPS updates")

        try {
            fusedLocationClient
                .removeLocationUpdates(locationCallback)
                .addOnCompleteListener { task ->

                    Log.i(
                        TAG,
                        "GPS removal completed: success=${task.isSuccessful}"
                    )

                    stopLocationThread()

                    isStopping = false

                    onComplete(task.isSuccessful)
                }

        } catch (e: Exception) {

            Log.e(TAG, "GPS shutdown failed", e)

            stopLocationThread()
            isStopping = false

            onComplete(false)
        }
    }

    // Keep this overload if another part of your application
    // still calls stopTracking() without a callback.
    fun stopTracking() {
        stopTracking { success ->
            Log.d(TAG, "GPS shutdown result: $success")
        }
    }

    /**
     * Releases the GPS background thread.
     */
    private fun stopLocationThread() {
        try {
            locationThread?.quitSafely()
            locationThread?.join(1_000L)
        } catch (e: InterruptedException) {
            Thread.currentThread().interrupt()
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping location thread", e)
        } finally {
            locationThread = null
        }
    }

    /**
     * Checks location permissions.
     */
    private fun hasLocationPermission(): Boolean {

        val fineLocation =
            ContextCompat.checkSelfPermission(
                appContext,
                Manifest.permission.ACCESS_FINE_LOCATION
            ) == PackageManager.PERMISSION_GRANTED

        val coarseLocation =
            ContextCompat.checkSelfPermission(
                appContext,
                Manifest.permission.ACCESS_COARSE_LOCATION
            ) == PackageManager.PERMISSION_GRANTED

        return fineLocation || coarseLocation
    }

    /**
     * Main GPS processing pipeline.
     */
    @Synchronized
    private fun processLocation(location: Location) {

        if (!isTracking || isStopping) {
            Log.d(TAG, "Location ignored: patrol is no longer active")
            return
        }

        try {

            val nowElapsedNanos = SystemClock.elapsedRealtimeNanos()

            // -------------------------------------------------
            // 1. Reject duplicate or out-of-order GPS fixes.
            // -------------------------------------------------

            if (
                location.elapsedRealtimeNanos <=
                lastProcessedElapsedNanos
            ) {
                Log.d(TAG, "Duplicate or out-of-order GPS fix ignored")
                return
            }

            lastProcessedElapsedNanos =
                location.elapsedRealtimeNanos

            // -------------------------------------------------
            // 2. Reject invalid coordinates.
            // -------------------------------------------------

            if (
                !location.latitude.isFinite() ||
                !location.longitude.isFinite() ||
                location.latitude !in -90.0..90.0 ||
                location.longitude !in -180.0..180.0
            ) {
                Log.w(TAG, "Invalid GPS coordinates")
                return
            }

            // -------------------------------------------------
            // 3. Reject mock GPS locations.
            // -------------------------------------------------

            if (location.isFromMockProvider) {
                Log.w(TAG, "Mock GPS location ignored")
                return
            }

            // -------------------------------------------------
            // 4. Reject stale GPS locations.
            // -------------------------------------------------

            val locationAgeMs =
                (nowElapsedNanos - location.elapsedRealtimeNanos) /
                    1_000_000L

            if (
                locationAgeMs < 0 ||
                locationAgeMs > MAX_LOCATION_AGE_MS
            ) {
                Log.d(
                    TAG,
                    "Stale GPS location ignored: ${locationAgeMs}ms"
                )
                return
            }
            
            // -------------------------------------------------
            // 5. Validate GPS accuracy.
            // -------------------------------------------------
            val isFirstLocation = lastSavedElapsedNanos == 0L

            val isHeartbeatDue =
                isFirstLocation ||
                    (nowElapsedNanos - lastSavedElapsedNanos) / 1_000_000L >=
                    HEARTBEAT_INTERVAL_MS

            val maxAllowedAccuracy = when {
                isFirstLocation -> INITIAL_MAX_ACCURACY_METERS
                isHeartbeatDue -> HEARTBEAT_MAX_ACCURACY_METERS
                else -> MAX_ACCURACY_METERS
            }

            Log.i(
                TAG,
                "SAVE CHECK: first=$isFirstLocation, " +
                    "accuracy=${location.accuracy}m, " +
                    "allowed=$maxAllowedAccuracy m"
            )

            if (
                !location.hasAccuracy() ||
                location.accuracy > maxAllowedAccuracy
            ) {
                Log.w(
                    TAG,
                    "LOCATION REJECTED: accuracy ${location.accuracy}m"
                )
                return
            }


            // -------------------------------------------------
            // 6. Detect impossible GPS jumps.
            // -------------------------------------------------

            val previous = previousLocation

            if (previous != null) {

                val elapsedSeconds =
                    (
                        location.elapsedRealtimeNanos -
                        previous.elapsedRealtimeNanos
                    ) / 1_000_000_000f

                if (elapsedSeconds > 0f) {

                    val distance =
                        previous.distanceTo(location)

                    val calculatedSpeed =
                        distance / elapsedSeconds

                    if (
                        calculatedSpeed >
                        MAX_SPEED_METERS_PER_SECOND
                    ) {
                        Log.w(
                            TAG,
                            "GPS jump rejected: ${calculatedSpeed}m/s"
                        )
                        return
                    }
                }
            }

            // -------------------------------------------------
            // 7. Update movement detection.
            // -------------------------------------------------

            updateTrackingMode(location)

            previousLocation = Location(location)

            // -------------------------------------------------
            // 8. Apply duty-specific coordinate handling.
            // -------------------------------------------------

            val latitude: Double
            val longitude: Double

            if (isHiddenDuty) {

                // Save the record, but do not expose actual GPS.
                latitude = 0.0
                longitude = 0.0

                trackingMode = TrackingMode.HIDDEN_DUTY

            } else {

                latitude = location.latitude
                longitude = location.longitude
            }

            // -------------------------------------------------
            // 9. Determine whether the location should be saved.
            // -------------------------------------------------

            if (!shouldSaveLocation(location)) {
                return
            }

            // -------------------------------------------------
            // 10. Construct patrol record.
            // -------------------------------------------------

            val patrolLocation = PatrolLocation(
                personnelId = personnelId,
                dutyType = dutyType,
                latitude = latitude,
                longitude = longitude,
                accuracy = if (trackingMode == TrackingMode.HIDDEN_DUTY) 0f else location.accuracy,
                speed = if (trackingMode == TrackingMode.HIDDEN_DUTY) 0f else location.speed,
                networkSignal = SignalStrengthHelper.getSignalLevel(appContext),
                altitude = if (trackingMode == TrackingMode.HIDDEN_DUTY) 0.0 else location.altitude,
                bearing = if (trackingMode == TrackingMode.HIDDEN_DUTY) 0f else location.bearing,
                timestamp = System.currentTimeMillis(),
                synced = false
            )

            // -------------------------------------------------
            // 11. Save locally before attempting synchronization.
            // -------------------------------------------------

            Log.i(TAG, "ATTEMPTING SQLITE INSERT: personnelId=$personnelId")

            val id = repository.saveLocation(patrolLocation)

            Log.i(TAG, "SQLITE INSERT RESULT: id=$id")

            if (id <= 0L) {
                Log.e(TAG, "SQLite insert failed")
                return
            }

            // -------------------------------------------------
            // 12. Update state only after successful insertion.
            // -------------------------------------------------

            lastSavedLocation = Location(location)

            lastSavedElapsedNanos =
                location.elapsedRealtimeNanos

            lastSavedTimestamp =
                patrolLocation.timestamp

            lastHeartbeatElapsedNanos =
                location.elapsedRealtimeNanos

            movementAnchor = Location(location)

            Log.d(
                TAG,
                "Patrol location saved locally. Record ID: $id"
            )

            // -------------------------------------------------
            // 13. Schedule background synchronization.
            // -------------------------------------------------

            try {
                SyncWorker.enqueue(appContext)

                Log.d(
                    TAG,
                    "Background synchronization scheduled"
                )

            } catch (e: Exception) {
                // The local record remains safe.
                // A later sync request can upload it.
                Log.e(
                    TAG,
                    "Unable to schedule synchronization",
                    e
                )
            }

        } catch (e: Exception) {
            Log.e(TAG, "Error processing GPS location", e)
        }
    }

    /**
     * Determines whether the officer is moving or stationary.
     */
    private fun updateTrackingMode(location: Location) {

        if (isHiddenDuty) {
            trackingMode = TrackingMode.HIDDEN_DUTY
            return
        }

        if (isOfficeDuty) {
            trackingMode = TrackingMode.OFFICE_DUTY
            return
        }

        val speed = getSpeed(location)

        trackingMode = when {
            speed >= MOVEMENT_SPEED_THRESHOLD ->
                TrackingMode.MOVING

            speed <= STATIONARY_SPEED_THRESHOLD ->
                TrackingMode.STATIONARY

            else ->
                trackingMode
        }
    }

    /**
     * Determines whether the current GPS fix should be saved.
     *
     * Moving:
     * - Minimum 5 seconds between records.
     * - Minimum 8 meters of actual displacement.
     *
     * Stationary:
     * - Saves a heartbeat every 8 minutes.
     *
     * Office duty:
     * - Saves a heartbeat every 8 minutes.
     *
     * Hidden duty:
     * - Saves a heartbeat every 8 minutes, with coordinates 0,0.
     */
    private fun shouldSaveLocation(location: Location): Boolean {

        val nowElapsedNanos =
            location.elapsedRealtimeNanos

        val elapsedSinceLastSave =
            if (lastSavedElapsedNanos == 0L) {
                Long.MAX_VALUE
            } else {
                (
                    nowElapsedNanos -
                    lastSavedElapsedNanos
                ) / 1_000_000L
            }

        // Always allow the first valid location.
        if (lastSavedElapsedNanos == 0L) {
            return true
        }

        // Moving mode: apply time and distance filters.
        if (trackingMode == TrackingMode.MOVING) {

            if (elapsedSinceLastSave < MIN_SAVE_INTERVAL_MS) {
                return false
            }

            val anchor = movementAnchor ?: lastSavedLocation

            if (anchor == null) {
                return true
            }

            val distance =
                anchor.distanceTo(location)

            if (distance < MIN_MOVEMENT_METERS) {
                return false
            }

            return true
        }

        // Stationary, office, and hidden duty:
        // save periodic heartbeat records.
        val heartbeatInterval =
            when (trackingMode) {
                TrackingMode.STATIONARY ->
                    STATIONARY_INTERVAL_MS

                TrackingMode.OFFICE_DUTY ->
                    STATIONARY_INTERVAL_MS

                TrackingMode.HIDDEN_DUTY ->
                    STATIONARY_INTERVAL_MS

                TrackingMode.MOVING ->
                    MIN_SAVE_INTERVAL_MS
            }

        return elapsedSinceLastSave >= heartbeatInterval
    }

    /**
     * Returns GPS speed in meters per second.
     */
    private fun getSpeed(location: Location): Float {

        return if (location.hasSpeed()) {
            location.speed.coerceAtLeast(0f)
        } else {
            0f
        }
    }
}
