import { OCRParseResult, ExtractedItem } from '@/types/ocr-patterns'

export class PatternOptimizer {
  /**
   * パターン結果を最適化
   */
  static optimizeResults(result: OCRParseResult): OCRParseResult {
    let optimizedItems = [...result.items]

    // 1. 重複除去の改善
    optimizedItems = this.removeDuplicatesAdvanced(optimizedItems)

    // 2. 価格の正規化
    optimizedItems = this.normalizePrices(optimizedItems)

    // 3. 商品名のクリーンアップ
    optimizedItems = this.cleanupProductNames(optimizedItems)

    // 4. カテゴリ推定の改善
    optimizedItems = this.improveCategories(optimizedItems)

    // 5. 信頼度の再計算
    optimizedItems = this.recalculateConfidence(optimizedItems)

    // 6. 品質スコアによるフィルタリング
    optimizedItems = this.filterByQuality(optimizedItems)

    // 7. 結果のソート
    optimizedItems = this.sortResults(optimizedItems)

    const overallConfidence = this.calculateOverallConfidence(optimizedItems)

    return {
      ...result,
      items: optimizedItems,
      confidence: overallConfidence
    }
  }

  /**
   * 高度な重複除去（類似度ベース）
   */
  private static removeDuplicatesAdvanced(items: ExtractedItem[]): ExtractedItem[] {
    const uniqueItems: ExtractedItem[] = []
    
    for (const item of items) {
      const isDuplicate = uniqueItems.some(existing => 
        this.calculateSimilarity(item, existing) > 0.8
      )
      
      if (!isDuplicate) {
        uniqueItems.push(item)
      } else {
        // 信頼度の高い方を残す
        const existingIndex = uniqueItems.findIndex(existing => 
          this.calculateSimilarity(item, existing) > 0.8
        )
        if (existingIndex !== -1 && item.confidence > uniqueItems[existingIndex].confidence) {
          uniqueItems[existingIndex] = item
        }
      }
    }
    
    return uniqueItems
  }

  /**
   * 商品間の類似度を計算
   */
  private static calculateSimilarity(item1: ExtractedItem, item2: ExtractedItem): number {
    // 商品名の類似度
    const nameSimilarity = this.stringSimilarity(item1.name, item2.name)
    
    // 価格の類似度（10%以内なら高い類似度）
    let priceSimilarity = 0
    if (item1.price && item2.price) {
      const priceDiff = Math.abs(item1.price - item2.price) / Math.max(item1.price, item2.price)
      priceSimilarity = priceDiff < 0.1 ? 1 : (1 - priceDiff)
    }
    
    // 重み付け平均
    return nameSimilarity * 0.7 + priceSimilarity * 0.3
  }

  /**
   * 文字列の類似度を計算（レーベンシュタイン距離ベース）
   */
  private static stringSimilarity(str1: string, str2: string): number {
    const normalized1 = str1.toLowerCase().replace(/\s+/g, '')
    const normalized2 = str2.toLowerCase().replace(/\s+/g, '')
    
    const maxLength = Math.max(normalized1.length, normalized2.length)
    if (maxLength === 0) return 1
    
    const distance = this.levenshteinDistance(normalized1, normalized2)
    return (maxLength - distance) / maxLength
  }

