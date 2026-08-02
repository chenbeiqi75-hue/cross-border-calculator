import type { Bank, FormInputs, CalculationResult, TransferDirection, LockMode, BankRate } from './types'

/** 银行费用明细（用于 UI 展示） */
export interface FeeBreakdown {
  rateLabel: string
  feeMinMaxLabel: string
  telegraphFeeCNY: number
  totalFeeCNY: number
  /** 锁定到账金额模式：需要汇出多少 */
  requiredSendAmount?: number
}

/**
 * 计算每家银行的汇兑结果
 *
 * 汇率逻辑：
 *   midRate: 1 转出币种 = X 目标币种（中间价，无加点）
 *   bankRate = midRate / (1 + spreadPercent/100) — 银行加点，客户拿到更差汇率
 *
 * 费用逻辑：每个银行有两种方式
 *   deductFromForeign = false：费用从转出端扣（从人民币扣手续费+电报费）
 *   deductFromForeign = true：费用从目标端扣（农行模式，外汇里直接扣）
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
      const bankRate = midRate / (1 + rate.spreadPercent / 100)

      if (lockMode === 'sendAmount') {
        return forwardCalc(b, bankRate, midRate, amount, direction, rate)
      }
      return reverseCalc(b, bankRate, midRate, amount, direction, rate)
    })

  // 最优判定
  const bestFn = lockMode === 'sendAmount' ? Math.max : Math.min
  const bestVal = bestFn(
    ...results.map(r =>
      lockMode === 'sendAmount'
        ? r.result.receivedAmount
        : (r.fee.requiredSendAmount ?? Infinity),
    ),
  )

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

/** 根据金额和费率计算实际手续费（受最低/最高限额约束） */
function calcFeeCNY(amount: number, bankRate: number, rate: BankRate, direction: TransferDirection): {
  feeAmountCNY: number
  telegraphCNY: number
  totalCNY: number
} {
  let feeAmountCNY = amount * rate.feePercent

  // 如果费用从外币扣，把金额换算成人民币等值来算限额
  const amountCNY = rate.deductFromForeign
    ? (direction === 'send' ? amount * bankRate : amount / bankRate)
    : amount

  // 手续费受最低/最高限额约束（人民币等值）
  feeAmountCNY = amountCNY * rate.feePercent
  if (rate.feeMinCNY > 0) feeAmountCNY = Math.max(rate.feeMinCNY, feeAmountCNY)
  if (rate.feeMaxCNY > 0) feeAmountCNY = Math.min(rate.feeMaxCNY, feeAmountCNY)

  const telegraphCNY = rate.telegraphFeeCNY

  return {
    feeAmountCNY,
    telegraphCNY,
    totalCNY: feeAmountCNY + telegraphCNY,
  }
}

function forwardCalc(
  bank: Bank,
  bankRate: number,
  midRate: number,
  amount: number,
  direction: TransferDirection,
  rate: BankRate,
): { result: CalculationResult; fee: FeeBreakdown } {
  // amount: 用户输入的转出金额（send→CNY, receive→外币）
  // 先算费用（折合人民币），再根据 deductFromForeign 决定从哪边扣

  if (direction === 'send') {
    // 汇款出去：CNY → 外币
    if (rate.deductFromForeign) {
      // 农行模式：费用从外币扣（汇款币种收取）
      // 先把 amount（CNY）按 bankRate 换成外币，扣除费用后再换回 CNY 记录
      const foreignAmount = amount * bankRate  // 等值外币
      const feeCNY = calcFeeCNY(amount, bankRate, rate, direction)
      const feeForeign = feeCNY.totalCNY / bankRate
      const receivedAmount = Math.max(0, foreignAmount - feeForeign)
      return {
        result: {
          bankId: bank.id, bankName: bank.name, midRate, bankRate,
          totalFeeCNY: feeCNY.totalCNY,
          receivedAmount,
          isBest: false, savedComparedToWorst: 0,
        },
        fee: feeBreakdown(rate, feeCNY),
      }
    } else {
      // 普通模式：费用从人民币扣
      const feeCNY = calcFeeCNY(amount, bankRate, rate, direction)
      const amountAfterFee = Math.max(0, amount - feeCNY.totalCNY)
      const receivedAmount = amountAfterFee * bankRate
      return {
        result: {
          bankId: bank.id, bankName: bank.name, midRate, bankRate,
          totalFeeCNY: feeCNY.totalCNY,
          receivedAmount,
          isBest: false, savedComparedToWorst: 0,
        },
        fee: feeBreakdown(rate, feeCNY),
      }
    }
  } else {
    // 汇回国内：外币 → CNY
    // 费用一律从外币扣（外币端收手续费更常见）
    const feeCNY = calcFeeCNY(amount, bankRate, rate, direction)
    const feeForeign = feeCNY.totalCNY / bankRate
    const amountAfterFee = Math.max(0, amount - feeForeign)
    const receivedAmount = amountAfterFee * bankRate
    return {
      result: {
        bankId: bank.id, bankName: bank.name, midRate, bankRate,
        totalFeeCNY: feeCNY.totalCNY,
        receivedAmount,
        isBest: false, savedComparedToWorst: 0,
      },
      fee: feeBreakdown(rate, feeCNY),
    }
  }
}

