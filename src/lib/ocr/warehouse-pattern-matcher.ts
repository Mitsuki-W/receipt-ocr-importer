import { ExtractedItem } from '@/types/ocr-patterns'
import { KNOWN_PRODUCT_PATTERNS, PATTERN_CONFIG } from './warehouse-pattern-definitions'
import { ProductNameNormalizer } from './product-name-normalizer'
import { PatternValidationUtils } from './pattern-validation-utils'

/**
 * 大型店舗（WHOLESALE）専用のOCRパターンマッチング（リファクタリング版）
 * メインロジックと品質管理を担当
 */
export class WarehousePatternMatcher {

  /**
   * 大型店舗のOCRテキストを解析（適応型パーサー使用）
   */
  static parseWarehouseText(ocrText: string): ExtractedItem[] {
    console.log(`🏪 適応型レシートパーサー開始`)
    console.log('=' + '='.repeat(50))
    
    // Step 1: 適応型パターンで解析
    console.log('🧠 Step 1: 適応型パターンマッチング')
    let items = AdaptiveReceiptParser.parseAdaptively(ocrText)
    
    // Step 1.5: 結果が不十分な場合、汎用パーサーでフォールバック
    const minExpectedItems = Math.max(2, ocrText.split('\n').filter(l => l.trim()).length * 0.1)
    if (items.length < minExpectedItems) {
      console.log('📦 フォールバック: 汎用パーサーを併用')
      const fallbackItems = UniversalReceiptParser.parseReceipt(ocrText)
      
      // 重複を避けて結合
      const newItems = fallbackItems.filter(newItem => 
        !PatternValidationUtils.isDuplicateItem(newItem, items)
      )
      
      items.push(...newItems)
      console.log(`📈 フォールバック結果: +${newItems.length}件 (合計: ${items.length}件)`)
    }
    
    // Step 2: デバッグモード時の詳細分析
    if (process.env.NODE_ENV === 'development') {
      this.performDebugAnalysis(ocrText, items)
    }
    
    // Step 3: 補完的パターンマッチング
    const supplementaryItems = this.findSupplementaryPatterns(ocrText, items)
    items.push(...supplementaryItems)
    
    // Step 4: 最終品質チェック
    const qualityCheckedItems = this.finalQualityCheck(items)
    
    console.log(`✅ 最終結果: ${qualityCheckedItems.length}件の商品を検出`)
    console.log('=' + '='.repeat(50))
    
    return qualityCheckedItems
  }

  /**
   * デバッグ分析を実行
   */
  private static performDebugAnalysis(ocrText: string, items: ExtractedItem[]): void {
    console.log('\n🔬 Step 2: 包括的デバッグ分析')
    
    // 簡易パフォーマンス診断
    console.log('\n📈 パフォーマンス診断:')
    console.log(`- 検出アイテム数: ${items.length}`)
    console.log(`- 処理行数: ${ocrText.split('\n').length}`)
    
    // 改善提案
    const suggestions = items.length === 0 ? ['商品検出パターンの見直しが必要です'] : []
    if (suggestions.length > 0) {
      console.log('\n💡 改善提案:')
      suggestions.forEach((suggestion, index) => {
        console.log(`  ${index + 1}. ${suggestion}`)
      })
    }
  }

  /**
   * 補完的パターンマッチングで追加の商品を検索
   */
  private static findSupplementaryPatterns(ocrText: string, existingItems: ExtractedItem[]): ExtractedItem[] {
    const lines = ocrText.split('\n').map(line => line.trim()).filter(line => line.length > 0)
    const supplementaryItems: ExtractedItem[] = []
    const processedLines = new Set<number>()

    // 既存アイテムの行番号をマーク
    existingItems.forEach(item => {
      if (item.lineNumbers) {
        item.lineNumbers.forEach(lineNum => processedLines.add(lineNum))
      }
    })

    // 高信頼度商品の検索
    const highConfidenceItems = this.findItemsWithHighConfidence(lines, processedLines)
    supplementaryItems.push(...highConfidenceItems)

    // 既知パターンの検索
    const knownPatternItems = this.findKnownPatterns(lines, processedLines)
    supplementaryItems.push(...knownPatternItems)

    // 汎用価格パターンの検索
    const genericItems = PatternValidationUtils.findGenericPricePatterns(lines)
    const filteredGenericItems = genericItems.filter(item => 
      !PatternValidationUtils.isDuplicateItem(item, [...existingItems, ...supplementaryItems])
    )
    supplementaryItems.push(...filteredGenericItems)

    return supplementaryItems
  }

