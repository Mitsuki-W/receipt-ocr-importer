import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, X, ImageIcon } from 'lucide-react'
import NextImage from 'next/image'
import { OCRResult } from '@/types/upload'

interface ImagePreviewProps {
  preview: string | null
  file: File | null
  loading: boolean
  progress: number
  ocrResult: OCRResult | null
  onProcessOCR: () => void
  onReset: () => void
}

export default function ImagePreview({
  preview,
  file,
  loading,
  progress,
  ocrResult,
  onProcessOCR,
  onReset
}: ImagePreviewProps) {
  if (!file && !preview) return null

  return (
    <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-sm hover:shadow-md transition-all duration-300">
      <CardHeader className="pb-4">
        <CardTitle className="text-slate-800 flex items-center gap-2">
          <div className="w-5 h-5 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-md flex items-center justify-center">
            <ImageIcon className="h-3 w-3 text-white" />
          </div>
          アップロード画像
        </CardTitle>
        <CardDescription className="text-slate-600">
          画像を確認してレシートを読み取ってください
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {preview && (
            <div className="flex justify-center">
              <div className="relative overflow-hidden rounded-xl border-2 border-slate-200/60 shadow-sm bg-white/50">
                <NextImage
                  src={preview}
                  alt="アップロード画像"
                  width={400}
                  height={300}
                  className="object-contain"
                  style={{ maxHeight: '400px' }}
                />
              </div>
            </div>
          )}

          <div className="flex gap-2">
            {file && !ocrResult && (
              <div className="flex-1">
                <Button 
                  onClick={onProcessOCR} 
                  disabled={loading}
                  className="w-full mb-2 bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white font-medium shadow-sm hover:shadow-md transition-all duration-200"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      画像を解析中...
                    </>
                  ) : (
                    'レシートを読み取る'
                  )}
                </Button>
                {loading && (
                  <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-teal-500 to-teal-600 h-2.5 rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                )}
              </div>
            )}
            
            <Button 
              variant="outline"
              onClick={onReset}
              className="bg-white/80 border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-700 font-medium transition-all duration-200"
            >
              <X className="mr-2 h-4 w-4" />
              画像を削除
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}