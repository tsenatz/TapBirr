import 'package:tapbirr/data/models/health_response.dart';

abstract class HealthRepository {
  Future<HealthResponse> getHealth();
}
