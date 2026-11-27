
package com.pnp.geotracker.patrol

import android.content.Context
import android.util.Log
import com.pnp.geotracker.location.LocationEngine

class PatrolManager(
    private val context: Context
) {

    companion object {

        private const val TAG = "PatrolManager"

        @Volatile
        private var running = false

        @Volatile
        private var dutyType = ""

        @Volatile
        private var personnelId = ""

        @Volatile
        private var startedAt: Long = 0

        fun isRunning(): Boolean = running

        fun getDutyType(): String = dutyType

        fun getPersonnelId(): String = personnelId

        fun getStartedAt(): Long = startedAt
    }

    private var locationEngine: LocationEngine? = null
    private var stopping = false

    private val pendingStopCallbacks =
        mutableListOf<(Boolean) -> Unit>()

    @Synchronized
    fun startPatrol(
        dutyType: String,
        personnelId: String
    ) {

        if (locationEngine != null || stopping) {
            Log.d(TAG, "Patrol already active or stopping")
            return
        }

        Log.d(TAG, "Starting Patrol")

        Companion.dutyType = dutyType
        Companion.personnelId = personnelId
        Companion.startedAt = System.currentTimeMillis()

        locationEngine = LocationEngine(
            context,
            dutyType,
            personnelId
        )

        Companion.running = true

        locationEngine?.startTracking()
    }

    fun stopPatrol(
        onComplete: (Boolean) -> Unit = {}
    ) {

        val engine: LocationEngine

        synchronized(this) {

            if (stopping) {
                Log.d(TAG, "Patrol shutdown already in progress")
                pendingStopCallbacks.add(onComplete)
                return
            }

            val currentEngine = locationEngine

            if (currentEngine == null) {

                Companion.running = false
                Companion.personnelId = ""
                Companion.startedAt = 0

                onComplete(true)
                return
            }

            stopping = true
            pendingStopCallbacks.add(onComplete)

            engine = currentEngine

            Log.i(TAG, "Stopping patrol and waiting for GPS shutdown")
        }

        engine.stopTracking { success ->

            val callbacks: List<(Boolean) -> Unit>

            synchronized(this) {

                locationEngine = null

                Companion.running = false
                Companion.personnelId = ""
                Companion.startedAt = 0

                stopping = false

                callbacks = pendingStopCallbacks.toList()
                pendingStopCallbacks.clear()
            }

            Log.i(
                TAG,
                "Patrol shutdown completed. GPS removal successful=$success"
            )

            callbacks.forEach { callback ->
                try {
                    callback(success)
                } catch (e: Exception) {
                    Log.e(TAG, "Stop callback failed", e)
                }
            }
        }
    }
}
