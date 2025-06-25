// lib/intelligentReceiptParser.ts

export interface ParsedItem {
  name: string
  price?: number
  quantity?: number
  category?: string
  confidence: number
  detectionMethod: string
  rawMatch?: string
}

export interface LineAnalysis {
  index: number
  content: string
  type: LineType
  confidence: number
  features: LineFeatures
}

export enum LineType {
  ITEM = 'item',
  PRICE = 'price',
  QUANTITY = 'quantity',
  METADATA = 'metadata',  // 店舗情報、日付等
  SEPARATOR = 'separator', // 区切り線
  TOTAL = 'total',        // 合計行
  UNKNOWN = 'unknown'
}

export interface LineFeatures {
  hasPrice: boolean
  hasQuantity: boolean
  hasJapanese: boolean
  hasAlphabet: boolean
  hasNumbers: boolean
  hasSymbols: boolean
  length: number
  pricePattern?: RegExpMatchArray
  quantityPattern?: RegExpMatchArray
  isAllCaps: boolean
  isAllNumbers: boolean
  containsCommonWords: boolean
  positionRatio: number // 0-1, position in document
}

export class IntelligentReceiptParser {
  private foodKeywords!: Set<string>
  private excludeKeywords!: Set<string>
  private pricePatterns!: RegExp[]
  private quantityPatterns!: RegExp[]
  private totalPatterns!: RegExp[]
  private categories!: Map<string, string[]>
  
  constructor() {
    this.initializeKeywords()
    this.initializePatterns()
    this.initializeCategories()
  }
  
  private initializeKeywords() {
    // 食品関連キーワード（機械学習で拡張可能）
    this.foodKeywords = new Set([
      // 野菜
      'レタス', 'キャベツ', 'にんじん', 'たまねぎ', 'じゃがいも', 'トマト', 'きゅうり', 'なす', 'ピーマン', 'もやし',
      'ほうれん草', '白菜', '大根', 'しめじ', 'エリンギ', 'しいたけ', 'ネギ', 'ニラ', 'アスパラ', 'ブロッコリー',
      // 果物
      'りんご', 'バナナ', 'みかん', 'いちご', 'ぶどう', 'なし', 'もも', 'メロン', 'すいか', 'キウイ', 'パイン',
      'オレンジ', 'グレープフルーツ', 'レモン', 'ライム', 'あじわい', 'カップ',
      // 肉類
      '牛肉', '豚肉', '鶏肉', 'ひき肉', 'ソーセージ', 'ハム', 'ベーコン', '若鶏', 'ロース', 'モモ', 'むね',
      'から揚', 'シーチキン', 'PROSCIUTTO', 'CRUDO',
      // 魚類
      'さけ', 'まぐろ', 'あじ', 'さば', 'いわし', '刺身', '切身', 'かれい', 'シュリンプ', 'カクテル',
      // 乳製品
      '牛乳', 'ヨーグルト', 'チーズ', 'バター', '生クリーム', 'ミルク', 'ユタ', 'ギュウニュウ',
      // 穀物・パン
      'パン', '食パン', '米', 'パスタ', 'うどん', 'そば', '麺', 'ラーメン', 'そうめん',
      // 調味料
      'しょうゆ', '味噌', '塩', '砂糖', '油', 'みりん', '酢', 'ソース', 'ごま油', 'マヨネーズ', 'ケチャップ',
      // 飲料
      '金麦', '糖質オフ', 'コーラ', 'ジュース', 'お茶', 'コーヒー', '水', 'ビール', 'ワイン', '茶',
      // 冷凍・加工食品
      '冷凍', 'アイス', '豆腐', 'ケンち', 'スンドゥブ', '卵', 'うずら',
      // 一般的な食品用語
      '国産', '北海道', '有機', 'オーガニック', '無添加', '減塩', '低糖質', 'カロリー', '栄養',
      // 単位・修飾語
      'パック', 'セット', 'キロ', 'グラム', '個', 'コ', '本', '枚', '袋', '箱'
    ])
    
    this.excludeKeywords = new Set([
      // 店舗・システム関連
      '小計', '合計', '税込', '税抜', '消費税', '割引', '現金', 'クレジット', 'クレカ',
      'レシート', '領収書', '店舗', '住所', '電話', 'TEL', 'FAX', '営業時間',
      'ありがとう', 'またお越し', 'ポイント', 'カード', 'お預り', 'おつり', 'お釣り',
      'WAON', 'nanaco', 'Suica', 'PASMO', 'PayPay', 'LINE Pay',
      // 日付・時刻
      '本日', '日時', '時刻', '年', '月', '日', '時', '分', '秒', '曜日',
      '2024', '2025', '2023', '2022', '令和', '平成',
      // 企業・法人
      '株式会社', '有限会社', '合同会社', '(株)', '(有)', 'Ltd', 'Inc', 'Co',
      // システム・技術
      'バーコード', 'QRコード', 'コード', 'No', 'ID', '番号', 'お買上', 'スキャン',
      '外税', '内税', '対象額', '対象商品', '軽減税率', '標準税率',
      // レジ・会計
      'レジ', '登録機', '釣銭', 'おつり', '支払', '決済', '精算', '会計',
      '責任者', '担当', '店員', 'スタッフ',
      // その他
      '温め', 'あたため', 'レジ袋', '袋', 'エコ', '割り箸', 'スプーン', 'フォーク',
      'ストロー', 'おしぼり', 'ナプキン'
    ])
  }
  
