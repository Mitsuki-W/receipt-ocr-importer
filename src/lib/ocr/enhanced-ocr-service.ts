import { OCRPatternManager } from './pattern-manager'
import { AdvancedPatternProcessor } from './pattern-processor'
import { PatternOptimizer } from './pattern-optimizer'
import { OCRParseResult, ExtractedItem } from '@/types/ocr-patterns'

export interface EnhancedOCROptions {
  enablePatternMatching: boolean
  maxProcessingTime: number
  confidenceThreshold: number
  enableFallback: boolean
  debugMode: boolean
}

export class EnhancedOCRService {
  private patternManager: OCRPatternManager
  private processor: AdvancedPatternProcessor

  constructor() {
    this.patternManager = new OCRPatternManager()
    this.processor = new AdvancedPatternProcessor()
  }

  async processImage(
    imageFile: File, 
    options: Partial<EnhancedOCROptions> = {}
  ): Promise<{
    success: boolean
    extractedText: string
    items: ExtractedItem[]
    metadata?: {
      processingTime: number
      storeType?: string
      patternUsed?: string
      confidence: number
      fallbackUsed?: boolean
    }
  }> {
    const defaultOptions: EnhancedOCROptions = {
      enablePatternMatching: true,
      maxProcessingTime: 10000,
      confidenceThreshold: 0.3,
      enableFallback: true,
      debugMode: false
    }

    const mergedOptions = { ...defaultOptions, ...options }
    const startTime = Date.now()

    try {
      // 1. OCR処理でテキスト抽出
      const ocrText = await this.performOCR(imageFile)
      
      if (mergedOptions.debugMode) {
        console.log('Extracted OCR text:', ocrText)
      }

      // 2. パターンマッチングによる解析
      let parseResult: OCRParseResult
      
      if (mergedOptions.enablePatternMatching) {
        // 店舗タイプ検出
        const storeType = await this.processor.detectStoreType(ocrText)
        
        // 最適なパターンを取得
        const patterns = await this.patternManager.getOptimalPatterns(storeType || undefined)
        
        if (mergedOptions.debugMode) {
          console.log(`Detected store type: ${storeType}`)
          console.log(`Available patterns: ${patterns.length}`)
        }

        // パターン処理実行
        parseResult = await this.processor.processText(ocrText, patterns)
        
        // 結果の最適化（高度な最適化を使用）
        parseResult = PatternOptimizer.optimizeResults(parseResult)
      } else {
        // パターンマッチング無効時はフォールバック処理のみ
        parseResult = await this.fallbackParsing(ocrText)
      }

      const processingTime = Date.now() - startTime

      // 3. 結果の検証と整形
      const isValid = this.processor.validateResults(parseResult)
      
      if (!isValid && mergedOptions.enableFallback) {
        // 検証失敗時のフォールバック
        parseResult = await this.fallbackParsing(ocrText)
        parseResult.metadata.fallbackUsed = true
      }

      // 結果の品質評価
      const evaluation = PatternOptimizer.evaluateResults(parseResult)

      return {
        success: true,
        extractedText: ocrText,
        items: parseResult.items.map(this.convertToExtractedItem),
        metadata: {
          processingTime,
          storeType: parseResult.metadata.storeType,
          patternUsed: parseResult.patternId,
          confidence: parseResult.confidence,
          fallbackUsed: parseResult.metadata.fallbackUsed,
          quality: evaluation.quality,
          issues: evaluation.issues,
          suggestions: evaluation.suggestions
        }
      }

    } catch (error) {
      console.error('Enhanced OCR processing failed:', error)
      
      // エラー時のフォールバック
      try {
        const ocrText = await this.performOCR(imageFile)
        const fallbackResult = await this.fallbackParsing(ocrText)
        
        return {
          success: true,
          extractedText: ocrText,
          items: fallbackResult.items.map(this.convertToExtractedItem),
          metadata: {
            processingTime: Date.now() - startTime,
            fallbackUsed: true,
            confidence: 0.2
          }
        }
      } catch (fallbackError) {
        return {
          success: false,
          extractedText: '',
          items: []
        }
      }
    }
  }

  private async performOCR(imageFile: File): Promise<string> {
    // 既存のOCR APIを呼び出し
    const formData = new FormData()
    formData.append('image', imageFile)

    const response = await fetch('/api/ocr/extract-text', {
      method: 'POST',
      body: formData
    })

    if (!response.ok) {
      throw new Error(`OCR API failed: ${response.statusText}`)
    }

    const result = await response.json()
    return result.text || ''
  }

  private async fallbackParsing(text: string): Promise<OCRParseResult> {
    // 基本的なフォールバック解析
    const lines = text.split('\n').filter(line => line.trim())
    const items: ExtractedItem[] = []
    
    // 簡単な価格パターンマッチング
    const pricePattern = /(.+?)\s+(\d{2,5})\s*$/
    
    lines.forEach((line, index) => {
      const match = line.match(pricePattern)
      if (match) {
        const name = match[1].trim()
        const price = parseInt(match[2])
        
        if (name.length >= 2 && name.length <= 50 && price >= 1 && price <= 99999) {
          items.push({
            name,
            price,
            confidence: 0.3,
            sourcePattern: 'fallback',
            lineNumbers: [index],
            rawText: line
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

  private convertToExtractedItem(item: ExtractedItem): any {
    // 既存のインターフェースに合わせて変換
    return {
      name: item.name,
      price: item.price,
      quantity: item.quantity || 1,
      category: item.category || 'その他'
    }
  }

  // パターン管理機能のエクスポート
  async getPatternManager(): Promise<OCRPatternManager> {
    return this.patternManager
  }

  // デバッグ情報の取得
  async getDebugInfo(text: string): Promise<{
    detectedStore: string | null
    availablePatterns: number
    patternStats: any
  }> {
    const storeType = await this.processor.detectStoreType(text)
    const patterns = await this.patternManager.getOptimalPatterns(storeType || undefined)
    const stats = await this.patternManager.getPatternStats()

    return {
      detectedStore: storeType,
      availablePatterns: patterns.length,
      patternStats: stats
    }
  }

  // パフォーマンス測定
  async measurePerformance(
    imageFile: File, 
    iterations: number = 5
  ): Promise<{
    averageTime: number
    minTime: number
    maxTime: number
    successRate: number
  }> {
    const times: number[] = []
    let successCount = 0

    for (let i = 0; i < iterations; i++) {
      const startTime = Date.now()
      try {
        const result = await this.processImage(imageFile)
        const endTime = Date.now()
        
        times.push(endTime - startTime)
        if (result.success) successCount++
      } catch (error) {
        console.warn(`Performance test iteration ${i + 1} failed:`, error)
      }
    }

    return {
      averageTime: times.reduce((sum, time) => sum + time, 0) / times.length,
      minTime: Math.min(...times),
      maxTime: Math.max(...times),
      successRate: successCount / iterations
    }
  }
}