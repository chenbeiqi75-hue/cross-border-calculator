import type { Bank, FormInputs, CalculationResult, TransferDirection, LockMode, BankRate } from './types'

/** 银行费用明细（用于 UI 展示） */
export interface FeeBreakdown {
  rateLabel: string
  feeMinMaxLabel: string
  telegraphFeeCNY: number
  totalFeeCNY: number
  /** 锁定到账金额模式：需要汇出多少（转出端货币单位） */
  requiredSendAmount?: number
}

/**
 * 计算每家银行的汇兑结果
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
      // 银行加点：客户汇率比中间价差
      const bankRate = midRate / (1 + rate.spreadPercent / 100)

      if (lockMode === 'sendAmount') {
        return forwardCalc(b.id, b.name, bankRate, midRate, amount, direction, rate)
      }
      return reverseCalc(b.id, b.name, bankRate, midRate, amount, direction, rate)
    })

  // 最优判定
  const bestFn = lockMode === 'sendAmount' ? Math.max : Math.min
  const bestVal = bestFn(...results.map(r =>
    lockMode === 'sendAmount'
      ? r.result.receivedAmount
      : (r.fee.requiredSendAmount ?? Infinity),
  ))

  results.forEach(r => {
    const val = lockMode === 'sendAmount'
      ? r.result.receivedAmount
      : (r.fee.requiredSendAmount ?? Infinity)
    r.result.isBest = val === bestVal
  })

  // 正向：到账降序；反向：需汇升序
  results.sort((a, b) =>
    lockMode === 'sendAmount'
      ? b.result.receivedAmount - a.result.receivedAmount
      : (a.fee.requiredSendAmount ?? Infinity) - (b.fee.requiredSendAmount ?? Infinity),
  )

  return results
}

/**
 * 计算手续费（CNY 等值，含 min/max 限额）
 *
 * @param amount 正向：转出端金额（send=CNY, receive=外币）；反向：估算的需汇金额
 * @param direction 方向
 */
function calcFeeCNY(
  amount: number,
  bankRate: number,
  rate: BankRate,
  direction: TransferDirection,
): { feeAmountCNY: number; telegraphCNY: number; totalCNY: number } {
  // 统一转为 CNY 等值，用于手续费计算和限额约束
  const amountCNY = direction === 'send' ? amount : amount * bankRate

  let feeAmountCNY = amountCNY * rate.feePercent
  if (rate.feeMinCNY > 0) feeAmountCNY = Math.max(rate.feeMinCNY, feeAmountCNY)
  if (rate.feeMaxCNY > 0) feeAmountCNY = Math.min(rate.feeMaxCNY, feeAmountCNY)

  return {
    feeAmountCNY,
    telegraphCNY: rate.telegraphFeeCNY,
    totalCNY: feeAmountCNY + rate.telegraphFeeCNY,
  }
}

function forwardCalc(
  bankId: string,
  bankName: string,
  bankRate: number,
  midRate: number,
  amount: number,
  direction: TransferDirection,
  rate: BankRate,
): { result: CalculationResult; fee: FeeBreakdown } {
  const feeCNY = calcFeeCNY(amount, bankRate, rate, direction)

  let receivedAmount: number

  if (direction === 'send') {
    if (rate.deductFromForeign) {
      // 农行模式：费用从外币扣
      const foreignAmount = amount * bankRate
      receivedAmount = Math.max(0, foreignAmount - feeCNY.totalCNY / bankRate)
    } else {
      // 普通模式：费用从人民币扣
      receivedAmount = Math.max(0, amount - feeCNY.totalCNY) * bankRate
    }
  } else {
    // 汇回国内：费用从外币扣
    receivedAmount = Math.max(0, amount - feeCNY.totalCNY / bankRate) * bankRate
  }

  return {
    result: {
      bankId, bankName, midRate, bankRate,
      totalFeeCNY: feeCNY.totalCNY, receivedAmount,
      isBest: false, savedComparedToWorst: 0,
    },
    fee: feeBreakdown(rate, feeCNY),
  }
}

