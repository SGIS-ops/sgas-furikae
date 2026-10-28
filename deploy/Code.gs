/** @OnlyCurrentDoc */
// SOLTILO GSA 振替・欠席管理 サーバー（自動生成ファイル。直接編集しないこと）
// 生成元: gas/server.ts（npm run build:gas）  生成日時: 2026-10-28T15:29:41.614Z
var SGAS = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // gas/server.ts
  var server_exports = {};
  __export(server_exports, {
    doGet: () => doGet,
    doPost: () => doPost,
    filterForFamily: () => filterForFamily,
    handle: () => handle,
    hashPassword: () => hashPassword,
    loadState: () => loadState,
    saveState: () => saveState,
    setupEmpty: () => setupEmpty,
    setupWithSampleData: () => setupWithSampleData
  });

  // src/data/constants.ts
  var SOLTILO_CLASSES = [
    {
      id: "ex1",
      name: "EX1",
      jpName: "EX1",
      ageRange: "",
      defaultCapacity: 20,
      // 振替枠を含めた最大定員
      defaultTransferQuota: 2,
      // 1日あたりの振替受入枠
      scheduleDays: [1, 2, 3, 4, 5],
      color: "emerald",
      badgeBg: "bg-emerald-50 text-emerald-700 border-emerald-200",
      badgeText: "text-emerald-700"
    },
    {
      id: "ex2",
      name: "EX2",
      jpName: "EX2",
      ageRange: "",
      defaultCapacity: 20,
      // 振替枠を含めた最大定員
      defaultTransferQuota: 2,
      // 1日あたりの振替受入枠
      scheduleDays: [1, 2, 3, 4, 5],
      color: "teal",
      badgeBg: "bg-teal-50 text-teal-700 border-teal-200",
      badgeText: "text-teal-700"
    },
    {
      id: "kin",
      name: "Kin",
      jpName: "Kin",
      ageRange: "",
      defaultCapacity: 20,
      // 振替枠を含めた最大定員
      defaultTransferQuota: 2,
      // 1日あたりの振替受入枠
      scheduleDays: [1, 2, 3, 4, 5],
      color: "sky",
      badgeBg: "bg-sky-50 text-sky-700 border-sky-200",
      badgeText: "text-sky-700"
    },
    {
      id: "ele1",
      name: "Ele1",
      jpName: "Ele1",
      ageRange: "",
      defaultCapacity: 20,
      // 振替枠を含めた最大定員
      defaultTransferQuota: 2,
      // 1日あたりの振替受入枠
      scheduleDays: [1, 2, 3, 4, 5],
      color: "indigo",
      badgeBg: "bg-indigo-50 text-indigo-700 border-indigo-200",
      badgeText: "text-indigo-700"
    },
    {
      id: "ele2",
      name: "Ele2",
      jpName: "Ele2",
      ageRange: "",
      defaultCapacity: 20,
      // 振替枠を含めた最大定員
      defaultTransferQuota: 2,
      // 1日あたりの振替受入枠
      scheduleDays: [1, 2, 3, 4, 5],
      color: "violet",
      badgeBg: "bg-violet-50 text-violet-700 border-violet-200",
      badgeText: "text-violet-700"
    }
  ];
  var MAX_TOTAL_CAPACITY_LIMIT = 20;
  var DEFAULT_TRANSFER_QUOTA = 2;

  // src/lib/dateUtils.ts
  var toLocalDateString = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };
  var getTodayString = () => toLocalDateString(/* @__PURE__ */ new Date());
  var addDaysToDateString = (dateStr, days) => {
    const [y, m, d] = dateStr.split("-").map(Number);
    return toLocalDateString(new Date(y, m - 1, d + days));
  };
  var getDayOfWeek = (dateStr) => {
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(y, m - 1, d).getDay();
  };
  var diffDays = (a, b) => {
    const [ay, am, ad] = a.split("-").map(Number);
    const [by, bm, bd] = b.split("-").map(Number);
    return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 864e5);
  };

  // src/lib/capacity.ts
  var getClassCapacityForDate = (dateStr, classId, students, absences, bookings, overrides, weekdayQuotas, specialDays) => {
    var _a;
    const dayOfWeek = getDayOfWeek(dateStr);
    const specialDay = specialDays == null ? void 0 : specialDays.find((s) => s.date === dateStr);
    const override = overrides.find((o) => o.date === dateStr && o.classId === classId);
    const weekdayConfig = (_a = weekdayQuotas == null ? void 0 : weekdayQuotas[classId]) == null ? void 0 : _a[dayOfWeek];
    let maxTotalCapacity = MAX_TOTAL_CAPACITY_LIMIT;
    if ((override == null ? void 0 : override.maxTotalCapacity) !== void 0) {
      maxTotalCapacity = override.maxTotalCapacity;
    } else if ((weekdayConfig == null ? void 0 : weekdayConfig.maxTotalCapacity) !== void 0) {
      maxTotalCapacity = weekdayConfig.maxTotalCapacity;
    }
    maxTotalCapacity = Math.max(0, Math.min(maxTotalCapacity, MAX_TOTAL_CAPACITY_LIMIT));
    let maxTransferQuota = DEFAULT_TRANSFER_QUOTA;
    if ((override == null ? void 0 : override.maxTransferQuota) !== void 0) {
      maxTransferQuota = override.maxTransferQuota;
    } else if (specialDay && specialDay.transferQuota !== void 0) {
      maxTransferQuota = specialDay.transferQuota;
    } else if ((weekdayConfig == null ? void 0 : weekdayConfig.maxTransferQuota) !== void 0) {
      maxTransferQuota = weekdayConfig.maxTransferQuota;
    }
    const regularEnrolled = students.filter(
      (s) => s.classId === classId && s.regularDays.includes(dayOfWeek)
    );
    const regularEnrolledCount = regularEnrolled.length;
    const regularIds = new Set(regularEnrolled.map((s) => s.id));
    const absentCount = new Set(
      absences.filter((a) => a.date === dateStr && a.status === "confirmed" && regularIds.has(a.studentId)).map((a) => a.studentId)
    ).size;
    const regularPresentCount = Math.max(0, regularEnrolledCount - absentCount);
    const activeBookings = bookings.filter(
      (b) => b.targetClassId === classId && b.targetDate === dateStr && b.status === "booked"
    );
    const transferBookedCount = activeBookings.length;
    const totalPresentCount = regularPresentCount + transferBookedCount;
    const remainingTransferSlots = Math.max(0, maxTransferQuota - transferBookedCount);
    const remainingTotalSlots = Math.max(0, maxTotalCapacity - totalPresentCount);
    let canAcceptTransfer = remainingTransferSlots > 0 && remainingTotalSlots > 0;
    if (specialDay) {
      if (specialDay.allowTransfers === false) {
        canAcceptTransfer = false;
      }
    } else if (override == null ? void 0 : override.isCancelled) {
      canAcceptTransfer = false;
    } else if (weekdayConfig && !weekdayConfig.isOpen) {
      canAcceptTransfer = false;
    }
    return {
      date: dateStr,
      classId,
      dayOfWeek,
      regularEnrolledCount,
      absentCount,
      regularPresentCount,
      transferBookedCount,
      totalPresentCount,
      maxTotalCapacity,
      maxTransferQuota,
      remainingTransferSlots,
      remainingTotalSlots,
      canAcceptTransfer,
      isSpecialDay: !!specialDay,
      specialDayInfo: specialDay
    };
  };

  // src/lib/expiration.ts
  var EXPIRY_ALERT_DAYS = 14;
  var calculateExpiryDate = (absenceDateStr, monthsToAdd = 2) => {
    try {
      const [yStr, mStr] = absenceDateStr.split("-");
      const year = parseInt(yStr, 10);
      const month = parseInt(mStr, 10) - 1;
      const targetLastDay = new Date(year, month + 1 + monthsToAdd, 0);
      const y = targetLastDay.getFullYear();
      const m = String(targetLastDay.getMonth() + 1).padStart(2, "0");
      const d = String(targetLastDay.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    } catch {
      const d = new Date(absenceDateStr);
      d.setDate(d.getDate() + 90);
      return toLocalDateString(d);
    }
  };
  var getDaysRemaining = (expiryDateStr, today = getTodayString()) => {
    if (!expiryDateStr) return 0;
    return diffDays(today, expiryDateStr);
  };
  var getStudentTransferTickets = (studentId, absences, bookings, today = getTodayString()) => {
    const studentAbsences = absences.filter((a) => a.studentId === studentId && a.status === "confirmed" && a.creditGranted && !a.creditExpired).sort((a, b) => a.date.localeCompare(b.date));
    const consumingBookings = bookings.filter((b) => b.studentId === studentId && b.status !== "cancelled").sort((a, b) => a.bookedAt.localeCompare(b.bookedAt));
    const allocation = /* @__PURE__ */ new Map();
    for (const booking2 of consumingBookings) {
      const bookedOn = toLocalDateString(new Date(booking2.bookedAt));
      const ticket = studentAbsences.find((abs) => {
        const expiry = abs.expiryDate || calculateExpiryDate(abs.date);
        return !allocation.has(abs.id) && expiry >= bookedOn;
      });
      if (ticket) allocation.set(ticket.id, booking2);
    }
    return studentAbsences.map((abs) => {
      const expiryDate = abs.expiryDate || calculateExpiryDate(abs.date);
      const daysRemaining = getDaysRemaining(expiryDate, today);
      const isExpired = daysRemaining < 0;
      const isExpiringSoon = daysRemaining >= 0 && daysRemaining <= EXPIRY_ALERT_DAYS;
      const linked = allocation.get(abs.id);
      return {
        absenceId: abs.id,
        absenceDate: abs.date,
        reason: abs.reason,
        expiryDate,
        daysRemaining,
        isExpired,
        isExpiringSoon,
        isBooked: !!linked,
        linkedBookingDate: linked == null ? void 0 : linked.targetDate,
        linkedBookingId: linked == null ? void 0 : linked.id
      };
    });
  };
  var applyTicketExpirations = (students, absences, bookings, today = getTodayString()) => {
    const expiredIds = /* @__PURE__ */ new Set();
    const deductions = /* @__PURE__ */ new Map();
    for (const student of students) {
      const expired = getStudentTransferTickets(student.id, absences, bookings, today).filter(
        (t) => t.isExpired && !t.isBooked
      );
      if (expired.length === 0) continue;
      expired.forEach((t) => expiredIds.add(t.absenceId));
      deductions.set(student.id, expired.length);
    }
    if (expiredIds.size === 0) return { students, absences, expiredCount: 0 };
    return {
      students: students.map(
        (s) => deductions.has(s.id) ? { ...s, transferBalance: Math.max(0, s.transferBalance - deductions.get(s.id)) } : s
      ),
      absences: absences.map((a) => expiredIds.has(a.id) ? { ...a, creditExpired: true } : a),
      expiredCount: expiredIds.size
    };
  };

  // src/lib/holidayGrants.ts
  var HOLIDAY_GRANT_REASON = "祝日休講（要振替）";
  var grantId = (date, studentId) => `abs_hol_${date}_${studentId}`;
  var syncHolidayGrants = (students, absences, specialDays) => {
    const grantDays = specialDays.filter((d) => d.grantsTransfer);
    const wanted = /* @__PURE__ */ new Set();
    const newRecords = [];
    for (const day of grantDays) {
      const weekday = getDayOfWeek(day.date);
      for (const s of students) {
        if (!s.regularDays.includes(weekday)) continue;
        const id = grantId(day.date, s.id);
        wanted.add(id);
        const exists = absences.some(
          (a) => a.id === id || a.studentId === s.id && a.date === day.date && a.status === "confirmed"
        );
        if (exists) continue;
        newRecords.push({
          id,
          studentId: s.id,
          studentName: s.name,
          classId: s.classId,
          date: day.date,
          reason: HOLIDAY_GRANT_REASON,
          reportedAt: (/* @__PURE__ */ new Date()).toISOString(),
          status: "confirmed",
          creditGranted: true,
          expiryDate: calculateExpiryDate(day.date)
        });
      }
    }
    const revokeIds = new Set(
      absences.filter((a) => a.id.startsWith("abs_hol_") && a.status === "confirmed" && !wanted.has(a.id)).map((a) => a.id)
    );
    if (newRecords.length === 0 && revokeIds.size === 0) {
      return { students, absences, granted: 0, revoked: 0 };
    }
    const delta = /* @__PURE__ */ new Map();
    newRecords.forEach((r) => {
      var _a;
      return delta.set(r.studentId, ((_a = delta.get(r.studentId)) != null ? _a : 0) + 1);
    });
    absences.filter((a) => revokeIds.has(a.id) && !a.creditExpired).forEach((a) => {
      var _a;
      return delta.set(a.studentId, ((_a = delta.get(a.studentId)) != null ? _a : 0) - 1);
    });
    return {
      students: students.map(
        (s) => delta.has(s.id) ? { ...s, transferBalance: Math.max(0, s.transferBalance + delta.get(s.id)) } : s
      ),
      absences: [
        ...newRecords,
        ...absences.map((a) => revokeIds.has(a.id) ? { ...a, status: "cancelled" } : a)
      ],
      granted: newRecords.length,
      revoked: revokeIds.size
    };
  };

  // src/lib/holidays.ts
  var JAPANESE_HOLIDAYS = {
    // 2025
    "2025-01-01": "元日",
    "2025-01-13": "成人の日",
    "2025-02-11": "建国記念の日",
    "2025-02-23": "天皇誕生日",
    "2025-02-24": "振替休日",
    "2025-03-20": "春分の日",
    "2025-04-29": "昭和の日",
    "2025-05-03": "憲法記念日",
    "2025-05-04": "みどりの日",
    "2025-05-05": "こどもの日",
    "2025-05-06": "振替休日",
    "2025-07-21": "海の日",
    "2025-08-11": "山の日",
    "2025-09-15": "敬老の日",
    "2025-09-23": "秋分の日",
    "2025-10-13": "スポーツの日",
    "2025-11-03": "文化の日",
    "2025-11-23": "勤労感謝の日",
    "2025-11-24": "振替休日",
    // 2026
    "2026-01-01": "元日",
    "2026-01-12": "成人の日",
    "2026-02-11": "建国記念の日",
    "2026-02-23": "天皇誕生日",
    "2026-03-20": "春分の日",
    "2026-04-29": "昭和の日",
    "2026-05-03": "憲法記念日",
    "2026-05-04": "みどりの日",
    "2026-05-05": "こどもの日",
    "2026-05-06": "振替休日",
    "2026-07-20": "海の日",
    "2026-08-11": "山の日",
    "2026-09-21": "敬老の日",
    "2026-09-22": "国民の祝日",
    "2026-09-23": "秋分の日",
    "2026-10-12": "スポーツの日",
    "2026-11-03": "文化の日",
    "2026-11-23": "勤労感謝の日",
    // 2027
    "2027-01-01": "元日",
    "2027-01-11": "成人の日",
    "2027-02-11": "建国記念の日",
    "2027-02-23": "天皇誕生日",
    "2027-03-21": "春分の日",
    "2027-03-22": "振替休日",
    "2027-04-29": "昭和の日",
    "2027-05-03": "憲法記念日",
    "2027-05-04": "みどりの日",
    "2027-05-05": "こどもの日",
    "2027-07-19": "海の日",
    "2027-08-11": "山の日",
    "2027-09-20": "敬老の日",
    "2027-09-23": "秋分の日",
    "2027-10-11": "スポーツの日",
    "2027-11-03": "文化の日",
    "2027-11-23": "勤労感謝の日"
  };
  function getHolidayName(dateStr) {
    return JAPANESE_HOLIDAYS[dateStr] || null;
  }

  // src/lib/operations.ts
  var fail = (code, params) => ({ ok: false, code, params });
  var operationErrorMessage = (code, params = {}, language = "ja") => {
    var _a;
    const d = (_a = params.date) != null ? _a : "";
    const m = {
      student_not_found: ["生徒が見つかりません", "Student not found."],
      duplicate_absence: [`${d} は既に欠席連絡済みです（振替残数は変わりません）`, `An absence for ${d} is already on record (credits unchanged).`],
      not_class_day: [`${d} は通常の通学日ではないため、欠席連絡は不要です`, `${d} is not a regular class day, so no absence report is needed.`],
      no_credits: ["振替残数が足りません", "Not enough make-up credits."],
      duplicate_booking: [`${d} は既に振替予約済みです`, `A make-up is already booked for ${d}.`],
      slot_unavailable: [`${d} は満席または受付対象外のため予約できませんでした`, `${d} is full or not accepting make-ups.`],
      not_found: ["対象の記録が見つかりません", "Record not found."],
      login_id_taken: ["このログインIDは既に使われています", "This login ID is already in use."],
      invalid_credentials: ["ログインIDかパスワードが正しくありません", "Invalid login ID or password."],
      invalid_input: ["入力内容を確認してください（パスワードは6文字以上）", "Please check your input (password: 6+ characters)."],
      session_expired: ["ログインの有効期限が切れました。もう一度ログインしてください", "Your session has expired. Please sign in again."],
      forbidden: ["この操作はできません", "You are not allowed to do this."],
      admin_password_not_set: ["管理者パスワードが未設定です（スクリプトプロパティ ADMIN_PASSWORD）", "Admin password is not set on the server."],
      server_error: ["サーバーでエラーが発生しました。時間をおいて再度お試しください", "A server error occurred. Please try again later."],
      network: ["サーバーに接続できませんでした。通信状況を確認してください", "Could not reach the server. Check your connection."]
    };
    const pair = m[code];
    if (!pair) return language === "en" ? "The operation could not be completed." : "処理できませんでした";
    return language === "en" ? pair[1] : pair[0];
  };
  var newId = (prefix) => `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1e5)}`;
  var reportAbsence = (state, input) => {
    const student = state.students.find((s) => s.id === input.studentId);
    if (!student) return fail("student_not_found");
    if (state.absences.some((a) => a.studentId === input.studentId && a.date === input.date && a.status === "confirmed")) {
      return fail("duplicate_absence", { date: input.date });
    }
    const specialDay = state.specialDays.find((s) => s.date === input.date);
    const isClosedDay = !!getHolidayName(input.date) && (specialDay == null ? void 0 : specialDay.type) !== "special_open" || (specialDay == null ? void 0 : specialDay.type) === "closed" || (specialDay == null ? void 0 : specialDay.type) === "holiday_transfer";
    if (!student.regularDays.includes(getDayOfWeek(input.date)) || isClosedDay) {
      return fail("not_class_day", { date: input.date });
    }
    const record = {
      id: newId("abs"),
      studentId: student.id,
      studentName: student.name,
      classId: student.classId,
      date: input.date,
      reason: input.reason,
      reportedAt: (/* @__PURE__ */ new Date()).toISOString(),
      status: "confirmed",
      creditGranted: true,
      expiryDate: calculateExpiryDate(input.date)
    };
    return {
      ok: true,
      state: {
        ...state,
        absences: [record, ...state.absences],
        students: state.students.map((s) => s.id === student.id ? { ...s, transferBalance: s.transferBalance + 1 } : s)
      }
    };
  };
  var bookTransfer = (state, input) => {
    var _a;
    const student = state.students.find((s) => s.id === input.studentId);
    if (!student) return fail("student_not_found");
    if (student.transferBalance <= 0) return fail("no_credits");
    if (state.bookings.some((b) => b.studentId === student.id && b.targetDate === input.targetDate && b.status === "booked")) {
      return fail("duplicate_booking", { date: input.targetDate });
    }
    const targetClassId = (_a = input.targetClassId) != null ? _a : student.classId;
    const cap = getClassCapacityForDate(
      input.targetDate,
      targetClassId,
      state.students,
      state.absences,
      state.bookings,
      state.overrides,
      state.weekdayQuotas,
      state.specialDays
    );
    if (!cap.canAcceptTransfer || input.targetDate <= getTodayString()) {
      return fail("slot_unavailable", { date: input.targetDate });
    }
    const booking2 = {
      id: newId("tb"),
      studentId: student.id,
      studentName: student.name,
      fromClassId: student.classId,
      targetClassId,
      targetDate: input.targetDate,
      bookedAt: (/* @__PURE__ */ new Date()).toISOString(),
      status: "booked",
      note: "振替予約"
    };
    return {
      ok: true,
      state: {
        ...state,
        bookings: [booking2, ...state.bookings],
        students: state.students.map(
          (s) => s.id === student.id ? { ...s, transferBalance: Math.max(0, s.transferBalance - 1) } : s
        )
      }
    };
  };
  var cancelBooking = (state, bookingId) => {
    const target = state.bookings.find((b) => b.id === bookingId && b.status === "booked");
    if (!target) return fail("not_found");
    return {
      ok: true,
      state: {
        ...state,
        bookings: state.bookings.map((b) => b.id === bookingId ? { ...b, status: "cancelled" } : b),
        students: state.students.map(
          (s) => s.id === target.studentId ? { ...s, transferBalance: s.transferBalance + 1 } : s
        )
      }
    };
  };
  var cancelAbsence = (state, absenceId) => {
    const target = state.absences.find((a) => a.id === absenceId && a.status === "confirmed");
    if (!target) return fail("not_found");
    return {
      ok: true,
      state: {
        ...state,
        absences: state.absences.map((a) => a.id === absenceId ? { ...a, status: "cancelled" } : a),
        students: state.students.map(
          (s) => s.id === target.studentId && target.creditGranted && !target.creditExpired ? { ...s, transferBalance: Math.max(0, s.transferBalance - 1) } : s
        )
      }
    };
  };
  var runMaintenance = (state, today = getTodayString()) => {
    const granted = syncHolidayGrants(state.students, state.absences, state.specialDays);
    const expired = applyTicketExpirations(granted.students, granted.absences, state.bookings, today);
    const changed = granted.granted + granted.revoked + expired.expiredCount > 0;
    return changed ? { state: { ...state, students: expired.students, absences: expired.absences }, changed } : { state, changed };
  };
  var familyStudentIds = (students, studentId) => {
    var _a;
    const me = students.find((s) => s.id === studentId);
    if (!me) return [];
    if (!((_a = me.parentName) == null ? void 0 : _a.trim())) return [me.id];
    return students.filter((s) => s.parentName === me.parentName).map((s) => s.id);
  };

  // src/lib/sync.ts
  var LIST_KEYS = ["students", "absences", "bookings", "overrides", "specialDays", "codmonSyncLogs"];
  var recordKey = (list, r) => list === "overrides" ? `${r.date}|${r.classId}` : String(r.id);
  var same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  var applyChanges = (current, changes) => {
    const state = { ...current };
    const conflicts = [];
    let applied = 0;
    for (const list of LIST_KEYS) {
      const items = changes.lists[list];
      if (!items) continue;
      const records = [...state[list]];
      for (const ch of items) {
        const idx = records.findIndex((r) => recordKey(list, r) === ch.key);
        const cur = idx === -1 ? null : records[idx];
        if (!same(cur, ch.base)) {
          if (!same(cur, ch.next)) conflicts.push({ list, key: ch.key });
          continue;
        }
        if (ch.next === null) records.splice(idx, 1);
        else if (idx === -1) records.unshift(ch.next);
        else records[idx] = ch.next;
        applied++;
      }
      state[list] = records;
    }
    if (changes.weekdayQuotas) {
      if (same(state.weekdayQuotas, changes.weekdayQuotas.base)) {
        state.weekdayQuotas = changes.weekdayQuotas.next;
        applied++;
      } else if (!same(state.weekdayQuotas, changes.weekdayQuotas.next)) {
        conflicts.push({ list: "weekdayQuotas", key: "*" });
      }
    }
    return { state, applied, conflicts };
  };

  // src/lib/codmonParser.ts
  function matchClassIdOrNull(rawText) {
    const t = rawText.toLowerCase();
    if (/(?<![a-z])ele(?:mentary)?\s*-?\s*2(?![0-9])|エレメンタリー\s*2/.test(t)) return "ele2";
    if (/(?<![a-z])ele(?:mentary)?\s*-?\s*1(?![0-9])|エレメンタリー\s*1/.test(t)) return "ele1";
    if (/(?<![a-z])ex(?:tension)?\s*-?\s*2(?![0-9])|エクステンション\s*2/.test(t)) return "ex2";
    if (/(?<![a-z])ex(?:tension)?\s*-?\s*1(?![0-9])|(?<![a-z])extension(?![a-z])|エクステンション/.test(t)) return "ex1";
    if (/(?<![a-z])kin(?:der)?(?![a-z])|キンダー/.test(t)) return "kin";
    if (/(?<![a-z])e\s*-?\s*2(?![0-9])/.test(t)) return "ele2";
    if (/(?<![a-z])e\s*-?\s*1(?![0-9])/.test(t)) return "ele1";
    return null;
  }
  function parseDaysOfWeek(raw) {
    const clean = raw.toLowerCase();
    const days = [];
    const map = {
      "月": 1,
      "mon": 1,
      "monday": 1,
      "1": 1,
      "火": 2,
      "tue": 2,
      "tuesday": 2,
      "2": 2,
      "水": 3,
      "wed": 3,
      "wednesday": 3,
      "3": 3,
      "木": 4,
      "thu": 4,
      "thursday": 4,
      "4": 4,
      "金": 5,
      "fri": 5,
      "friday": 5,
      "5": 5,
      "土": 6,
      "sat": 6,
      "saturday": 6,
      "6": 6,
      "日": 0,
      "sun": 0,
      "sunday": 0,
      "0": 0
    };
    if (clean.includes("月") || clean.includes("mon")) days.push(1);
    if (clean.includes("火") || clean.includes("tue")) days.push(2);
    if (clean.includes("水") || clean.includes("wed")) days.push(3);
    if (clean.includes("木") || clean.includes("thu")) days.push(4);
    if (clean.includes("金") || clean.includes("fri")) days.push(5);
    if (days.length === 0) {
      const tokens = clean.split(/[,、\s/・+]+/);
      for (const tok of tokens) {
        if (map[tok] !== void 0 && !days.includes(map[tok])) {
          days.push(map[tok]);
        }
      }
    }
    return days.length > 0 ? Array.from(new Set(days)).sort() : [1, 3];
  }

  // src/lib/googleSheets.ts
  var SHEET_TITLES = {
    students: "生徒マスタ",
    absences: "欠席履歴",
    bookings: "振替予約"
  };
  var DAY_NAMES = ["日", "月", "火", "水", "木", "金", "土"];
  var className = (classId) => {
    var _a, _b;
    return (_b = (_a = SOLTILO_CLASSES.find((c) => c.id === classId)) == null ? void 0 : _a.name) != null ? _b : classId;
  };
  var formatDateTime = (iso) => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return `${toLocalDateString(d)} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };
  var buildStudentRows = (students) => [
    ["ID", "氏名 (名前 (英語))", "クラス", "通塾曜日", "チケット残数", "備考"],
    ...students.map((s) => {
      var _a;
      return [
        s.id,
        s.name,
        className(s.classId),
        s.regularDays.map((d) => DAY_NAMES[d]).join(","),
        s.transferBalance,
        (_a = s.notes) != null ? _a : ""
      ];
    })
  ];
  var buildAbsenceRows = (absences, bookings) => {
    const used = /* @__PURE__ */ new Set();
    for (const studentId of new Set(absences.map((a) => a.studentId))) {
      getStudentTransferTickets(studentId, absences, bookings).filter((t) => t.isBooked).forEach((t) => used.add(t.absenceId));
    }
    return [
      ["欠席ID", "生徒ID", "生徒名", "クラス", "欠席日", "理由", "有効期限", "振替消化済"],
      ...absences.filter((a) => a.status === "confirmed" && a.creditGranted).map((a) => {
        var _a;
        return [
          a.id,
          a.studentId,
          a.studentName,
          className(a.classId),
          a.date,
          a.reason,
          (_a = a.expiryDate) != null ? _a : "",
          used.has(a.id) ? "TRUE" : "FALSE"
        ];
      })
    ];
  };
  var buildBookingRows = (absences, bookings) => {
    const originDate = /* @__PURE__ */ new Map();
    for (const studentId of new Set(bookings.map((b) => b.studentId))) {
      getStudentTransferTickets(studentId, absences, bookings).forEach((t) => {
        if (t.linkedBookingId) originDate.set(t.linkedBookingId, t.absenceDate);
      });
    }
    const statusLabel = { booked: "confirmed", attended: "attended", cancelled: "cancelled" };
    return [
      ["予約ID", "生徒ID", "生徒名", "振替先日", "対象クラス", "元の欠席日", "ステータス", "登録日時"],
      ...bookings.map((b) => {
        var _a;
        return [
          b.id,
          b.studentId,
          b.studentName,
          b.targetDate,
          className(b.targetClassId),
          (_a = originDate.get(b.id)) != null ? _a : "",
          statusLabel[b.status],
          formatDateTime(b.bookedAt)
        ];
      })
    ];
  };
  var parseStudentMasterRows = (values) => values.slice(1).map((row, i) => {
    const [id = "", name = "", cls = "", days = "", tickets = "", notes = ""] = row.map((c) => String(c != null ? c : "").trim());
    const n = Number(tickets);
    return {
      rowNumber: i + 2,
      id,
      name,
      classId: cls ? matchClassIdOrNull(cls) : null,
      regularDays: days ? parseDaysOfWeek(days) : null,
      transferBalance: tickets !== "" && Number.isInteger(n) && n >= 0 ? n : null,
      notes
    };
  }).filter((r) => r.id || r.name);
  var mergeStudentsFromSheet = (students, rows) => {
    var _a, _b, _c, _d, _e, _f;
    const normalize = (v) => v.replace(/[\s　]+/g, "");
    const next = [...students];
    const warnings = [];
    let added = 0;
    let updated = 0;
    for (const row of rows) {
      if (!row.name) {
        warnings.push(`${row.rowNumber}行目: 氏名が空欄のためスキップしました`);
        continue;
      }
      if (row.classId === null) warnings.push(`${row.rowNumber}行目 ${row.name}: クラスを判別できません（既存の値を維持）`);
      if (row.regularDays === null) warnings.push(`${row.rowNumber}行目 ${row.name}: 通塾曜日が空欄です（既存の値を維持）`);
      if (row.transferBalance === null) warnings.push(`${row.rowNumber}行目 ${row.name}: チケット残数が不正です（既存の値を維持）`);
      const byId = row.id ? next.findIndex((s) => s.id === row.id) : -1;
      const idx = byId !== -1 ? byId : next.findIndex((s) => normalize(s.name) === normalize(row.name));
      if (idx !== -1) {
        const cur = next[idx];
        const merged = {
          ...cur,
          name: row.name,
          classId: (_a = row.classId) != null ? _a : cur.classId,
          regularDays: (_b = row.regularDays) != null ? _b : cur.regularDays,
          transferBalance: (_c = row.transferBalance) != null ? _c : cur.transferBalance,
          notes: row.notes || void 0
        };
        const changed = merged.name !== cur.name || merged.classId !== cur.classId || merged.regularDays.join(",") !== cur.regularDays.join(",") || merged.transferBalance !== cur.transferBalance || ((_d = merged.notes) != null ? _d : "") !== ((_e = cur.notes) != null ? _e : "");
        if (changed) {
          next[idx] = merged;
          updated++;
        }
        continue;
      }
      if (row.classId === null || row.regularDays === null) {
        warnings.push(`${row.rowNumber}行目 ${row.name}: クラスか通塾曜日が不明なため新規登録しませんでした`);
        continue;
      }
      const id = row.id || `std_sheet_${Date.now()}_${row.rowNumber}`;
      next.push({
        id,
        name: row.name,
        classId: row.classId,
        regularDays: row.regularDays,
        transferBalance: (_f = row.transferBalance) != null ? _f : 0,
        parentName: "",
        contactEmail: "",
        loginId: `codmon_${id.replace(/^std_/, "")}`,
        password: "soltilo123",
        isDefaultPassword: true,
        notes: row.notes || void 0
      });
      added++;
    }
    return { students: next, added, updated, warnings };
  };

  // src/data/initialData.ts
  var STUDENT_SEEDS = [
    // 兄弟: 蓮・葵（同じ保護者。codmon_sample_ren でログインすると切り替えられる）
    ["std_ex1_1", "蓮", "Ren", "ex1", [1, 3], 2, "A"],
    ["std_kin_1", "葵", "Aoi", "kin", [1, 3, 5], 0, "A"],
    ["std_ex1_2", "エミリ", "Emily", "ex1", [2, 4], 1, "B"],
    ["std_ex2_1", "レオ", "Leo", "ex2", [1, 2, 4], 3, "C"],
    ["std_ex2_2", "陽菜", "Hina", "ex2", [3, 5], 1, "D"],
    ["std_kin_2", "ノア", "Noah", "kin", [1, 3, 5], 2, "E"],
    ["std_ele1_1", "翔太", "Shota", "ele1", [1, 3, 5], 1, "F"],
    ["std_ele1_2", "クロエ", "Chloe", "ele1", [2, 4], 2, "G"],
    ["std_ele1_3", "結衣", "Yui", "ele1", [1, 2, 4], 0, "H"],
    ["std_ele2_1", "オリバー", "Oliver", "ele2", [1, 3, 5], 2, "I"],
    ["std_ele2_2", "陸", "Riku", "ele2", [2, 4], 1, "J"]
  ];
  var INITIAL_STUDENTS = STUDENT_SEEDS.map(([id, jaGiven, enGiven, classId, regularDays, balance, parentKey]) => ({
    id,
    name: `サンプル ${jaGiven} (${enGiven} Sample)`,
    classId,
    regularDays,
    transferBalance: balance,
    parentName: `サンプル 保護者${parentKey} (Sample Parent ${parentKey})`,
    contactEmail: `sample.parent.${parentKey.toLowerCase()}@example.com`,
    loginId: `codmon_sample_${enGiven.toLowerCase()}`,
    password: "soltilo123",
    isDefaultPassword: true
  }));
  var studentById = (id) => INITIAL_STUDENTS.find((s) => s.id === id);
  var recentPastDay = (days, skip = 0) => {
    let d = getTodayString();
    let found = -1;
    for (let i = 0; i < 60; i++) {
      d = addDaysToDateString(d, -1);
      if (days.includes(getDayOfWeek(d)) && !getHolidayName(d)) {
        found++;
        if (found === skip) return d;
      }
    }
    return d;
  };
  var nextFutureDay = (days, minOffset = 1) => {
    let d = addDaysToDateString(getTodayString(), minOffset - 1);
    for (let i = 0; i < 60; i++) {
      d = addDaysToDateString(d, 1);
      if (days.includes(getDayOfWeek(d)) && !getHolidayName(d)) return d;
    }
    return d;
  };
  var WEEKDAYS = [1, 2, 3, 4, 5];
  var notRegular = (s) => WEEKDAYS.filter((d) => !s.regularDays.includes(d));
  var absence = (id, studentId, date, reason) => {
    const s = studentById(studentId);
    return {
      id,
      studentId,
      studentName: s.name,
      classId: s.classId,
      date,
      reason,
      reportedAt: (/* @__PURE__ */ new Date(`${date}T08:00:00`)).toISOString(),
      status: "confirmed",
      creditGranted: true,
      expiryDate: calculateExpiryDate(date)
    };
  };
  var now = /* @__PURE__ */ new Date();
  var regularDaysTwoMonthsAgo = (days) => {
    const result = [];
    for (let day = 1; day <= 28; day++) {
      const d = toLocalDateString(new Date(now.getFullYear(), now.getMonth() - 2, day));
      if (days.includes(getDayOfWeek(d)) && !getHolidayName(d)) result.push(d);
    }
    return result;
  };
  var [renOld1, renOld2] = regularDaysTwoMonthsAgo(studentById("std_ex1_1").regularDays);
  var INITIAL_ABSENCES = [
    absence("abs_1", "std_ex1_1", recentPastDay(studentById("std_ex1_1").regularDays), "体調不良・風邪"),
    absence("abs_2", "std_ex1_1", renOld1, "家庭の都合・旅行"),
    absence("abs_5", "std_ex1_1", renOld2, "体調不良・風邪"),
    absence("abs_3", "std_ex2_1", recentPastDay(studentById("std_ex2_1").regularDays, 1), "学校行事・園行事"),
    absence("abs_4", "std_ele1_2", nextFutureDay(studentById("std_ele1_2").regularDays, 2), "家庭の都合・旅行")
  ];
  var booking = (id, studentId, targetDate) => {
    const s = studentById(studentId);
    return {
      id,
      studentId,
      studentName: s.name,
      fromClassId: s.classId,
      targetClassId: s.classId,
      targetDate,
      bookedAt: (/* @__PURE__ */ new Date()).toISOString(),
      status: "booked",
      note: "振替予約済"
    };
  };
  var INITIAL_BOOKINGS = [
    booking("tb_1", "std_ex1_1", nextFutureDay(notRegular(studentById("std_ex1_1")), 3)),
    booking("tb_2", "std_ex2_1", nextFutureDay(notRegular(studentById("std_ex2_1")), 2))
  ];
  var INITIAL_WEEKDAY_QUOTAS = Object.fromEntries(
    SOLTILO_CLASSES.map((c) => [
      c.id,
      Object.fromEntries(
        WEEKDAYS.map((d) => [d, { maxTransferQuota: DEFAULT_TRANSFER_QUOTA, maxTotalCapacity: MAX_TOTAL_CAPACITY_LIMIT, isOpen: true }])
      )
    ])
  );
  var upcomingWeekdayHolidays = (count) => {
    const result = [];
    let d = getTodayString();
    for (let i = 0; i < 400 && result.length < count; i++) {
      d = addDaysToDateString(d, 1);
      const name = getHolidayName(d);
      if (name && WEEKDAYS.includes(getDayOfWeek(d))) result.push({ date: d, name });
    }
    return result;
  };
  var INITIAL_SPECIAL_DAYS = [
    ...upcomingWeekdayHolidays(2).map(
      (h, i) => ({
        id: `sp_holiday_${i + 1}`,
        date: h.date,
        type: "holiday_transfer",
        title: `${h.name}（祝日休講・要振替）`,
        badgeText: "祝(要振)",
        allowTransfers: false,
        grantsTransfer: true,
        note: "サンプル: 当日在籍生に振替チケットを付与"
      })
    ),
    {
      id: "sp_closed_sample",
      date: nextFutureDay(WEEKDAYS, 21),
      type: "closed",
      title: "休館日（サンプル）",
      badgeText: "休館",
      allowTransfers: false,
      grantsTransfer: false,
      note: "サンプルの特別日程です"
    }
  ];

  // gas/server.ts
  var DATA_SHEET = "_data";
  var IMPORT_SHEET = "名簿取込";
  var CHUNK = 4e4;
  var SESSION_SECONDS = 6 * 60 * 60;
  var DEFAULT_PASSWORD = "soltilo123";
  var ss = () => SpreadsheetApp.getActiveSpreadsheet();
  var getOrCreateSheet = (name) => ss().getSheetByName(name) || ss().insertSheet(name);
  var emptyState = () => ({
    students: [],
    absences: [],
    bookings: [],
    overrides: [],
    weekdayQuotas: INITIAL_WEEKDAY_QUOTAS,
    specialDays: [],
    codmonSyncLogs: []
  });
  var loadState = () => {
    const sheet = ss().getSheetByName(DATA_SHEET);
    if (!sheet || sheet.getLastRow() === 0) return emptyState();
    const values = sheet.getRange(1, 1, sheet.getLastRow(), 1).getValues();
    const json2 = values.map((r) => {
      var _a;
      return String((_a = r[0]) != null ? _a : "");
    }).join("");
    if (!json2) return emptyState();
    return { ...emptyState(), ...JSON.parse(json2) };
  };
  var saveState = (state) => {
    const sheet = getOrCreateSheet(DATA_SHEET);
    const json2 = JSON.stringify(state);
    const chunks = [];
    for (let i = 0; i < json2.length; i += CHUNK) chunks.push([json2.slice(i, i + CHUNK)]);
    sheet.clearContents();
    if (chunks.length) sheet.getRange(1, 1, chunks.length, 1).setValues(chunks);
    sheet.hideSheet();
    writeReadableSheets(state);
  };
  var writeReadableSheets = (state) => {
    const students = state.students.map(stripSecrets);
    const write = (name, rows) => {
      const sheet = getOrCreateSheet(name);
      sheet.clearContents();
      if (rows.length) sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
      sheet.setFrozenRows(1);
    };
    write(SHEET_TITLES.students, buildStudentRows(students));
    write(SHEET_TITLES.absences, buildAbsenceRows(state.absences, state.bookings));
    write(SHEET_TITLES.bookings, buildBookingRows(state.absences, state.bookings));
  };
  var loadMaintained = () => {
    const state = loadState();
    const result = runMaintenance(state);
    if (result.changed) saveState(result.state);
    return result.state;
  };
  var withLock = (fn) => {
    const lock = LockService.getScriptLock();
    lock.waitLock(2e4);
    try {
      return fn();
    } finally {
      lock.releaseLock();
    }
  };
  var props = () => PropertiesService.getScriptProperties();
  var getSalt = () => {
    let salt = props().getProperty("PASSWORD_SALT");
    if (!salt) {
      salt = Utilities.getUuid();
      props().setProperty("PASSWORD_SALT", salt);
    }
    return salt;
  };
  var hashPassword = (password) => Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, getSalt() + password, Utilities.Charset.UTF_8).map((b) => ((b + 256) % 256).toString(16).padStart(2, "0")).join("");
  var stripSecrets = (s) => {
    const { passwordHash: _h, password: _p, ...rest } = s;
    return rest;
  };
  var newSession = (session) => {
    const token = Utilities.getUuid();
    CacheService.getScriptCache().put(`session_${token}`, JSON.stringify(session), SESSION_SECONDS);
    return token;
  };
  var getSession = (token) => {
    if (typeof token !== "string" || !token) return null;
    const raw = CacheService.getScriptCache().get(`session_${token}`);
    return raw ? JSON.parse(raw) : null;
  };
  var passwordMatches = (s, password) => {
    if (s.passwordHash) return s.passwordHash === hashPassword(password);
    return (s.password || DEFAULT_PASSWORD) === password;
  };
  var filterForFamily = (state, familyIds) => {
    const family = new Set(familyIds);
    const anon = /* @__PURE__ */ new Map();
    const anonId = (id) => {
      if (!anon.has(id)) anon.set(id, `x${anon.size + 1}`);
      return anon.get(id);
    };
    const since = addDaysToDateString(getTodayString(), -1);
    const students = state.students.map(
      (s) => family.has(s.id) ? stripSecrets(s) : {
        id: anonId(s.id),
        name: "",
        classId: s.classId,
        regularDays: s.regularDays,
        transferBalance: 0,
        parentName: "",
        contactEmail: ""
      }
    );
    const absences = state.absences.filter((a) => family.has(a.studentId) || a.date >= since).map(
      (a) => family.has(a.studentId) ? a : {
        id: anonId(a.id),
        studentId: anonId(a.studentId),
        studentName: "",
        classId: a.classId,
        date: a.date,
        reason: "",
        reportedAt: "",
        status: a.status,
        creditGranted: a.creditGranted
      }
    );
    const bookings = state.bookings.filter((b) => family.has(b.studentId) || b.targetDate >= since).map(
      (b) => family.has(b.studentId) ? b : {
        id: anonId(b.id),
        studentId: anonId(b.studentId),
        studentName: "",
        fromClassId: b.fromClassId,
        targetClassId: b.targetClassId,
        targetDate: b.targetDate,
        bookedAt: "",
        status: b.status
      }
    );
    return {
      students,
      absences,
      bookings,
      overrides: state.overrides,
      weekdayQuotas: state.weekdayQuotas,
      specialDays: state.specialDays,
      codmonSyncLogs: []
    };
  };
  var forAdmin = (state) => ({ ...state, students: state.students.map(stripSecrets) });
  var err = (code, params = {}) => ({
    ok: false,
    code,
    params,
    message: operationErrorMessage(code, params)
  });
  var requireParent = (req) => {
    const s = getSession(req.token);
    return s && s.role === "parent" ? s : null;
  };
  var requireAdmin = (req) => {
    const s = getSession(req.token);
    return s && s.role === "admin" ? s : null;
  };
  var parentMutation = (req, studentId, op) => {
    const session = requireParent(req);
    if (!session) return err("session_expired");
    if (studentId !== null && !session.studentIds.includes(studentId)) return err("forbidden");
    return withLock(() => {
      const state = loadMaintained();
      const result = op(state);
      if (!result.ok) {
        const failure = result;
        return err(failure.code, failure.params);
      }
      saveState(result.state);
      return { ok: true, data: filterForFamily(result.state, session.studentIds) };
    });
  };
  var handle = (req) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j;
    switch (req.action) {
      case "parentLogin": {
        const loginId = String((_a = req.loginId) != null ? _a : "").trim().toLowerCase();
        const password = String((_b = req.password) != null ? _b : "");
        const state = loadMaintained();
        const student = state.students.find((s) => (s.loginId || "").toLowerCase() === loginId);
        if (!student || !passwordMatches(student, password)) return err("invalid_credentials");
        const ids = familyStudentIds(state.students, student.id);
        const token = newSession({ role: "parent", studentIds: ids });
        return { ok: true, token, studentId: student.id, data: filterForFamily(state, ids) };
      }
      case "parentGetData": {
        const session = requireParent(req);
        if (!session) return err("session_expired");
        return { ok: true, data: filterForFamily(loadMaintained(), session.studentIds) };
      }
      case "parentReportAbsence": {
        const input = req.input || {};
        return parentMutation(req, input.studentId, (state) => reportAbsence(state, input));
      }
      case "parentBookTransfer": {
        const input = req.input || {};
        return parentMutation(
          req,
          input.studentId,
          (state) => bookTransfer(state, { studentId: input.studentId, targetDate: input.targetDate })
        );
      }
      case "parentCancelBooking": {
        const bookingId = String((_c = req.bookingId) != null ? _c : "");
        const session = requireParent(req);
        if (!session) return err("session_expired");
        const owner = (_e = (_d = loadState().bookings.find((b) => b.id === bookingId)) == null ? void 0 : _d.studentId) != null ? _e : "";
        return parentMutation(req, owner, (state) => cancelBooking(state, bookingId));
      }
      case "parentCancelAbsence": {
        const absenceId = String((_f = req.absenceId) != null ? _f : "");
        const session = requireParent(req);
        if (!session) return err("session_expired");
        const target = loadState().absences.find((a) => a.id === absenceId);
        if (target && target.date < getTodayString()) return err("forbidden");
        return parentMutation(req, (_g = target == null ? void 0 : target.studentId) != null ? _g : "", (state) => cancelAbsence(state, absenceId));
      }
      case "parentChangeCredentials": {
        const input = req.input || {};
        const newLoginId = String((_h = input.newLoginId) != null ? _h : "").trim();
        const newPassword = String((_i = input.newPassword) != null ? _i : "");
        if (!newLoginId || newPassword.length < 6) return err("invalid_input");
        return parentMutation(req, input.studentId, (state) => {
          if (state.students.some((s) => s.id !== input.studentId && (s.loginId || "").toLowerCase() === newLoginId.toLowerCase())) {
            return { ok: false, code: "login_id_taken" };
          }
          return {
            ok: true,
            state: {
              ...state,
              students: state.students.map(
                (s) => s.id === input.studentId ? { ...s, loginId: newLoginId, passwordHash: hashPassword(newPassword), password: void 0, isDefaultPassword: false } : s
              )
            }
          };
        });
      }
      case "adminLogin": {
        const expected = props().getProperty("ADMIN_PASSWORD");
        if (!expected) return err("admin_password_not_set");
        if (String((_j = req.password) != null ? _j : "") !== expected) return err("invalid_credentials");
        const token = newSession({ role: "admin", studentIds: [] });
        return { ok: true, token, data: forAdmin(loadMaintained()), spreadsheetUrl: ss().getUrl() };
      }
      case "adminGetData": {
        if (!requireAdmin(req)) return err("session_expired");
        return { ok: true, data: forAdmin(loadMaintained()), spreadsheetUrl: ss().getUrl() };
      }
      case "adminSync": {
        if (!requireAdmin(req)) return err("session_expired");
        const changes = req.changes;
        return withLock(() => {
          const current = loadState();
          const secrets = new Map(current.students.map((s) => [s.id, { passwordHash: s.passwordHash, password: s.password }]));
          const result = applyChanges(forAdmin(current), changes);
          const students = result.state.students.map((s) => ({ ...s, ...secrets.get(s.id) || {} }));
          const next = { ...result.state, students };
          if (result.applied > 0) saveState(next);
          return { ok: true, data: forAdmin(next), conflicts: result.conflicts };
        });
      }
      case "adminImportFromSheet": {
        if (!requireAdmin(req)) return err("session_expired");
        return withLock(() => {
          const state = loadState();
          const sheet = ss().getSheetByName(IMPORT_SHEET);
          const values = sheet ? sheet.getDataRange().getValues() : [];
          const merged = mergeStudentsFromSheet(forAdmin(state).students, parseStudentMasterRows(values));
          const secrets = new Map(state.students.map((s) => [s.id, { passwordHash: s.passwordHash, password: s.password }]));
          const next = {
            ...state,
            students: merged.students.map((s) => ({ ...s, ...secrets.get(s.id) || {} }))
          };
          if (merged.added + merged.updated > 0) saveState(next);
          if (sheet && values.length > 1) {
            sheet.clearContents();
            sheet.getRange(1, 1, 1, values[0].length).setValues([values[0]]);
          }
          return { ok: true, data: forAdmin(next), added: merged.added, updated: merged.updated, warnings: merged.warnings };
        });
      }
      default:
        return err("unknown_action");
    }
  };
  var json = (body) => ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON);
  var doPost = (e) => {
    try {
      const req = JSON.parse(e.postData.contents);
      return json(handle(req));
    } catch (error) {
      console.error(error);
      return json(err("server_error"));
    }
  };
  var doGet = () => json({ ok: true, service: "sgas-furikae", time: (/* @__PURE__ */ new Date()).toISOString() });
  var ensureImportSheet = () => {
    if (ss().getSheetByName(IMPORT_SHEET)) return;
    const sheet = ss().insertSheet(IMPORT_SHEET);
    sheet.getRange(1, 1, 1, 6).setValues([["ID（既存の生徒を更新する場合のみ）", "氏名 (名前 (英語))", "クラス", "通塾曜日", "チケット残数", "備考"]]);
    sheet.setFrozenRows(1);
  };
  var setupWithSampleData = () => withLock(() => {
    getSalt();
    ensureImportSheet();
    const sample = runMaintenance({
      students: INITIAL_STUDENTS.map(({ password: _p, ...s }) => s),
      absences: INITIAL_ABSENCES,
      bookings: INITIAL_BOOKINGS,
      overrides: [],
      weekdayQuotas: INITIAL_WEEKDAY_QUOTAS,
      specialDays: INITIAL_SPECIAL_DAYS,
      codmonSyncLogs: []
    }).state;
    saveState(sample);
    return "サンプルデータで初期化しました";
  });
  var setupEmpty = () => withLock(() => {
    getSalt();
    ensureImportSheet();
    saveState(emptyState());
    return "空の状態で初期化しました";
  });
  return __toCommonJS(server_exports);
})();

// ---- GAS から呼ばれる関数 ----
function doGet(e) { return SGAS.doGet(e); }
function doPost(e) { return SGAS.doPost(e); }
/** テスト開始時に1回実行: 架空のサンプルデータで初期化 */
function setupWithSampleData() { Logger.log(SGAS.setupWithSampleData()); }
/** 本番開始時に1回実行: 空の名簿で初期化（既存データは消える） */
function setupEmpty() { Logger.log(SGAS.setupEmpty()); }
