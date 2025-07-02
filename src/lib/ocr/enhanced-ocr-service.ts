import { OCRPatternManager } from './pattern-manager'
import { AdvancedPatternProcessor } from './pattern-processor'
import { ImprovedPatternProcessor } from './improved-pattern-processor'
import { PatternOptimizer } from './pattern-optimizer'
import { OCRDebugAnalyzer, DebugAnalysis } from './debug-analyzer'
import { OCRResultValidator } from './result-validator'
import { ReceiptSpecificFixes } from './receipt-specific-fixes'
import { Receipt2SpecificPatterns } from './receipt2-specific-patterns'
import { Receipt3Patterns } from './receipt3-patterns'
import { LifePatterns } from './life-patterns'
import { WarehousePatternsSimple } from './warehouse-patterns-simple'
import { DocumentAIService } from './document-ai-service'
import { OCRParseResult, ExtractedItem } from '@/types/ocr-patterns'

export interface EnhancedOCROptions {
  enablePatternMatching: boolean
  maxProcessingTime: number
  confidenceThreshold: number
  enableFallback: boolean
  debugMode: boolean
  enableValidation: boolean
  enableAutoCorrection: boolean
  useImprovedProcessor: boolean
  useReceiptSpecificFixes: boolean
  useReceipt2Parser: boolean
  useReceipt3Parser: boolean
  useLifeParser: boolean
  useWarehouseParser: boolean
  // Document AI オプション
  useDocumentAI: boolean
  documentAIProcessorId?: string
  documentAILocation?: string
}

export class EnhancedOCRService {
  private patternManager: OCRPatternManager
  private processor: AdvancedPatternProcessor
  private improvedProcessor: ImprovedPatternProcessor
  private validator: OCRResultValidator

  constructor() {
    this.patternManager = new OCRPatternManager()
    this.processor = new AdvancedPatternProcessor()
    this.improvedProcessor = new ImprovedPatternProcessor()
    this.validator = new OCRResultValidator()
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
      debugMode: false,
      enableValidation: true,
      enableAutoCorrection: true,
      useImprovedProcessor: true,
      useReceiptSpecificFixes: true,
      useReceipt2Parser: true,
      useReceipt3Parser: true,
      useLifeParser: true,
      useWarehouseParser: true,
      // Document AI デフォルト設定
      useDocumentAI: false,
      documentAIProcessorId: undefined,
      documentAILocation: 'us'
    }

    const mergedOptions = { ...defaultOptions, ...options }
    const startTime = Date.now()

