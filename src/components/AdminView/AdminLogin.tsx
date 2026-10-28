import React, { useState } from 'react';
import { ShieldCheck, ArrowRight, AlertCircle } from 'lucide-react';
import { useTranslation } from '../../lib/i18n';

interface AdminLoginProps {
  /** 失敗時は Error を投げる */
  onLogin: (password: string) => Promise<void>;
}

/** サーバー版の管理者ログイン（パスワードはサーバーのスクリプトプロパティと照合） */
export const AdminLogin: React.FC<AdminLoginProps> = ({ onLogin }) => {
  const { language } = useTranslation();
  const L = (ja: string, en: string) => (language === 'en' ? en : ja);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await onLogin(password);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto my-8">
      <form onSubmit={handleSubmit} className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
        <div className="bg-slate-900 text-white p-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-900 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold">{L('スクール管理者ログイン', 'School Admin Sign-in')}</h2>
            <p className="text-xs text-slate-300">{L('職員専用の画面です', 'For school staff only')}</p>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <label htmlFor="admin-password" className="block text-xs font-bold text-slate-700">
            {L('管理者パスワード', 'Admin password')}
          </label>
          <input
            id="admin-password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white"
          />
          {error && (
            <p role="alert" className="flex items-start gap-2 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </p>
          )}
          <button
            type="submit"
            disabled={isSubmitting || !password}
            className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white font-bold py-3 px-4 rounded-xl text-sm flex items-center justify-center gap-2"
          >
            <span>{isSubmitting ? L('確認中…', 'Checking…') : L('ログイン', 'Sign in')}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
};
