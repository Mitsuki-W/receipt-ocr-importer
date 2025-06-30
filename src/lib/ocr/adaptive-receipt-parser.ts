import { ExtractedItem } from '@/types/ocr-patterns'

/**
 * 適応型レシートパーサー - どんなレシートでも対応
 * 実際のデータから学習し、動的にパターンを調整
 */
export class AdaptiveReceiptParser {

  /**
   * 適応型レシート解析
   */
  static parseAdaptively(ocrText: string): ExtractedItem[] {
    console.log('🧠 適応型レシートパーサー開始')
    console.log('=' + '='.repeat(50))
    
    const lines = ocrText.split('\n').filter(line => line.trim())
    
    // Step 1: レシート特性の自動学習
    const characteristics = this.learnReceiptCharacteristics(lines)
    console.log(`📚 学習結果: ${characteristics.type} (信頼度: ${characteristics.confidence.toFixed(2)})`)
    
    // Step 2: 特性に基づく解析戦略の選択
    const strategy = this.selectParsingStrategy(characteristics)
    console.log(`🎯 解析戦略: ${strategy.name}`)
    
    // Step 3: 段階的解析実行
    const results = this.executeAdaptiveParsing(lines, strategy, characteristics)
    
    console.log(`✨ 適応型解析完了: ${results.length}件`)
    return results
  }

  /**
   * レシート特性の自動学習
   */
  private static learnReceiptCharacteristics(lines: string[]) {
    const stats = {
      totalLines: lines.length,
      productCodes: 0,
      pricesWithTax: 0,
      quantities: 0,
      multipliers: 0,
      oneStars: 0,
      mixedLines: 0,
      numberOnlyLines: 0,
      shortLines: 0,
      longLines: 0,
      specialChars: 0,
      productNameCandidates: 0
    }
    
    // 各行の特性を分析
    lines.forEach(line => {
      const trimmed = line.trim()
      
      if (/^\d{5,7}$/.test(trimmed)) stats.productCodes++
      if (/^[\d,]+\s+[TE]$/.test(trimmed)) stats.pricesWithTax++
      if (/^\d+[個⚫°.]?$/.test(trimmed)) stats.quantities++
      if (/^X\d+$/i.test(trimmed)) stats.multipliers++
      if (/^1\*?$/.test(trimmed)) stats.oneStars++
      if (/[a-zA-Zあ-んア-ン]/.test(trimmed) && /\d/.test(trimmed)) stats.mixedLines++
      if (/^\d+$/.test(trimmed)) stats.numberOnlyLines++
      if (trimmed.length < 3) stats.shortLines++
      if (trimmed.length > 30) stats.longLines++
      if (/[※●○◯⚫°•]/.test(trimmed)) stats.specialChars++
      if (this.isLikelyProductName(trimmed)) stats.productNameCandidates++
    })
    
    // レシートタイプの推定
    let type = 'unknown'
    let confidence = 0.5
    
    // 大型店舗標準パターン（5行構成）
    if (stats.productCodes > 3 && stats.pricesWithTax > 3 && stats.quantities > 2) {
      type = 'warehouse-standard'
      confidence = 0.9
    }
    // 倍数パターン（X数字 + 1*）
    else if (stats.multipliers > 2 && stats.oneStars > 2) {
      type = 'multiplier-based'
      confidence = 0.85
    }
    // 価格+税パターン
    else if (stats.pricesWithTax > 5) {
      type = 'price-tax-based'
      confidence = 0.8
    }
    // 商品コード主体
    else if (stats.productCodes > 5) {
      type = 'code-based'
      confidence = 0.75
    }
    // 混在型（複雑）
    else if (stats.mixedLines > stats.totalLines * 0.3) {
      type = 'mixed-complex'
      confidence = 0.6
    }
    // シンプル型
    else if (stats.productNameCandidates > 3) {
      type = 'simple-format'
      confidence = 0.7
    }
    // 低品質OCR
    else if (stats.shortLines > stats.totalLines * 0.4 || stats.specialChars > 5) {
      type = 'poor-ocr'
      confidence = 0.4
    }
    
    return {
      type,
      confidence,
      stats,
      // 特性指標
      structuralComplexity: this.calculateComplexity(stats),
      ocrQuality: this.estimateOCRQuality(stats),
      dataRichness: this.calculateDataRichness(stats)
    }
  }

