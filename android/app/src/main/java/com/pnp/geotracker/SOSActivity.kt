package com.pnp.geotracker

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.widget.Button
import android.widget.TextView
import android.media.MediaPlayer
import android.os.VibrationEffect
import android.os.Vibrator
import android.content.Context
import android.app.NotificationManager

import androidx.appcompat.app.AppCompatActivity

class SOSActivity : AppCompatActivity() {
    private var mediaPlayer: MediaPlayer? = null
    private lateinit var vibrator: Vibrator

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        setContentView(R.layout.activity_sos)
        vibrator = getSystemService(Vibrator::class.java)

        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            val effect = VibrationEffect.createWaveform(
                longArrayOf(0, 1000, 500),
                0
            )
            vibrator.vibrate(effect)
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        } else {
            @Suppress("DEPRECATION")
            vibrator.vibrate(longArrayOf(0, 1000, 500), 0)
        }

        mediaPlayer = MediaPlayer.create(this, R.raw.sos_alert)
        mediaPlayer?.apply {
            isLooping = true
            start()
        }

        val title = intent.getStringExtra("title") ?: "DISTRESS SIGNAL"
        val body = intent.getStringExtra("body") ?: ""
        val officer = intent.getStringExtra("senderName") ?: ""
        val phone = intent.getStringExtra("phone_number") ?: ""

        val latitude = intent.getDoubleExtra("latitude",0.0)
        val longitude = intent.getDoubleExtra("longitude",0.0)

        findViewById<TextView>(R.id.txtTitle).text = title
        findViewById<TextView>(R.id.txtBody).text = body
        findViewById<TextView>(R.id.txtOfficer).text = officer
        findViewById<TextView>(R.id.txtPhone).text = phone

        findViewById<Button>(R.id.btnDirection)
            .setOnClickListener {
                mediaPlayer?.stop()
                mediaPlayer?.release()
                mediaPlayer = null

                vibrator.cancel();

                val uri =
                    Uri.parse(
                        "google.navigation:q=$latitude,$longitude"
                    )

                val intent = Intent(Intent.ACTION_VIEW, uri)
                intent.setPackage("com.google.android.apps.maps")

                startActivity(intent)

                val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                notificationManager.cancel(9999)

                finish()
            }

        findViewById<Button>(R.id.btnCall)
            .setOnClickListener {
                mediaPlayer?.stop()
                mediaPlayer?.release()
                mediaPlayer = null

                vibrator.cancel();

                val intent = Intent(Intent.ACTION_DIAL).apply {
                    data = Uri.parse("tel:$phone")
                }

                startActivity(intent)

                val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                notificationManager.cancel(9999)

                finish()
            }

        findViewById<Button>(R.id.btnClose)
            .setOnClickListener {
                mediaPlayer?.let {
                    if (it.isPlaying) {
                        it.stop()
                    }
                    it.release()
                }
                mediaPlayer = null

                vibrator.cancel();

                val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                notificationManager.cancel(9999)

                finish()
            }
    }

    override fun onDestroy() {
        mediaPlayer?.let {
            if (it.isPlaying) {
                it.stop()
            }
            it.release()
        }
        mediaPlayer = null

        vibrator.cancel();

        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.cancel(9999)

        super.onDestroy()
    }
}