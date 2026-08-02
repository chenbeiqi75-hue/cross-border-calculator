import type { Bank, FormInputs, CalculationResult, TransferDirection } from './types'

/** 银行费用明细 */
export interface FeeBreakdown {
  rateLabel: string        // "3.0% 加点"
  feePercentLabel: string  // "0.1%"
  telegraphFeeCNY: number
  totalFeeCNY: number
}

/**
 * 计算每家银行的到账金额
 */
export function calculateAll(
  banks: Bank[],
  midRate: number,
  inputs: FormInputs,
  direction: TransferDirection,
): { result: CalculationResult; fee: FeeBreakdown }[] {
  const { amount, fromCurrency, toCurrency } = inputs

  const results = banks
    .filter(b => b.rates[toCurrency]?.supported)
    .map(b => {
      const calc = calculateOne(b, midRate, amount, fromCurrency, toCurrency, direction)
      const rate = b.rates[toCurrency]
      return {
        result: calc,
        fee: {
          rateLabel: `${rate.spreadPercent.toFixed(1)}% 加点`,
          feePercentLabel: `${(rate.feePercent * 100).toFixed(2)}%`,
          telegraphFeeCNY: rate.telegraphFeeCNY,
          totalFeeCNY: calc.totalFeeCNY,
        },
      }
    })

  const bestAmount = Math.max(...results.map(r => r.result.receivedAmount))
  const worstAmount = Math.min(...results.map(r => r.result.receivedAmount))

  results.forEach(r => {
    r.result.isBest = r.result.receivedAmount === bestAmount
    r.result.savedComparedToWorst = r.result.receivedAmount - worstAmount
  })

  results.sort((a, b) => b.result.receivedAmount - a.result.receivedAmount)
  return results
}

function calculateOne(
  bank: Bank,
  midRate: number,
  amount: number,
  _fromCurrency: string,
  toCurrency: string,
  direction: TransferDirection,
): CalculationResult {
  const rate = bank.rates[toCurrency]
  const bankRate = midRate * (1 + rate.spreadPercent / 100)

  let totalFeeCNY: number
  let receivedAmount: number

  if (direction === 'send') {
    // 汇款出去：手续费 + 电报费 从人民币里扣
    totalFeeCNY = amount * rate.feePercent + rate.feeFixedCNY + rate.telegraphFeeCNY
    const amountAfterFeeCNY = Math.max(0, amount - totalFeeCNY)
    receivedAmount = amountAfterFeeCNY / bankRate
  } else {
    // 汇回来：手续费 + 电报费 从外币里扣
    const feeInForeign = amount * rate.feePercent + rate.feeFixedCNY / bankRate + rate.telegraphFeeCNY / bankRate
    const amountAfterFeeForeign = Math.max(0, amount - feeInForeign)
    receivedAmount = amountAfterFeeForeign * bankRate
    totalFeeCNY = feeInForeign * bankRate
  }

  return {
    bankId: bank.id,
    bankName: bank.name,
    midRate,
    bankRate,
    totalFeeCNY: Math.max(0, totalFeeCNY),
    receivedAmount: Math.max(0, receivedAmount),
    isBest: false,
    savedComparedToWorst: 0,
  }
}