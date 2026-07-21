package com.pnp.geotracker.network

import android.util.Log
import com.pnp.geotracker.model.PatrolLocation
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject

import com.pnp.geotracker.BuildConfig
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

class SupabaseApi {

    companion object {
        private const val TAG = "SupabaseApi"
    }

    private val client = OkHttpClient()

    private fun formatTimestamp(timestamp: Long): String {

        val sdf = SimpleDateFormat(
            "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
            Locale.US
        )

        sdf.timeZone = TimeZone.getTimeZone("UTC")

        return sdf.format(Date(timestamp))
    }

    fun upload(
        locations: List<PatrolLocation>
    ): Boolean {

        try {

            Log.d(TAG, BuildConfig.SUPABASE_URL)

            val jsonArray = JSONArray()

            locations.forEach { location ->

                val obj = JSONObject()

                Log.d(TAG, "personnel_id: ${location.personnelId}")
                Log.d(TAG, "dutyType: ${location.dutyType}")

                obj.put("personnel_id", location.personnelId)
                obj.put("duty_type", location.dutyType)
                obj.put("latitude", location.latitude)
                obj.put("longitude", location.longitude)
                // obj.put("accuracy", location.accuracy)
                obj.put("speed", location.speed)
                // obj.put("altitude", location.altitude)
                // obj.put("bearing", location.bearing)
                obj.put("captured_at", formatTimestamp(location.timestamp))
                obj.put("network_signal", location.networkSignal)

                jsonArray.put(obj)

            }

            Log.d(TAG, jsonArray.toString())
            
            val body =
                jsonArray
                    .toString()
                    .toRequestBody(
                        "application/json".toMediaType()
                    )
            Log.d(TAG, body.toString())

            val request =
                Request.Builder()
                    .url("${BuildConfig.SUPABASE_URL}/rest/v1/patrol_logs")
                    .addHeader(
                        "apikey",
                        BuildConfig.SUPABASE_ANON_KEY
                    )
                    .addHeader(
                        "Authorization",
                        "Bearer ${BuildConfig.SUPABASE_ANON_KEY}"
                    )
                    .addHeader(
                        "Prefer",
                        "return=minimal"
                    )
                    .post(body)
                    .build()

            val response =
                client.newCall(request).execute()

            Log.d(TAG, "HTTP ${response.code}")
            Log.d(TAG, response.body?.string() ?: "No response body")

            return response.isSuccessful

        } catch (e: Exception) {

            Log.e(TAG, "Upload failed", e)

            return false
        }
    }
}