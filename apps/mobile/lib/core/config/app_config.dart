class AppConfig {
  // Toggle to switch between mock and real API
  static const bool useMockApi = true;

  // Base URLs
  static const String devBaseUrl = 'http://10.0.2.2:5000/api'; // Android emulator
  static const String prodBaseUrl = 'https://api.tapbirr.com/api';

  // Development uses devBaseUrl, production uses prodBaseUrl
  static String get baseUrl {
    // In a real app, this would check environment
    return devBaseUrl;
  }

  // API timeout
  static const Duration apiTimeout = Duration(seconds: 30);

  const AppConfig();
}
