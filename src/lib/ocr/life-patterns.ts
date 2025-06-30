import { ExtractedItem } from '@/types/ocr-patterns'

/**
 * 店舗固有のOCRパターンマッチング
 */
export class LifePatterns {

  /**
   * 店舗固有のOCRテキストを解析
   */
  static parseLifeText(ocrText: string): ExtractedItem[] {
    const lines = ocrText.split('\n').filter(line => line.trim())
    const items: ExtractedItem[] = []
    
    console.log(`📝 店舗固有解析開始: ${lines.length}行`)
    
    // システム情報・メタデータを除外
    const filteredLines = lines.filter(line => !this.shouldExclude(line.trim()))
    console.log(`🔍 フィルター後: ${filteredLines.length}行`)
    
    // 店舗固有の包括的パターンマッチング
    items.push(...this.extractLifeSpecificPattern(filteredLines))
    
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
    if (/^(ライフ|LIFE|領収証)/.test(line)) return true
    if (/^(No\d+|登録機|レジ\d+)/.test(line)) return true
    
    // 日付・時刻
    if (/^\d{4}年\d{1,2}月\d{1,2}日/.test(line)) return true
    if (/^\d{2}:\d{2}/.test(line)) return true
    
    // 合計・税金関連
    const metadataKeywords = [
      '小計', '合計', '現金', 'お釣り', 'おつり',
      '外税', '対象額', '税', 'お買上点数', '支払合計',
      '軽減税率', '対象', 'バーコード', 'クルジ',
      'ポイント', 'スタッフ募集', 'LaCuCa'
    ]
    if (metadataKeywords.some(keyword => line.includes(keyword))) return true
    
    // 金額のみの行（合計行など）は除外しない（商品価格の可能性があるため）
    // if (/^¥[\d,]+$/.test(line)) return true
    // if (/^[\d,]+$/.test(line) && parseInt(line.replace(/,/g, '')) > 1000) return true
    
    // 短すぎる行や記号のみの行
    if (line.length <= 2) return true
    if (/^[-_=■]+$/.test(line)) return true
    
    return false
  }

  /**
   * 店舗固有の包括的パターンマッチング
   */
  private static extractLifeSpecificPattern(lines: string[]): ExtractedItem[] {
    const items: ExtractedItem[] = []
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      console.log(`🔍 店舗固有パターン解析: 行${i}: "${line}"`)
      
      // パターン1: インライン形式（*商品名 ¥価格）
      const inlineMatch = line.match(/^\*(.+?)\s+¥(\d{1,5})$/)
      if (inlineMatch) {
        const productName = inlineMatch[1].trim()
        const price = parseInt(inlineMatch[2])
        
        if (this.isValidPrice(price)) {
          console.log(`  ✅ インライン形式成功: ${productName} - ¥${price}`)
          items.push({
            name: productName,
            price,
            quantity: 1,
            confidence: 0.95,
            sourcePattern: 'store-inline',
            lineNumbers: [i],
            rawText: line,
            category: this.categorizeProduct(productName),
            metadata: {
              hasAsterisk: true,
              reducedTaxRate: true
            }
          })
          continue
        }
      }
      
      // パターン2: 2行パターン（商品名 → ¥価格）
      if (i < lines.length - 1) {
        const nextLine = lines[i + 1]?.trim()
        
        // 商品名行チェック（*マーク付きまたは通常商品名）
        const isProductLine = this.isValidProductName(line) || 
                             (line.startsWith('*') && this.isValidProductName(line.substring(1)))
        
        // 価格行チェック
        const priceMatch = nextLine?.match(/^¥(\d{1,5})$/)
        
        if (isProductLine && priceMatch) {
          const productName = line.startsWith('*') ? line.substring(1).trim() : line
          const price = parseInt(priceMatch[1])
          
          if (this.isValidPrice(price)) {
            console.log(`  ✅ 2行パターン成功: ${productName} - ¥${price}`)
            items.push({
              name: productName,
              price,
              quantity: 1,
              confidence: 0.9,
              sourcePattern: 'store-two-line',
              lineNumbers: [i, i + 1],
              rawText: `${line} | ${nextLine}`,
              category: this.categorizeProduct(productName),
              metadata: {
                hasAsterisk: line.startsWith('*'),
                reducedTaxRate: line.startsWith('*')
              }
            })
            i++ // 価格行をスキップ
            continue
          }
        }
      }
      
      // パターン2: ※マーク付きインライン（※商品名 ¥価格）
      const asteriskMatch = line.match(/^※(.+?)\s+¥(\d{1,5})$/)
      if (asteriskMatch) {
        const name = asteriskMatch[1].trim()
        const price = parseInt(asteriskMatch[2])
        
        if (this.isValidProductName(name) && this.isValidPrice(price)) {
          console.log(`  ✅ ※マークパターン成功: ${name} - ¥${price}`)
          items.push({
            name,
            price,
            quantity: 1,
            confidence: 0.95,
            sourcePattern: 'store-asterisk-inline',
            lineNumbers: [i],
            rawText: line,
            category: this.categorizeProduct(name),
            metadata: {
              taxType: 'reduced', // ※は軽減税率対象
              hasAsterisk: true
            }
          })
          continue
        }
      }
      
      // パターン2: 税区分付きインライン（A 商品名 ¥価格）
      const taxTypeMatch = line.match(/^([A-Z])\s+(.+?)\s+¥(\d{1,5})$/)
      if (taxTypeMatch) {
        const taxType = taxTypeMatch[1]
        const name = taxTypeMatch[2].trim()
        const price = parseInt(taxTypeMatch[3])
        
        if (this.isValidProductName(name) && this.isValidPrice(price)) {
          console.log(`  ✅ 税区分パターン成功: ${name} - ¥${price} (税区分: ${taxType})`)
          items.push({
            name,
            price,
            quantity: 1,
            confidence: 0.9,
            sourcePattern: 'store-tax-type-inline',
            lineNumbers: [i],
            rawText: line,
            category: this.categorizeProduct(name),
            metadata: {
              taxType: taxType,
              reducedTaxRate: taxType === 'A' // Aは軽減税率の場合が多い
            }
          })
          continue
        }
      }
      
      // パターン3: 数量パターン（前の行が商品名、現在行が数量情報）
      if (i > 0) {
        const quantityMatch = line.match(/^(\d+)コX単(\d+)$/)
        if (quantityMatch) {
          const previousLine = lines[i - 1].trim()
          const quantity = parseInt(quantityMatch[1])
          const unitPrice = parseInt(quantityMatch[2])
          const totalPrice = quantity * unitPrice
          
          // 前の行が商品名として適切かチェック
          if (this.isValidProductName(previousLine) && this.isValidPrice(totalPrice)) {
            console.log(`  ✅ 数量パターン成功: ${previousLine} - ${quantity}コ × ¥${unitPrice} = ¥${totalPrice}`)
            items.push({
              name: previousLine,
              price: totalPrice,
              quantity: quantity,
              confidence: 0.85,
              sourcePattern: 'store-quantity-pattern',
              lineNumbers: [i - 1, i],
              rawText: `${previousLine} | ${line}`,
              category: this.categorizeProduct(previousLine),
              metadata: {
                unitPrice: unitPrice,
                calculatedTotal: true
              }
            })
            continue
          }
        }
      }
      
      // パターン4: シンプルな価格パターン（商品名 価格）
      const simpleMatch = line.match(/^(.+?)\s+(\d{2,5})$/)
      if (simpleMatch) {
        const name = simpleMatch[1].trim()
        const price = parseInt(simpleMatch[2])
        
        // ※や税区分が省略されている場合
        if (this.isValidProductName(name) && this.isValidPrice(price) && 
            !name.includes('¥') && !name.includes('コX')) {
          console.log(`  ✅ シンプルパターン成功: ${name} - ¥${price}`)
          items.push({
            name,
            price,
            quantity: 1,
            confidence: 0.7,
            sourcePattern: 'store-simple-pattern',
            lineNumbers: [i],
            rawText: line,
            category: this.categorizeProduct(name),
            metadata: {
              taxType: 'unknown'
            }
          })
          continue
        }
      }
    }
    
