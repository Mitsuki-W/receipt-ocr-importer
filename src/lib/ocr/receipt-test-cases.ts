/**
 * レシートのテストケースと期待結果
 */

export interface ExpectedReceiptItem {
  name: string
  price: number
  quantity?: number
  taxType: 'T' | 'E'  // T=通常税率, E=軽減税率
  category: string
}

export interface ReceiptTestCase {
  receiptId: string
  description: string
  expectedItems: ExpectedReceiptItem[]
  totalAmount: number
  storeType: string
}

/**
 * 大型店舗レシートのテストケース（画像から正確に読み取った正解データ）
 */
export const WAREHOUSE_RECEIPT_TEST_CASE: ReceiptTestCase = {
  receiptId: 'warehouse-001',
  description: '大型店舗レシート - 実際の商品',
  storeType: 'warehouse',
  totalAmount: 25196,
  expectedItems: [
    {
      name: 'UGG ANSLEY シューズ',
      price: 5966,
      quantity: 1,
      taxType: 'T',
      category: '靴・アパレル'
    },
    {
      name: 'ユダノムヨーグルト 500×6',
      price: 998,
      quantity: 1,
      taxType: 'E',
      category: '乳製品'
    },
    {
      name: 'ユダヨーグルトカトウ 800',
      price: 638,
      quantity: 1,
      taxType: 'E',
      category: '乳製品'
    },
    {
      name: 'スンドゥプ チケ 150GX12',
      price: 1968,
      quantity: 1,
      taxType: 'E',
      category: '冷凍食品'
    },
    {
      name: 'うずらの卵50個',
      price: 1268,
      quantity: 1,
      taxType: 'E',
      category: '卵・乳製品'
    },
    {
      name: 'トクセンキュウニュウ 1LX2',
      price: 480,
      quantity: 1,
      taxType: 'E',
      category: '乳製品'
    },
    {
      name: 'PROSCIUTTO CRUDO',
      price: 1128,
      quantity: 1,
      taxType: 'E',
      category: '肉類・魚介類'
    },
    {
      name: 'KSグレープフルーツカップ',
      price: 2148,
      quantity: 1,
      taxType: 'E',
      category: '野菜・果物'
    },
    {
      name: 'シュリンプ カクテル',
      price: 2247,
      quantity: 1,
      taxType: 'E',
      category: '肉類・魚介類'
    },
    {
      name: 'マイケルリンネル MLEP-08',
      price: 5977,
      quantity: 1,
      taxType: 'T',
      category: '電子機器・バッグ'
    },
    {
      name: 'KS BATH TISSUE 30',
      price: 2378,
      quantity: 1,
      taxType: 'T',
      category: '日用品'
    }
  ]
}

/**
 * OCR結果とテストケースの照合
 */
export class ReceiptTestValidator {
  
  /**
   * OCR結果をテストケースと照合
   */
  static validateOCRResult(
    ocrItems: Array<{ name: string; price?: number; quantity?: number; category?: string }>,
    testCase: ReceiptTestCase
  ): {
    accuracy: number
    matchedItems: number
    totalExpected: number
    detailedReport: string
    missingItems: ExpectedReceiptItem[]
    incorrectItems: Array<{ ocr: any; expected?: ExpectedReceiptItem }>
  } {
    console.log(`🧪 テストケース照合開始: ${testCase.description}`)
    
    const matchedItems: ExpectedReceiptItem[] = []
    const missingItems: ExpectedReceiptItem[] = []
    const incorrectItems: Array<{ ocr: any; expected?: ExpectedReceiptItem }> = []
    
    // 期待される各商品について照合
    for (const expectedItem of testCase.expectedItems) {
      const matchedOCRItem = this.findBestMatch(expectedItem, ocrItems)
      
      if (matchedOCRItem) {
        // 価格チェック（10%の誤差まで許容）
        const priceDiff = Math.abs(matchedOCRItem.price - expectedItem.price)
        const priceTolerancePercent = Math.abs(priceDiff / expectedItem.price)
        
        if (matchedOCRItem.price === expectedItem.price || priceTolerancePercent <= 0.1) {
          matchedItems.push(expectedItem)
          if (matchedOCRItem.price === expectedItem.price) {
            console.log(`✅ 完全マッチ: ${expectedItem.name} - ¥${expectedItem.price}`)
          } else {
            console.log(`✅ 価格近似マッチ: ${expectedItem.name} - 期待¥${expectedItem.price} vs OCR¥${matchedOCRItem.price} (誤差${(priceTolerancePercent * 100).toFixed(1)}%)`)
          }
        } else {
          incorrectItems.push({ 
            ocr: matchedOCRItem, 
            expected: expectedItem 
          })
          console.log(`⚠️ 価格大幅不一致: ${expectedItem.name} - 期待¥${expectedItem.price} vs OCR¥${matchedOCRItem.price} (誤差${(priceTolerancePercent * 100).toFixed(1)}%)`)
        }
      } else {
        missingItems.push(expectedItem)
        console.log(`❌ 商品名未検出: ${expectedItem.name} - ¥${expectedItem.price}`)
      }
    }
    
    // OCRで検出されたが期待リストにない商品
    for (const ocrItem of ocrItems) {
      const hasMatch = testCase.expectedItems.some(expected => 
        this.isNameMatch(ocrItem.name, expected.name)
      )
      
      if (!hasMatch) {
        incorrectItems.push({ ocr: ocrItem })
        console.log(`⚠️ 予期しない商品: ${ocrItem.name} - ¥${ocrItem.price || '不明'}`)
      }
    }
    
    const accuracy = matchedItems.length / testCase.expectedItems.length
    
    const detailedReport = this.generateDetailedReport(
      matchedItems, 
      missingItems, 
      incorrectItems, 
      testCase
    )
    
    return {
      accuracy,
      matchedItems: matchedItems.length,
      totalExpected: testCase.expectedItems.length,
      detailedReport,
      missingItems,
      incorrectItems
    }
  }
  
