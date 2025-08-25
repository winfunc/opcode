// This is a basic Flutter widget test for Claudia Flutter app.

import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:claudia_flutter/main.dart';

void main() {
  testWidgets('Claudia Flutter app loads correctly', (WidgetTester tester) async {
    // Build our app and trigger a frame.
    await tester.pumpWidget(const ProviderScope(child: ClaudiaFlutterApp()));

    // Verify that our app title is displayed.
    expect(find.text('Claudia Flutter'), findsOneWidget);
    expect(find.text('Flutter version of Claudia - GUI app and Toolkit for Claude Code'), findsOneWidget);
    expect(find.text('Get Started'), findsOneWidget);

    // Tap the 'Get Started' button
    await tester.tap(find.text('Get Started'));
    await tester.pump();

    // Verify that the snackbar appears
    expect(find.text('Flutter Migration Phase 1 Complete!'), findsOneWidget);
  });
}
