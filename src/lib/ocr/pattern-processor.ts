import { 
  PatternProcessor, 
  OCRPatternConfig, 
  OCRParseResult, 
  ExtractedItem,
  ReceiptAnalysisContext,
  OCRPattern
} from '@/types/ocr-patterns'

export class AdvancedPatternProcessor implements PatternProcessor {
  private storeDetectors: Map<string, (text: string) => boolean> = new Map()
  private patternCache: Map<string, RegExp> = new Map()

  constructor() {
    this.initializeStoreDetectors()
  }

  async processText(text: string, patterns: OCRPatternConfig[]): Promise<OCRParseResult> {
    const startTime = Date.now()
    const context: ReceiptAnalysisContext = {
      originalText: text,
      lines: text.split('\n').filter(line => line.trim()),
      processingOptions: {
        enableFallback: true,
        maxProcessingTime: 5000,
        confidenceThreshold: 0.3
      }
    }

    // 店舗タイプ検出
    const detectedStore = await this.detectStoreType(text)
    context.detectedStoreType = detectedStore || undefined

    // パターンを優先度順にソート
    const sortedPatterns = patterns
      .filter(p => p.enabled)
      .sort((a, b) => b.priority - a.priority)

    let bestResult: OCRParseResult | null = null
    const patternsAttempted: string[] = []

    // パターンを順次試行
    for (const pattern of sortedPatterns) {
      if (Date.now() - startTime > context.processingOptions.maxProcessingTime) {
        break
      }

      // 店舗マッチング確認
      if (detectedStore && pattern.storeIdentifiers.length > 0) {
        if (!pattern.storeIdentifiers.includes(detectedStore)) {
          continue
        }
      }

      try {
        const result = await this.processWithPattern(context, pattern)
        patternsAttempted.push(pattern.id)

        if (result && result.confidence >= context.processingOptions.confidenceThreshold) {
          if (!bestResult || result.confidence > bestResult.confidence) {
            bestResult = result
          }
          
          // 高信頼度の結果が得られた場合は早期終了
          if (result.confidence >= 0.8) {
            break
          }
        }
      } catch (error) {
        console.warn(`Pattern ${pattern.id} failed:`, error)
        continue
      }
    }

    // フォールバック処理
    if (!bestResult && context.processingOptions.enableFallback) {
      bestResult = await this.fallbackProcessing(context)
      if (bestResult) {
        bestResult.metadata.fallbackUsed = true
      }
    }

    const processingTime = Date.now() - startTime

    return bestResult || {
      patternId: 'no-match',
      confidence: 0,
      items: [],
      metadata: {
        processingTime,
        patternsAttempted,
        fallbackUsed: false
      }
    }
  }

  async detectStoreType(text: string): Promise<string | null> {
    const normalizedText = text.toLowerCase()
    
    for (const [storeId, detector] of this.storeDetectors) {
      if (detector(normalizedText)) {
        return storeId
      }
    }
    
    return null
  }

  validateResults(results: OCRParseResult): boolean {
    if (!results.items.length) return false
    
    // アイテムの基本検証
    return results.items.every(item => 
      item.name && 
      item.name.length >= 2 && 
      item.confidence >= 0.1
    )
  }

  optimizeResults(results: OCRParseResult): OCRParseResult {
    // 重複除去
    const uniqueItems = this.removeDuplicates(results.items)
    
    // カテゴリ推定
    const categorizedItems = uniqueItems.map(item => ({
      ...item,
      category: item.category || this.inferCategory(item.name)
    }))

    // 信頼度順ソート
    const sortedItems = categorizedItems.sort((a, b) => b.confidence - a.confidence)

    return {
      ...results,
      items: sortedItems,
      confidence: this.calculateOverallConfidence(sortedItems)
    }
  }

  private async processWithPattern(
    context: ReceiptAnalysisContext, 
    patternConfig: OCRPatternConfig
  ): Promise<OCRParseResult | null> {
    const items: ExtractedItem[] = []
    
    for (const pattern of patternConfig.patterns) {
      const patternItems = await this.applyPattern(context, pattern)
      items.push(...patternItems)
    }

    if (items.length === 0) return null

    const confidence = this.calculatePatternConfidence(items, patternConfig)
    
    return {
      patternId: patternConfig.id,
      confidence,
      items,
      metadata: {
        storeType: context.detectedStoreType,
        processingTime: 0,
        patternsAttempted: [patternConfig.id]
      }
    }
  }

