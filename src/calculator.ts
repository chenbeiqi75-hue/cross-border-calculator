import type { Bank, FormInputs, CalculationResult, TransferDirection, LockMode } from './types'

/** 银行费用明细 */
export interface FeeBreakdown {
  rateLabel: string        // "3.0% 加点"
  feePercentLabel: string  // "0.1%"
  telegraphFeeCNY: number
  totalFeeCNY: number
  /** 当锁定到账金额时，需要汇出的金额 */
  requiredSendAmount?: number
  /** 当锁定到账金额时，对应的标签 */
  sendLabel?: string
}

/**
 * 计算各家银行：正向（给定汇出金额算到账）或反向（给定到账金额算需要汇多少）
 */
export function calculateAll(
  banks: Bank[],
  midRate: number,
  inputs: FormInputs,
  direction: TransferDirection,
  lockMode: LockMode,
): { result: CalculationResult; fee: FeeBreakdown }[] {
  const { amount, toCurrency } = inputs

  const results = banks
    .filter(b => b.rates[toCurrency]?.supported)
    .map(b => {
      const rate = b.rates[toCurrency]
      const bankRate = midRate * (1 + rate.spreadPercent / 100)

      if (lockMode === 'sendAmount') {
        // 正向：amount 是汇出金额，算到账
        return forwardCalculate(b, bankRate, amount, direction, rate)
      } else {
        // 反向：amount 是目标到账金额，算需要汇多少
        return reverseCalculate(b, bankRate, amount, direction, rate)
      }
    })

  // 判断最优：正向看最高到账，反向看最少需汇
  const bestVal = Math[lockMode === 'sendAmount' ? 'max' : 'min'](
    ...results.map(r => {
      const val = lockMode === 'sendAmount'
        ? r.result.receivedAmount
        : (r.fee.requiredSendAmount ?? 0)
      return val
    }),
  )

  results.forEach(r => {
    const val = lockMode === 'sendAmount'
      ? r.result.receivedAmount
      : (r.fee.requiredSendAmount ?? 0)
    r.result.isBest = val === bestVal
  })

  // 正向：按到账降序；反向：按需汇升序（越少越好）
  results.sort((a, b) => {
    if (lockMode === 'sendAmount') {
      return b.result.receivedAmount - a.result.receivedAmount
    }
    return (a.fee.requiredSendAmount ?? 0) - (b.fee.requiredSendAmount ?? 0)
  })
  return results
}

function forwardCalculate(
  bank: Bank,
  bankRate: number,
  amount: number,
  direction: TransferDirection,
  rate: import('./types').BankRate,
): { result: CalculationResult; fee: FeeBreakdown } {
  let totalFeeCNY: number
  let receivedAmount: number

  if (direction === 'send') {
    // 汇款出去：手续费 + 电报费 从人民币里扣
    totalFeeCNY = amount * rate.feePercent + rate.feeFixedCNY + rate.telegraphFeeCNY
    const amountAfterFee = Math.max(0, amount - totalFeeCNY)
    receivedAmount = amountAfterFee / bankRate
  } else {
    // 汇回国内：手续费 + 电报费 从外币里扣
    const feeInForeign = amount * rate.feePercent
      + (rate.feeFixedCNY + rate.telegraphFeeCNY) / bankRate
    const amountAfterFee = Math.max(0, amount - feeInForeign)
    receivedAmount = amountAfterFee * bankRate
    totalFeeCNY = feeInForeign * bankRate
  }

  const calcResult: CalculationResult = {
    bankId: bank.id,
    bankName: bank.name,
    midRate: bankRate / (1 + rate.spreadPercent / 100),
    bankRate,
    totalFeeCNY: Math.max(0, totalFeeCNY),
    receivedAmount: Math.max(0, receivedAmount),
    isBest: false,
    savedComparedToWorst: 0,
  }

  return {
    result: calcResult,
    fee: {
      rateLabel: `${rate.spreadPercent.toFixed(1)}% 加点`,
      feePercentLabel: `${(rate.feePercent * 100).toFixed(2)}%`,
      telegraphFeeCNY: rate.telegraphFeeCNY,
      totalFeeCNY: Math.max(0, totalFeeCNY),
    },
  }
}

function reverseCalculate(
  bank: Bank,
  bankRate: number,
  target: number,
  direction: TransferDirection,
  rate: import('./types').BankRate,
): { result: CalculationResult; fee: FeeBreakdown } {
  const fixedFeesCNY = rate.feeFixedCNY + rate.telegraphFeeCNY

  let requiredSend: number
  let totalFeeCNY: number

  if (direction === 'send') {
    // 汇款出去：目标 = 收到 target 外币
    // requiredSend * (1 - feePercent) - fixedFees = target * bankRate
    requiredSend = (target * bankRate + fixedFeesCNY) / (1 - rate.feePercent)
    totalFeeCNY = requiredSend * rate.feePercent + fixedFeesCNY
  } else {
    // 汇回国内：目标 = 收到 target 人民币
    // requiredSend * bankRate * (1 - feePercent) - fixedFees = target
    requiredSend = (target + fixedFeesCNY) / (bankRate * (1 - rate.feePercent))
    totalFeeCNY = requiredSend * rate.feePercent + fixedFeesCNY
  }

  const calcResult: CalculationResult = {
    bankId: bank.id,
    bankName: bank.name,
    midRate: bankRate / (1 + rate.spreadPercent / 100),
    bankRate,
    totalFeeCNY: Math.max(0, totalFeeCNY),
    receivedAmount: target,
    isBest: false,
    savedComparedToWorst: 0,
  }

  return {
    result: calcResult,
    fee: {
      rateLabel: `${rate.spreadPercent.toFixed(1)}% 加点`,
      feePercentLabel: `${(rate.feePercent * 100).toFixed(2)}%`,
      telegraphFeeCNY: rate.telegraphFeeCNY,
      totalFeeCNY: Math.max(0, totalFeeCNY),
      requiredSendAmount: Math.max(0, requiredSend),
    },
  }
}