import { ExtractedItem } from '@/types/ocr-patterns'
import { ProductCategorizer } from './product-categorizer'

export interface DocumentAIOptions {
  processorId?: string
  location?: string
  enableFallback?: boolean
  debugMode?: boolean
}

export interface DocumentAIResult {
  success: boolean
  extractedText: string
  items: ExtractedItem[]
  metadata: {
    processingTime: number
    confidence: number
    storeType?: string
    patternUsed: string
    fallbackUsed: boolean
    documentType?: string
    totalAmount?: number
    currency?: string
  }
}

/**
 * Google Document AI Receipt Processor Service
 * レシートの自動構造解析を行い、商品名・価格・数量を抽出
 */
export class DocumentAIService {
  private projectId: string
  private location: string
  private processorId: string

  constructor(options: DocumentAIOptions = {}) {
    this.projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || ''
    this.location = options.location || 'us' // Document AI利用可能リージョン
    this.processorId = options.processorId || process.env.DOCUMENT_AI_PROCESSOR_ID || ''

    if (!this.projectId || !this.processorId) {
      throw new Error('Google Cloud Project ID and Document AI Processor ID are required')
    }
  }

  /**
   * レシート画像をDocument AIで処理し、構造化データを抽出
   */
  async processReceipt(
    imageFile: File,
    options: DocumentAIOptions = {}
  ): Promise<DocumentAIResult> {
    const startTime = Date.now()
    const debugMode = options.debugMode || false

    try {
      if (debugMode) {
        console.log('🤖 Document AI Receipt Processor開始')
        console.log('📁 ファイル情報:', {
          name: imageFile.name,
          size: imageFile.size,
          type: imageFile.type
        })
      }

      // Document AI client初期化
      const { DocumentProcessorServiceClient } = await import('@google-cloud/documentai')
      
      const client = new DocumentProcessorServiceClient({
        projectId: this.projectId,
        credentials: {
          client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
          private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        },
      })

      // ファイルをBase64に変換
      const imageBytes = await this.fileToBase64(imageFile)
      
      // Document AI Processor名を構築
      const name = client.processorPath(this.projectId, this.location, this.processorId)

      if (debugMode) {
        console.log('🔧 Document AI設定:', {
          projectId: this.projectId,
          location: this.location,
          processorId: this.processorId,
          processorPath: name
        })
      }

      // Document AI API呼び出し
      const [result] = await client.processDocument({
        name,
        rawDocument: {
          content: imageBytes,
          mimeType: imageFile.type,
        },
      })

      const document = result.document
      if (!document) {
        throw new Error('Document AI processing failed: No document returned')
      }

      if (debugMode) {
        console.log('📄 Document AI応答:', {
          hasText: !!document.text,
          textLength: document.text?.length || 0,
          entitiesCount: document.entities?.length || 0
        })
      }

      // レシートエンティティから商品情報を抽出
      const extractedItems = this.extractItemsFromDocument(document, debugMode)
      
      // メタデータ作成
      const metadata = {
        processingTime: Date.now() - startTime,
        confidence: this.calculateOverallConfidence(document),
        storeType: this.detectStoreType(document),
        patternUsed: 'document-ai-receipt-processor',
        fallbackUsed: false,
        documentType: this.detectDocumentType(document),
        totalAmount: this.extractTotalAmount(document),
        currency: this.extractCurrency(document) || 'JPY'
      }

      if (debugMode) {
        console.log('✅ Document AI処理完了:', {
          itemsExtracted: extractedItems.length,
          processingTime: metadata.processingTime + 'ms',
          confidence: (metadata.confidence * 100).toFixed(1) + '%',
          totalAmount: metadata.totalAmount
        })
      }

      return {
        success: true,
        extractedText: document.text || '',
        items: extractedItems,
        metadata
      }

    } catch (error: unknown) {
      console.error('❌ Document AI処理エラー:', error)
      
      const processingTime = Date.now() - startTime
      
      // フォールバック処理が有効な場合
      if (options.enableFallback) {
        if (debugMode) {
          console.log('🔄 Vision APIフォールバックに切り替え')
        }
        
        return await this.fallbackToVisionAPI(imageFile, {
          ...options,
          processingTime
        })
      }

      // エラーレスポンス
      return {
        success: false,
        extractedText: '',
        items: [],
        metadata: {
          processingTime,
          confidence: 0,
          patternUsed: 'document-ai-failed',
          fallbackUsed: false
        }
      }
    }
  }

