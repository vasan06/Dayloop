import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

/// NEXORA application route definitions.
///
/// Guards are applied via [redirect] in each route or at the router level.
/// Auth guards will check the AuthBloc state (wired in Tier 2).
abstract final class AppRoutes {
  static const String splash = '/';
  static const String login = '/login';
  static const String register = '/register';
  static const String forgotPassword = '/forgot-password';
  static const String dashboard = '/dashboard';
  static const String tasks = '/tasks';
  static const String notes = '/notes';
  static const String projects = '/projects';
  static const String habits = '/habits';
  static const String goals = '/goals';
  static const String calendar = '/calendar';
  static const String settings = '/settings';
}

/// Builds the [GoRouter] for NEXORA.
///
/// TODO (Tier 2): wire [redirect] to AuthBloc to protect authenticated routes.
GoRouter buildAppRouter() {
  return GoRouter(
    initialLocation: AppRoutes.splash,
    debugLogDiagnostics: true,
    routes: [
      GoRoute(
        path: AppRoutes.splash,
        name: 'splash',
        builder: (context, state) => const _PlaceholderPage(title: 'NEXORA'),
      ),
      GoRoute(
        path: AppRoutes.login,
        name: 'login',
        builder: (context, state) => const _PlaceholderPage(title: 'Sign In'),
      ),
      GoRoute(
        path: AppRoutes.register,
        name: 'register',
        builder: (context, state) =>
            const _PlaceholderPage(title: 'Create Account'),
      ),
      GoRoute(
        path: AppRoutes.forgotPassword,
        name: 'forgotPassword',
        builder: (context, state) =>
            const _PlaceholderPage(title: 'Reset Password'),
      ),
      GoRoute(
        path: AppRoutes.dashboard,
        name: 'dashboard',
        builder: (context, state) =>
            const _PlaceholderPage(title: 'Dashboard'),
      ),
      GoRoute(
        path: AppRoutes.tasks,
        name: 'tasks',
        builder: (context, state) => const _PlaceholderPage(title: 'Tasks'),
      ),
      GoRoute(
        path: AppRoutes.notes,
        name: 'notes',
        builder: (context, state) => const _PlaceholderPage(title: 'Notes'),
      ),
      GoRoute(
        path: AppRoutes.projects,
        name: 'projects',
        builder: (context, state) =>
            const _PlaceholderPage(title: 'Projects'),
      ),
      GoRoute(
        path: AppRoutes.habits,
        name: 'habits',
        builder: (context, state) => const _PlaceholderPage(title: 'Habits'),
      ),
      GoRoute(
        path: AppRoutes.goals,
        name: 'goals',
        builder: (context, state) => const _PlaceholderPage(title: 'Goals'),
      ),
      GoRoute(
        path: AppRoutes.calendar,
        name: 'calendar',
        builder: (context, state) =>
            const _PlaceholderPage(title: 'Calendar'),
      ),
      GoRoute(
        path: AppRoutes.settings,
        name: 'settings',
        builder: (context, state) =>
            const _PlaceholderPage(title: 'Settings'),
      ),
    ],
  );
}

/// Temporary placeholder used until feature screens are built (Tier 3+).
class _PlaceholderPage extends StatelessWidget {
  const _PlaceholderPage({required this.title});

  final String title;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: Center(
        child: Text(
          title,
          style: Theme.of(context).textTheme.headlineMedium,
        ),
      ),
    );
  }
}
