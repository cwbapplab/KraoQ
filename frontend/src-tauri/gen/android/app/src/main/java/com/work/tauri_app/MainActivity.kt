package com.work.tauri_app

import android.os.Bundle
import android.os.Build
import android.view.View
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.core.view.WindowInsetsCompat

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    
    // Set up immersive mode: allow drawing behind notch
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
        window.attributes.layoutInDisplayCutoutMode = android.view.WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
    }

    // Ensure system UI is hidden after layout is ready
    window.decorView.post {
        hideSystemUI()
    }
  }

  // Removed onWindowFocusChanged to prevent focus stealing after keyboard dismissal


  private fun hideSystemUI() {
    val windowInsetsController = WindowCompat.getInsetsController(window, window.decorView)
    
    // Configure the behavior: allow swipe to show bars transiently
    windowInsetsController.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
    
    // Only hide the status bar (as requested), leave navigation bars visible
    // This often fixes the "two clicks" issue on Android
    windowInsetsController.hide(WindowInsetsCompat.Type.statusBars())
  }
}
