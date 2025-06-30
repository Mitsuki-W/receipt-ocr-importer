import { ExtractedItem } from '@/types/ocr-patterns'

/**
 * Receipt3（ピーコックストア）専用のOCRパターンマッチング
 */
export class Receipt3Patterns {

  /**
   * Receipt3のOCRテキストを解析
   */
  static parseReceipt3Text(ocrText: string): ExtractedItem[] {
    const lines = ocrText.split('\n').filter(line => line.trim())
    const items: ExtractedItem[] = []
    
    console.log(`📝 Receipt3解析開始: ${lines.length}行`)
    
    // システム情報・メタデータを除外
    const filteredLines = lines.filter(line => !this.shouldExclude(line.trim()))
    console.log(`🔍 フィルター後: ${filteredLines.length}行`)
    
    // Receipt3専用の包括的パターンマッチング
    items.push(...this.extractReceipt3SpecificPattern(filteredLines))
    
    // 重複除去と最終クリーンアップ
    const cleanedItems = this.removeDuplicatesAndCleanup(items)
    console.log(`✨ 最終結果: ${cleanedItems.length}件`)
    
    return cleanedItems
  }

  /**
   * 除外すべき行かどうかを判定
   */
  private static shouldExclude(line: string): boolean {
    // 空行
    if (!line || line.length === 0) return true
    
    // 店舗情報
    if (/^(Receipt3|Market|ピーコックストア|領収証|ÆEON)/.test(line)) return true
    if (/^(イオンマーケット株式会社|レジ\s*\d+|取\d+)/.test(line)) return true
    
    // 日付・時刻
    if (/^\d{4}\/\s*\d{1,2}\/\s*\d{1,2}/.test(line)) return true
    if (/^取\d+\s+責:\d+/.test(line)) return true
    if (/^\d{4}\/\d{1,2}\/\d{1,2}\([月火水木金土日]\)\s*\d{2}:\d{2}/.test(line)) return true
    
    // 合計・税金関連
    const metadataKeywords = [
      '小計', '合計', '現金', 'お釣り', 'おつり',
      '外税', '対象額', '税', 'お買上商品数',
      '※印は軽減税率', 'バーコード'
    ]
    if (metadataKeywords.some(keyword => line.includes(keyword))) return true
    
    // 金額のみの行（合計行など）
    if (/^¥[\d,]+$/.test(line)) return true
    if (/^[\d,]+$/.test(line) && parseInt(line.replace(/,/g, '')) > 1000) return true
    
    // 短すぎる行や記号のみの行
    if (line.length <= 2) return true
    if (/^[-_=]+$/.test(line)) return true
    
    return false
  }


  /**
   * Receipt3専用の包括的パターンマッチング
   */
  private static extractReceipt3SpecificPattern(lines: string[]): ExtractedItem[] {
    const items: ExtractedItem[] = []
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      console.log(`🔍 Receipt3パターン解析: 行${i}: "${line}"`)
      
      // パターン1: 割引商品の5行パターン
      if (i <= lines.length - 5) {
        const discountItem = this.tryExtractDiscountPattern(lines, i)
        if (discountItem.item) {
          items.push(discountItem.item)
          i += discountItem.skipLines
          continue
        }
      }
      
      // パターン2: シンプルな2行パターン（商品名 → 価格）
      if (i < lines.length - 1) {
        const nextLine = lines[i + 1]?.trim()
        if (this.isProductName(line) && this.isPriceLinePattern(nextLine)) {
          const priceData = this.extractPriceFromLine(nextLine)
          if (priceData) {
            console.log(`  ✅ シンプル2行パターン成功: ${line} - ¥${priceData.price}`)
            items.push({
              name: line,
              price: priceData.price,
              quantity: 1,
              confidence: 0.9,
              sourcePattern: 'receipt3-simple-two-line',
              lineNumbers: [i, i + 1],
              rawText: `${line} | ${nextLine}`,
              category: this.categorizeProduct(line),
              metadata: {
                reducedTaxRate: priceData.hasTaxMark
              }
            })
            i++ // 価格行をスキップ
            continue
          }
        }
      }
      
      // パターン3: 連続商品の解析（特殊ケース）
      if (i < lines.length - 3) {
        const consecutiveItems = this.tryExtractConsecutiveItems(lines, i)
        if (consecutiveItems.length > 0) {
          items.push(...consecutiveItems)
          i += consecutiveItems.length * 2 - 1 // 処理した行数分スキップ
          continue
        }
      }
    }
    
