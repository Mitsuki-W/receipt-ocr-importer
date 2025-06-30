// app/api/ocr/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { EnhancedOCRService } from '@/lib/ocr/enhanced-ocr-service'
import { HybridOCRStrategy } from '@/lib/ocr/hybrid-ocr-strategy'
// import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
// import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  console.log('🚀 OCR API 処理開始:', new Date().toISOString())
  
  try {
    // 認証チェックを一時的に無効化
    // const cookieStore = await cookies()
    // const supabase = createRouteHandlerClient({ 
    //   cookies: () => Promise.resolve(cookieStore)
    // })
    // const { data: { session }, error: authError } = await supabase.auth.getSession()

    // if (authError || !session) {
    //   return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    // }

    console.log('📝 FormData解析開始')
    const formData = await request.formData()
    const file = formData.get('image') as File

    if (!file) {
      console.log('❌ ファイルが見つかりません')
      return NextResponse.json({ error: 'ファイルが見つかりません' }, { status: 400 })
    }

    console.log('📁 ファイル情報:', {
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: new Date(file.lastModified).toISOString()
    })

    // ハイブリッドOCR戦略を使用
    const debugMode = process.env.NODE_ENV === 'development'
    const useHybridStrategy = process.env.USE_HYBRID_STRATEGY === 'true'
    
    console.log('⚙️ OCR処理設定:', {
      debugMode,
      useHybridStrategy,
      documentAIAvailable: process.env.USE_DOCUMENT_AI === 'true' && !!process.env.DOCUMENT_AI_PROCESSOR_ID
    })

    let result
    
    if (useHybridStrategy) {
      // ハイブリッド戦略使用
      console.log('🔄 ハイブリッドOCR戦略を使用')
      const hybridOCR = new HybridOCRStrategy({
        debugMode,
        enableQualityAssessment: true,
        fallbackThreshold: 0.7,
        mergeStrategy: 'best-of-both',
        confidenceThreshold: 0.7,
        itemCountThreshold: 3
      })
      
      result = await hybridOCR.processReceipt(file)
    } else {
      // 従来のEnhancedOCRService使用
      console.log('🔧 従来のEnhancedOCRServiceを使用')
      const enhancedOCR = new EnhancedOCRService()
      
      const useDocumentAI = process.env.USE_DOCUMENT_AI === 'true'
      const options = {
        enablePatternMatching: true,
        maxProcessingTime: 25000,
        confidenceThreshold: 0.3,
        enableFallback: true,
        debugMode,
        enableValidation: true,
        enableAutoCorrection: true,
        useImprovedProcessor: true,
        applyEmergencyFixes: true,
        useReceiptSpecificFixes: true,
        useReceipt2Parser: true,
        useReceipt3Parser: true,
        useLifeParser: true,
        useWarehouseParser: true,
        useDocumentAI: useDocumentAI,
        documentAIProcessorId: process.env.DOCUMENT_AI_PROCESSOR_ID,
        documentAILocation: process.env.DOCUMENT_AI_LOCATION || 'us'
      }
      
      result = await enhancedOCR.processImage(file, options)
    }

    console.log('🔍 OCR処理開始')
    
    const processingTime = Date.now() - startTime
    console.log('✅ OCR処理完了:', {
      processingTime: processingTime + 'ms',
      success: result.success,
      itemsFound: result.items?.length || 0
    })

    if (!result.success) {
      return NextResponse.json({ 
        error: 'OCR処理に失敗しました' 
      }, { status: 400 })
    }

    // デバッグ分析（重複実行を避けるため一時的に無効化）
    if (debugMode) {
      console.log('\n📋 処理結果:')
      console.log(`- 検出商品数: ${result.items.length}`)
      console.log(`- 処理時間: ${result.metadata?.processingTime}ms`)
      console.log(`- 信頼度: ${((result.metadata?.confidence || 0) * 100).toFixed(1)}%`)
      console.log(`- フォールバック使用: ${result.metadata?.fallbackUsed ? 'Yes' : 'No'}`)
      
      if (result.items.length > 0) {
        console.log('\n🛒 検出された商品:')
        result.items.forEach((item, index) => {
          const currency = item.currency === 'USD' ? '$' : '¥'
          console.log(`${index + 1}. ${item.name} - ${currency}${item.price} (x${item.quantity || 1}) [信頼度: ${(item.confidence * 100).toFixed(1)}%]`)
        })
      }
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
        storeDetected: (result.metadata as any)?.storeType || 'unknown',
        patternUsed: (result.metadata as any)?.patternUsed || (result.metadata as any)?.primaryMethod || 'unknown',
        confidence: result.metadata?.confidence,
        processingTime: result.metadata?.processingTime,
        methodsUsed: (result.metadata as any)?.methodsUsed || [],
        qualityScore: (result.metadata as any)?.qualityScore
      }
    })

  } catch (error: unknown) {
    const processingTime = Date.now() - startTime
    console.error('❌ OCR API エラー:', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      processingTime: processingTime + 'ms'
    })
    
    let errorMessage = 'OCR処理中にエラーが発生しました'
    
    if (error instanceof Error) {
      if (error.message.includes('timeout') || error.message.includes('TIMEOUT')) {
        errorMessage = 'OCR処理がタイムアウトしました。画像サイズを小さくして再試行してください。'
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        errorMessage = 'ネットワークエラーが発生しました。'
      } else {
        errorMessage = `OCR処理エラー: ${error.message}`
      }
    }
    
    return NextResponse.json({ 
      error: errorMessage,
      debug: {
        processingTime: processingTime + 'ms',
        errorType: error instanceof Error ? error.constructor.name : 'UnknownError'
      }
    }, { status: 500 })
  }
}