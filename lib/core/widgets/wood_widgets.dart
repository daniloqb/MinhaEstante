import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

/// Fundo com textura procedural de veios de madeira
class WoodBackground extends StatelessWidget {
  final Widget child;

  const WoodBackground({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: EstanteColors.madeiraMedia,
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            EstanteColors.madeiraMedia,
            EstanteColors.madeiraEscura,
            EstanteColors.madeiraMedia,
          ],
        ),
      ),
      child: CustomPaint(
        painter: WoodGrainPainter(),
        child: child,
      ),
    );
  }
}

class WoodGrainPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.black.withOpacity(0.04)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5;

    final highlightPaint = Paint()
      ..color = EstanteColors.douradoLatao.withOpacity(0.015)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 0.8;

    double x = 0;
    int i = 0;
    while (x < size.width + 50) {
      final path = Path();
      path.moveTo(x, 0);
      final wave = (i % 2 == 0) ? 8.0 : -8.0;
      path.cubicTo(
        x + wave,
        size.height * 0.33,
        x - wave,
        size.height * 0.66,
        x + (wave * 0.5),
        size.height,
      );

      canvas.drawPath(path, paint);
      canvas.drawPath(path, highlightPaint);
      x += 32.0 + ((i * 13) % 17);
      i++;
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

/// Prateleira de madeira 3D com brilho superior e sombra projetada
class Shelf extends StatelessWidget {
  final double height;
  final String? label;
  final String? sublabel;

  const Shelf({
    super.key,
    this.height = 16.0,
    this.label,
    this.sublabel,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (label != null)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  label!,
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        color: EstanteColors.douradoLatao,
                        fontWeight: FontWeight.bold,
                      ),
                ),
                if (sublabel != null)
                  Text(
                    sublabel!,
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          color: EstanteColors.textoSecundarioSobreMadeira,
                        ),
                  ),
              ],
            ),
          ),
        Container(
          height: height,
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [
                EstanteColors.prateleiraBrilho,
                EstanteColors.prateleira,
                EstanteColors.madeiraEscura,
              ],
            ),
            border: Border(
              top: BorderSide(color: Color(0x66E8C98A), width: 1.5),
            ),
          ),
        ),
        Container(
          height: 8,
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [
                Color(0xB31E110A),
                Colors.transparent,
              ],
            ),
          ),
        ),
      ],
    );
  }
}

/// Cartão de Papel Envelhecido
class PaperCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;
  final VoidCallback? onTap;

  const PaperCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(14.0),
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    Widget card = Container(
      decoration: BoxDecoration(
        color: EstanteColors.papelSuperficie,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: EstanteColors.fileteBorda.withOpacity(0.35)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x33000000),
            blurRadius: 6,
            offset: Offset(0, 3),
          )
        ],
      ),
      padding: padding,
      child: child,
    );

    if (onTap != null) {
      return InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: card,
      );
    }
    return card;
  }
}

/// Seletor de Avaliação em Estrelas (0 a 10)
class StarRating extends StatelessWidget {
  final int? rating;
  final ValueChanged<int?>? onRatingChanged;
  final double size;
  final bool isOnWood;

  const StarRating({
    super.key,
    required this.rating,
    this.onRatingChanged,
    this.size = 20.0,
    this.isOnWood = false,
  });

  @override
  Widget build(BuildContext context) {
    final activeColor = isOnWood ? EstanteColors.estrelasMadeira : EstanteColors.estrelasPapel;
    final inactiveColor = isOnWood ? Colors.white24 : const Color(0xFFC7B39B);

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          mainAxisSize: MainAxisSize.min,
          children: List.generate(10, (index) {
            final starNumber = index + 1;
            final isFilled = rating != null && rating! >= starNumber;
            return GestureDetector(
              onTap: onRatingChanged != null
                  ? () => onRatingChanged!(rating == starNumber ? null : starNumber)
                  : null,
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 1),
                child: Icon(
                  isFilled ? Icons.star : Icons.star_border,
                  size: size,
                  color: isFilled ? activeColor : inactiveColor,
                ),
              ),
            );
          }),
        ),
        const SizedBox(width: 8),
        Text(
          rating != null ? '$rating/10' : 'Sem nota',
          style: TextStyle(
            fontWeight: FontWeight.w600,
            fontSize: 14,
            color: isOnWood ? EstanteColors.textoSobreMadeira : EstanteColors.textoSobrePapel,
          ),
        ),
      ],
    );
  }
}
