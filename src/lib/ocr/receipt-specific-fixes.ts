import { ExtractedItem } from '@/types/ocr-patterns'

/**
 * Receipt2.jpgの具体的な問題に対応した修正クラス
 */
export class ReceiptSpecificFixes {

  /**
   * Receipt2.jpgの問題に特化した修正を適用
   */
  static fixReceipt2Problems(items: ExtractedItem[]): ExtractedItem[] {
    console.log(`🛠️ Receipt2問題修正開始: ${items.length}件`)
    
    // 1. システム・レジ情報の除去
    let filtered = items.filter(item => !this.isSystemInfo(item.name))
    console.log(`📋 システム情報除去後: ${filtered.length}件`)
    
    // 2. メタデータ（小計・合計など）の除去
    filtered = filtered.filter(item => !this.isReceiptMetadata(item.name))
    console.log(`📊 メタデータ除去後: ${filtered.length}件`)
    
    // 3. 数量情報のみの行を除去
    filtered = filtered.filter(item => !this.isQuantityOnly(item.name))
    console.log(`🔢 数量情報のみ除去後: ${filtered.length}件`)
    
    // 4. 商品名から価格を分離
    filtered = filtered.map(item => this.separateNameAndPrice(item))
    console.log(`🔧 名前・価格分離後: ${filtered.length}件`)
    
    // 5. 重複商品の統合（より高度なロジック）
    filtered = this.mergeDuplicateProducts(filtered)
    console.log(`🔄 重複統合後: ${filtered.length}件`)
    
    // 6. 価格の妥当性チェック
    filtered = filtered.filter(item => this.isValidPrice(item.price))
    console.log(`💰 価格妥当性チェック後: ${filtered.length}件`)
    
    // 7. 商品名の妥当性チェック
    filtered = filtered.filter(item => this.isValidProductName(item.name))
    console.log(`📝 商品名妥当性チェック後: ${filtered.length}件`)
    
    return filtered
  }

  /**
   * システム・レジ情報の検出
   */
  private static isSystemInfo(name: string): boolean {
    const systemPatterns = [
      /スキャンレジ\d+/,
      /スキャン\s*No\d+/,
      /領収証明細/,
      /スNo\s*\d+/,
      /レシート\s*No/,
      /取引番号/,
      /店舗コード/,
      /レジ番号/,
      /^R\d{3,4}$/,
      /^REG\d+$/,
      /ひらいし$/,  // 店員名など
      /^[A-Z]{2,3}\d{4,}$/  // システムコード
    ]
    
    return systemPatterns.some(pattern => pattern.test(name))
  }

  /**
   * レシートメタデータの検出
   */
  private static isReceiptMetadata(name: string): boolean {
    const metadataKeywords = [
      '小計', '合計', 'お釣り', 'おつり', 'お預り', 'おあずかり',
      '現金', '釣銭', '税込', '税抜', '消費税', '内税', '外税',
      '対象額', '課税', '非課税', 'ポイント', 'カード番号',
      '営業時間', '住所', 'TEL', '電話', 'ありがとう', 'またお越し',
      'クレジット', 'VISA', 'Master', 'JCB', 'AMEX',
      '領収書', 'レシート', '明細', '証明', '控え'
    ]
    
    // キーワードマッチ
    if (metadataKeywords.some(keyword => name.includes(keyword))) {
      return true
    }
    
    // パーセンテージ表記
    if (/\(\d+%\)/.test(name) || /\d+%\s*対象/.test(name)) {
      return true
    }
    
    return false
  }

  /**
   * 数量情報のみの行を検出
   */
  private static isQuantityOnly(name: string): boolean {
    const quantityPatterns = [
      /^\d+コX\d+$/,      // 2コX98
      /^\d+コX単\d+$/,    // 2コX単88
      /^\d+個X\d+$/,
      /^\d+本X\d+$/,
      /^X\d+$/,
      /^\d+コ$/,
      /^\d+個$/,
      /^\d+本$/
    ]
    
    return quantityPatterns.some(pattern => pattern.test(name))
  }

