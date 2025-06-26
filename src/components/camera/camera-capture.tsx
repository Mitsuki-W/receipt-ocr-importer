'use client'

import { useState, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Camera, X, RotateCcw, Check } from 'lucide-react'

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
      
      // まず背面カメラを試す（モバイル用）
      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          }
        })
      } catch (err) {
        // 背面カメラが利用できない場合（PC等）は通常のカメラを使用
        console.log('背面カメラが利用できません。フロントカメラを使用します。')
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          }
        })
      }
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        streamRef.current = stream
        setIsStreaming(true)
      }
    } catch (err) {
      console.error('カメラアクセスエラー:', err)
      setError('カメラにアクセスできません。ブラウザの設定を確認してください。')
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
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
              {error}
            </div>
          )}

          {!isStreaming && !capturedImage && (
            <div className="text-center">
              <Button onClick={startCamera} className="mb-4">
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