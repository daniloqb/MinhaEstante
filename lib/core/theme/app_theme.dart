import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Cores canônicas da identidade visual da biblioteca clássica "Minha Estante"
class EstanteColors {
  // Paleta Nogueira Escura (Padrão)
  static const Color madeiraEscura = Color(0xFF2E1A0F); // App bar, navegação
  static const Color madeiraMedia = Color(0xFF4A2C1A);  // Fundo principal
  static const Color prateleira = Color(0xFF7A4A2A);     // Madeira da prateleira
  static const Color prateleiraBrilho = Color(0xFFA0683D);
  static const Color prateleiraSombra = Color(0xFF1E110A);
  static const Color fileteBorda = Color(0xFF8B5A33);   // Filetes e molduras

  static const Color douradoLatao = Color(0xFFE8C98A);  // Primária
  static const Color textoSobreDourado = Color(0xFF2E1A0F);

  static const Color papelSuperficie = Color(0xFFF3E6CF); // Cartão papel envelhecido
  static const Color papelSuperficieElevada = Color(0xFFFAF1DF);
  static const Color papelBorda = Color(0xFFDCC8A7);

  static const Color textoSobreMadeira = Color(0xFFF5E9D6);
  static const Color textoSecundarioSobreMadeira = Color(0xFFD9C3A0);

  static const Color textoSobrePapel = Color(0xFF2E1A0F);
  static const Color textoSecundarioSobrePapel = Color(0xFF5C4030);

  static const Color estrelasPapel = Color(0xFF8A4B12);
  static const Color estrelasMadeira = Color(0xFFE8C98A);

  static const Color erroRustico = Color(0xFFE07A5F);

  // Paleta Carvalho Claro (Tema alternativo nas configurações)
  static const Color carvalhoFundo = Color(0xFFEFE4D2);
  static const Color carvalhoMedio = Color(0xFFC8A27A);
  static const Color carvalhoEscuro = Color(0xFFA67C52);
  static const Color carvalhoPrateleira = Color(0xFFB5895D);
}

/// Extensão de tema para acessar cores personalizadas de madeira e papel diretamente via Theme.of(context)
class WoodThemeExtension extends ThemeExtension<WoodThemeExtension> {
  final Color madeiraEscura;
  final Color madeiraMedia;
  final Color prateleira;
  final Color fileteBorda;
  final Color douradoLatao;
  final Color papelSuperficie;
  final Color papelSuperficieElevada;
  final Color textoSobreMadeira;
  final Color textoSecundarioSobreMadeira;
  final Color textoSobrePapel;
  final Color textoSecundarioSobrePapel;
  final Color estrelasPapel;
  final Color estrelasMadeira;
  final bool isCarvalhoClaro;

  const WoodThemeExtension({
    required this.madeiraEscura,
    required this.madeiraMedia,
    required this.prateleira,
    required this.fileteBorda,
    required this.douradoLatao,
    required this.papelSuperficie,
    required this.papelSuperficieElevada,
    required this.textoSobreMadeira,
    required this.textoSecundarioSobreMadeira,
    required this.textoSobrePapel,
    required this.textoSecundarioSobrePapel,
    required this.estrelasPapel,
    required this.estrelasMadeira,
    this.isCarvalhoClaro = false,
  });

  static const nogueira = WoodThemeExtension(
    madeiraEscura: EstanteColors.madeiraEscura,
    madeiraMedia: EstanteColors.madeiraMedia,
    prateleira: EstanteColors.prateleira,
    fileteBorda: EstanteColors.fileteBorda,
    douradoLatao: EstanteColors.douradoLatao,
    papelSuperficie: EstanteColors.papelSuperficie,
    papelSuperficieElevada: EstanteColors.papelSuperficieElevada,
    textoSobreMadeira: EstanteColors.textoSobreMadeira,
    textoSecundarioSobreMadeira: EstanteColors.textoSecundarioSobreMadeira,
    textoSobrePapel: EstanteColors.textoSobrePapel,
    textoSecundarioSobrePapel: EstanteColors.textoSecundarioSobrePapel,
    estrelasPapel: EstanteColors.estrelasPapel,
    estrelasMadeira: EstanteColors.estrelasMadeira,
    isCarvalhoClaro: false,
  );

