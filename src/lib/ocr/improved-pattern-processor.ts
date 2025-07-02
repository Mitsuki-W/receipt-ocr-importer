import { 
  PatternProcessor, 
  OCRPatternConfig, 
  OCRParseResult, 
  ExtractedItem,
  ReceiptAnalysisContext
} from '@/types/ocr-patterns'
import { OCRDebugAnalyzer, DebugAnalysis } from './debug-analyzer'
import { ProductCategorizer } from './product-categorizer'
import { ProcessingStageManager } from './processing-stages'
import { StoreDetector } from './store-detector'

export class ImprovedPatternProcessor implements PatternProcessor {
  private patternCache: Map<string, RegExp> = new Map()
  private debugMode: boolean = false
  private stageManager: ProcessingStageManager

  constructor(debugMode: boolean = false) {
    this.debugMode = debugMode
    this.stageManager = new ProcessingStageManager()
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
    const detectedStore = await this.detectStoreType(text)
    context.detectedStoreType = detectedStore || undefined

    // パターンの前処理とフィルタリング
    const optimizedPatterns = this.optimizePatterns(patterns, detectedStore)

    let bestResult: OCRParseResult | null = null
    
    // 段階的処理実行
    for (const stage of this.stageManager.getStages()) {
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
      bestResult = await this.basicFallbackParsing(text)
      if (bestResult) {
        bestResult.metadata.fallbackUsed = true
      }
    }

    const finalResult = bestResult || {
      patternId: 'no-match',
      confidence: 0,
      items: [],
      metadata: {
        processingTime: Date.now() - startTime,
        patternsAttempted: ['fallback'],
        fallbackUsed: true
      }
    }

    // 後処理
    finalResult.items = this.postProcessItems(finalResult.items)
    finalResult.metadata.processingTime = Date.now() - startTime

    // デバッグ分析
    if (this.debugMode) {
      const finalAnalysis = OCRDebugAnalyzer.analyzeOCRResult(text, finalResult, patterns)
      console.log('📋 最終分析結果:')
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
   * 店舗タイプの検出
   */
  async detectStoreType(text: string): Promise<string | null> {
    if (StoreDetector.isWarehouseLike(text)) return 'warehouse'
    if (StoreDetector.isLifeLike(text)) return 'life'
    if (StoreDetector.isReceipt2Like(text)) return 'receipt2'
    if (StoreDetector.isReceipt3Like(text)) return 'receipt3'
    return null
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
   * 基本的なフォールバック処理
   */
  private async basicFallbackParsing(text: string): Promise<OCRParseResult> {
    const items: ExtractedItem[] = []
    const lines = this.preprocessLines(text)
    const currency = this.detectCurrency(text)
    
    // シンプルな価格パターン
    const pricePattern = /(.+?)\s+(\d{2,5})\s*$/
    
    lines.forEach((line, index) => {
      const match = line.match(pricePattern)
      if (match) {
        const [, name, priceStr] = match
        const price = parseInt(priceStr)
        
        if (name.length >= 2 && name.length <= 50 && price >= 1 && price <= 99999) {
          items.push({
            name: this.cleanItemName(name),
            price,
            currency,
            confidence: 0.3,
            sourcePattern: 'fallback',
            lineNumbers: [index],
            rawText: line,
            quantity: 1
          })
        }
      }
    })

    return {
      patternId: 'fallback',
      confidence: 0.3,
      items,
      metadata: {
        processingTime: 0,
        patternsAttempted: ['fallback'],
        fallbackUsed: true
      }
    }
  }

  /**
   * 通貨検出
   */
  private detectCurrency(text: string): 'JPY' | 'USD' {
    if (text.includes('¥') || text.includes('円')) return 'JPY'
    if (text.includes('$') || text.includes('USD')) return 'USD'
    
    const englishPatterns = [
      /\b(total|subtotal|tax|item|price|amount|receipt|store|thank you)\b/i,
      /\b(walmart|target|cvs|walgreens|safeway|kroger|costco)\b/i
    ]
    
    const hasEnglishFeatures = englishPatterns.some(pattern => pattern.test(text))
    const hasDollarPricing = /\b\d+\.\d{2}\b/.test(text)
    
    if (hasEnglishFeatures || hasDollarPricing) {
      return 'USD'
    }
    
    return 'JPY'
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
    if (!item.price || item.price <= 0 || item.price > 99999) return false
    if (item.confidence < 0.1) return false
    
    // 明らかに無効なパターンを除外
    if (/^\d+$/.test(item.name)) return false
    if (/^[^a-zA-Z\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+$/.test(item.name)) return false
    
    return true
  }

  // 既存のPatternProcessorインターフェース実装
  validateResults(result: OCRParseResult): boolean {
    return result.items.length > 0 && result.confidence > 0.1
  }
}