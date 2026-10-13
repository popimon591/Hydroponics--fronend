package com.groxvel.agriculture.network

import com.google.gson.annotations.SerializedName

data class ApiResponse<T>(
    @SerializedName("success") val success: Boolean,
    @SerializedName("data") val data: T,
    @SerializedName("message") val message: String? = null
)

data class LiveSensorResponse(
    @SerializedName("temperature") val temperature: Float,
    @SerializedName("humidity") val humidity: Float,
    @SerializedName("tds") val tds: Float,
    @SerializedName("light_intensity") val lightIntensity: Float,
    @SerializedName("daily_light_hours") val dailyLightHours: Float,
    @SerializedName("daily_dli") val dailyDli: Float,
    @SerializedName("updated_at") val updatedAt: String,
    @SerializedName("water_temperature") val waterTemperature: Float?,
    @SerializedName("water_level") val waterLevel: Float?,
    @SerializedName("ph") val ph: Float?,
    @SerializedName("soil_ph") val soilPh: Float?,
    @SerializedName("soil_moisture") val soilMoisture: Float?,
    @SerializedName("ec") val ec: Float?
)

data class SensorHistoryPoint(
    @SerializedName("temperature") val temperature: Float,
    @SerializedName("humidity") val humidity: Float,
    @SerializedName("tds") val tds: Float,
    @SerializedName("light_intensity") val lightIntensity: Float,
    @SerializedName("timestamp") val timestamp: String
)

data class DailySummary(
    @SerializedName("date") val date: String,
    @SerializedName("total_light_hours") val totalLightHours: Float,
    @SerializedName("total_dli") val totalDli: Float
)

data class AlarmItem(
    @SerializedName("id") val id: Int,
    @SerializedName("at") val at: String,
    @SerializedName("parameter") val parameter: String,
    @SerializedName("value") val value: Float,
    @SerializedName("level") val level: String,
    @SerializedName("message") val message: String,
    @SerializedName("device_name") val deviceName: String,
    @SerializedName("is_resolved") val isResolved: Boolean
)

data class TelemetryUpdate(
    @SerializedName("device_id") val deviceId: String,
    @SerializedName("temperature") val temperature: Float,
    @SerializedName("humidity") val humidity: Float,
    @SerializedName("tds") val tds: Float,
    @SerializedName("light_intensity") val lightIntensity: Float,
    @SerializedName("water_temperature") val waterTemperature: Float? = null,
    @SerializedName("water_level") val waterLevel: Float? = null,
    @SerializedName("ph") val ph: Float? = null
)

data class TelemetryResponse(
    @SerializedName("daily_dli") val dailyDli: Float,
    @SerializedName("daily_light_hours") val dailyLightHours: Float,
    @SerializedName("updated_at") val updatedAt: String
)

data class DeviceItem(
    @SerializedName("id") val id: Int,
    @SerializedName("device_id") val deviceId: String,
    @SerializedName("device_name") val deviceName: String,
    @SerializedName("location") val location: String?,
    @SerializedName("type") val type: String,
    @SerializedName("live") val live: LiveSensorResponse?
)

data class HomeResponse(
    @SerializedName("devices") val devices: List<DeviceItem>
)