  static const carvalhoClaro = WoodThemeExtension(
    madeiraEscura: EstanteColors.carvalhoEscuro,
    madeiraMedia: EstanteColors.carvalhoFundo,
    prateleira: EstanteColors.carvalhoPrateleira,
    fileteBorda: EstanteColors.carvalhoMedio,
    douradoLatao: EstanteColors.carvalhoEscuro,
    papelSuperficie: EstanteColors.papelSuperficieElevada,
    papelSuperficieElevada: Colors.white,
    textoSobreMadeira: EstanteColors.madeiraEscura,
    textoSecundarioSobreMadeira: EstanteColors.textoSecundarioSobrePapel,
    textoSobrePapel: EstanteColors.madeiraEscura,
    textoSecundarioSobrePapel: EstanteColors.textoSecundarioSobrePapel,
    estrelasPapel: EstanteColors.estrelasPapel,
    estrelasMadeira: EstanteColors.estrelasPapel,
    isCarvalhoClaro: true,
  );

  @override
  ThemeExtension<WoodThemeExtension> copyWith({
    Color? madeiraEscura,
    Color? madeiraMedia,
    Color? prateleira,
    Color? fileteBorda,
    Color? douradoLatao,
    Color? papelSuperficie,
    Color? papelSuperficieElevada,
    Color? textoSobreMadeira,
    Color? textoSecundarioSobreMadeira,
    Color? textoSobrePapel,
    Color? textoSecundarioSobrePapel,
    Color? estrelasPapel,
    Color? estrelasMadeira,
    bool? isCarvalhoClaro,
  }) {
    return WoodThemeExtension(
      madeiraEscura: madeiraEscura ?? this.madeiraEscura,
      madeiraMedia: madeiraMedia ?? this.madeiraMedia,
      prateleira: prateleira ?? this.prateleira,
      fileteBorda: fileteBorda ?? this.fileteBorda,
      douradoLatao: douradoLatao ?? this.douradoLatao,
      papelSuperficie: papelSuperficie ?? this.papelSuperficie,
      papelSuperficieElevada: papelSuperficieElevada ?? this.papelSuperficieElevada,
      textoSobreMadeira: textoSobreMadeira ?? this.textoSobreMadeira,
      textoSecundarioSobreMadeira: textoSecundarioSobreMadeira ?? this.textoSecundarioSobreMadeira,
      textoSobrePapel: textoSobrePapel ?? this.textoSobrePapel,
      textoSecundarioSobrePapel: textoSecundarioSobrePapel ?? this.textoSecundarioSobrePapel,
      estrelasPapel: estrelasPapel ?? this.estrelasPapel,
      estrelasMadeira: estrelasMadeira ?? this.estrelasMadeira,
      isCarvalhoClaro: isCarvalhoClaro ?? this.isCarvalhoClaro,
    );
  }

