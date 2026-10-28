import React, { useState } from 'react';
import { Student, ClassId } from '../../types';
import { SOLTILO_CLASSES, ABSENCE_REASONS } from '../../data/constants';
import { getTransferExpiryDate } from '../../lib/holidays';
import { getTodayString } from '../../lib/dateUtils';
import { useTranslation } from '../../lib/i18n';
import { X, Calendar, AlertTriangle, CheckCircle, Clock, Info } from 'lucide-react';

interface AbsenceReportModalProps {
  student: Student;
  isOpen: boolean;
  onClose: () => void;
  onSubmitAbsence: (data: {
    studentId: string;
    studentName: string;
    classId: ClassId;
    date: string;
    reason: string;
  }) => boolean | void | Promise<boolean>;
}

const AbsenceReportModalInner: React.FC<AbsenceReportModalProps> = ({
  student,
  isOpen,
  onClose,
  onSubmitAbsence
}) => {
  const { language, t, getClassName, getReasonLabel } = useTranslation();


  const currentClass = SOLTILO_CLASSES.find((c) => c.id === student.classId);

  // Default to today or next regular day
  const todayStr = getTodayString();
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [reason, setReason] = useState<string>(ABSENCE_REASONS[0]);
  const [customReason, setCustomReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const expiryInfo = getTransferExpiryDate(selectedDate);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const finalReason = reason === 'その他' ? (customReason.trim() || 'その他') : reason;

    const accepted = await onSubmitAbsence({
      studentId: student.id,
      studentName: student.name,
      classId: student.classId,
      date: selectedDate,
      reason: finalReason
    });
    // 二重登録・通学日以外などで受け付けなかった場合は完了表示を出さない
    if (accepted === false) {
      setIsSubmitting(false);
      setErrorMessage(
        language === 'en'
          ? 'This date could not be accepted (already reported, or not a regular class day / closed day).'
          : 'この日は受け付けできませんでした（既に欠席連絡済み、または通学曜日・開校日ではありません）。'
      );
      return;
    }

    const msg = language === 'en'
      ? `Absence report sent for ${selectedDate}. +1 make-up credit granted! (Valid until: ${expiryInfo.expiryDateStr})`
      : `${selectedDate} の欠席連絡を送信しました。振替残数が1回分追加されました！（有効期限: ${expiryInfo.label}）`;
    setSuccessMessage(msg);
    setTimeout(() => {
      setIsSubmitting(false);
      setSuccessMessage(null);
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden">
        
        {/* Modal Header */}
        <div className="bg-[#1E3A8A] text-white p-5 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/10 text-white flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">{t('absence.modalTitle')}</h2>
              <p className="text-xs text-blue-200">
                {student.name} ({getClassName(student.classId)})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-blue-200 hover:text-white p-1.5 rounded-lg hover:bg-blue-900 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        {successMessage ? (
          <div className="p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
              <CheckCircle className="w-7 h-7" />
            </div>
            <p className="text-base font-bold text-slate-800">{successMessage}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            
            {/* Notice Callout */}
            <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-3.5 flex items-start space-x-3 text-xs text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">
                  {language === 'en' ? 'Make-up Credit Policy & Expiration' : '振替チケットの付与と有効期限について'}
                </p>
                <p className="text-amber-800 mt-0.5">
                  {language === 'en'
                    ? 'Reporting an absence releases your slot and automatically grants +1 make-up credit.'
                    : '欠席連絡を送信すると当日の受講枠が解放され、振替チケットが1回分付与されます。'}
                </p>
                <p className="text-amber-900 font-bold mt-1">
                  ★ {language === 'en'
                    ? `Valid until end of month after next (${expiryInfo.expiryDateStr})`
                    : `有効期限: 欠席月を含め3か月後の月末まで（今回: ${expiryInfo.label}）`}
                </p>
              </div>
            </div>

            {/* Date Selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('absence.targetDate')} <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="date"
                  required
                  value={selectedDate}
                  min={todayStr}
                  onChange={(e) => {
                    setSelectedDate(e.target.value);
                    setErrorMessage(null);
                  }}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
                />
              </div>
              <div className="mt-1 text-[11px] text-slate-500 flex items-center gap-1">
                <Info className="w-3.5 h-3.5 text-blue-600" />
                <span>
                  {language === 'en' ? 'Credit expiry for this absence: ' : 'この欠席の振替期限: '}
                  <strong className="text-slate-800">
                    {language === 'en' ? expiryInfo.expiryDateStr : expiryInfo.label}
                  </strong>
                </span>
              </div>
              {errorMessage && (
                <p role="alert" className="mt-2 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                  {errorMessage}
                </p>
              )}
            </div>

            {/* Reason Selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('absence.reason')} <span className="text-rose-500">*</span>
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
              >
                {ABSENCE_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {getReasonLabel(r)}
                  </option>
                ))}
              </select>

              {reason === 'その他' && (
                <input
                  type="text"
                  placeholder={language === 'en' ? 'Please provide details...' : '具体的な理由をご記入ください'}
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  className="w-full mt-2.5 px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              )}
            </div>

            {/* Actions */}
            <div className="pt-2 flex items-center justify-end space-x-3 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 rounded-xl transition"
              >
                {t('common.cancel')}
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-600/20 transition flex items-center space-x-1.5"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>{t('absence.submit')}</span>
              </button>
            </div>

          </form>
        )}

      </div>
    </div>
  );
};

// フックを常に同じ順で呼ぶため、開いている間だけ中身をマウントする（閉じるたびに入力状態もリセットされる）
export const AbsenceReportModal: React.FC<AbsenceReportModalProps> = (props) => (props.isOpen ? <AbsenceReportModalInner {...props} /> : null);
