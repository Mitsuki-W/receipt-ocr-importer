// カナダ東部時間（America/Toronto）用のユーティリティ関数

export const CANADA_EASTERN_TIMEZONE = 'America/Toronto'
export const CANADA_LOCALE = 'en-CA'

/**
 * 現在の日時をカナダ東部時間のISO文字列で取得
 */
export function getCurrentTorontoTime(): string {
  const now = new Date()
  // カナダ東部時間に変換してからISO文字列に変換
  const torontoTime = new Intl.DateTimeFormat('en-CA', {
    timeZone: CANADA_EASTERN_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(now)

  const year = torontoTime.find(part => part.type === 'year')?.value
  const month = torontoTime.find(part => part.type === 'month')?.value
  const day = torontoTime.find(part => part.type === 'day')?.value
  const hour = torontoTime.find(part => part.type === 'hour')?.value
  const minute = torontoTime.find(part => part.type === 'minute')?.value
  const second = torontoTime.find(part => part.type === 'second')?.value

  return `${year}-${month}-${day}T${hour}:${minute}:${second}.000Z`
}

/**
 * カナダ東部時間での今日の日付を YYYY-MM-DD 形式で取得
 */
export function getTodayInToronto(): string {
  const now = new Date()
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: CANADA_EASTERN_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(now)
}

/**
 * 日付文字列をカナダ東部時間でフォーマット
 */
export function formatDateTimeInToronto(dateString: string) {
  const date = new Date(dateString)
  return {
    date: date.toLocaleDateString(CANADA_LOCALE, { timeZone: CANADA_EASTERN_TIMEZONE }),
    time: date.toLocaleTimeString(CANADA_LOCALE, { 
      hour: '2-digit', 
      minute: '2-digit',
      timeZone: CANADA_EASTERN_TIMEZONE
    }),
    full: date.toLocaleString(CANADA_LOCALE, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: CANADA_EASTERN_TIMEZONE
    })
  }
}