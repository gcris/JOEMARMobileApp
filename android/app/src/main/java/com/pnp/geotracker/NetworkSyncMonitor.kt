package com.pnp.geotracker.sync

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.os.Build
import android.util.Log
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledFuture
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Triggers a sync whenever the phone has VALIDATED internet (not just a
 * Wi-Fi connection with no data), then keeps retrying with backoff until
 * everything is uploaded.
 *
 * syncAction must be a BLOCKING function that returns:
 *   true  -> nothing left to upload (or all uploaded)
 *   false -> failed / still pending, try again later
 */
class NetworkSyncMonitor(
    context: Context,
    private val syncAction: () -> Boolean
) {

    companion object {
        private const val TAG = "NetworkSyncMonitor"

        private const val DEBOUNCE_MS = 2_000L          // wait for the network to settle
        private const val PERIODIC_MS = 60_000L         // while online, check for new points
        private const val MIN_RETRY_MS = 15_000L        // backoff after a failed sync
        private const val MAX_RETRY_MS = 5 * 60_000L
    }

    private val appContext = context.applicationContext
    private val connectivityManager =
        appContext.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager

    // Single thread: syncs never overlap and never run on the main thread.
    private val executor = Executors.newSingleThreadScheduledExecutor()
    private val syncing = AtomicBoolean(false)
    private val started = AtomicBoolean(false)

    @Volatile private var online = false
    private var retryDelayMs = MIN_RETRY_MS
    private var pending: ScheduledFuture<*>? = null

    private val callback = object : ConnectivityManager.NetworkCallback() {

        override fun onCapabilitiesChanged(
            network: Network,
            capabilities: NetworkCapabilities
        ) {
            val hasInternet =
                capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
                    capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)

            if (hasInternet && !online) {
                online = true
                Log.d(TAG, "Internet available, scheduling sync")
                retryDelayMs = MIN_RETRY_MS
                schedule(DEBOUNCE_MS)
            } else if (!hasInternet && online) {
                markOffline()
            }
        }

        override fun onLost(network: Network) {
            markOffline()
        }
    }

    fun start() {
        if (!started.compareAndSet(false, true)) return

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                connectivityManager.registerDefaultNetworkCallback(callback)
            } else {
                val request = NetworkRequest.Builder()
                    .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                    .build()
                connectivityManager.registerNetworkCallback(request, callback)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to register network callback", e)
        }

        // If we are already online when the service starts, sync right away.
        val caps = connectivityManager.getNetworkCapabilities(
            connectivityManager.activeNetwork
        )
        if (caps != null &&
            caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
            caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
        ) {
            online = true
            schedule(DEBOUNCE_MS)
        }
    }

    /** Ask for a sync soon (for example after saving a batch of points). */
    fun requestSync() {
        if (online) schedule(DEBOUNCE_MS)
    }

    fun stop() {
        if (!started.compareAndSet(true, false)) return

        try {
            connectivityManager.unregisterNetworkCallback(callback)
        } catch (e: IllegalArgumentException) {
            // Already unregistered
        }

        online = false
        synchronized(this) { pending?.cancel(false) }
        executor.shutdownNow()
    }

    // ------------------------------------------------------------------

    private fun markOffline() {
        online = false
        synchronized(this) { pending?.cancel(false) }
        Log.d(TAG, "Internet lost, sync paused")
    }

    @Synchronized
    private fun schedule(delayMs: Long) {
        if (executor.isShutdown) return
        pending?.cancel(false)
        pending = executor.schedule({ runSync() }, delayMs, TimeUnit.MILLISECONDS)
    }

    private fun runSync() {
        if (!online) return
        if (!syncing.compareAndSet(false, true)) return

        var success = false
        try {
            success = syncAction()
        } catch (e: Exception) {
            Log.e(TAG, "Sync failed", e)
        } finally {
            syncing.set(false)
        }

        if (!online) return

        if (success) {
            retryDelayMs = MIN_RETRY_MS
            schedule(PERIODIC_MS)               // look for new points later
        } else {
            Log.d(TAG, "Sync incomplete, retrying in ${retryDelayMs / 1000}s")
            schedule(retryDelayMs)
            retryDelayMs = minOf(retryDelayMs * 2, MAX_RETRY_MS)
        }
    }
}
