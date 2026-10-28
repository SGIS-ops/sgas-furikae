import React, { useState } from 'react';
import { GoogleSheetsConfig, Student, AbsenceRecord, TransferBooking, DailyClassOverride } from '../types';
import { requestAccessToken, createSpreadsheet, syncDataToGoogleSheet } from '../lib/googleSheets';
import { X, FileSpreadsheet, Key, RefreshCw, CheckCircle2, ExternalLink, AlertCircle } from 'lucide-react';
import { useTranslation } from '../lib/i18n';

interface GoogleSheetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  sheetsConfig: GoogleSheetsConfig;
  onSaveSheetsConfig: (config: GoogleSheetsConfig) => void;
  /** シート → アプリ: 生徒マスタの読み込み（接続済みのときのみ表示） */
  onImportFromSheet?: () => Promise<void>;
  /** サーバー版: データ保存先のスプレッドシート（自動で書き出される） */
  remoteSpreadsheetUrl?: string;
  data: {
    students: Student[];
    absences: AbsenceRecord[];
    bookings: TransferBooking[];
    overrides: DailyClassOverride[];
  };
}

const GoogleSheetsModalInner: React.FC<GoogleSheetsModalProps> = ({
  isOpen,
  onClose,
  sheetsConfig,
  onSaveSheetsConfig,
  onImportFromSheet,
  remoteSpreadsheetUrl,
  data
}) => {
  const { language } = useTranslation();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [existingId, setExistingId] = useState('');

  const handleCreateAndConnect = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // 1. Request access token via GSI OAuth
      const token = await requestAccessToken();

      // 2. Create Spreadsheet
      const sheet = await createSpreadsheet(token);

      // 3. Initial Sync
      await syncDataToGoogleSheet(token, sheet.id, data);

      const newConfig: GoogleSheetsConfig = {
        spreadsheetId: sheet.id,
        spreadsheetUrl: sheet.url,
        lastSyncedAt: new Date().toISOString(),
        autoSync: true
      };

      onSaveSheetsConfig(newConfig);
      setSuccessMsg(language === 'en' ? 'Google Sheets created and initial sync completed!' : 'Googleスプレッドシートの作成・初期同期が完了しました！');
      setTimeout(() => {
        setIsLoading(false);
        setSuccessMsg(null);
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error(err);
      setError(err.message || (language === 'en' ? 'Failed to connect to Google Sheets.' : 'Googleスプレッドシートとの連携に失敗しました。'));
      setIsLoading(false);
    }
  };

  const handleLinkExisting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!existingId.trim()) return;

    setIsLoading(true);
    setError(null);
    try {
      const token = await requestAccessToken();
      const cleanId = existingId.trim();

      await syncDataToGoogleSheet(token, cleanId, data);

      const newConfig: GoogleSheetsConfig = {
        spreadsheetId: cleanId,
        spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${cleanId}/edit`,
        lastSyncedAt: new Date().toISOString(),
        autoSync: true
      };

      onSaveSheetsConfig(newConfig);
      setSuccessMsg(language === 'en' ? 'Sync to the existing spreadsheet completed!' : '既存スプレッドシートへの同期が完了しました！');
      setTimeout(() => {
        setIsLoading(false);
        setSuccessMsg(null);
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error(err);
      setError(err.message || (language === 'en' ? 'Failed to verify or sync the spreadsheet ID.' : 'スプレッドシートIDの検証・同期に失敗しました。'));
      setIsLoading(false);
    }
  };

  // サーバー版: OAuth 設定は不要。保存のたびにサーバーがスプレッドシートへ書き出す
  if (remoteSpreadsheetUrl !== undefined) {
    const L = (ja: string, en: string) => (language === 'en' ? en : ja);
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
        <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden">
          <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
            <h2 className="text-base font-bold flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
              {L('Googleスプレッドシート', 'Google Sheets')}
            </h2>
            <button onClick={onClose} aria-label={L('閉じる', 'Close')} className="text-slate-400 hover:text-white p-1.5 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-6 space-y-4 text-xs text-slate-700">
            {error && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-3 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            <p>
              {L(
                'データはすべてこのスプレッドシートに保存され、変更のたびに「生徒マスタ」「欠席履歴」「振替予約」シートが自動で更新されます。',
                'All data is stored in this spreadsheet. The Student Master, Absence and Make-up sheets update automatically after every change.'
              )}
            </p>
            {remoteSpreadsheetUrl && (
              <a
                href={remoteSpreadsheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                <span>{L('スプレッドシートを開く', 'Open the spreadsheet')}</span>
              </a>
            )}
            {onImportFromSheet && (
              <div className="border-t border-slate-200 pt-4 space-y-2">
                <p className="font-bold text-slate-900">{L('「名簿取込」シートから名簿を読み込む', 'Import students from the roster import sheet')}</p>
                <p>
                  {L(
                    '「名簿取込」シートに入力した生徒を追加・更新します（IDのある行は既存の生徒を更新）。取り込んだ行はシートから消えます。',
                    'Adds or updates the students entered in the import sheet (rows with an ID update existing students). Imported rows are cleared from the sheet.'
                  )}
                </p>
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={async () => {
                    setIsLoading(true);
                    setError(null);
                    try {
                      await onImportFromSheet();
                      onClose();
                    } catch (err: any) {
                      setError(err.message || String(err));
                    } finally {
                      setIsLoading(false);
                    }
                  }}
                  className="w-full bg-sky-600 hover:bg-sky-700 disabled:bg-slate-300 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                  <span>{L('名簿を読み込む', 'Import roster')}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">{language === 'en' ? 'Google Sheets Integration' : 'Googleスプレッドシート連携'}</h2>
              <p className="text-xs text-slate-300">Google Workspace Skill Integration</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        {successMsg ? (
          <div className="p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <p className="text-base font-bold text-slate-800">{successMsg}</p>
          </div>
        ) : (
          <div className="p-6 space-y-6 text-xs">
            
            {error && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-3 flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* 接続済み: シート → アプリの読み込み（双方向同期） */}
            {sheetsConfig.spreadsheetId && onImportFromSheet && (
              <div className="bg-sky-50/60 border border-sky-200 rounded-2xl p-5 space-y-3">
                <h3 className="font-bold text-slate-900 text-sm">{language === 'en' ? 'Import Student Master from Spreadsheet' : 'スプレッドシートから生徒マスタを読み込む'}</h3>
                <p className="text-slate-600">
                  {language === 'en'
                    ? 'Applies the names, classes, weekdays, remaining tickets, and notes edited in the "生徒マスタ" (Student Master) sheet to the app. Students with a matching ID are updated; students not in the sheet are not deleted. You will confirm the count before applying.'
                    : '「生徒マスタ」シートで編集した氏名・クラス・通塾曜日・チケット残数・備考をアプリに反映します。 IDが一致する生徒を更新し、シートにない生徒は削除しません。反映前に件数を確認します。'}
                </p>
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={async () => {
                    setIsLoading(true);
                    setError(null);
                    try {
                      await onImportFromSheet();
                    } catch (err: any) {
                      setError(err.message || (language === 'en' ? 'Import failed' : '読み込みに失敗しました'));
                    } finally {
                      setIsLoading(false);
                    }
                  }}
                  className="w-full bg-sky-600 hover:bg-sky-700 disabled:bg-slate-300 text-white font-bold py-3 px-4 rounded-xl shadow transition flex items-center justify-center space-x-2"
                >
                  {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  <span>{language === 'en' ? 'Import Sheet → App' : 'シート → アプリへ読み込む'}</span>
                </button>
              </div>
            )}

            {/* Option A: Create New Spreadsheet */}
            <div className="bg-emerald-50/60 border border-emerald-200 rounded-2xl p-5 space-y-3">
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <h3 className="font-bold text-slate-900 text-sm">
                  {language === 'en' ? '1. Create a new spreadsheet in one click' : '1. ワンクリックで新規スプレッドシートを作成'}
                </h3>
              </div>
              <p className="text-slate-600">
                {language === 'en' ? 'Sign in with your Google account to automatically create the "SOLTILO GSA アフタースクール 振替管理表" (make-up management sheet) in Google Drive and sync data.' : 'Googleアカウント認証を行い、「SOLTILO GSA アフタースクール 振替管理表」をGoogle Drive内に自動作成・データ同期します。'}
              </p>

              <button
                type="button"
                disabled={isLoading}
                onClick={handleCreateAndConnect}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold py-3 px-4 rounded-xl shadow transition flex items-center justify-center space-x-2"
              >
                {isLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <FileSpreadsheet className="w-4 h-4" />
                )}
                <span>{language === 'en' ? 'Sign in with Google & Create' : 'Googleアカウントでログインして新規作成'}</span>
              </button>
            </div>

            {/* Option B: Link Existing Sheet */}
            <form onSubmit={handleLinkExisting} className="pt-3 border-t border-slate-100 space-y-3">
              <h3 className="font-bold text-slate-800">
                {language === 'en' ? '2. Link an existing spreadsheet by ID' : '2. 既存のスプレッドシートIDを指定して紐付け'}
              </h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder={language === 'en' ? 'Spreadsheet ID (e.g. 1BxiMVs0XRA5nFMdKbB...)' : 'スプレッドシートID (例: 1BxiMVs0XRA5nFMdKbB...)'}
                  value={existingId}
                  onChange={(e) => setExistingId(e.target.value)}
                  className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                />
                <button
                  type="submit"
                  disabled={isLoading || !existingId.trim()}
                  className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-bold px-4 py-2 rounded-xl"
                >
                  {language === 'en' ? 'Link' : '連携'}
                </button>
              </div>
            </form>

          </div>
        )}

      </div>
    </div>
  );
};

// フックを常に同じ順で呼ぶため、開いている間だけ中身をマウントする（閉じるたびに入力状態もリセットされる）
export const GoogleSheetsModal: React.FC<GoogleSheetsModalProps> = (props) => (props.isOpen ? <GoogleSheetsModalInner {...props} /> : null);
