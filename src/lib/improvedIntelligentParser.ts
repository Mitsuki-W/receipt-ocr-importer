// lib/improvedIntelligentParser.ts

export interface ParsedItem {
  name: string
  price?: number
  quantity?: number
  category?: string
  confidence: number
  detectionMethod: string
  rawLines?: string[]
  lineIndices?: number[]
}

export interface LineAnalysis {
  index: number
  content: string
  originalContent: string
  type: LineType
  confidence: number
  features: LineFeatures
  relatedLines: number[]
}

export enum LineType {
  ITEM_NAME = 'item_name',
  PRICE_ONLY = 'price_only', 
  QUANTITY_INFO = 'quantity_info',
  PRODUCT_CODE = 'product_code',
  STORE_INFO = 'store_info',
  TOTAL_LINE = 'total_line',
  SEPARATOR = 'separator',
  UNKNOWN = 'unknown'
}

export interface LineFeatures {
  hasNumbers: boolean
  isOnlyNumbers: boolean
  hasPriceSymbols: boolean
  numberValue?: number
  hasJapanese: boolean
  hasKatakana: boolean
  hasHiragana: boolean
  hasKanji: boolean
  hasAlphabet: boolean
  matchesPricePattern: boolean
  matchesQuantityPattern: boolean
  matchesCodePattern: boolean
  matchesFoodKeywords: boolean
  matchesExcludeKeywords: boolean
  length: number
  position: number
  positionRatio: number
  isFirstLine: boolean
  isLastLine: boolean
  priceMatch?: RegExpMatchArray
  quantityMatch?: RegExpMatchArray
  codeMatch?: RegExpMatchArray
}

export class UniversalReceiptParser {
  private foodKeywords!: Set<string>
  private excludeKeywords!: Set<string>
  private categories!: Map<string, string[]>
  
  constructor() {
    this.initializeKeywords()
    this.initializeCategories()
  }
  
  private initializeKeywords() {
    this.foodKeywords = new Set([
      'レタス', 'キャベツ', 'にんじん', 'たまねぎ', 'じゃがいも', 'トマト', 'きゅうり', 'なす', 'ピーマン', 'もやし',
      'ほうれん草', '白菜', '大根', 'しめじ', 'エリンギ', 'しいたけ', 'ネギ', 'ニラ', 'アスパラ', 'ブロッコリー',
      'ごぼう', 'いんげん', 'ぶなしめじ', 'りんご', 'バナナ', 'みかん', 'いちご', 'ぶどう', 'なし', 'もも', 'メロン',
      'すいか', 'キウイ', 'パイン', 'オレンジ', 'グレープフルーツ', 'レモン', 'ライム', 'あじわい', 'カップ',
      '牛肉', '豚肉', '鶏肉', 'ひき肉', 'ソーセージ', 'ハム', 'ベーコン', '若鶏', 'ロース', 'モモ', 'むね', 'から揚',
      'シーチキン', 'ばら', 'こま', 'うす切', 'うす切り', 'さけ', 'まぐろ', 'あじ', 'さば', 'いわし', '刺身', '切身',
      'かれい', 'からすかれい', 'シュリンプ', 'カクテル', '牛乳', 'ヨーグルト', 'チーズ', 'バター', '生クリーム',
      'ミルク', 'ユタ', 'ギュウニュウ', 'キュウニュウ', 'パン', '食パン', '米', 'パスタ', 'うどん', 'そば', '麺',
      'ラーメン', 'そうめん', '風麺', 'しょうゆ', '味噌', '塩', '砂糖', '油', 'みりん', '酢', 'ソース', 'ごま油',
      'マヨネーズ', 'ケチャップ', 'こんぶ', '金麦', '糖質オフ', 'コーラ', 'ジュース', 'お茶', 'コーヒー', '水',
      'ビール', 'ワイン', '茶', '冷凍', 'アイス', '豆腐', 'ケンち', 'スンドゥブ', 'スンドゥプ', '卵', 'うずら',
      '厚あげ', 'コーン', 'チキン', 'パルム', 'チョコ', 'スイー', 'やわらか', 'フレッシュバック', '無添加',
      '阿蘇', 'TVやさしさ', 'TV低糖質'
    ])
    
    this.excludeKeywords = new Set([
      '小計', '合計', '税込', '税抜', '消費税', '割引', '現金', 'クレジット', 'クレカ', 'レシート', '領収書',
      '店舗', '住所', '電話', 'TEL', 'FAX', '営業時間', 'ありがとう', 'またお越し', 'ポイント', 'カード',
      'お預り', 'おつり', 'お釣り', 'WAON', 'nanaco', 'Suica', 'PASMO', 'PayPay', 'LINE Pay', 'レジ',
      '登録機', '釣銭', 'おつり', '支払', '決済', '精算', '会計', '責:', '本日', '日時', '時刻', '年', '月',
      '日', '時', '分', '秒', '曜日', '2024', '2025', '2023', '2022', '令和', '平成', '株式会社', '有限会社',
      '合同会社', '(株)', '(有)', 'Ltd', 'Inc', 'Co', 'バーコード', 'QRコード', 'コード', 'No', 'ID',
      '番号', 'お買上', 'スキャン', '外税', '内税', '対象額', '対象商品', '軽減税率', '標準税率', '温め',
      'あたため', 'レジ袋', 'エコ', '割り箸', 'スプーン', 'フォーク', '受付センター', 'センター', 'LC',
      'LaCuCa', '加算', '週間', '以内', '点数', 'MLEP', 'Market', 'Edy', 'WHOLESALE', 'BIZ', 'GOLD',
      '会員', '売上', 'RECEIPT', 'TOTAL', 'SUBTOTAL', 'TAX', 'CASH', 'CREDIT'
    ])
  }
  
