// app/api/ocr/extract-text/route.ts
// テキスト抽出専用API（拡張OCRサービス内部で使用）

import { NextRequest, NextResponse } from 'next/server'
import { ImageAnnotatorClient } from '@google-cloud/vision'
import sharp from 'sharp'

// Google Cloud Vision クライアントの初期化
const visionClient = new ImageAnnotatorClient({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
})

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('image') as File

    if (!file) {
      return NextResponse.json({ error: 'ファイルが見つかりません' }, { status: 400 })
    }

    // ファイルをBufferに変換
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // 画像を最適化（サイズ縮小・品質向上）
    const optimizedBuffer = await sharp(buffer)
      .resize(1200, 1200, { 
        fit: 'inside',
        withoutEnlargement: true 
      })
      .jpeg({ quality: 85 })
      .sharpen()
      .toBuffer()

    // Google Cloud Vision APIでOCR実行
    const [result] = await visionClient.textDetection({
      image: { content: optimizedBuffer }
    })

    const detections = result.textAnnotations
    const extractedText = detections?.[0]?.description || ''

    if (!extractedText) {
      return NextResponse.json({ 
        error: 'テキストを検出できませんでした' 
      }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      text: extractedText
    })

  } catch (error: unknown) {
    console.error('テキスト抽出エラー:', error)
    return NextResponse.json({ 
      error: 'テキスト抽出中にエラーが発生しました: ' + (error instanceof Error ? error.message : '不明なエラー')
    }, { status: 500 })
  }
}