  private initializePatterns() {
    // 価格パターン（優先度順）
    this.pricePatterns = [
      /¥(\d{1,6})/,                    // ¥123
      /(\d{1,6})円/,                   // 123円
      /(\d{1,3}(?:,\d{3})*)円?/,       // 1,234 or 1,234円
      /(\d{1,6})\*/,                   // 123*
      /(\d{1,6})X/,                    // 123X
      /(\d{1,6})-$/,                   // 123-
      /^(\d{2,6})$/                    // 行全体が数字（2桁以上）
    ]
    
    // 数量パターン
    this.quantityPatterns = [
      /(\d+)コ/,                       // 2コ
      /(\d+)個/,                       // 2個
      /(\d+)本/,                       // 2本
      /(\d+)枚/,                       // 2枚
      /(\d+)袋/,                       // 2袋
      /(\d+)パック/,                   // 2パック
      /(\d+)セット/,                   // 2セット
      /(\d+)コX/,                      // 2コX
      /(\d+)コX単(\d+)/,               // 2コX単98
      /(\d+)[⚫°.]/,                   // Costcoスタイル
      /x(\d+)/i                        // x2
    ]
    
    // 合計・小計パターン
    this.totalPatterns = [
      /小計|合計|総計|TOTAL|SUBTOTAL/i,
      /税込|税抜|TAX/i,
      /お預り|おつり|お釣り/i,
      /現金|クレジット|CREDIT|CASH/i
    ]
  }
  
  private initializeCategories() {
    this.categories = new Map([
      ['野菜', ['レタス', 'キャベツ', 'にんじん', 'たまねぎ', 'じゃがいも', 'トマト', 'きゅうり', 'なす', 'ピーマン', 'もやし', 'ほうれん草', '白菜', '大根', 'しめじ', 'エリンギ', 'しいたけ', 'ネギ', 'ニラ', 'アスパラ', 'ブロッコリー']],
      ['果物', ['りんご', 'バナナ', 'みかん', 'いちご', 'ぶどう', 'なし', 'もも', 'メロン', 'すいか', 'キウイ', 'パイン', 'オレンジ', 'グレープフルーツ', 'レモン', 'ライム', 'あじわい', 'カップ']],
      ['肉類', ['牛肉', '豚肉', '鶏肉', 'ひき肉', 'ソーセージ', 'ハム', 'ベーコン', '若鶏', 'ロース', 'モモ', 'むね', 'から揚', 'シーチキン', 'PROSCIUTTO', 'CRUDO']],
      ['魚類', ['さけ', 'まぐろ', 'あじ', 'さば', 'いわし', '刺身', '切身', 'かれい', 'シュリンプ', 'カクテル']],
      ['乳製品', ['牛乳', 'ヨーグルト', 'チーズ', 'バター', '生クリーム', 'ミルク', 'ユタ', 'ギュウニュウ']],
      ['パン・穀物', ['パン', '食パン', '米', 'パスタ', 'うどん', 'そば', '麺', 'ラーメン', 'そうめん']],
      ['調味料', ['しょうゆ', '味噌', '塩', '砂糖', '油', 'みりん', '酢', 'ソース', 'ごま油', 'マヨネーズ', 'ケチャップ']],
      ['飲料', ['金麦', '糖質オフ', 'コーラ', 'ジュース', 'お茶', 'コーヒー', '水', 'ビール', 'ワイン', '茶']],
      ['冷凍食品', ['冷凍', 'アイス']],
      ['豆腐・大豆製品', ['豆腐', 'ケンち', 'スンドゥブ']],
      ['その他食品', ['卵', 'うずら']]
    ])
  }
  
