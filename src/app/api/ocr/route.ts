// app/api/ocr/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { EnhancedOCRService } from '@/lib/ocr/enhanced-ocr-service'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    // 認証チェック
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session }, error: authError } = await supabase.auth.getSession()

    if (authError || !session) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('image') as File

    if (!file) {
      return NextResponse.json({ error: 'ファイルが見つかりません' }, { status: 400 })
    }

    // 拡張OCRサービスを使用
    const enhancedOCR = new EnhancedOCRService()
    
    // パターンマッチングオプション設定
    const options = {
      enablePatternMatching: true,
      maxProcessingTime: 10000,
      confidenceThreshold: 0.3,
      enableFallback: true,
      debugMode: process.env.NODE_ENV === 'development'
    }

    const result = await enhancedOCR.processImage(file, options)

    if (!result.success) {
      return NextResponse.json({ 
        error: 'OCR処理に失敗しました' 
      }, { status: 400 })
    }

    // デバッグ用ログ
    if (options.debugMode) {
      console.log('=== 拡張OCR デバッグ情報 ===')
      console.log('抽出されたテキスト:')
      console.log(result.extractedText)
      console.log('\n解析された商品:')
      console.log(JSON.stringify(result.items, null, 2))
      console.log('\nメタデータ:')
      console.log(JSON.stringify(result.metadata, null, 2))
      console.log('=========================')
    }

    return NextResponse.json({
      success: true,
      extractedText: result.extractedText,
      items: result.items,
      metadata: result.metadata,
      debug: {
        textLines: result.extractedText.split('\n').length,
        itemsFound: result.items.length,
        storeDetected: result.metadata?.storeType,
        patternUsed: result.metadata?.patternUsed,
        confidence: result.metadata?.confidence,
        processingTime: result.metadata?.processingTime
      }
    })

  } catch (error: unknown) {
    console.error('拡張OCR エラー:', error)
    return NextResponse.json({ 
      error: 'OCR処理中にエラーが発生しました: ' + (error instanceof Error ? error.message : '不明なエラー')
    }, { status: 500 })
  }
}