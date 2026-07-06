package __PACKAGE__

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Telephony

/**
 * Manifest-registered receiver for incoming SMS. Because it is declared in the
 * manifest (not at JS runtime), Android delivers SMS to it even when the app UI
 * is closed or was swiped away. Receiving SMS_RECEIVED is one of the exemptions
 * that allows starting a foreground service from the background.
 */
class SmsReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return

    val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent) ?: return
    if (messages.isEmpty()) return

    val sender = messages[0].originatingAddress ?: ""
    // Long SMS arrive as multiple parts; concatenate their bodies.
    val body = buildString {
      for (message in messages) append(message.messageBody ?: "")
    }
    if (body.isEmpty()) return

    val serviceIntent = Intent(context, SmsForwardService::class.java).apply {
      putExtra("sender", sender)
      putExtra("body", body)
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      context.startForegroundService(serviceIntent)
    } else {
      context.startService(serviceIntent)
    }
  }
}