    return items
  }

  /**
   * 商品名として妥当かチェック
   */
  private static isValidProductName(text: string): boolean {
    console.log(`    🔍 商品名判定: "${text}"`)
    
    if (!text || text.length < 2 || text.length > 50) {
      console.log(`    ❌ 長さが不適切: ${text.length}文字`)
      return false
    }
    
    // 価格行でない
    if (/^¥\d+$/.test(text)) {
      console.log(`    ❌ 価格行`)
      return false
    }
    
    // 数字のみでない
    if (/^\d+$/.test(text)) {
      console.log(`    ❌ 数字のみ`)
      return false
    }
    
    // 明らかなメタデータでない
    if (/^(小計|合計|税|レジ|責|取|現金|No\d+|外\d+%|期間限定|月\s+\d+日|LC\s|入会金|「く」|0120|レシートNo|店No|\d+コX単\d+)/.test(text)) {
      console.log(`    ❌ メタデータキーワード`)
      return false
    }
    
    // 日本語またはアルファベットを含む（*マーク付きも考慮）
    const cleanText = text.replace(/^\*/, '')
    if (!/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAFa-zA-Z]/.test(cleanText)) {
      console.log(`    ❌ 日本語・英語を含まない`)
      return false
    }
    
    console.log(`    ✅ 商品名として適切`)
    return true
  }

  /**
   * 妥当な価格かチェック
   */
  private static isValidPrice(price: number): boolean {
    return price >= 1 && price <= 99999  // ライフの一般的な価格帯
  }

  /**
   * 商品の分類
   */
  private static categorizeProduct(name: string): string {
    const categories = [
      { keywords: ['レタス', 'キャベツ', 'ねぎ', 'しめじ'], category: '野菜・きのこ' },
      { keywords: ['バナナ', 'りんご', 'みかん'], category: '果物' },
      { keywords: ['豚', '牛', '鶏', 'ロース', 'もも'], category: '肉類' },
      { keywords: ['がれい', 'さば', 'まぐろ', '魚'], category: '魚類' },
      { keywords: ['牛乳', 'ミルク', 'バター', 'チーズ'], category: '乳製品' },
      { keywords: ['金麦', 'ビール', 'オフ', '酒'], category: '飲料・アルコール' },
      { keywords: ['パン', '食パン'], category: 'パン・穀物' },
      { keywords: ['豆腐', '納豆'], category: '豆腐・大豆製品' }
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
   * ライフの期待される商品リスト（参考用）
   */
  static getExpectedItems(): Array<{name: string, priceRange: [number, number]}> {
    return [
      { name: 'レタス', priceRange: [100, 200] },
      { name: 'やさしさあじわいバナナ', priceRange: [120, 160] },
      { name: 'からすがれい（解凍）', priceRange: [350, 450] },
      { name: '米国豚ロース極うす切', priceRange: [350, 500] },
      { name: 'ふなしめじ100G', priceRange: [50, 100] },
      { name: '雪印バターミニパック8g', priceRange: [200, 280] },
      { name: '金麦オフ350ml', priceRange: [200, 280] }
    ]
  }
}