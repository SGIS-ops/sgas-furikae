import React, { useState, useRef } from 'react';
import { Student, AbsenceRecord, ClassId } from '../../types';
import { SOLTILO_CLASSES } from '../../data/constants';
import {
  parseCodmonStudents,
  parseCodmonAbsences,
  CodmonStudentParsedRow,
  CodmonAbsenceParsedRow
} from '../../lib/codmonParser';
import {
  Upload,
  CheckCircle2,
  AlertCircle,
  Users,
  Calendar,
  Sparkles,
  ArrowRight,
  Download,
  ClipboardPaste,
  FileText,
  Check,
  ChevronRight,
  RefreshCw,
  Info
} from 'lucide-react';
import { toLocalDateString } from '../../lib/dateUtils';
import { useTranslation } from '../../lib/i18n';

interface CodmonIntegrationPanelProps {
  students: Student[];
  absences: AbsenceRecord[];
  onImportStudents: (
    importedList: CodmonStudentParsedRow[],
    mode: 'merge' | 'replace'
  ) => void;
  onImportAbsences: (
    importedAbsences: CodmonAbsenceParsedRow[]
  ) => void;
}

export const CodmonIntegrationPanel: React.FC<CodmonIntegrationPanelProps> = ({
  students,
  absences,
  onImportStudents,
  onImportAbsences
}) => {
  const { language } = useTranslation();
  // Selected Card Action: null = show main selection cards, 'students' = roster card, 'absences' = attendance card, 'export' = export card
  const [selectedAction, setSelectedAction] = useState<'students' | 'absences' | 'export' | null>(null);

  // Student Import State
  const [studentRawText, setStudentRawText] = useState('');
  const [studentParsed, setStudentParsed] = useState<CodmonStudentParsedRow[]>([]);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [isStudentDragOver, setIsStudentDragOver] = useState(false);

  // Absence Import State
  const [absenceRawText, setAbsenceRawText] = useState('');
  const [absenceParsed, setAbsenceParsed] = useState<CodmonAbsenceParsedRow[]>([]);
  const [isAbsenceDragOver, setIsAbsenceDragOver] = useState(false);

  const [notification, setNotification] = useState<{ type: 'success' | 'info'; message: string } | null>(null);

  const studentFileInputRef = useRef<HTMLInputElement>(null);
  const absenceFileInputRef = useRef<HTMLInputElement>(null);

  const showNotification = (type: 'success' | 'info', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  // Sample data generators
  const handleLoadSampleStudents = () => {
    const sample = `園児名,クラス,通学曜日,保護者名,メールアドレス,振替残数
サンプル 陽翔 (Haruto Sample),Kinder,月・水,サンプル 保護者,sample.haruto@example.com,1
サンプル 結衣 (Yui Sample),Extension,火・木,サンプル 保護者,sample.yui@example.com,2
サンプル 陸 (Riku Sample),E1,水・金,サンプル 保護者,sample.riku@example.com,0
サンプル 湊 (Minato Sample),E2,月・木,サンプル 保護者,sample.minato@example.com,3
サンプル 咲茉 (Ema Sample),Kinder,火・金,サンプル 保護者,sample.ema@example.com,1`;
    setStudentRawText(sample);
    const parsed = parseCodmonStudents(sample, students);
    setStudentParsed(parsed);
    showNotification('info', language === 'en' ? 'Sample student roster loaded. Please check the preview below.' : 'サンプル生徒名簿を読み込みました。下のプレビューをご確認ください。');
  };

  const handleLoadSampleAbsences = () => {
    const today = new Date();
    const d1 = toLocalDateString(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2));
    const d2 = toLocalDateString(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 4));
    
    const name1 = students[0]?.name || 'サンプル 蓮 (Ren Sample)';
    const name2 = students[1]?.name || 'サンプル 葵 (Aoi Sample)';

    const sample = `日付,園児名,欠席理由
${d1},${name1},体調不良（発熱のため）
${d2},${name2},学校行事（修学旅行のため）`;
    setAbsenceRawText(sample);
    const parsed = parseCodmonAbsences(sample, students, absences);
    setAbsenceParsed(parsed);
    showNotification('info', language === 'en' ? 'Sample absence notices loaded. Please check the preview below.' : 'サンプル欠席連絡を読み込みました。下のプレビューをご確認ください。');
  };

  const handleStudentTextChange = (text: string) => {
    setStudentRawText(text);
    if (!text.trim()) {
      setStudentParsed([]);
      return;
    }
    const parsed = parseCodmonStudents(text, students);
    setStudentParsed(parsed);
  };

  const handleAbsenceTextChange = (text: string) => {
    setAbsenceRawText(text);
    if (!text.trim()) {
      setAbsenceParsed([]);
      return;
    }
    const parsed = parseCodmonAbsences(text, students, absences);
    setAbsenceParsed(parsed);
  };

  const handleStudentFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (text) {
        handleStudentTextChange(text);
        showNotification('info', language === 'en' ? `Loaded file "${file.name}"` : `ファイル「${file.name}」を読み込みました`);
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  const handleAbsenceFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (text) {
        handleAbsenceTextChange(text);
        showNotification('info', language === 'en' ? `Loaded file "${file.name}"` : `ファイル「${file.name}」を読み込みました`);
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  const handleApplyStudents = () => {
    if (studentParsed.length === 0) return;
    onImportStudents(studentParsed, importMode);
    showNotification('success', language === 'en' ? `Roster updated with ${studentParsed.length} students!` : `生徒名簿 ${studentParsed.length} 名の反映が完了しました！`);
    setStudentRawText('');
    setStudentParsed([]);
    setSelectedAction(null);
  };

  const handleApplyAbsences = () => {
    const readyItems = absenceParsed.filter((a) => a.status === 'ready');
    if (readyItems.length === 0) {
      alert(language === 'en' ? 'No absence data ready to register.' : '登録可能な欠席データがありません。');
      return;
    }
    onImportAbsences(readyItems);
    showNotification('success', language === 'en' ? `Applied ${readyItems.length} absence notices and granted make-up tickets!` : `欠席連絡 ${readyItems.length} 件を反映し振替チケットを付与しました！`);
    setAbsenceRawText('');
    setAbsenceParsed([]);
    setSelectedAction(null);
  };

  const handleExportStudentsCSV = () => {
    const headers = ['園児名', 'クラス', '通学曜日', '振替残数', '保護者名', 'メールアドレス', 'ログインID'];
    const rows = students.map((s) => {
      const cls = SOLTILO_CLASSES.find((c) => c.id === s.classId)?.jpName || s.classId;
      const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
      const daysStr = s.regularDays.map((d) => dayNames[d]).join('・');
      return [
        `"${s.name}"`,
        `"${cls}"`,
        `"${daysStr}"`,
        s.transferBalance,
        `"${s.parentName}"`,
        `"${s.contactEmail}"`,
        `"${s.loginId || ''}"`
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `SOLTILO_生徒名簿_${toLocalDateString(new Date())}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showNotification('success', language === 'en' ? 'Student roster CSV downloaded' : '生徒名簿CSVをダウンロードしました');
  };

  const handleExportAbsencesCSV = () => {
    const headers = ['欠席日', '園児名', 'クラス', '欠席理由', '登録日時', '振替チケット付与'];
    const rows = absences.map((a) => {
      const cls = SOLTILO_CLASSES.find((c) => c.id === a.classId)?.jpName || a.classId;
      return [
        `"${a.date}"`,
        `"${a.studentName}"`,
        `"${cls}"`,
        `"${a.reason}"`,
        `"${a.reportedAt}"`,
        a.creditGranted ? '付与済' : '無'
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `SOLTILO_欠席履歴_${toLocalDateString(new Date())}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showNotification('success', language === 'en' ? 'Absence history CSV downloaded' : '欠席履歴CSVをダウンロードしました');
  };

  return (
    <div className="space-y-6">

      {/* Toast Notification */}
      {notification && (
        <div
          className={`p-3.5 rounded-2xl flex items-center justify-between shadow-xs transition-all ${
            notification.type === 'success'
              ? 'bg-emerald-700 text-white'
              : 'bg-indigo-700 text-white'
          }`}
        >
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span className="text-xs sm:text-sm font-bold">{notification.message}</span>
          </div>
        </div>
      )}

      {/* 3 Main Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Card 1: Student Roster Import */}
        <button
          type="button"
          onClick={() => setSelectedAction(selectedAction === 'students' ? null : 'students')}
          className={`text-left p-5 rounded-2xl border transition flex flex-col justify-between ${
            selectedAction === 'students'
              ? 'bg-indigo-50/80 border-indigo-500 ring-2 ring-indigo-500 shadow-sm'
              : 'bg-white hover:bg-slate-50/80 border-slate-200 shadow-xs'
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">
                <Users className="w-5 h-5" />
              </div>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                selectedAction === 'students' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
              }`}>
                {selectedAction === 'students' ? (language === 'en' ? 'Selected' : '選択中') : (language === 'en' ? 'Step 1' : 'ステップ 1')}
              </span>
            </div>
            <h3 className="text-sm font-extrabold text-slate-900">{language === 'en' ? 'Import Student Roster' : '園児・生徒名簿の取込'}</h3>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              {language === 'en' ? 'Paste the child list CSV/Excel exported from CoDMON to automatically register and update classes and attendance days.' : 'コドモンから出力した児童一覧CSV・Excelを貼り付けて、クラスや通学曜日を自動登録・更新します。'}
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-indigo-600">
            <span>{selectedAction === 'students' ? (language === 'en' ? 'Close panel' : '操作パネルを閉じる') : (language === 'en' ? 'Import roster' : '名簿を取り込む')}</span>
            <ChevronRight className={`w-4 h-4 transition-transform ${selectedAction === 'students' ? 'rotate-90' : ''}`} />
          </div>
        </button>

        {/* Card 2: Absence Import */}
        <button
          type="button"
          onClick={() => setSelectedAction(selectedAction === 'absences' ? null : 'absences')}
          className={`text-left p-5 rounded-2xl border transition flex flex-col justify-between ${
            selectedAction === 'absences'
              ? 'bg-rose-50/80 border-rose-500 ring-2 ring-rose-500 shadow-sm'
              : 'bg-white hover:bg-slate-50/80 border-slate-200 shadow-xs'
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center font-bold">
                <Calendar className="w-5 h-5" />
              </div>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                selectedAction === 'absences' ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-600'
              }`}>
                {selectedAction === 'absences' ? (language === 'en' ? 'Selected' : '選択中') : (language === 'en' ? 'Step 2' : 'ステップ 2')}
              </span>
            </div>
            <h3 className="text-sm font-extrabold text-slate-900">{language === 'en' ? 'Bulk Import Absences' : '欠席連絡の一括取込'}</h3>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              {language === 'en' ? 'Load CoDMON absence/attendance data to automatically register absence dates and grant make-up tickets.' : 'コドモンの欠席・出欠データを読み込み、カレンダーの欠席日登録と振替チケット付与を自動実行します。'}
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-rose-600">
            <span>{selectedAction === 'absences' ? (language === 'en' ? 'Close panel' : '操作パネルを閉じる') : (language === 'en' ? 'Import absences' : '欠席を取り込む')}</span>
            <ChevronRight className={`w-4 h-4 transition-transform ${selectedAction === 'absences' ? 'rotate-90' : ''}`} />
          </div>
        </button>

        {/* Card 3: CSV Export */}
        <button
          type="button"
          onClick={() => setSelectedAction(selectedAction === 'export' ? null : 'export')}
          className={`text-left p-5 rounded-2xl border transition flex flex-col justify-between ${
            selectedAction === 'export'
              ? 'bg-slate-100 border-slate-700 ring-2 ring-slate-700 shadow-sm'
              : 'bg-white hover:bg-slate-50/80 border-slate-200 shadow-xs'
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
                <Download className="w-5 h-5" />
              </div>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                selectedAction === 'export' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'
              }`}>
                {selectedAction === 'export' ? (language === 'en' ? 'Selected' : '選択中') : (language === 'en' ? 'Export' : 'データ出力')}
              </span>
            </div>
            <h3 className="text-sm font-extrabold text-slate-900">{language === 'en' ? 'CSV Download' : 'CSVダウンロード'}</h3>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              {language === 'en' ? `Download the student roster (${students.length} students) and absence history as Excel-compatible CSV.` : `システム内の生徒名簿（${students.length}名）や欠席履歴を、Excel対応CSVでダウンロードします。`}
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-700">
            <span>{selectedAction === 'export' ? (language === 'en' ? 'Close panel' : '操作パネルを閉じる') : (language === 'en' ? 'Export CSV' : 'CSVを出力する')}</span>
            <ChevronRight className={`w-4 h-4 transition-transform ${selectedAction === 'export' ? 'rotate-90' : ''}`} />
          </div>
        </button>

      </div>

      {/* DETAIL DRAWER / CARD CONTENT */}

      {/* 1. STUDENT IMPORT DRAWER */}
      {selectedAction === 'students' && (
        <div className="bg-white rounded-2xl border border-indigo-200 p-5 sm:p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-600" />
                <span>{language === 'en' ? 'Import Student Roster (CSV drag & drop or copy & paste)' : '生徒名簿の取込（CSVドラッグ＆ドロップ または コピー＆ペースト）'}</span>
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                {language === 'en' ? 'Automatically detects CoDMON columns such as child name, class, and attendance days.' : 'コドモンの「園児名」「クラス」「通学曜日」などを自動検出します。'}
              </p>
            </div>

            <button
              type="button"
              onClick={handleLoadSampleStudents}
              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg transition border border-indigo-200 flex items-center gap-1.5 shrink-0"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>{language === 'en' ? 'Load sample data' : 'サンプルデータ読込'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Drop Zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsStudentDragOver(true);
              }}
              onDragLeave={() => setIsStudentDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsStudentDragOver(false);
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleStudentFile(e.dataTransfer.files[0]);
                }
              }}
              onClick={() => studentFileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition flex flex-col items-center justify-center min-h-[140px] ${
                isStudentDragOver
                  ? 'border-indigo-600 bg-indigo-50'
                  : 'border-slate-300 hover:border-indigo-400 bg-slate-50/60'
              }`}
            >
              <input
                ref={studentFileInputRef}
                type="file"
                accept=".csv, .tsv, .txt"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleStudentFile(e.target.files[0]);
                  }
                }}
              />
              <Upload className="w-6 h-6 text-indigo-600 mb-1.5" />
              <p className="text-xs font-bold text-slate-800">{language === 'en' ? 'Drop a CSV file' : 'CSVファイルをドロップ'}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">{language === 'en' ? 'or click to choose a file' : 'またはクリックしてファイル選択'}</p>
            </div>

            {/* Paste Area */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <span className="flex items-center gap-1">
                  <ClipboardPaste className="w-3.5 h-3.5 text-slate-500" />
                  <span>{language === 'en' ? 'or paste text directly (Ctrl+V)' : 'またはテキストを直接貼り付け (Ctrl+V)'}</span>
                </span>
                {studentRawText && (
                  <button
                    onClick={() => {
                      setStudentRawText('');
                      setStudentParsed([]);
                    }}
                    className="text-slate-400 hover:text-slate-600 text-[11px]"
                  >
                    {language === 'en' ? 'Clear' : 'クリア'}
                  </button>
                )}
              </div>
              <textarea
                rows={4}
                value={studentRawText}
                onChange={(e) => handleStudentTextChange(e.target.value)}
                placeholder="園児名,クラス,通学曜日,保護者名,メールアドレス&#10;サンプル 陽翔,Kin,月・水,サンプル 保護者,sample@example.com"
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono focus:bg-white focus:ring-2 focus:ring-indigo-500 transition"
              />
            </div>
          </div>

          {/* Parsed Preview Table */}
          {studentParsed.length > 0 && (
            <div className="space-y-3 pt-3 border-t border-slate-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-slate-900">
                    {language === 'en' ? `Parsed: ${studentParsed.length} students` : `解析結果: ${studentParsed.length} 名`}
                  </span>
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px] font-bold">
                    {language === 'en' ? `New ${studentParsed.filter((s) => s.status === 'new').length}` : `新規 ${studentParsed.filter((s) => s.status === 'new').length}名`}
                  </span>
                  <span className="px-2 py-0.5 bg-sky-100 text-sky-800 rounded text-[10px] font-bold">
                    {language === 'en' ? `Update ${studentParsed.filter((s) => s.status === 'update').length}` : `更新 ${studentParsed.filter((s) => s.status === 'update').length}名`}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-xs text-slate-700">
                    <label className="flex items-center gap-1 cursor-pointer font-bold">
                      <input
                        type="radio"
                        name="mode"
                        value="merge"
                        checked={importMode === 'merge'}
                        onChange={() => setImportMode('merge')}
                      />
                      <span>{language === 'en' ? 'Add / update existing' : '既存に追加・更新'}</span>
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer text-slate-500">
                      <input
                        type="radio"
                        name="mode"
                        value="replace"
                        checked={importMode === 'replace'}
                        onChange={() => setImportMode('replace')}
                      />
                      <span>{language === 'en' ? 'Replace all' : '全上書き'}</span>
                    </label>
                  </div>

                  <button
                    onClick={handleApplyStudents}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-lg shadow-xs transition flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{language === 'en' ? 'Apply to system' : 'システムに反映する'}</span>
                  </button>
                </div>
              </div>

              <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 sticky top-0 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3">{language === 'en' ? 'Status' : '状態'}</th>
                      <th className="py-2 px-3">{language === 'en' ? 'Student' : '生徒名'}</th>
                      <th className="py-2 px-3">{language === 'en' ? 'Class' : 'クラス'}</th>
                      <th className="py-2 px-3">{language === 'en' ? 'Days' : '通学曜日'}</th>
                      <th className="py-2 px-3">{language === 'en' ? 'Parent/Guardian' : '保護者名'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {studentParsed.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-1.5 px-3">
                          {item.status === 'new' ? (
                            <span className="text-emerald-700 font-bold">{language === 'en' ? '+ New' : '＋新規'}</span>
                          ) : (
                            <span className="text-sky-700 font-bold">{language === 'en' ? '↺ Update' : '↺更新'}</span>
                          )}
                        </td>
                        <td className="py-1.5 px-3 font-bold text-slate-900">{item.name}</td>
                        <td className="py-1.5 px-3">{item.matchedClassId}</td>
                        <td className="py-1.5 px-3 font-bold text-slate-700">{item.regularDaysStr}</td>
                        <td className="py-1.5 px-3 text-slate-500">{item.parentName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. ABSENCE IMPORT DRAWER */}
      {selectedAction === 'absences' && (
        <div className="bg-white rounded-2xl border border-rose-200 p-5 sm:p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-rose-600" />
                <span>{language === 'en' ? 'Bulk Import Absences (register absences & grant make-up tickets)' : '欠席連絡の一括取込（欠席日登録＆振替チケット付与）'}</span>
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                {language === 'en' ? 'Imports date, child name, and absence reason from CoDMON.' : 'コドモンの「日付」「園児名」「欠席理由」を取り込みます。'}
              </p>
            </div>

            <button
              type="button"
              onClick={handleLoadSampleAbsences}
              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-lg transition border border-rose-200 flex items-center gap-1.5 shrink-0"
            >
              <Sparkles className="w-3.5 h-3.5 text-rose-600" />
              <span>{language === 'en' ? 'Load sample data' : 'サンプルデータ読込'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Drop Zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsAbsenceDragOver(true);
              }}
              onDragLeave={() => setIsAbsenceDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsAbsenceDragOver(false);
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleAbsenceFile(e.dataTransfer.files[0]);
                }
              }}
              onClick={() => absenceFileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition flex flex-col items-center justify-center min-h-[140px] ${
                isAbsenceDragOver
                  ? 'border-rose-600 bg-rose-50'
                  : 'border-slate-300 hover:border-rose-400 bg-slate-50/60'
              }`}
            >
              <input
                ref={absenceFileInputRef}
                type="file"
                accept=".csv, .tsv, .txt"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleAbsenceFile(e.target.files[0]);
                  }
                }}
              />
              <Upload className="w-6 h-6 text-rose-600 mb-1.5" />
              <p className="text-xs font-bold text-slate-800">{language === 'en' ? 'Drop an absence CSV file' : '欠席CSVファイルをドロップ'}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">{language === 'en' ? 'or click to choose a file' : 'またはクリックしてファイル選択'}</p>
            </div>

            {/* Paste Area */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <span className="flex items-center gap-1">
                  <ClipboardPaste className="w-3.5 h-3.5 text-slate-500" />
                  <span>{language === 'en' ? 'or paste text directly (Ctrl+V)' : 'またはテキストを直接貼り付け (Ctrl+V)'}</span>
                </span>
                {absenceRawText && (
                  <button
                    onClick={() => {
                      setAbsenceRawText('');
                      setAbsenceParsed([]);
                    }}
                    className="text-slate-400 hover:text-slate-600 text-[11px]"
                  >
                    {language === 'en' ? 'Clear' : 'クリア'}
                  </button>
                )}
              </div>
              <textarea
                rows={4}
                value={absenceRawText}
                onChange={(e) => handleAbsenceTextChange(e.target.value)}
                placeholder="日付,園児名,欠席理由&#10;2026-11-02,サンプル 蓮,体調不良"
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono focus:bg-white focus:ring-2 focus:ring-rose-500 transition"
              />
            </div>
          </div>

          {/* Absence Table */}
          {absenceParsed.length > 0 && (
            <div className="space-y-3 pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-slate-900">
                    {language === 'en' ? `Parsed: ${absenceParsed.length} records` : `解析結果: ${absenceParsed.length} 件`}
                  </span>
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px] font-bold">
                    {language === 'en' ? `Ready ${absenceParsed.filter((a) => a.status === 'ready').length}` : `登録可能 ${absenceParsed.filter((a) => a.status === 'ready').length}件`}
                  </span>
                </div>

                <button
                  onClick={handleApplyAbsences}
                  disabled={!absenceParsed.some((a) => a.status === 'ready')}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 text-white text-xs font-black rounded-lg shadow-xs transition flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{language === 'en' ? 'Register absences & grant tickets' : '欠席登録 & チケット付与'}</span>
                </button>
              </div>

              <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 sticky top-0 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3">{language === 'en' ? 'Status' : '状態'}</th>
                      <th className="py-2 px-3">{language === 'en' ? 'Date' : '対象日'}</th>
                      <th className="py-2 px-3">{language === 'en' ? 'Student' : '生徒名'}</th>
                      <th className="py-2 px-3">{language === 'en' ? 'Reason' : '理由'}</th>
                      <th className="py-2 px-3">{language === 'en' ? 'Result' : '判定'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {absenceParsed.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-1.5 px-3">
                          {item.status === 'ready' ? (
                            <span className="text-emerald-700 font-bold">{language === 'en' ? '○ Ready' : '○ 登録可'}</span>
                          ) : (
                            <span className="text-slate-400">{language === 'en' ? 'Skip' : 'スキップ'}</span>
                          )}
                        </td>
                        <td className="py-1.5 px-3 font-bold text-slate-900">{item.date}</td>
                        <td className="py-1.5 px-3 font-bold text-slate-900">{item.studentName}</td>
                        <td className="py-1.5 px-3 text-slate-600">{item.reason}</td>
                        <td className="py-1.5 px-3 text-[11px] text-slate-400">{item.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. EXPORT DRAWER */}
      {selectedAction === 'export' && (
        <div className="bg-white rounded-2xl border border-slate-300 p-5 sm:p-6 shadow-sm space-y-4">
          <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
            <Download className="w-4 h-4 text-slate-700" />
            <span>{language === 'en' ? 'CSV Data Download' : 'CSVデータダウンロード'}</span>
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={handleExportStudentsCSV}
              className="p-4 bg-slate-50 hover:bg-indigo-50/50 border border-slate-200 hover:border-indigo-300 rounded-xl text-left transition flex items-center justify-between"
            >
              <div>
                <div className="text-xs font-extrabold text-slate-900">{language === 'en' ? 'Student roster & make-up balance CSV' : '生徒名簿・振替残数CSV'}</div>
                <div className="text-[11px] text-slate-500 mt-0.5">{language === 'en' ? `All data for ${students.length} registered students` : `登録生徒 ${students.length} 名の全データ`}</div>
              </div>
              <Download className="w-4 h-4 text-indigo-600 shrink-0" />
            </button>

            <button
              onClick={handleExportAbsencesCSV}
              className="p-4 bg-slate-50 hover:bg-rose-50/50 border border-slate-200 hover:border-rose-300 rounded-xl text-left transition flex items-center justify-between"
            >
              <div>
                <div className="text-xs font-extrabold text-slate-900">{language === 'en' ? 'Absence history CSV' : '欠席履歴CSV'}</div>
                <div className="text-[11px] text-slate-500 mt-0.5">{language === 'en' ? `${absences.length} registered absence notices` : `登録された欠席連絡 ${absences.length} 件`}</div>
              </div>
              <Download className="w-4 h-4 text-rose-600 shrink-0" />
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
