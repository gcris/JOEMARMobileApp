    package com.pnp.geotracker.patrol

    import android.content.Context
    import android.util.Log
    import com.pnp.geotracker.location.LocationEngine

    class PatrolManager(
        private val context: Context
    ) {

        companion object {

            private const val TAG = "PatrolManager"

            private var running = false

            private var dutyType = ""

            private var personnelId = ""

            private var startedAt: Long = 0

            fun isRunning(): Boolean = running

            fun getDutyType(): String = dutyType

            fun getPersonnelId(): String = personnelId

            fun getStartedAt(): Long = startedAt
        }

        private var locationEngine: LocationEngine? = null

        fun startPatrol(
            dutyType: String,
            personnelId: String
        ) {

            if (locationEngine != null) {
                Log.d(TAG, "Patrol already running with an active LocationEngine")
                return
            }

            Log.d(TAG, "Starting Patrol")

            Companion.running = true
            Companion.dutyType = dutyType
            Companion.personnelId = personnelId
            Companion.startedAt = System.currentTimeMillis()

            locationEngine = LocationEngine(
                context,
                dutyType,
                personnelId
            )

            locationEngine?.startTracking()
        }

        fun stopPatrol() {

            Log.d(TAG, "Stopping Patrol")

            locationEngine?.stopTracking()

            locationEngine = null

            Companion.running = false
            // Keep the last-used duty type so getDutyType() remains accurate after patrol stops.
            Companion.personnelId = ""
            Companion.startedAt = 0
        }
    }