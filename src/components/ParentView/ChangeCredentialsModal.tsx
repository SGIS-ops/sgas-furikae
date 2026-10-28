import React, { useState } from 'react';
import { Student } from '../../types';
import { X, Key, CheckCircle2, AlertCircle } from 'lucide-react';
import { useTranslation } from '../../lib/i18n';

interface ChangeCredentialsModalProps {
  student: Student;
  isOpen: boolean;
  onClose: () => void;
  onUpdateCredentials: (data: { studentId: string; newLoginId: string; newPassword: string }) => boolean | void | Promise<boolean>;
}

const ChangeCredentialsModalInner: React.FC<ChangeCredentialsModalProps> = ({
  student,
  isOpen,
  onClose,
  onUpdateCredentials
}) => {

  const [newLoginId, setNewLoginId] = useState(student.loginId);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const { language } = useTranslation();
  const L = (ja: string, en: string) => (language === 'en' ? en : ja);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!newLoginId.trim()) {
      setErrorMsg(L('ログインIDを入力してください。', 'Please enter a login ID.'));
      return;
    }

    if (newPassword.length < 6) {
      setErrorMsg(L('パスワードは6文字以上で設定してください。', 'Password must be at least 6 characters.'));
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg(L('確認用パスワードが一致しません。', 'The passwords do not match.'));
      return;
    }

    const accepted = await onUpdateCredentials({
      studentId: student.id,
      newLoginId: newLoginId.trim(),
      newPassword
    });
    if (accepted === false) {
      setErrorMsg(L('変更できませんでした。ログインIDが他の方と重複していないかご確認ください。', 'Could not update. The login ID may already be in use.'));
      return;
    }

    setSuccessMsg(L('ログインID・パスワードを変更しました！次回から変更後のパスワードでログインできます。', 'Login ID and password updated. Use the new password next time you sign in.'));
    setTimeout(() => {
      setSuccessMsg(null);
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="bg-[#1F3C6B] text-white p-5 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/10 text-white flex items-center justify-center">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">{L('ID・パスワードの個別変更', 'Change Login ID & Password')}</h2>
              <p className="text-xs text-blue-200">{L('Codmon初期情報の変更設定', 'Replace the initial CoDMON credentials')}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-blue-200 hover:text-white p-1.5 rounded-lg hover:bg-blue-900 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        {successMsg ? (
          <div className="p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <p className="text-sm font-bold text-slate-800">{successMsg}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
            
            {errorMsg && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-3 flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                {L('ログインID', 'Login ID')}
              </label>
              <input
                type="text"
                required
                value={newLoginId}
                onChange={(e) => setNewLoginId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                {L('新しいパスワード（6文字以上）', 'New password (6+ characters)')}
              </label>
              <input
                type="password"
                required
                placeholder={L('新しいパスワードをご入力ください', 'Enter a new password')}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                {L('新しいパスワード（確認用）', 'Confirm new password')}
              </label>
              <input
                type="password"
                required
                placeholder={L('もう一度入力してください', 'Enter it again')}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div className="pt-3 flex justify-end space-x-2 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 font-semibold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition"
              >
                {L('キャンセル', 'Cancel')}
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-[#1F3C6B] hover:bg-blue-900 text-white font-bold rounded-xl shadow-xs transition"
              >
                {L('変更を保存する', 'Save Changes')}
              </button>
            </div>

          </form>
        )}

      </div>
    </div>
  );
};

// フックを常に同じ順で呼ぶため、開いている間だけ中身をマウントする（閉じるたびに入力状態もリセットされる）
export const ChangeCredentialsModal: React.FC<ChangeCredentialsModalProps> = (props) => (props.isOpen ? <ChangeCredentialsModalInner {...props} /> : null);
