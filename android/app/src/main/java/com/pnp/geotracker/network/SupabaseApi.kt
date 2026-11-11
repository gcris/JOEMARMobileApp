
package com.pnp.geotracker.network

import android.util.Log
import com.pnp.geotracker.BuildConfig
import com.pnp.geotracker.model.PatrolLocation
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.concurrent.TimeUnit

class SupabaseApi {

    companion object {
        private const val TAG = "SupabaseApi"
    }

    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .callTimeout(60, TimeUnit.SECONDS)
        .build()

    private fun formatTimestamp(timestamp: Long): String {
        val sdf = SimpleDateFormat(
            "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
            Locale.US
        )
        sdf.timeZone = TimeZone.getTimeZone("UTC")
        return sdf.format(Date(timestamp))
    }

    fun upload(locations: List<PatrolLocation>): Boolean {
        if (locations.isEmpty()) {
            Log.d(TAG, "No locations to upload")
            return true
        }

        // Never upload only part of a batch and then mark the entire
        // original batch as synced.
        val invalidCount = locations.count {
            it.personnelId.isBlank()
        }

        if (invalidCount > 0) {
            Log.e(
                TAG,
                "Upload stopped: $invalidCount records have an empty personnel ID"
            )
            return false
        }

        return try {
            val jsonArray = JSONArray()

            locations.forEach { location ->
                val obj = JSONObject().apply {
                    put("personnel_id", location.personnelId)
                    put(
                        "duty_type",
                        location.dutyType.takeIf { it.isNotBlank() }
                            ?: "Foot Patrolling"
                    )
                    put("latitude", location.latitude)
                    put("longitude", location.longitude)
                    put("speed", location.speed)
                    put("captured_at", formatTimestamp(location.timestamp))
                    put("network_signal", location.networkSignal)
                }

                jsonArray.put(obj)
            }

            val body = jsonArray.toString()
                .toRequestBody("application/json".toMediaType())

            val baseUrl = BuildConfig.SUPABASE_URL.trimEnd('/')

            val request = Request.Builder()
                .url("$baseUrl/rest/v1/patrol_logs")
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

            client.newCall(request).execute().use { response ->
                Log.i(TAG, "Supabase upload HTTP ${response.code}")

                if (!response.isSuccessful) {
                    val errorBody = response.body?.string()
                    Log.e(
                        TAG,
                        "Supabase upload failed: HTTP ${response.code}, " +
                            "response=${errorBody?.take(500)}"
                    )
                }

                response.isSuccessful
            }

        } catch (e: Exception) {
            Log.e(TAG, "Upload failed", e)
            false
        }
    }
}
