'use client'

import { useState, useCallback } from 'react'
import { OCRPatternConfig, OCRPattern } from '@/types/ocr-patterns'
import { PATTERN_TEMPLATES } from '@/lib/ocr/pattern-configs'
import { EnhancedOCRService } from '@/lib/ocr/enhanced-ocr-service'

interface PatternCreatorProps {
  onPatternCreated?: (pattern: OCRPatternConfig) => void
  onCancel?: () => void
}

export default function PatternCreator({ onPatternCreated, onCancel }: PatternCreatorProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    storeIdentifiers: '',
    priority: 50,
    patternType: 'single-line' as 'single-line' | 'multi-line',
    regex: '',
    sampleText: '',
    extractedField1: 'name',
    extractedField2: 'price'
  })
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<any>(null)
  const [saving, setSaving] = useState(false)

  const handleInputChange = useCallback((field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setTestResult(null) // テスト結果をクリア
  }, [])

  const generateRegex = useCallback(() => {
    const { sampleText, patternType } = formData
    if (!sampleText.trim()) return

    // サンプルテキストから正規表現を生成する簡単なロジック
    let suggestedRegex = ''
    
    if (patternType === 'single-line') {
      // 商品名 + 価格の基本パターン
      if (sampleText.includes('¥')) {
        suggestedRegex = '^(.+?)\\\\s+¥(\\\\d+)\\\\s*$'
      } else if (/\d{2,5}\s*$/.test(sampleText)) {
        suggestedRegex = '^(.+?)\\\\s+(\\\\d{2,5})\\\\s*$'
      } else {
        // カスタムパターン生成
        const escapedSample = sampleText.replace(/[.*+?^${}()|[\]\\]/g, '\\\\$&')
        suggestedRegex = escapedSample
          .replace(/[ぁ-んァ-ヶー\w\s]+/g, '(.+?)')
          .replace(/\d+/g, '(\\\\d+)')
      }
    }
    
    setFormData(prev => ({ ...prev, regex: suggestedRegex }))
  }, [formData.sampleText, formData.patternType])

  const testPattern = useCallback(async () => {
    const { sampleText, regex, name, patternType } = formData
    if (!regex || !sampleText || !name) return

    setTesting(true)
    try {
      // テンプレートからパターンを作成
      const testPattern: OCRPatternConfig = {
        id: `test-${Date.now()}`,
        name,
        description: formData.description || 'テストパターン',
        priority: formData.priority,
        enabled: true,
        storeIdentifiers: formData.storeIdentifiers.split(',').map(s => s.trim()).filter(Boolean),
        confidence: 0.7,
        patterns: [{
          id: `test-pattern-${Date.now()}`,
          name: `${name} パターン`,
          type: patternType,
          regex: patternType === 'single-line' ? regex : undefined,
          lineCount: patternType === 'multi-line' ? 2 : undefined,
          extractionRules: [
            { field: formData.extractedField1 as any, source: 'regex-group', groupIndex: 1 },
            { field: formData.extractedField2 as any, source: 'regex-group', groupIndex: 2 }
          ],
          confidence: 0.7
        }]
      }

      const ocrService = new EnhancedOCRService()
      const patternManager = await ocrService.getPatternManager()
      const result = await patternManager.testPattern(testPattern, sampleText)
      
      setTestResult(result)
    } catch (error) {
      console.error('パターンテストエラー:', error)
      setTestResult({
        patternId: 'test',
        confidence: 0,
        items: [],
        metadata: { processingTime: 0, patternsAttempted: [], fallbackUsed: false }
      })
    } finally {
      setTesting(false)
    }
  }, [formData])

  const savePattern = useCallback(async () => {
    const { name, description, storeIdentifiers, priority, patternType, regex } = formData
    if (!name || !regex) return

    setSaving(true)
    try {
      const newPattern: OCRPatternConfig = {
        id: `custom-${Date.now()}`,
        name,
        description: description || `カスタムパターン: ${name}`,
        priority,
        enabled: true,
        storeIdentifiers: storeIdentifiers.split(',').map(s => s.trim()).filter(Boolean),
        confidence: 0.7,
        patterns: [{
          id: `pattern-${Date.now()}`,
          name: `${name} パターン`,
          type: patternType,
          regex: patternType === 'single-line' ? regex : undefined,
          lineCount: patternType === 'multi-line' ? 2 : undefined,
          extractionRules: [
            { field: formData.extractedField1 as any, source: 'regex-group', groupIndex: 1 },
            { field: formData.extractedField2 as any, source: 'regex-group', groupIndex: 2 }
          ],
          validationRules: [
            { field: 'name', type: 'length', min: 2, max: 50 },
            { field: 'price', type: 'range', min: 1, max: 999999 }
          ],
          confidence: 0.7
        }]
      }

      const ocrService = new EnhancedOCRService()
      const patternManager = await ocrService.getPatternManager()
      await patternManager.addPattern(newPattern)

      if (onPatternCreated) {
        onPatternCreated(newPattern)
      }
    } catch (error) {
      console.error('パターン保存エラー:', error)
    } finally {
      setSaving(false)
    }
  }, [formData, onPatternCreated])

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl border border-slate-200">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">新しいパターンを作成</h3>
        
        <div className="grid md:grid-cols-2 gap-6">
          {/* 基本情報 */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                パターン名 *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className="w-full p-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                placeholder="例: マイストア レシートパターン"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                説明
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                rows={3}
                className="w-full p-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                placeholder="パターンの詳細説明..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                対応店舗 (カンマ区切り)
              </label>
              <input
                type="text"
                value={formData.storeIdentifiers}
                onChange={(e) => handleInputChange('storeIdentifiers', e.target.value)}
                className="w-full p-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                placeholder="例: mystore, マイストア"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                優先度 (1-100)
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={formData.priority}
                onChange={(e) => handleInputChange('priority', parseInt(e.target.value))}
                className="w-full p-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                パターンタイプ
              </label>
              <select
                value={formData.patternType}
                onChange={(e) => handleInputChange('patternType', e.target.value)}
                className="w-full p-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="single-line">1行パターン</option>
                <option value="multi-line">複数行パターン</option>
              </select>
            </div>
          </div>

          {/* パターン設定 */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                サンプルテキスト
              </label>
              <textarea
                value={formData.sampleText}
                onChange={(e) => handleInputChange('sampleText', e.target.value)}
                rows={4}
                className="w-full p-3 border border-slate-300 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                placeholder="実際のレシートの行を入力してください..."
              />
              <button
                onClick={generateRegex}
                className="mt-2 px-4 py-2 bg-teal-100 text-teal-700 rounded-lg hover:bg-teal-200 transition-colors text-sm"
              >
                正規表現を自動生成
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                正規表現パターン *
              </label>
              <textarea
                value={formData.regex}
                onChange={(e) => handleInputChange('regex', e.target.value)}
                rows={3}
                className="w-full p-3 border border-slate-300 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                placeholder="^(.+?)\\s+(\\d{2,5})\\s*$"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  抽出フィールド1
                </label>
                <select
                  value={formData.extractedField1}
                  onChange={(e) => handleInputChange('extractedField1', e.target.value)}
                  className="w-full p-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="name">商品名</option>
                  <option value="price">価格</option>
                  <option value="quantity">数量</option>
                  <option value="category">カテゴリ</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  抽出フィールド2
                </label>
                <select
                  value={formData.extractedField2}
                  onChange={(e) => handleInputChange('extractedField2', e.target.value)}
                  className="w-full p-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="price">価格</option>
                  <option value="name">商品名</option>
                  <option value="quantity">数量</option>
                  <option value="category">カテゴリ</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* テスト */}
        <div className="mt-6 pt-6 border-t border-slate-200">
          <div className="flex justify-between items-center mb-4">
            <h4 className="font-medium text-slate-800">パターンテスト</h4>
            <button
              onClick={testPattern}
              disabled={!formData.regex || !formData.sampleText || testing}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:bg-slate-400 transition-colors"
            >
              {testing ? 'テスト中...' : 'テスト実行'}
            </button>
          </div>

          {testResult && (
            <div className="p-4 bg-slate-50 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium text-slate-800">テスト結果</span>
                <span className={`px-2 py-1 text-xs rounded-full ${
                  testResult.confidence > 0.5 
                    ? 'bg-teal-100 text-teal-700'
                    : 'bg-amber-100 text-amber-700'
                }`}>
                  信頼度: {(testResult.confidence * 100).toFixed(1)}%
                </span>
              </div>
              
              {testResult.items.length > 0 ? (
                <div className="space-y-2">
                  {testResult.items.map((item: any, index: number) => (
                    <div key={index} className="p-2 bg-white rounded border">
                      <div className="font-medium">{item.name}</div>
                      {item.price && <div className="text-sm text-slate-600">価格: ¥{item.price}</div>}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-slate-500 text-sm">抽出されたアイテムがありません</div>
              )}
            </div>
          )}
        </div>

        {/* アクション */}
        <div className="flex justify-end space-x-4 mt-6 pt-6 border-t border-slate-200">
          {onCancel && (
            <button
              onClick={onCancel}
              className="px-6 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
            >
              キャンセル
            </button>
          )}
          <button
            onClick={savePattern}
            disabled={!formData.name || !formData.regex || saving}
            className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:bg-slate-400 transition-colors"
          >
            {saving ? '保存中...' : 'パターンを保存'}
          </button>
        </div>
      </div>
    </div>
  )
}