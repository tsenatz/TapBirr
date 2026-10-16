import 'package:dio/dio.dart';
import 'package:tapbirr/core/network/api_exception.dart';

class ApiResponse<T> {
  final bool success;
  final T? data;
  final String? message;
  final String? errorCode;
  final dynamic details;

  ApiResponse({
    required this.success,
    this.data,
    this.message,
    this.errorCode,
    this.details,
  });

  factory ApiResponse.fromJson(
    Map<String, dynamic> json,
    T Function(dynamic)? fromJsonT,
  ) {
    final success = json['success'] as bool? ?? false;
    T? data;

    if (fromJsonT != null && json.containsKey('data')) {
      data = fromJsonT(json['data']);
    } else if (json.containsKey('data')) {
      data = json['data'] as T?;
    }

    return ApiResponse(
      success: success,
      data: data,
      message: json['message'] as String?,
      errorCode: json['errorCode'] as String?,
      details: json['details'],
    );
  }

  static ApiException fromDioError(DioException error) {
    if (error.response != null) {
      final responseData = error.response!.data;
      if (responseData is Map<String, dynamic>) {
        return ApiException(
          message: responseData['message'] as String? ?? 'An error occurred',
          errorCode: responseData['errorCode'] as String?,
          statusCode: error.response!.statusCode,
          details: responseData['details'],
        );
      }
    }

    return ApiException(
      message: error.message ?? 'Network error occurred',
      statusCode: error.response?.statusCode,
    );
  }
}
