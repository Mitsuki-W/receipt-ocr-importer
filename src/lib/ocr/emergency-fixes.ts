import { ExtractedItem } from '@/types/ocr-patterns'

/**
 * 緊急対応用のフィルタリング・修正機能
 * 問題分析の結果が出るまでの暫定対策
 */
export class EmergencyOCRFixes {

  /**
   * 緊急フィルタリング：明らかに無効なアイテムを除去
   */
  static applyEmergencyFilters(items: ExtractedItem[]): ExtractedItem[] {
    return items
      .filter(item => !this.isRegisterNumber(item.name))     // レジ番号除去
      .filter(item => !this.isSystemCode(item.name))        // システムコード除去
      .filter(item => !this.isDateTime(item.name))          // 日時情報除去
      .filter(item => !this.isMetadata(item.name))          // メタデータ除去
      .map(item => this.cleanProductName(item))             // 商品名クリーンアップ
      .filter(item => this.isValidProduct(item))            // 最終検証
  }

  /**
   * 重複除去（緊急版）
   */
  static removeDuplicatesEmergency(items: ExtractedItem[]): ExtractedItem[] {
    const unique: ExtractedItem[] = []
    const seen = new Set<string>()

    for (const item of items) {
      const key = this.generateItemKey(item)
      
      if (!seen.has(key)) {
        seen.add(key)
        unique.push(item)
      } else {
        // 重複の場合、より信頼度の高い方を採用
        const existingIndex = unique.findIndex(existing => 
          this.generateItemKey(existing) === key
        )
        
        if (existingIndex !== -1 && item.confidence > unique[existingIndex].confidence) {
          unique[existingIndex] = item
        }
      }
    }

    return unique
  }

  /**
   * 商品名と価格の分離（緊急版）
   */
  static separateNameAndPrice(items: ExtractedItem[]): ExtractedItem[] {
    return items.map(item => {
      const cleaned = this.extractNameAndPrice(item.name)
      
      return {
        ...item,
        name: cleaned.name,
        price: cleaned.price || item.price
      }
    })
  }

  // === 検出ロジック ===

  private static isRegisterNumber(name: string): boolean {
    return (
      /^(レジ|REG|REGISTER|CASHIER)\d+$/i.test(name) ||
      /^R\d{2,3}$/i.test(name) ||
      /^[A-Z]{2}\d{2}$/i.test(name) ||
      /^\d{2,4}$/.test(name)  // 4桁以下の数字のみ
    )
  }

  private static isSystemCode(name: string): boolean {
    return (
      /^[A-Z0-9]{5,}$/.test(name) ||  // 5文字以上の英数字
      /^[0-9]{6,}$/.test(name) ||     // 6桁以上の数字
      /^(POS|TRN|TXN|SYS)\d+$/i.test(name) ||
      /^(ITEM|CODE|ID)\d+$/i.test(name)
    )
  }

  private static isDateTime(name: string): boolean {
    return (
      /^\d{4}[-\/]\d{1,2}[-\/]\d{1,2}/.test(name) ||  // 日付
      /^\d{1,2}:\d{2}/.test(name) ||                   // 時刻
      /^(AM|PM)\d{1,2}:\d{2}$/i.test(name) ||
      /^(月|火|水|木|金|土|日)/.test(name)               // 曜日
    )
  }

  private static isMetadata(name: string): boolean {
    const metadataKeywords = [
      '店舗', 'TEL', '電話', '住所', '営業時間', 'ありがとう', 'またお越し',
      '領収書', 'レシート', 'お預り', 'おつり', 'お釣り', '現金', 'クレジット',
      '小計', '合計', '税込', '税抜', '消費税', 'ポイント', 'カード',
      '責任者', '店長', 'スタッフ', 'バーコード', '商品コード'
    ]
    
    return metadataKeywords.some(keyword => name.includes(keyword))
  }

