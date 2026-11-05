import 'package:flutter/material.dart';

/// NEXORA Design Tokens — light-only theme.
///
/// Colour values are the canonical brand palette defined in the task spec.
/// All widgets must reference these constants rather than hard-coding colours.
abstract final class NexoraColors {
  // Surface
  static const Color background = Color(0xFFFFFFFF);
  static const Color card = Color(0xFFF7F8FA);
  static const Color border = Color(0xFFE4E7EC);

  // Brand / actions
  static const Color primary = Color(0xFF2563EB);
  static const Color secondary = Color(0xFF0EA5E9);

  // Semantic
  static const Color critical = Color(0xFFDC2626);
  static const Color high = Color(0xFFEA580C);
  static const Color success = Color(0xFF16A34A);

  // Text
  static const Color textPrimary = Color(0xFF0F172A);
  static const Color textMuted = Color(0xFF64748B);
}

/// NEXORA typography scale.
abstract final class NexoraTextStyles {
  static const TextStyle headlineLarge = TextStyle(
    fontSize: 28,
    fontWeight: FontWeight.w700,
    color: NexoraColors.textPrimary,
    letterSpacing: -0.5,
  );

  static const TextStyle headlineMedium = TextStyle(
    fontSize: 22,
    fontWeight: FontWeight.w600,
    color: NexoraColors.textPrimary,
    letterSpacing: -0.3,
  );

  static const TextStyle titleLarge = TextStyle(
    fontSize: 18,
    fontWeight: FontWeight.w600,
    color: NexoraColors.textPrimary,
  );

  static const TextStyle bodyLarge = TextStyle(
    fontSize: 16,
    fontWeight: FontWeight.w400,
    color: NexoraColors.textPrimary,
  );

  static const TextStyle bodyMedium = TextStyle(
    fontSize: 14,
    fontWeight: FontWeight.w400,
    color: NexoraColors.textPrimary,
  );

  static const TextStyle labelMedium = TextStyle(
    fontSize: 12,
    fontWeight: FontWeight.w500,
    color: NexoraColors.textMuted,
    letterSpacing: 0.3,
  );
}

/// Builds the canonical NEXORA [ThemeData] (light only).
ThemeData buildNexoraTheme() {
  const ColorScheme colorScheme = ColorScheme.light(
    primary: NexoraColors.primary,
    secondary: NexoraColors.secondary,
    error: NexoraColors.critical,
    surface: NexoraColors.background,
    onPrimary: Colors.white,
    onSecondary: Colors.white,
    onSurface: NexoraColors.textPrimary,
    onError: Colors.white,
    outline: NexoraColors.border,
  );

  return ThemeData(
    useMaterial3: true,
    colorScheme: colorScheme,
    scaffoldBackgroundColor: NexoraColors.background,
    cardColor: NexoraColors.card,
    dividerColor: NexoraColors.border,
    // AppBar
    appBarTheme: const AppBarTheme(
      backgroundColor: NexoraColors.background,
      foregroundColor: NexoraColors.textPrimary,
      elevation: 0,
      scrolledUnderElevation: 1,
      surfaceTintColor: Colors.transparent,
      titleTextStyle: NexoraTextStyles.titleLarge,
    ),
    // Cards
    cardTheme: CardThemeData(
      color: NexoraColors.card,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: const BorderSide(color: NexoraColors.border),
      ),
    ),
    // Filled + Outlined buttons
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: NexoraColors.primary,
        foregroundColor: Colors.white,
        minimumSize: const Size(double.infinity, 48),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        textStyle: const TextStyle(
          fontSize: 16,
          fontWeight: FontWeight.w600,
        ),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: NexoraColors.primary,
        side: const BorderSide(color: NexoraColors.border),
        minimumSize: const Size(double.infinity, 48),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    ),
    // Input fields
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: NexoraColors.card,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: NexoraColors.border),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: NexoraColors.border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: NexoraColors.primary, width: 2),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: NexoraColors.critical),
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      hintStyle: const TextStyle(color: NexoraColors.textMuted, fontSize: 14),
    ),
    textTheme: const TextTheme(
      headlineLarge: NexoraTextStyles.headlineLarge,
      headlineMedium: NexoraTextStyles.headlineMedium,
      titleLarge: NexoraTextStyles.titleLarge,
      bodyLarge: NexoraTextStyles.bodyLarge,
      bodyMedium: NexoraTextStyles.bodyMedium,
      labelMedium: NexoraTextStyles.labelMedium,
    ),
  );
}
