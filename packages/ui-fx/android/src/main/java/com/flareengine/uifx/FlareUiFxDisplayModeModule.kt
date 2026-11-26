package com.flareengine.uifx

import android.app.Activity
import android.os.Build
import android.view.Display
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Asks the window for the panel's fastest display mode while a snapshot effect plays (C39).
 * On Android 15 and later the OS picks the render rate, and an overlay that moves only Skia
 * content is given 30-60 Hz. The JS side counts the effects: see `src/fx/native/display-mode.ts`.
 */
class FlareUiFxDisplayModeModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("FlareUiFxDisplayMode")

    AsyncFunction("setFastest") {
      val activity = appContext.currentActivity ?: return@AsyncFunction
      setPreferredMode(activity, fastestModeId(activity))
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("clear") {
      val activity = appContext.currentActivity ?: return@AsyncFunction
      // 0 is "no preference": the OS picks the mode again.
      setPreferredMode(activity, 0)
    }.runOnQueue(Queues.MAIN)
  }

  private fun setPreferredMode(activity: Activity, modeId: Int) {
    val window = activity.window
    val attributes = window.attributes
    attributes.preferredDisplayModeId = modeId
    window.attributes = attributes
  }

  // The fastest mode at the current resolution. A mode of another size would also change the
  // resolution the app renders at.
  private fun fastestModeId(activity: Activity): Int {
    val display = displayOf(activity) ?: return 0
    val current = display.mode
    var fastest = current
    for (mode in display.supportedModes) {
      val sameSize =
        mode.physicalWidth == current.physicalWidth && mode.physicalHeight == current.physicalHeight
      if (sameSize && mode.refreshRate > fastest.refreshRate) fastest = mode
    }
    return fastest.modeId
  }

  @Suppress("DEPRECATION")
  private fun displayOf(activity: Activity): Display? =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) activity.display
    else activity.windowManager.defaultDisplay
}