  /**
   * 商品名から価格を分離
   */
  private static separateNameAndPrice(item: ExtractedItem): ExtractedItem {
    let name = item.name
    let price = item.price
    
    // パターン1: "フレッシュパック ¥228" → "フレッシュパック"
    const pattern1 = name.match(/^(.+?)\s+¥(\d+)$/)
    if (pattern1) {
      name = pattern1[1].trim()
      // 価格が妥当な範囲なら更新
      const extractedPrice = parseInt(pattern1[2])
      if (extractedPrice >= 10 && extractedPrice <= 10000) {
        price = extractedPrice
      }
    }
    
    // パターン2: "商品名 123円" → "商品名"
    const pattern2 = name.match(/^(.+?)\s+(\d+)円$/)
    if (pattern2) {
      name = pattern2[1].trim()
      const extractedPrice = parseInt(pattern2[2])
      if (extractedPrice >= 10 && extractedPrice <= 10000) {
        price = extractedPrice
      }
    }
    
    // パターン3: 末尾の数字を除去（商品名として不適切な場合）
    const pattern3 = name.match(/^(.+?)\s+(\d{2,4})$/)
    if (pattern3 && pattern3[1].length >= 3) {
      const baseName = pattern3[1].trim()
      const possiblePrice = parseInt(pattern3[2])
      
      // 商品名として妥当で、価格として妥当な場合のみ分離
      if (this.isValidProductName(baseName) && possiblePrice >= 10 && possiblePrice <= 10000) {
        name = baseName
        if (!price || price <= 0) {
          price = possiblePrice
        }
      }
    }
    
    return {
      ...item,
      name: name.trim(),
      price
    }
  }

  /**
   * 重複商品の高度な統合
   */
  private static mergeDuplicateProducts(items: ExtractedItem[]): ExtractedItem[] {
    const groups = new Map<string, ExtractedItem[]>()
    
    // 商品名で分類
    items.forEach(item => {
      const key = this.normalizeProductName(item.name)
      if (!groups.has(key)) {
        groups.set(key, [])
      }
      groups.get(key)!.push(item)
    })
    
    const merged: ExtractedItem[] = []
    
    for (const [key, groupItems] of groups) {
      if (groupItems.length === 1) {
        // 重複なし
        merged.push(groupItems[0])
      } else {
        // 重複あり - 最適な商品を選択
        const bestItem = this.selectBestItem(groupItems)
        merged.push(bestItem)
      }
    }
    
    return merged
  }

  /**
   * 商品名の正規化（重複検出用）
   */
  private static normalizeProductName(name: string): string {
    return name
      .toLowerCase()
      .replace(/\s+/g, '')          // 空白除去
      .replace(/[ー\-]/g, '')       // ハイフン除去
      .replace(/[（）()]/g, '')      // 括弧除去
      .replace(/\d+$/, '')          // 末尾の数字除去
  }

  /**
   * 重複グループから最適なアイテムを選択
   */
  private static selectBestItem(items: ExtractedItem[]): ExtractedItem {
    // 1. 最も妥当な価格のものを優先
    const validPriceItems = items.filter(item => 
      item.price && item.price >= 10 && item.price <= 10000
    )
    
    if (validPriceItems.length === 1) {
      return validPriceItems[0]
    }
    
    if (validPriceItems.length > 1) {
      // 2. 信頼度が高いものを優先
      const sortedByConfidence = validPriceItems.sort((a, b) => b.confidence - a.confidence)
      
      // 3. 商品名がより適切なものを優先
      const sortedByName = sortedByConfidence.sort((a, b) => {
        const aScore = this.calculateNameQuality(a.name)
        const bScore = this.calculateNameQuality(b.name)
        return bScore - aScore
      })
      
      return sortedByName[0]
    }
    
    // 妥当な価格がない場合は、最も適切な商品名のものを選択
    return items.sort((a, b) => {
      const aScore = this.calculateNameQuality(a.name)
      const bScore = this.calculateNameQuality(b.name)
      return bScore - aScore
    })[0]
  }

