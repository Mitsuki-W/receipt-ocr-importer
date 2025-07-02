import { ExtractedItem } from '@/types/ocr-patterns'
import { PATTERN_CONFIG, PRICE_PATTERNS } from './warehouse-pattern-definitions'

/**
 * パターンマッチングとバリデーション機能を提供するユーティリティクラス
 * 価格抽出、商品名検証、パターン検索などの共通処理を担当
 */
export class PatternValidationUtils {

  /**
   * 行から価格を抽出
   */
  static extractPriceFromLine(line: string): number | null {
    const cleanLine = line.trim()

    // 基本的な価格パターン
    const basicMatch = cleanLine.match(PRICE_PATTERNS.basic)
    if (basicMatch) {
      return parseInt(basicMatch[1])
    }

    // 税込み価格パターン
    const taxMatch = cleanLine.match(PRICE_PATTERNS.withTax)
    if (taxMatch) {
      return parseInt(taxMatch[1])
    }

    // ドル価格パターン
    const dollarMatch = cleanLine.match(PRICE_PATTERNS.dollar)
    if (dollarMatch) {
      return Math.round(parseFloat(dollarMatch[1]) * 150) // 仮レート
    }

    // 数量付き価格パターン
    const quantityMatch = cleanLine.match(PRICE_PATTERNS.withQuantity)
    if (quantityMatch) {
      return parseInt(quantityMatch[2])
    }

    return null
  }

  /**
   * 価格が含まれているかチェック
   */
  static containsPrice(line: string): boolean {
    return this.extractPriceFromLine(line) !== null
  }

  /**
   * 妥当な価格かチェック
   */
  static isValidPrice(price: number): boolean {
    const config = PATTERN_CONFIG.validation
    return price >= config.minPrice && price <= config.maxPrice
  }

