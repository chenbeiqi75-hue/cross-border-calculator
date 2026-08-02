/**
 * 汇率 API 接入
 *
 * 使用 exchangerate-api.com 的免费 API：
 * https://open.er-api.com/v6/latest/{base}
 * 免费版无需 API Key，支持所有主流币种
 */

export interface ExchangeRateData {
  base: string
  rates: Record<string, number>
  updatedAt: string
}

/** 缓存，防止短时间内重复请求 */
let cachedData: { key: string; data: ExchangeRateData; timestamp: number } | null = null
const CACHE_TTL = 60 * 60 * 1000 // 1 小时

/**
 * 获取所有币种相对 base 的汇率
 */
export async function fetchRates(base: string): Promise<ExchangeRateData | null> {
  if (cachedData && cachedData.key === base && Date.now() - cachedData.timestamp < CACHE_TTL) {
    return cachedData.data
  }

  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${base}`)
    if (!res.ok) throw new Error(`API error: ${res.status}`)
    const json = await res.json()
    if (json.result !== 'success') throw new Error(`API result: ${json.result}`)

    const data: ExchangeRateData = {
      base: json.base_code,
      rates: json.rates,
      updatedAt: json.time_last_update_utc ?? new Date().toISOString(),
    }
    cachedData = { key: base, data, timestamp: Date.now() }
    return data
  } catch (err) {
    console.error('汇率 API 请求失败:', err)
    return null
  }
}

/**
 * 获取两种币种间的中间价（通过 USD 转换）
 */
export async function getMidRate(from: string, to: string): Promise<number | null> {
  if (from === to) return 1

  // 清除缓存，确保每次查询都请求最新汇率
  cachedData = null

  const usdRates = await fetchRates('USD')
  if (!usdRates) return null

  const fromToUsd = from === 'USD' ? 1 : (1 / (usdRates.rates[from] ?? 1))
  const usdToTarget = to === 'USD' ? 1 : (usdRates.rates[to] ?? 1)

  return fromToUsd * usdToTarget
}