  private initializeCategories() {
    this.categories = new Map([
      ['野菜', ['レタス', 'キャベツ', 'にんじん', 'たまねぎ', 'じゃがいも', 'トマト', 'きゅうり', 'なす', 'ピーマン', 'もやし', 'ほうれん草', '白菜', '大根', 'しめじ', 'ごぼう', 'いんげん', 'ぶなしめじ']],
      ['果物', ['りんご', 'バナナ', 'みかん', 'いちご', 'ぶどう', 'グレープフルーツ', 'あじわい']],
      ['肉類', ['牛肉', '豚肉', '鶏肉', 'ひき肉', 'ソーセージ', 'ハム', 'ベーコン', '若鶏', 'ロース', 'から揚', 'シーチキン', 'ばら', 'こま']],
      ['魚類', ['さけ', 'まぐろ', 'あじ', 'さば', 'いわし', '刺身', 'かれい', 'からすかれい', 'シュリンプ']],
      ['乳製品', ['牛乳', 'ヨーグルト', 'チーズ', 'バター', 'ミルク', 'ユタ', 'キュウニュウ']],
      ['パン・穀物', ['パン', '米', 'パスタ', 'うどん', '風麺']],
      ['調味料', ['油', 'ごま油', 'こんぶ']],
      ['飲料', ['金麦', '糖質オフ']],
      ['冷凍食品', ['冷凍', 'アイス', 'パルム']],
      ['豆腐・大豆製品', ['豆腐', 'ケンち', 'スンドゥブ', 'スンドゥプ', '厚あげ']],
      ['その他食品', ['卵', 'うずら', 'コーン', 'チョコ', 'スイー']]
    ])
  }
  
  parse(text: string): ParsedItem[] {
    const lines = text.split('\n').filter(line => line.trim()).map(line => line.trim())
    
    const lineAnalyses = this.analyzeAllLines(lines)
    const receiptFormat = this.detectReceiptFormat(lineAnalyses)
    const items = this.extractItemsByFormat(lineAnalyses, receiptFormat)
    const finalItems = this.finalValidation(items, lineAnalyses)
    
    return finalItems
  }
  
