package com.pnp.geotracker

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class FCMPackage : ReactPackage {

    override fun createNativeModules(
        reactContext: ReactApplicationContext
    ): List<NativeModule> {

        return listOf(
            FCMModule(reactContext)
        )
    }

    override fun createViewManagers(
        reactContext: ReactApplicationContext
    ): List<ViewManager<*, *>> {

        return emptyList()
    }
}