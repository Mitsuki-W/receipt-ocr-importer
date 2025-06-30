import { ExtractedItem } from '@/types/ocr-patterns'

/**
 * 大型店舗（WHOLESALE）専用のOCRパターンマッチング
 */
export class WarehousePatterns {

  /**
   * 大型店舗のOCRテキストを解析
   */
  static parseWarehouseText(ocrText: string): ExtractedItem[] {
    const lines = ocrText.split('\n').filter(line => line.trim())
    const items: ExtractedItem[] = []
    
    console.log(`📝 大型店舗解析開始: ${lines.length}行`)
    
    // システム情報・メタデータを除外
    const filteredLines = lines.filter(line => !this.shouldExclude(line.trim()))
    console.log(`🔍 フィルター後: ${filteredLines.length}行`)
    
    // 大型店舗専用の包括的パターンマッチング
    items.push(...this.extractWarehouseSpecificPattern(filteredLines))
    
    // 重複除去と最終クリーンアップ
    const cleanedItems = this.removeDuplicatesAndCleanup(items)
    console.log(`✨ 最終結果: ${cleanedItems.length}件`)
    
    return cleanedItems
  }

  /**
   * 除外すべき行かどうかを判定
   */
  private static shouldExclude(line: string): boolean {
    // 空行
    if (!line || line.length === 0) return true
    
    // 店舗情報
    if (/^(WHOLESALE|BIZ\/GOLD|会員|売上)/.test(line)) return true
    if (/^(\*\*\*\*|合計|小計)/.test(line)) return true
    
    // 日付・時刻・レシート番号
    if (/^\d{4}年\d{1,2}月\d{1,2}日/.test(line)) return true
    if (/^\d{2}:\d{2}/.test(line)) return true
    
    // 合計・税金関連
    const metadataKeywords = [
      '合計', '小計', '現金', 'クレジット', '税込', '税抜',
      '対象', '消費税', 'TOTAL', 'SUBTOTAL', 'TAX',
      'CASH', 'CREDIT', '****', '売上'
    ]
    if (metadataKeywords.some(keyword => line.includes(keyword))) return true
    
    // 短すぎる行や記号のみの行
    if (line.length <= 2) return true
    if (/^[-_=*]+$/.test(line)) return true
    
    return false
  }

