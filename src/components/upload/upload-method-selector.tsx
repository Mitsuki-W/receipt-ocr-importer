import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Upload, Camera, AlertCircle } from 'lucide-react'

interface UploadMethodSelectorProps {
  onFileSelect: () => void
  onCameraSelect: () => void
}

export default function UploadMethodSelector({ 
  onFileSelect, 
  onCameraSelect 
}: UploadMethodSelectorProps) {
  return (
    <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-sm hover:shadow-md transition-all duration-300">
      <CardHeader className="pb-4">
        <CardTitle className="text-slate-800 flex items-center gap-2">
          <div className="w-5 h-5 bg-gradient-to-br from-teal-500 to-teal-600 rounded-md flex items-center justify-center">
            <Upload className="h-3 w-3 text-white" />
          </div>
          アップロード方法を選択
        </CardTitle>
        <CardDescription className="text-slate-600">
          ファイルをアップロードするか、カメラで撮影してください
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* 注意書き */}
        <div className="mb-6 p-4 bg-amber-50/80 border border-amber-200/60 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="space-y-2">
              <h4 className="font-medium text-amber-800">撮影時のご注意</h4>
              <ul className="text-sm text-amber-700 space-y-1">
                <li>• <strong>レシートは1枚ずつ</strong>撮影してください</li>
                <li>• 文字が鮮明に写るように明るい場所で撮影してください</li>
                <li>• レシート全体が画面に収まるようにしてください</li>
                <li>• 影が入らないよう正面から撮影してください</li>
              </ul>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Button
            variant="outline"
            className="h-28 flex flex-col gap-3 bg-gradient-to-br from-white to-slate-50/50 border-slate-200 hover:border-teal-300 hover:bg-gradient-to-br hover:from-teal-50 hover:to-teal-100/50 transition-all duration-200 group"
            onClick={onFileSelect}
          >
            <Upload className="h-7 w-7 text-slate-600 group-hover:text-teal-600 transition-colors duration-200" />
            <span className="font-medium text-slate-700 group-hover:text-teal-700">ファイルから選択</span>
          </Button>
          <Button
            variant="outline"
            className="h-28 flex flex-col gap-3 bg-gradient-to-br from-white to-slate-50/50 border-slate-200 hover:border-teal-300 hover:bg-gradient-to-br hover:from-teal-50 hover:to-teal-100/50 transition-all duration-200 group"
            onClick={onCameraSelect}
          >
            <Camera className="h-7 w-7 text-slate-600 group-hover:text-teal-600 transition-colors duration-200" />
            <span className="font-medium text-slate-700 group-hover:text-teal-700">カメラで撮影</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}