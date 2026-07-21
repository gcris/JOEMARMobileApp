package com.pnp.geotracker.model

data class PatrolLocation(
    val id: Long = 0,
    val personnelId: String,
    val dutyType: String,
    val latitude: Double,
    val longitude: Double,
    val accuracy: Float,
    val speed: Float,
    val networkSignal: Int,
    val altitude: Double,
    val bearing: Float,
    val timestamp: Long,
    val synced: Boolean = false
)