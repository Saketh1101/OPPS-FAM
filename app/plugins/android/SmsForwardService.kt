package __PACKAGE__

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import androidx.core.app.NotificationCompat
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

/**
 * Foreground service that hosts the headless JS task. Android requires a
 * foreground service (with a visible notification) to run work started from a
 * background broadcast on modern versions. It hands the SMS payload to the
 * "SmsForwardTask" JS task registered in index.js.
 */
class SmsForwardService : HeadlessJsTaskService() {

  companion object {
    private const val CHANNEL_ID = "otpshare_forwarder"
    private const val NOTIFICATION_ID = 4517
    private const val TASK_NAME = "SmsForwardTask"
    private const val TASK_TIMEOUT_MS = 30000L
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    startForegroundNotification()
    return super.onStartCommand(intent, flags, startId)
  }

  private fun startForegroundNotification() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      if (manager.getNotificationChannel(CHANNEL_ID) == null) {
        manager.createNotificationChannel(
          NotificationChannel(CHANNEL_ID, "OTP forwarding", NotificationManager.IMPORTANCE_MIN)
        )
      }
    }

    val notification = NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle("OTPShare")
      .setContentText("Watching for OTPs")
      .setSmallIcon(applicationInfo.icon)
      .setPriority(NotificationCompat.PRIORITY_MIN)
      .setOngoing(true)
      .build()

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }
  }

  override fun getTaskConfig(intent: Intent?): HeadlessJsTaskConfig? {
    val extras = intent?.extras ?: return null
    return HeadlessJsTaskConfig(
      TASK_NAME,
      Arguments.fromBundle(extras),
      TASK_TIMEOUT_MS,
      true // allowed to run while the app is in the foreground too
    )
  }
}
