import { ExtractedItem } from '@/types/ocr-patterns'
import { DocumentAIService, DocumentAIResult } from './document-ai-service'

export interface HybridOCROptions {
  debugMode?: boolean
  enableQualityAssessment?: boolean
  fallbackThreshold?: number
  mergeStrategy?: 'best-of-both' | 'document-ai-first' | 'pattern-match-first'
  confidenceThreshold?: number
  itemCountThreshold?: number
}

export interface QualityMetrics {
  confidence: number
  itemsDetected: number
  itemsWithHighConfidence: number
  averageConfidencePerItem: number
  suspiciousPatterns: string[]
  recommendsFallback: boolean
}

export interface HybridResult {
  success: boolean
  extractedText: string
  items: ExtractedItem[]
  metadata: {
    processingTime: number
    primaryMethod: 'document-ai' | 'pattern-match' | 'merged'
    fallbackUsed: boolean
    qualityScore: number
    methodsUsed: string[]
    confidence: number
  }
}

/**
 * 汎用ハイブリッドOCR戦略
 * Document AIと従来パターンマッチを組み合わせて最適な結果を提供
 */
export class HybridOCRStrategy {
  private documentAI: DocumentAIService | null = null

  constructor(private options: HybridOCROptions = {}) {
    // Document AI が利用可能な場合のみ初期化
    if (process.env.USE_DOCUMENT_AI === 'true' && process.env.DOCUMENT_AI_PROCESSOR_ID) {
      try {
        this.documentAI = new DocumentAIService({
          processorId: process.env.DOCUMENT_AI_PROCESSOR_ID,
          location: process.env.DOCUMENT_AI_LOCATION || 'us',
          debugMode: options.debugMode
        })
      } catch (error) {
        console.warn('⚠️ Document AI初期化失敗, パターンマッチのみ使用:', error)
      }
    }
  }

  /**
   * ハイブリッド処理のメインエントリーポイント
   */
  async processReceipt(imageFile: File): Promise<HybridResult> {
    const startTime = Date.now()
    const debugMode = this.options.debugMode || false

    if (debugMode) {
      console.log('🔄 ハイブリッドOCR処理開始')
    }

    try {
      // Step 1: Document AI で最初に試行
      let documentAIResult: DocumentAIResult | null = null
      let primaryMethod: 'document-ai' | 'pattern-match' | 'merged' = 'pattern-match'

      if (this.documentAI) {
        try {
          if (debugMode) {
            console.log('🤖 Document AI 優先処理開始')
          }

          documentAIResult = await this.documentAI.processReceipt(imageFile, {
            debugMode,
            enableFallback: false // ハイブリッド戦略で制御
          })

          if (documentAIResult.success) {
            // Step 2: Document AI結果の品質評価
            const qualityMetrics = this.assessResultQuality(documentAIResult, debugMode)
            
            if (debugMode) {
              console.log('📊 Document AI品質評価:', qualityMetrics)
            }

            // Step 3: 品質が十分高い場合はDocument AI結果を採用
            if (!qualityMetrics.recommendsFallback) {
              primaryMethod = 'document-ai'
              
              if (debugMode) {
                console.log('✅ Document AI結果採用 - 品質良好')
              }

              return this.buildHybridResult(
                documentAIResult,
                null,
                primaryMethod,
                qualityMetrics.qualityScore,
                Date.now() - startTime,
                false
              )
            } else if (debugMode) {
              console.log('⚠️ Document AI品質不十分 - フォールバック実行')
            }
          }
        } catch (error) {
          if (debugMode) {
            console.log('❌ Document AI処理失敗:', error)
          }
        }
      }

      // Step 4: パターンマッチフォールバック実行
      const patternMatchResult = await this.executePatternMatchFallback(imageFile, debugMode)
      
      // Step 5: 結果のマージまたは選択
      if (documentAIResult?.success && patternMatchResult.success) {
        // 両方成功 - マージ戦略を適用
        return this.mergeResults(
          documentAIResult,
          patternMatchResult,
          Date.now() - startTime,
          debugMode
        )
      } else if (patternMatchResult.success) {
        // パターンマッチのみ成功
        primaryMethod = 'pattern-match'
        return this.buildHybridResult(
          null,
          patternMatchResult,
          primaryMethod,
          0.7, // パターンマッチ基本品質スコア
          Date.now() - startTime,
          true
        )
      } else {
        // 両方失敗
        throw new Error('Both Document AI and pattern matching failed')
      }

    } catch (error) {
      console.error('❌ ハイブリッドOCR処理エラー:', error)
      
      return {
        success: false,
        extractedText: '',
        items: [],
        metadata: {
          processingTime: Date.now() - startTime,
          primaryMethod: 'pattern-match',
          fallbackUsed: true,
          qualityScore: 0,
          methodsUsed: ['error'],
          confidence: 0
        }
      }
    }
  }