  @override
  ThemeExtension<WoodThemeExtension> lerp(
    covariant ThemeExtension<WoodThemeExtension>? other,
    double t,
  ) {
    if (other is! WoodThemeExtension) return this;
    return WoodThemeExtension(
      madeiraEscura: Color.lerp(madeiraEscura, other.madeiraEscura, t)!,
      madeiraMedia: Color.lerp(madeiraMedia, other.madeiraMedia, t)!,
      prateleira: Color.lerp(prateleira, other.prateleira, t)!,
      fileteBorda: Color.lerp(fileteBorda, other.fileteBorda, t)!,
      douradoLatao: Color.lerp(douradoLatao, other.douradoLatao, t)!,
      papelSuperficie: Color.lerp(papelSuperficie, other.papelSuperficie, t)!,
      papelSuperficieElevada: Color.lerp(papelSuperficieElevada, other.papelSuperficieElevada, t)!,
      textoSobreMadeira: Color.lerp(textoSobreMadeira, other.textoSobreMadeira, t)!,
      textoSecundarioSobreMadeira: Color.lerp(textoSecundarioSobreMadeira, other.textoSecundarioSobreMadeira, t)!,
      textoSobrePapel: Color.lerp(textoSobrePapel, other.textoSobrePapel, t)!,
      textoSecundarioSobrePapel: Color.lerp(textoSecundarioSobrePapel, other.textoSecundarioSobrePapel, t)!,
      estrelasPapel: Color.lerp(estrelasPapel, other.estrelasPapel, t)!,
      estrelasMadeira: Color.lerp(estrelasMadeira, other.estrelasMadeira, t)!,
      isCarvalhoClaro: t < 0.5 ? isCarvalhoClaro : other.isCarvalhoClaro,
    );
  }
}

/// Construtor de Temas do aplicativo
class AppTheme {
  static TextTheme _buildTextTheme() {
    return TextTheme(
      displayLarge: GoogleFonts.cormorantGaramond(
        fontSize = 40,
        fontWeight: FontWeight.w700,
        letterSpacing: 0,
      ),
      displayMedium: GoogleFonts.cormorantGaramond(
        fontSize = 32,
        fontWeight: FontWeight.w700,
      ),
      displaySmall: GoogleFonts.cormorantGaramond(
        fontSize = 26,
        fontWeight: FontWeight.w600,
      ),
      headlineLarge: GoogleFonts.cormorantGaramond(
        fontSize = 24,
        fontWeight: FontWeight.w700,
      ),
      headlineMedium: GoogleFonts.cormorantGaramond(
        fontSize = 20,
        fontWeight: FontWeight.w600,
      ),
      headlineSmall: GoogleFonts.cormorantGaramond(
        fontSize = 18,
        fontWeight: FontWeight.w600,
      ),
      titleLarge: GoogleFonts.cormorantGaramond(
        fontSize = 20,
        fontWeight: FontWeight.w700,
      ),
      titleMedium: GoogleFonts.cormorantGaramond(
        fontSize = 17,
        fontWeight: FontWeight.w600,
      ),
      titleSmall: GoogleFonts.cormorantGaramond(
        fontSize = 15,
        fontWeight: FontWeight.w600,
      ),
      bodyLarge: GoogleFonts.sourceSans3(
        fontSize = 16,
        fontWeight: FontWeight.w400,
        height: 1.5,
      ),
      bodyMedium: GoogleFonts.sourceSans3(
        fontSize = 14,
        fontWeight: FontWeight.w400,
        height: 1.4,
      ),
      bodySmall: GoogleFonts.sourceSans3(
        fontSize = 12,
        fontWeight: FontWeight.w400,
      ),
      labelLarge: GoogleFonts.sourceSans3(
        fontSize = 14,
        fontWeight: FontWeight.w600,
      ),
      labelMedium: GoogleFonts.sourceSans3(
        fontSize = 12,
        fontWeight: FontWeight.w600,
      ),
      labelSmall: GoogleFonts.sourceSans3(
        fontSize = 10,
        fontWeight: FontWeight.w600,
      ),
    );
  }