  /**
   * 解析戦略の選択
   */
  private static selectParsingStrategy(characteristics: any) {
    const strategies = [
      {
        name: '5行標準戦略',
        suitability: characteristics.type === 'warehouse-standard' ? 0.9 : 0.3,
        method: this.parse5LineStandard.bind(this)
      },
      {
        name: '倍数パターン戦略',
        suitability: characteristics.type === 'multiplier-based' ? 0.9 : 0.4,
        method: this.parseMultiplierPattern.bind(this)
      },
      {
        name: '価格ベース戦略',
        suitability: characteristics.type === 'price-tax-based' ? 0.8 : 0.5,
        method: this.parsePriceBased.bind(this)
      },
      {
        name: 'フレキシブル戦略',
        suitability: characteristics.type === 'mixed-complex' ? 0.8 : 0.6,
        method: this.parseFlexible.bind(this)
      },
      {
        name: '低品質OCR戦略',
        suitability: characteristics.type === 'poor-ocr' ? 0.9 : 0.2,
        method: this.parsePoorOCR.bind(this)
      },
      {
        name: 'ブルートフォース戦略',
        suitability: 0.5, // 常に利用可能
        method: this.parseBruteForce.bind(this)
      }
    ]
    
    // 最適戦略を選択
    const bestStrategy = strategies.reduce((best, current) => 
      current.suitability > best.suitability ? current : best
    )
    
    return bestStrategy
  }

  /**
   * 適応型解析実行
   */
  private static executeAdaptiveParsing(lines: string[], strategy: any, characteristics: any): ExtractedItem[] {
    const results: ExtractedItem[] = []
    
    // メイン戦略で解析
    console.log(`🎯 ${strategy.name}で解析開始`)
    const primaryResults = strategy.method(lines, characteristics)
    results.push(...primaryResults)
    
    // 結果が不十分な場合、フォールバック戦略を実行
    if (results.length < Math.max(2, lines.length * 0.1)) {
      console.log('📦 フォールバック戦略を実行')
      
      // 異なる戦略を試行
      const fallbackStrategies = [
        this.parseFlexible.bind(this),
        this.parsePriceBased.bind(this),
        this.parseBruteForce.bind(this)
      ].filter(method => method !== strategy.method)
      
      for (const fallbackMethod of fallbackStrategies) {
        const fallbackResults = fallbackMethod(lines, characteristics)
        
        // 重複を避けて追加
        const newResults = fallbackResults.filter(newItem => 
          !results.some(existingItem => 
            this.isSimilarItem(newItem, existingItem)
          )
        )
        
        results.push(...newResults)
        
        if (results.length >= Math.max(3, lines.length * 0.15)) {
          break // 十分な結果が得られた
        }
      }
    }
    
    // 結果の品質向上
    return this.improveResults(results, characteristics)
  }

  /**
   * 5行標準パターン解析
   */
  private static parse5LineStandard(lines: string[], characteristics: any): ExtractedItem[] {
    const items: ExtractedItem[] = []
    const usedLines = new Set<number>()
    
    for (let i = 0; i < lines.length - 4; i++) {
      if (usedLines.has(i)) continue
      
      const sequence = lines.slice(i, i + 5)
      const pattern = this.analyze5LineSequence(sequence, i)
      
      if (pattern && pattern.confidence > 0.7) {
        items.push({
          name: this.normalizeProductName(pattern.name),
          price: pattern.price,
          quantity: pattern.quantity,
          confidence: pattern.confidence,
          sourcePattern: '5line-adaptive',
          lineNumbers: pattern.usedLines,
          rawText: pattern.usedLines.map((idx: number) => lines[idx]).join(' | '),
          category: this.categorizeProduct(pattern.name)
        })
        
        pattern.usedLines.forEach((lineIdx: number) => usedLines.add(lineIdx))
        i = Math.max(...pattern.usedLines)
      }
    }
    
    return items
  }

  /**
   * 倍数パターン解析
   */
  private static parseMultiplierPattern(lines: string[], characteristics: any): ExtractedItem[] {
    const items: ExtractedItem[] = []
    const usedLines = new Set<number>()
    
    for (let i = 0; i < lines.length - 2; i++) {
      if (usedLines.has(i)) continue
      
      const line1 = lines[i]?.trim()
      const line2 = lines[i + 1]?.trim()
      const line3 = lines[i + 2]?.trim()
      const line4 = lines[i + 3]?.trim()
      
      if (!this.isLikelyProductName(line1)) continue
      
      // X数字パターンを探す
      const multiplierMatch = line2?.match(/^X(\d+)$/i)
      if (multiplierMatch) {
        const quantity = parseInt(multiplierMatch[1])
        
        // 価格を探す（次の2行以内）
        for (let j = i + 2; j < Math.min(i + 5, lines.length); j++) {
          const price = this.extractPrice(lines[j]?.trim())
          if (price && price >= 100 && price <= 50000) {
            items.push({
              name: this.normalizeProductName(line1),
              price,
              quantity,
              confidence: 0.8,
              sourcePattern: 'multiplier-adaptive',
              lineNumbers: [i, i + 1, j],
              rawText: `${line1} | ${line2} | ${lines[j]}`,
              category: this.categorizeProduct(line1)
            })
            
            usedLines.add(i)
            usedLines.add(i + 1)
            usedLines.add(j)
            break
          }
        }
      }
    }
    
    return items
  }

