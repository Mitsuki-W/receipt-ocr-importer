'use client'

import { useState, useEffect } from 'react'
import { OCRPatternConfig } from '@/types/ocr-patterns'
import { EnhancedOCRService } from '@/lib/ocr/enhanced-ocr-service'

interface PatternManagerProps {
  onPatternSelect?: (pattern: OCRPatternConfig) => void
}

export default function PatternManager({ onPatternSelect }: PatternManagerProps) {
  const [patterns, setPatterns] = useState<OCRPatternConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPattern, setSelectedPattern] = useState<string | null>(null)
  const [stats, setStats] = useState<any>(null)

  useEffect(() => {
    loadPatterns()
  }, [])

  const loadPatterns = async () => {
    try {
      setLoading(true)
      const ocrService = new EnhancedOCRService()
      const patternManager = await ocrService.getPatternManager()
      
      const loadedPatterns = await patternManager.loadPatterns()
      const patternStats = await patternManager.getPatternStats()
      
      setPatterns(loadedPatterns)
      setStats(patternStats)
    } catch (error) {
      console.error('パターンの読み込みに失敗しました:', error)
    } finally {
      setLoading(false)
    }
  }

  const togglePattern = async (patternId: string) => {
    try {
      const ocrService = new EnhancedOCRService()
      const patternManager = await ocrService.getPatternManager()
      
      await patternManager.togglePattern(patternId)
      await loadPatterns() // 再読み込み
    } catch (error) {
      console.error('パターンの切り替えに失敗しました:', error)
    }
  }

  const handlePatternClick = (pattern: OCRPatternConfig) => {
    setSelectedPattern(pattern.id)
    if (onPatternSelect) {
      onPatternSelect(pattern)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
        <span className="ml-2 text-slate-600">パターンを読み込み中...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 統計情報 */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-slate-50 to-slate-100 p-4 rounded-xl border border-slate-200">
            <div className="text-2xl font-bold text-slate-800">{stats.total}</div>
            <div className="text-sm text-slate-600">総パターン数</div>
          </div>
          <div className="bg-gradient-to-br from-teal-50 to-teal-100 p-4 rounded-xl border border-teal-200">
            <div className="text-2xl font-bold text-teal-800">{stats.enabled}</div>
            <div className="text-sm text-teal-600">有効パターン</div>
          </div>
          <div className="bg-gradient-to-br from-amber-50 to-amber-100 p-4 rounded-xl border border-amber-200">
            <div className="text-2xl font-bold text-amber-800">{Object.keys(stats.byStore).length}</div>
            <div className="text-sm text-amber-600">対応店舗数</div>
          </div>
          <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 p-4 rounded-xl border border-indigo-200">
            <div className="text-2xl font-bold text-indigo-800">{Object.keys(stats.byType).length}</div>
            <div className="text-sm text-indigo-600">パターン種類</div>
          </div>
        </div>
      )}

      {/* パターン一覧 */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-800">パターン一覧</h3>
        <div className="grid gap-4">
          {patterns.map((pattern) => (
            <div 
              key={pattern.id}
              className={`
                p-4 rounded-xl border transition-all cursor-pointer
                ${selectedPattern === pattern.id 
                  ? 'border-teal-300 bg-teal-50 shadow-md'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                }
              `}
              onClick={() => handlePatternClick(pattern)}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <h4 className="font-medium text-slate-800">{pattern.name}</h4>
                    <span className={`
                      px-2 py-1 text-xs rounded-full
                      ${pattern.enabled 
                        ? 'bg-teal-100 text-teal-700'
                        : 'bg-slate-100 text-slate-500'
                      }
                    `}>
                      {pattern.enabled ? '有効' : '無効'}
                    </span>
                    <span className="px-2 py-1 text-xs bg-slate-100 text-slate-600 rounded-full">
                      優先度: {pattern.priority}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 mt-1">{pattern.description}</p>
                  <div className="flex items-center space-x-4 mt-2 text-xs text-slate-500">
                    <span>信頼度: {(pattern.confidence * 100).toFixed(0)}%</span>
                    <span>パターン数: {pattern.patterns.length}</span>
                    {pattern.storeIdentifiers.length > 0 && (
                      <span>対応店舗: {pattern.storeIdentifiers.join(', ')}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      togglePattern(pattern.id)
                    }}
                    className={`
                      px-3 py-1 text-xs rounded-lg transition-colors
                      ${pattern.enabled
                        ? 'bg-teal-100 text-teal-700 hover:bg-teal-200'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }
                    `}
                  >
                    {pattern.enabled ? '無効化' : '有効化'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}