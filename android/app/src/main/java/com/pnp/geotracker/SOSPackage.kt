
package com.pnp.geotracker   // <-- Change this too

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class SOSPackage : ReactPackage {

    override fun createNativeModules(
        reactContext: ReactApplicationContext
    ): List<NativeModule> {

        return listOf(
            SOSModule(reactContext)
        )
    }

    override fun createViewManagers(
        reactContext: ReactApplicationContext
    ): List<ViewManager<*, *>> {

        return emptyList()
    }
}