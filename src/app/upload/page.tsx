'use client'

import CameraCapture from '@/components/camera/camera-capture'
import UploadMethodSelector from '@/components/upload/upload-method-selector'
import ImagePreview from '@/components/upload/image-preview'
import OCRResults from '@/components/upload/ocr-results'
import ErrorAlert from '@/components/upload/error-alert'
import { useUpload } from '@/hooks/useUpload'

export default function UploadPage() {
  const {
    file,
    preview,
    loading,
    ocrResult,
    error,
    progress,
    selectedItems,
    showCamera,
    handleFileChange,
    processFile,
    processOCR,
    saveSelectedItems,
    toggleItemSelection,
    setShowCamera,
    resetUpload,
  } = useUpload()

  const handleCameraCapture = (capturedFile: File) => {
    processFile(capturedFile)
  }

  const handleFileSelectClick = () => {
    document.getElementById('file-input')?.click()
  }

  if (showCamera) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">レシートアップロード</h2>
          <p className="text-muted-foreground">
            レシートの写真から自動で食材を読み取ります
          </p>
        </div>
        
        <CameraCapture
          onCapture={handleCameraCapture}
          onCancel={() => setShowCamera(false)}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">レシートアップロード</h2>
        <p className="text-muted-foreground">
          レシートの写真から自動で食材を読み取ります
        </p>
      </div>

      <UploadMethodSelector
        onFileSelect={handleFileSelectClick}
        onCameraSelect={() => setShowCamera(true)}
      />

      {/* 隠しファイル入力 */}
      <input
        id="file-input"
        type="file"
        className="hidden"
        accept="image/*"
        onChange={handleFileChange}
      />

      <ImagePreview
        preview={preview}
        file={file}
        loading={loading}
        progress={progress}
        ocrResult={ocrResult}
        onProcessOCR={processOCR}
        onReset={resetUpload}
      />

      <ErrorAlert error={error} />

      {ocrResult && (
        <OCRResults
          ocrResult={ocrResult}
          selectedItems={selectedItems}
          loading={loading}
          onToggleItemSelection={toggleItemSelection}
          onSaveItems={saveSelectedItems}
          onReset={resetUpload}
        />
      )}
    </div>
  )
}