  private analyzeAllLines(lines: string[]): LineAnalysis[] {
    return lines.map((line, index) => {
      const features = this.extractDetailedFeatures(line, index, lines.length)
      const type = this.classifyLineAccurately(line, features, index, lines)
      const confidence = this.calculateAccurateConfidence(line, features, type)
      
      return {
        index,
        content: line,
        originalContent: line,
        type,
        confidence,
        features,
        relatedLines: []
      }
    })
  }
  
  private extractDetailedFeatures(line: string, index: number, totalLines: number): LineFeatures {
    const hasJapanese = /[あ-んア-ンぁ-ゖ]/.test(line)
    const hasKatakana = /[ア-ン]/.test(line)
    const hasHiragana = /[あ-んぁ-ゖ]/.test(line)
    const hasKanji = /[一-龯]/.test(line)
    const hasAlphabet = /[a-zA-Z]/.test(line)
    const hasNumbers = /\d/.test(line)
    const isOnlyNumbers = /^\d+$/.test(line)
    
    const pricePatterns = [
      /^¥(\d{1,6})$/,
      /^(\d{1,6})円$/,
      /^(\d{1,6})\*$/,
      /^(\d{1,6})X$/,
      /^\*(.+?)\s+¥(\d{1,5})$/,
    ]
    
    let priceMatch: RegExpMatchArray | undefined
    let matchesPricePattern = false
    
    for (const pattern of pricePatterns) {
      const match = line.match(pattern)
      if (match) {
        priceMatch = match
        matchesPricePattern = true
        break
      }
    }
    
    const quantityPatterns = [
      /^(\d+)コ$/,
      /^(\d+)コX(\d+)$/,
      /^(\d+)コX単(\d+)$/,
      /^(\d+)[⚫°.]$/,
    ]
    
    let quantityMatch: RegExpMatchArray | undefined
    let matchesQuantityPattern = false
    
    for (const pattern of quantityPatterns) {
      const match = line.match(pattern)
      if (match) {
        quantityMatch = match
        matchesQuantityPattern = true
        break
      }
    }
    
    const codePatterns = [
      /^(\d{4})軽?$/,
      /^(\d{5,7})$/,
      /^[A-Z0-9\-_]{5,}$/,
    ]
    
    let codeMatch: RegExpMatchArray | undefined
    let matchesCodePattern = false
    
    for (const pattern of codePatterns) {
      const match = line.match(pattern)
      if (match) {
        codeMatch = match
        matchesCodePattern = true
        break
      }
    }
    
    const matchesFoodKeywords = Array.from(this.foodKeywords).some(keyword => line.includes(keyword))
    const matchesExcludeKeywords = Array.from(this.excludeKeywords).some(keyword => line.includes(keyword))
    const hasPriceSymbols = /[¥円\*X]/.test(line)
    
    let numberValue: number | undefined
    const numberMatch = line.match(/(\d+)/)
    if (numberMatch) {
      numberValue = parseInt(numberMatch[1])
    }
    
    return {
      hasNumbers,
      isOnlyNumbers,
      hasPriceSymbols,
      numberValue,
      hasJapanese,
      hasKatakana,
      hasHiragana,
      hasKanji,
      hasAlphabet,
      matchesPricePattern,
      matchesQuantityPattern,
      matchesCodePattern,
      matchesFoodKeywords,
      matchesExcludeKeywords,
      length: line.length,
      position: index,
      positionRatio: index / Math.max(totalLines - 1, 1),
      isFirstLine: index === 0,
      isLastLine: index === totalLines - 1,
      priceMatch,
      quantityMatch,
      codeMatch
    }
  }
  
