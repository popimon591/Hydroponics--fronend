package com.groxvel.agriculture.network

import retrofit2.http.*

interface ApiService {

    /**
     * IoT Device Telemetry Ingestion
     */
    @PUT("sensor/sensorreading/")
    suspend fun updateTelemetry(
        @Body payload: TelemetryUpdate
    ): ApiResponse<TelemetryResponse>

    /**
     * Fetch all user devices with their current live readings (Dashboard)
     */
    @GET("sensor/home/")
    suspend fun getHomeDashboard(): ApiResponse<HomeResponse>

    /**
     * Fetch list of user devices
     */
    @GET("sensor/devices/")
    suspend fun getDeviceList(): ApiResponse<List<DeviceItem>>

    /**
     * Fetch real-time specific readings for one device
     */
    @GET("sensor/devices/{device_id}/live/")
    suspend fun getDeviceLiveState(
        @Path("device_id") deviceId: String
    ): ApiResponse<LiveSensorResponse>

    /**
     * Fetch historical telemetry for line charts (Default: past 24 hours)
     */
    @GET("sensor/history/{device_id}/")
    suspend fun getSensorHistory(
        @Path("device_id") deviceId: String,
        @Query("hours") hours: Int = 24
    ): ApiResponse<List<SensorHistoryPoint>>

    /**
     * Fetch archived DLI and photoperiod summaries for past 30 days
     */
    @GET("sensor/daily-summary/{device_id}/")
    suspend fun getPhotoperiodSummary(
        @Path("device_id") deviceId: String
    ): ApiResponse<List<DailySummary>>

    /**
     * Fetch unresolved environmental alarms for a device
     */
    @GET("sensor/alarms/{device_id}/")
    suspend fun getDeviceAlarms(
        @Path("device_id") deviceId: String
    ): ApiResponse<List<AlarmItem>>

    /**
     * Fetch all active alarms for the authenticated user
     */
    @GET("sensor/alarms/warning/")
    suspend fun getAllActiveAlarms(): ApiResponse<List<AlarmItem>>
}