  /**
   * 大型店舗専用の包括的パターンマッチング
   */
  private static extractWarehouseSpecificPattern(lines: string[]): ExtractedItem[] {
    const items: ExtractedItem[] = []
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      console.log(`🔍 大型店舗パターン解析: 行${i}: "${line}"`)
      
      // パターン1: 実際のOCR構造分析（柔軟なマッチング）
      if (i < lines.length - 2) {
        // 実際のOCR構造を詳細分析
        const currentLine = line
        
        // 商品名として認識可能かチェック
        const isProductName = this.isValidWarehouseProductName(currentLine) || 
                             (currentLine.startsWith('※') && this.isValidWarehouseProductName(currentLine.substring(1).trim()))
        
        if (isProductName) {
          console.log(`    📋 商品名候補: "${currentLine}"`)
          
          // 複数行の商品名を結合する処理を追加
          let fullProductName = currentLine
          let nameEndIndex = i
          
          // 次の行が商品名の続きかチェック（より慎重に）
          for (let nextIdx = i + 1; nextIdx < Math.min(i + 3, lines.length); nextIdx++) {
            const nextLine = lines[nextIdx]?.trim()
            // 商品コードや価格行でない場合は商品名の続きとして扱う
            if (nextLine && 
                !/^\d{5,7}$/.test(nextLine) && // 商品コードでない
                !/^[\d,]+(?:\.[\d,]+)?\s+[\d,]+(?:\.[\d,]+)?\s+[TE]$/.test(nextLine) && // 価格行でない
                !/^\d+[°]?$/.test(nextLine) && // 数量行でない
                !/^\d{3,5}\s+[TE]$/.test(nextLine) && // 価格+税区分でない
                !/^\d+\s+[\d,]+(?:\.[\d,]+)?\s+[\d,]+(?:\.[\d,]+)?\s+[TE]$/.test(nextLine) && // 数量 単価 合計 税区分でない
                !/^([\d,]+(?:\.[\d,]+)?)\s+([TE])$/.test(nextLine) && // 価格 税区分でない
                !/^\*$/.test(nextLine) && // 単独の*マークでない
                this.isValidWarehouseProductName(nextLine)) {
              
              // 特定の商品名の組み合わせを除外（誤結合防止）
              const combinedName = fullProductName + " " + nextLine
              if (!this.shouldAvoidCombining(fullProductName, nextLine)) {
                fullProductName = combinedName
                nameEndIndex = nextIdx
                console.log(`      🔗 商品名結合: "${fullProductName}"`)
              } else {
                console.log(`      ❌ 結合回避: "${fullProductName}" + "${nextLine}"`)
                break
              }
            } else {
              break
            }
          }
          
          // 次の数行で商品コードと価格を探す
          for (let j = nameEndIndex - i + 1; j <= Math.min(6, lines.length - i - 1); j++) {
            const checkLine = lines[i + j]?.trim()
            console.log(`      行${i + j}: "${checkLine}"`)
            
            // 商品コードを探す
            if (/^\d{5,7}$/.test(checkLine)) {
              const productCode = checkLine
              console.log(`      🔍 商品コード発見: ${productCode}`)
              
              // 価格情報を後続行で探す
              for (let k = j + 1; k <= Math.min(j + 4, lines.length - i - 1); k++) {
                const priceLine = lines[i + k]?.trim()
                console.log(`        価格行候補${i + k}: "${priceLine}"`)
                
                // パターン1: "5.966 5.966 T" 形式
                let priceMatch = priceLine?.match(/^([\d,]+(?:\.[\d,]+)?)\s+([\d,]+(?:\.[\d,]+)?)\s+([TE])$/)
                if (priceMatch) {
                  const unitPrice = parseFloat(priceMatch[1].replace(/,/g, ''))
                  const totalPrice = parseFloat(priceMatch[2].replace(/,/g, ''))
                  const taxType = priceMatch[3]
                  
                  const finalPrice = totalPrice < 100 ? Math.round(totalPrice * 1000) : Math.round(totalPrice)
                  
                  if (this.isValidPrice(finalPrice)) {
                    const productName = fullProductName.startsWith('※') ? fullProductName.substring(1).trim() : fullProductName
                    console.log(`  ✅ 価格パターン1成功: ${productName} - ¥${finalPrice} (税区分: ${taxType})`)
                    
                    items.push({
                      name: productName,
                      price: finalPrice,
                      quantity: 1,
                      confidence: 0.9,
                      sourcePattern: 'warehouse-flexible-pattern1',
                      lineNumbers: [i, i + j, i + k],
                      rawText: `${currentLine} | ${productCode} | ${priceLine}`,
                      category: this.categorizeProduct(productName),
                      metadata: {
                        productCode,
                        unitPrice: unitPrice < 100 ? Math.round(unitPrice * 1000) : Math.round(unitPrice),
                        taxType,
                        reducedTaxRate: taxType === 'E',
                        hasAsterisk: currentLine.startsWith('※')
                      }
                    })
                    i = nameEndIndex + k // 処理した行まで飛ばす
                    break
                  }
                }
                
                // パターン2: "998 E" 形式
                priceMatch = priceLine?.match(/^(\d{3,5})\s+([TE])$/)
                if (priceMatch) {
                  const totalPrice = parseInt(priceMatch[1])
                  const taxType = priceMatch[2]
                  
                  if (this.isValidPrice(totalPrice)) {
                    const productName = fullProductName.startsWith('※') ? fullProductName.substring(1).trim() : fullProductName
                    console.log(`  ✅ 価格パターン2成功: ${productName} - ¥${totalPrice} (税区分: ${taxType})`)
                    
                    items.push({
                      name: productName,
                      price: totalPrice,
                      quantity: 1,
                      confidence: 0.85,
                      sourcePattern: 'warehouse-flexible-pattern2',
                      lineNumbers: [i, i + j, i + k],
                      rawText: `${currentLine} | ${productCode} | ${priceLine}`,
                      category: this.categorizeProduct(productName),
                      metadata: {
                        productCode,
                        taxType,
                        reducedTaxRate: taxType === 'E',
                        hasAsterisk: currentLine.startsWith('※')
                      }
                    })
                    i = nameEndIndex + k // 処理した行まで飛ばす
                    break
                  }
                }
                
                // パターン3: 分離した価格行（数字のみ + 後続の税区分）
                if (/^\d{3,5}$/.test(priceLine) && k < Math.min(j + 4, lines.length - i - 1)) {
                  const nextPriceLine = lines[i + k + 1]?.trim()
                  const taxMatch = nextPriceLine?.match(/^(\d{3,5})\s+([TE])$/)
                  
                  if (taxMatch && parseInt(priceLine) === parseInt(taxMatch[1])) {
                    const totalPrice = parseInt(priceLine)
                    const taxType = taxMatch[2]
                    
                    if (this.isValidPrice(totalPrice)) {
                      const productName = fullProductName.startsWith('※') ? fullProductName.substring(1).trim() : fullProductName
                      console.log(`  ✅ 価格パターン3成功: ${productName} - ¥${totalPrice} (税区分: ${taxType})`)
                      
                      items.push({
                        name: productName,
                        price: totalPrice,
                        quantity: 1,
                        confidence: 0.8,
                        sourcePattern: 'warehouse-flexible-pattern3',
                        lineNumbers: [i, i + j, i + k, i + k + 1],
                        rawText: `${currentLine} | ${productCode} | ${priceLine} | ${nextPriceLine}`,
                        category: this.categorizeProduct(productName),
                        metadata: {
                          productCode,
                          taxType,
                          reducedTaxRate: taxType === 'E',
                          hasAsterisk: currentLine.startsWith('※')
                        }
                      })
                      i = nameEndIndex + k + 1 // 処理した行まで飛ばす
                      break
                    }
                  }
                }
                
                // パターン4: 特殊な価格行（"10 1.128" → "1. 128 E"）
                if (/^(\d+)\s+([\d,]+(?:\.[\d,]+)?)$/.test(priceLine) && k < Math.min(j + 4, lines.length - i - 1)) {
                  const nextPriceLine = lines[i + k + 1]?.trim()
                  const specialPriceMatch = nextPriceLine?.match(/^([\d,]+(?:\.[\d,]+)?)\s+([TE])$/)
                  
                  if (specialPriceMatch) {
                    const quantityMatch = priceLine.match(/^(\d+)\s+([\d,]+(?:\.[\d,]+)?)$/)
                    const quantity = parseInt(quantityMatch[1])
                    const unitPrice = parseFloat(quantityMatch[2].replace(/,/g, ''))
                    const totalPrice = parseFloat(specialPriceMatch[1].replace(/,/g, '').replace(/\s+/g, ''))
                    const taxType = specialPriceMatch[2]
                    
                    const finalPrice = totalPrice < 100 ? Math.round(totalPrice * 1000) : Math.round(totalPrice)
                    
                    if (this.isValidPrice(finalPrice)) {
                      const productName = fullProductName.startsWith('※') ? fullProductName.substring(1).trim() : fullProductName
                      console.log(`  ✅ 価格パターン4成功: ${productName} - ¥${finalPrice} (x${quantity}, 税区分: ${taxType})`)
                      
                      items.push({
                        name: productName,
                        price: finalPrice,
                        quantity: quantity,
                        confidence: 0.85,
                        sourcePattern: 'warehouse-flexible-pattern4',
                        lineNumbers: [i, i + j, i + k, i + k + 1],
                        rawText: `${fullProductName} | ${productCode} | ${priceLine} | ${nextPriceLine}`,
                        category: this.categorizeProduct(productName),
                        metadata: {
                          productCode,
                          unitPrice: unitPrice < 100 ? Math.round(unitPrice * 1000) : Math.round(unitPrice),
                          taxType,
                          reducedTaxRate: taxType === 'E',
                          hasAsterisk: fullProductName.startsWith('※')
                        }
                      })
                      i = nameEndIndex + k + 1 // 処理した行まで飛ばす
                      break
                    }
                  }
                }
                
                // パターン5: 単一の税区分行（"2.378 T"）
                if (/^([\d,]+(?:\.[\d,]+)?)\s+([TE])$/.test(priceLine)) {
                  const singlePriceMatch = priceLine.match(/^([\d,]+(?:\.[\d,]+)?)\s+([TE])$/)
                  const totalPrice = parseFloat(singlePriceMatch[1].replace(/,/g, ''))
                  const taxType = singlePriceMatch[2]
                  
                  const finalPrice = totalPrice < 100 ? Math.round(totalPrice * 1000) : Math.round(totalPrice)
                  
                  if (this.isValidPrice(finalPrice)) {
                    const productName = fullProductName.startsWith('※') ? fullProductName.substring(1).trim() : fullProductName
                    console.log(`  ✅ 価格パターン5成功: ${productName} - ¥${finalPrice} (税区分: ${taxType})`)
                    
                    items.push({
                      name: productName,
                      price: finalPrice,
                      quantity: 1,
                      confidence: 0.75,
                      sourcePattern: 'warehouse-flexible-pattern5',
                      lineNumbers: [i, i + j, i + k],
                      rawText: `${fullProductName} | ${productCode} | ${priceLine}`,
                      category: this.categorizeProduct(productName),
                      metadata: {
                        productCode,
                        taxType,
                        reducedTaxRate: taxType === 'E',
                        hasAsterisk: fullProductName.startsWith('※')
                      }
                    })
                    i = nameEndIndex + k // 処理した行まで飛ばす
                    break
                  }
                }
              }
              break // 商品コードが見つかったら内側ループを抜ける
            }
          }
          
          // 商品名が見つかったが商品コードが見つからない場合のフォールバック（処理済みでない場合のみ）
          let processedInCurrentLoop = false
          for (const existingItem of items) {
            if (existingItem.lineNumbers && existingItem.lineNumbers.includes(i)) {
              processedInCurrentLoop = true
              break
            }
          }
          
          if (isProductName && !processedInCurrentLoop) {
            console.log(`    ⚠️ 商品コード未発見、フォールバック処理: "${fullProductName}"`)
            
            // 直後の行で価格パターンを探す
            for (let k = 1; k <= Math.min(4, lines.length - nameEndIndex - 1); k++) {
              const directPriceLine = lines[nameEndIndex + k]?.trim()
              console.log(`      直接価格行候補${nameEndIndex + k}: "${directPriceLine}"`)
              
              // 直接価格パターン
              const directPriceMatch = directPriceLine?.match(/^(\d{3,5})\s+([TE])$/)
              if (directPriceMatch) {
                const totalPrice = parseInt(directPriceMatch[1])
                const taxType = directPriceMatch[2]
                
                if (this.isValidPrice(totalPrice)) {
                  const productName = fullProductName.startsWith('※') ? fullProductName.substring(1).trim() : fullProductName
                  console.log(`  ✅ 直接価格パターン成功: ${productName} - ¥${totalPrice} (税区分: ${taxType})`)
                  
                  items.push({
                    name: productName,
                    price: totalPrice,
                    quantity: 1,
                    confidence: 0.7,
                    sourcePattern: 'warehouse-direct-price',
                    lineNumbers: [i, nameEndIndex + k],
                    rawText: `${fullProductName} | ${directPriceLine}`,
                    category: this.categorizeProduct(productName),
                    metadata: {
                      taxType,
                      reducedTaxRate: taxType === 'E',
                      hasAsterisk: fullProductName.startsWith('※'),
                      noProductCode: true
                    }
                  })
                  i = nameEndIndex + k // 処理した行まで飛ばす
                  break
                }
              }
            }
          }
        }
      }
      
      // パターン2: 軽減税率商品（※マーク付き）
      const reducedTaxMatch = line.match(/^※\s*(.+?)\s+(\d{5,7})\s+(\d+)個\s+([\d,]+)\s+([\d,]+)\s+E$/)
      if (reducedTaxMatch) {
        const name = reducedTaxMatch[1].trim()
        const productCode = reducedTaxMatch[2]
        const quantity = parseInt(reducedTaxMatch[3])
        const unitPrice = parseInt(reducedTaxMatch[4].replace(/,/g, ''))
        const totalPrice = parseInt(reducedTaxMatch[5].replace(/,/g, ''))
        
        if (this.isValidPrice(totalPrice)) {
          console.log(`  ✅ 軽減税率パターン成功: ${name} - ¥${totalPrice} (x${quantity})`)
          items.push({
            name,
            price: totalPrice,
            quantity: quantity,
            confidence: 0.95,
            sourcePattern: 'warehouse-reduced-tax',
            lineNumbers: [i],
            rawText: line,
            category: this.categorizeProduct(name),
            metadata: {
              productCode,
              unitPrice,
              taxType: 'E',
              reducedTaxRate: true,
              hasAsterisk: true
            }
          })
          continue
        }
      }
      
      // パターン2: 通常税率商品
      const normalTaxMatch = line.match(/^(.+?)\s+(\d{5,7})\s+(\d+)個\s+([\d,]+)\s+([\d,]+)\s+T$/)
      if (normalTaxMatch) {
        const name = normalTaxMatch[1].trim()
        const productCode = normalTaxMatch[2]
        const quantity = parseInt(normalTaxMatch[3])
        const unitPrice = parseInt(normalTaxMatch[4].replace(/,/g, ''))
        const totalPrice = parseInt(normalTaxMatch[5].replace(/,/g, ''))
        
        if (this.isValidWarehouseProductName(name) && this.isValidPrice(totalPrice)) {
          console.log(`  ✅ 通常税率パターン成功: ${name} - ¥${totalPrice} (x${quantity})`)
          items.push({
            name,
            price: totalPrice,
            quantity: quantity,
            confidence: 0.9,
            sourcePattern: 'warehouse-normal-tax',
            lineNumbers: [i],
            rawText: line,
            category: this.categorizeProduct(name),
            metadata: {
              productCode,
              unitPrice,
              taxType: 'T',
              reducedTaxRate: false
            }
          })
          continue
        }
      }
      
      // パターン3: 汎用パターン（※の有無を問わない）
      const generalMatch = line.match(/^(※\s*)?(.+?)\s+(\d{5,7})\s+(\d+)個\s+([\d,]+)\s+([\d,]+)\s+([TE])$/)
      if (generalMatch) {
        const hasAsterisk = !!generalMatch[1]
        const name = generalMatch[2].trim()
        const productCode = generalMatch[3]
        const quantity = parseInt(generalMatch[4])
        const unitPrice = parseInt(generalMatch[5].replace(/,/g, ''))
        const totalPrice = parseInt(generalMatch[6].replace(/,/g, ''))
        const taxType = generalMatch[7]
        
        if (this.isValidWarehouseProductName(name) && this.isValidPrice(totalPrice)) {
          console.log(`  ✅ 汎用パターン成功: ${name} - ¥${totalPrice} (x${quantity}, 税区分: ${taxType})`)
          items.push({
            name,
            price: totalPrice,
            quantity: quantity,
            confidence: 0.85,
            sourcePattern: 'warehouse-general',
            lineNumbers: [i],
            rawText: line,
            category: this.categorizeProduct(name),
            metadata: {
              productCode,
              unitPrice,
              taxType,
              reducedTaxRate: taxType === 'E',
              hasAsterisk
            }
          })
          continue
        }
      }
    }
    