  private classifyLineAccurately(line: string, features: LineFeatures, index: number, allLines: string[]): LineType {
    if (features.matchesExcludeKeywords) {
      return LineType.STORE_INFO
    }
    
    if (features.matchesPricePattern && features.hasPriceSymbols) {
      return LineType.PRICE_ONLY
    }
    
    if (features.matchesCodePattern && !features.hasJapanese) {
      return LineType.PRODUCT_CODE
    }
    
    if (features.matchesQuantityPattern) {
      return LineType.QUANTITY_INFO
    }
    
    if (features.matchesFoodKeywords && !features.isOnlyNumbers) {
      return LineType.ITEM_NAME
    }
    
    if (features.hasJapanese && features.length >= 3 && features.length <= 30 && !features.isOnlyNumbers) {
      return LineType.ITEM_NAME
    }
    
    if (features.isOnlyNumbers && features.numberValue !== undefined) {
      if (features.numberValue >= 10 && features.numberValue <= 99999) {
        return LineType.PRICE_ONLY
      }
    }
    
    if (/^[\-=*\s]+$/.test(line) || line.length < 2) {
      return LineType.SEPARATOR
    }
    
    return LineType.UNKNOWN
  }
  
  private calculateAccurateConfidence(line: string, features: LineFeatures, type: LineType): number {
    let confidence = 0.5
    
    switch (type) {
      case LineType.ITEM_NAME:
        if (features.matchesFoodKeywords) confidence += 0.4
        if (features.hasJapanese) confidence += 0.2
        if (features.length >= 3 && features.length <= 25) confidence += 0.1
        if (features.hasKanji || features.hasHiragana) confidence += 0.1
        break
        
      case LineType.PRICE_ONLY:
        if (features.matchesPricePattern) confidence += 0.4
        if (features.hasPriceSymbols) confidence += 0.2
        if (features.isOnlyNumbers && features.numberValue && features.numberValue >= 10) confidence += 0.2
        break
        
      case LineType.PRODUCT_CODE:
        if (features.matchesCodePattern) confidence += 0.3
        if (!features.hasJapanese && features.hasNumbers) confidence += 0.2
        break
        
      case LineType.QUANTITY_INFO:
        if (features.matchesQuantityPattern) confidence += 0.4
        break
    }
    
    if (features.matchesExcludeKeywords) confidence -= 0.5
    if (features.length > 50) confidence -= 0.2
    
    return Math.max(0, Math.min(1, confidence))
  }
  
  private detectReceiptFormat(analyses: LineAnalysis[]): string {
    // 形式A: 4桁コード + 軽の組み合わせ
    const formatA = analyses.some(a => 
      a.features.matchesCodePattern && 
      a.features.codeMatch && 
      a.features.codeMatch[0].match(/^\d{4}軽?$/)
    )
    if (formatA) return 'format_a'
    
    // 形式B: 5-7桁コード + 数量記号の組み合わせ
    const formatB = analyses.some(a => 
      (a.features.matchesCodePattern && a.features.codeMatch && a.features.codeMatch[1]?.length >= 5)
    ) && analyses.some(a => /^(\d+)[⚫°.]$/.test(a.content))
    if (formatB) return 'format_b'
    
    // 形式C: *で始まる商品行
    const formatC = analyses.some(a => 
      a.content.startsWith('*') && a.features.hasJapanese
    )
    if (formatC) return 'format_c'
    
    return 'generic'
  }
  
  private extractItemsByFormat(analyses: LineAnalysis[], format: string): ParsedItem[] {
    const items: ParsedItem[] = []
    const usedIndices = new Set<number>()
    
    switch (format) {
      case 'format_c':
        items.push(...this.extractFormatC(analyses, usedIndices))
        break
      case 'format_b':
        items.push(...this.extractFormatB(analyses, usedIndices))
        break
      case 'format_a':
        items.push(...this.extractFormatA(analyses, usedIndices))
        break
      default:
        items.push(...this.extractGenericFormat(analyses, usedIndices))
        break
    }
    
    return items
  }
  