  /**
   * レーベンシュタイン距離を計算
   */
  private static levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null))
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        )
      }
    }
    
    return matrix[str2.length][str1.length]
  }

  /**
   * 価格の正規化
   */
  private static normalizePrices(items: ExtractedItem[]): ExtractedItem[] {
    return items.map(item => {
      if (!item.price) return item
      
      // 異常に高い/低い価格をチェック
      const price = item.price
      const normalizedPrice = price
      let confidence = item.confidence
      
      // 異常値検出
      if (price < 1) {
        // 価格が1円未満は無効
        confidence *= 0.1
      } else if (price > 100000) {
        // 10万円超は疑わしい
        confidence *= 0.3
      } else if (price > 50000) {
        // 5万円超は注意
        confidence *= 0.7
      }
      
      // 一般的でない価格パターンの検出
      if (price % 10 !== 0 && price > 100) {
        // 100円以上で10円単位でない場合は少し信頼度を下げる
        confidence *= 0.9
      }
      
      return {
        ...item,
        price: normalizedPrice,
        confidence
      }
    })
  }

  /**
   * 商品名のクリーンアップ
   */
  private static cleanupProductNames(items: ExtractedItem[]): ExtractedItem[] {
    return items.map(item => {
      let name = item.name
      let confidence = item.confidence
      
      // 不要な文字の除去
      const cleanPatterns = [
        /^\*+/,  // 先頭の*記号
        /\s+$/,  // 末尾の空白
        /^\s+/,  // 先頭の空白
        /[""'']/g,  // 引用符
        /\d+\s*円$/,  // 末尾の価格表示
        /\d+\s*¥$/,  // 末尾の価格表示
      ]
      
      for (const pattern of cleanPatterns) {
        name = name.replace(pattern, '')
      }
      
      // 商品名の長さチェック
      if (name.length < 2) {
        confidence *= 0.2
      } else if (name.length > 50) {
        confidence *= 0.5
      }
      
      // 数字のみの商品名は疑わしい
      if (/^\d+$/.test(name)) {
        confidence *= 0.1
      }
      
      // 特殊文字が多すぎる場合は疑わしい
      const specialCharCount = (name.match(/[^\w\s\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g) || []).length
      if (specialCharCount > name.length * 0.3) {
        confidence *= 0.6
      }
      
      return {
        ...item,
        name: name.trim(),
        confidence
      }
    })
  }

  /**
   * カテゴリ推定の改善
   */
  private static improveCategories(items: ExtractedItem[]): ExtractedItem[] {
    const categoryKeywords = {
      '野菜': [
        'レタス', 'キャベツ', 'にんじん', 'たまねぎ', 'じゃがいも', 'トマト', 'きゅうり',
        'ほうれん草', 'ブロッコリー', 'アスパラ', 'なす', 'ピーマン', 'もやし', 'ネギ',
        '大根', '白菜', 'かぼちゃ', 'さつまいも', 'ごぼう', 'れんこん'
      ],
      '肉類': [
        '牛肉', '豚肉', '鶏肉', 'ひき肉', 'ソーセージ', 'ハム', 'ベーコン', 'チキン',
        'ステーキ', 'もも肉', 'むね肉', 'ささみ', 'バラ肉', 'ロース', 'ミンチ'
      ],
      '魚介類': [
        'さけ', 'まぐろ', 'さんま', 'あじ', 'いわし', 'かつお', 'ぶり', 'たい',
        'えび', 'かに', 'いか', 'たこ', 'ほたて', 'あさり', 'しじみ'
      ],
      '乳製品': [
        '牛乳', 'ヨーグルト', 'チーズ', 'バター', '生クリーム', 'アイス', 'プリン'
      ],
      'パン・穀物': [
        'パン', '食パン', 'ロールパン', 'クロワッサン', '米', 'パスタ', 'うどん',
        'そば', 'ラーメン', 'そうめん', 'オートミール', 'シリアル'
      ],
      '調味料・調理材料': [
        '醤油', '味噌', '塩', '砂糖', '酢', '油', 'みりん', '酒', 'だし', 'コンソメ',
        'ケチャップ', 'マヨネーズ', 'ソース', 'ドレッシング', 'スパイス', '香辛料'
      ],
      '飲み物': [
        'お茶', 'コーヒー', 'ジュース', '水', 'ビール', 'ワイン', '日本酒', '焼酎',
        'コーラ', 'ソーダ', 'スポーツドリンク', 'エナジードリンク'
      ],
      'その他': []
    }

    return items.map(item => {
      if (item.category && item.category !== 'その他') {
        return item  // 既にカテゴリが設定されている場合はそのまま
      }

      const name = item.name.toLowerCase()
      let bestCategory = 'その他'
      let bestScore = 0

      for (const [category, keywords] of Object.entries(categoryKeywords)) {
        if (category === 'その他') continue
        
        const score = keywords.reduce((acc, keyword) => {
          if (name.includes(keyword.toLowerCase())) {
            return acc + 1
          }
          return acc
        }, 0)

        if (score > bestScore) {
          bestScore = score
          bestCategory = category
        }
      }

      return {
        ...item,
        category: bestCategory
      }
    })
  }

  /**
   * 信頼度の再計算
   */
  private static recalculateConfidence(items: ExtractedItem[]): ExtractedItem[] {
    return items.map(item => {
      let confidence = item.confidence
      
      // 商品名と価格の整合性チェック
      if (item.name && item.price) {
        // 商品名に価格情報が含まれているかチェック
        const priceInName = item.name.match(/(\d+)\s*[円¥]/)
        if (priceInName) {
          const namePrice = parseInt(priceInName[1])
          const priceDiff = Math.abs(namePrice - item.price) / item.price
          if (priceDiff < 0.1) {
            confidence += 0.1  // 一致している場合は信頼度アップ
          } else if (priceDiff > 0.5) {
            confidence *= 0.7  // 大きく異なる場合は信頼度ダウン
          }
        }
      }
      
      // パターンソースによる調整
      if (item.sourcePattern) {
        if (item.sourcePattern.includes('fallback')) {
          confidence *= 0.8  // フォールバックパターンは信頼度を下げる
        } else if (item.sourcePattern.includes('warehouse') || item.sourcePattern.includes('supermarket')) {
          confidence *= 1.1  // 店舗固有パターンは信頼度を上げる
        }
      }
      
      return {
        ...item,
        confidence: Math.min(confidence, 1.0)  // 最大1.0に制限
      }
    })
  }

  /**
   * 品質スコアによるフィルタリング
   */
  private static filterByQuality(items: ExtractedItem[]): ExtractedItem[] {
    return items.filter(item => {
      // 最低品質基準
      if (item.confidence < 0.1) return false
      if (!item.name || item.name.length < 2) return false
      if (item.price && (item.price < 1 || item.price > 999999)) return false
      
      // 明らかに無効な商品名をフィルタ
      const invalidPatterns = [
        /^[\d\s\-*]+$/,  // 数字と記号のみ
        /^[.,。、]+$/,   // 句読点のみ
        /^[\s]+$/,       // 空白のみ
      ]
      
      for (const pattern of invalidPatterns) {
        if (pattern.test(item.name)) return false
      }
      
      return true
    })
  }

  /**
   * 結果のソート
   */
  private static sortResults(items: ExtractedItem[]): ExtractedItem[] {
    return items.sort((a, b) => {
      // 1. 信頼度でソート（降順）
      if (a.confidence !== b.confidence) {
        return b.confidence - a.confidence
      }
      
      // 2. 行番号でソート（昇順）
      const aFirstLine = Math.min(...a.lineNumbers)
      const bFirstLine = Math.min(...b.lineNumbers)
      if (aFirstLine !== bFirstLine) {
        return aFirstLine - bFirstLine
      }
      
      // 3. 商品名でソート
      return a.name.localeCompare(b.name)
    })
  }

  /**
   * 全体信頼度の計算
   */
  private static calculateOverallConfidence(items: ExtractedItem[]): number {
    if (items.length === 0) return 0
    
    // 重み付き平均（高信頼度のアイテムにより大きな重み）
    const totalWeight = items.reduce((sum, item) => sum + item.confidence, 0)
    const weightedSum = items.reduce((sum, item) => sum + (item.confidence * item.confidence), 0)
    
    return totalWeight > 0 ? weightedSum / totalWeight : 0
  }

  /**
   * 結果の品質評価
   */
  static evaluateResults(result: OCRParseResult): {
    quality: 'excellent' | 'good' | 'fair' | 'poor'
    issues: string[]
    suggestions: string[]
  } {
    const issues: string[] = []
    const suggestions: string[] = []
    
    // 全体信頼度の評価
    if (result.confidence < 0.3) {
      issues.push('全体の信頼度が低すぎます')
      suggestions.push('画像の品質を向上させてください')
    }
    
    // アイテム数の評価
    if (result.items.length === 0) {
      issues.push('商品が検出されませんでした')
      suggestions.push('より鮮明な画像を使用してください')
    } else if (result.items.length > 50) {
      issues.push('検出された商品数が異常に多いです')
      suggestions.push('レシートの範囲を確認してください')
    }
    
    // 価格の一貫性チェック
    const pricesWithValues = result.items.filter(item => item.price && item.price > 0)
    if (pricesWithValues.length < result.items.length * 0.5) {
      issues.push('価格が検出されていない商品が多すぎます')
      suggestions.push('価格部分がはっきり見えるように撮影してください')
    }
    
    // 品質スコアの計算
    let qualityScore = result.confidence
    
    if (result.items.length > 0) {
      const avgItemConfidence = result.items.reduce((sum, item) => sum + item.confidence, 0) / result.items.length
      qualityScore = (qualityScore + avgItemConfidence) / 2
    }
    
    // フォールバック使用率の影響
    if (result.metadata.fallbackUsed) {
      qualityScore *= 0.8
    }
    
    // 品質判定
    let quality: 'excellent' | 'good' | 'fair' | 'poor'
    if (qualityScore >= 0.8) {
      quality = 'excellent'
    } else if (qualityScore >= 0.6) {
      quality = 'good'
    } else if (qualityScore >= 0.4) {
      quality = 'fair'
    } else {
      quality = 'poor'
    }
    
    return { quality, issues, suggestions }
  }
}