  parse(text: string): ParsedItem[] {
    console.log('=== インテリジェント レシートパーサー開始 ===')
    
    const lines = text.split('\n').filter(line => line.trim())
    console.log(`総行数: ${lines.length}`)
    
    // Step 1: 各行の特徴分析
    const lineAnalyses = this.analyzeLines(lines)
    
    // Step 2: パターン認識とスコアリング
    const candidates = this.findItemCandidates(lineAnalyses)
    
    // Step 3: 文脈分析とフィルタリング
    const contextFiltered = this.contextualFiltering(candidates, lineAnalyses)
    
    // Step 4: 重複除去と最終検証
    const finalItems = this.finalValidation(contextFiltered)
    
    console.log(`最終検出アイテム数: ${finalItems.length}`)
    
    return finalItems
  }
  
  private analyzeLines(lines: string[]): LineAnalysis[] {
    return lines.map((line, index) => {
      const features = this.extractFeatures(line, index, lines.length)
      const type = this.classifyLine(line, features)
      const confidence = this.calculateLineConfidence(line, features, type)
      
      return {
        index,
        content: line.trim(),
        type,
        confidence,
        features
      }
    })
  }
  
  private extractFeatures(line: string, index: number, totalLines: number): LineFeatures {
    const trimmed = line.trim()
    
    // 価格パターンマッチング
    let pricePattern: RegExpMatchArray | undefined
    for (const pattern of this.pricePatterns) {
      const match = trimmed.match(pattern)
      if (match) {
        pricePattern = match
        break
      }
    }
    
    // 数量パターンマッチング
    let quantityPattern: RegExpMatchArray | undefined
    for (const pattern of this.quantityPatterns) {
      const match = trimmed.match(pattern)
      if (match) {
        quantityPattern = match
        break
      }
    }
    
    return {
      hasPrice: !!pricePattern,
      hasQuantity: !!quantityPattern,
      hasJapanese: /[あ-んア-ンぁ-ゖ]/.test(trimmed),
      hasAlphabet: /[a-zA-Z]/.test(trimmed),
      hasNumbers: /\d/.test(trimmed),
      hasSymbols: /[¥*X\-+]/.test(trimmed),
      length: trimmed.length,
      pricePattern,
      quantityPattern,
      isAllCaps: trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed),
      isAllNumbers: /^\d+$/.test(trimmed),
      containsCommonWords: this.containsFoodKeywords(trimmed),
      positionRatio: index / Math.max(totalLines - 1, 1)
    }
  }
  
  private containsFoodKeywords(text: string): boolean {
    for (const keyword of this.foodKeywords) {
      if (text.includes(keyword)) {
        return true
      }
    }
    return false
  }
  
  private classifyLine(line: string, features: LineFeatures): LineType {
    // 合計行の判定
    if (this.totalPatterns.some(pattern => pattern.test(line))) {
      return LineType.TOTAL
    }
    
    // 除外キーワードがある場合
    if (Array.from(this.excludeKeywords).some(keyword => line.includes(keyword))) {
      return LineType.METADATA
    }
    
    // 価格のみの行
    if (features.isAllNumbers && parseInt(line) > 10 && parseInt(line) < 100000) {
      return LineType.PRICE
    }
    
    // 商品アイテムの可能性が高い
    if (features.containsCommonWords || 
        (features.hasJapanese && features.length > 2 && features.length < 50)) {
      return LineType.ITEM
    }
    
    // 数量情報
    if (features.hasQuantity) {
      return LineType.QUANTITY
    }
    
    // 区切り線や記号のみ
    if (/^[\-=*\s]+$/.test(line) || line.length < 2) {
      return LineType.SEPARATOR
    }
    
    return LineType.UNKNOWN
  }
  
  private calculateLineConfidence(line: string, features: LineFeatures, type: LineType): number {
    let confidence = 0.5 // ベーススコア
    
    // 食品キーワードの重み
    if (features.containsCommonWords) confidence += 0.3
    
    // 長さの適切性
    if (features.length >= 3 && features.length <= 30) confidence += 0.1
    else if (features.length > 50) confidence -= 0.2
    
    // 日本語の存在
    if (features.hasJapanese) confidence += 0.1
    
    // 価格パターンの存在
    if (features.hasPrice) confidence += 0.2
    
    // 除外キーワードのペナルティ
    if (Array.from(this.excludeKeywords).some(keyword => line.includes(keyword))) {
      confidence -= 0.4
    }
    
    // 位置による重み（レシート中央部は商品の可能性が高い）
    if (features.positionRatio > 0.2 && features.positionRatio < 0.8) {
      confidence += 0.1
    }
    
    // すべて大文字の英語（ブランド名等）
    if (features.isAllCaps && features.hasAlphabet) {
      confidence += 0.05
    }
    
    return Math.max(0, Math.min(1, confidence))
  }
  
  private findItemCandidates(lineAnalyses: LineAnalysis[]): ParsedItem[] {
    const candidates: ParsedItem[] = []
    
    for (let i = 0; i < lineAnalyses.length; i++) {
      const currentLine = lineAnalyses[i]
      
      // 単行アイテム検出
      const singleLineItem = this.detectSingleLineItem(currentLine)
      if (singleLineItem) {
        candidates.push(singleLineItem)
        continue
      }
      
      // 複数行アイテム検出
      const multiLineItem = this.detectMultiLineItem(lineAnalyses, i)
      if (multiLineItem) {
        candidates.push(multiLineItem)
        // 使用した行をスキップ
        i += (multiLineItem.detectionMethod.includes('2-line') ? 1 : 
              multiLineItem.detectionMethod.includes('3-line') ? 2 : 0)
        continue
      }
      
      // パターンベース検出
      const patternItem = this.detectPatternBasedItem(lineAnalyses, i)
      if (patternItem) {
        candidates.push(patternItem)
      }
    }
    
    return candidates
  }
  
  private detectSingleLineItem(line: LineAnalysis): ParsedItem | null {
    if (line.type !== LineType.ITEM && line.confidence < 0.4) return null
    
    const content = line.content
    
    // 行内価格パターン：商品名 価格
    const inlineMatch = content.match(/^(.+?)\s+(\d{2,6})(?:円|\*|X)?$/)
    if (inlineMatch) {
      const name = inlineMatch[1].trim()
      const price = parseInt(inlineMatch[2])
      
      if (this.isValidItem(name, price)) {
        return {
          name,
          price,
          quantity: 1,
          category: this.categorizeItem(name),
          confidence: 0.8,
          detectionMethod: 'single-line-inline',
          rawMatch: content
        }
      }
    }
    
    // ライフスタイル：*商品名 ¥価格
    const lifeMatch = content.match(/^\*(.+?)\s+¥(\d{1,5})$/)
    if (lifeMatch) {
      const name = lifeMatch[1].trim()
      const price = parseInt(lifeMatch[2])
      
      if (this.isValidItem(name, price)) {
        return {
          name,
          price,
          quantity: 1,
          category: this.categorizeItem(name),
          confidence: 0.9,
          detectionMethod: 'single-line-life',
          rawMatch: content
        }
      }
    }
    
    return null
  }
  
  private detectMultiLineItem(lineAnalyses: LineAnalysis[], startIndex: number): ParsedItem | null {
    if (startIndex >= lineAnalyses.length - 1) return null
    
    const currentLine = lineAnalyses[startIndex]
    const nextLine = lineAnalyses[startIndex + 1]
    const thirdLine = startIndex + 2 < lineAnalyses.length ? lineAnalyses[startIndex + 2] : null
    
    // 2行パターン：商品名 → 価格
    if (currentLine.type === LineType.ITEM && nextLine.features.hasPrice) {
      const price = this.extractPrice(nextLine.content)
      if (price && this.isValidItem(currentLine.content, price)) {
        return {
          name: currentLine.content,
          price,
          quantity: 1,
          category: this.categorizeItem(currentLine.content),
          confidence: 0.7,
          detectionMethod: '2-line-name-price',
          rawMatch: `${currentLine.content} | ${nextLine.content}`
        }
      }
    }
    
    // 3行パターン：商品名 → 数量 → 価格
    if (thirdLine && currentLine.type === LineType.ITEM && 
        nextLine.features.hasQuantity && thirdLine.features.hasPrice) {
      
      const quantity = this.extractQuantity(nextLine.content)
      const price = this.extractPrice(thirdLine.content)
      
      if (price && this.isValidItem(currentLine.content, price)) {
        return {
          name: currentLine.content,
          price,
          quantity: quantity || 1,
          category: this.categorizeItem(currentLine.content),
          confidence: 0.8,
          detectionMethod: '3-line-name-qty-price',
          rawMatch: `${currentLine.content} | ${nextLine.content} | ${thirdLine.content}`
        }
      }
    }
    
    // 逆順パターン：価格 → 商品名
    if (currentLine.features.hasPrice && nextLine.type === LineType.ITEM) {
      const price = this.extractPrice(currentLine.content)
      if (price && this.isValidItem(nextLine.content, price)) {
        return {
          name: nextLine.content,
          price,
          quantity: 1,
          category: this.categorizeItem(nextLine.content),
          confidence: 0.6,
          detectionMethod: '2-line-price-name',
          rawMatch: `${currentLine.content} | ${nextLine.content}`
        }
      }
    }
    
    return null
  }
  
  private detectPatternBasedItem(lineAnalyses: LineAnalysis[], startIndex: number): ParsedItem | null {
    if (startIndex === 0) return null
    
    const currentLine = lineAnalyses[startIndex]
    const prevLine = lineAnalyses[startIndex - 1]
    
    // *価格パターン：前の行が商品名、現在行が価格*
    const asteriskMatch = currentLine.content.match(/^(\d{1,5})\*\s*$/)
    if (asteriskMatch && prevLine.type === LineType.ITEM) {
      const price = parseInt(asteriskMatch[1])
      if (this.isValidItem(prevLine.content, price)) {
        return {
          name: prevLine.content,
          price,
          quantity: 1,
          category: this.categorizeItem(prevLine.content),
          confidence: 0.7,
          detectionMethod: 'pattern-asterisk',
          rawMatch: `${prevLine.content} | ${currentLine.content}`
        }
      }
    }
    
    // X価格パターン
    const xMatch = currentLine.content.match(/^(\d{1,5})X\s*$/)
    if (xMatch && prevLine.type === LineType.ITEM) {
      const price = parseInt(xMatch[1])
      if (this.isValidItem(prevLine.content, price)) {
        return {
          name: prevLine.content,
          price,
          quantity: 1,
          category: this.categorizeItem(prevLine.content),
          confidence: 0.7,
          detectionMethod: 'pattern-x',
          rawMatch: `${prevLine.content} | ${currentLine.content}`
        }
      }
    }
    
    return null
  }
  
  private extractPrice(text: string): number | null {
    for (const pattern of this.pricePatterns) {
      const match = text.match(pattern)
      if (match) {
        const priceStr = match[1].replace(/[,\.]/g, '')
        const price = parseInt(priceStr)
        if (price >= 1 && price <= 999999) {
          return price
        }
      }
    }
    return null
  }
  
  private extractQuantity(text: string): number | null {
    for (const pattern of this.quantityPatterns) {
      const match = text.match(pattern)
      if (match) {
        return parseInt(match[1])
      }
    }
    return null
  }
  
  private contextualFiltering(candidates: ParsedItem[], lineAnalyses: LineAnalysis[]): ParsedItem[] {
    // 信頼度による初期フィルタリング
    let filtered = candidates.filter(item => item.confidence >= 0.4)
    
    // 価格妥当性チェック
    filtered = this.validatePrices(filtered)
    
    // 商品名の妥当性チェック
    filtered = this.validateItemNames(filtered)
    
    // 文脈的妥当性チェック
    filtered = this.validateContext(filtered, lineAnalyses)
    
    return filtered
  }
  
  private validatePrices(items: ParsedItem[]): ParsedItem[] {
    if (items.length === 0) return items
    
    // 価格の統計分析
    const prices = items.map(item => item.price!).filter(price => price)
    const avgPrice = prices.reduce((sum, price) => sum + price, 0) / prices.length
    const maxReasonablePrice = avgPrice * 20 // 平均の20倍まで
    
    return items.filter(item => {
      if (!item.price) return true
      
      // 異常に高い価格を除外
      if (item.price > maxReasonablePrice && item.price > 50000) {
        console.log(`除外（価格異常）: ${item.name} - ¥${item.price}`)
        return false
      }
      
      // 異常に低い価格を除外（ただし信頼度が高い場合は保持）
      if (item.price < 5 && item.confidence < 0.8) {
        console.log(`除外（価格低すぎ）: ${item.name} - ¥${item.price}`)
        return false
      }
      
      return true
    })
  }
  
  private validateItemNames(items: ParsedItem[]): ParsedItem[] {
    return items.filter(item => {
      const name = item.name
      
      // 長さチェック
      if (name.length < 2 || name.length > 50) {
        console.log(`除外（長さ異常）: ${name}`)
        return false
      }
      
      // 除外キーワードチェック
      if (Array.from(this.excludeKeywords).some(keyword => name.includes(keyword))) {
        console.log(`除外（キーワード）: ${name}`)
        return false
      }
      
      // 数字のみの商品名を除外
      if (/^\d+$/.test(name)) {
        console.log(`除外（数字のみ）: ${name}`)
        return false
      }
      
      // 記号のみの商品名を除外
      if (/^[%\-*X\s]+$/.test(name)) {
        console.log(`除外（記号のみ）: ${name}`)
        return false
      }
      
      return true
    })
  }
  
  private validateContext(items: ParsedItem[], lineAnalyses: LineAnalysis[]): ParsedItem[] {
    // 商品数の妥当性チェック（レシートに100個以上の商品は稀）
    if (items.length > 100) {
      console.log(`商品数が多すぎます (${items.length}個)。信頼度でフィルタリングします。`)
      return items
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 50) // 上位50個まで
    }
    
    return items
  }
  
  private finalValidation(items: ParsedItem[]): ParsedItem[] {
    // 重複除去（同じ名前と価格）
    const seen = new Set<string>()
    const uniqueItems = items.filter(item => {
      const key = `${item.name}-${item.price}`
      if (seen.has(key)) {
        console.log(`重複除去: ${item.name} - ¥${item.price}`)
        return false
      }
      seen.add(key)
      return true
    })
    
    // 類似商品名の統合
    const consolidated = this.consolidateSimilarItems(uniqueItems)
    
    // 最終信頼度チェック
    const finalItems = consolidated.filter(item => item.confidence >= 0.3)
    
    // 信頼度順にソート
    return finalItems.sort((a, b) => b.confidence - a.confidence)
  }
  
  private consolidateSimilarItems(items: ParsedItem[]): ParsedItem[] {
    const consolidated: ParsedItem[] = []
    const processed = new Set<number>()
    
    for (let i = 0; i < items.length; i++) {
      if (processed.has(i)) continue
      
      const currentItem = items[i]
      const similarItems = [currentItem]
      
      // 類似アイテムを検索
      for (let j = i + 1; j < items.length; j++) {
        if (processed.has(j)) continue
        
        const otherItem = items[j]
        if (this.areSimilarItems(currentItem, otherItem)) {
          similarItems.push(otherItem)
          processed.add(j)
        }
      }
      
      // 最も信頼度の高いアイテムを選択
      const bestItem = similarItems.reduce((best, current) => 
        current.confidence > best.confidence ? current : best
      )
      
      consolidated.push(bestItem)
      processed.add(i)
    }
    
    return consolidated
  }
  
  private areSimilarItems(item1: ParsedItem, item2: ParsedItem): boolean {
    // 価格が同じ場合
    if (item1.price === item2.price) {
      // 名前の類似度チェック
      const similarity = this.calculateNameSimilarity(item1.name, item2.name)
      return similarity > 0.8
    }
    
    // 名前が非常に似ている場合（価格が異なっても統合）
    const nameSimilarity = this.calculateNameSimilarity(item1.name, item2.name)
    return nameSimilarity > 0.95
  }
  
  private calculateNameSimilarity(name1: string, name2: string): number {
    // シンプルな類似度計算（Levenshtein距離ベース）
    const longer = name1.length > name2.length ? name1 : name2
    const shorter = name1.length > name2.length ? name2 : name1
    
    if (longer.length === 0) return 1.0
    
    const editDistance = this.levenshteinDistance(longer, shorter)
    return (longer.length - editDistance) / longer.length
  }
  
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null))
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,     // deletion
          matrix[j - 1][i] + 1,     // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        )
      }
    }
    
    return matrix[str2.length][str1.length]
  }
  
  private isValidItem(name: string, price?: number): boolean {
    if (!name || name.length < 2) return false
    
    // 除外キーワードチェック
    if (Array.from(this.excludeKeywords).some(keyword => name.includes(keyword))) {
      return false
    }
    
    // 価格の妥当性
    if (price !== undefined && (price < 1 || price > 999999)) {
      return false
    }
    
    // 基本的なパターンチェック
    if (/^\d+$/.test(name) || /^[%\-*X\s]+$/.test(name)) {
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

// 学習機能付きパーサー（将来の拡張用）
export class LearningReceiptParser extends IntelligentReceiptParser {
  private learningData: Map<string, number> = new Map()
  
  learn(correctItems: ParsedItem[], actualText: string) {
    // 正解データから学習（将来の機械学習実装用）
    console.log('学習データを記録中...', correctItems.length, '個のアイテム')
    
    // 簡単な統計学習
    correctItems.forEach(item => {
      const key = `pattern:${item.detectionMethod}`
      this.learningData.set(key, (this.learningData.get(key) || 0) + 1)
    })
  }
  
  getLearnedPatterns(): Map<string, number> {
    return this.learningData
  }
}

// メイン関数（route.tsから呼び出される）
export function parseReceiptTextIntelligent(text: string): Array<{
  name: string
  price?: number
  quantity?: number
  category?: string
}> {
  const parser = new IntelligentReceiptParser()
  const results = parser.parse(text)
  
  // デバッグ情報の出力
  if (results.length > 0) {
    console.log('\n=== 検出結果詳細 ===')
    results.forEach((item, index) => {
      console.log(`${index + 1}. ${item.name} - ¥${item.price?.toLocaleString() || '価格なし'} (信頼度: ${item.confidence.toFixed(2)}, 方法: ${item.detectionMethod})`)
    })
  }
  
  // 戻り値の型を元のインターフェースに合わせる
  return results.map(item => ({
    name: item.name,
    price: item.price,
    quantity: item.quantity,
    category: item.category
  }))
}

// 分析レポート生成関数
export function generateParsingReport(text: string): {
  items: ParsedItem[]
  analytics: {
    totalLines: number
    processedLines: number
    confidenceDistribution: { [range: string]: number }
    detectionMethods: { [method: string]: number }
    categories: { [category: string]: number }
  }
} {
  const parser = new IntelligentReceiptParser()
  const items = parser.parse(text)
  
  const lines = text.split('\n').filter(line => line.trim())
  
  // 信頼度分布の計算
  const confidenceDistribution: { [range: string]: number } = {
    'high (0.8-1.0)': 0,
    'medium (0.6-0.8)': 0,
    'low (0.3-0.6)': 0
  }
  
  items.forEach(item => {
    if (item.confidence >= 0.8) confidenceDistribution['high (0.8-1.0)']++
    else if (item.confidence >= 0.6) confidenceDistribution['medium (0.6-0.8)']++
    else confidenceDistribution['low (0.3-0.6)']++
  })
  
  // 検出方法の分布
  const detectionMethods: { [method: string]: number } = {}
  items.forEach(item => {
    detectionMethods[item.detectionMethod] = (detectionMethods[item.detectionMethod] || 0) + 1
  })
  
  // カテゴリ分布
  const categories: { [category: string]: number } = {}
  items.forEach(item => {
    if (item.category) {
      categories[item.category] = (categories[item.category] || 0) + 1
    }
  })
  
  return {
    items,
    analytics: {
      totalLines: lines.length,
      processedLines: items.length,
      confidenceDistribution,
      detectionMethods,
      categories
    }
  }
}