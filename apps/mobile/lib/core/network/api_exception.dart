class ApiException implements Exception {
  final String message;
  final String? errorCode;
  final int? statusCode;
  final dynamic details;

  ApiException({
    required this.message,
    this.errorCode,
    this.statusCode,
    this.details,
  });

  @override
  String toString() => message;
}
