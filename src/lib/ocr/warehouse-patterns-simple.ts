import { ExtractedItem } from '@/types/ocr-patterns'
import { WarehousePatternMatcher } from './warehouse-pattern-matcher'

/**
 * 大型店舗（WHOLESALE）専用のOCRパターンマッチング（リファクタリング版）
 * 
 * このクラスは後方互換性のために残されています。
 * 実際の処理は分割されたクラスに委譲されます。
 * 
 * @deprecated 新しいコードでは WarehousePatternMatcher を直接使用してください
 */
export class WarehousePatternsSimple {

  /**
   * 大型店舗のOCRテキストを解析
   * 
   * @param ocrText OCRで抽出されたテキスト
   * @returns 抽出された商品アイテム配列
   */
  static parseWarehouseText(ocrText: string): ExtractedItem[] {
    return WarehousePatternMatcher.parseWarehouseText(ocrText)
  }
}