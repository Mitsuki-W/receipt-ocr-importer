interface SessionWarningDialogProps {
  onExtendSession: () => void
  onSignOut: () => void
}

export default function SessionWarningDialog({ 
  onExtendSession, 
  onSignOut 
}: SessionWarningDialogProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md mx-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          セッション期限警告
        </h2>
        <p className="text-gray-600 mb-6">
          あと5分でセッションが期限切れになります。
          継続する場合は「セッション延長」をクリックしてください。
        </p>
        <div className="flex gap-3">
          <button
            onClick={onExtendSession}
            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            セッション延長
          </button>
          <button
            onClick={onSignOut}
            className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition-colors"
          >
            ログアウト
          </button>
        </div>
      </div>
    </div>
  )
}