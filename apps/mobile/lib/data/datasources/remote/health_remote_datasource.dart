import 'package:dio/dio.dart';
import 'package:tapbirr/core/network/api_client.dart';
import 'package:tapbirr/core/network/api_response.dart';
import 'package:tapbirr/data/models/health_response.dart';

class HealthRemoteDataSource {
  final Dio _dio;

  HealthRemoteDataSource({required ApiClient apiClient}) : _dio = apiClient.dio;

  Future<HealthResponse> getHealth() async {
    try {
      final response = await _dio.get('/health');
      return HealthResponse.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiResponse.fromDioError(e);
    }
  }
}
