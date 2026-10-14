/// NEXORA API error codes — mirrors backend `code` field in ErrorResponse.
abstract final class ApiErrorCode {
  static const String validationError = 'VALIDATION_ERROR';
  static const String unauthorized = 'UNAUTHORIZED';
  static const String forbidden = 'FORBIDDEN';
  static const String notFound = 'NOT_FOUND';
  static const String conflict = 'CONFLICT';
  static const String internalError = 'INTERNAL_ERROR';
  static const String rateLimited = 'RATE_LIMITED';
  static const String emailNotVerified = 'EMAIL_NOT_VERIFIED';
  static const String invalidCredentials = 'INVALID_CREDENTIALS';
  static const String tokenExpired = 'TOKEN_EXPIRED';
}

/// Exception raised by the API client on error responses.
class ApiException implements Exception {
  const ApiException({
    required this.code,
    required this.message,
    this.statusCode,
  });

  final String code;
  final String message;
  final int? statusCode;

  @override
  String toString() => 'ApiException($statusCode, $code): $message';
}

/// Exception raised on network connectivity errors.
class NetworkException implements Exception {
  const NetworkException([this.message = 'No internet connection']);
  final String message;

  @override
  String toString() => 'NetworkException: $message';
}