  /**
   * Document AIレスポンスから商品アイテムを抽出
   */
  private extractItemsFromDocument(document: any, debugMode: boolean = false): ExtractedItem[] {
    const items: ExtractedItem[] = []
    
    if (!document.entities) {
      if (debugMode) {
        console.log('⚠️ Document AI: エンティティが見つかりません')
      }
      return items
    }

    // レシートエンティティを解析
    document.entities.forEach((entity: any, index: number) => {
      try {
        // 商品項目（line_item）を探す
        if (entity.type === 'line_item') {
          const item = this.parseLineItem(entity, document.text, debugMode)
          if (item) {
            items.push({
              ...item,
              lineNumbers: [index],
              sourcePattern: 'document-ai-line-item'
            })
          }
        }
      } catch (error) {
        if (debugMode) {
          console.warn('⚠️ エンティティ解析エラー:', error)
        }
      }
    })

    if (debugMode) {
      console.log(`📊 抽出結果: ${items.length}個の商品を検出`)
      items.forEach((item, i) => {
        console.log(`  ${i + 1}. ${item.name} - ¥${item.price} (信頼度: ${(item.confidence * 100).toFixed(1)}%)`)
      })
    }

    return items
  }

  /**
   * line_itemエンティティから商品情報を解析
   */
  private parseLineItem(entity: any, fullText: string, debugMode: boolean = false): ExtractedItem | null {
    try {
      const properties = entity.properties || []
      
      let name = ''
      let price = 0
      let quantity = 1
      let confidence = entity.confidence || 0.5
      let priceText = '' // 価格テキストを保存

      // プロパティから情報を抽出
      properties.forEach((prop: any) => {
        const text = this.extractTextFromTextAnchor(prop.textAnchor, fullText)
        
        switch (prop.type) {
          case 'line_item/description':
            name = text.trim()
            break
          case 'line_item/amount':
            priceText = text // 元の価格テキストを保存
            price = this.parsePrice(text)
            break
          case 'line_item/quantity':
            quantity = this.parseQuantity(text)
            break
        }
      })

      // 基本的なバリデーション
      if (!name || name.length < 2) return null
      if (price <= 0) return null

      // 通貨検出（価格テキストとレシート全体から判定）
      const currency = this.detectCurrency(priceText + ' ' + fullText)

      if (debugMode) {
        console.log(`🔍 解析結果: ${name} - ${currency === 'USD' ? '$' : '¥'}${price} x${quantity} (信頼度: ${(confidence * 100).toFixed(1)}%)`)
      }

      return {
        name,
        price,
        quantity,
        confidence,
        rawText: `${name} | ${price} | ${quantity}`,
        category: this.categorizeItem(name),
        currency
      }

    } catch (error) {
      if (debugMode) {
        console.warn('⚠️ line_item解析エラー:', error)
      }
      return null
    }
  }

  /**
   * TextAnchorからテキストを抽出
   */
  private extractTextFromTextAnchor(textAnchor: any, fullText: string): string {
    if (!textAnchor || !textAnchor.textSegments) return ''
    
    let extractedText = ''
    textAnchor.textSegments.forEach((segment: any) => {
      const startIndex = segment.startIndex || 0
      const endIndex = segment.endIndex || fullText.length
      extractedText += fullText.slice(startIndex, endIndex)
    })
    
    return extractedText
  }