  /**
   * Document AI結果の品質を汎用的に評価
   */
  private assessResultQuality(result: DocumentAIResult, debugMode: boolean = false): QualityMetrics {
    const items = result.items || []
    const confidence = result.metadata?.confidence || 0
    
    // 基本メトリクス
    const itemsDetected = items.length
    const itemsWithHighConfidence = items.filter(item => item.confidence > 0.8).length
    const averageConfidencePerItem = items.length > 0 
      ? items.reduce((sum, item) => sum + item.confidence, 0) / items.length 
      : 0

    // 疑わしいパターンの検出
    const suspiciousPatterns: string[] = []
    
    // パターン1: 商品数が異常に少ない
    if (itemsDetected < 3) {
      suspiciousPatterns.push('very-few-items')
    }

    // パターン2: 不完全な商品名が多い
    const incompleteItems = items.filter(item => 
      item.name.length < 3 || 
      item.name.includes('X') || 
      item.name.includes('単') ||
      /^[A-Z0-9\s]+$/.test(item.name) // 英数字のみの商品名
    ).length

    if (incompleteItems > itemsDetected * 0.3) {
      suspiciousPatterns.push('many-incomplete-names')
    }

    // パターン3: 異常な数量
    const abnormalQuantities = items.filter(item => 
      item.quantity && (item.quantity > 100 || item.quantity < 1)
    ).length

    if (abnormalQuantities > 0) {
      suspiciousPatterns.push('abnormal-quantities')
    }

    // パターン4: 全体的な信頼度が低い
    if (confidence < 0.7 || averageConfidencePerItem < 0.7) {
      suspiciousPatterns.push('low-confidence')
    }

    // パターン5: 商品名に改行文字が含まれている（2段表記の証拠）
    const multiLineItems = items.filter(item => 
      item.name.includes('\n') || item.name.includes('\\n')
    ).length

    if (multiLineItems > 0) {
      suspiciousPatterns.push('multi-line-names')
    }

    // フォールバック推奨の判定
    const fallbackThreshold = this.options.fallbackThreshold || 0.7
    const qualityScore = this.calculateQualityScore(
      confidence,
      itemsDetected,
      itemsWithHighConfidence,
      suspiciousPatterns.length
    )

    const recommendsFallback = qualityScore < fallbackThreshold || 
                              suspiciousPatterns.length >= 2 ||
                              itemsDetected === 0

    if (debugMode) {
      console.log('🔍 品質評価詳細:', {
        confidence: (confidence * 100).toFixed(1) + '%',
        itemsDetected,
        itemsWithHighConfidence,
        averageConfidencePerItem: (averageConfidencePerItem * 100).toFixed(1) + '%',
        suspiciousPatterns,
        qualityScore: (qualityScore * 100).toFixed(1) + '%',
        recommendsFallback
      })
    }

    return {
      confidence,
      itemsDetected,
      itemsWithHighConfidence,
      averageConfidencePerItem,
      suspiciousPatterns,
      recommendsFallback
    }
  }