  /**
   * 最適なマッチを探す
   */
  private static findBestMatch(
    expectedItem: ExpectedReceiptItem, 
    ocrItems: Array<{ name: string; price?: number }>
  ) {
    let bestMatch = null
    let bestScore = 0
    
    for (const ocrItem of ocrItems) {
      const nameScore = this.calculateNameSimilarity(expectedItem.name, ocrItem.name)
      const priceMatch = ocrItem.price === expectedItem.price ? 0.5 : 0
      const totalScore = nameScore * 0.7 + priceMatch * 0.3
      
      if (totalScore > bestScore && totalScore > 0.3) {
        bestScore = totalScore
        bestMatch = ocrItem
      }
    }
    
    return bestMatch
  }
  
  /**
   * 商品名の類似度計算
   */
  private static calculateNameSimilarity(expected: string, actual: string): number {
    // 正規化
    const normalizeString = (str: string) => 
      str.toLowerCase()
        .replace(/\s+/g, '')
        .replace(/[ー・]/g, '')
    
    const normalizedExpected = normalizeString(expected)
    const normalizedActual = normalizeString(actual)
    
    // 完全一致
    if (normalizedExpected === normalizedActual) return 1.0
    
    // 部分一致
    if (normalizedExpected.includes(normalizedActual) || 
        normalizedActual.includes(normalizedExpected)) {
      return 0.8
    }
    
    // キーワードマッチ
    const expectedKeywords = this.extractKeywords(expected)
    const actualKeywords = this.extractKeywords(actual)
    
    const matchingKeywords = expectedKeywords.filter(keyword =>
      actualKeywords.some(actualKeyword => 
        actualKeyword.includes(keyword) || keyword.includes(actualKeyword)
      )
    )
    
    if (matchingKeywords.length > 0) {
      return matchingKeywords.length / Math.max(expectedKeywords.length, 1) * 0.6
    }
    
    return 0
  }
  
  /**
   * キーワード抽出
   */
  private static extractKeywords(text: string): string[] {
    // 商品名から重要なキーワードを抽出
    const keywords = []
    
    // 基本的な単語分割
    const words = text.split(/[\s・×]/g).filter(word => word.length > 1)
    keywords.push(...words)
    
    // 特殊なパターン
    if (text.includes('ヨーグルト')) keywords.push('ヨーグルト')
    if (text.includes('牛乳')) keywords.push('牛乳')
    if (text.includes('卵')) keywords.push('卵')
    if (text.includes('シューズ')) keywords.push('シューズ')
    if (text.includes('バッグ')) keywords.push('バッグ')
    if (text.includes('ペーパー')) keywords.push('ペーパー')
    
    return keywords.filter(keyword => keyword.length > 1)
  }
  
  /**
   * 商品名マッチング
   */
  private static isNameMatch(actual: string, expected: string): boolean {
    return this.calculateNameSimilarity(expected, actual) > 0.5
  }
  
  /**
   * 詳細レポート生成
   */
  private static generateDetailedReport(
    matchedItems: ExpectedReceiptItem[],
    missingItems: ExpectedReceiptItem[],
    incorrectItems: Array<{ ocr: any; expected?: ExpectedReceiptItem }>,
    testCase: ReceiptTestCase
  ): string {
    const accuracy = (matchedItems.length / testCase.expectedItems.length * 100).toFixed(1)
    
    let report = `
📊 OCR精度レポート
===================
全体精度: ${accuracy}% (${matchedItems.length}/${testCase.expectedItems.length})

✅ 正確に検出された商品 (${matchedItems.length}件):
${matchedItems.map(item => `  • ${item.name} - ¥${item.price}`).join('\n')}

❌ 検出されなかった商品 (${missingItems.length}件):
${missingItems.map(item => `  • ${item.name} - ¥${item.price}`).join('\n')}

⚠️ 不正確な検出 (${incorrectItems.length}件):
${incorrectItems.map(item => {
  if (item.expected) {
    return `  • OCR: "${item.ocr.name}" ¥${item.ocr.price} | 期待: "${item.expected.name}" ¥${item.expected.price}`
  } else {
    return `  • 予期しない: "${item.ocr.name}" ¥${item.ocr.price || '不明'}`
  }
}).join('\n')}

🎯 改善提案:
${this.generateImprovementSuggestions(matchedItems, missingItems, incorrectItems)}
    `.trim()
    
    return report
  }
  
  /**
   * 改善提案生成
   */
  private static generateImprovementSuggestions(
    matchedItems: ExpectedReceiptItem[],
    missingItems: ExpectedReceiptItem[],
    incorrectItems: Array<{ ocr: any; expected?: ExpectedReceiptItem }>
  ): string {
    const suggestions = []
    
    if (missingItems.length > 0) {
      suggestions.push('• 商品名検出パターンの追加が必要')
      
      // 特定カテゴリの問題
      const missingCategories = [...new Set(missingItems.map(item => item.category))]
      if (missingCategories.length > 0) {
        suggestions.push(`• 特に以下のカテゴリで検出漏れ: ${missingCategories.join(', ')}`)
      }
    }
    
    if (incorrectItems.length > 0) {
      suggestions.push('• 価格マッチング精度の向上が必要')
    }
    
    const accuracy = matchedItems.length / (matchedItems.length + missingItems.length)
    if (accuracy < 0.7) {
      suggestions.push('• OCRエンジンの設定見直しを推奨')
      suggestions.push('• 画像前処理の改善を検討')
    }
    
    return suggestions.join('\n')
  }
}