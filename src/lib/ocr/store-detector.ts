/**
 * 店舗タイプ検出ユーティリティ
 * レシートテキストから店舗タイプを自動判定
 */
export class StoreDetector {
  /**
   * 大型店舗（コストコ、業務スーパー等）かどうかを判定
   */
  static isWarehouseLike(text: string): boolean {
    const warehouseIndicators = [
      'COSTCO',
      'コストコ',
      'WHOLESALE',
      'WAREHOUSE',
      'キロクストーン',
      'Q10',
      'アマゾン',
      'Amazon',
      'メルカリ',
      'Mercari',
      'ヨドバシカメラ',
      'ビックカメラ',
      'ヤマダ電機',
      'エディオン',
      'ドン・キホーテ',
      'MEGAドン・キホーテ',
      '業務スーパー',
      'GYOMU',
      'トライアル',
      'TRIAL',
      'ウエルシア',
      'Welcia',
      'マツモトキヨシ',
      'サンドラッグ',
      'ツルハドラッグ',
      'スギ薬局',
      'ホームセンター',
      'カインズ',
      'コメリ',
      'DCM',
      'ケーヨーD2',
      'ビバホーム'
    ]
    
    const matchCount = warehouseIndicators.filter(indicator => 
      text.includes(indicator)
    ).length
    
    // 大型店舗特有のパターン
    const warehousePatterns = [
      /\$\d+\.\d{2}/,  // ドル表記
      /MEMBER\s*#/i,   // メンバー番号
      /QTY\s*\d+/i,    // 数量表記
      /TOTAL\s*\$\d+/i, // 合計ドル
      /\d+\s*@\s*\$\d+/i, // 単価表記
      /BULK\s+SALE/i,  // バルク販売
      /WAREHOUSE/i,    // ウェアハウス
      /\d+\s*×\s*\$\d+/  // 倍数価格
    ]
    
    const patternMatches = warehousePatterns.filter(pattern => pattern.test(text)).length
    
    return matchCount >= 2 || patternMatches >= 2
  }

  /**
   * ライフ系列店舗かどうかを判定
   */
  static isLifeLike(text: string): boolean {
    const lifeIndicators = [
      'ライフ',
      'LIFE',
      '株式会社ライフコーポレーション',
      'LifeCorporation',
      'ライフコーポレーション',
      'L-POINT',
      'Lポイント',
      'ライフポイント'
    ]
    
    const matchCount = lifeIndicators.filter(indicator => 
      text.includes(indicator)
    ).length
    
    // ライフ固有のパターン
    const lifePatterns = [
      /L-POINT/i,
      /Lポイント/,
      /ライフポイント/,
      /LIFE\s*CORPORATION/i,
      /株式会社ライフコーポレーション/,
      /\d{4}-\d{4}-\d{4}-\d{4}/, // ポイントカード番号
      /残高\s*\d+/,             // ポイント残高
      /お買上げ明細書/,         // レシートタイトル
      /税込み\s*¥\d+/          // ライフ特有の価格表記
    ]
    
    const patternMatches = lifePatterns.filter(pattern => pattern.test(text)).length
    
    return matchCount >= 1 || patternMatches >= 2
  }

  /**
   * Receipt2のようなレシートかどうかを判定
   */
  static isReceipt2Like(text: string): boolean {
    const receipt2Indicators = [
      'Receipt2',
      'サンマルクカフェ',
      'ドトールコーヒー',
      'スターバックス',
      'Starbucks',
      'タリーズコーヒー',
      "Tully's",
      'ミスタードーナツ',
      'マクドナルド',
      "McDonald's",
      'ケンタッキー',
      'KFC',
      'モスバーガー',
      'MOS BURGER',
      'ロッテリア',
      'LOTTERIA',
      'フレッシュネスバーガー',
      'FRESHNESS BURGER'
    ]
    
    const matchCount = receipt2Indicators.filter(indicator => 
      text.includes(indicator)
    ).length
    
    // 店舗固有のパターン
    const storePatterns = [
      /\*[^*]+\s*\n\s*¥\d+/,  // *商品名 改行 ¥価格
      /[A-Z]\s+.+\s*\n\s*\d+コX単\d+/,  // 税区分付き商品 改行 数量パターン
      /\d+コX単\d+/  // 数量パターン
    ]
    
    const patternMatches = storePatterns.filter(pattern => pattern.test(text)).length
    
    return matchCount >= 2 || patternMatches >= 2
  }

  /**
   * Receipt3のようなレシートかどうかを判定
   */
  static isReceipt3Like(text: string): boolean {
    const receipt3Indicators = [
      'Receipt3',
      'ピーコックストア',
      'イオンマーケット株式会社',
      '領収証',
      'バイオレジ袋',
      '森永乳業',
      'パルムチョコ',
      'タカキ',
      'TVB P若鶏',
      '金麦糖質オフ',
      '男前豆腐店'
    ]
    
    const matchCount = receipt3Indicators.filter(indicator => 
      text.includes(indicator)
    ).length
    
    // Receipt3固有のパターン
    const receipt3Patterns = [
      /Receipt3/i,
      /ピーコックストア/,
      /イオンマーケット株式会社/,
      /レジ\s*\d{4}/,
      /\d+※$/m,  // 軽減税率マーク
      /割引!\s*\d+%/
    ]
    
    const patternMatches = receipt3Patterns.filter(pattern => pattern.test(text)).length
    
    return matchCount >= 2 || patternMatches >= 2
  }

  /**
   * 汎用的な店舗タイプを検出
   */
  static detectStoreType(text: string): string {
    if (this.isWarehouseLike(text)) return 'warehouse'
    if (this.isLifeLike(text)) return 'life'
    if (this.isReceipt2Like(text)) return 'receipt2'
    if (this.isReceipt3Like(text)) return 'receipt3'
    return 'generic'
  }
}