  private async applyPattern(
    context: ReceiptAnalysisContext, 
    pattern: OCRPattern
  ): Promise<ExtractedItem[]> {
    switch (pattern.type) {
      case 'single-line':
        return this.applySingleLinePattern(context, pattern)
      case 'multi-line':
        return this.applyMultiLinePattern(context, pattern)
      case 'context-aware':
        return this.applyContextAwarePattern(context, pattern)
      case 'template-based':
        return this.applyTemplateBasedPattern(context, pattern)
      default:
        return []
    }
  }

  private applySingleLinePattern(
    context: ReceiptAnalysisContext, 
    pattern: OCRPattern
  ): ExtractedItem[] {
    if (!pattern.regex) return []
    
    const regex = this.getOrCreateRegex(pattern.regex)
    const items: ExtractedItem[] = []

    context.lines.forEach((line, lineIndex) => {
      const match = line.match(regex)
      if (match) {
        const item = this.extractFromMatch(match, pattern, [lineIndex], line)
        if (item && this.validateItem(item, pattern)) {
          items.push(item)
        }
      }
    })

    return items
  }

  private applyMultiLinePattern(
    context: ReceiptAnalysisContext, 
    pattern: OCRPattern
  ): ExtractedItem[] {
    if (!pattern.lineCount || pattern.lineCount < 2) return []
    
    const items: ExtractedItem[] = []
    const lines = context.lines

    for (let i = 0; i <= lines.length - pattern.lineCount; i++) {
      const lineGroup = lines.slice(i, i + pattern.lineCount)
      const item = this.extractFromMultiLine(lineGroup, pattern, i)
      
      if (item && this.validateItem(item, pattern)) {
        items.push(item)
      }
    }

    return items
  }

  private applyContextAwarePattern(
    context: ReceiptAnalysisContext, 
    pattern: OCRPattern
  ): ExtractedItem[] {
    // コンテキストルールを使用した高度な解析
    const items: ExtractedItem[] = []
    const lines = context.lines

    for (let i = 0; i < lines.length; i++) {
      if (this.matchesContextRules(lines, i, pattern.contextRules || [])) {
        const item = this.extractWithContext(lines, i, pattern)
        if (item && this.validateItem(item, pattern)) {
          items.push(item)
        }
      }
    }

    return items
  }

  private applyTemplateBasedPattern(
    context: ReceiptAnalysisContext, 
    pattern: OCRPattern
  ): ExtractedItem[] {
    // テンプレートマッチングによる解析
    // 将来的にMLモデルを使用した解析も可能
    return []
  }

  private async fallbackProcessing(
    context: ReceiptAnalysisContext
  ): Promise<OCRParseResult | null> {
    // 基本的なフォールバック処理
    const items: ExtractedItem[] = []
    const pricePattern = /(\d{1,5})\s*円?$/
    
    context.lines.forEach((line, index) => {
      const priceMatch = line.match(pricePattern)
      if (priceMatch && index > 0) {
        const prevLine = context.lines[index - 1]
        if (prevLine && prevLine.length > 2 && prevLine.length < 30) {
          items.push({
            name: prevLine.trim(),
            price: parseInt(priceMatch[1]),
            confidence: 0.3,
            sourcePattern: 'fallback',
            lineNumbers: [index - 1, index],
            rawText: `${prevLine}\n${line}`
          })
        }
      }
    })

    return items.length > 0 ? {
      patternId: 'fallback',
      confidence: 0.3,
      items,
      metadata: {
        processingTime: 0,
        patternsAttempted: ['fallback'],
        fallbackUsed: true
      }
    } : null
  }

  // ヘルパーメソッド
  private initializeStoreDetectors(): void {
    this.storeDetectors.set('costco', (text) => 
      /costco|コストコ|wholesale/i.test(text))
    this.storeDetectors.set('life', (text) => 
      /life|ライフ/i.test(text))
    this.storeDetectors.set('aeon', (text) => 
      /aeon|イオン|ジャスコ/i.test(text))
    this.storeDetectors.set('seven-eleven', (text) => 
      /seven|セブン|711/i.test(text))
  }

