import React, { useState, useEffect } from 'react';
import {
  Student,
  AbsenceRecord,
  TransferBooking,
  ClassId,
  CodmonSyncLog
} from '../../types';
import { SOLTILO_CLASSES } from '../../data/constants';
import {
  parseCodmonDailyScreen,
  CodmonDailyParsedResult,
  CodmonDailyAbsenceItem,
  CodmonDailyTransferItem,
  formatRelativeTime,
  getCollisionSafetyInfo
} from '../../lib/codmonParser';
import { useTranslation } from '../../lib/i18n';
import {
  ClipboardPaste,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Users,
  Calendar,
  X,
  History,
  Check,
  Info,
  ArrowRight,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { toLocalDateString } from '../../lib/dateUtils';

interface CodmonDailySmartPasteModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultDate: string;
  students: Student[];
  absences: AbsenceRecord[];
  bookings: TransferBooking[];
  lastSync: CodmonSyncLog | null;
  syncLogs: CodmonSyncLog[];
  onApplySync: (result: {
    absences: CodmonDailyAbsenceItem[];
    transfers: CodmonDailyTransferItem[];
    newStudents?: Student[];
    targetDate: string;
    summary: string;
  }) => void;
}

const CodmonDailySmartPasteModalInner: React.FC<CodmonDailySmartPasteModalProps> = ({
  isOpen,
  onClose,
  defaultDate,
  students,
  absences,
  bookings,
  lastSync,
  syncLogs,
  onApplySync
}) => {
  const { language, getClassName } = useTranslation();
  const [rawText, setRawText] = useState('');
  const [overrideDate, setOverrideDate] = useState(defaultDate);
  const [parsedResult, setParsedResult] = useState<CodmonDailyParsedResult | null>(null);
  // 一括反映から外す行（欠席・振替の item.id）。解析し直すたびにリセットする
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
  const toggleExcluded = (id: string) =>
    setExcludedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const [activeTab, setActiveTab] = useState<'preview' | 'history'>('preview');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [autoRegisterNewStudents, setAutoRegisterNewStudents] = useState(true);
  const [nowTick, setNowTick] = useState<number>(Date.now());

  // Keep collision timer up-to-date every 10 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setNowTick(Date.now());
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  // Update overrideDate when defaultDate changes
  useEffect(() => {
    setOverrideDate(defaultDate);
  }, [defaultDate]);

  // Execute parsing function with performance safety
  const executeParse = (text: string, date: string) => {
    if (!text.trim()) {
      setParsedResult(null);
      setIsAnalyzing(false);
      return;
    }
    setIsAnalyzing(true);
    try {
      const result = parseCodmonDailyScreen(
        text,
        date,
        students,
        absences,
        bookings
      );
      setParsedResult(result);
      setExcludedIds(new Set());
    } catch (e) {
      console.error('CoDMON parse error:', e);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Debounce parsing to keep UI fluid on massive pastes
  useEffect(() => {
    if (!rawText.trim()) {
      setParsedResult(null);
      return;
    }
    const timer = setTimeout(() => {
      executeParse(rawText, overrideDate);
    }, 150);
    return () => clearTimeout(timer);
  }, [rawText, overrideDate, students, absences, bookings]);


  const safetyInfo = getCollisionSafetyInfo(lastSync?.timestamp, language);

  // Generate realistic sample daily text
  const handleLoadSample = () => {
    const today = new Date();
    const dateStr = overrideDate || toLocalDateString(today);
    const dObj = new Date(dateStr + 'T00:00:00');
    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
    const wName = dayNames[dObj.getDay()] || '水';

    const s1 = students[0]?.name || 'サンプル 蓮 (Ren Sample)';
    const s2 = students[1]?.name || 'サンプル エミリ (Emily Sample)';
    const s3 = students[2]?.name || 'サンプル 葵 (Aoi Sample)';
    const s4 = students[3]?.name || 'サンプル レオ (Leo Sample)';
    const s5 = students[4]?.name || 'サンプル 陽菜 (Hina Sample)';

    const sample = `【コドモン デイリー画面 ${dateStr} (${wName}) 出欠席一覧】
園児・生徒出欠状況 管理画面
対象日: ${dateStr} (${wName}曜日)

欠席	欠席期間	種別	保護者からの連絡
${s1}
今日まで	
都合欠
${s5}
8/23まで	
都合欠
発熱のためお休みします。

名前	アレルギー	出欠状況
${s4}
日誌・連絡帳
09:3009:3014:00 (母)
${s3}
日誌・連絡帳
14:0017:00 (父)`;

    setRawText(sample);
  };

  const handleClear = () => {
    setRawText('');
    setParsedResult(null);
  };

  const handleApply = () => {
    if (!parsedResult) return;

    const readyAbsences = parsedResult.absences.filter((a) => a.status === 'ready' && !excludedIds.has(a.id));
    const readyTransfers = parsedResult.transfers.filter((t) => t.status === 'ready' && !excludedIds.has(t.id));
    // 新規生徒は、反映する行（または通常出席）に含まれる人だけ登録する
    const referencedIds = new Set([
      ...readyAbsences.map((a) => a.studentId),
      ...readyTransfers.map((t) => t.studentId),
      ...(parsedResult.regulars || []).map((r) => r.studentId)
    ]);
    const newStudentsToSave = autoRegisterNewStudents
      ? parsedResult.newStudents.filter((s) => referencedIds.has(s.id))
      : [];
    const regularsCount = parsedResult.regulars?.length || 0;

    if (readyAbsences.length === 0 && readyTransfers.length === 0 && newStudentsToSave.length === 0 && regularsCount === 0) {
      alert(
        language === 'ja'
          ? '登録対象のデータ（欠席・振替・新規生徒・通常出席）が見つかりませんでした。'
          : 'No valid data to apply.'
      );
      return;
    }

    const summaryParts: string[] = [];
    if (readyAbsences.length > 0) summaryParts.push(language === 'en' ? `${readyAbsences.length} absences` : `欠席 ${readyAbsences.length}件`);
    if (readyTransfers.length > 0) summaryParts.push(language === 'en' ? `${readyTransfers.length} make-ups` : `振替 ${readyTransfers.length}件`);
    if (newStudentsToSave.length > 0) summaryParts.push(language === 'en' ? `${newStudentsToSave.length} new students registered` : `新規生徒 ${newStudentsToSave.length}名登録`);
    if (summaryParts.length === 0 && regularsCount > 0) summaryParts.push(language === 'en' ? `${regularsCount} regular attendees confirmed` : `通常出席 ${regularsCount}名確認`);

    const summary =
      language === 'ja'
        ? `${summaryParts.join('、')} を一括反映`
        : `Applied ${summaryParts.join(', ')}`;

    onApplySync({
      absences: readyAbsences,
      transfers: readyTransfers,
      newStudents: newStudentsToSave,
      targetDate: parsedResult.detectedDate,
      summary
    });

    onClose();
  };

  const readyAbsencesCount = parsedResult?.absences.filter((a) => a.status === 'ready' && !excludedIds.has(a.id)).length || 0;
  const readyTransfersCount = parsedResult?.transfers.filter((t) => t.status === 'ready' && !excludedIds.has(t.id)).length || 0;
  const newStudentsCount = parsedResult?.newStudents?.length || 0;
  const regularsCount = parsedResult?.regulars?.length || 0;
  const totalApplyableCount = readyAbsencesCount + readyTransfersCount + (autoRegisterNewStudents ? newStudentsCount : 0);

  return (
    <div
      id="codmon-daily-smart-paste-modal"
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
    >
      <div
        className="bg-white rounded-3xl shadow-2xl border border-slate-200/90 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden text-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/40 border border-indigo-400/40 text-amber-300 flex items-center justify-center font-black shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base sm:text-lg font-black tracking-tight">
                  {language === 'ja'
                    ? 'コドモン デイリー画面 全選択ペースト（自動解析）'
                    : 'CoDMON Daily Screen Smart Paste'}
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500 text-white">
                  AI Smart Parser
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                {language === 'ja'
                  ? 'コドモン画面を全選択(Ctrl+A)して貼り付けるだけで、欠席・振替・出席を自動判別します'
                  : 'Paste entire copied CoDMON daily view to automatically extract absences & make-ups'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setActiveTab(activeTab === 'preview' ? 'history' : 'preview')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 border ${
                activeTab === 'history'
                  ? 'bg-amber-400 text-slate-900 border-amber-400'
                  : 'bg-slate-800 text-slate-300 hover:text-white border-slate-700'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>{language === 'ja' ? '更新履歴' : 'Sync Logs'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Real-time Collision Guard & Last Updated Status Banner */}
        <div
          className={`px-4 sm:px-6 py-2.5 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs transition-colors ${
            safetyInfo.level === 'collision_warning'
              ? 'bg-amber-50 border-amber-200 text-amber-900'
              : safetyInfo.level === 'recent'
              ? 'bg-sky-50 border-sky-200 text-sky-900'
              : 'bg-slate-50 border-slate-200 text-slate-700'
          }`}
        >
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 shrink-0 text-slate-500" />
            <span className="font-bold">
              {language === 'ja' ? '最終アップデート:' : 'Last Synced:'}
            </span>
            <span
              className={`px-2 py-0.5 rounded-full font-black text-[11px] ${safetyInfo.badgeBg}`}
            >
              {safetyInfo.relativeText} ({safetyInfo.exactTimeText})
            </span>
            {lastSync?.updatedBy && (
              <span className="text-[11px] text-slate-500">
                {language === 'en' ? `By: ${lastSync.updatedBy}` : `担当: ${lastSync.updatedBy}`}
              </span>
            )}
          </div>

          {safetyInfo.warningMessage ? (
            <div className="flex items-center space-x-1.5 font-bold text-[11px] text-amber-800 bg-amber-100/80 px-2.5 py-1 rounded-lg border border-amber-300">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
              <span>{safetyInfo.warningMessage}</span>
            </div>
          ) : (
            <div className="flex items-center space-x-1.5 text-[11px] text-emerald-700 font-bold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>
                {language === 'ja'
                  ? '直近の衝突はありません（安全に更新可能）'
                  : 'No recent updates (Safe to sync)'}
              </span>
            </div>
          )}
        </div>

        {/* Main Content Body */}
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
          {activeTab === 'history' ? (
            /* Sync Logs History Tab */
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <History className="w-4 h-4 text-indigo-600" />
                  <span>{language === 'ja' ? 'コドモン同期・更新履歴' : 'CoDMON Sync History'}</span>
                </h4>
                <span className="text-xs text-slate-500">
                  {syncLogs.length} {language === 'ja' ? '件のログ' : 'logs recorded'}
                </span>
              </div>

              {syncLogs.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs">
                  {language === 'ja'
                    ? 'まだ同期履歴がありません。'
                    : 'No sync history recorded yet.'}
                </div>
              ) : (
                <div className="space-y-2">
                  {syncLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                    >
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-extrabold text-slate-900">
                            {log.summary}
                          </span>
                          <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded font-bold text-[10px]">
                            {language === 'en' ? `Date: ${log.targetDate}` : `対象日: ${log.targetDate}`}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">
                          {language === 'en'
                            ? `By: ${log.updatedBy} · Absences: ${log.absencesCount} / Make-ups: ${log.transfersCount}`
                            : `担当: ${log.updatedBy} ・ 欠席: ${log.absencesCount}件 / 振替: ${log.transfersCount}件`}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-black text-slate-700">
                          {formatRelativeTime(log.timestamp, language)}
                        </span>
                        <div className="text-[10px] text-slate-400">
                          {new Date(log.timestamp).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Smart Paste & Live Analysis Preview */
            <div className="space-y-4">
              {/* Single Cell Paste Area */}
              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <label className="text-xs font-black text-slate-800 flex items-center space-x-1.5">
                      <ClipboardPaste className="w-4 h-4 text-indigo-600" />
                      <span>
                        {language === 'ja'
                          ? '1. コドモン デイリー画面テキストを全選択して貼り付け (ひとつのセル)'
                          : '1. Paste Entire CoDMON Daily Text Here (Single Paste Area)'}
                      </span>
                    </label>
                    {rawText.length > 0 && (
                      <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full font-mono">
                        {language === 'en'
                          ? `${rawText.length.toLocaleString()} chars / ${rawText.split(/\r\n|\n|\r/).length} lines`
                          : `${rawText.length.toLocaleString()} 文字 / ${rawText.split(/\r\n|\n|\r/).length} 行`}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-2">
                    {rawText.length > 0 && (
                      <button
                        type="button"
                        onClick={() => executeParse(rawText, overrideDate)}
                        disabled={isAnalyzing}
                        className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg transition border border-indigo-200 flex items-center space-x-1"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                        <span>{isAnalyzing ? (language === 'en' ? 'Analyzing...' : '解析中...') : language === 'ja' ? '即時再解析' : 'Re-analyze'}</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleLoadSample}
                      className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold rounded-lg transition border border-amber-200 flex items-center space-x-1"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                      <span>{language === 'ja' ? 'サンプル読込' : 'Load Sample'}</span>
                    </button>

                    {rawText && (
                      <button
                        type="button"
                        onClick={handleClear}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-lg transition"
                      >
                        {language === 'ja' ? 'クリア' : 'Clear'}
                      </button>
                    )}
                  </div>
                </div>

                <div className="relative">
                  <textarea
                    id="codmon-daily-paste-textarea"
                    rows={6}
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    placeholder={
                      language === 'ja'
                        ? 'コドモン画面で「Ctrl+A (全選択)」→「Ctrl+C (コピー)」したテキストをここに貼り付けてください (Ctrl+V)&#10;500行以上の大量データ・全園児画面でも高速に解析されます。&#10;例: 2026年8月19日(水) / 欠席テーブル / 保護者連絡'
                        : 'Select all on CoDMON daily screen (Ctrl+A -> Ctrl+C) and paste here (Ctrl+V)...'
                    }
                    className="w-full p-3 bg-slate-50 border-2 border-dashed border-indigo-200 focus:border-indigo-500 rounded-2xl text-xs font-mono focus:bg-white focus:outline-none transition leading-relaxed"
                  />
                </div>
              </div>

              {/* Target Date override & Parse Summary */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                  <Calendar className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span className="font-bold text-slate-700">
                    {language === 'ja' ? '解析対象日:' : 'Target Date:'}
                  </span>
                  <input
                    type="date"
                    value={overrideDate}
                    onChange={(e) => setOverrideDate(e.target.value)}
                    className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 shadow-2xs"
                  />
                  {parsedResult && parsedResult.detectedDate !== overrideDate && (
                    <span className="text-[11px] text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded font-bold">
                      {language === 'en' ? `Date found in text: ${parsedResult.detectedDate}` : `テキスト内検出日: ${parsedResult.detectedDate}`}
                    </span>
                  )}
                </div>

                {parsedResult && (
                  <div className="flex items-center space-x-2 font-bold text-slate-700 flex-wrap gap-y-1">
                    <span className="text-slate-500">{language === 'ja' ? '解析結果:' : 'Parsed:'}</span>
                    <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded font-black">
                      {language === 'en' ? `Absences: ${parsedResult.absences.length}` : `欠席 ${parsedResult.absences.length}件`}
                    </span>
                    <span className="px-2 py-0.5 bg-sky-100 text-sky-800 rounded font-black">
                      {language === 'en' ? `Make-ups: ${parsedResult.transfers.length}` : `振替 ${parsedResult.transfers.length}件`}
                    </span>
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-black">
                      {language === 'en' ? `Present: ${parsedResult.regulars.length}` : `登園・出席 ${parsedResult.regulars.length}名`}
                    </span>
                    {newStudentsCount > 0 && (
                      <span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded font-black">
                        {language === 'en' ? `New students: ${newStudentsCount}` : `新規生徒 ${newStudentsCount}名`}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* New Students Auto-registration Card */}
              {parsedResult && newStudentsCount > 0 && (
                <div className="p-3 bg-purple-50/80 border border-purple-200 rounded-2xl flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center space-x-2">
                    <Users className="w-4 h-4 text-purple-600 shrink-0" />
                    <div>
                      <span className="font-extrabold text-purple-900">
                        {language === 'ja'
                          ? `名簿未登録の生徒を ${newStudentsCount} 名 検出しました`
                          : `Detected ${newStudentsCount} new students not in roster`}
                      </span>
                      <p className="text-[11px] text-purple-700 mt-0.5">
                        {language === 'ja'
                          ? '一括反映時に名簿へ新規生徒として自動登録し、欠席・振替チケットを正しく紐付けます。'
                          : 'Auto-register newly found students and link their attendance & transfer credits.'}
                      </p>
                    </div>
                  </div>

                  <label className="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-xl border border-purple-200 cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={autoRegisterNewStudents}
                      onChange={(e) => setAutoRegisterNewStudents(e.target.checked)}
                      className="w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500"
                    />
                    <span className="font-bold text-slate-800 text-[11px]">
                      {language === 'ja' ? '名簿に自動登録' : 'Auto-register'}
                    </span>
                  </label>
                </div>
              )}

              {/* Parsed Result Preview */}
              {parsedResult && (
                <div className="space-y-3 pt-2">
                  {/* Warnings if any */}
                  {parsedResult.warnings.map((w, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center space-x-2 text-xs text-amber-900 font-bold"
                    >
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>{w}</span>
                    </div>
                  ))}

                  {/* 1. Absences Table */}
                  {parsedResult.absences.length > 0 && (
                    <div className="bg-white border border-rose-200 rounded-2xl overflow-hidden shadow-xs">
                      <div className="bg-rose-50 px-4 py-2.5 border-b border-rose-200 flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="w-2 h-2 rounded-full bg-rose-600" />
                          <h5 className="text-xs font-black text-rose-900">
                            {language === 'ja' ? '🔴 欠席連絡（欠席登録 ＆ 振替チケット+1付与）' : '🔴 Absences (Grant +1 Credit)'}
                          </h5>
                        </div>
                        <span className="text-[11px] font-bold text-rose-700">
                          {parsedResult.absences.length} {language === 'ja' ? '件検出' : 'detected'}
                        </span>
                      </div>

                      <div className="max-h-36 overflow-y-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-100 sticky top-0">
                            <tr>
                              <th className="py-2 px-3">{language === 'en' ? 'Status' : '判定'}</th>
                              <th className="py-2 px-3">{language === 'en' ? 'Student' : '生徒名'}</th>
                              <th className="py-2 px-3">{language === 'en' ? 'Class' : 'クラス'}</th>
                              <th className="py-2 px-3">{language === 'en' ? 'Reason / Note' : '理由・メモ'}</th>
                              <th className="py-2 px-3">{language === 'en' ? 'Action' : '反映アクション'}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {parsedResult.absences.map((item, idx) => (
                              <tr key={idx} className="hover:bg-slate-50">
                                <td className="py-1.5 px-3">
                                  {item.status === 'ready' ? (
                                    <label className="flex items-center gap-1.5 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={!excludedIds.has(item.id)}
                                        onChange={() => toggleExcluded(item.id)}
                                        aria-label={language === 'en' ? `Apply ${item.studentName}` : `${item.studentName} を反映する`}
                                        className="w-3.5 h-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                      />
                                      <span className={excludedIds.has(item.id) ? 'text-slate-400 font-bold' : 'text-emerald-700 font-bold'}>
                                        {excludedIds.has(item.id) ? (language === 'ja' ? '反映しない' : 'Skip') : (language === 'ja' ? '反映可' : 'Apply')}
                                      </span>
                                    </label>
                                  ) : (
                                    <span className="text-slate-400 font-medium">{language === 'en' ? 'Already registered (skipped)' : '登録済スキップ'}</span>
                                  )}
                                </td>
                                <td className="py-1.5 px-3 font-black text-slate-900">
                                  <span>{item.studentName}</span>
                                  {item.isNewStudent && (
                                    <span className="ml-1.5 px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-[10px] font-bold">
                                      {language === 'en' ? 'New' : '新規'}
                                    </span>
                                  )}
                                </td>
                                <td className="py-1.5 px-3 text-slate-600">{getClassName(item.classId)}</td>
                                <td className="py-1.5 px-3 text-slate-700">{item.reason}</td>
                                <td className="py-1.5 px-3 text-[11px] text-rose-700 font-bold">{item.message}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* 2. Transfers Table */}
                  {parsedResult.transfers.length > 0 && (
                    <div className="bg-white border border-sky-200 rounded-2xl overflow-hidden shadow-xs">
                      <div className="bg-sky-50 px-4 py-2.5 border-b border-sky-200 flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="w-2 h-2 rounded-full bg-sky-600" />
                          <h5 className="text-xs font-black text-sky-900">
                            {language === 'ja' ? '🔵 振替受講（振替予約登録 ＆ 振替残数-1）' : '🔵 Transfers (Book Make-up & Deduct Credit)'}
                          </h5>
                        </div>
                        <span className="text-[11px] font-bold text-sky-700">
                          {parsedResult.transfers.length} {language === 'ja' ? '件検出' : 'detected'}
                        </span>
                      </div>

                      <div className="max-h-36 overflow-y-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-100 sticky top-0">
                            <tr>
                              <th className="py-2 px-3">{language === 'en' ? 'Status' : '判定'}</th>
                              <th className="py-2 px-3">{language === 'en' ? 'Student' : '生徒名'}</th>
                              <th className="py-2 px-3">{language === 'en' ? 'Class' : '受講クラス'}</th>
                              <th className="py-2 px-3">{language === 'en' ? 'Note' : '備考'}</th>
                              <th className="py-2 px-3">{language === 'en' ? 'Action' : '反映アクション'}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {parsedResult.transfers.map((item, idx) => (
                              <tr key={idx} className="hover:bg-slate-50">
                                <td className="py-1.5 px-3">
                                  {item.status === 'ready' ? (
                                    <label className="flex items-center gap-1.5 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={!excludedIds.has(item.id)}
                                        onChange={() => toggleExcluded(item.id)}
                                        aria-label={language === 'en' ? `Apply ${item.studentName}` : `${item.studentName} を反映する`}
                                        className="w-3.5 h-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                      />
                                      <span className={excludedIds.has(item.id) ? 'text-slate-400 font-bold' : 'text-emerald-700 font-bold'}>
                                        {excludedIds.has(item.id) ? (language === 'ja' ? '反映しない' : 'Skip') : (language === 'ja' ? '予約可' : 'Book')}
                                      </span>
                                    </label>
                                  ) : (
                                    <span className="text-slate-400 font-medium">{language === 'en' ? 'Already booked (skipped)' : '予約済スキップ'}</span>
                                  )}
                                </td>
                                <td className="py-1.5 px-3 font-black text-slate-900">
                                  <span>{item.studentName}</span>
                                  {item.isNewStudent && (
                                    <span className="ml-1.5 px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-[10px] font-bold">
                                      {language === 'en' ? 'New' : '新規'}
                                    </span>
                                  )}
                                </td>
                                <td className="py-1.5 px-3 text-slate-600">{getClassName(item.targetClassId)}</td>
                                <td className="py-1.5 px-3 text-slate-700">{item.note}</td>
                                <td className="py-1.5 px-3 text-[11px] text-sky-700 font-bold">{item.message}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* 3. Regular Attendance Preview */}
                  {parsedResult.regulars.length > 0 && (
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>
                            {language === 'ja' ? '通常出席確認生' : 'Regular Attendees'}: {parsedResult.regulars.length}{language === 'en' ? '' : '名'}
                          </span>
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {parsedResult.regulars.map((r, idx) => (
                          <span
                            key={idx}
                            className="bg-white border border-slate-200 text-slate-700 text-[11px] px-2 py-0.5 rounded-md font-medium"
                          >
                            {r.studentName}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="bg-slate-100 p-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-600">
            {parsedResult ? (
              <span className="flex items-center space-x-2 flex-wrap gap-y-1">
                <span>{language === 'en' ? 'To apply:' : '反映対象:'}</span>
                <strong className="text-rose-600">{language === 'en' ? `Absences ${readyAbsencesCount}` : `欠席 ${readyAbsencesCount}件`}</strong>
                <span>/</span>
                <strong className="text-sky-600">{language === 'en' ? `Make-ups ${readyTransfersCount}` : `振替 ${readyTransfersCount}件`}</strong>
                {autoRegisterNewStudents && newStudentsCount > 0 && (
                  <>
                    <span>/</span>
                    <strong className="text-purple-600">{language === 'en' ? `New students ${newStudentsCount}` : `新規生徒 ${newStudentsCount}名`}</strong>
                  </>
                )}
                {regularsCount > 0 && (
                  <>
                    <span>/</span>
                    <strong className="text-emerald-700">{language === 'en' ? `Present ${regularsCount}` : `出席 ${regularsCount}名`}</strong>
                  </>
                )}
              </span>
            ) : (
              <span>{language === 'en' ? 'Paste text to start automatic analysis' : 'テキストを貼り付けると自動解析が開始されます'}</span>
            )}
          </div>

          <div className="flex items-center space-x-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-300 hover:bg-slate-50 transition"
            >
              {language === 'ja' ? '閉じる' : 'Close'}
            </button>

            <button
              type="button"
              id="codmon-daily-apply-btn"
              onClick={handleApply}
              disabled={!parsedResult || parsedResult.totalParsed === 0}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-black rounded-xl shadow-sm transition flex items-center space-x-1.5"
            >
              <Check className="w-4 h-4" />
              <span>
                {language === 'ja'
                  ? `分析結果を一括反映する (${totalApplyableCount > 0 ? `${totalApplyableCount}件` : `出欠確認 ${regularsCount}名`})`
                  : `Apply Analyzed Records (${totalApplyableCount > 0 ? totalApplyableCount : regularsCount})`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// フックを常に同じ順で呼ぶため、開いている間だけ中身をマウントする（閉じるたびに入力状態もリセットされる）
export const CodmonDailySmartPasteModal: React.FC<CodmonDailySmartPasteModalProps> = (props) => (props.isOpen ? <CodmonDailySmartPasteModalInner {...props} /> : null);
