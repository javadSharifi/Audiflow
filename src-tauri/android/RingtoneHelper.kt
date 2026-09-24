package com.audiflow.app

import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.media.RingtoneManager
import android.net.Uri
import android.provider.MediaStore
import android.provider.Settings
import android.util.Log
import androidx.annotation.Keep

/**
 * RingtoneHelper: Sets an audio URI as system default ringtone,
 * managing the required WRITE_SETTINGS permission.
 */
@Keep
object RingtoneHelper {
  private const val TAG = "RingtoneHelper"

  fun setAsRingtone(context: Context, uriString: String): String {
    return try {
      if (!Settings.System.canWrite(context)) {
        val intent = Intent(Settings.ACTION_MANAGE_WRITE_SETTINGS).apply {
          data = Uri.parse("package:" + context.packageName)
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
        return "PERMISSION_REQUIRED"
      }

      val uri = Uri.parse(uriString)
      val resolver = context.contentResolver

      try {
        val values = ContentValues().apply {
          put(MediaStore.Audio.Media.IS_RINGTONE, true)
        }
        resolver.update(uri, values, null, null)
      } catch (_: Throwable) {}

      RingtoneManager.setActualDefaultRingtoneUri(context, RingtoneManager.TYPE_RINGTONE, uri)
      "OK"
    } catch (e: Throwable) {
      Log.e(TAG, "Failed to set as ringtone: $uriString", e)
      e.message ?: "Unknown error"
    }
  }
}
