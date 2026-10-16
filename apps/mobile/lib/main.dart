import 'package:flutter/material.dart';
import 'package:tapbirr/core/network/api_client.dart';
import 'package:tapbirr/core/storage/secure_storage_service.dart';
import 'package:tapbirr/data/datasources/mock/health_mock_datasource.dart';
import 'package:tapbirr/data/datasources/remote/health_remote_datasource.dart';
import 'package:tapbirr/data/repositories/health_repository_impl.dart';
import 'package:tapbirr/domain/repositories/health_repository.dart';
import 'package:tapbirr/features/home/home_screen.dart';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  HealthRepository _buildRepository() {
    final secureStorage = SecureStorageService();
    final apiClient = ApiClient(secureStorage: secureStorage);
    return HealthRepositoryImpl(
      remoteDataSource: HealthRemoteDataSource(apiClient: apiClient),
      mockDataSource: HealthMockDataSource(),
    );
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'TapBirr',
      theme: ThemeData(
        colorScheme: .fromSeed(seedColor: Colors.deepPurple),
      ),
      home: HomeScreen(repository: _buildRepository()),
    );
  }
}