  private extractFormatC(analyses: LineAnalysis[], usedIndices: Set<number>): ParsedItem[] {
    const items: ParsedItem[] = []
    
    for (let i = 0; i < analyses.length; i++) {
      if (usedIndices.has(i)) continue
      
      const line = analyses[i]
      
      // 行内パターン: *商品名 ¥価格
      const inlineMatch = line.content.match(/^\*(.+?)\s+¥(\d{1,5})$/)
      if (inlineMatch) {
        const name = inlineMatch[1].trim()
        const price = parseInt(inlineMatch[2])
        
        if (this.isValidItemName(name) && price >= 10 && price <= 99999) {
          items.push({
            name,
            price,
            quantity: 1,
            category: this.categorizeItem(name),
            confidence: 0.9,
            detectionMethod: 'format-c-inline',
            rawLines: [line.content],
            lineIndices: [i]
          })
          usedIndices.add(i)
        }
        continue
      }
      
      // 2行パターン: *商品名 → ¥価格
      if (line.content.startsWith('*') && i < analyses.length - 1) {
        const nextLine = analyses[i + 1]
        const nameMatch = line.content.match(/^\*(.+)$/)
        const priceMatch = nextLine.content.match(/^¥(\d{1,5})$/)
        
        if (nameMatch && priceMatch) {
          const name = nameMatch[1].trim()
          const price = parseInt(priceMatch[1])
          
          if (this.isValidItemName(name) && price >= 10 && price <= 99999) {
            items.push({
              name,
              price,
              quantity: 1,
              category: this.categorizeItem(name),
              confidence: 0.85,
              detectionMethod: 'format-c-two-line',
              rawLines: [line.content, nextLine.content],
              lineIndices: [i, i + 1]
            })
            usedIndices.add(i)
            usedIndices.add(i + 1)
            i++
          }
        }
      }
    }
    
    return items
  }
  
  private extractFormatB(analyses: LineAnalysis[], usedIndices: Set<number>): ParsedItem[] {
    const items: ParsedItem[] = []
    
    // 5行パターン: 商品名 → コード → 数量 → 単価 → 合計
    for (let i = 0; i < analyses.length - 4; i++) {
      if (usedIndices.has(i)) continue
      
      const itemLine = analyses[i]
      const codeLine = analyses[i + 1]
      const qtyLine = analyses[i + 2]
      const unitLine = analyses[i + 3]
      const totalLine = analyses[i + 4]
      
      const codeMatch = codeLine.content.match(/^(\d{5,7})$/)
      const qtyMatch = qtyLine.content.match(/^(\d+)[⚫°.]?$/)
      const unitMatch = unitLine.content.match(/^([0-9,]+)$/)
      const totalMatch = totalLine.content.match(/^([0-9,]+)\s*([TER])$/)
      
      if (codeMatch && qtyMatch && unitMatch && totalMatch &&
          itemLine.type === LineType.ITEM_NAME &&
          (itemLine.features.hasJapanese || itemLine.features.hasAlphabet)) {
        
        const name = itemLine.content.trim()
        const quantity = parseInt(qtyMatch[1])
        const price = parseInt(totalMatch[1].replace(/[,\.]/g, ''))
        
        if (this.isValidItemName(name) && price >= 10 && price <= 999999) {
          items.push({
            name,
            price,
            quantity,
            category: this.categorizeItem(name),
            confidence: 0.8,
            detectionMethod: 'format-b-five-line',
            rawLines: [itemLine.content, codeLine.content, qtyLine.content, unitLine.content, totalLine.content],
            lineIndices: [i, i + 1, i + 2, i + 3, i + 4]
          })
          
          for (let j = i; j < i + 5; j++) {
            usedIndices.add(j)
          }
          i += 4
        }
      }
    }
    
    return items
  }
  
