import React, { useState, useEffect, useRef } from 'react';
import {
  ViewMode,
  Student,
  AbsenceRecord,
  TransferBooking,
  DailyClassOverride,
  GoogleSheetsConfig,
  ClassId,
  WeekdayQuotaSettings,
  SpecialScheduleDay
} from './types';
import {
  getStoredStudents,
  saveStudents,
  getStoredAbsences,
  saveAbsences,
  getStoredBookings,
  saveBookings,
  getStoredOverrides,
  saveOverrides,
  getStoredWeekdayQuotas,
  saveWeekdayQuotas,
  getStoredSpecialDays,
  saveSpecialDays,
  getStoredCodmonSyncLogs,
  saveCodmonSyncLog,
  getLastCodmonSyncLog,
  resetAllData,
  getClassCapacityForDate
} from './lib/storage';
import {
  INITIAL_STUDENTS,
  INITIAL_ABSENCES,
  INITIAL_BOOKINGS,
  INITIAL_WEEKDAY_QUOTAS,
  INITIAL_SPECIAL_DAYS
} from './data/initialData';
import { Header } from './components/Header';
import { useTranslation } from './lib/i18n';
import { ParentDashboard } from './components/ParentView/ParentDashboard';
import { AdminDashboard } from './components/AdminView/AdminDashboard';
import { GoogleSheetsModal } from './components/GoogleSheetsModal';
import { mergeStudentsFromSheet, readStudentMasterFromSheet, requestAccessToken, syncDataToGoogleSheet } from './lib/googleSheets';
import { applyTicketExpirations, calculateExpiryDate } from './lib/expiration';
import { getDayOfWeek } from './lib/dateUtils';
import { getHolidayName } from './lib/holidays';
import { syncHolidayGrants } from './lib/holidayGrants';
import { CodmonSyncLog } from './types';
import { CodmonDailyAbsenceItem, CodmonDailyTransferItem } from './lib/codmonParser';
import { RefreshCw, RotateCcw, ShieldAlert, Sparkles, CheckCircle, Info } from 'lucide-react';
import { safeStorage } from './lib/safeStorage';
import { api, ApiError, isRemoteMode } from './lib/api';
import {
  AppState,
  bookTransfer,
  cancelAbsence,
  cancelBooking,
  OperationResult,
  operationErrorMessage,
  reportAbsence
} from './lib/operations';
import { applyChanges, diffState, isEmptyChangeSet } from './lib/sync';
import { AdminLogin } from './components/AdminView/AdminLogin';

