package com.pnp.geotracker.repository

import android.content.Context
import com.pnp.geotracker.database.PatrolDatabase
import com.pnp.geotracker.model.PatrolLocation

class PatrolRepository(context: Context) {

    private val database = PatrolDatabase(context.applicationContext)

    fun saveLocation(location: PatrolLocation): Long {
        return database.insertLocation(location)
    }

    fun getLocationCount(): Int {
        return database.getLocationCount()
    }

    fun getUnsyncedLocations(
        limit: Int = 100
    ): List<PatrolLocation> {
        return database.getUnsyncedLocations(limit)
    }

    fun markAsSynced(ids: List<Long>) {
        database.markAsSynced(ids)
    }

    fun getTotalLocationCount(): Int {
        return database.getTotalLocationCount()
    }

    fun getUnsyncedLocationCount(): Int {
        return database.getUnsyncedLocationCount()
    }
}