  /**
   * 商品名の品質スコアを計算
   */
  private static calculateNameQuality(name: string): number {
    let score = 0
    
    // 適切な長さ
    if (name.length >= 2 && name.length <= 20) score += 3
    if (name.length >= 3 && name.length <= 15) score += 2
    
    // 日本語が含まれる
    if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(name)) score += 5
    
    // 英数字のみでない
    if (!/^[A-Za-z0-9\s]+$/.test(name)) score += 2
    
    // 数字のみでない
    if (!/^\d+$/.test(name)) score += 3
    
    // 記号が少ない
    const symbolCount = (name.match(/[^\w\s\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g) || []).length
    if (symbolCount === 0) score += 2
    else if (symbolCount <= 1) score += 1
    
    return score
  }

  /**
   * 価格の妥当性チェック
   */
  private static isValidPrice(price?: number): boolean {
    if (!price) return false
    return price >= 10 && price <= 50000  // 10円〜50,000円
  }

  /**
   * 商品名の妥当性チェック
   */
  private static isValidProductName(name: string): boolean {
    if (!name || name.length < 2 || name.length > 30) return false
    
    // 数字のみは無効
    if (/^\d+$/.test(name)) return false
    
    // 記号のみは無効
    if (/^[^\w\s\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+$/.test(name)) return false
    
    // システムコードっぽいものは無効
    if (/^[A-Z0-9]{5,}$/.test(name)) return false
    
    return true
  }

  /**
   * Receipt2.jpg用の特別処理
   */
  static applyReceipt2SpecificFixes(items: ExtractedItem[]): ExtractedItem[] {
    return this.fixReceipt2Problems(items)
      .map(item => ({
        ...item,
        // 信頼度を調整
        confidence: Math.min(0.9, item.confidence + 0.1),
        // カテゴリを改善
        category: this.improveCategory(item.name, item.category)
      }))
      .filter(item => item.name.length >= 2)  // 最終チェック
  }

  /**
   * カテゴリ分類の改善
   */
  private static improveCategory(name: string, currentCategory?: string): string {
    if (currentCategory && currentCategory !== 'その他') {
      return currentCategory
    }
    
    const categoryKeywords = {
      '野菜': ['白菜', 'たまねぎ', 'じゃがいも', 'いんげん', 'キャベツ', 'ごぼう'],
      '肉類': ['豚ばら', '豚ひき', 'ロースハム', 'ベーコン', 'ハム'],
      '調味料': ['ごま油', '油'],
      '缶詰・加工食品': ['コーン', 'シーチキン'],
      '豆腐・大豆製品': ['厚あげ', '豆腐'],
      'その他': ['レジ袋', 'フレッシュパック']
    }
    
    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some(keyword => name.includes(keyword))) {
        return category
      }
    }
    
    return 'その他'
  }

  /**
   * 修正統計の生成
   */
  static generateFixStatistics(original: ExtractedItem[], fixed: ExtractedItem[]) {
    const systemInfoRemoved = original.filter(item => this.isSystemInfo(item.name)).length
    const metadataRemoved = original.filter(item => this.isReceiptMetadata(item.name)).length
    const quantityOnlyRemoved = original.filter(item => this.isQuantityOnly(item.name)).length
    const duplicatesRemoved = original.length - fixed.length - systemInfoRemoved - metadataRemoved - quantityOnlyRemoved
    
    return {
      original: original.length,
      fixed: fixed.length,
      removed: original.length - fixed.length,
      details: {
        systemInfoRemoved,
        metadataRemoved,
        quantityOnlyRemoved,
        duplicatesRemoved: Math.max(0, duplicatesRemoved)
      },
      improvement: {
        reductionPercentage: ((original.length - fixed.length) / original.length * 100).toFixed(1),
        qualityImprovement: 'システム情報とメタデータを除去し、重複を統合'
      }
    }
  }
}