  private extractFormatA(analyses: LineAnalysis[], usedIndices: Set<number>): ParsedItem[] {
    const items: ParsedItem[] = []
    
    // 3行パターン: コード → 商品名 → 価格
    for (let i = 0; i < analyses.length - 2; i++) {
      if (usedIndices.has(i)) continue
      
      const codeLine = analyses[i]
      const itemLine = analyses[i + 1]
      const priceLine = analyses[i + 2]
      
      const codeMatch = codeLine.content.match(/^(\d{4})軽?$/)
      const priceMatch = priceLine.content.match(/^¥(\d{1,5})$/)
      
      if (codeMatch && priceMatch && 
          itemLine.type === LineType.ITEM_NAME) {
        
        const name = itemLine.content.trim()
        const price = parseInt(priceMatch[1])
        
        if (this.isValidItemName(name) && price >= 10 && price <= 99999) {
          items.push({
            name,
            price,
            quantity: 1,
            category: this.categorizeItem(name),
            confidence: 0.8,
            detectionMethod: 'format-a-three-line',
            rawLines: [codeLine.content, itemLine.content, priceLine.content],
            lineIndices: [i, i + 1, i + 2]
          })
          
          usedIndices.add(i)
          usedIndices.add(i + 1)
          usedIndices.add(i + 2)
          i += 2
        }
      }
    }
    
    // 4行パターン: コード → 商品名 → 数量 → 価格
    for (let i = 0; i < analyses.length - 3; i++) {
      if (usedIndices.has(i)) continue
      
      const codeLine = analyses[i]
      const itemLine = analyses[i + 1]
      const qtyLine = analyses[i + 2]
      const priceLine = analyses[i + 3]
      
      const codeMatch = codeLine.content.match(/^(\d{4})軽?$/)
      const qtyMatch = qtyLine.content.match(/^(\d+)コ(?:X\d+)?(?:X単\d+)?$/)
      const priceMatch = priceLine.content.match(/^¥(\d{1,5})$/)
      
      if (codeMatch && qtyMatch && priceMatch && 
          itemLine.type === LineType.ITEM_NAME) {
        
        const name = itemLine.content.trim()
        const price = parseInt(priceMatch[1])
        const quantity = parseInt(qtyMatch[1])
        
        if (this.isValidItemName(name) && price >= 10 && price <= 99999) {
          items.push({
            name,
            price,
            quantity,
            category: this.categorizeItem(name),
            confidence: 0.85,
            detectionMethod: 'format-a-four-line',
            rawLines: [codeLine.content, itemLine.content, qtyLine.content, priceLine.content],
            lineIndices: [i, i + 1, i + 2, i + 3]
          })
          
          usedIndices.add(i)
          usedIndices.add(i + 1)
          usedIndices.add(i + 2)
          usedIndices.add(i + 3)
          i += 3
        }
      }
    }
    
    return items
  }
  
  private extractGenericFormat(analyses: LineAnalysis[], usedIndices: Set<number>): ParsedItem[] {
    const items: ParsedItem[] = []
    
    for (let i = 0; i < analyses.length - 1; i++) {
      if (usedIndices.has(i)) continue
      
      const currentLine = analyses[i]
      const nextLine = analyses[i + 1]
      
      if (currentLine.type === LineType.ITEM_NAME && 
          nextLine.type === LineType.PRICE_ONLY) {
        
        const name = currentLine.content.trim()
        const price = this.extractPriceFromLine(nextLine.content)
        
        if (price && this.isValidItemName(name) && price >= 10 && price <= 99999) {
          items.push({
            name,
            price,
            quantity: 1,
            category: this.categorizeItem(name),
            confidence: 0.7,
            detectionMethod: 'generic-name-price',
            rawLines: [currentLine.content, nextLine.content],
            lineIndices: [i, i + 1]
          })
          
          usedIndices.add(i)
          usedIndices.add(i + 1)
          i++
        }
      }
      
      if (i > 0 && !usedIndices.has(i - 1)) {
        const prevLine = analyses[i - 1]
        const asteriskMatch = currentLine.content.match(/^(\d{1,5})\*\s*$/)
        
        if (asteriskMatch && prevLine.type === LineType.ITEM_NAME) {
          const name = prevLine.content.trim()
          const price = parseInt(asteriskMatch[1])
          
          if (this.isValidItemName(name) && price >= 10 && price <= 99999) {
            items.push({
              name,
              price,
              quantity: 1,
              category: this.categorizeItem(name),
              confidence: 0.7,
              detectionMethod: 'generic-asterisk',
              rawLines: [prevLine.content, currentLine.content],
              lineIndices: [i - 1, i]
            })
            
            usedIndices.add(i - 1)
            usedIndices.add(i)
          }
        }
      }
    }
    
    return items
  }
  
