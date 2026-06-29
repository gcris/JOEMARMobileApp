package com.pnp.geotracker

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.widget.Button
import android.widget.TextView

import com.facebook.react.ReactActivity

class SOSActivity : ReactActivity() {

    override fun getMainComponentName(): String {
        return "main"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        setContentView(R.layout.activity_sos)

        val officer = intent.getStringExtra("senderName") ?: ""
        val phone = intent.getStringExtra("phone_number") ?: ""

        val latitude = intent.getDoubleExtra("latitude",0.0)
        val longitude = intent.getDoubleExtra("longitude",0.0)

        findViewById<TextView>(R.id.txtOfficer).text = officer
        findViewById<TextView>(R.id.txtPhone).text = phone

        findViewById<Button>(R.id.btnDirection)
            .setOnClickListener {

                val uri =
                    Uri.parse(
                        "google.navigation:q=$latitude,$longitude"
                    )

                val intent = Intent(Intent.ACTION_VIEW, uri)
                intent.setPackage("com.google.android.apps.maps")

                startActivity(intent)
            }

        findViewById<Button>(R.id.btnClose)
            .setOnClickListener {
                finish()
            }
    }
}