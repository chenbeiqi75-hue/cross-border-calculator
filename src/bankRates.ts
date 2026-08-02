/**
 * 各银行跨境汇款费率配置（用户核实版）
 *
 * 数据来源：用户对各银行公开收费标准的核实
 *
 * 关于「汇率加点」的说明：
 * - 银行公开收费标准中不公布固定汇率加点
 * - 实际汇率成本 = 银行现汇卖出价 vs 市场中间价的每日差值
 * - 因此本配置中 markup 默认为 0，用户可在使用当天根据银行挂牌价自行调整
 * - 或者直接在计算器中输入银行现汇卖出价
 *
 * feeMinCNY / feeMaxCNY: 手续费人民币等值最低/最高限额（0=无上限）
 * deductFromForeign: true=费用以外币收取，false=以人民币收取
 */
import type { Bank } from './types'

const ALL_CURRENCIES = ['USD', 'HKD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'SGD', 'KRW', 'THB', 'CNY']

function defaultRates(
  feePercent: number,
  feeMinCNY: number,
  feeMaxCNY: number,
  telegraphFeeCNY: number,
  deductFromForeign: boolean,
): Record<string, { spreadPercent: number; feePercent: number; feeMinCNY: number; feeMaxCNY: number; telegraphFeeCNY: number; deductFromForeign: boolean; supported: boolean }> {
  const rates: Record<string, any> = {}
  for (const code of ALL_CURRENCIES) {
    rates[code] = {
      // 汇率加点默认为 0，用户根据当日银行挂牌价自行填写
      spreadPercent: 0,
      feePercent,
      feeMinCNY,
      feeMaxCNY,
      telegraphFeeCNY,
      deductFromForeign,
      supported: true,
    }
  }
  return rates
}

export const DEFAULT_BANKS: Bank[] = [
  {
    id: 'abc',
    name: '农业银行',
    rates: defaultRates(0.001, 20, 200, 80, true),
  },
  {
    id: 'boc',
    name: '中国银行',
    rates: defaultRates(0.001, 50, 260, 150, false),
  },
  {
    id: 'icbc',
    name: '工商银行',
    rates: defaultRates(0.001, 20, 200, 100, false),
  },
  {
    id: 'ccb',
    name: '建设银行',
    rates: defaultRates(0.001, 20, 300, 80, false),
  },
  {
    id: 'cmb',
    name: '招商银行',
    rates: defaultRates(0.001, 100, 1000, 150, false),
  },
  {
    id: 'bcm',
    name: '交通银行',
    rates: defaultRates(0.001, 20, 250, 150, false),
  },
  {
    id: 'spdb',
    name: '浦发银行',
    rates: defaultRates(0.001, 50, 250, 80, false),
  },
]