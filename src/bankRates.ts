/**
 * 各银行跨境汇款费率默认配置
 *
 * 数据说明（仅供参考，实际费率可能有变动）：
 * - spreadPercent: 银行在中间价基础上的加点比例（如 2% = 比中间价贵 2%）
 * - feePercent: 按汇款金额收取的手续费比例
 * - feeFixedCNY: 每笔固定手续费（该金额已包含在总量计算中）
 * - telegraphFeeCNY: 电报费/电讯费
 *
 * 用户可以自由编辑这些值以匹配实际情况。
 */
import type { Bank, BankRate } from './types'

/** 为所有币种生成通用费率，默认相同 */
function defaultRate(
  spreadPercent: number,
  feePercent: number,
  feeFixedCNY: number,
  telegraphFeeCNY: number,
  supportedCurrencies: string[],
): Record<string, BankRate> {
  const rates: Record<string, BankRate> = {}
  for (const code of supportedCurrencies) {
    rates[code] = {
      spreadPercent,
      feePercent,
      feeFixedCNY,
      telegraphFeeCNY,
      supported: true,
    }
  }
  return rates
}

const ALL_CURRENCIES = ['USD', 'HKD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'SGD', 'KRW', 'THB']

export const DEFAULT_BANKS: Bank[] = [
  {
    id: 'boc',
    name: '中国银行',
    rates: defaultRate(2.0, 0.001, 0, 150, ALL_CURRENCIES),
  },
  {
    id: 'icbc',
    name: '工商银行',
    rates: defaultRate(2.5, 0.001, 0, 100, ALL_CURRENCIES),
  },
  {
    id: 'ccb',
    name: '建设银行',
    rates: defaultRate(2.0, 0.001, 0, 80, ALL_CURRENCIES),
  },
  {
    id: 'cmb',
    name: '招商银行',
    rates: defaultRate(3.0, 0.001, 0, 150, ALL_CURRENCIES),
  },
  {
    id: 'abc',
    name: '农业银行',
    rates: defaultRate(2.0, 0.001, 0, 80, ALL_CURRENCIES),
  },
  {
    id: 'bcm',
    name: '交通银行',
    rates: defaultRate(2.0, 0.001, 0, 150, ALL_CURRENCIES),
  },
  {
    id: 'spdb',
    name: '浦发银行',
    rates: defaultRate(2.5, 0.001, 0, 80, ALL_CURRENCIES),
  },
]