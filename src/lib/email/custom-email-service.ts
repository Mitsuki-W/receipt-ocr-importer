// カスタムメール送信サービス
export class CustomEmailService {
  static async sendPasswordResetEmail(email: string, resetCode: string) {
    const now = new Date()
    const timestamp = now.toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Tokyo'
    })

    // メール内容のカスタマイズ
    const emailContent = {
      to: email,
      subject: `【${process.env.NEXT_PUBLIC_SITE_NAME || 'レシート管理システム'}】パスワードリセットのご依頼`,
      html: `
        <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
          <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #2563eb; margin: 0; font-size: 24px;">🔒 パスワードリセット</h1>
            </div>
            
            <p style="color: #374151; font-size: 16px; line-height: 1.6;">
              ${email} 様
            </p>
            
            <p style="color: #374151; font-size: 16px; line-height: 1.6;">
              ${process.env.NEXT_PUBLIC_SITE_NAME || 'レシート管理システム'}のパスワードリセットが依頼されました。
            </p>
            
            <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p style="margin: 5px 0; color: #374151;"><strong>📅 依頼日時:</strong> ${timestamp}</p>
              <p style="margin: 5px 0; color: #374151;"><strong>🔗 リセットコード:</strong> ${resetCode.substring(0, 8)}...</p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.NEXT_PUBLIC_SITE_URL}/reset-password?code=${resetCode}" 
                 style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); 
                        color: white; 
                        padding: 15px 30px; 
                        text-decoration: none; 
                        border-radius: 8px; 
                        font-weight: bold; 
                        display: inline-block;
                        box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);">
                🔑 パスワードをリセットする
              </a>
            </div>
            
            <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
              <h3 style="color: #92400e; margin: 0 0 10px 0; font-size: 16px;">⚠️ 重要事項</h3>
              <ul style="color: #92400e; margin: 0; padding-left: 20px; font-size: 14px;">
                <li>このリンクの有効期限は<strong>1時間</strong>です</li>
                <li>このメールに心当たりがない場合は無視してください</li>
                <li>リンクは1回のみ使用可能です</li>
                <li>セキュリティのため、パスワードは定期的に変更することを推奨します</li>
              </ul>
            </div>
            
            <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px; text-align: center;">
              <p style="color: #6b7280; font-size: 12px; margin: 0;">
                このメールは自動送信されています。<br>
                ${process.env.NEXT_PUBLIC_SITE_NAME || 'レシート管理システム'} - レシート在庫管理システム
              </p>
            </div>
          </div>
        </div>
      `
    }

    // 実際のメール送信処理をここに実装
    // 例: SendGrid, Nodemailer, Resend等を使用
    console.log('Custom email would be sent:', emailContent)
    
    return emailContent
  }
}