/**
 * OCR処理ロジック
 * Google Vision APIを使用したテキスト抽出
 */
export class OCRProcessor {
  /**
   * 画像からテキストを抽出（サーバーサイド用）
   */
  static async performOCR(imageFile: File | Buffer): Promise<string> {
    try {
      // 環境チェック: サーバーサイドかブラウザか
      const isServerSide = typeof window === 'undefined'
      
      if (!isServerSide) {
        // ブラウザ環境では従来のAPI経由処理
        if (!(imageFile instanceof File)) {
          throw new Error('Browser environment requires File object')
        }
        return await this.performOCRFromBrowser(imageFile)
      }

      // サーバーサイドでは直接Google Vision APIを呼び出し
      const { ImageAnnotatorClient } = await import('@google-cloud/vision')
      
      const client = new ImageAnnotatorClient({
        projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
        credentials: {
          client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
          private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        },
      })

      let imageBuffer: Buffer
      
      if (imageFile instanceof Buffer) {
        imageBuffer = imageFile
      } else if (imageFile instanceof File) {
        // File型の場合はBufferに変換
        const arrayBuffer = await imageFile.arrayBuffer()
        imageBuffer = Buffer.from(arrayBuffer)
      } else {
        throw new Error('Unsupported image file type')
      }

      // Google Cloud Vision APIでOCR実行
      const [result] = await client.textDetection({
        image: { content: imageBuffer }
      })

      const detections = result.textAnnotations
      const extractedText = detections?.[0]?.description || ''

      if (!extractedText) {
        throw new Error('テキストを検出できませんでした')
      }

      return extractedText
    } catch (error) {
      console.error('OCR処理エラー:', error)
      throw error
    }
  }

  /**
   * ブラウザ用のOCR処理（フロントエンド専用）
   */
  static async performOCRFromBrowser(imageFile: File): Promise<string> {
    try {
      const base64Data = await this.fileToBase64(imageFile)
      
      const response = await fetch('/api/ocr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: base64Data,
          features: [
            { type: 'TEXT_DETECTION', maxResults: 1 },
            { type: 'DOCUMENT_TEXT_DETECTION', maxResults: 1 }
          ]
        }),
      })

      if (!response.ok) {
        throw new Error(`OCR API Error: ${response.status}`)
      }

      const data = await response.json()
      
      if (data.error) {
        throw new Error(`OCR Processing Error: ${data.error}`)
      }

      // DOCUMENT_TEXT_DETECTIONの結果を優先
      if (data.responses?.[0]?.fullTextAnnotation?.text) {
        return data.responses[0].fullTextAnnotation.text
      }
      
      // フォールバック: TEXT_DETECTIONの結果を使用
      if (data.responses?.[0]?.textAnnotations?.[0]?.description) {
        return data.responses[0].textAnnotations[0].description
      }

      throw new Error('No text detected in image')
    } catch (error) {
      console.error('OCR処理エラー:', error)
      throw error
    }
  }

  /**
   * ファイルをBase64に変換（ブラウザ専用）
   */
  private static fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      if (typeof FileReader === 'undefined') {
        reject(new Error('FileReader is not available in this environment'))
        return
      }
      
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result as string
        // data:image/jpeg;base64, の部分を除去
        const base64 = result.split(',')[1]
        resolve(base64)
      }
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsDataURL(file)
    })
  }

  /**
   * OCR結果の品質チェック
   */
  static validateOCRResult(text: string): { valid: boolean; confidence: number; issues: string[] } {
    const issues: string[] = []
    let confidence = 1.0

    // 最小文字数チェック
    if (text.length < 10) {
      issues.push('テキストが短すぎます')
      confidence -= 0.3
    }

    // 日本語または英語の文字が含まれているかチェック
    const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text)
    const hasEnglish = /[a-zA-Z]/.test(text)
    const hasNumbers = /\d/.test(text)

    if (!hasJapanese && !hasEnglish) {
      issues.push('認識可能な文字が見つかりません')
      confidence -= 0.5
    }

    // 価格パターンの存在チェック
    const hasPricePattern = /[¥$]\d+|\d+円|\d+\.\d{2}/.test(text)
    if (!hasPricePattern) {
      issues.push('価格情報が見つかりません')
      confidence -= 0.2
    }

    // レシート特有のキーワードチェック
    const receiptKeywords = ['合計', '小計', '税込', '税抜', 'TOTAL', 'SUBTOTAL', 'TAX', 'レシート', '領収書']
    const hasReceiptKeyword = receiptKeywords.some(keyword => text.includes(keyword))
    
    if (!hasReceiptKeyword) {
      issues.push('レシート特有のキーワードが見つかりません')
      confidence -= 0.1
    }

    return {
      valid: confidence > 0.3,
      confidence: Math.max(0, confidence),
      issues
    }
  }
}