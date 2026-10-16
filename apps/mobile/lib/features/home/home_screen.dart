import 'package:flutter/material.dart';
import 'package:tapbirr/core/network/api_exception.dart';
import 'package:tapbirr/data/models/health_response.dart';
import 'package:tapbirr/domain/repositories/health_repository.dart';

class HomeScreen extends StatefulWidget {
  final HealthRepository repository;

  const HomeScreen({super.key, required this.repository});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  HealthResponse? _healthResponse;
  bool _isLoading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _fetchHealth();
  }

  Future<void> _fetchHealth() async {
    setState(() {
      _isLoading = true;
      _error = null;
      _healthResponse = null;
    });

    try {
      final response = await widget.repository.getHealth();
      setState(() {
        _healthResponse = response;
        _isLoading = false;
      });
    } on ApiException catch (e) {
      setState(() {
        _error = e.message;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: Theme.of(context).colorScheme.inversePrimary,
        title: const Text('TapBirr API Test'),
      ),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (_isLoading)
                const CircularProgressIndicator()
              else if (_error != null)
                Column(
                  children: [
                    const Icon(
                      Icons.error_outline,
                      color: Colors.red,
                      size: 48,
                    ),
                    const SizedBox(height: 16),
                    Text(
                      'Error: $_error',
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: Colors.red),
                    ),
                  ],
                )
              else if (_healthResponse != null)
                Column(
                  children: [
                    const Icon(
                      Icons.check_circle_outline,
                      color: Colors.green,
                      size: 48,
                    ),
                    const SizedBox(height: 16),
                    Text(
                      _healthResponse!.message ?? 'Success',
                      textAlign: TextAlign.center,
                      style: const TextStyle(fontSize: 18),
                    ),
                    const SizedBox(height: 8),
                    if (_healthResponse!.status != null)
                      Text(
                        'Status: ${_healthResponse!.status}',
                        style: const TextStyle(color: Colors.grey),
                      ),
                  ],
                )
              else
                const Text('Press the button to test API call'),
              const SizedBox(height: 32),
              ElevatedButton(
                onPressed: _isLoading ? null : _fetchHealth,
                child: const Text('Call Mock Endpoint'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
