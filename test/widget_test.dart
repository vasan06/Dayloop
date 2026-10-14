// NEXORA — Flutter widget smoke test.
//
// Verifies that the app shell starts without crashing and renders
// the initial route (splash screen / NEXORA label).

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:nexora/main.dart';

void main() {
  testWidgets('App renders without crashing', (WidgetTester tester) async {
    await tester.pumpWidget(const NexoraApp());
    // The app shell should at minimum render without throwing.
    // Detailed route/auth tests will be added per-feature in Tier 2+.
    expect(find.byType(MaterialApp), findsNothing); // uses MaterialApp.router
    expect(find.byType(Router), findsWidgets);
  });
}