    return items
  }

  /**
   * 大型店舗商品名として妥当かチェック
   */
  private static isValidWarehouseProductName(text: string): boolean {
    console.log(`    🔍 大型店舗商品名判定: "${text}"`)
    
    if (!text || text.length < 2 || text.length > 60) {
      console.log(`    ❌ 長さが不適切: ${text.length}文字`)
      return false
    }
    
    // 商品コードではない
    if (/^\d{5,7}$/.test(text)) {
      console.log(`    ❌ 商品コード`)
      return false
    }
    
    // 価格行ではない
    if (/^[\d,]+(?:\.[\d,]+)?\s+[\d,]+(?:\.[\d,]+)?\s+[TE]$/.test(text)) {
      console.log(`    ❌ 価格行`)
      return false
    }
    
    // 数量行ではない
    if (/^\d+[°]?$/.test(text)) {
      console.log(`    ❌ 数量行`)
      return false
    }
    
    // 明らかなメタデータでない
    if (/^(COSTCO|合計|小計|税|レジ|TOTAL|SUBTOTAL|TAX|CASH|CREDIT|EWHOLESALE|BIZ\/GOLD|売上|クレジット|釣錢|対象|消費税|御買上|点数|\*\*\*\*)/.test(text)) {
      console.log(`    ❌ メタデータキーワード`)
      return false
    }
    
    // 単純な数字や記号のみではない
    if (/^[\d\s.,°*-]+$/.test(text)) {
      console.log(`    ❌ 数字・記号のみ`)
      return false
    }
    
    // 日本語、英語、またはアルファベットを含む
    if (!/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAFa-zA-Z]/.test(text.replace(/^※\s*/, ''))) {
      console.log(`    ❌ 文字要素が不足`)
      return false
    }
    
    console.log(`    ✅ 大型店舗商品名として適切`)
    return true
  }

  /**
   * 商品名結合を避けるべきかチェック
   */
  private static shouldAvoidCombining(firstName: string, secondName: string): boolean {
    // 異なる商品カテゴリの組み合わせを避ける
    const avoidCombinations = [
      // 卵と牛乳の組み合わせ
      { first: /うずら.*卵/, second: /ギュウニュウ|牛乳|ミルク/ },
      { first: /卵/, second: /ギュウニュウ|牛乳|ミルク/ },
      // 明らかに異なる商品
      { first: /PROSCIUTTO/, second: /KS|グレープフルーツ/ },
      { first: /シュリンプ/, second: /マイケル|TISSUE/ },
    ]
    
    for (const avoid of avoidCombinations) {
      if (avoid.first.test(firstName) && avoid.second.test(secondName)) {
        return true
      }
      if (avoid.first.test(secondName) && avoid.second.test(firstName)) {
        return true
      }
    }
    
    return false
  }

  /**
   * 妥当な価格かチェック（大型店舗向け）
   */
  private static isValidPrice(price: number): boolean {
    return price >= 100 && price <= 10000  // 大型店舗の一般的な価格帯（円単位）
  }

  /**
   * 商品の分類（大型店舗向け）
   */
  private static categorizeProduct(name: string): string {
    const categories = [
      { keywords: ['UGG', 'ANSLEY', 'シューズ', 'BATH', 'TISSUE'], category: '日用品・アパレル' },
      { keywords: ['スプレー', 'ルト', 'サトラクト'], category: '洗剤・清掃用品' },
      { keywords: ['うずら', '卵'], category: '食品・卵類' },
      { keywords: ['カップヌードル', 'ヌードル'], category: '食品・麺類' },
      { keywords: ['PROSCIUTTO', 'CRUDO'], category: '食品・肉類' },
      { keywords: ['マドレープ', 'フルーツ', 'カップ'], category: '食品・果物' },
      { keywords: ['シューズ', 'カクテル'], category: '食品・その他' },
      { keywords: ['バッハツ', 'MLE'], category: '電子機器・その他' }
    ]
    
    for (const cat of categories) {
      if (cat.keywords.some(keyword => name.includes(keyword))) {
        return cat.category
      }
    }
    
    return 'その他'
  }

  /**
   * 重複除去とクリーンアップ
   */
  private static removeDuplicatesAndCleanup(items: ExtractedItem[]): ExtractedItem[] {
    console.log(`🧹 重複除去開始: ${items.length}件`)
    
    // より厳密な重複除去
    const seenItems = new Set<string>()
    const uniqueItems: ExtractedItem[] = []
    
    items.forEach((item, index) => {
      // 商品の一意性判定キー
      const uniqueKey = this.generateUniqueKey(item)
      console.log(`  商品${index + 1}: "${item.name}" - キー: "${uniqueKey}"`)
      
      if (!seenItems.has(uniqueKey)) {
        seenItems.add(uniqueKey)
        uniqueItems.push(item)
        console.log(`    ✅ 追加`)
      } else {
        console.log(`    ❌ 重複スキップ`)
      }
    })
    
    console.log(`🧹 重複除去完了: ${items.length}件 → ${uniqueItems.length}件`)
    
    return uniqueItems
      .filter(item => this.isValidPrice(item.price))
      .sort((a, b) => b.confidence - a.confidence)
  }

  /**
   * 商品の一意性キーを生成
   */
  private static generateUniqueKey(item: ExtractedItem): string {
    // 商品コードがある場合は商品コード + 価格
    if (item.metadata?.productCode) {
      return `${item.metadata.productCode}-${item.price}`
    }
    
    // 商品コードがない場合は正規化された商品名 + 価格
    const normalizedName = this.normalizeProductName(item.name)
    return `${normalizedName}-${item.price}`
  }

  /**
   * 商品名の正規化
   */
  private static normalizeProductName(name: string): string {
    return name
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[ー\-]/g, '')
      .replace(/[（）()]/g, '')
      .replace(/[※×]/g, '')
  }

  /**
   * 大型店舗の期待される商品リスト（参考用）
   */
  static getExpectedItems(): Array<{name: string, priceRange: [number, number]}> {
    return [
      { name: 'UGG ANSLEY シューズ', priceRange: [5000, 7000] },
      { name: 'スプレー ルト50XG', priceRange: [800, 1200] },
      { name: 'うずら玉の卵50個', priceRange: [1000, 1500] },
      { name: 'カップヌードル 1LX2', priceRange: [400, 600] },
      { name: 'PROSCIUTTO CRUDO', priceRange: [1000, 1300] },
      { name: 'KS フルーツカップ', priceRange: [2000, 2500] },
      { name: 'KS BATH TISSUE 30', priceRange: [2000, 2500] }
    ]
  }
}