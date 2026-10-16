import 'package:tapbirr/data/models/health_response.dart';

class HealthMockDataSource {
  Future<HealthResponse> getHealth() async {
    // Simulate network delay
    await Future.delayed(const Duration(milliseconds: 500));
    return HealthResponse(
      success: true,
      message: 'Mock API: Service is healthy',
      status: 'ok',
    );
  }
}