  /**
   * 品質スコアの計算
   */
  private calculateQualityScore(
    confidence: number,
    itemsDetected: number,
    itemsWithHighConfidence: number,
    suspiciousPatternCount: number
  ): number {
    // 基本スコア（信頼度ベース）
    let score = confidence * 0.4

    // 商品検出数ボーナス（3個以上で満点）
    const itemScore = Math.min(itemsDetected / 3, 1) * 0.3
    score += itemScore

    // 高信頼度商品比率ボーナス
    const highConfidenceRatio = itemsDetected > 0 ? itemsWithHighConfidence / itemsDetected : 0
    score += highConfidenceRatio * 0.2

    // 疑わしいパターンペナルティ
    const penalty = Math.min(suspiciousPatternCount * 0.1, 0.3)
    score -= penalty

    return Math.max(0, Math.min(1, score))
  }

  /**
   * パターンマッチフォールバックの実行
   */
  private async executePatternMatchFallback(imageFile: File, debugMode: boolean = false): Promise<any> {
    if (debugMode) {
      console.log('🔧 パターンマッチフォールバック実行')
    }

    try {
      // 既存のEnhancedOCRServiceを使用（Document AI無効化）
      const { EnhancedOCRService } = await import('./enhanced-ocr-service')
      const enhancedOCR = new EnhancedOCRService()
      
      return await enhancedOCR.processImage(imageFile, {
        useDocumentAI: false, // Document AI無効化
        enablePatternMatching: true,
        enableFallback: true,
        debugMode,
        useImprovedProcessor: true,
        applyEmergencyFixes: true,
        useReceiptSpecificFixes: true,
        confidenceThreshold: 0.3
      })

    } catch (error) {
      console.error('❌ パターンマッチフォールバック失敗:', error)
      return {
        success: false,
        extractedText: '',
        items: [],
        metadata: { processingTime: 0, confidence: 0 }
      }
    }
  }

  /**
   * Document AIとパターンマッチ結果のマージ
   */
  private async mergeResults(
    documentAIResult: DocumentAIResult,
    patternMatchResult: any,
    totalProcessingTime: number,
    debugMode: boolean = false
  ): Promise<HybridResult> {
    if (debugMode) {
      console.log('🔀 結果マージ開始:', {
        documentAIItems: documentAIResult.items.length,
        patternMatchItems: patternMatchResult.items.length
      })
    }

    const mergeStrategy = this.options.mergeStrategy || 'best-of-both'
    let mergedItems: ExtractedItem[] = []
    let primaryMethod: 'document-ai' | 'pattern-match' | 'merged' = 'merged'

    switch (mergeStrategy) {
      case 'best-of-both':
        mergedItems = this.mergeBestOfBoth(documentAIResult.items, patternMatchResult.items, debugMode)
        break
      
      case 'document-ai-first':
        mergedItems = documentAIResult.items.length > 0 ? documentAIResult.items : patternMatchResult.items
        primaryMethod = documentAIResult.items.length > 0 ? 'document-ai' : 'pattern-match'
        break
      
      case 'pattern-match-first':
        mergedItems = patternMatchResult.items.length > 0 ? patternMatchResult.items : documentAIResult.items
        primaryMethod = patternMatchResult.items.length > 0 ? 'pattern-match' : 'document-ai'
        break
    }

    // 品質スコア計算
    const qualityScore = this.calculateMergedQualityScore(documentAIResult, patternMatchResult, mergedItems)

    if (debugMode) {
      console.log('✅ マージ完了:', {
        strategy: mergeStrategy,
        finalItemCount: mergedItems.length,
        qualityScore: (qualityScore * 100).toFixed(1) + '%'
      })
    }

    return {
      success: true,
      extractedText: documentAIResult.extractedText || patternMatchResult.extractedText,
      items: mergedItems,
      metadata: {
        processingTime: totalProcessingTime,
        primaryMethod,
        fallbackUsed: true,
        qualityScore,
        methodsUsed: ['document-ai', 'pattern-match', 'merge'],
        confidence: qualityScore
      }
    }
  }

