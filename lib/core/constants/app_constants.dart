/// NEXORA application constants.
abstract final class AppConstants {
  /// Base URL for the NEXORA API.
  /// Override via compile-time `--dart-define=API_BASE_URL=https://...`
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:8000', // Android emulator → localhost
  );

  static const String apiVersion = '/api/v1';
  static const String fullApiBaseUrl = '$apiBaseUrl$apiVersion';

  /// HTTP timeouts
  static const int connectTimeoutMs = 10000;
  static const int receiveTimeoutMs = 30000;

  /// Sync / retry
  static const int maxSyncRetries = 5;
  static const Duration syncRetryBaseDelay = Duration(seconds: 2);
  static const Duration syncPollInterval = Duration(minutes: 5);

  /// Token storage keys (used by flutter_secure_storage)
  static const String accessTokenKey = 'nexora_access_token';
  static const String refreshTokenKey = 'nexora_refresh_token';
  static const String deviceIdKey = 'nexora_device_id';
}