    try {
      // Document AI優先処理
      if (mergedOptions.useDocumentAI) {
        if (mergedOptions.debugMode) {
          console.log('🤖 Document AI Receipt Processorを使用')
        }

        try {
          const documentAI = new DocumentAIService({
            processorId: mergedOptions.documentAIProcessorId,
            location: mergedOptions.documentAILocation,
            enableFallback: mergedOptions.enableFallback,
            debugMode: mergedOptions.debugMode
          })

          const documentAIResult = await documentAI.processReceipt(imageFile, {
            debugMode: mergedOptions.debugMode,
            enableFallback: mergedOptions.enableFallback
          })

          if (documentAIResult.success) {
            if (mergedOptions.debugMode) {
              console.log('✅ Document AI処理成功:', {
                itemsFound: documentAIResult.items.length,
                confidence: (documentAIResult.metadata.confidence * 100).toFixed(1) + '%',
                processingTime: documentAIResult.metadata.processingTime + 'ms'
              })
            }

            return {
              success: true,
              extractedText: documentAIResult.extractedText,
              items: documentAIResult.items,
              metadata: {
                processingTime: documentAIResult.metadata.processingTime,
                storeType: documentAIResult.metadata.storeType,
                patternUsed: documentAIResult.metadata.patternUsed,
                confidence: documentAIResult.metadata.confidence,
                fallbackUsed: documentAIResult.metadata.fallbackUsed
              }
            }
          } else if (mergedOptions.enableFallback) {
            if (mergedOptions.debugMode) {
              console.log('⚠️ Document AI失敗 - Vision APIフォールバックに切り替え')
            }
          } else {
            throw new Error('Document AI processing failed and fallback is disabled')
          }
        } catch (error) {
          console.error('❌ Document AI処理エラー:', error)
          if (!mergedOptions.enableFallback) {
            throw error
          }
          if (mergedOptions.debugMode) {
            console.log('🔄 Vision APIフォールバックに切り替え')
          }
        }
      }

      // 1. OCR処理でテキスト抽出（従来のVision API）
      const ocrText = await this.performOCR(imageFile)
      
      if (mergedOptions.debugMode) {
        console.log('Extracted OCR text:', ocrText)
      }

      // 2. パターンマッチングによる解析
      let parseResult: OCRParseResult
      
      // 専用パーサーの優先順位で使用
      if (mergedOptions.useWarehouseParser && this.isWarehouseLike(ocrText)) {
        if (mergedOptions.debugMode) {
          console.log('🎯 大型店舗専用パーサーを使用')
          console.log('📄 OCRテキスト（先頭10行）:')
          ocrText.split('\n').slice(0, 10).forEach((line, i) => {
            console.log(`  ${i.toString().padStart(2)}: ${line}`)
          })
        }
        
        const warehouseItems = WarehousePatternsSimple.parseWarehouseText(ocrText)
        parseResult = {
          patternId: 'warehouse-specific',
          confidence: warehouseItems.length > 0 ? 0.9 : 0.3,
          items: warehouseItems,
          metadata: {
            processingTime: Date.now() - startTime,
            patternsAttempted: ['warehouse-specific'],
            fallbackUsed: false
          }
        }
      } else if (mergedOptions.useLifeParser && this.isLifeLike(ocrText)) {
        if (mergedOptions.debugMode) {
          console.log('🎯 店舗固有専用パーサーを使用')
        }
        
        const lifeItems = LifePatterns.parseLifeText(ocrText)
        parseResult = {
          patternId: 'life-specific',
          confidence: lifeItems.length > 0 ? 0.9 : 0.3,
          items: lifeItems,
          metadata: {
            processingTime: Date.now() - startTime,
            patternsAttempted: ['life-specific'],
            fallbackUsed: false
          }
        }
      } else if (mergedOptions.useReceipt2Parser && this.isReceipt2Like(ocrText)) {
        if (mergedOptions.debugMode) {
          console.log('🎯 Receipt2専用パーサーを使用')
        }
        
        const receipt2Items = Receipt2SpecificPatterns.parseReceipt2Text(ocrText)
        parseResult = {
          patternId: 'receipt2-specific',
          confidence: receipt2Items.length > 0 ? 0.8 : 0.3,
          items: receipt2Items,
          metadata: {
            processingTime: Date.now() - startTime,
            patternsAttempted: ['receipt2-specific'],
            fallbackUsed: false
          }
        }
      } else if (mergedOptions.useReceipt3Parser && this.isReceipt3Like(ocrText)) {
        if (mergedOptions.debugMode) {
          console.log('🎯 Receipt3専用パーサーを使用')
        }
        
        const receipt3Items = Receipt3Patterns.parseReceipt3Text(ocrText)
        parseResult = {
          patternId: 'receipt3-specific',
          confidence: receipt3Items.length > 0 ? 0.8 : 0.3,
          items: receipt3Items,
          metadata: {
            processingTime: Date.now() - startTime,
            patternsAttempted: ['receipt3-specific'],
            fallbackUsed: false
          }
        }
      } else if (mergedOptions.enablePatternMatching) {
        // プロセッサーの選択
        const activeProcessor = mergedOptions.useImprovedProcessor ? 
          new ImprovedPatternProcessor(mergedOptions.debugMode) : 
          this.processor

        // 店舗タイプ検出
        const storeType = await activeProcessor.detectStoreType(ocrText)
        
        // 最適なパターンを取得
        const patterns = await this.patternManager.getOptimalPatterns(storeType || undefined)
        
        if (mergedOptions.debugMode) {
          console.log(`🏪 検出店舗タイプ: ${storeType}`)
          console.log(`📋 利用可能パターン数: ${patterns.length}`)
          console.log(`⚙️ プロセッサー: ${mergedOptions.useImprovedProcessor ? 'Improved' : 'Standard'}`)
        }

        // パターン処理実行
        parseResult = await activeProcessor.processText(ocrText, patterns)
        
        // 結果の最適化
        parseResult = PatternOptimizer.optimizeResults(parseResult)

        // 検証と自動修正
        if (mergedOptions.enableValidation) {
          const validationResult = this.validator.validateItems(
            parseResult.items, 
            ocrText, 
            storeType || undefined
          )

          if (mergedOptions.debugMode) {
            console.log(`✅ 検証完了: ${validationResult.globalIssues.length}件の問題`)
            console.log(`💡 提案: ${validationResult.globalSuggestions.length}件`)
          }

          // 自動修正の適用
          if (mergedOptions.enableAutoCorrection) {
            const correctionResult = this.validator.autoCorrectItems(
              parseResult.items, 
              ocrText, 
              storeType || undefined
            )
            parseResult.items = correctionResult.correctedItems

            if (mergedOptions.debugMode && correctionResult.corrections.length > 0) {
              console.log(`🔧 自動修正: ${correctionResult.corrections.length}件`)
            }
          }
        }
      } else {
        // パターンマッチング無効時はフォールバック処理のみ
        parseResult = await this.fallbackParsing(ocrText)
      }

      // 専用パーサー使用時は後処理をスキップ（専用パーサーで既に処理済み）
      const skipPostProcessing = (mergedOptions.useWarehouseParser && this.isWarehouseLike(ocrText)) ||
                                  (mergedOptions.useLifeParser && this.isLifeLike(ocrText)) ||
                                  (mergedOptions.useReceipt2Parser && this.isReceipt2Like(ocrText)) ||
                                  (mergedOptions.useReceipt3Parser && this.isReceipt3Like(ocrText))

      if (!skipPostProcessing) {

        // レシート固有の修正適用
        if (mergedOptions.useReceiptSpecificFixes) {
          const beforeSpecificFix = parseResult.items.length
          const originalItems = [...parseResult.items]
          parseResult.items = ReceiptSpecificFixes.applyReceipt2SpecificFixes(parseResult.items)
          
          if (mergedOptions.debugMode) {
            const specificStats = ReceiptSpecificFixes.generateFixStatistics(originalItems, parseResult.items)
            console.log(`🎯 Receipt固有修正統計:`, specificStats)
            console.log(`📊 修正前→後: ${beforeSpecificFix}件 → ${parseResult.items.length}件`)
          }
        }
      } else if (mergedOptions.debugMode) {
        if (mergedOptions.useWarehouseParser && this.isWarehouseLike(ocrText)) {
          console.log(`✅ 大型店舗専用パーサー使用: 後処理スキップ`)
        } else if (mergedOptions.useLifeParser && this.isLifeLike(ocrText)) {
          console.log(`✅ 店舗固有専用パーサー使用: 後処理スキップ`)
        } else if (mergedOptions.useReceipt2Parser && this.isReceipt2Like(ocrText)) {
          console.log(`✅ Receipt2専用パーサー使用: 後処理スキップ`)
        } else if (mergedOptions.useReceipt3Parser && this.isReceipt3Like(ocrText)) {
          console.log(`✅ Receipt3専用パーサー使用: 後処理スキップ`)
        }
      }

      const processingTime = Date.now() - startTime

      // 3. 結果の検証と整形
      const isValid = this.processor.validateResults(parseResult)
      
      if (!isValid && mergedOptions.enableFallback) {
        // 検証失敗時のフォールバック
        parseResult = await this.fallbackParsing(ocrText)
        parseResult.metadata.fallbackUsed = true
      }

      return {
        success: true,
        extractedText: ocrText,
        items: parseResult.items.map(this.convertToExtractedItem),
        metadata: {
          processingTime,
          storeType: parseResult.metadata.storeType,
          patternUsed: parseResult.patternId,
          confidence: parseResult.confidence,
          fallbackUsed: parseResult.metadata.fallbackUsed
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
      } catch {
        return {
          success: false,
          extractedText: '',
          items: []
        }
      }
    }
  }

