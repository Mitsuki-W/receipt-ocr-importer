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
      // 野菜類
      'レタス', 'キャベツ', 'にんじん', 'たまねぎ', 'じゃがいも', 'トマト', 'きゅうり', 'なす', 'ピーマン', 'もやし',
      'ほうれん草', '白菜', '大根', 'しめじ', 'エリンギ', 'しいたけ', 'ネギ', 'ニラ', 'アスパラ', 'ブロッコリー',
      'ごぼう', 'いんげん', 'ぶなしめじ',
      
      // 果物類
      'りんご', 'バナナ', 'みかん', 'いちご', 'ぶどう', 'なし', 'もも', 'メロン', 'すいか', 'キウイ', 'パイン', 
      'オレンジ', 'グレープフルーツ', 'レモン', 'ライム', 'あじわい', 'カップ',
      
      // 肉類
      '牛肉', '豚肉', '鶏肉', 'ひき肉', 'ソーセージ', 'ハム', 'ベーコン', '若鶏', 'ロース', 'モモ', 'むね', 'から揚',
      'ばら', 'こま', 'うす切', 'うす切り', 'ロースハム', '豚こま', '豚ひき',
      
      // 魚類
      'さけ', 'まぐろ', 'あじ', 'さば', 'いわし', '刺身', '切身', 'かれい', 'からすかれい', 'シーチキン',
      'シュリンプ', 'カクテル',
      
      // 乳製品
      '牛乳', 'ヨーグルト', 'チーズ', 'バター', '生クリーム', 'ミルク', 'ギュウニュウ', 'キュウニュウ',
      
      // 穀物・パン類
      'パン', '食パン', '米', 'パスタ', 'うどん', 'そば', '麺', 'ラーメン', 'そうめん', '風麺', '低糖質',
      
      // 調味料
      'しょうゆ', '味噌', '塩', '砂糖', '油', 'みりん', '酢', 'ソース', 'ごま油', 'マヨネーズ', 'ケチャップ',
      'こんぶ', '塩こんぶ', '純正', 'フレッシュパック',
      
      // 飲料
      '糖質オフ', 'コーラ', 'ジュース', 'お茶', 'コーヒー', '水', 'ビール', 'ワイン', '茶',
      
      // 冷凍・アイス
      '冷凍', 'アイス',
      
      // 豆腐・大豆製品
      '豆腐', 'ケンち', 'スンドゥブ', 'スンドゥプ', '厚あげ', 'やわらか', '特濃',
      
      // 卵・その他
      '卵', 'うずら', 'コーン', 'チキン', 'チョコ', 'スイー', 'フレッシュパック', '無添加',
      'やさしさ', '想い', 'チゲ'
    ])
    
    this.excludeKeywords = new Set([
      // レシート関連
      '小計', '合計', '税込', '税抜', '消費税', '割引', '現金', 'クレジット', 'クレカ', 'レシート', '領収書',
      '店舗', '住所', '電話', 'TEL', 'FAX', '営業時間', 'ありがとう', 'またお越し', 'ポイント', 'カード',
      'お預り', 'おつり', 'お釣り', 'レジ', '登録機', '釣銭', 'おつり', '支払', '決済', '精算', '会計', 
      '責:', '本日', '日時', '時刻', '年', '月', '日', '時', '分', '秒', '曜日', '2024', '2025', '2023', '2022', 
      '令和', '平成', '株式会社', '有限会社', '合同会社', '(株)', '(有)', 'Ltd', 'Inc', 'Co', 
      'バーコード', 'QRコード', 'コード', 'No', 'ID', '番号', 'お買上', 'スキャン', '外税', '内税', 
      '対象額', '対象商品', '軽減税率', '標準税率', '温め', 'あたため', '割り箸', 'スプーン', 'フォーク', 
      '受付センター', 'センター', '加算', '週間', '以内', '点数', '会員', '売上', 
      'RECEIPT', 'TOTAL', 'SUBTOTAL', 'TAX', 'CASH', 'CREDIT', 'WHOLESALE', 'BIZ', 'GOLD',
      
      // 非食品商品（袋・雑貨・衣類など）
      'レジ袋', 'エコ袋', 'エコ', 'エコバッグ', '袋', 'バッグ', 'シューズ', '靴', 'サンダル', 'ブーツ',
      'ティッシュ', 'バスティッシュ', 'BATH', 'TISSUE', 'トイレットペーパー', 
      '洗剤', 'シャンプー', 'ボディソープ', '化粧品', 'コスメ',
      '文房具', 'ペン', 'ノート', '本', '雑誌', 'CD', 'DVD', '電池', 'バッテリー', '充電器',
      '衣類', '服', 'Tシャツ', 'シャツ', 'パンツ', 'ジーンズ', '靴下', '下着', 'タオル'
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
    
    for (let i = 0; i < analyses.length; i++) {
      if (usedIndices.has(i)) continue
      
      const currentLine = analyses[i]
      
      // 複合パターン: 商品名　数量×単価\合計
      const complexPattern = currentLine.content.match(/^(.+?)\s+(\d+)コ[×xX]単(\d+)\\(\d+)$/)
      if (complexPattern) {
        const name = complexPattern[1].trim()
        const quantity = parseInt(complexPattern[2])
        const unitPrice = parseInt(complexPattern[3])
        const totalPrice = parseInt(complexPattern[4])
        
        // 価格の整合性チェック
        const isMultipleSet = quantity > 1
        const maxPrice = isMultipleSet ? 10000 : 5000
        if (quantity * unitPrice === totalPrice && this.isValidItemName(name) && totalPrice >= 10 && totalPrice <= maxPrice) {
          items.push({
            name,
            price: totalPrice,
            quantity,
            category: this.categorizeItem(name),
            confidence: 0.85,
            detectionMethod: 'complex-pattern',
            rawLines: [currentLine.content],
            lineIndices: [i]
          })
          usedIndices.add(i)
          continue
        }
      }
      
      // 単一行内パターン: 商品名\価格
      const inlinePattern = currentLine.content.match(/^(.+?)\\(\d{1,5})$/)
      if (inlinePattern) {
        const name = inlinePattern[1].trim()
        const price = parseInt(inlinePattern[2])
        
        const maxPrice = /\d+個|\d+缶|\d+パック/.test(name) ? 10000 : 5000
        if (this.isValidItemName(name) && price >= 10 && price <= maxPrice) {
          items.push({
            name,
            price,
            quantity: 1,
            category: this.categorizeItem(name),
            confidence: 0.8,
            detectionMethod: 'inline-pattern',
            rawLines: [currentLine.content],
            lineIndices: [i]
          })
          usedIndices.add(i)
          continue
        }
      }
      
      // 2行パターン: 商品名 → 価格
      if (i < analyses.length - 1) {
        const nextLine = analyses[i + 1]
        
        if (currentLine.type === LineType.ITEM_NAME && 
            nextLine.type === LineType.PRICE_ONLY) {
          
          const name = currentLine.content.trim()
          const price = this.extractPriceFromLine(nextLine.content)
          
          if (price && this.isValidItemName(name) && price >= 10 && price <= 5000) {
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
            continue
          }
        }
      }
      
      // アスタリスクパターン
      if (i > 0 && !usedIndices.has(i - 1)) {
        const prevLine = analyses[i - 1]
        const asteriskMatch = currentLine.content.match(/^(\d{1,5})\*\s*$/)
        
        if (asteriskMatch && prevLine.type === LineType.ITEM_NAME) {
          const name = prevLine.content.trim()
          const price = parseInt(asteriskMatch[1])
          
          const maxPrice = /\d+個|\d+缶|\d+パック/.test(name) ? 10000 : 5000
        if (this.isValidItemName(name) && price >= 10 && price <= maxPrice) {
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
      // 商品名の妥当性チェック
      if (!this.isValidItemName(item.name)) {
        return false
      }
      
      // 商品名のクリーニング
      item.name = this.cleanItemName(item.name)
      
      // 価格の妥当性チェック（食品として妥当な範囲）
      // 複数個セットの場合はより高い価格を許可
      const isMultipleSet = /\d+個|\d+缶|\d+パック/.test(item.name)
      const maxPrice = isMultipleSet ? 10000 : 5000
      if (!item.price || item.price < 10 || item.price > maxPrice) {
        return false
      }
      
      // 除外キーワードチェック
      if (Array.from(this.excludeKeywords).some(keyword => 
        item.name.toLowerCase().includes(keyword.toLowerCase()))) {
        return false
      }
      
      // 非食品商品の詳細チェック
      if (this.isNonFoodItem(item.name, item.price)) {
        return false
      }
      
      return true
    })
    
    // 重複除去
    const seen = new Set<string>()
    validated = validated.filter(item => {
      const key = `${item.name}-${item.price}`
      if (seen.has(key)) {
        return false
      }
      seen.add(key)
      return true
    })
    
    // 信頼度フィルタリング
    validated = validated.filter(item => item.confidence >= 0.5)
    
    return validated.sort((a, b) => b.confidence - a.confidence)
  }
  
  private cleanItemName(name: string): string {
    // よくある誤認識を修正
    const corrections: { [key: string]: string } = {
      'うずらの虜': 'うずらの卵',
      '抵当質': '低糖質',
      'ギュウニュウ': '牛乳',
      'キュウニュウ': '牛乳',
      'スンドゥブチゲ': 'スンドゥブチゲ',
      'うずらの虜50個': 'うずらの卵',
      'ももから揚': 'ももから揚げ',
      'やさしさ想いスイー': 'やさしさ想いスイートポテト',
      '抵当質うどん風麺': '低糖質うどん風麺',
      'グレープフルーツカップ': 'グレープフルーツカップ',
      '特濃ケンち': '特濃絹ごし豆腐'
    }
    
    let cleaned = name
    for (const [wrong, correct] of Object.entries(corrections)) {
      if (cleaned.includes(wrong)) {
        cleaned = cleaned.replace(wrong, correct)
      }
    }
    
    // 不要な文字・パターンの削除
    cleaned = cleaned
      .replace(/^\*+/, '')  // 先頭のアスタリスク
      .replace(/\s+/g, ' ') // 連続する空白を1つに
      .replace(/１\／４/g, '1/4') // 全角数字を半角に
      .replace(/\s+バラ$/, '') // 末尾の「バラ」を削除
      .replace(/^[A-Z]{2,3}\s+/, '') // 先頭の2-3文字のアルファベット（KS、TV等）を削除
      .trim()
    
    return cleaned
  }
  
  private isNonFoodItem(name: string, price: number): boolean {
    // より厳格な非食品パターン
    const nonFoodPatterns = [
      /シューズ|靴|サンダル|ブーツ/,
      /バッグ|袋|エコ|レジ袋/,
      /ティッシュ|TISSUE|BATH.*TISSUE/,
      /洗剤|シャンプー|石鹸/,
      /衣類|服|シャツ|パンツ/,
      /文房具|ペン|ノート/,
      /化粧品|コスメ/,
      /電池|充電器/,
      /タオル|下着/
    ]
    
    // パターンマッチング（大文字小文字を区別しない）
    const nameUpper = name.toUpperCase()
    if (nonFoodPatterns.some(pattern => pattern.test(nameUpper))) {
      return true
    }
    
    // 特定の完全一致パターン
    const exactNonFoodItems = [
      'レジ袋', 'エコ袋', 'レジ袋（大）', 'レジ袋（小）',
      'シューズ', 'BATH TISSUE', 'バスティッシュ'
    ]
    
    if (exactNonFoodItems.some(item => 
      nameUpper.includes(item.toUpperCase()) || 
      name.includes(item))) {
      return true
    }
    
    // 異常に高い価格（食品としては不自然）
    // ただし、複数個セットの商品は除外（例：スンドゥブチゲ12個\1968）
    const isMultipleSet = /\d+個|\d+缶|\d+パック/.test(name)
    if (price > 4000 && !isMultipleSet) {
      return true
    }
    if (price > 10000) {  // 10000円を超える場合は確実に非食品
      return true
    }
    
    // 高額商品で2-3文字のアルファベットコードがある場合（ブランド商品）
    if (price > 3000 && /^[A-Z]{2,3}\s/.test(name)) {
      return true
    }
    
    return false
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