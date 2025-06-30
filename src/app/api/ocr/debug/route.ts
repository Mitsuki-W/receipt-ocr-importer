// app/api/ocr/debug/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { EnhancedOCRService } from '@/lib/ocr/enhanced-ocr-service'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    // 認証チェック（開発環境ではスキップ可能）
    if (process.env.NODE_ENV === 'production') {
      const supabase = createRouteHandlerClient({ cookies })
      const { data: { session }, error: authError } = await supabase.auth.getSession()

      if (authError || !session) {
        return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
      }
    }

    const formData = await request.formData()
    const file = formData.get('image') as File
    const action = formData.get('action') as string || 'analysis'

    if (!file) {
      return NextResponse.json({ error: 'ファイルが見つかりません' }, { status: 400 })
    }

    const enhancedOCR = new EnhancedOCRService()

    switch (action) {
      case 'analysis': {
        // 完全なデバッグ分析
        const debugAnalysis = await enhancedOCR.getFullDebugAnalysis(file)
        
        return NextResponse.json({
          success: true,
          action: 'debug-analysis',
          data: {
            analysis: debugAnalysis.analysis,
            report: debugAnalysis.report,
            suggestions: debugAnalysis.suggestions
          }
        })
      }

      case 'performance': {
        // パフォーマンステスト
        const performanceTest = await enhancedOCR.runPerformanceTest(file, {
          iterations: 3,
          testBothProcessors: true
        })
        
        return NextResponse.json({
          success: true,
          action: 'performance-test',
          data: performanceTest
        })
      }

      case 'comparison': {
        // 標準プロセッサーと改良プロセッサーの比較
        const standardResult = await enhancedOCR.processImage(file, {
          useImprovedProcessor: false,
          debugMode: true
        })

        const improvedResult = await enhancedOCR.processImage(file, {
          useImprovedProcessor: true,
          debugMode: true
        })

        return NextResponse.json({
          success: true,
          action: 'processor-comparison',
          data: {
            standard: {
              itemCount: standardResult.items.length,
              confidence: standardResult.metadata?.confidence || 0,
              processingTime: standardResult.metadata?.processingTime || 0,
              fallbackUsed: standardResult.metadata?.fallbackUsed || false,
              items: standardResult.items
            },
            improved: {
              itemCount: improvedResult.items.length,
              confidence: improvedResult.metadata?.confidence || 0,
              processingTime: improvedResult.metadata?.processingTime || 0,
              fallbackUsed: improvedResult.metadata?.fallbackUsed || false,
              items: improvedResult.items
            },
            recommendation: improvedResult.metadata?.confidence > standardResult.metadata?.confidence ? 
              'improved' : 'standard'
          }
        })
      }

      case 'validation': {
        // 検証結果の詳細表示
        const result = await enhancedOCR.processImage(file, {
          enableValidation: true,
          enableAutoCorrection: false, // 修正前の状態を確認
          debugMode: true
        })

        // 検証情報を個別に実行
        const validator = await enhancedOCR['validator'] // privateアクセスのため
        if (validator) {
          const validationResults = validator.validateItems(
            result.items,
            result.extractedText
          )

          return NextResponse.json({
            success: true,
            action: 'validation-details',
            data: {
              items: result.items,
              validationResults: {
                globalIssues: validationResults.globalIssues,
                globalSuggestions: validationResults.globalSuggestions,
                itemValidations: Array.from(validationResults.results.entries()).map(([index, validation]) => ({
                  index,
                  item: result.items[index],
                  validation
                }))
              }
            }
          })
        }

        return NextResponse.json({
          success: true,
          action: 'validation-details',
          data: {
            items: result.items,
            note: 'Validator not accessible'
          }
        })
      }

      default: {
        return NextResponse.json({ 
          error: '無効なアクションです。利用可能: analysis, performance, comparison, validation' 
        }, { status: 400 })
      }
    }

  } catch (error) {
    console.error('デバッグAPI エラー:', error)
    return NextResponse.json({ 
      error: 'デバッグ処理でエラーが発生しました',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'OCR デバッグAPI',
    availableActions: [
      {
        action: 'analysis',
        method: 'POST',
        description: '完全なデバッグ分析を実行',
        parameters: ['image (File)']
      },
      {
        action: 'performance',
        method: 'POST', 
        description: 'パフォーマンステストを実行',
        parameters: ['image (File)']
      },
      {
        action: 'comparison',
        method: 'POST',
        description: '標準/改良プロセッサーの比較',
        parameters: ['image (File)']
      },
      {
        action: 'validation',
        method: 'POST',
        description: '検証結果の詳細表示',
        parameters: ['image (File)']
      }
    ],
    usage: {
      endpoint: '/api/ocr/debug',
      example: 'POST with FormData: image=<file>, action=analysis'
    }
  })
}