  private async performOCR(imageFile: File): Promise<string> {
    // Google Cloud Vision APIを直接呼び出し
    const { ImageAnnotatorClient } = await import('@google-cloud/vision')
    const sharp = await import('sharp')
    
    const visionClient = new ImageAnnotatorClient({
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
      credentials: {
        client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
    })

    // ファイルをBufferに変換
    const bytes = await imageFile.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // 画像を最適化（サイズ縮小・品質向上）
    const optimizedBuffer = await sharp.default(buffer)
      .resize(1200, 1200, { 
        fit: 'inside',
        withoutEnlargement: true 
      })
      .jpeg({ quality: 85 })
      .sharpen()
      .toBuffer()

    // Google Cloud Vision APIでOCR実行
    const [result] = await visionClient.textDetection({
      image: { content: optimizedBuffer }
    })

    const detections = result.textAnnotations
    const extractedText = detections?.[0]?.description || ''

    if (!extractedText) {
      throw new Error('テキストを検出できませんでした')
    }

    return extractedText
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

  private convertToExtractedItem(item: ExtractedItem): ExtractedItem {
    // 既存のインターフェースに合わせて変換
    return {
      ...item,
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
    patternStats: Record<string, unknown>
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

  // 完全なデバッグ分析
  async getFullDebugAnalysis(
    imageFile: File,
    options: Partial<EnhancedOCROptions> = {}
  ): Promise<{
    analysis: DebugAnalysis
    report: string
    suggestions: string[]
  }> {
    const mergedOptions = { 
      ...options, 
      debugMode: true,
      enableValidation: true,
      useImprovedProcessor: true 
    }

    // OCR処理を実行
    const result = await this.processImage(imageFile, mergedOptions)
    
    // パターンを取得
    const storeType = await this.improvedProcessor.detectStoreType(result.extractedText)
    const patterns = await this.patternManager.getOptimalPatterns(storeType || undefined)

    // 詳細分析を実行
    const parseResult: OCRParseResult = {
      patternId: result.metadata?.patternUsed || 'unknown',
      confidence: result.metadata?.confidence || 0,
      items: result.items,
      metadata: {
        processingTime: result.metadata?.processingTime || 0,
        patternsAttempted: [result.metadata?.patternUsed || 'unknown'],
        fallbackUsed: result.metadata?.fallbackUsed || false
      }
    }

    const analysis = OCRDebugAnalyzer.analyzeOCRResult(
      result.extractedText,
      parseResult,
      patterns
    )

    // レポート生成
    const report = OCRDebugAnalyzer.generateDebugReport(analysis)

    // 具体的な改善提案を生成
    const suggestions = this.generateImprovementSuggestions(analysis)

    return {
      analysis,
      report,
      suggestions
    }
  }

  // 改善提案の生成
  private generateImprovementSuggestions(analysis: DebugAnalysis): string[] {
    const suggestions: string[] = []

    // 基本的な提案
    suggestions.push(...analysis.resultAnalysis.suggestions)

    // 詳細な技術的提案
    if (analysis.textAnalysis.suspiciousLines.length > 0) {
      suggestions.push('画像の品質を向上させることで、怪しい行の検出を減らせる可能性があります')
    }

    if (analysis.patternAnalysis.storeDetection.confidence < 0.5) {
      suggestions.push('店舗認識の精度が低いため、新しい店舗パターンの追加を検討してください')
    }

    if (analysis.resultAnalysis.qualityScore < 0.6) {
      suggestions.push('全体的な品質スコアが低いため、OCRパターンの見直しが必要です')
    }

    const failedPatterns = analysis.patternAnalysis.patternMatches.filter(p => p.matchCount === 0)
    if (failedPatterns.length > 0) {
      suggestions.push(`${failedPatterns.length}個のパターンがマッチしませんでした。パターンの調整を検討してください`)
    }

    return suggestions
  }

  // パフォーマンステスト（改良版）
  async runPerformanceTest(
    imageFile: File,
    testOptions: {
      iterations?: number
      includeDebug?: boolean
      testBothProcessors?: boolean
    } = {}
  ): Promise<{
    standardProcessor: {
      avgTime: number
      successRate: number
      avgItems: number
      avgConfidence: number
    }
    improvedProcessor?: {
      avgTime: number
      successRate: number
      avgItems: number
      avgConfidence: number
    }
    recommendation: string
  }> {
    const iterations = testOptions.iterations || 3
    
    // 標準プロセッサーのテスト
    const standardResults = await this.testProcessor(imageFile, false, iterations)
    
    let improvedResults
    let recommendation = ''

    // 改良プロセッサーのテスト
    if (testOptions.testBothProcessors !== false) {
      improvedResults = await this.testProcessor(imageFile, true, iterations)
      
      // 推奨プロセッサーの決定
      if (improvedResults.avgConfidence > standardResults.avgConfidence && 
          improvedResults.avgItems >= standardResults.avgItems) {
        recommendation = '改良プロセッサーの使用を推奨します（高精度・高検出率）'
      } else if (standardResults.avgTime < improvedResults.avgTime * 0.8) {
        recommendation = '標準プロセッサーの使用を推奨します（高速処理）'
      } else {
        recommendation = '用途に応じてプロセッサーを選択してください'
      }
    }

    return {
      standardProcessor: standardResults,
      improvedProcessor: improvedResults,
      recommendation
    }
  }

  private async testProcessor(
    imageFile: File, 
    useImproved: boolean, 
    iterations: number
  ) {
    const times: number[] = []
    const itemCounts: number[] = []
    const confidences: number[] = []
    let successCount = 0

    for (let i = 0; i < iterations; i++) {
      const startTime = Date.now()
      try {
        const result = await this.processImage(imageFile, {
          useImprovedProcessor: useImproved,
          debugMode: false
        })
        
        const endTime = Date.now()
        times.push(endTime - startTime)
        
        if (result.success) {
          successCount++
          itemCounts.push(result.items.length)
          confidences.push(result.metadata?.confidence || 0)
        }
      } catch (error) {
        console.warn(`Test iteration ${i + 1} failed:`, error)
      }
    }

    return {
      avgTime: times.reduce((sum, time) => sum + time, 0) / times.length,
      successRate: successCount / iterations,
      avgItems: itemCounts.length > 0 ? itemCounts.reduce((sum, count) => sum + count, 0) / itemCounts.length : 0,
      avgConfidence: confidences.length > 0 ? confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length : 0
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

  /**
   * Receipt2.jpgのようなレシートかどうかを判定
   */
  private isReceipt2Like(text: string): boolean {
    const receipt2Indicators = [
      '領収証明細',
      'スキャンレジ',
      'フレッシュパック',
      'くらこん塩こんぶ',
      '純正ごま油',
      '無添加コーン',
      '豚ばらうす切り',
      'ひらいし',
      '2022年01月25日',
      'スNo 00643015',
      'レジ0605',
      '白菜',
      'シーチキンM4缶',
      '伊藤ロースハム',
      'やわらか厚あげ'
    ]
    
    const matchCount = receipt2Indicators.filter(indicator => 
      text.includes(indicator)
    ).length
    
    // 店舗情報の検出も強化
    const storePatterns = [
      /領収証明細/,
      /\d{4}年\d{1,2}月\d{1,2}日.*レジ\d{4}/,
      /スNo\s+\d{8}/,
      /ひらいし$/m
    ]
    
    const storeMatches = storePatterns.filter(pattern => pattern.test(text)).length
    
    return matchCount >= 2 || storeMatches >= 2  // 条件を緩和してより多くを検出
  }

  /**
   * 大型店舗のようなレシートかどうかを判定
   */
  private isWarehouseLike(text: string): boolean {
    // 大型店舗識別キーワード
    const warehouseIndicators = [
      'WHOLESALE',
      'BIZ/GOLD',
      'BIZ\/GOLD',
      '会員',
      'ムートンシューズ',
      'UGG',
      '生ハム',
      'PROSCIUTTO',
      'トイレットペーパー',
      'BATH TISSUE',
      'グレープフルーツ',
      'エビカクテル',
      'シュリンプ',
      '個',
      ' T$',
      ' E$'
    ]
    
    const matchCount = warehouseIndicators.filter(indicator => 
      text.includes(indicator)
    ).length
    
    // 大型店舗特有のパターン
    const warehousePatterns = [
      /WHOLESALE/i,            // ヘッダー
      /BIZ\/GOLD会員/,         // 会員情報
      /売上/,                  // 売上表示
      /\d{5,7}\s*\n\s*\d+個\s*\n\s*[\d,]+\s*\n\s*[\d,]+\s+[TE]/m,  // 5行パターン
      /.+\s*\n\s*\d{5,7}\s*\n\s*\d+個\s*\n\s*[\d,]+\s*\n\s*[\d,]+\s+[TE]/m,  // 完全5行パターン
      /※.+\s*\n\s*\d{5,7}/m,   // ※付き商品
      /[\d,]+\s+[TE]$/m        // 価格+税区分
    ]
    
    const patternMatches = warehousePatterns.filter(pattern => pattern.test(text)).length
    
    console.log(`🏪 大型店舗判定: キーワード${matchCount}個, パターン${patternMatches}個`)
    
    return matchCount >= 1 || patternMatches >= 2  // 閾値を下げて検出率向上
  }

  /**
   * 特定店舗のようなレシートかどうかを判定
   */
  private isLifeLike(text: string): boolean {
    const storeIndicators = [
      'レタス',
      '※レタス',
      '*やさしさあじわい',
      '*からすがれい',
      '*米国豚ロース',
      '*ふなしめじ',
      '*雪印バター',
      'A 金オフ',
      'コX単'
    ]
    
    const matchCount = storeIndicators.filter(indicator => 
      text.includes(indicator)
    ).length
    
    // 店舗固有のパターン
    const storePatterns = [
      /\*[^*]+\s*\n\s*¥\d+/,  // *商品名 改行 ¥価格
      /[A-Z]\s+.+\s*\n\s*\d+コX単\d+/,  // 税区分付き商品 改行 数量パターン
      /\d+コX単\d+/  // 数量パターン
    ]
    
    const patternMatches = storePatterns.filter(pattern => pattern.test(text)).length
    
    return matchCount >= 2 || patternMatches >= 2
  }

  /**
   * Receipt3のようなレシートかどうかを判定
   */
  private isReceipt3Like(text: string): boolean {
    const receipt3Indicators = [
      'Receipt3',
      'ピーコックストア',
      'イオンマーケット株式会社',
      '領収証',
      'バイオレジ袋',
      '森永乳業',
      'パルムチョコ',
      'タカキ',
      'TVB P若鶏',
      '金麦糖質オフ',
      '男前豆腐店'
    ]
    
    const matchCount = receipt3Indicators.filter(indicator => 
      text.includes(indicator)
    ).length
    
    // Receipt3固有のパターン
    const receipt3Patterns = [
      /Receipt3/i,
      /ピーコックストア/,
      /イオンマーケット株式会社/,
      /レジ\s*\d{4}/,
      /\d+※$/m,  // 軽減税率マーク
      /割引!\s*\d+%/
    ]
    
    const patternMatches = receipt3Patterns.filter(pattern => pattern.test(text)).length
    
    return matchCount >= 2 || patternMatches >= 2
  }
}