  /**
   * 商品名として妥当かチェック
   */
  static isValidProductName(name: string): boolean {
    if (!name || typeof name !== 'string') return false

    const trimmed = name.trim()
    const config = PATTERN_CONFIG.validation

    // 長さチェック
    if (trimmed.length < config.minProductNameLength || 
        trimmed.length > config.maxProductNameLength) {
      return false
    }

    // 除外キーワードチェック
    const excludeKeywords = [
      ...PATTERN_CONFIG.exclusions.invalidLines,
      ...PATTERN_CONFIG.exclusions.excludeKeywords,
      'レシート', '領収書', '店舗', '住所', '電話', 'TEL', '営業時間',
      'ありがとう', 'またお越し', 'ポイント', 'カード', 'お預り', 'おつり',
      '売上', '対象額', '外税', '内税'
    ]

    if (excludeKeywords.some(keyword => trimmed.includes(keyword))) {
      return false
    }

    // 数字のみの場合は除外
    if (/^\d+$/.test(trimmed)) return false

    // 記号のみの場合は除外
    if (/^[^\w\s\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+$/.test(trimmed)) {
      return false
    }

    // 日本語、英語、数字のいずれかを含む
    return /[あ-んア-ンぁ-ゖa-zA-Z0-9ー・]/.test(trimmed)
  }

  /**
   * 商品名らしいかチェック（より緩い条件）
   */
  static isLikelyProductName(name: string): boolean {
    if (!this.isValidProductName(name)) return false

    const trimmed = name.trim()

    // 明らかに商品名ではないパターンを除外
    const obviouslyNotProduct = [
      /^[A-Z]{2,}$/, // 大文字のみ（商品コードの可能性）
      /^\d+[A-Z]?$/, // 数字＋文字1文字（商品コードの可能性）
      /^[*=-]{2,}$/, // 記号の羅列
      /^(小計|合計|税|総額|TOTAL|SUBTOTAL|TAX)$/i
    ]

    return !obviouslyNotProduct.some(pattern => pattern.test(trimmed))
  }

  /**
   * 5行パターンで商品を検索
   */
  static findWarehouseProduct(
    lines: string[], 
    startIndex: number, 
    processedLines: Set<number>
  ): ExtractedItem | null {
    if (startIndex + 4 >= lines.length) return null
    if (processedLines.has(startIndex)) return null

    const line1 = lines[startIndex]?.trim()     // 商品名
    const line2 = lines[startIndex + 1]?.trim() // 数量
    const line3 = lines[startIndex + 2]?.trim() // 商品コード
    const line4 = lines[startIndex + 3]?.trim() // 価格
    const line5 = lines[startIndex + 4]?.trim() // 税区分

    // パターンマッチング
    const quantityMatch = line2?.match(/^(\d+)[個⚫°.]?$/)
    const codeMatch = line3?.match(/^(\d{5,7})$/)
    const priceMatch = line4?.match(/^([\d,]+)$/)
    const taxMatch = line5?.match(/^([TE])$/)

    if (this.isValidProductName(line1) && 
        quantityMatch && 
        codeMatch && 
        priceMatch && 
        taxMatch) {
      
      const price = parseInt(priceMatch[1].replace(/,/g, ''))
      const quantity = parseInt(quantityMatch[1])

      if (this.isValidPrice(price)) {
        return {
          name: line1,
          price,
          quantity,
          confidence: PATTERN_CONFIG.confidence.high,
          sourcePattern: 'warehouse-5line',
          lineNumbers: [startIndex, startIndex + 1, startIndex + 2, startIndex + 3, startIndex + 4],
          rawText: `${line1} | ${line2} | ${line3} | ${line4} | ${line5}`,
          metadata: {
            productCode: codeMatch[1],
            taxType: taxMatch[1],
            reducedTaxRate: taxMatch[1] === 'E'
          }
        }
      }
    }

    return null
  }

  /**
   * 分離商品名パターンを検索
   */
  static findSplitNameProducts(
    lines: string[], 
    processedLines: Set<number>
  ): ExtractedItem[] {
    const items: ExtractedItem[] = []

    for (let i = 0; i < lines.length - 5; i++) {
      if (processedLines.has(i)) continue

      const line1 = lines[i]?.trim()
      const line2 = lines[i + 1]?.trim()
      const line3 = lines[i + 2]?.trim()
      const line4 = lines[i + 3]?.trim()
      const line5 = lines[i + 4]?.trim()
      const line6 = lines[i + 5]?.trim()

      // パターン: 商品名（前半） + 商品名（後半） + 数量 + 商品コード + 価格 + 税区分
      if (line1 && line2 && line3 && line4 && line5 && line6) {
        const quantityMatch = line3.match(/^(\d+)[個⚫°.]?$/)
        const codeMatch = line4.match(/^(\d{5,7})$/)
        const priceMatch = line5.match(/^([\d,]+)$/)
        const taxMatch = line6.match(/^([TE])$/)

        if (quantityMatch && codeMatch && priceMatch && taxMatch) {
          const combinedName = `${line1} ${line2}`.trim()
          
          if (this.isValidProductName(combinedName)) {
            const price = parseInt(priceMatch[1].replace(/,/g, ''))
            const quantity = parseInt(quantityMatch[1])

            if (this.isValidPrice(price)) {
              items.push({
                name: combinedName,
                price,
                quantity,
                confidence: PATTERN_CONFIG.confidence.medium,
                sourcePattern: 'warehouse-split-name',
                lineNumbers: [i, i + 1, i + 2, i + 3, i + 4, i + 5],
                rawText: `${line1} | ${line2} | ${line3} | ${line4} | ${line5} | ${line6}`,
                metadata: {
                  productCode: codeMatch[1],
                  taxType: taxMatch[1],
                  reducedTaxRate: taxMatch[1] === 'E',
                  splitName: true
                }
              })

              // 処理済みマーク
              for (let j = 0; j < 6; j++) {
                processedLines.add(i + j)
              }
            }
          }
        }
      }
    }

    return items
  }

  /**
   * 汎用価格パターンで商品を検索
   */
  static findGenericPricePatterns(lines: string[]): ExtractedItem[] {
    const items: ExtractedItem[] = []

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]?.trim()
      if (!line) continue

      // パターン: 商品名 + 価格（同一行）
      const inlineMatch = line.match(/^(.+)\s+(\d{2,5})\s*[円¥]?\s*$/)
      if (inlineMatch) {
        const name = inlineMatch[1].trim()
        const price = parseInt(inlineMatch[2])

        if (this.isLikelyProductName(name) && this.isValidPrice(price)) {
          items.push({
            name,
            price,
            quantity: 1,
            confidence: PATTERN_CONFIG.confidence.low,
            sourcePattern: 'generic-inline',
            lineNumbers: [i],
            rawText: line,
            metadata: {
              pattern: 'inline-price'
            }
          })
        }
      }

      // パターン: 商品名 + 次行価格
      if (i < lines.length - 1) {
        const nextLine = lines[i + 1]?.trim()
        const priceMatch = nextLine?.match(/^(\d{2,5})\s*[円¥]?\s*$/)

        if (this.isLikelyProductName(line) && priceMatch) {
          const price = parseInt(priceMatch[1])

          if (this.isValidPrice(price)) {
            items.push({
              name: line,
              price,
              quantity: 1,
              confidence: PATTERN_CONFIG.confidence.low,
              sourcePattern: 'generic-two-line',
              lineNumbers: [i, i + 1],
              rawText: `${line} | ${nextLine}`,
              metadata: {
                pattern: 'two-line-price'
              }
            })
          }
        }
      }
    }

    return items
  }

  /**
   * アイテムの重複をチェック
   */
  static isDuplicateItem(item: ExtractedItem, existingItems: ExtractedItem[]): boolean {
    return existingItems.some(existing => {
      // 名前が同じ
      const nameMatch = item.name.toLowerCase() === existing.name.toLowerCase()
      
      // 価格が近い（±50円以内）
      const priceMatch = item.price && existing.price && 
        Math.abs(item.price - existing.price) <= 50

      return nameMatch || priceMatch
    })
  }

  /**
   * アイテムの品質スコアを計算
   */
  static calculateQualityScore(item: ExtractedItem): number {
    let score = 0

    // 基本スコア
    score += item.confidence * 100

    // 価格の妥当性
    if (item.price && this.isValidPrice(item.price)) {
      score += 20
    }

    // 商品名の品質
    if (item.name && this.isValidProductName(item.name)) {
      score += 15
    }

    // 数量の妥当性
    if (item.quantity && item.quantity > 0 && item.quantity <= 100) {
      score += 10
    }

    // メタデータの充実度
    if (item.metadata && Object.keys(item.metadata).length > 0) {
      score += 5
    }

    return Math.min(score, 100)
  }
}