export default function App() {
  const { language } = useTranslation();
  const L = (ja: string, en: string) => (language === 'en' ? en : ja);
  const [viewMode, setViewMode] = useState<ViewMode>('parent');

  // サーバー版（config.json に apiUrl がある）では、ログイン後にサーバーからデータを受け取る。
  // デモ版はブラウザ内（localStorage）に保存する
  const remote = isRemoteMode();

  // Core App State
  const [students, setStudents] = useState<Student[]>(() => (remote ? [] : getStoredStudents()));
  const [absences, setAbsences] = useState<AbsenceRecord[]>(() => (remote ? [] : getStoredAbsences()));
  const [bookings, setBookings] = useState<TransferBooking[]>(() => (remote ? [] : getStoredBookings()));
  const [overrides, setOverrides] = useState<DailyClassOverride[]>(() => (remote ? [] : getStoredOverrides()));
  const [weekdayQuotas, setWeekdayQuotas] = useState<WeekdayQuotaSettings>(() =>
    remote ? INITIAL_WEEKDAY_QUOTAS : getStoredWeekdayQuotas()
  );
  const [specialDays, setSpecialDays] = useState<SpecialScheduleDay[]>(() => (remote ? [] : getStoredSpecialDays()));
  const [syncLogs, setSyncLogs] = useState<CodmonSyncLog[]>(() => (remote ? [] : getStoredCodmonSyncLogs()));
  const [lastSync, setLastSync] = useState<CodmonSyncLog | null>(() => (remote ? null : getLastCodmonSyncLog()));

  // サーバー版のログイン状態
  const [parentToken, setParentToken] = useState<string | null>(null);
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [spreadsheetUrl, setSpreadsheetUrl] = useState<string>('');
  /** 管理者: 最後にサーバーと一致していた状態（変更の差分の基準） */
  const syncedRef = useRef<AppState | null>(null);
  const syncingRef = useRef(false);

  const [selectedStudentId, setSelectedStudentId] = useState<string>(
    students[0]?.id || 'std_ex1_1'
  );

  // Google Sheets Config State
  const [sheetsConfig, setSheetsConfig] = useState<GoogleSheetsConfig>(() => {
    try {
      const raw = safeStorage.getItem('soltilo_gsa_sheets_config_v1');
      if (raw) return JSON.parse(raw);
    } catch {}
    return {
      spreadsheetId: null,
      spreadsheetUrl: null,
      lastSyncedAt: null,
      autoSync: false
    };
  });

  const [isSheetsModalOpen, setIsSheetsModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // 起動時: 祝日要振替の付与漏れを補い、未使用のまま期限切れになった振替チケットを失効させる（サーバー版はサーバーで実施）
  useEffect(() => {
    if (remote) return;
    const granted = syncHolidayGrants(students, absences, specialDays);
    const result = applyTicketExpirations(granted.students, granted.absences, bookings);
    if (granted.granted + granted.revoked + result.expiredCount > 0) {
      setStudents(result.students);
      setAbsences(result.absences);
    }
    // 起動時に1回だけ実行する
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save states to local storage on change
  useEffect(() => {
    if (remote) return;
    saveStudents(students);
  }, [students]);

  useEffect(() => {
    if (remote) return;
    saveAbsences(absences);
  }, [absences]);

  useEffect(() => {
    if (remote) return;
    saveBookings(bookings);
  }, [bookings]);

  useEffect(() => {
    if (remote) return;
    saveOverrides(overrides);
  }, [overrides]);

  useEffect(() => {
    if (remote) return;
    saveWeekdayQuotas(weekdayQuotas);
  }, [weekdayQuotas]);

  useEffect(() => {
    if (remote) return;
    saveSpecialDays(specialDays);
  }, [specialDays]);

  useEffect(() => {
    safeStorage.setItem('soltilo_gsa_sheets_config_v1', JSON.stringify(sheetsConfig));
  }, [sheetsConfig]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  /** 画面の現在の状態をまとめる（共通処理・差分計算用） */
  const currentState = (): AppState => ({
    students,
    absences,
    bookings,
    overrides,
    weekdayQuotas,
    specialDays,
    codmonSyncLogs: syncLogs
  });

  /** サーバーから受け取ったデータで画面を置き換える */
  const applyServerData = (data: AppState) => {
    syncedRef.current = data;
    setStudents(data.students);
    setAbsences(data.absences);
    setBookings(data.bookings);
    setOverrides(data.overrides);
    setWeekdayQuotas(data.weekdayQuotas);
    setSpecialDays(data.specialDays);
    setSyncLogs(data.codmonSyncLogs || []);
    setLastSync(data.codmonSyncLogs?.[0] ?? null);
  };

  const clearData = () =>
    applyServerData({
      students: [],
      absences: [],
      bookings: [],
      overrides: [],
      weekdayQuotas: INITIAL_WEEKDAY_QUOTAS,
      specialDays: [],
      codmonSyncLogs: []
    });

  /** サーバーのエラー表示。ログイン期限切れならログイン画面に戻す */
  const handleApiError = (err: unknown) => {
    const code = err instanceof ApiError ? err.code : 'server_error';
    if (code === 'session_expired') {
      setParentToken(null);
      setAdminToken(null);
      syncedRef.current = null;
      clearData();
    }
    showToast(err instanceof ApiError ? operationErrorMessage(code, err.params, language) : String(err));
  };

  // --- サーバー版: ログイン・画面切り替え ---

  const remoteParentLogin = async (loginId: string, password: string): Promise<string> => {
    try {
      const res = await api.parentLogin(loginId, password);
      setParentToken(res.token);
      applyServerData(res.data);
      return res.studentId;
    } catch (err) {
      const code = err instanceof ApiError ? err.code : 'server_error';
      throw new Error(operationErrorMessage(code, err instanceof ApiError ? err.params : {}, language));
    }
  };

  const remoteParentLogout = () => {
    setParentToken(null);
    syncedRef.current = null;
    clearData();
  };

  const remoteAdminLogin = async (password: string) => {
    try {
      const res = await api.adminLogin(password);
      setAdminToken(res.token);
      setSpreadsheetUrl(res.spreadsheetUrl);
      applyServerData(res.data);
    } catch (err) {
      const code = err instanceof ApiError ? err.code : 'server_error';
      throw new Error(operationErrorMessage(code, err instanceof ApiError ? err.params : {}, language));
    }
  };

  // 保護者画面と管理画面ではデータの範囲が違うため、切り替えるたびに読み直す（他の家庭の情報を残さない）
  const handleViewModeChange = (mode: ViewMode) => {
    if (remote && mode !== viewMode) {
      setParentToken(null);
      syncedRef.current = null;
      clearData();
      if (mode === 'admin' && adminToken) {
        api
          .adminGetData(adminToken)
          .then((res) => {
            setSpreadsheetUrl(res.spreadsheetUrl);
            applyServerData(res.data);
          })
          .catch(handleApiError);
      }
    }
    setViewMode(mode);
  };

  // --- サーバー版: 管理画面の変更を自動保存 ---
  // 画面の変更を「最後にサーバーと一致していた状態」との差分としてまとめて送る。
  // 送信中に追加の変更があれば、サーバーの最新状態に載せ直してから再送する
  useEffect(() => {
    if (!remote || viewMode !== 'admin' || !adminToken || !syncedRef.current || syncingRef.current) return;
    const sentBase = syncedRef.current;
    const sentNext = currentState();
    const changes = diffState(sentBase, sentNext);
    if (isEmptyChangeSet(changes)) return;

    const timer = setTimeout(async () => {
      syncingRef.current = true;
      setIsSyncing(true);
      try {
        const res = await api.adminSync(adminToken, changes);
        // 送信後に画面で加えた変更を、サーバーの最新状態に載せ直す
        const pending = diffState(sentNext, latestStateRef.current);
        const rebased = applyChanges(res.data, pending).state;
        syncedRef.current = res.data;
        setStudents(rebased.students);
        setAbsences(rebased.absences);
        setBookings(rebased.bookings);
        setOverrides(rebased.overrides);
        setWeekdayQuotas(rebased.weekdayQuotas);
        setSpecialDays(rebased.specialDays);
        setSyncLogs(rebased.codmonSyncLogs);
        if (res.conflicts.length > 0) {
          showToast(
            L(
              `他の方の更新と重なった ${res.conflicts.length} 件は保存せず、最新の内容を表示しています。必要ならもう一度操作してください`,
              `${res.conflicts.length} change(s) overlapped with someone else's update and were not saved. The latest data is shown.`
            )
          );
        }
      } catch (err) {
        handleApiError(err);
      } finally {
        syncingRef.current = false;
        setIsSyncing(false);
      }
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remote, viewMode, adminToken, students, absences, bookings, overrides, weekdayQuotas, specialDays, syncLogs, isSyncing]);

  /** 非同期処理の中から最新の画面状態を読むための参照 */
  const latestStateRef = useRef<AppState>(currentState());
  latestStateRef.current = currentState();

  // Background auto-sync helper if Google Sheets is connected
  const tryAutoSyncToSheets = async (updatedData?: {
    students?: Student[];
    absences?: AbsenceRecord[];
    bookings?: TransferBooking[];
    overrides?: DailyClassOverride[];
  }) => {
    if (!sheetsConfig.spreadsheetId) return;

    try {
      const token = await requestAccessToken();
      await syncDataToGoogleSheet(token, sheetsConfig.spreadsheetId, {
        students: updatedData?.students || students,
        absences: updatedData?.absences || absences,
        bookings: updatedData?.bookings || bookings,
        overrides: updatedData?.overrides || overrides
      });

      setSheetsConfig((prev) => ({
        ...prev,
        lastSyncedAt: new Date().toISOString()
      }));
    } catch (err) {
      console.warn('Background auto-sync skipped/failed:', err);
    }
  };

  // --- Handlers ---

  // --- 保護者の操作（デモ版は画面内で処理、サーバー版はサーバーで処理して家族分の最新データを受け取る） ---

  /** 共通処理の結果を画面に反映。失敗時は理由を表示して false */
  const applyLocalResult = (result: OperationResult, successMessage: string): boolean => {
    if (!result.ok) {
      const failure = result as Extract<OperationResult, { ok: false }>;
      showToast(operationErrorMessage(failure.code, failure.params, language));
      return false;
    }
    setStudents(result.state.students);
    setAbsences(result.state.absences);
    setBookings(result.state.bookings);
    showToast(successMessage);
    tryAutoSyncToSheets({ students: result.state.students, absences: result.state.absences, bookings: result.state.bookings });
    return true;
  };

  /** サーバー版の保護者操作。成功したら家族分のデータで画面を更新 */
  const runParentRemote = async (
    request: (token: string) => Promise<{ data: AppState }>,
    successMessage: string
  ): Promise<boolean> => {
    if (!parentToken) return false;
    try {
      const res = await request(parentToken);
      applyServerData(res.data);
      showToast(successMessage);
      return true;
    } catch (err) {
      handleApiError(err);
      return false;
    }
  };

  // 1. Submit Absence (欠席連絡)
  const handleReportAbsence = (data: {
    studentId: string;
    studentName: string;
    classId: ClassId;
    date: string;
    reason: string;
  }): boolean | Promise<boolean> => {
    const input = { studentId: data.studentId, date: data.date, reason: data.reason };
    const message = L('欠席連絡を受理しました（振替残数 +1回）', 'Absence received (+1 make-up credit).');
    if (remote) return runParentRemote((t) => api.parentReportAbsence(t, input), message);
    return applyLocalResult(reportAbsence(currentState(), input), message);
  };

  // 2. Book Transfer (振替予約)
  const handleBookTransfer = (data: {
    studentId: string;
    studentName: string;
    fromClassId: ClassId;
    targetClassId: ClassId;
    targetDate: string;
  }): boolean | Promise<boolean> => {
    const message = L(`${data.targetDate} の振替予約を完了しました（振替残数 -1回）`, `Make-up booked for ${data.targetDate} (−1 credit).`);
    if (remote) {
      return runParentRemote((t) => api.parentBookTransfer(t, { studentId: data.studentId, targetDate: data.targetDate }), message);
    }
    return applyLocalResult(
      bookTransfer(currentState(), { studentId: data.studentId, targetDate: data.targetDate, targetClassId: data.targetClassId }),
      message
    );
  };

  // 3. Cancel Booking (振替予約キャンセル)
  const handleCancelBooking = (bookingId: string) => {
    const message = L('振替予約をキャンセルしました（振替残数を1回お戻ししました）', 'Make-up booking cancelled (1 credit returned).');
    if (remote) return void runParentRemote((t) => api.parentCancelBooking(t, bookingId), message);
    applyLocalResult(cancelBooking(currentState(), bookingId), message);
  };

  // 4. Cancel Absence (欠席連絡取り消し)
  const handleCancelAbsence = (absenceId: string) => {
    const message = L('欠席連絡を取り消しました', 'Absence report withdrawn.');
    if (remote && viewMode === 'parent') return void runParentRemote((t) => api.parentCancelAbsence(t, absenceId), message);
    applyLocalResult(cancelAbsence(currentState(), absenceId), message);
  };

  // 5. Manual Transfer Balance Delta Adjust (管理者残数調整)
  const handleUpdateTransferBalance = (studentId: string, delta: number) => {
    const nextStudents = students.map((s) => {
      if (s.id === studentId) {
        return { ...s, transferBalance: Math.max(0, s.transferBalance + delta) };
      }
      return s;
    });
    setStudents(nextStudents);
    showToast(L(`振替残数を調整しました`, 'Make-up credits adjusted.'));
    tryAutoSyncToSheets({ students: nextStudents });
  };

  // 6. Add Student (新規生徒登録)
  const handleAddStudent = (studentData: Omit<Student, 'id'>) => {
    const newStudent: Student = {
      ...studentData,
      id: `std_${Date.now()}`
    };
    const nextStudents = [...students, newStudent];
    setStudents(nextStudents);
    setSelectedStudentId(newStudent.id);
    showToast(L(`${newStudent.name} 様を新規登録しました`, `Added ${newStudent.name}.`));
    tryAutoSyncToSheets({ students: nextStudents });
  };

  // 6.6. CoDMON Bulk Import Students (コドモン園児・児童名簿の一括取込)
  const handleImportCodmonStudents = (
    importedList: import('./lib/codmonParser').CodmonStudentParsedRow[],
    mode: 'merge' | 'replace'
  ) => {
    if (mode === 'replace') {
      const newStudentList: Student[] = importedList.map((item, idx) => ({
        id: `std_codmon_${Date.now()}_${idx}`,
        name: item.name,
        classId: item.matchedClassId,
        regularDays: item.regularDays,
        transferBalance: item.transferBalance,
        parentName: item.parentName,
        contactEmail: item.contactEmail,
        loginId: `codmon_${idx + 101}`,
        password: 'soltilo123',
        isDefaultPassword: true
      }));

      setStudents(newStudentList);
      if (newStudentList.length > 0) {
        setSelectedStudentId(newStudentList[0].id);
      }
      showToast(L(`コドモン生徒名簿 ${newStudentList.length} 名を全反映しました`, `Imported ${newStudentList.length} students from CoDMON.`));
      tryAutoSyncToSheets({ students: newStudentList });
      return;
    }

    // Merge / Update Mode
    let updatedCount = 0;
    let addedCount = 0;
    const workingList = [...students];

    importedList.forEach((item, idx) => {
      const cleanName = item.name.replace(/\s+/g, '');
      const existingIdx = workingList.findIndex(
        (s) => s.name.replace(/\s+/g, '').includes(cleanName) || cleanName.includes(s.name.replace(/\s+/g, ''))
      );

      if (existingIdx !== -1) {
        // Update existing student
        workingList[existingIdx] = {
          ...workingList[existingIdx],
          classId: item.matchedClassId,
          regularDays: item.regularDays,
          parentName: item.parentName || workingList[existingIdx].parentName,
          contactEmail: item.contactEmail || workingList[existingIdx].contactEmail,
          transferBalance: item.transferBalance > 0 ? item.transferBalance : workingList[existingIdx].transferBalance
        };
        updatedCount++;
      } else {
        // Add new student
        workingList.push({
          id: `std_codmon_${Date.now()}_${idx}`,
          name: item.name,
          classId: item.matchedClassId,
          regularDays: item.regularDays,
          transferBalance: item.transferBalance,
          parentName: item.parentName,
          contactEmail: item.contactEmail,
          loginId: `codmon_${workingList.length + 101}`,
          password: 'soltilo123',
          isDefaultPassword: true
        });
        addedCount++;
      }
    });

    setStudents(workingList);
    showToast(L(`コドモン連携完了: 新規 ${addedCount}名 / 更新 ${updatedCount}名`, `CoDMON import done: ${addedCount} added / ${updatedCount} updated.`));
    tryAutoSyncToSheets({ students: workingList });
  };

  // 6.7. CoDMON Bulk Import Absences (コドモン欠席連絡の一括取込)
  const handleImportCodmonAbsences = (
    importedAbsences: import('./lib/codmonParser').CodmonAbsenceParsedRow[]
  ) => {
    const readyItems = importedAbsences.filter((a) => a.status === 'ready' && a.matchedStudentId);
    if (readyItems.length === 0) return;

    const newRecords: AbsenceRecord[] = readyItems.map((item, idx) => {
      const student = students.find((s) => s.id === item.matchedStudentId);
      return {
        id: `abs_codmon_${Date.now()}_${idx}`,
        studentId: item.matchedStudentId!,
        studentName: item.studentName,
        classId: student?.classId || 'ex1',
        date: item.date,
        reason: item.reason || 'コドモン欠席連絡',
        reportedAt: new Date().toISOString(),
        status: 'confirmed' as const,
        creditGranted: true,
        expiryDate: calculateExpiryDate(item.date)
      };
    });

    const nextAbsences = [...newRecords, ...absences];
    setAbsences(nextAbsences);

    // Increment balance by 1 for each absent student
    const studentCountMap: Record<string, number> = {};
    readyItems.forEach((item) => {
      if (item.matchedStudentId) {
        studentCountMap[item.matchedStudentId] = (studentCountMap[item.matchedStudentId] || 0) + 1;
      }
    });

    const nextStudents = students.map((s) => {
      if (studentCountMap[s.id]) {
        return {
          ...s,
          transferBalance: s.transferBalance + studentCountMap[s.id]
        };
      }
      return s;
    });

    setStudents(nextStudents);
    showToast(L(`コドモン欠席連絡 ${newRecords.length} 件を反映し、振替チケットを付与しました`, `Applied ${newRecords.length} CoDMON absences and granted make-up credits.`));
    tryAutoSyncToSheets({ absences: nextAbsences, students: nextStudents });
  };

  // 6.8. CoDMON Daily Smart Screen Sync (コドモンデイリー画面全選択ペースト一括反映)
  const handleApplyCodmonDailySync = (result: {
    absences: CodmonDailyAbsenceItem[];
    transfers: CodmonDailyTransferItem[];
    newStudents?: Student[];
    targetDate: string;
    summary: string;
  }) => {
    let currentStudents = [...students];
    let currentAbsences = [...absences];
    let currentBookings = [...bookings];

    // 0. Auto-register new students from CoDMON if any
    if (result.newStudents && result.newStudents.length > 0) {
      result.newStudents.forEach((newS) => {
        if (!currentStudents.some((s) => s.id === newS.id || s.name === newS.name)) {
          currentStudents.push(newS);
        }
      });
    }

    // 1. Process Absences
    const newAbsenceRecords: AbsenceRecord[] = [];
    result.absences.forEach((item, idx) => {
      if (item.status === 'ready' && item.studentId) {
        if (item.isNewStudent && item.newStudentData) {
          if (!currentStudents.some((s) => s.id === item.newStudentData!.id || s.name === item.newStudentData!.name)) {
            currentStudents.push(item.newStudentData);
          }
        }

        newAbsenceRecords.push({
          id: `abs_daily_${Date.now()}_${idx}`,
          studentId: item.studentId,
          studentName: item.studentName,
          classId: item.classId,
          date: item.date,
          reason: item.reason || 'コドモン欠席連絡',
          reportedAt: new Date().toISOString(),
          status: 'confirmed',
          creditGranted: true,
          expiryDate: calculateExpiryDate(item.date)
        });

        // Grant +1 ticket
        currentStudents = currentStudents.map((s) =>
          s.id === item.studentId ? { ...s, transferBalance: s.transferBalance + 1 } : s
        );
      }
    });

    if (newAbsenceRecords.length > 0) {
      currentAbsences = [...newAbsenceRecords, ...currentAbsences];
    }

    // 2. Process Transfers
    const newTransferBookings: TransferBooking[] = [];
    result.transfers.forEach((item, idx) => {
      if (item.status === 'ready' && item.studentId) {
        if (item.isNewStudent && item.newStudentData) {
          if (!currentStudents.some((s) => s.id === item.newStudentData!.id || s.name === item.newStudentData!.name)) {
            currentStudents.push(item.newStudentData);
          }
        }

        newTransferBookings.push({
          id: `tb_daily_${Date.now()}_${idx}`,
          studentId: item.studentId,
          studentName: item.studentName,
          fromClassId: item.fromClassId,
          targetClassId: item.targetClassId,
          targetDate: item.targetDate,
          bookedAt: new Date().toISOString(),
          status: 'booked',
          note: item.note || 'コドモンデイリー振替'
        });

        // Deduct -1 ticket
        currentStudents = currentStudents.map((s) =>
          s.id === item.studentId ? { ...s, transferBalance: Math.max(0, s.transferBalance - 1) } : s
        );
      }
    });

    if (newTransferBookings.length > 0) {
      currentBookings = [...newTransferBookings, ...currentBookings];
    }

    // 3. Save Log and update state
    const newLog: CodmonSyncLog = {
      id: `synclog_${Date.now()}`,
      timestamp: new Date().toISOString(),
      updatedBy: 'スクール管理者',
      targetDate: result.targetDate,
      absencesCount: newAbsenceRecords.length,
      transfersCount: newTransferBookings.length,
      attendanceCount: 0,
      summary: result.summary || `欠席 ${newAbsenceRecords.length}件 / 振替 ${newTransferBookings.length}件 反映`
    };

    if (!remote) saveCodmonSyncLog(newLog);
    setSyncLogs((prev) => [newLog, ...prev].slice(0, 50));
    setLastSync(newLog);

    setStudents(currentStudents);
    setAbsences(currentAbsences);
    setBookings(currentBookings);

    showToast(L(`⚡ コドモンデイリー画面より ${result.summary} を完了しました！`, `⚡ CoDMON daily paste applied: ${result.summary}`));
    tryAutoSyncToSheets({
      students: currentStudents,
      absences: currentAbsences,
      bookings: currentBookings
    });
  };

  // 6.5. Update Student Credentials (Codmon ID/PW変更)
  const handleUpdateCredentials = ({
    studentId,
    newLoginId,
    newPassword
  }: {
    studentId: string;
    newLoginId: string;
    newPassword: string;
  }): boolean | Promise<boolean> => {
    const message = L('ログインID・パスワードを更新しました', 'Login ID and password updated.');
    if (remote) {
      return runParentRemote((t) => api.parentChangeCredentials(t, { studentId, newLoginId, newPassword }), message);
    }
    if (students.some((s) => s.id !== studentId && (s.loginId || '').toLowerCase() === newLoginId.toLowerCase())) {
      showToast(operationErrorMessage('login_id_taken', {}, language));
      return false;
    }
    const nextStudents = students.map((s) => {
      if (s.id === studentId) {
        return {
          ...s,
          loginId: newLoginId,
          password: newPassword,
          isDefaultPassword: false
        };
      }
      return s;
    });
    setStudents(nextStudents);
    showToast(message);
    tryAutoSyncToSheets({ students: nextStudents });
    return true;
  };

  // 7. Save Daily Class Quota Override (定員・振替枠のカスタマイズ)
  const handleSaveOverride = (override: DailyClassOverride) => {
    const filtered = overrides.filter(
      (o) => !(o.date === override.date && o.classId === override.classId)
    );
    const nextOverrides = [...filtered, override];
    setOverrides(nextOverrides);
    showToast(L(`枠数・定員設定を保存しました`, 'Capacity settings saved.'));
    tryAutoSyncToSheets({ overrides: nextOverrides });
  };

  // 7.1. Delete Daily Class Quota Override
  const handleDeleteOverride = (date: string, classId: ClassId) => {
    const nextOverrides = overrides.filter(
      (o) => !(o.date === date && o.classId === classId)
    );
    setOverrides(nextOverrides);
    showToast(L(`個別日付設定を解除しました`, 'Date-specific setting removed.'));
    tryAutoSyncToSheets({ overrides: nextOverrides });
  };

  // 7.2. Save Weekday Quotas Matrix (曜日別基本枠・定員)
  const handleSaveWeekdayQuotas = (newQuotas: WeekdayQuotaSettings) => {
    setWeekdayQuotas(newQuotas);
    showToast(L(`曜日別・クラス別の基本枠数を保存しました`, 'Weekday × class capacity saved.'));
  };

  // 7.3. Save Special Schedule Days (サマースクール・祝日・休館日設定)
  const handleSaveSpecialDays = (newSpecialDays: SpecialScheduleDay[]) => {
    setSpecialDays(newSpecialDays);
    const result = syncHolidayGrants(students, absences, newSpecialDays);
    if (result.granted + result.revoked > 0) {
      setStudents(result.students);
      setAbsences(result.absences);
      tryAutoSyncToSheets({ students: result.students, absences: result.absences });
    }
    const grantNote = result.granted > 0 ? L(`（振替チケット ${result.granted}名分を付与）`, ` (credits granted to ${result.granted} students)`) : '';
    const revokeNote = result.revoked > 0 ? L(`（自動付与 ${result.revoked}件を取消）`, ` (${result.revoked} auto-grants revoked)`) : '';
    showToast(L(`特別日程・シーズン講習・祝日振替設定を保存しました${grantNote}${revokeNote}`, `Special schedule saved${grantNote}${revokeNote}.`));
  };

  // 8. Manual Google Sheets Sync (手動同期)
  // 8.1. シート → アプリ: 生徒マスタ読み込み（双方向同期）
  const handleImportFromSheet = async () => {
    if (remote) {
      if (!adminToken) return;
      try {
        const res = await api.adminImportFromSheet(adminToken);
        applyServerData(res.data);
        const warn = res.warnings.length ? '\n\n' + res.warnings.join('\n') : '';
        alert(
          L(`「名簿取込」シートから 新規 ${res.added}名 / 更新 ${res.updated}名 を反映しました。`, `Imported from the roster import sheet: ${res.added} added / ${res.updated} updated.`) + warn
        );
      } catch (err) {
        handleApiError(err);
      }
      return;
    }
    if (!sheetsConfig.spreadsheetId) return;
    const token = await requestAccessToken();
    const rows = await readStudentMasterFromSheet(token, sheetsConfig.spreadsheetId);
    const result = mergeStudentsFromSheet(students, rows);
    if (result.added === 0 && result.updated === 0) {
      alert(L(`変更はありませんでした（読み込み ${rows.length}行）`, `No changes (${rows.length} rows read).`) + (result.warnings.length ? '\n\n' + result.warnings.join('\n') : ''));
      return;
    }
    const message = [
      L(`スプレッドシートの生徒マスタ ${rows.length}行を読み込みました。`, `Read ${rows.length} rows from the student master sheet.`),
      L(`新規 ${result.added}名 / 更新 ${result.updated}名 をアプリに反映しますか？`, `Apply ${result.added} new / ${result.updated} updated students to the app?`),
      ...(result.warnings.length ? ['', L('【確認事項】', '[Please check]'), ...result.warnings.slice(0, 10)] : [])
    ].join('\n');
    if (!confirm(message)) return;
    setStudents(result.students);
    showToast(L(`生徒マスタを反映しました（新規 ${result.added}名 / 更新 ${result.updated}名）`, `Student master applied (${result.added} new / ${result.updated} updated).`));
  };

  const handleSyncSheets = async () => {
    // サーバー版は保存のたびにスプレッドシートへ自動で書き出すため、シートを開くだけ
    if (remote) {
      if (spreadsheetUrl) window.open(spreadsheetUrl, '_blank', 'noopener');
      else setIsSheetsModalOpen(true);
      return;
    }
    if (!sheetsConfig.spreadsheetId) {
      setIsSheetsModalOpen(true);
      return;
    }

    setIsSyncing(true);
    try {
      const token = await requestAccessToken();
      await syncDataToGoogleSheet(token, sheetsConfig.spreadsheetId, {
        students,
        absences,
        bookings,
        overrides
      });

      setSheetsConfig((prev) => ({
        ...prev,
        lastSyncedAt: new Date().toISOString()
      }));

      showToast(L('Googleスプレッドシートへ全データを同期完了しました！', 'All data synced to Google Sheets.'));
    } catch (err: any) {
      console.error(err);
      alert(L('同期エラー: ', 'Sync error: ') + (err.message || L('Googleスプレッドシートの更新に失敗しました', 'Failed to update Google Sheets.')));
    } finally {
      setIsSyncing(false);
    }
  };

  // Reset demo data
  const handleResetData = () => {
    resetAllData();
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 font-sans flex flex-col selection:bg-sky-500 selection:text-white">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl border border-slate-700 flex items-center space-x-2 text-xs font-bold animate-bounce">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main App Header */}
      <Header
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        sheetsConfig={sheetsConfig}
        onOpenSheetsModal={() => setIsSheetsModalOpen(true)}
        onSyncSheets={handleSyncSheets}
        isSyncing={isSyncing}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* Info Banner */}
        <div className="mb-6 bg-sky-50 text-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs border border-sky-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                {L('SOLTILO GSA アフタースクール部門 振替＆欠席連絡アプリ', 'SOLTILO GSA Afterschool — Absence & Make-up App')}
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                {L('対象クラス', 'Classes')}: <span className="text-sky-700">EX1</span> ・ <span className="text-indigo-700">EX2</span> ・ <span className="text-violet-700">Kin</span> ・ <span className="text-emerald-700">Ele1</span> ・ <span className="text-amber-700">Ele2</span>
              </p>
            </div>
          </div>

          {!remote && (
          <button
            onClick={handleResetData}
            className="text-xs text-slate-500 hover:text-rose-700 flex items-center gap-1 self-start sm:self-auto bg-white hover:bg-rose-50 px-3 py-1.5 rounded-xl border border-slate-200 transition"
            title={L('サンプルデータを初期状態にリセット', 'Reset sample data to its initial state')}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{L('デモデータ初期化', 'Reset Demo Data')}</span>
          </button>
          )}
        </div>

        {/* View Mode Switching */}
        {viewMode === 'parent' ? (
          <ParentDashboard
            students={students}
            selectedStudentId={selectedStudentId}
            onSelectStudent={setSelectedStudentId}
            absences={absences}
            bookings={bookings}
            overrides={overrides}
            weekdayQuotas={weekdayQuotas}
            specialDays={specialDays}
            onSubmitAbsence={handleReportAbsence}
            onBookTransfer={handleBookTransfer}
            onCancelBooking={handleCancelBooking}
            onCancelAbsence={handleCancelAbsence}
            onUpdateCredentials={handleUpdateCredentials}
            onRemoteLogin={remote ? remoteParentLogin : undefined}
            onLogout={remote ? remoteParentLogout : undefined}
          />
        ) : remote && !adminToken ? (
          <AdminLogin onLogin={remoteAdminLogin} />
        ) : (
          <AdminDashboard
            students={students}
            absences={absences}
            bookings={bookings}
            overrides={overrides}
            weekdayQuotas={weekdayQuotas}
            specialDays={specialDays}
            sheetsConfig={sheetsConfig}
            lastSync={lastSync}
            syncLogs={syncLogs}
            onOpenSheetsModal={() => setIsSheetsModalOpen(true)}
            onSyncSheets={handleSyncSheets}
            isSyncing={isSyncing}
            onUpdateTransferBalance={handleUpdateTransferBalance}
            onAddStudent={handleAddStudent}
            onSaveOverride={handleSaveOverride}
            onDeleteOverride={handleDeleteOverride}
            onSaveWeekdayQuotas={handleSaveWeekdayQuotas}
            onSaveSpecialDays={handleSaveSpecialDays}
            onImportCodmonStudents={handleImportCodmonStudents}
            onImportCodmonAbsences={handleImportCodmonAbsences}
            onApplyCodmonDailySync={handleApplyCodmonDailySync}
          />
        )}

      </main>

      {/* Google Sheets Modal */}
      <GoogleSheetsModal
        isOpen={isSheetsModalOpen}
        onClose={() => setIsSheetsModalOpen(false)}
        sheetsConfig={sheetsConfig}
        onSaveSheetsConfig={setSheetsConfig}
        onImportFromSheet={handleImportFromSheet}
        remoteSpreadsheetUrl={remote ? spreadsheetUrl : undefined}
        data={{
          students,
          absences,
          bookings,
          overrides
        }}
      />

      {/* Footer */}
      <footer className="bg-slate-100 text-slate-500 border-t border-slate-200 py-5 px-4 text-center text-xs space-y-2">
        <div className="flex flex-wrap items-center justify-center gap-2.5">
          <p>© SOLTILO GSA International School - Afterschool Transfer Management System</p>
          <span className="text-slate-300 hidden sm:inline">|</span>
          {!remote && (
          <>
          <span className="text-amber-800 font-medium bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md text-[11px]">
            {L('※ 公開デモ版: 表示中の生徒名・保護者名はすべて架空のサンプルデータです', 'Demo: all student and guardian names shown are fictional samples.')}
          </span>
          <button
            type="button"
            onClick={handleResetData}
            className="text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-300 px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
            title={L('サンプルデータを初期状態にリセット', 'Reset sample data to its initial state')}
          >
            <RotateCcw className="w-3 h-3 text-sky-600" />
            <span>{L('サンプルデータ初期化', 'Reset Sample Data')}</span>
          </button>
          </>
          )}
        </div>
      </footer>

    </div>
  );
}