    return items
  }

  /**
   * 連続する商品の解析（Receipt3の特殊パターン）
   */
  private static tryExtractConsecutiveItems(lines: string[], index: number): ExtractedItem[] {
    const items: ExtractedItem[] = []
    
    // 連続する商品名を検出
    const productNames: string[] = []
    let productEndIndex = index
    
    for (let i = index; i < Math.min(index + 4, lines.length); i++) {
      const line = lines[i].trim()
      if (this.isProductName(line) && !this.isPriceLinePattern(line)) {
        productNames.push(line)
        productEndIndex = i
      } else {
        break
      }
    }
    
    if (productNames.length < 2) return [] // 連続商品でない
    
    // 連続する価格を検出
    const priceLines: string[] = []
    for (let i = productEndIndex + 1; i < Math.min(productEndIndex + 1 + productNames.length, lines.length); i++) {
      const line = lines[i].trim()
      if (this.isPriceLinePattern(line)) {
        priceLines.push(line)
      } else {
        break
      }
    }
    
    if (priceLines.length === productNames.length) {
      console.log(`  🔗 連続商品パターン検出: ${productNames.length}商品`)
      
      for (let i = 0; i < productNames.length; i++) {
        const priceData = this.extractPriceFromLine(priceLines[i])
        if (priceData) {
          console.log(`    ✅ ${productNames[i]} - ¥${priceData.price}`)
          items.push({
            name: productNames[i],
            price: priceData.price,
            quantity: 1,
            confidence: 0.85,
            sourcePattern: 'receipt3-consecutive',
            lineNumbers: [index + i, productEndIndex + 1 + i],
            rawText: `${productNames[i]} | ${priceLines[i]}`,
            category: this.categorizeProduct(productNames[i]),
            metadata: {
              reducedTaxRate: priceData.hasTaxMark
            }
          })
        }
      }
    }
    
    return items
  }

  /**
   * 割引パターンの抽出（5行パターン）
   */
  private static tryExtractDiscountPattern(lines: string[], index: number): { item: ExtractedItem | null, skipLines: number } {
    if (index >= lines.length - 4) return { item: null, skipLines: 0 }
    
    const line1 = lines[index]?.trim()      // 商品名
    const line2 = lines[index + 1]?.trim()  // "割引"
    const line3 = lines[index + 2]?.trim()  // "20%" または 価格※
    const line4 = lines[index + 3]?.trim()  // "268X" または "%"
    const line5 = lines[index + 4]?.trim()  // "-54" または "-金額"
    
    console.log(`🔍 割引パターン試行: "${line1}" → "${line2}" → "${line3}" → "${line4}" → "${line5}"`)
    
    // パターンA: 商品名 → "割引" → "XX%" → 価格 → "-金額"
    if (line2 === '割引' && 
        line3 && /^\d+%$/.test(line3) &&
        line4 && this.isPriceLinePattern(line4) &&
        line5 && /^-\d+$/.test(line5)) {
      
      const discountPercent = parseInt(line3.replace('%', ''))
      const priceData = this.extractPriceFromLine(line4)
      const discountAmount = parseInt(line5.replace('-', ''))
      
      if (this.isProductName(line1) && priceData && this.isValidPrice(priceData.price)) {
        console.log(`  ✅ 割引パターンA成功: ${line1} - ¥${priceData.price} (${discountPercent}%割引)`)
        
        return {
          item: {
            name: line1,
            price: priceData.price,
            quantity: 1,
            confidence: 0.9,
            sourcePattern: 'receipt3-discount-5line',
            lineNumbers: [index, index + 1, index + 2, index + 3, index + 4],
            rawText: `${line1} | ${line2} | ${line3} | ${line4} | ${line5}`,
            category: this.categorizeProduct(line1),
            metadata: {
              reducedTaxRate: priceData.hasTaxMark,
              originalPrice: priceData.price + discountAmount,
              discountPercent,
              discountAmount
            }
          },
          skipLines: 4
        }
      }
    }
    
    // パターンB: 商品名 → "割引" → 価格※ → "XX%" → "-金額"
    if (line2 === '割引' && 
        line3 && this.isPriceLinePattern(line3) &&
        line4 && /^\d+%$/.test(line4) &&
        line5 && /^-\d+$/.test(line5)) {
      
      const priceData = this.extractPriceFromLine(line3)
      const discountPercent = parseInt(line4.replace('%', ''))
      const discountAmount = parseInt(line5.replace('-', ''))
      
      if (this.isProductName(line1) && priceData && this.isValidPrice(priceData.price)) {
        console.log(`  ✅ 割引パターンB成功: ${line1} - ¥${priceData.price} (${discountPercent}%割引)`)
        
        return {
          item: {
            name: line1,
            price: priceData.price,
            quantity: 1,
            confidence: 0.9,
            sourcePattern: 'receipt3-discount-5line-alt',
            lineNumbers: [index, index + 1, index + 2, index + 3, index + 4],
            rawText: `${line1} | ${line2} | ${line3} | ${line4} | ${line5}`,
            category: this.categorizeProduct(line1),
            metadata: {
              reducedTaxRate: priceData.hasTaxMark,
              originalPrice: priceData.price + discountAmount,
              discountPercent,
              discountAmount
            }
          },
          skipLines: 4
        }
      }
    }
    
    console.log(`  ❌ 割引パターン失敗`)
    return { item: null, skipLines: 0 }
  }




  /**
   * 商品名らしさの判定
   */
  private static isProductName(text: string): boolean {
    console.log(`    🔍 商品名判定: "${text}"`)
    
    if (!text || text.length < 2 || text.length > 40) {
      console.log(`    ❌ 長さが不適切: ${text.length}文字`)
      return false
    }
    
    // 日本語またはアルファベットを含む
    if (!/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAFa-zA-Z]/.test(text)) {
      console.log(`    ❌ 日本語・英語を含まない`)
      return false
    }
    
    // 数字のみでない
    if (/^\d+$/.test(text)) {
      console.log(`    ❌ 数字のみ`)
      return false
    }
    
    // 明らかなメタデータでない
    if (/^(小計|合計|割引|税|レジ|責|取|現金)/.test(text)) {
      console.log(`    ❌ メタデータキーワード`)
      return false
    }
    
    console.log(`    ✅ 商品名として適切`)
    return true
  }

  /**
   * 価格行パターンの判定（数字+オプションで*やX）
   */
  private static isPriceLinePattern(line: string): boolean {
    console.log(`    🔍 価格行判定: "${line}"`)
    
    // パターン1: 数字のみ（例：「3」「130」）
    if (/^\d{1,5}$/.test(line)) {
      const price = parseInt(line)
      const isValid = price >= 1 && price <= 10000
      console.log(`    📊 数字のみパターン: ${price}, 妥当性: ${isValid}`)
      return isValid
    }
    
    // パターン2: 数字+税率マーク（例：「458*」「268X」）
    if (/^\d{1,5}[*×X]$/.test(line)) {
      const match = line.match(/^(\d{1,5})[*×X]$/)
      if (match) {
        const price = parseInt(match[1])
        const isValid = price >= 1 && price <= 10000
        console.log(`    📊 税率マーク付きパターン: ${price}, 妥当性: ${isValid}`)
        return isValid
      }
    }
    
    console.log(`    ❌ 価格行ではない`)
    return false
  }

  /**
   * 価格行から価格と税率マークを抽出
   */
  private static extractPriceFromLine(line: string): { price: number, hasTaxMark: boolean } | null {
    console.log(`    🔍 価格抽出: "${line}"`)
    
    // パターン1: 数字のみ
    const pattern1 = line.match(/^(\d{1,5})$/)
    if (pattern1) {
      const price = parseInt(pattern1[1])
      console.log(`    ✅ 価格抽出成功（税率マークなし）: ${price}`)
      return { price, hasTaxMark: false }
    }
    
    // パターン2: 数字+税率マーク
    const pattern2 = line.match(/^(\d{1,5})([*×X])$/)
    if (pattern2) {
      const price = parseInt(pattern2[1])
      console.log(`    ✅ 価格抽出成功（税率マーク${pattern2[2]}）: ${price}`)
      return { price, hasTaxMark: true }
    }
    
    console.log(`    ❌ 価格抽出失敗`)
    return null
  }

  /**
   * 妥当な価格かチェック
   */
  private static isValidPrice(price: number): boolean {
    return price >= 1 && price <= 10000  // Receipt3の一般的な価格帯（1円から1万円）
  }

  /**
   * 商品の分類
   */
  private static categorizeProduct(name: string): string {
    const categories = [
      { keywords: ['牛乳', 'ミルク', 'チョコ', 'パルム'], category: '乳製品・デザート' },
      { keywords: ['若鶏', 'から揚', '豆腐', 'ケンち'], category: '肉類・豆腐' },
      { keywords: ['金麦', '糖質オフ'], category: '飲料・アルコール' },
      { keywords: ['スイー', 'うどん', '風麺'], category: '冷凍食品' },
      { keywords: ['レジ袋', 'バイオ'], category: '日用品' }
    ]
    
    for (const cat of categories) {
      if (cat.keywords.some(keyword => name.includes(keyword))) {
        return cat.category
      }
    }
    
    return 'その他'
  }

  /**
   * 重複除去とクリーンアップ
   */
  private static removeDuplicatesAndCleanup(items: ExtractedItem[]): ExtractedItem[] {
    // 商品名で分類
    const groups = new Map<string, ExtractedItem[]>()
    
    items.forEach(item => {
      const key = this.normalizeProductName(item.name)
      if (!groups.has(key)) {
        groups.set(key, [])
      }
      groups.get(key)!.push(item)
    })
    
    const result: ExtractedItem[] = []
    
    // 各グループから最適なアイテムを選択
    for (const [, groupItems] of groups) {
      if (groupItems.length === 1) {
        result.push(groupItems[0])
      } else {
        // 最も信頼度が高いものを選択
        const best = groupItems
          .filter(item => this.isValidPrice(item.price))
          .sort((a, b) => b.confidence - a.confidence)[0]
        
        if (best) {
          result.push(best)
        }
      }
    }
    
    return result
      .filter(item => this.isValidPrice(item.price))
      .sort((a, b) => b.confidence - a.confidence)
  }

  /**
   * 商品名の正規化
   */
  private static normalizeProductName(name: string): string {
    return name
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[ー\-]/g, '')
      .replace(/[（）()]/g, '')
      .replace(/[※×]/g, '')
  }

  /**
   * Receipt3の期待される商品リスト（参考用）
   */
  static getExpectedItems(): Array<{name: string, priceRange: [number, number]}> {
    return [
      { name: 'バイオレジ袋', priceRange: [3, 10] },
      { name: '森永乳業 パルムチョコ', priceRange: [450, 470] },
      { name: 'タカキ 阿蘇牛乳ミルク', priceRange: [260, 280] },
      { name: 'TVB P若鶏ももから揚', priceRange: [470, 490] },
      { name: '金麦糖質オフ', priceRange: [120, 140] },
      { name: 'TVやさしき想いスイー', priceRange: [90, 110] },
      { name: 'TV低糖質うどん風麺', priceRange: [90, 110] },
      { name: '男前豆腐店 特濃ケンち', priceRange: [130, 150] }
    ]
  }
}