  /**
   * 両方の結果から最良の商品を選択してマージ
   */
  private mergeBestOfBoth(
    documentAIItems: ExtractedItem[],
    patternMatchItems: ExtractedItem[],
    debugMode: boolean = false
  ): ExtractedItem[] {
    const merged: ExtractedItem[] = []
    const usedPrices = new Set<number>()

    // Document AI結果から高品質な商品を選択
    documentAIItems.forEach(item => {
      if (this.isHighQualityItem(item) && !usedPrices.has(item.price)) {
        merged.push({
          ...item,
          sourcePattern: item.sourcePattern + '-document-ai'
        })
        usedPrices.add(item.price)
      }
    })

    // パターンマッチ結果から補完
    patternMatchItems.forEach(item => {
      if (this.isHighQualityItem(item) && !usedPrices.has(item.price)) {
        merged.push({
          ...item,
          sourcePattern: item.sourcePattern + '-pattern-match'
        })
        usedPrices.add(item.price)
      }
    })

    // 残りの商品も追加（重複チェック付き）
    const allItems = [...documentAIItems, ...patternMatchItems]
    allItems.forEach(item => {
      if (!usedPrices.has(item.price) && item.price > 0) {
        merged.push({
          ...item,
          sourcePattern: item.sourcePattern + '-fallback'
        })
        usedPrices.add(item.price)
      }
    })

    if (debugMode) {
      console.log('🔀 マージ詳細:', {
        documentAIContribution: merged.filter(i => i.sourcePattern?.includes('document-ai')).length,
        patternMatchContribution: merged.filter(i => i.sourcePattern?.includes('pattern-match')).length,
        fallbackContribution: merged.filter(i => i.sourcePattern?.includes('fallback')).length
      })
    }

    return merged
  }

  /**
   * 商品アイテムの品質判定
   */
  private isHighQualityItem(item: ExtractedItem): boolean {
    return item.confidence > 0.7 &&
           item.name.length >= 2 &&
           item.price > 0 &&
           !item.name.includes('X単') &&
           !/^[A-Z0-9\s]+$/.test(item.name)
  }

  /**
   * マージ結果の品質スコア計算
   */
  private calculateMergedQualityScore(
    documentAIResult: DocumentAIResult,
    patternMatchResult: any,
    mergedItems: ExtractedItem[]
  ): number {
    const documentAIScore = documentAIResult.metadata.confidence * 0.4
    const patternMatchScore = (patternMatchResult.metadata?.confidence || 0.5) * 0.3
    const mergeBonus = mergedItems.length > Math.max(documentAIResult.items.length, patternMatchResult.items.length) ? 0.2 : 0.1
    const qualityBonus = mergedItems.filter(item => this.isHighQualityItem(item)).length / Math.max(mergedItems.length, 1) * 0.1

    return Math.min(1, documentAIScore + patternMatchScore + mergeBonus + qualityBonus)
  }

  /**
   * ハイブリッド結果の構築
   */
  private buildHybridResult(
    documentAIResult: DocumentAIResult | null,
    patternMatchResult: any,
    primaryMethod: 'document-ai' | 'pattern-match' | 'merged',
    qualityScore: number,
    processingTime: number,
    fallbackUsed: boolean
  ): HybridResult {
    const result = documentAIResult || patternMatchResult
    const methodsUsed = []
    
    if (documentAIResult) methodsUsed.push('document-ai')
    if (patternMatchResult) methodsUsed.push('pattern-match')

    return {
      success: result?.success || false,
      extractedText: result?.extractedText || '',
      items: result?.items || [],
      metadata: {
        processingTime,
        primaryMethod,
        fallbackUsed,
        qualityScore,
        methodsUsed,
        confidence: result?.metadata?.confidence || qualityScore
      }
    }
  }
}