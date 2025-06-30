import { 
  PatternProcessor, 
  OCRPatternConfig, 
  OCRParseResult, 
  ExtractedItem,
  ReceiptAnalysisContext,
  OCRPattern
} from '@/types/ocr-patterns'
import { OCRDebugAnalyzer, DebugAnalysis } from './debug-analyzer'
import { ProductCategorizer } from './product-categorizer'

export interface ProcessingStage {
  name: string
  description: string
  execute: (context: ReceiptAnalysisContext, patterns: OCRPatternConfig[]) => Promise<OCRParseResult>
}

export class ImprovedPatternProcessor implements PatternProcessor {
  private storeDetectors: Map<string, (text: string) => boolean> = new Map()
  private patternCache: Map<string, RegExp> = new Map()
  private debugMode: boolean = false
  private processingStages: ProcessingStage[] = []

  constructor(debugMode: boolean = false) {
    this.debugMode = debugMode
    this.initializeStoreDetectors()
    this.initializeProcessingStages()
  }

  /**
   * メイン処理 - 段階的パターンマッチング
   */
  async processText(text: string, patterns: OCRPatternConfig[]): Promise<OCRParseResult> {
    const startTime = Date.now()
    const context: ReceiptAnalysisContext = {
      originalText: text,
      lines: this.preprocessLines(text),
      processingOptions: {
        enableFallback: true,
        maxProcessingTime: 10000,
        confidenceThreshold: 0.3
      }
    }

    if (this.debugMode) {
      console.log('🔍 OCR処理開始')
      console.log(`📝 入力テキスト行数: ${context.lines.length}`)
    }

    // 事前分析
    const debugAnalysis = this.debugMode ? 
      OCRDebugAnalyzer.analyzeOCRResult(text, { patternId: 'pre-analysis', confidence: 0, items: [], metadata: { processingTime: 0, patternsAttempted: [] } }, patterns) : 
      null

    if (debugAnalysis && this.debugMode) {
      console.log('📊 事前分析完了')
      console.log(`🏪 検出店舗: ${debugAnalysis.patternAnalysis.storeDetection.detectedStore}`)
      console.log(`💰 価格行: ${debugAnalysis.textAnalysis.priceLines.length}件`)
    }

    // 店舗タイプ検出（改善版）
    const detectedStore = await this.enhancedStoreDetection(text)
    context.detectedStoreType = detectedStore || undefined

    // パターンの前処理とフィルタリング
    const optimizedPatterns = this.optimizePatterns(patterns, detectedStore)

    let bestResult: OCRParseResult | null = null
    
    // 段階的処理実行
    for (const stage of this.processingStages) {
      if (Date.now() - startTime > context.processingOptions.maxProcessingTime) {
        if (this.debugMode) console.log(`⏰ タイムアウト: ${stage.name}をスキップ`)
        break
      }

      if (this.debugMode) {
        console.log(`🔄 処理段階: ${stage.name}`)
      }

      try {
        const stageResult = await stage.execute(context, optimizedPatterns)
        
        if (stageResult.confidence >= context.processingOptions.confidenceThreshold) {
          if (!bestResult || stageResult.confidence > bestResult.confidence) {
            bestResult = stageResult
            bestResult.metadata.primaryStage = stage.name
          }

          // 高信頼度の結果が得られた場合は早期終了
          if (stageResult.confidence >= 0.8) {
            if (this.debugMode) console.log(`✅ 高信頼度結果取得: ${stage.name}`)
            break
          }
        }
      } catch (error) {
        if (this.debugMode) console.warn(`❌ 段階 ${stage.name} でエラー:`, error)
        continue
      }
    }

    // フォールバック処理
    if (!bestResult && context.processingOptions.enableFallback) {
      if (this.debugMode) console.log('🆘 フォールバック処理実行')
      bestResult = await this.enhancedFallbackProcessing(context)
      if (bestResult) {
        bestResult.metadata.fallbackUsed = true
      }
    }

    const processingTime = Date.now() - startTime
    const finalResult = bestResult || {
      patternId: 'no-match',
      confidence: 0,
      items: [],
      metadata: {
        processingTime,
        patternsAttempted: ['all-stages'],
        fallbackUsed: false
      }
    }

    // 最終結果の後処理
    finalResult.items = this.postProcessItems(finalResult.items)
    finalResult.metadata.processingTime = processingTime

    if (this.debugMode) {
      console.log(`🎯 処理完了: ${finalResult.items.length}件検出 (${processingTime}ms)`)
      const finalAnalysis = OCRDebugAnalyzer.analyzeOCRResult(text, finalResult, patterns)
      console.log(OCRDebugAnalyzer.generateDebugReport(finalAnalysis))
    }

    return finalResult
  }

