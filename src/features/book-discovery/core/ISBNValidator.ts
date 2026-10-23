/**
 * Remove hífens e espaços de formatação do ISBN
 */
export function cleanIsbnString(raw: string): string {
  return (raw || '').replace(/[-\s]/g, '').trim();
}

/**
 * Validação matemática do dígito verificador do ISBN-10 (módulo 11 com pesos 10..1)
 * Suporta o caractere 'X' ou 'x' que representa o valor 10 no último dígito.
 */
export function isValidIsbn10Checksum(clean: string): boolean {
  if (clean.length !== 10) return false;
  if (!/^[0-9]{9}[0-9Xx]$/.test(clean)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(clean[i], 10) * (10 - i);
  }
  const last = clean[9].toUpperCase();
  const checkDigit = last === 'X' ? 10 : parseInt(last, 10);
  sum += checkDigit;
  return sum % 11 === 0;
}

/**
 * Validação matemática do dígito verificador do ISBN-13 (módulo 10 com pesos alternados 1 e 3)
 */
export function isValidIsbn13Checksum(clean: string): boolean {
  if (clean.length !== 13) return false;
  if (!/^[0-9]{13}$/.test(clean)) return false;
  let sum = 0;
  for (let i = 0; i < 13; i++) {
    const digit = parseInt(clean[i], 10);
    sum += digit * (i % 2 === 0 ? 1 : 3);
  }
  return sum % 10 === 0;
}

/**
 * Converte matematicamente um ISBN-10 válido para ISBN-13 (prefixo 978)
 */
export function isbn10ToIsbn13(rawIsbn10: string): string | null {
  const clean = cleanIsbnString(rawIsbn10);
  if (!isValidIsbn10Checksum(clean)) return null;

  const core = '978' + clean.slice(0, 9);
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(core[i], 10);
    sum += digit * (i % 2 === 0 ? 1 : 3);
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return core + checkDigit;
}

/**
 * Identifica e valida matematicamente se o texto é um ISBN-10 ou ISBN-13 legítimo
 */
export function validateIsbn(raw: string): {
  isValid: boolean;
  cleanIsbn: string;
  type: 'isbn10' | 'isbn13' | null;
  isbn13?: string;
} {
  const clean = cleanIsbnString(raw);
  if (isValidIsbn13Checksum(clean)) {
    return { isValid: true, cleanIsbn: clean, type: 'isbn13', isbn13: clean };
  }
  if (isValidIsbn10Checksum(clean)) {
    const upper = clean.toUpperCase();
    const conv13 = isbn10ToIsbn13(upper);
    return { isValid: true, cleanIsbn: upper, type: 'isbn10', isbn13: conv13 || undefined };
  }
  return { isValid: false, cleanIsbn: clean, type: null };
}

/**
 * Verifica se dois códigos ISBN são equivalentes (ex: ISBN-10 e seu correspondente ISBN-13)
 */
export function areIsbnsEquivalent(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  const cleanA = cleanIsbnString(a).toUpperCase();
  const cleanB = cleanIsbnString(b).toUpperCase();
  if (cleanA === cleanB) return true;

  const valA = validateIsbn(cleanA);
  const valB = validateIsbn(cleanB);
  if (!valA.isValid || !valB.isValid) return false;

  const a13 = valA.type === 'isbn13' ? valA.cleanIsbn : valA.isbn13;
  const b13 = valB.type === 'isbn13' ? valB.cleanIsbn : valB.isbn13;
  return Boolean(a13 && b13 && a13 === b13);
}

/**
 * Verifica se a entrada tem aparência visual de código ISBN (mesmo com dígito verificador errado).
 */
export function looksLikeIsbn(raw: string): boolean {
  const clean = cleanIsbnString(raw);
  if (/^[0-9]{10,13}$/.test(clean)) return true;
  if (/^[0-9]{9}[0-9Xx]$/.test(clean)) return true;

  const trimmed = (raw || '').trim();
  const hyphenCount = (trimmed.match(/-/g) || []).length;
  if (hyphenCount >= 2 && clean.length >= 9 && clean.length <= 14 && /^[0-9Xx]+$/.test(clean)) {
    return true;
  }

  return false;
}
