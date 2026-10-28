import React, { useState } from 'react';
import { ClassId, DailyClassOverride } from '../../types';
import { SOLTILO_CLASSES, MAX_TOTAL_CAPACITY_LIMIT, DEFAULT_TRANSFER_QUOTA } from '../../data/constants';
import { X, Settings, ShieldCheck, Check } from 'lucide-react';
import { useTranslation } from '../../lib/i18n';

interface QuotaSettingsModalProps {
  isOpen: boolean;
  date: string;
  classId: ClassId;
  overrides: DailyClassOverride[];
  onClose: () => void;
  onSaveOverride: (override: DailyClassOverride) => void;
}

const QuotaSettingsModalInner: React.FC<QuotaSettingsModalProps> = ({
  isOpen,
  date,
  classId,
  overrides,
  onClose,
  onSaveOverride
}) => {
  const { language } = useTranslation();

  const currentOverride = overrides.find((o) => o.date === date && o.classId === classId);
  const targetClass = SOLTILO_CLASSES.find((c) => c.id === classId);

  const [transferQuota, setTransferQuota] = useState<number>(
    currentOverride?.maxTransferQuota ?? DEFAULT_TRANSFER_QUOTA
  );
  const [totalCapacity, setTotalCapacity] = useState<number>(
    currentOverride?.maxTotalCapacity ?? MAX_TOTAL_CAPACITY_LIMIT
  );

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveOverride({
      date,
      classId,
      maxTransferQuota: Math.min(Math.max(1, transferQuota), totalCapacity),
      maxTotalCapacity: Math.min(Math.max(1, totalCapacity), 20) // Cap at max 20
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">{language === 'en' ? 'Slots & Capacity Settings' : '枠数・定員設定'}</h2>
              <p className="text-xs text-slate-300">
                {date} ({targetClass?.jpName})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="p-6 space-y-5 text-xs">
          
          {/* Transfer Quota Setting */}
          <div>
            <label className="block font-bold text-slate-800 mb-1">
              {language === 'en' ? 'Make-up slot limit for this day (max make-up students accepted)' : '当日の振替枠上限（最大受け入れ可能振替人数）'}
            </label>
            <p className="text-slate-500 mb-2">
              {language === 'en' ? 'Default limit: up to 2 students. Adjust the number of make-up slots for a specific day as needed.' : 'デフォルト制限: 2名まで。必要に応じて特定日の振替枠数を調整できます。'}
            </p>
            <div className="flex items-center space-x-3">
              <input
                type="number"
                min="0"
                max="10"
                value={transferQuota}
                onChange={(e) => setTransferQuota(parseInt(e.target.value) || 0)}
                className="w-24 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-extrabold text-base text-slate-900 focus:ring-2 focus:ring-amber-500"
              />
              <span className="font-bold text-slate-700">{language === 'en' ? 'make-up students max' : '名様まで振替可能'}</span>
            </div>
          </div>

          {/* Total Capacity Setting */}
          <div className="pt-3 border-t border-slate-100">
            <label className="block font-bold text-slate-800 mb-1">
              {language === 'en' ? 'Total capacity for this day (regular + make-up students combined)' : '当日の総定員数（通常生 ＋ 振替生の最大合計上限）'}
            </label>
            <p className="text-slate-500 mb-2">
              {language === 'en' ? 'Standard limit: max 20 students. This is the overall capacity for the day, including make-up slots.' : '規定上限: 最大20名。振替枠を含めた当日の全体の収容制限です。'}
            </p>
            <div className="flex items-center space-x-3">
              <input
                type="number"
                min="1"
                max="20"
                value={totalCapacity}
                onChange={(e) => setTotalCapacity(parseInt(e.target.value) || 20)}
                className="w-24 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-extrabold text-base text-slate-900 focus:ring-2 focus:ring-amber-500"
              />
              <span className="font-bold text-slate-700">{language === 'en' ? 'students (max 20)' : '名（上限20名）'}</span>
            </div>
          </div>

          {/* Buttons */}
          <div className="pt-4 flex items-center justify-end space-x-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 rounded-xl transition"
            >
              {language === 'en' ? 'Cancel' : 'キャンセル'}
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl shadow transition flex items-center space-x-1"
            >
              <Check className="w-4 h-4" />
              <span>{language === 'en' ? 'Save Settings' : '設定を保存'}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};

// フックを常に同じ順で呼ぶため、開いている間だけ中身をマウントする（閉じるたびに入力状態もリセットされる）
export const QuotaSettingsModal: React.FC<QuotaSettingsModalProps> = (props) => (props.isOpen ? <QuotaSettingsModalInner {...props} /> : null);
