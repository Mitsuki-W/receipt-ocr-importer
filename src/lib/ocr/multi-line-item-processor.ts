import { ExtractedItem } from '@/types/ocr-patterns'

export interface MultiLineProcessingResult {
  processedItems: ExtractedItem[]
  improvements: {
    multiLineFixed: number
    incompleteNamesImproved: number
    qualityImprovement: string
  }
}

/**
 * 2段表記・複数行商品名の汎用的な後処理システム
 * Document AIの弱点を補完する
 */
export class MultiLineItemProcessor {
  
  /**
   * Document AI結果の2段表記問題を汎用的に修正
   */
  static processMultiLineItems(
    items: ExtractedItem[], 
    originalText: string,
    debugMode: boolean = false
  ): MultiLineProcessingResult {
    if (debugMode) {
      console.log('🔧 2段表記後処理開始:', { itemCount: items.length })
    }

    const improvements = {
      multiLineFixed: 0,
      incompleteNamesImproved: 0,
      qualityImprovement: ''
    }

    const lines = originalText.split('\n').map(line => line.trim()).filter(line => line.length > 0)

    const processedItems = items.map(item => {
      let processedItem = { ...item }
      
      // Step 1: 数量・単価情報パターンの特別処理
      processedItem = this.fixQuantityUnitPricePatterns(processedItem, lines, improvements, debugMode)
      
      // Step 2: 明らかな2段表記パターンを修正
      processedItem = this.fixObviousMultiLinePatterns(processedItem, improvements)
      
      // Step 3: 元テキストから完全な商品名を復元（残りの不完全な商品名）
      processedItem = this.reconstructFromOriginalText(processedItem, originalText, improvements)
      
      // Step 4: 不完全な商品名を改善
      processedItem = this.improveIncompleteNames(processedItem, improvements)
      
      return processedItem
    }).filter(item => this.isValidItem(item))

    // Step 5: 重複除去（価格ベース）
    const deduplicatedItems = this.removeDuplicatesByPrice(processedItems, debugMode)

    improvements.qualityImprovement = this.generateQualityReport(improvements)

    if (debugMode) {
      console.log('✅ 2段表記後処理完了:', {
        original: items.length,
        processed: deduplicatedItems.length,
        improvements
      })
    }

    return {
      processedItems: deduplicatedItems,
      improvements
    }
  }

  /**
   * 数量・単価情報パターンの特別処理
   * 例: 「2コX単118」→ 1行上の商品名を取得し、数量と単価を設定
   */
  private static fixQuantityUnitPricePatterns(
    item: ExtractedItem,
    lines: string[],
    improvements: any,
    debugMode: boolean = false
  ): ExtractedItem {
    const currentName = item.name.trim()
    
    // 数量・単価パターンを検出
    const quantityUnitPricePattern = /^(\d+)コ[X×]*単(\d+)$/
    const match = currentName.match(quantityUnitPricePattern)
    
    if (match) {
      const quantity = parseInt(match[1])
      const unitPrice = parseInt(match[2])
      
      if (debugMode) {
        console.log(`🔍 数量・単価パターン検出: "${currentName}" (数量:${quantity}, 単価:${unitPrice})`)
      }
      
      // 現在の価格行を特定
      const currentPriceStr = item.price.toString()
      let productLineIndex = -1
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        
        // 現在の数量・単価行を発見
        if (line.includes(currentName) || 
            (line.includes(quantity.toString()) && line.includes(unitPrice.toString()))) {
          
          // 1行上（商品名行）を確認
          if (i > 0) {
            const productNameLine = lines[i - 1].trim()
            
            // 商品名らしい行かチェック
            if (this.isLikelyProductName(productNameLine, '') && 
                !this.isSystemInformation(productNameLine) &&
                !/\d+/.test(productNameLine.replace(/[^\d]/g, '').slice(-3))) { // 末尾に大きな数字がない
              
              productLineIndex = i - 1
              break
            }
          }
        }
      }
      
      // 商品名行が見つかった場合
      if (productLineIndex >= 0) {
        const realProductName = lines[productLineIndex].trim()
        
        // アスタリスクを除去
        const cleanProductName = realProductName.replace(/^[*＊]+/, '').trim()
        
        if (debugMode) {
          console.log(`✅ 商品名復元成功: "${currentName}" → "${cleanProductName}" (${quantity}個 x ¥${unitPrice})`)
        }
        
        improvements.multiLineFixed++
        improvements.incompleteNamesImproved++
        
        return {
          ...item,
          name: cleanProductName,
          quantity: quantity,
          price: quantity * unitPrice, // 総額で設定
          sourcePattern: item.sourcePattern + '-quantity-unit-fixed',
          rawText: `${cleanProductName} | ${quantity}個 x ¥${unitPrice} = ¥${quantity * unitPrice}`,
          metadata: {
            ...item.metadata,
            unitPrice: unitPrice,
            originalQuantityLine: currentName
          }
        }
      } else if (debugMode) {
        console.log(`⚠️ 商品名行が見つかりません: "${currentName}"`)
      }
    }
    
