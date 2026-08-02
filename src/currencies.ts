import type { Currency } from './types'

export const currencies: Currency[] = [
  { code: 'CNY', name: '人民币', symbol: '¥' },
  { code: 'USD', name: '美元', symbol: '$' },
  { code: 'HKD', name: '港币', symbol: 'HK$' },
  { code: 'EUR', name: '欧元', symbol: '€' },
  { code: 'GBP', name: '英镑', symbol: '£' },
  { code: 'JPY', name: '日元', symbol: '¥' },
  { code: 'AUD', name: '澳元', symbol: 'A$' },
  { code: 'CAD', name: '加元', symbol: 'C$' },
  { code: 'CHF', name: '瑞士法郎', symbol: 'Fr' },
  { code: 'SGD', name: '新加坡元', symbol: 'S$' },
  { code: 'KRW', name: '韩元', symbol: '₩' },
  { code: 'THB', name: '泰铢', symbol: '฿' },
]

export function getCurrencySymbol(code: string): string {
  return currencies.find(c => c.code === code)?.symbol ?? code
}

export function getCurrencyName(code: string): string {
  return currencies.find(c => c.code === code)?.name ?? code
}