  /**
   * 高信頼度商品を検索
   */
  private static findItemsWithHighConfidence(lines: string[], processedLines: Set<number>): ExtractedItem[] {
    const items: ExtractedItem[] = []

    for (let i = 0; i < lines.length - 4; i++) {
      if (processedLines.has(i)) continue

      // 5行パターンの検索
      const warehouseItem = PatternValidationUtils.findWarehouseProduct(lines, i, processedLines)
      if (warehouseItem) {
        const normalizedName = ProductNameNormalizer.normalizeProductName(warehouseItem.name)
        warehouseItem.name = normalizedName
        warehouseItem.category = ProductNameNormalizer.categorizeProduct(normalizedName)
        
        items.push(warehouseItem)
        console.log(`  📦 5行パターン検出: ${normalizedName} (¥${warehouseItem.price})`)
        
        // 処理済みマーク
        warehouseItem.lineNumbers?.forEach(lineNum => processedLines.add(lineNum))
      }
    }

    // 分離商品名パターンの検索
    const splitNameItems = PatternValidationUtils.findSplitNameProducts(lines, processedLines)
    splitNameItems.forEach(item => {
      const normalizedName = ProductNameNormalizer.normalizeProductName(item.name)
      item.name = normalizedName
      item.category = ProductNameNormalizer.categorizeProduct(normalizedName)
      console.log(`  📦 分離名パターン検出: ${normalizedName} (¥${item.price})`)
    })
    items.push(...splitNameItems)

    return items
  }

  /**
   * 既知パターンから商品を検索
   */
  private static findKnownPatterns(lines: string[], processedLines: Set<number>): ExtractedItem[] {
    const items: ExtractedItem[] = []
    const allText = lines.join(' ').toLowerCase()

    for (const pattern of KNOWN_PRODUCT_PATTERNS) {
      // キーワードマッチング
      const hasAllKeywords = pattern.keywords.every(keyword => 
        allText.includes(keyword.toLowerCase())
      )

      if (hasAllKeywords) {
        // 価格を確認
        const priceFound = lines.some(line => {
          const price = PatternValidationUtils.extractPriceFromLine(line)
          return price && Math.abs(price - pattern.expectedPrice) <= 100
        })

        if (priceFound) {
          items.push({
            name: pattern.normalizedName,
            price: pattern.expectedPrice,
            quantity: 1,
            confidence: PATTERN_CONFIG.confidence.high,
            sourcePattern: 'known-pattern',
            lineNumbers: [],
            rawText: pattern.keywords.join(' '),
            category: pattern.category,
            metadata: {
              taxType: pattern.taxType,
              reducedTaxRate: pattern.taxType === 'E',
              knownPattern: true
            }
          })
          
          console.log(`  🎯 既知パターン検出: ${pattern.normalizedName} (¥${pattern.expectedPrice})`)
        }
      }
    }

    return items
  }

  /**
   * 最終品質チェック
   */
  private static finalQualityCheck(items: ExtractedItem[]): ExtractedItem[] {
    console.log(`\n🔍 Step 4: 最終品質チェック (${items.length}件を検証)`)
    
    const validItems = items.filter(item => {
      // 基本的な妥当性チェック
      if (!PatternValidationUtils.isValidProductName(item.name)) {
        console.log(`  ❌ 無効な商品名: "${item.name}"`)
        return false
      }

      if (!item.price || !PatternValidationUtils.isValidPrice(item.price)) {
        console.log(`  ❌ 無効な価格: "${item.name}" - ¥${item.price}`)
        return false
      }

      // 品質スコアチェック
      const qualityScore = PatternValidationUtils.calculateQualityScore(item)
      if (qualityScore < 50) {
        console.log(`  ⚠️ 低品質アイテム: "${item.name}" (スコア: ${qualityScore})`)
        return false
      }

      return true
    })

    // 重複除去
    const uniqueItems: ExtractedItem[] = []
    validItems.forEach(item => {
      if (!PatternValidationUtils.isDuplicateItem(item, uniqueItems)) {
        uniqueItems.push(item)
      } else {
        console.log(`  🔄 重複除去: "${item.name}"`)
      }
    })

    // 商品名の正規化を再適用
    uniqueItems.forEach(item => {
      item.name = ProductNameNormalizer.normalizeProductName(item.name)
      if (!item.category) {
        item.category = ProductNameNormalizer.categorizeProduct(item.name)
      }
    })

    console.log(`✅ 品質チェック完了: ${items.length}件 → ${uniqueItems.length}件`)
    
    return uniqueItems
  }
}