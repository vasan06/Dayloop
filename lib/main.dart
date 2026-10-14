import 'package:flutter/material.dart';

import 'app/router/app_router.dart';
import 'app/theme/app_theme.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const NexoraApp());
}

/// Root widget for the NEXORA application.
///
/// Sets up:
/// - The canonical light theme (design tokens from [buildNexoraTheme])
/// - GoRouter for all navigation
///
/// BLoC providers will wrap this in Tier 2 (Auth) and later tiers.
class NexoraApp extends StatelessWidget {
  const NexoraApp({super.key});

  @override
  Widget build(BuildContext context) {
    final router = buildAppRouter();

    return MaterialApp.router(
      title: 'NEXORA',
      debugShowCheckedModeBanner: false,
      theme: buildNexoraTheme(),
      routerConfig: router,
    );
  }
}