  /// Tema Principal: Nogueira Escura Clássica
  static ThemeData get nogueiraEscura {
    final textTheme = _buildTextTheme();

    final colorScheme = const ColorScheme(
      brightness: Brightness.dark,
      primary: EstanteColors.douradoLatao,
      onPrimary: EstanteColors.textoSobreDourado,
      primaryContainer: EstanteColors.fileteBorda,
      onPrimaryContainer: EstanteColors.douradoLatao,
      secondary: EstanteColors.douradoLatao,
      onSecondary: EstanteColors.textoSobreDourado,
      secondaryContainer: EstanteColors.prateleira,
      onSecondaryContainer: EstanteColors.textoSobreMadeira,
      surface: EstanteColors.papelSuperficie,
      onSurface: EstanteColors.textoSobrePapel,
      surfaceContainerHighest: EstanteColors.papelSuperficieElevada,
      onSurfaceVariant: EstanteColors.textoSecundarioSobrePapel,
      outline: EstanteColors.fileteBorda,
      outlineVariant: EstanteColors.papelBorda,
      error: EstanteColors.erroRustico,
      onError: Colors.white,
    );

    return ThemeData(
      useMaterial3: true,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: EstanteColors.madeiraMedia,
      textTheme: textTheme.apply(
        bodyColor: EstanteColors.textoSobrePapel,
        displayColor: EstanteColors.douradoLatao,
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: EstanteColors.madeiraEscura,
        foregroundColor: EstanteColors.douradoLatao,
        centerTitle: true,
        elevation: 0,
        titleTextStyle: GoogleFonts.cormorantGaramond(
          fontSize: 22,
          fontWeight: FontWeight.w700,
          color: EstanteColors.douradoLatao,
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: EstanteColors.madeiraEscura,
        indicatorColor: EstanteColors.douradoLatao,
        iconTheme: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return const IconThemeData(color: EstanteColors.textoSobreDourado);
          }
          return const IconThemeData(color: EstanteColors.textoSecundarioSobreMadeira);
        }),
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return GoogleFonts.cormorantGaramond(
              fontWeight: FontWeight.w700,
              fontSize: 13,
              color: EstanteColors.douradoLatao,
            );
          }
          return GoogleFonts.cormorantGaramond(
            fontWeight: FontWeight.w500,
            fontSize: 13,
            color: EstanteColors.textoSecundarioSobreMadeira,
          );
        }),
      ),
      floatingActionButtonTheme: const FloatingActionButtonThemeData(
        backgroundColor: EstanteColors.douradoLatao,
        foregroundColor: EstanteColors.textoSobreDourado,
        elevation: 6,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.all(Radius.circular(16))),
      ),
      cardTheme: const CardTheme(
        color: EstanteColors.papelSuperficie,
        elevation: 3,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.all(Radius.circular(10)),
          side: BorderSide(color: Color(0x558B5A33), width: 1),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: EstanteColors.papelSuperficie,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: EstanteColors.fileteBorda),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: EstanteColors.fileteBorda),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: EstanteColors.douradoLatao, width: 2),
        ),
        hintStyle: GoogleFonts.sourceSans3(color: EstanteColors.textoSecundarioSobrePapel),
        labelStyle: GoogleFonts.sourceSans3(color: EstanteColors.textoSecundarioSobrePapel),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: Colors.transparent,
        selectedColor: EstanteColors.douradoLatao,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(8),
          side: const BorderSide(color: EstanteColors.fileteBorda),
        ),
        labelStyle: GoogleFonts.sourceSans3(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          color: EstanteColors.textoSobreMadeira,
        ),
        secondaryLabelStyle: GoogleFonts.sourceSans3(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          color: EstanteColors.textoSobreDourado,
        ),
      ),
      extensions: const [WoodThemeExtension.nogueira],
    );
  }

  /// Tema Secundário: Carvalho Claro
  static ThemeData get carvalhoClaro {
    final baseTheme = nogueiraEscura;
    return baseTheme.copyWith(
      scaffoldBackgroundColor: EstanteColors.carvalhoFundo,
      appBarTheme: baseTheme.appBarTheme.copyWith(
        backgroundColor: EstanteColors.carvalhoEscuro,
      ),
      navigationBarTheme: baseTheme.navigationBarTheme.copyWith(
        backgroundColor: EstanteColors.carvalhoEscuro,
      ),
      extensions: const [WoodThemeExtension.carvalhoClaro],
    );
  }
}
