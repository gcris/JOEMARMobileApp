package com.pnp.geotracker.model

data class SupabaseLocation(
    val personnel_id: String,
    val duty_type: String,
    val latitude: Double,
    val longitude: Double,
    val accuracy: Float,
    val speed: Float,
    val network_signal: Int,
    val captured_at: Long

)