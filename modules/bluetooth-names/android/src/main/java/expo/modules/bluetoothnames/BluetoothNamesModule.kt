package expo.modules.bluetoothnames

import android.Manifest
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothManager
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import io.github.expo.modules.v2.ExpoModule
import io.github.expo.modules.v2.JS
import io.github.expo.modules.v2.Module
import io.github.expo.modules.v2.react.androidContext
import org.json.JSONArray
import org.json.JSONObject

@ExpoModule("BluetoothNames")
class BluetoothNamesModule : Module() {
  private var previousAudioMode: Int? = null
  private var voiceHeld = false
  private val mainHandler = Handler(Looper.getMainLooper())
  @Volatile private var cachedDevices = "[]"
  @Volatile private var cachedAt = 0L

  @JS
  fun setCallMode(enabled: Boolean) {
    val manager = androidContext.getSystemService(Context.AUDIO_SERVICE) as? AudioManager ?: return
    if (enabled) {
      if (!voiceHeld) {
        previousAudioMode = manager.mode
        voiceHeld = true
      }
      // Wideband call uplink: the sender bud mixes every mic it has into the stream.
      // Playback stays on that same call, so both earbuds can speak it.
      manager.mode = AudioManager.MODE_IN_COMMUNICATION
      manager.isSpeakerphoneOn = false
      manager.isMicrophoneMute = false
      runCatching { manager.setParameters("bt_wbs=on") }
      runCatching { manager.setParameters("bt_sco_wb=on") }
      runCatching { manager.setParameters("hfp_set_sampling_rate=16000") }
      runCatching { manager.setParameters("bt_headset_nrec=on") }
      runCatching { manager.setParameters("A2dpSuspended=true") }
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
        @Suppress("DEPRECATION")
        manager.startBluetoothSco()
        @Suppress("DEPRECATION")
        manager.isBluetoothScoOn = true
      }
      holdHeadsetCall(manager)
      mainHandler.postDelayed({ holdHeadsetCall(manager) }, 350)
      mainHandler.postDelayed({ holdHeadsetCall(manager) }, 900)
      return
    }
    if (!voiceHeld) return
    mainHandler.removeCallbacksAndMessages(null)
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
      @Suppress("DEPRECATION")
      manager.isBluetoothScoOn = false
      @Suppress("DEPRECATION")
      manager.stopBluetoothSco()
    }
    runCatching { manager.setParameters("A2dpSuspended=false") }
    previousAudioMode?.let { manager.mode = it }
    previousAudioMode = null
    voiceHeld = false
  }

  private fun holdHeadsetCall(manager: AudioManager) {
    runCatching { manager.setParameters("bt_wbs=on") }
    runCatching { manager.setParameters("A2dpSuspended=true") }
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
      @Suppress("DEPRECATION")
      manager.isBluetoothScoOn = true
    }
    manager.isSpeakerphoneOn = false
    manager.isMicrophoneMute = false
  }

  @JS
  fun isEnabled(): Boolean {
    val adapter = bluetoothAdapter() ?: return false
    return try {
      adapter.isEnabled
    } catch (_: SecurityException) {
      false
    }
  }

  @JS
  fun getConnectedDevices(): String {
    if (!isEnabled()) {
      cachedDevices = "[]"
      cachedAt = SystemClock.elapsedRealtime()
      return cachedDevices
    }
    val now = SystemClock.elapsedRealtime()
    if (now - cachedAt < 1000L) return cachedDevices
    val json = readAudioDevices()
    cachedDevices = json
    cachedAt = now
    return json
  }

  private fun readAudioDevices(): String {
    if (!hasConnectPermission()) return "[]"
    val manager = androidContext.getSystemService(Context.AUDIO_SERVICE) as? AudioManager ?: return "[]"
    val names = linkedMapOf<String, String>()
    val devices = try {
      manager.getDevices(AudioManager.GET_DEVICES_INPUTS or AudioManager.GET_DEVICES_OUTPUTS)
    } catch (_: SecurityException) {
      return "[]"
    }
    for (device in devices) {
      if (!isHeadset(device.type)) continue
      val name = device.productName?.toString()?.trim().orEmpty().ifBlank { "Earbuds" }
      if (isLocalName(name)) continue
      val address = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
        device.address?.takeIf { it.isNotBlank() && !it.equals("00:00:00:00:00:00", ignoreCase = true) }
      } else {
        null
      }
      names.putIfAbsent(address ?: name.lowercase(), name)
    }
    val array = JSONArray()
    names.forEach { (address, name) ->
      array.put(JSONObject().put("id", address).put("name", name))
    }
    return array.toString()
  }

  private fun isHeadset(type: Int): Boolean {
    return type == AudioDeviceInfo.TYPE_BLUETOOTH_SCO ||
      type == AudioDeviceInfo.TYPE_BLUETOOTH_A2DP ||
      (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P && type == AudioDeviceInfo.TYPE_HEARING_AID) ||
      (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && type == AudioDeviceInfo.TYPE_BLE_HEADSET)
  }

  private fun hasConnectPermission(): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true
    return androidContext.checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED
  }

  private fun bluetoothAdapter(): BluetoothAdapter? {
    val manager = androidContext.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
    return manager?.adapter
  }

  private fun isLocalName(raw: String): Boolean {
    val name = raw.trim().lowercase()
    val adapter = bluetoothAdapter()
    val exact = listOfNotNull(adapter?.name, Build.MODEL, Build.DEVICE, Build.PRODUCT)
      .map { it.trim().lowercase() }
      .filter { it.isNotEmpty() }
    val model = Build.MODEL.trim().lowercase()
    return exact.any { it == name } || (model.length > 3 && name.contains(model))
  }
}
