const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: '₹',
  USD: '$',
  EUR: '€',
  GBP: '£',
  AUD: 'A$',
  CAD: 'C$',
  SGD: 'S$',
  AED: 'د.إ',
  JPY: '¥',
  CNY: '¥',
}

export function currencySymbol(code: string): string {
  return CURRENCY_SYMBOLS[code?.toUpperCase()] ?? code ?? '$'
}

export function fmtCurrency(n: number, symbol: string): string {
  if (n >= 1_000_000) return symbol + (n / 1_000_000).toFixed(2) + 'M'
  if (n >= 1_000)     return symbol + (n / 1_000).toFixed(1) + 'K'
  return symbol + n.toFixed(2)
}