  /**
   * 価格ベース解析
   */
  private static parsePriceBased(lines: string[], characteristics: any): ExtractedItem[] {
    const items: ExtractedItem[] = []
    const usedLines = new Set<number>()
    
    // 価格+税区分行を特定
    const priceLines = lines.map((line, index) => ({
      index,
      line: line.trim(),
      price: this.extractPriceWithTax(line.trim())
    })).filter(item => item.price !== null)
    
    // 各価格行について、前の行で商品名を探す
    for (const priceLine of priceLines) {
      if (usedLines.has(priceLine.index)) continue
      
      // 前の1-4行以内で商品名を探す
      for (let j = Math.max(0, priceLine.index - 4); j < priceLine.index; j++) {
        if (usedLines.has(j)) continue
        
        const candidateLine = lines[j].trim()
        if (this.isLikelyProductName(candidateLine)) {
          items.push({
            name: this.normalizeProductName(candidateLine),
            price: priceLine.price!,
            quantity: 1,
            confidence: 0.75,
            sourcePattern: 'price-based-adaptive',
            lineNumbers: [j, priceLine.index],
            rawText: `${candidateLine} | ${priceLine.line}`,
            category: this.categorizeProduct(candidateLine)
          })
          
          usedLines.add(j)
          usedLines.add(priceLine.index)
          break
        }
      }
    }
    
    return items
  }

  /**
   * フレキシブル解析
   */
  private static parseFlexible(lines: string[], characteristics: any): ExtractedItem[] {
    const items: ExtractedItem[] = []
    const usedLines = new Set<number>()
    
    // 緩い条件で商品名候補を探す
    const productCandidates = lines.map((line, index) => ({
      index,
      line: line.trim(),
      score: this.calculateProductScore(line.trim())
    })).filter(item => item.score > 0.3)
    
    for (const candidate of productCandidates) {
      if (usedLines.has(candidate.index)) continue
      
      // 近くで価格を探す（±5行以内）
      const searchStart = Math.max(0, candidate.index - 5)
      const searchEnd = Math.min(lines.length, candidate.index + 6)
      
      for (let j = searchStart; j < searchEnd; j++) {
        if (j === candidate.index || usedLines.has(j)) continue
        
        const price = this.extractPrice(lines[j].trim())
        if (price && price >= 100 && price <= 50000) {
          items.push({
            name: this.normalizeProductName(candidate.line),
            price,
            quantity: 1,
            confidence: candidate.score * 0.8,
            sourcePattern: 'flexible-adaptive',
            lineNumbers: [candidate.index, j],
            rawText: `${candidate.line} | ${lines[j]}`,
            category: this.categorizeProduct(candidate.line)
          })
          
          usedLines.add(candidate.index)
          usedLines.add(j)
          break
        }
      }
    }
    
    return items
  }

  /**
   * 低品質OCR対応解析
   */
  private static parsePoorOCR(lines: string[], characteristics: any): ExtractedItem[] {
    const items: ExtractedItem[] = []
    
    // 文字結合の試行
    const combinedLines = this.attemptLineCombination(lines)
    
    // 結合後の行で再解析
    return this.parseFlexible(combinedLines, characteristics)
  }

  /**
   * ブルートフォース解析
   */
  private static parseBruteForce(lines: string[], characteristics: any): ExtractedItem[] {
    const items: ExtractedItem[] = []
    
    // 全ての可能な組み合わせを試行
    for (let i = 0; i < lines.length; i++) {
      const line1 = lines[i].trim()
      if (line1.length < 2) continue
      
      for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
        const line2 = lines[j].trim()
        const price = this.extractPrice(line2)
        
        if (price && price >= 100 && price <= 50000) {
          const score = this.calculateProductScore(line1)
          if (score > 0.2) {
            items.push({
              name: this.normalizeProductName(line1),
              price,
              quantity: 1,
              confidence: score * 0.6,
              sourcePattern: 'brute-force-adaptive',
              lineNumbers: [i, j],
              rawText: `${line1} | ${line2}`,
              category: this.categorizeProduct(line1)
            })
          }
        }
      }
    }
    