  private static isValidProduct(item: ExtractedItem): boolean {
    if (!item.name || item.name.length < 2) return false
    if (!item.price || item.price <= 0) return false
    if (item.price > 100000) return false  // 10万円超は除外
    
    // 記号のみの商品名は除外
    if (/^[^\w\s\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+$/.test(item.name)) {
      return false
    }
    
    return true
  }

  // === クリーンアップロジック ===

  private static cleanProductName(item: ExtractedItem): ExtractedItem {
    let cleanName = item.name
    
    // 前後の記号・空白を除去
    cleanName = cleanName.replace(/^[*\s\-_=]+/, '')
    cleanName = cleanName.replace(/[*\s\-_=]+$/, '')
    
    // 連続する空白を正規化
    cleanName = cleanName.replace(/\s+/g, ' ')
    
    // 商品名から価格部分を除去
    cleanName = cleanName.replace(/\d+[円¥]\s*$/, '')
    cleanName = cleanName.replace(/¥\d+\s*$/, '')
    
    return {
      ...item,
      name: cleanName.trim()
    }
  }

  private static extractNameAndPrice(text: string): { name: string; price?: number } {
    // パターン1: "りんご 180円" 形式
    const pattern1 = text.match(/^(.+?)\s+(\d+)[円¥]\s*$/)
    if (pattern1) {
      return {
        name: pattern1[1].trim(),
        price: parseInt(pattern1[2])
      }
    }
    
    // パターン2: "りんご ¥180" 形式
    const pattern2 = text.match(/^(.+?)\s+¥(\d+)\s*$/)
    if (pattern2) {
      return {
        name: pattern2[1].trim(),
        price: parseInt(pattern2[2])
      }
    }
    
    // パターン3: "りんご180" 形式（数字のみ）
    const pattern3 = text.match(/^(.+?)(\d{2,5})\s*$/)
    if (pattern3 && pattern3[1].length >= 2) {
      const price = parseInt(pattern3[2])
      if (price >= 10 && price <= 99999) {  // 妥当な価格範囲
        return {
          name: pattern3[1].trim(),
          price
        }
      }
    }
    
    // 分離できない場合はそのまま返す
    return { name: text.trim() }
  }

  private static generateItemKey(item: ExtractedItem): string {
    const normalizedName = item.name.toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[ー\-]/g, '')  // ハイフン類を正規化
    
    const priceRange = item.price ? Math.floor(item.price / 10) * 10 : 0  // 10円単位で丸める
    
    return `${normalizedName}-${priceRange}`
  }

  /**
   * 緊急修正の一括適用
   */
  static applyAllEmergencyFixes(items: ExtractedItem[]): ExtractedItem[] {
    console.log(`🚨 緊急修正適用前: ${items.length}件`)
    
    // 1. 基本フィルタリング
    let fixed = this.applyEmergencyFilters(items)
    console.log(`📋 基本フィルター後: ${fixed.length}件`)
    
    // 2. 商品名と価格の分離
    fixed = this.separateNameAndPrice(fixed)
    console.log(`🔧 名前・価格分離後: ${fixed.length}件`)
    
    // 3. 重複除去
    fixed = this.removeDuplicatesEmergency(fixed)
    console.log(`✨ 重複除去後: ${fixed.length}件`)
    
    return fixed
  }

  /**
   * 修正統計の取得
   */
  static getFixStatistics(original: ExtractedItem[], fixed: ExtractedItem[]) {
    const removed = original.length - fixed.length
    // null チェックを追加
    const validOriginal = original.filter(item => item && item.name)
    const regNumbersRemoved = validOriginal.filter(item => this.isRegisterNumber(item.name)).length
    const metadataRemoved = validOriginal.filter(item => this.isMetadata(item.name)).length
    const duplicatesRemoved = removed - regNumbersRemoved - metadataRemoved
    
    return {
      original: original.length,
      fixed: fixed.length,
      removed,
      details: {
        regNumbersRemoved,
        metadataRemoved,
        duplicatesRemoved: Math.max(0, duplicatesRemoved),
        cleanedNames: fixed.filter(item => 
          item && item.name && original.find(orig => orig && orig.rawText === item.rawText)?.name !== item.name
        ).length
      }
    }
  }
}