function reverseCalc(
  bankId: string,
  bankName: string,
  bankRate: number,
  midRate: number,
  target: number,
  direction: TransferDirection,
  rate: BankRate,
): { result: CalculationResult; fee: FeeBreakdown } {
  // target: 用户希望到账的金额（目标币种）
  // 需要反向推导：所需汇出金额（转出端货币单位）

  let requiredSend: number

  if (direction === 'send') {
    // 目标：收到 target 外币
    if (rate.deductFromForeign) {
      // 农行模式：target = sendForeign - feeForeign
      // sendForeign = target + feeForeign = target + feeCNY / bankRate
      // feeCNY 依赖 sendCNY = sendForeign / bankRate
      // 迭代一次
      const estSendCNY = (target + rate.telegraphFeeCNY / bankRate) / bankRate / (1 - rate.feePercent)
      const fee = calcFeeCNY(estSendCNY, bankRate, rate, direction)
      requiredSend = (target + fee.totalCNY / bankRate) / bankRate
      // 用更准确的金额重算一次
      const exactFee = calcFeeCNY(requiredSend, bankRate, rate, direction)
      requiredSend = (target + exactFee.totalCNY / bankRate) / bankRate
    } else {
      // 普通模式：target = (requiredCNY - feeCNY) * bankRate
      const estSend = target / bankRate
      const fee = calcFeeCNY(estSend, bankRate, rate, direction)
      requiredSend = target / bankRate + fee.totalCNY
      const exactFee = calcFeeCNY(requiredSend, bankRate, rate, direction)
      requiredSend = target / bankRate + exactFee.totalCNY
    }

    const finalFee = calcFeeCNY(requiredSend, bankRate, rate, direction)
    return {
      result: {
        bankId, bankName, midRate, bankRate,
        totalFeeCNY: finalFee.totalCNY, receivedAmount: target,
        isBest: false, savedComparedToWorst: 0,
      },
      fee: { ...feeBreakdown(rate, finalFee), requiredSendAmount: Math.max(0, requiredSend) },
    }
  } else {
    // 目标：收到 target CNY（汇回国内）
    // target = (requiredForeign - feeForeign) * bankRate
    const estForeign = target / bankRate
    const fee = calcFeeCNY(estForeign, bankRate, rate, direction)
    requiredSend = target / bankRate + fee.totalCNY / bankRate
    const exactFee = calcFeeCNY(requiredSend, bankRate, rate, direction)
    requiredSend = target / bankRate + exactFee.totalCNY / bankRate

    const finalFee = calcFeeCNY(requiredSend, bankRate, rate, direction)
    return {
      result: {
        bankId, bankName, midRate, bankRate,
        totalFeeCNY: finalFee.totalCNY, receivedAmount: target,
        isBest: false, savedComparedToWorst: 0,
      },
      fee: { ...feeBreakdown(rate, finalFee), requiredSendAmount: Math.max(0, requiredSend) },
    }
  }
}

function feeBreakdown(
  rate: BankRate,
  fee: { feeAmountCNY: number; telegraphCNY: number; totalCNY: number },
): FeeBreakdown {
  const capStr = rate.feeMinCNY > 0 || rate.feeMaxCNY > 0
    ? `（最低¥${rate.feeMinCNY}/最高¥${rate.feeMaxCNY > 0 ? rate.feeMaxCNY : '无'})`
    : ''
  return {
    rateLabel: `${rate.spreadPercent.toFixed(1)}% 加点`,
    feeMinMaxLabel: `${(rate.feePercent * 100).toFixed(2)}%${capStr}`,
    telegraphFeeCNY: rate.telegraphFeeCNY,
    totalFeeCNY: fee.totalCNY,
  }
}