import 'package:flutter_test/flutter_test.dart';
import 'package:tapbirr/main.dart';

void main() {
  testWidgets('App renders and shows API test screen', (WidgetTester tester) async {
    await tester.pumpWidget(const MyApp());
    await tester.pumpAndSettle(const Duration(seconds: 2));
    
    expect(find.text('TapBirr API Test'), findsOneWidget);
    expect(find.text('Call Mock Endpoint'), findsOneWidget);
  });
}
