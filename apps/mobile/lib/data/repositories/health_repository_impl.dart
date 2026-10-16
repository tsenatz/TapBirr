import 'package:tapbirr/core/config/app_config.dart';
import 'package:tapbirr/data/datasources/mock/health_mock_datasource.dart';
import 'package:tapbirr/data/datasources/remote/health_remote_datasource.dart';
import 'package:tapbirr/data/models/health_response.dart';
import 'package:tapbirr/domain/repositories/health_repository.dart';

class HealthRepositoryImpl implements HealthRepository {
  final HealthRemoteDataSource _remoteDataSource;
  final HealthMockDataSource _mockDataSource;

  HealthRepositoryImpl({
    required this._remoteDataSource,
    required this._mockDataSource,
    AppConfig config = const AppConfig(),
  });

  @override
  Future<HealthResponse> getHealth() async {
    if (AppConfig.useMockApi) {
      return _mockDataSource.getHealth();
    }
    return _remoteDataSource.getHealth();
  }
}
