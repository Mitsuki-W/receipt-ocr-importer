'use client'

import { useState, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Camera, X, RotateCcw, Check, AlertCircle } from 'lucide-react'

interface CameraCaptureProps {
  onCapture: (file: File) => void
  onCancel: () => void
}

export default function CameraCapture({ onCapture, onCancel }: CameraCaptureProps) {
  const [isStreaming, setIsStreaming] = useState(false)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [error, setError] = useState('')
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const startCamera = useCallback(async () => {
    try {
      setError('')
      console.log('カメラ開始処理を開始します...')
      
      // 先にビデオ要素を表示するためにストリーミング状態を有効にする
      setIsStreaming(true)
      
      // DOM更新を待つ
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // デバイス確認
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('このブラウザはカメラをサポートしていません。')
      }
      
      // 利用可能なカメラデバイスを確認
      console.log('利用可能なデバイスを確認中...')
      const devices = await navigator.mediaDevices.enumerateDevices()
      const videoDevices = devices.filter(device => device.kind === 'videoinput')
      console.log('検出されたビデオデバイス:', videoDevices)
      
      if (videoDevices.length === 0) {
        throw new Error('カメラデバイスが見つかりません。')
      }
      
      // ビデオ要素の存在確認
      if (!videoRef.current) {
        console.error('ビデオ要素がまだ利用できません')
        throw new Error('ビデオ要素が見つかりません')
      }
      
      // まず背面カメラを試す（モバイル用）
      let stream: MediaStream
      try {
        console.log('背面カメラでの接続を試行中...')
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          }
        })
        console.log('背面カメラでの接続に成功')
      } catch (envError) {
        // 背面カメラが利用できない場合（PC等）は通常のカメラを使用
        console.log('背面カメラが利用できません。フロントカメラを試行中...', envError)
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 1920 },
              height: { ideal: 1080 }
            }
          })
          console.log('フロントカメラでの接続に成功')
        } catch (frontError) {
          console.log('フロントカメラも失敗。デフォルト設定で試行中...', frontError)
          stream = await navigator.mediaDevices.getUserMedia({
            video: true
          })
          console.log('デフォルト設定での接続に成功')
        }
      }
      
      console.log('ストリーム取得成功:', stream)
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        streamRef.current = stream
        console.log('ビデオ要素にストリームを設定完了')
      } else {
        console.error('ビデオ要素が見つかりません')
        throw new Error('ビデオ要素が見つかりません')
      }
    } catch (err) {
      console.error('カメラアクセスエラー詳細:', err)
      const errorMessage = err instanceof Error ? err.message : 'カメラにアクセスできません'
      setError(`カメラエラー: ${errorMessage}`)
      setIsStreaming(false) // エラー時は状態をリセット
    }
  }, [])

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    setIsStreaming(false)
  }, [])

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const context = canvas.getContext('2d')

    if (!context) return

    // キャンバスサイズをビデオに合わせて設定
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    // ビデオフレームをキャンバスに描画
    context.drawImage(video, 0, 0)

    // キャンバスからBlob/Fileを作成
    canvas.toBlob((blob) => {
      if (blob) {
        const imageUrl = canvas.toDataURL('image/jpeg', 0.8)
        setCapturedImage(imageUrl)
        stopCamera()
      }
    }, 'image/jpeg', 0.8)
  }, [stopCamera])

  const retakePhoto = useCallback(() => {
    setCapturedImage(null)
    startCamera()
  }, [startCamera])

  const confirmCapture = useCallback(() => {
    if (!capturedImage || !canvasRef.current) return

    canvasRef.current.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], 'camera-capture.jpg', { type: 'image/jpeg' })
        onCapture(file)
      }
    }, 'image/jpeg', 0.8)
  }, [capturedImage, onCapture])

  const handleCancel = useCallback(() => {
    stopCamera()
    onCancel()
  }, [stopCamera, onCancel])

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Camera className="h-5 w-5" />
          カメラで撮影
        </CardTitle>
        <CardDescription>
          レシートを撮影してください
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-4">
          {/* 撮影時の注意書き */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-blue-800 mb-1">撮影のポイント</p>
                <ul className="text-xs text-blue-700 space-y-0.5">
                  <li>• <strong>1枚ずつ</strong>撮影してください</li>
                  <li>• レシート全体が画面に収まるように調整</li>
                  <li>• 明るい場所で文字が鮮明に写るよう撮影</li>
                </ul>
              </div>
            </div>
          </div>

          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
              {error}
            </div>
          )}

          {!isStreaming && !capturedImage && (
            <div className="text-center">
              <Button 
                onClick={() => {
                  startCamera()
                }} 
                className="mb-4"
              >
                <Camera className="mr-2 h-4 w-4" />
                カメラを開始
              </Button>
              <p className="text-sm text-muted-foreground">
                カメラへのアクセスを許可してください
              </p>
            </div>
          )}

          {/* ビデオプレビュー */}
          {isStreaming && (
            <div className="relative">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-auto rounded-lg border"
                style={{ maxHeight: '400px' }}
              />
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2">
                <Button
                  onClick={capturePhoto}
                  size="lg"
                  className="rounded-full w-16 h-16"
                >
                  <Camera className="h-6 w-6" />
                </Button>
              </div>
            </div>
          )}

          {/* 撮影画像プレビュー */}
          {capturedImage && (
            <div className="space-y-4">
              <img
                src={capturedImage}
                alt="撮影画像"
                className="w-full h-auto rounded-lg border"
                style={{ maxHeight: '400px', objectFit: 'contain' }}
              />
              <div className="flex gap-2">
                <Button onClick={retakePhoto} variant="outline" className="flex-1">
                  <RotateCcw className="mr-2 h-4 w-4" />
                  撮り直し
                </Button>
                <Button onClick={confirmCapture} className="flex-1">
                  <Check className="mr-2 h-4 w-4" />
                  この写真を使用
                </Button>
              </div>
            </div>
          )}

          {/* キャンバス（非表示） */}
          <canvas ref={canvasRef} style={{ display: 'none' }} />

          {/* キャンセルボタン */}
          <div className="flex justify-center pt-4">
            <Button variant="outline" onClick={handleCancel}>
              <X className="mr-2 h-4 w-4" />
              キャンセル
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}