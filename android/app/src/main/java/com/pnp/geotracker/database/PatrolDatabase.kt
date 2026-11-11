package com.pnp.geotracker.database

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import com.pnp.geotracker.model.PatrolLocation

class PatrolDatabase(context: Context) :
    SQLiteOpenHelper(
        context,
        DATABASE_NAME,
        null,
        DATABASE_VERSION
    ) {

    companion object {
        private const val DATABASE_NAME = "patrol.db"
        private const val DATABASE_VERSION = 1

        const val TABLE_PATROL_LOGS = "patrol_logs"
    }

    override fun onCreate(db: SQLiteDatabase) {

        db.execSQL(
            """
            CREATE TABLE $TABLE_PATROL_LOGS (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                latitude REAL NOT NULL,
                longitude REAL NOT NULL,
                dutyType TEXT,
                personnelId TEXT, 
                accuracy REAL,
                speed REAL,
                networkSignal REAL,
                altitude REAL,
                bearing REAL,
                timestamp INTEGER NOT NULL,
                synced INTEGER DEFAULT 0
            );
            """.trimIndent()
        )
    }

    override fun onUpgrade(
        db: SQLiteDatabase,
        oldVersion: Int,
        newVersion: Int
    ) {
        // We'll handle migrations later.
    }

    fun insertLocation(
        location: PatrolLocation
    ): Long {

        val values = ContentValues().apply {
            put("latitude", location.latitude)
            put("longitude", location.longitude)
            put("dutyType", location.dutyType)
            put("personnelId", location.personnelId)
            put("accuracy", location.accuracy)
            put("speed", location.speed)
            put("networkSignal", location.networkSignal)
            put("altitude", location.altitude)
            put("bearing", location.bearing)
            put("timestamp", location.timestamp)
            put("synced", if (location.synced) 1 else 0)
        }

        return writableDatabase.insert(
            TABLE_PATROL_LOGS,
            null,
            values
        )
    }

    fun getLocationCount(): Int {

        val cursor = readableDatabase.rawQuery(
            "SELECT COUNT(*) FROM $TABLE_PATROL_LOGS",
            null
        )

        cursor.moveToFirst()

        val count = cursor.getInt(0)

        cursor.close()

        return count
    }

    fun getUnsyncedLocations(
        limit: Int = 100
    ): List<PatrolLocation> {

        val locations = mutableListOf<PatrolLocation>()

        val cursor = readableDatabase.query(
            TABLE_PATROL_LOGS,
            null,
            "synced = ?",
            arrayOf("0"),
            null,
            null,
            "timestamp ASC",
            limit.coerceAtLeast(1).toString()
        )

        cursor.use {
            while (it.moveToNext()) {
                locations.add(
                    PatrolLocation(
                        id = it.getLong(
                            it.getColumnIndexOrThrow("id")
                        ),
                        personnelId = it.getString(
                            it.getColumnIndexOrThrow("personnelId")
                        ) ?: "",
                        dutyType = it.getString(
                            it.getColumnIndexOrThrow("dutyType")
                        ) ?: "",
                        latitude = it.getDouble(
                            it.getColumnIndexOrThrow("latitude")
                        ),
                        longitude = it.getDouble(
                            it.getColumnIndexOrThrow("longitude")
                        ),
                        accuracy = it.getFloat(
                            it.getColumnIndexOrThrow("accuracy")
                        ),
                        speed = it.getFloat(
                            it.getColumnIndexOrThrow("speed")
                        ),
                        networkSignal = it.getInt(
                            it.getColumnIndexOrThrow("networkSignal")
                        ),
                        altitude = it.getDouble(
                            it.getColumnIndexOrThrow("altitude")
                        ),
                        bearing = it.getFloat(
                            it.getColumnIndexOrThrow("bearing")
                        ),
                        timestamp = it.getLong(
                            it.getColumnIndexOrThrow("timestamp")
                        ),
                        synced = it.getInt(
                            it.getColumnIndexOrThrow("synced")
                        ) == 1
                    )
                )
            }
        }

        return locations
    }

    fun markAsSynced(ids: List<Long>) {
        if (ids.isEmpty()) return

        val placeholders = ids.joinToString(",") { "?" }

        writableDatabase.execSQL(
            """
            UPDATE $TABLE_PATROL_LOGS
            SET synced = 1
            WHERE id IN ($placeholders)
            """.trimIndent(),
            ids.map { it.toString() }.toTypedArray()
        )
    }

    fun getTotalLocationCount(): Int {

        val cursor = readableDatabase.rawQuery(
            """
            SELECT COUNT(*)
            FROM $TABLE_PATROL_LOGS
            """.trimIndent(),
            null
        )

        cursor.moveToFirst()

        val count = cursor.getInt(0)

        cursor.close()

        return count
    }

    fun getUnsyncedLocationCount(): Int {

        val cursor = readableDatabase.rawQuery(
            """
            SELECT COUNT(*)
            FROM $TABLE_PATROL_LOGS
            WHERE synced = 0
            """.trimIndent(),
            null
        )

        cursor.moveToFirst()

        val count = cursor.getInt(0)

        cursor.close()

        return count
    }
}