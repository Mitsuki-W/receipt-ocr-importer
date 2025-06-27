import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Upload, Camera } from 'lucide-react'

interface UploadMethodSelectorProps {
  onFileSelect: () => void
  onCameraSelect: () => void
}

export default function UploadMethodSelector({ 
  onFileSelect, 
  onCameraSelect 
}: UploadMethodSelectorProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>アップロード方法を選択</CardTitle>
        <CardDescription>
          ファイルをアップロードするか、カメラで撮影してください
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Button
            variant="outline"
            className="h-24 flex flex-col gap-2"
            onClick={onFileSelect}
          >
            <Upload className="h-6 w-6" />
            <span>ファイルから選択</span>
          </Button>
          <Button
            variant="outline"
            className="h-24 flex flex-col gap-2"
            onClick={onCameraSelect}
          >
            <Camera className="h-6 w-6" />
            <span>カメラで撮影</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}