  private getOrCreateRegex(pattern: string): RegExp {
    if (!this.patternCache.has(pattern)) {
      this.patternCache.set(pattern, new RegExp(pattern, 'i'))
    }
    return this.patternCache.get(pattern)!
  }

  private extractFromMatch(
    match: RegExpMatchArray, 
    pattern: OCRPattern, 
    lineNumbers: number[], 
    rawText: string
  ): ExtractedItem | null {
    const item: Partial<ExtractedItem> = {
      confidence: pattern.confidence,
      sourcePattern: pattern.id,
      lineNumbers,
      rawText
    }

    for (const rule of pattern.extractionRules) {
      const value = this.applyExtractionRule(rule, match)
      if (value !== null) {
        item[rule.field as keyof ExtractedItem] = value as any
      }
    }

    return item.name ? item as ExtractedItem : null
  }

  private extractFromMultiLine(
    lines: string[], 
    pattern: OCRPattern, 
    startIndex: number
  ): ExtractedItem | null {
    // 複数行からの抽出ロジック
    const combinedText = lines.join('\n')
    const lineNumbers = Array.from({length: lines.length}, (_, i) => startIndex + i)
    
    const item: Partial<ExtractedItem> = {
      confidence: pattern.confidence,
      sourcePattern: pattern.id,
      lineNumbers,
      rawText: combinedText
    }

    // 簡単な例: 最初の行を商品名、最後の行から価格を抽出
    item.name = lines[0]?.trim()
    
    const lastLine = lines[lines.length - 1]
    const priceMatch = lastLine?.match(/(\d+)/)
    if (priceMatch) {
      item.price = parseInt(priceMatch[1])
    }

    return item.name ? item as ExtractedItem : null
  }

  private extractWithContext(
    lines: string[], 
    index: number, 
    pattern: OCRPattern
  ): ExtractedItem | null {
    // コンテキスト情報を使用した抽出
    return null
  }

  private matchesContextRules(
    lines: string[], 
    index: number, 
    rules: any[]
  ): boolean {
    // コンテキストルールのマッチング
    return rules.length === 0
  }

  private applyExtractionRule(rule: any, match: RegExpMatchArray): any {
    if (rule.source === 'regex-group' && rule.groupIndex !== undefined) {
      const value = match[rule.groupIndex]
      if (rule.field === 'price' || rule.field === 'quantity') {
        return value ? parseInt(value) : undefined
      }
      return value?.trim()
    }
    return rule.defaultValue
  }

  private validateItem(item: ExtractedItem, pattern: OCRPattern): boolean {
    if (!pattern.validationRules) return true
    
    return pattern.validationRules.every(rule => {
      const value = item[rule.field as keyof ExtractedItem]
      
      switch (rule.type) {
        case 'range':
          return typeof value === 'number' && 
                 value >= (rule.min || 0) && 
                 value <= (rule.max || Infinity)
        case 'pattern':
          return !rule.pattern || new RegExp(rule.pattern).test(String(value))
        case 'length':
          return !value || (String(value).length >= (rule.min || 0) && 
                           String(value).length <= (rule.max || Infinity))
        default:
          return true
      }
    })
  }

  private removeDuplicates(items: ExtractedItem[]): ExtractedItem[] {
    const seen = new Set<string>()
    return items.filter(item => {
      const key = `${item.name}-${item.price || 0}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }

  private inferCategory(name: string): string {
    const categoryKeywords = {
      '野菜': ['レタス', 'キャベツ', 'にんじん', 'たまねぎ', 'じゃがいも'],
      '肉類': ['牛肉', '豚肉', '鶏肉', 'ひき肉', 'ソーセージ'],
      '乳製品': ['牛乳', 'ヨーグルト', 'チーズ', 'バター'],
    }

    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some(keyword => name.includes(keyword))) {
        return category
      }
    }
    
    return 'その他'
  }

  private calculatePatternConfidence(
    items: ExtractedItem[], 
    pattern: OCRPatternConfig
  ): number {
    if (items.length === 0) return 0
    
    const avgItemConfidence = items.reduce((sum, item) => sum + item.confidence, 0) / items.length
    return Math.min(avgItemConfidence * pattern.confidence, 1)
  }

  private calculateOverallConfidence(items: ExtractedItem[]): number {
    if (items.length === 0) return 0
    return items.reduce((sum, item) => sum + item.confidence, 0) / items.length
  }
}