  private extractPriceFromLine(line: string): number | null {
    let match = line.match(/^¥(\d{1,6})$/)
    if (match) return parseInt(match[1])
    
    match = line.match(/^(\d{1,6})円$/)
    if (match) return parseInt(match[1])
    
    match = line.match(/^(\d{1,6})\*$/)
    if (match) return parseInt(match[1])
    
    match = line.match(/^(\d{1,6})X$/)
    if (match) return parseInt(match[1])
    
    match = line.match(/^(\d{2,6})$/)
    if (match) {
      const price = parseInt(match[1])
      return (price >= 10 && price <= 99999) ? price : null
    }
    
    return null
  }
  
  private finalValidation(items: ParsedItem[], analyses: LineAnalysis[]): ParsedItem[] {
    let validated = items.filter(item => {
      if (!this.isValidItemName(item.name)) {
        return false
      }
      
      if (!item.price || item.price < 10 || item.price > 99999) {
        return false
      }
      
      if (Array.from(this.excludeKeywords).some(keyword => item.name.includes(keyword))) {
        return false
      }
      
      return true
    })
    
    const seen = new Set<string>()
    validated = validated.filter(item => {
      const key = `${item.name}-${item.price}`
      if (seen.has(key)) {
        return false
      }
      seen.add(key)
      return true
    })
    
    validated = validated.filter(item => item.confidence >= 0.5)
    
    return validated.sort((a, b) => b.confidence - a.confidence)
  }
  
  private isValidItemName(name: string): boolean {
    if (!name || name.length < 2 || name.length > 50) return false
    
    if (/^\d+$/.test(name)) return false
    
    if (/^[%\-*X\s¥円]+$/.test(name)) return false
    
    if (/^(\d+)コ[X単\d]*$/.test(name)) return false
    
    if (name.includes('¥') || name.includes('円') || name === '1コ' || name === '2コX98' || name === '2コX単88') {
      return false
    }
    
    return true
  }
  
  private categorizeItem(itemName: string): string {
    for (const [category, keywords] of this.categories.entries()) {
      if (keywords.some(keyword => itemName.includes(keyword))) {
        return category
      }
    }
    return 'その他'
  }
}

export function parseReceiptTextUniversal(text: string): Array<{
  name: string
  price?: number
  quantity?: number
  category?: string
}> {
  const parser = new UniversalReceiptParser()
  const results = parser.parse(text)
  
  return results.map(item => ({
    name: item.name,
    price: item.price,
    quantity: item.quantity,
    category: item.category
  }))
}

export function generateAnalyticsReport(text: string): {
  items: ParsedItem[]
  analytics: {
    totalLines: number
    processedLines: number
    validItems: number
    confidenceDistribution: { [range: string]: number }
    detectionMethods: { [method: string]: number }
    formatDetected: string
  }
} {
  const parser = new UniversalReceiptParser()
  const lines = text.split('\n').filter(line => line.trim()).map(line => line.trim())
  const lineAnalyses = parser['analyzeAllLines'](lines)
  const formatDetected = parser['detectReceiptFormat'](lineAnalyses)
  const items = parser.parse(text)
  
  const validItems = items.length
  
  const confidenceDistribution: { [range: string]: number } = {
    'high (0.8-1.0)': 0,
    'medium (0.6-0.8)': 0,
    'low (0.5-0.6)': 0
  }
  
  items.forEach(item => {
    if (item.confidence >= 0.8) confidenceDistribution['high (0.8-1.0)']++
    else if (item.confidence >= 0.6) confidenceDistribution['medium (0.6-0.8)']++
    else confidenceDistribution['low (0.5-0.6)']++
  })
  
  const detectionMethods: { [method: string]: number } = {}
  items.forEach(item => {
    detectionMethods[item.detectionMethod] = (detectionMethods[item.detectionMethod] || 0) + 1
  })
  
  return {
    items,
    analytics: {
      totalLines: lines.length,
      processedLines: lines.length,
      validItems,
      confidenceDistribution,
      detectionMethods,
      formatDetected
    }
  }
}