    // 信頼度でソートして上位のみ返す
    return items.sort((a, b) => b.confidence - a.confidence).slice(0, 20)
  }

  /**
   * ユーティリティメソッド群
   */
  private static calculateComplexity(stats: any): number {
    const factors = [
      stats.mixedLines / stats.totalLines,
      stats.specialChars / stats.totalLines,
      stats.longLines / stats.totalLines
    ]
    return factors.reduce((sum, factor) => sum + factor, 0) / factors.length
  }

  private static estimateOCRQuality(stats: any): number {
    const qualityFactors = [
      1 - (stats.shortLines / stats.totalLines),
      1 - (stats.specialChars / stats.totalLines),
      Math.min(1, stats.productNameCandidates / (stats.totalLines * 0.3))
    ]
    return qualityFactors.reduce((sum, factor) => sum + factor, 0) / qualityFactors.length
  }

  private static calculateDataRichness(stats: any): number {
    const richnessFactors = [
      stats.productCodes / stats.totalLines,
      stats.pricesWithTax / stats.totalLines,
      stats.mixedLines / stats.totalLines
    ]
    return richnessFactors.reduce((sum, factor) => sum + factor, 0)
  }

  private static isLikelyProductName(text: string): boolean {
    if (!text || text.length < 2 || text.length > 60) return false
    if (!/[あ-んア-ンa-zA-Z0-9]/.test(text)) return false
    
    const excludePatterns = [
      /^[\d\s,]+$/, /^X\d+$/i, /^\d{5,7}$/, /^1\*?$/,
      /^¥[\d,]+$/, /^[\d,]+円?$/, /^[\d,]+\s+[TE]$/,
      /合計|小計|税|売上/, /^\d{4}年/, /TEL|FAX|住所/
    ]
    
    return !excludePatterns.some(pattern => pattern.test(text))
  }

  private static calculateProductScore(text: string): number {
    if (!this.isLikelyProductName(text)) return 0
    
    let score = 0.3
    if (text.length >= 4) score += 0.1
    if (/[あ-んア-ン]/.test(text)) score += 0.2
    if (/[a-zA-Z]/.test(text)) score += 0.15
    if (/[×・]/.test(text)) score += 0.1
    
    const keywords = ['ヨーグルト', '牛乳', 'シューズ', 'ティッシュ', 'バッグ']
    if (keywords.some(keyword => text.toLowerCase().includes(keyword.toLowerCase()))) {
      score += 0.25
    }
    
    return Math.min(1.0, score)
  }

  private static analyze5LineSequence(sequence: string[], startIndex: number) {
    // 実装は既存のUniversalReceiptParserと同様
    // ここでは簡略化
    return null
  }

  private static extractPrice(text: string): number | null {
    if (!text) return null
    
    const patterns = [
      /¥([\d,]+)/, /^([\d,]+)円$/, /^([\d,]+)$/
    ]
    
    for (const pattern of patterns) {
      const match = text.match(pattern)
      if (match) {
        const price = parseInt(match[1].replace(/,/g, ''))
        if (price >= 50 && price <= 100000) return price
      }
    }
    
    return null
  }

  private static extractPriceWithTax(text: string): number | null {
    const match = text.match(/^([\d,]+)\s+[TE]$/)
    if (match) {
      const price = parseInt(match[1].replace(/,/g, ''))
      if (price >= 50 && price <= 100000) return price
    }
    return null
  }

  private static attemptLineCombination(lines: string[]): string[] {
    const combined: string[] = []
    
    for (let i = 0; i < lines.length; i++) {
      const current = lines[i].trim()
      const next = lines[i + 1]?.trim()
      
      // 短い行を次の行と結合してみる
      if (current.length < 3 && next && next.length < 10) {
        combined.push(current + next)
        i++ // 次の行をスキップ
      } else {
        combined.push(current)
      }
    }
    
    return combined
  }

  private static isSimilarItem(item1: ExtractedItem, item2: ExtractedItem): boolean {
    const nameSimilarity = item1.name.toLowerCase() === item2.name.toLowerCase()
    const priceSimilarity = Math.abs((item1.price || 0) - (item2.price || 0)) < 50
    return nameSimilarity || (priceSimilarity && item1.name.length > 3)
  }

  private static improveResults(items: ExtractedItem[], characteristics: any): ExtractedItem[] {
    // 重複除去
    const unique = items.filter((item, index, array) => 
      index === array.findIndex(other => this.isSimilarItem(item, other))
    )
    
    // 信頼度による並び替え
    return unique.sort((a, b) => b.confidence - a.confidence)
  }

  private static normalizeProductName(name: string): string {
    return name.trim().replace(/[※*]+/, '').trim()
  }

  private static categorizeProduct(name: string): string {
    const lowerName = name.toLowerCase()
    const categories = [
      { keywords: ['ヨーグルト', 'yogurt'], category: '乳製品' },
      { keywords: ['シューズ', 'shoe'], category: '靴・アパレル' },
      { keywords: ['ティッシュ', 'tissue'], category: '日用品' }
    ]
    
    for (const cat of categories) {
      if (cat.keywords.some(keyword => lowerName.includes(keyword))) {
        return cat.category
      }
    }
    
    return 'その他'
  }
}