  /**
   * 価格文字列をパース（日本円・ドル対応）
   */
  private parsePrice(priceText: string): number {
    // 通貨記号とスペースを除去、数字とピリオドのみ残す
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
   * 数量文字列をパース
   */
  private parseQuantity(quantityText: string): number {
    const cleanText = quantityText.replace(/[^\d]/g, '')
    const quantity = parseInt(cleanText)
    return isNaN(quantity) || quantity <= 0 ? 1 : quantity
  }

  /**
   * 商品の高精度カテゴリ分類
   */
  private categorizeItem(name: string): string {
    return ProductCategorizer.categorize(name)
  }

  /**
   * ドキュメント全体の信頼度を計算
   */
  private calculateOverallConfidence(document: any): number {
    if (!document.entities || document.entities.length === 0) return 0
    
    const confidences = document.entities
      .map((entity: any) => entity.confidence || 0)
      .filter((conf: number) => conf > 0)
    
    if (confidences.length === 0) return 0.5
    
    return confidences.reduce((sum: number, conf: number) => sum + conf, 0) / confidences.length
  }

  /**
   * 店舗タイプを検出
   */
  private detectStoreType(document: any): string {
    const text = (document.text || '').toLowerCase()
    
    if (text.includes('costco') || text.includes('コストコ')) return 'warehouse'
    if (text.includes('walmart') || text.includes('target')) return 'supermarket'
    if (text.includes('convenience')) return 'convenience'
    
    return 'unknown'
  }

  /**
   * ドキュメントタイプを検出
   */
  private detectDocumentType(document: any): string {
    if (!document.entities) return 'unknown'
    
    const hasLineItems = document.entities.some((entity: any) => entity.type === 'line_item')
    const hasTotal = document.entities.some((entity: any) => entity.type === 'total_amount')
    
    if (hasLineItems && hasTotal) return 'receipt'
    if (hasTotal) return 'invoice'
    
    return 'document'
  }

  /**
   * 合計金額を抽出
   */
  private extractTotalAmount(document: any): number | undefined {
    if (!document.entities) return undefined
    
    const totalEntity = document.entities.find((entity: any) => entity.type === 'total_amount')
    if (totalEntity && totalEntity.mentionText) {
      return this.parsePrice(totalEntity.mentionText)
    }
    
    return undefined
  }

  /**
   * 通貨を抽出
   */
  private extractCurrency(document: any): string | undefined {
    const text = document.text || ''
    
    if (text.includes('¥') || text.includes('円')) return 'JPY'
    if (text.includes('$') || text.includes('USD')) return 'USD'
    if (text.includes('€') || text.includes('EUR')) return 'EUR'
    
    return undefined
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

  /**
   * ファイルをBase64に変換
   */
  private async fileToBase64(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    return buffer.toString('base64')
  }

  /**
   * Vision APIフォールバック処理
   */
  private async fallbackToVisionAPI(
    imageFile: File, 
    options: DocumentAIOptions & { processingTime: number }
  ): Promise<DocumentAIResult> {
    try {
      // 既存のVision API処理を呼び出し
      const { EnhancedOCRService } = await import('./enhanced-ocr-service')
      const visionService = new EnhancedOCRService()
      
      const result = await visionService.processImage(imageFile, {
        debugMode: options.debugMode,
        enableFallback: false // 無限ループ防止
      })

      return {
        success: result.success,
        extractedText: result.extractedText,
        items: result.items,
        metadata: {
          ...result.metadata,
          processingTime: options.processingTime + (result.metadata?.processingTime || 0),
          patternUsed: 'vision-api-fallback',
          fallbackUsed: true
        }
      }

    } catch (error) {
      console.error('❌ Vision APIフォールバックも失敗:', error)
      
      return {
        success: false,
        extractedText: '',
        items: [],
        metadata: {
          processingTime: options.processingTime,
          confidence: 0,
          patternUsed: 'fallback-failed',
          fallbackUsed: true
        }
      }
    }
  }
}