    return item
  }

  /**
   * 明らかな2段表記パターンを修正
   */
  private static fixObviousMultiLinePatterns(
    item: ExtractedItem, 
    improvements: any
  ): ExtractedItem {
    const originalName = item.name
    let fixedName = originalName

    // パターン1: 改行文字が含まれている
    if (fixedName.includes('\n')) {
      fixedName = fixedName.replace(/\n/g, ' ').trim()
      improvements.multiLineFixed++
    }

    // パターン2: 軽減税率表記の修正
    if (fixedName.startsWith('軽\n') || fixedName.startsWith('軽 ')) {
      fixedName = fixedName.replace(/^軽[\n\s]+/, '軽減 ')
      improvements.multiLineFixed++
    }

    // パターン3: 単位や数量が商品名に混入
    if (fixedName.match(/^\d+コ[^\w]/)) {
      const unitMatch = fixedName.match(/^(\d+)コ\s*(.+)/)
      if (unitMatch) {
        fixedName = unitMatch[2].trim()
        // 数量情報を保持
        if (!item.quantity || item.quantity === 1) {
          item.quantity = parseInt(unitMatch[1])
        }
        improvements.multiLineFixed++
      }
    }

    // パターン4: 価格情報が商品名に混入
    if (fixedName.includes('¥') || fixedName.includes('円')) {
      fixedName = fixedName.replace(/[¥円]\d+/g, '').trim()
      improvements.incompleteNamesImproved++
    }

    return {
      ...item,
      name: fixedName
    }
  }

  /**
   * 元のOCRテキストから完全な商品名を復元
   */
  private static reconstructFromOriginalText(
    item: ExtractedItem,
    originalText: string,
    improvements: any
  ): ExtractedItem {
    const lines = originalText.split('\n').map(line => line.trim()).filter(line => line.length > 0)
    const currentName = item.name.trim()

    // 現在の商品名が短すぎる、または不完全な場合に復元を試行
    if (currentName.length < 8 || this.isIncompleteItemName(currentName)) {
      
      // より柔軟な価格マッチング
      const priceStr = item.price.toString()
      const pricePatterns = [
        new RegExp(`${priceStr}\\s*$`),           // 行末の価格
        new RegExp(`¥\\s*${priceStr}`),           // ¥マーク付き
        new RegExp(`${priceStr}\\s*円`),          // 円マーク付き
        new RegExp(`\\s${priceStr}\\s`),          // スペース区切り
        new RegExp(`${priceStr}\\s*T?\\s*$`)      // 税込マーク付き
      ]
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        
        // いずれかの価格パターンにマッチ
        const priceMatch = pricePatterns.some(pattern => pattern.test(line))
        
        if (priceMatch) {
          // 価格行周辺で商品名を探索（より広範囲）
          const searchRange = Math.min(5, i + 1) // 最大5行前まで
          
          for (let j = Math.max(0, i - searchRange); j <= Math.min(lines.length - 1, i + 2); j++) {
            if (j === i) continue // 価格行自体をスキップ
            
            const candidateLine = lines[j]
            
            if (this.isLikelyProductName(candidateLine, currentName)) {
              // より柔軟な商品名構築
              const reconstructedName = this.buildCompleteNameAdvanced(lines, j, i, currentName)
              
              if (reconstructedName.length > currentName.length && 
                  reconstructedName !== currentName &&
                  !this.isIncompleteItemName(reconstructedName)) {
                
                improvements.incompleteNamesImproved++
                
                if (global.debugMode) {
                  console.log(`🔍 商品名復元: "${currentName}" → "${reconstructedName}"`)
                }
                
                return {
                  ...item,
                  name: reconstructedName,
                  sourcePattern: item.sourcePattern + '-reconstructed'
                }
              }
            }
          }
        }
      }
      
      // 価格マッチに失敗した場合、より積極的な検索
      const alternativeResult = this.aggressiveNameReconstruction(lines, item, improvements)
      if (alternativeResult) {
        return alternativeResult
      }
    }

    return item
  }

  /**
   * 不完全な商品名かどうかを判定
   */
  private static isIncompleteItemName(name: string): boolean {
    const trimmedName = name.trim()
    
    // アスタリスク付きでも実際の商品名が含まれている場合は有効とする
    const nameWithoutAsterisk = trimmedName.replace(/^[*＊]+/, '').trim()
    if (nameWithoutAsterisk.length >= 4 && /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(nameWithoutAsterisk)) {
      return false // 有効な商品名
    }
    
    // 明らかに不完全なパターン
    const incompletePatterns = [
      /^[0-9\.\s]*$/,                    // 数字のみ
      /^[X単点コ\s]*$/,                  // 単位文字のみ
      /^軽$/,                            // 軽減税率の「軽」のみ
      /^[¥円]\d+$/,                     // 価格のみ
      /^[a-zA-Z0-9]{1,2}$/,              // 短い英数字
      /^[^\w\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]{1,3}$/,  // 記号のみ
      /^\d+コ[X単]*\d*$/,               // 数量表記のみ（例: 2コX単118）
      /^[\d]+[X単]+[\d]*$/              // 数字+X+単+数字パターン
    ]

    // 長さチェック（日本語商品名は通常3文字以上）
    if (trimmedName.length < 2) return true
    
    // パターンマッチング
    if (incompletePatterns.some(pattern => pattern.test(trimmedName))) return true
    
    // コープ系の略語パターン
    if (/^[\d]+コープ[\d]*$/.test(trimmedName)) return true
    
    return false
  }

  /**
   * 商品名らしい行かどうかを判定
   */
  private static isLikelyProductName(line: string, currentName: string): boolean {
    const trimmedLine = line.trim()
    
    // 価格情報を含まない
    if (/[¥円]\d+/.test(trimmedLine)) return false
    
    // システム情報・日付・レジ情報を含まない
    if (/^(合計|小計|税込|税抜|外税|内税|現金|お釣り|レジ|店舗|責任者|登録)/.test(trimmedLine)) return false
    if (/^\d{4}年\d{1,2}月\d{1,2}日/.test(trimmedLine)) return false // 日付形式
    if (/レジ\d+/.test(trimmedLine)) return false // レジ番号
    if (/登録No\d+/.test(trimmedLine)) return false // 登録番号
    if (/^\d{4}年.*レジ/.test(trimmedLine)) return false // 日付とレジの組み合わせ
    
    // 現在の名前の一部を含む、または商品名らしい文字列
    return trimmedLine.length >= 2 && (
      trimmedLine.includes(currentName) ||
      (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(trimmedLine) && 
       !this.isSystemInformation(trimmedLine)) || // 日本語かつシステム情報でない
      /[a-zA-Z]{3,}/.test(trimmedLine) // 3文字以上の英語
    )
  }

  /**
   * 複数行から完全な商品名を構築（改良版）
   */
  private static buildCompleteNameAdvanced(
    lines: string[], 
    productLineIndex: number, 
    priceLineIndex: number, 
    fallback: string
  ): string {
    const parts: string[] = []
    
    // 商品名行から価格行まで（または前後2行）を探索
    const startIndex = Math.max(0, productLineIndex - 1)
    const endIndex = Math.min(lines.length - 1, priceLineIndex + 1)
    
    for (let i = startIndex; i <= endIndex; i++) {
      const line = lines[i].trim()
      
      // 価格情報を含む行はスキップ
      if (i === priceLineIndex || /^[¥円\d\s\-]+$/.test(line)) continue
      
      // 商品名として有効な行を追加
      if (this.isLikelyProductName(line, fallback)) {
        // 重複除去
        if (!parts.some(part => part.includes(line) || line.includes(part))) {
          parts.push(line)
        }
      }
    }

    // 最適な組み合わせを選択
    const completeName = this.selectBestNameCombination(parts, fallback)
    return completeName.length > fallback.length ? completeName : fallback
  }

  /**
   * 最適な商品名の組み合わせを選択
   */
  private static selectBestNameCombination(parts: string[], fallback: string): string {
    if (parts.length === 0) return fallback
    if (parts.length === 1) return parts[0]
    
    // 最も情報量の多い行を選択
    const sortedParts = parts.sort((a, b) => {
      // 日本語商品名を優先
      const aHasJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(a)
      const bHasJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(b)
      
      if (aHasJapanese && !bHasJapanese) return -1
      if (!aHasJapanese && bHasJapanese) return 1
      
      // より長い方を優先
      return b.length - a.length
    })
    
    return sortedParts[0]
  }

  /**
   * より積極的な商品名復元
   */
  private static aggressiveNameReconstruction(
    lines: string[], 
    item: ExtractedItem, 
    improvements: any
  ): ExtractedItem | null {
    const currentName = item.name.trim()
    
    // 商品名らしい行を全て収集
    const productNameCandidates = lines.filter(line => 
      this.isLikelyProductName(line, currentName) &&
      line.length > currentName.length &&
      !this.isSystemInformation(line)
    )
    
    if (productNameCandidates.length > 0) {
      // 最も適切な候補を選択
      const bestCandidate = this.selectBestNameCombination(productNameCandidates, currentName)
      
      if (bestCandidate.length > currentName.length) {
        improvements.incompleteNamesImproved++
        
        return {
          ...item,
          name: bestCandidate,
          sourcePattern: item.sourcePattern + '-aggressive-reconstructed'
        }
      }
    }
    
    return null
  }

  /**
   * 不完全な商品名を改善
   */
  private static improveIncompleteNames(
    item: ExtractedItem,
    improvements: any
  ): ExtractedItem {
    let improvedName = item.name

    // 一般的な略語を展開
    const expansions: { [key: string]: string } = {
      'TV': 'トップバリュー',
      'PB': 'プライベートブランド',
      'コX': 'コープ',
      '単': ''
    }

    for (const [abbrev, full] of Object.entries(expansions)) {
      if (improvedName.includes(abbrev)) {
        improvedName = improvedName.replace(new RegExp(abbrev, 'g'), full).trim()
        improvements.incompleteNamesImproved++
      }
    }

    // 不要な文字を除去
    improvedName = improvedName
      .replace(/^[X\s]+/, '')           // 先頭のX
      .replace(/[X\s]+$/, '')           // 末尾のX  
      .replace(/\s+/g, ' ')             // 連続スペース
      .trim()

    return {
      ...item,
      name: improvedName
    }
  }

  /**
   * 有効な商品アイテムかどうかを判定
   */
  private static isValidItem(item: ExtractedItem): boolean {
    return item.name.length >= 1 &&
           item.price > 0 &&
           !this.isSystemInformation(item.name)
  }

  /**
   * システム情報かどうかを判定
   */
  private static isSystemInformation(name: string): boolean {
    const trimmedName = name.trim()
    
    const systemPatterns = [
      /^(合計|小計|税込|税抜|外税|内税|現金|お釣り|レジ|店舗|責任者|精算|バーコード|登録)/,
      /^[0-9\s\-\/]+$/,        // 日付や番号のみ
      /^[\.\*\-\s]+$/,         // 記号のみ
      /^\d{4}年\d{1,2}月\d{1,2}日/, // 日付形式
      /レジ\d+/,               // レジ番号
      /登録No\d+/,             // 登録番号
      /^\d{4}年.*レジ/,        // 日付とレジの組み合わせ
      /^20\d{2}年\d{2}月\d{2}日.*\d{2}:\d{2}.*レジ\d+$/ // 完全な日時レジ情報
    ]

    return systemPatterns.some(pattern => pattern.test(trimmedName))
  }

  /**
   * 価格ベースで重複を除去
   */
  private static removeDuplicatesByPrice(
    items: ExtractedItem[],
    debugMode: boolean = false
  ): ExtractedItem[] {
    const priceMap = new Map<number, ExtractedItem>()
    
    items.forEach(item => {
      const existingItem = priceMap.get(item.price)
      
      if (!existingItem) {
        priceMap.set(item.price, item)
      } else {
        // より良い商品名の方を選択
        if (this.isBetterItemName(item.name, existingItem.name)) {
          priceMap.set(item.price, item)
        }
      }
    })

    const result = Array.from(priceMap.values())
    
    if (debugMode && result.length !== items.length) {
      console.log('🔄 重複除去:', {
        before: items.length,
        after: result.length,
        removed: items.length - result.length
      })
    }

    return result
  }

  /**
   * より良い商品名かどうかを判定
   */
  private static isBetterItemName(nameA: string, nameB: string): boolean {
    // 長い方が良い（ただし明らかに不完全な場合は除く）
    if (!this.isIncompleteItemName(nameA) && this.isIncompleteItemName(nameB)) {
      return true
    }
    
    if (this.isIncompleteItemName(nameA) && !this.isIncompleteItemName(nameB)) {
      return false
    }

    // 両方とも完全な場合、より具体的な方を選択
    return nameA.length > nameB.length
  }

  /**
   * 品質改善レポートを生成
   */
  private static generateQualityReport(improvements: any): string {
    const reports: string[] = []
    
    if (improvements.multiLineFixed > 0) {
      reports.push(`2段表記修正: ${improvements.multiLineFixed}件`)
    }
    
    if (improvements.incompleteNamesImproved > 0) {
      reports.push(`商品名改善: ${improvements.incompleteNamesImproved}件`)
    }

    return reports.length > 0 
      ? reports.join(', ')
      : '品質改善なし'
  }
}