function reverseCalc(
  bank: Bank,
  bankRate: number,
  midRate: number,
  target: number,
  direction: TransferDirection,
  rate: BankRate,
): { result: CalculationResult; fee: FeeBreakdown } {
  // target: 用户希望到账的金额
  // 需要反向推导：扣除费用之前需要汇出多少

  if (direction === 'send') {
    // 目标：收到 target 外币
    if (rate.deductFromForeign) {
      // 农行模式：target = 外币到账 = 汇出外币 - 费用外币
      // 汇出外币 = target + feeForeign
      // 汇出 CNY = (target + feeForeign) / bankRate
      // feeForeign = feeCNY / bankRate, feeCNY 又依赖汇出金额... 需要迭代
      // 简化：用 target 估算费用，再调整
      const feeCNY = calcFeeCNY(target / bankRate, bankRate, rate, direction)  // 粗略估算
      const feeForeign = feeCNY.totalCNY / bankRate
      const requiredForeign = target + feeForeign
      const requiredSend = requiredForeign / bankRate
      // 用准确的 requiredSend 重新算一次费用
      const exactFeeCNY = calcFeeCNY(requiredSend, bankRate, rate, direction)
      const exactFeeForeign = exactFeeCNY.totalCNY / bankRate
      const exactRequiredForeign = target + exactFeeForeign
      const exactRequiredSend = exactRequiredForeign / bankRate
      return {
        result: {
          bankId: bank.id, bankName: bank.name, midRate, bankRate,
          totalFeeCNY: exactFeeCNY.totalCNY,
          receivedAmount: target,
          isBest: false, savedComparedToWorst: 0,
        },
        fee: {
          ...feeBreakdown(rate, exactFeeCNY),
          requiredSendAmount: exactRequiredSend,
        },
      }
    } else {
      // 普通模式：target 外币 = (requiredCNY - feeCNY) * bankRate
      // requiredCNY = target / bankRate + feeCNY
      // feeCNY 依赖 requiredCNY... 用 target/bankRate 估算再调整
      const estSend = target / bankRate
      const feeCNY = calcFeeCNY(estSend, bankRate, rate, direction)
      const requiredSend = target / bankRate + feeCNY.totalCNY
      const exactFeeCNY = calcFeeCNY(requiredSend, bankRate, rate, direction)
      const exactRequiredSend = target / bankRate + exactFeeCNY.totalCNY
      return {
        result: {
          bankId: bank.id, bankName: bank.name, midRate, bankRate,
          totalFeeCNY: exactFeeCNY.totalCNY,
          receivedAmount: target,
          isBest: false, savedComparedToWorst: 0,
        },
        fee: {
          ...feeBreakdown(rate, exactFeeCNY),
          requiredSendAmount: exactRequiredSend,
        },
      }
    }
  } else {
    // 目标：收到 target CNY，汇回国内
    // target = (requiredForeign - feeForeign) * bankRate
    // feeForeign = feeCNY / bankRate
    // 估算
    const estForeign = target / bankRate
    const feeCNY = calcFeeCNY(estForeign, bankRate, rate, direction)
    const feeForeign = feeCNY.totalCNY / bankRate
    const requiredForeign = target / bankRate + feeForeign
    const exactFeeCNY = calcFeeCNY(requiredForeign, bankRate, rate, direction)
    const exactFeeForeign = exactFeeCNY.totalCNY / bankRate
    const exactRequiredForeign = target / bankRate + exactFeeForeign
    return {
      result: {
        bankId: bank.id, bankName: bank.name, midRate, bankRate,
        totalFeeCNY: exactFeeCNY.totalCNY,
        receivedAmount: target,
        isBest: false, savedComparedToWorst: 0,
      },
      fee: {
        ...feeBreakdown(rate, exactFeeCNY),
        requiredSendAmount: exactRequiredForeign,
      },
    }
  }
}

function feeBreakdown(rate: BankRate, feeCNY: { feeAmountCNY: number; telegraphCNY: number; totalCNY: number }): FeeBreakdown {
  const minMaxStr = rate.feeMinCNY > 0 || rate.feeMaxCNY > 0
    ? `（最低¥${rate.feeMinCNY}/最高¥${rate.feeMaxCNY > 0 ? rate.feeMaxCNY : '无'})`
    : ''
  return {
    rateLabel: `${rate.spreadPercent.toFixed(1)}% 加点`,
    feeMinMaxLabel: `${(rate.feePercent * 100).toFixed(2)}%${minMaxStr}`,
    telegraphFeeCNY: rate.telegraphFeeCNY,
    totalFeeCNY: feeCNY.totalCNY,
  }
}