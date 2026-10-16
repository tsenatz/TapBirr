class HealthResponse {
  final bool success;
  final String? message;
  final String? status;

  HealthResponse({
    required this.success,
    this.message,
    this.status,
  });

  factory HealthResponse.fromJson(Map<String, dynamic> json) {
    return HealthResponse(
      success: json['success'] as bool? ?? false,
      message: json['message'] as String?,
      status: json['data']?['status'] as String? ?? json['status'] as String?,
    );
  }
}