  /**
   * 行の前処理
   */
  private preprocessLines(text: string): string[] {
    return text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => {
        // 不要な文字の除去
        return line
          .replace(/[""'']/g, '') // 引用符除去
          .replace(/\s+/g, ' ')   // 空白正規化
          .trim()
      })
  }

  /**
   * 店舗検出の改善版
   */
  private async enhancedStoreDetection(text: string): Promise<string | null> {
    const normalizedText = text.toLowerCase()
    const scores: Map<string, number> = new Map()

    // 各店舗タイプのスコア計算
    for (const [storeId, detector] of this.storeDetectors) {
      let score = 0
      
      // 基本的な検出
      if (detector(normalizedText)) {
        score += 10
      }

      // 追加の重み付け
      const storeKeywords = this.getStoreKeywords(storeId)
      for (const keyword of storeKeywords) {
        const occurrences = (normalizedText.match(new RegExp(keyword.toLowerCase(), 'g')) || []).length
        score += occurrences * 3
      }

      // レイアウトパターンの考慮
      if (this.detectLayoutPattern(text, storeId)) {
        score += 5
      }

      if (score > 0) {
        scores.set(storeId, score)
      }
    }

    // 最高スコアの店舗を返す
    if (scores.size === 0) return null
    
    let bestStore = null
    let bestScore = 0
    for (const [store, score] of scores) {
      if (score > bestScore) {
        bestScore = score
        bestStore = store
      }
    }

    return bestScore >= 10 ? bestStore : null
  }

  /**
   * パターンの最適化
   */
  private optimizePatterns(patterns: OCRPatternConfig[], detectedStore: string | null): OCRPatternConfig[] {
    let optimized = [...patterns]

    // 店舗タイプによるフィルタリング
    if (detectedStore) {
      optimized = optimized.filter(pattern => 
        pattern.storeIdentifiers.length === 0 || 
        pattern.storeIdentifiers.includes(detectedStore)
      )
    }

    // 優先度でソート
    optimized.sort((a, b) => b.priority - a.priority)

    // 信頼性によるフィルタリング
    optimized = optimized.filter(pattern => pattern.enabled && pattern.confidence >= 0.1)

    return optimized
  }

  /**
   * 処理段階の初期化
   */
  private initializeProcessingStages() {
    this.processingStages = [
      {
        name: 'exact-pattern-matching',
        description: '厳密パターンマッチング',
        execute: this.exactPatternMatching.bind(this)
      },
      {
        name: 'flexible-pattern-matching',
        description: '柔軟パターンマッチング',
        execute: this.flexiblePatternMatching.bind(this)
      },
      {
        name: 'heuristic-parsing',
        description: 'ヒューリスティック解析',
        execute: this.heuristicParsing.bind(this)
      },
      {
        name: 'ai-assisted-parsing',
        description: 'AI支援解析',
        execute: this.aiAssistedParsing.bind(this)
      }
    ]
  }

  /**
   * 段階1: 厳密パターンマッチング
   */
  private async exactPatternMatching(context: ReceiptAnalysisContext, patterns: OCRPatternConfig[]): Promise<OCRParseResult> {
    const items: ExtractedItem[] = []
    const usedLines = new Set<number>()

    // 高信頼度パターンのみ使用
    const exactPatterns = patterns.filter(p => p.confidence >= 0.8)

    for (const pattern of exactPatterns) {
      const patternItems = await this.processWithExactPattern(context, pattern, usedLines)
      items.push(...patternItems)
    }

    const confidence = items.length > 0 ? 
      items.reduce((sum, item) => sum + item.confidence, 0) / items.length : 0

    return {
      patternId: 'exact-matching',
      confidence,
      items,
      metadata: {
        processingTime: 0,
        patternsAttempted: exactPatterns.map(p => p.id),
        itemsFromStage: items.length
      }
    }
  }

  /**
   * 段階2: 柔軟パターンマッチング
   */
  private async flexiblePatternMatching(context: ReceiptAnalysisContext, patterns: OCRPatternConfig[]): Promise<OCRParseResult> {
    const items: ExtractedItem[] = []
    const usedLines = new Set<number>()

    // 中程度の信頼度パターンを使用
    const flexiblePatterns = patterns.filter(p => p.confidence >= 0.5 && p.confidence < 0.8)

    for (const pattern of flexiblePatterns) {
      const patternItems = await this.processWithFlexiblePattern(context, pattern, usedLines)
      items.push(...patternItems)
    }

    const confidence = items.length > 0 ? 
      items.reduce((sum, item) => sum + item.confidence, 0) / items.length : 0

    return {
      patternId: 'flexible-matching',
      confidence: confidence * 0.9, // 柔軟マッチングは若干信頼度を下げる
      items,
      metadata: {
        processingTime: 0,
        patternsAttempted: flexiblePatterns.map(p => p.id),
        itemsFromStage: items.length
      }
    }
  }

  /**
   * 段階3: ヒューリスティック解析
   */
  private async heuristicParsing(context: ReceiptAnalysisContext, patterns: OCRPatternConfig[]): Promise<OCRParseResult> {
    const items: ExtractedItem[] = []

    // ヒューリスティックなパターン発見
    const heuristicItems = this.findItemsWithHeuristics(context.lines)
    items.push(...heuristicItems)

    const confidence = items.length > 0 ? 0.6 : 0 // ヒューリスティックは中程度の信頼度

    return {
      patternId: 'heuristic-parsing',
      confidence,
      items,
      metadata: {
        processingTime: 0,
        patternsAttempted: ['heuristic'],
        itemsFromStage: items.length
      }
    }
  }

  /**
   * 段階4: AI支援解析（将来の拡張用）
   */
  private async aiAssistedParsing(context: ReceiptAnalysisContext, patterns: OCRPatternConfig[]): Promise<OCRParseResult> {
    // 現在は基本的なルールベース処理
    return {
      patternId: 'ai-assisted',
      confidence: 0,
      items: [],
      metadata: {
        processingTime: 0,
        patternsAttempted: ['ai-placeholder'],
        itemsFromStage: 0
      }
    }
  }

  /**
   * 厳密パターン処理
   */
  private async processWithExactPattern(
    context: ReceiptAnalysisContext, 
    pattern: OCRPatternConfig, 
    usedLines: Set<number>
  ): Promise<ExtractedItem[]> {
    const items: ExtractedItem[] = []

    // 複数行パターン優先
    if (pattern.multiLinePatterns) {
      for (const multiPattern of pattern.multiLinePatterns) {
        const multiItems = this.processMultiLinePattern(context.lines, multiPattern, usedLines)
        items.push(...multiItems)
      }
    }

    // 単行パターン
    if (pattern.patterns) {
      for (const singlePattern of pattern.patterns) {
        const singleItems = this.processSingleLinePattern(context.lines, singlePattern, usedLines)
        items.push(...singleItems)
      }
    }

    return items
  }

  /**
   * 柔軟パターン処理
   */
  private async processWithFlexiblePattern(
    context: ReceiptAnalysisContext, 
    pattern: OCRPatternConfig, 
    usedLines: Set<number>
  ): Promise<ExtractedItem[]> {
    // 厳密処理と同じだが、エラー許容度を上げる
    return this.processWithExactPattern(context, pattern, usedLines)
  }

  /**
   * ヒューリスティックな商品発見
   */
  private findItemsWithHeuristics(lines: string[]): ExtractedItem[] {
    const items: ExtractedItem[] = []

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      
      // 価格パターンの検出（日本円・ドル対応）
      const priceMatch = line.match(/(\d+(?:\.\d{1,2})?)\s*[円¥$]?\s*$/) || line.match(/\$?(\d+(?:\.\d{1,2})?)/);
      if (priceMatch) {
        const price = this.parsePrice(priceMatch[1], line)
        
        // 前の行から商品名を推測
        let name = ''
        for (let j = i - 1; j >= Math.max(0, i - 3); j--) {
          const prevLine = lines[j]
          if (this.isLikelyItemName(prevLine)) {
            name = prevLine
            break
          }
        }

        if (name && price >= 1 && price <= 99999) {
          items.push({
            name,
            price,
            quantity: 1,
            confidence: 0.5,
            sourcePattern: 'heuristic-price',
            lineNumbers: [i],
            rawText: line,
            currency: this.detectCurrency(line)
          })
        }
      }

      // インライン価格パターン（日本円・ドル対応）
      const inlineMatch = line.match(/^(.+?)\s+(\d+(?:\.\d{1,2})?)\s*[円¥$]?\s*$/) || line.match(/^(.+?)\s+\$?(\d+(?:\.\d{1,2})?)$/);
      if (inlineMatch) {
        const name = inlineMatch[1].trim()
        const price = this.parsePrice(inlineMatch[2], line)

        if (this.isLikelyItemName(name) && price >= 1 && price <= 99999) {
          items.push({
            name,
            price,
            quantity: 1,
            confidence: 0.6,
            sourcePattern: 'heuristic-inline',
            lineNumbers: [i],
            rawText: line,
            currency: this.detectCurrency(line)
          })
        }
      }
    }

    return items
  }

  /**
   * 商品名らしさの判定
   */
  private isLikelyItemName(text: string): boolean {
    if (!text || text.length < 2 || text.length > 50) return false
    if (/^\d+$/.test(text)) return false
    if (/^[¥\d\s\-*]+$/.test(text)) return false
    
    // 日本語を含む、または英字を含む
    const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text)
    const hasAlpha = /[a-zA-Z]/.test(text)
    
    return hasJapanese || hasAlpha
  }

  /**
   * 強化されたフォールバック処理
   */
  private async enhancedFallbackProcessing(context: ReceiptAnalysisContext): Promise<OCRParseResult> {
    const items: ExtractedItem[] = []

    // 複数のフォールバック手法を試行
    const fallbackMethods = [
      this.basicPricePatternFallback.bind(this),
      this.positionBasedFallback.bind(this),
      this.statisticalFallback.bind(this)
    ]

    for (const method of fallbackMethods) {
      const methodItems = method(context.lines)
      items.push(...methodItems)
    }

    // 重複除去
    const uniqueItems = this.removeDuplicateItems(items)

    return {
      patternId: 'enhanced-fallback',
      confidence: 0.3,
      items: uniqueItems,
      metadata: {
        processingTime: 0,
        patternsAttempted: ['enhanced-fallback'],
        fallbackUsed: true,
        itemsFromStage: uniqueItems.length
      }
    }
  }

  /**
   * 基本価格パターンフォールバック
   */
  private basicPricePatternFallback(lines: string[]): ExtractedItem[] {
    const items: ExtractedItem[] = []
    const pricePattern = /(.+?)\s+(\d+(?:\.\d{1,2})?)\s*[円¥$]?\s*$/

    lines.forEach((line, index) => {
      const match = line.match(pricePattern)
      if (match) {
        const name = match[1].trim()
        const price = this.parsePrice(match[2], line)

        if (this.isLikelyItemName(name) && price >= 1 && price <= 99999) {
          items.push({
            name,
            price,
            quantity: 1,
            confidence: 0.3,
            sourcePattern: 'fallback-basic',
            lineNumbers: [index],
            rawText: line
          })
        }
      }
    })

    return items
  }

  /**
   * 位置ベースフォールバック
   */
  private positionBasedFallback(lines: string[]): ExtractedItem[] {
    const items: ExtractedItem[] = []

    for (let i = 0; i < lines.length - 1; i++) {
      const currentLine = lines[i]
      const nextLine = lines[i + 1]

      // 商品名 + 価格の2行パターン
      if (this.isLikelyItemName(currentLine)) {
        const priceMatch = nextLine.match(/^[¥$]?(\d+(?:\.\d{1,2})?)\s*[円¥$]?\s*$/)
        if (priceMatch) {
          const price = this.parsePrice(priceMatch[1], nextLine)
          if (price >= 1 && price <= 99999) {
            items.push({
              name: currentLine,
              price,
              quantity: 1,
              confidence: 0.4,
              sourcePattern: 'fallback-position',
              lineNumbers: [i, i + 1],
              rawText: `${currentLine} | ${nextLine}`
            })
          }
        }
      }
    }

    return items
  }

  /**
   * 統計的フォールバック
   */
  private statisticalFallback(lines: string[]): ExtractedItem[] {
    // 価格の分布を分析して妥当性を判定
    const prices = lines
      .map(line => line.match(/(\d+(?:\.\d{1,2})?)/))
      .filter(match => match)
      .map(match => this.parsePrice(match![1], ''))
      .filter(price => price >= 1 && price <= 99999)

    if (prices.length === 0) return []

    const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length
    const priceThreshold = avgPrice * 10 // 平均の10倍以上は除外

    return this.basicPricePatternFallback(lines).filter(item => 
      item.price && item.price <= priceThreshold
    )
  }

  /**
   * 重複アイテムの除去
   */
  private removeDuplicateItems(items: ExtractedItem[]): ExtractedItem[] {
    const seen = new Set<string>()
    return items.filter(item => {
      const key = `${item.name.toLowerCase()}-${item.price}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }

  /**
   * アイテムの後処理
   */
  private postProcessItems(items: ExtractedItem[]): ExtractedItem[] {
    return items
      .map(item => ({
        ...item,
        name: this.cleanItemName(item.name),
        category: this.categorizeItem(item.name)
      }))
      .filter(item => this.isValidItem(item))
      .sort((a, b) => {
        // 信頼度順、次に行番号順
        if (a.confidence !== b.confidence) {
          return b.confidence - a.confidence
        }
        return Math.min(...a.lineNumbers) - Math.min(...b.lineNumbers)
      })
  }

  /**
   * 商品名のクリーンアップ
   */
  private cleanItemName(name: string): string {
    return name
      .replace(/^[*\s]+/, '') // 先頭の記号除去
      .replace(/[*\s]+$/, '') // 末尾の記号除去
      .replace(/\s+/g, ' ')   // 空白正規化
      .trim()
  }

  /**
   * 商品のカテゴリ分類
   */
  private categorizeItem(name: string): string {
    return ProductCategorizer.categorize(name)
  }

  /**
   * アイテムの妥当性チェック
   */
  private isValidItem(item: ExtractedItem): boolean {
    if (!item.name || item.name.length < 2 || item.name.length > 50) return false
    if (!item.price || item.price <= 0 || item.price > 99999) return false // ドル単位なので上限を元に戻す
    if (item.confidence < 0.1) return false
    
    // 明らかに無効なパターンを除外
    if (/^\d+$/.test(item.name)) return false
    if (/^[^\w\s\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+$/.test(item.name)) return false
    
    return true
  }

  /**
   * 価格文字列をパース（日本円・ドル対応）
   */
  private parsePrice(priceText: string, fullText: string = ''): number {
    // 数字とピリオドのみ残す
    const cleanText = priceText.replace(/[^\d.]/g, '')
    const price = parseFloat(cleanText)
    
    if (isNaN(price)) return 0
    
    // 小数点第2位がある場合はドル形式と判断
    if (/\d+\.\d{2}/.test(cleanText)) {
      // ドル表記：小数点第2位まで保持（ドル単位）
      return Math.round(price * 100) / 100
    } else {
      // 日本円：整数に丸める
      return Math.round(price)
    }
  }

  /**
   * 通貨を検出（英語レシート対応強化）
   */
  private detectCurrency(text: string): string {
    // 円記号があれば確実にJPY
    if (text.includes('¥') || text.includes('円')) return 'JPY'
    
    // ドル記号があれば確実にUSD
    if (text.includes('$') || text.includes('USD')) return 'USD'
    
    // 英語の特徴的な単語を検出
    const englishPatterns = [
      /\b(total|subtotal|tax|item|price|amount|receipt|store|thank you)\b/i,
      /\b(walmart|target|cvs|walgreens|safeway|kroger|costco)\b/i,
      /\b(cash|credit|debit|change)\b/i
    ]
    
    const hasEnglishFeatures = englishPatterns.some(pattern => pattern.test(text))
    
    // 小数点第2位形式の価格パターン（ドル特有）
    const hasDollarPricing = /\b\d+\.\d{2}\b/.test(text)
    
    // 英語の特徴 + 小数点価格 = USD
    if (hasEnglishFeatures || hasDollarPricing) {
      return 'USD'
    }
    
    return 'JPY' // デフォルトは日本円
  }

  // 既存メソッドの実装（簡略化）
  private initializeStoreDetectors() {
    this.storeDetectors.set('warehouse', (text) => /warehouse|大型店|wholesale/i.test(text))
    this.storeDetectors.set('supermarket-a', (text) => /スーパーa|super-a/i.test(text))
    this.storeDetectors.set('supermarket-b', (text) => /スーパーb|super-b/i.test(text))
    this.storeDetectors.set('convenience-a', (text) => /コンビニa|convenience-a/i.test(text))
    this.storeDetectors.set('convenience-b', (text) => /コンビニb|convenience-b/i.test(text))
  }

  private getStoreKeywords(storeId: string): string[] {
    const keywords: Record<string, string[]> = {
      'warehouse': ['warehouse', 'wholesale', '大型店'],
      'supermarket-a': ['スーパーa', 'super-a'],
      'supermarket-b': ['スーパーb', 'super-b'],
      'convenience-a': ['コンビニa', 'convenience-a'],
      'convenience-b': ['コンビニb', 'convenience-b']
    }
    return keywords[storeId] || []
  }

  private detectLayoutPattern(text: string, storeId: string): boolean {
    // 店舗固有のレイアウトパターンを検出
    // 実装は店舗ごとに特化
    return false
  }

  private processMultiLinePattern(lines: string[], pattern: any, usedLines: Set<number>): ExtractedItem[] {
    // 複数行パターン処理の簡略実装
    return []
  }

  private processSingleLinePattern(lines: string[], pattern: any, usedLines: Set<number>): ExtractedItem[] {
    // 単行パターン処理の簡略実装
    return []
  }

  async detectStoreType(text: string): Promise<string | null> {
    return this.enhancedStoreDetection(text)
  }

  validateResults(result: OCRParseResult): boolean {
    return result.items.length > 0 && result.confidence > 0.2
  }
}