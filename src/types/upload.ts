// アップロード機能関連の型定義

export interface ExtractedItem {
  name: string
  price?: number
  quantity?: number
  category?: string
  currency?: string
}

export interface OCRResult {
  success: boolean
  extractedText: string
  items: ExtractedItem[]
}

export interface UploadState {
  file: File | null
  preview: string | null
  loading: boolean
  ocrResult: OCRResult | null
  error: string
  progress: number
  selectedItems: Set<number>
  showCamera: boolean
}

export interface UploadActions {
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  processFile: (file: File) => void
  processOCR: () => Promise<void>
  saveSelectedItems: () => Promise<void>
  toggleItemSelection: (index: number) => void
  setShowCamera: (show: boolean) => void
  setError: (error: string) => void
  resetUpload: () => void
}

export interface UploadHookReturn extends UploadState, UploadActions {}