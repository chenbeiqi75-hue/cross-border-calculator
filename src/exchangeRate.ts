/**
 * 免费汇率 API 接入
 *
 * 使用 exchangerate-api.com 的免费 API：
 * https://open.er-api.com/v6/latest/{base}
 * 无需 API Key，支持所有主流币种
 */

export interface ExchangeRateData {
  base: string
  rates: Record<string, number>
  updatedAt: string
}

/** 币种对，key = "FROM_TO" */
const cache = new Map<string, ExchangeRateData>()
const CACHE_TTL = 60 * 60 * 1000 // 1 小时缓存

/**
 * 获取所有币种相对 base 的汇率
 */
export async function fetchRates(base: string): Promise<ExchangeRateData | null> {
  const cacheKey = base
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - new Date(cached.updatedAt).getTime() < CACHE_TTL) {
    return cached
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
    cache.set(cacheKey, data)
    return data
  } catch (err) {
    console.error('汇率 API 请求失败:', err)
    return null
  }
}

/**
 * 获取两种币种间的中间价（间接通过 USD 转换）
 * 因为免费 API 只能以单一币种为 base，我们用 USD 做桥
 */
export async function getMidRate(from: string, to: string): Promise<number | null> {
  if (from === to) return 1

  // 直接从 USD 的 rates 中获取
  const usdRates = await fetchRates('USD')
  if (!usdRates) return null

  const fromToUsd = from === 'USD' ? 1 : (1 / (usdRates.rates[from] ?? 1))
  const usdToTarget = to === 'USD' ? 1 : (usdRates.rates[to] ?? 1)

  return fromToUsd * usdToTarget
}