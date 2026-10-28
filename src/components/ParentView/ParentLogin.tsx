import React, { useState } from 'react';
import { Student } from '../../types';
import { SOLTILO_CLASSES } from '../../data/constants';
import { useTranslation } from '../../lib/i18n';
import { Lock, User, Key, ArrowRight, ShieldAlert, Sparkles, Info } from 'lucide-react';

interface ParentLoginProps {
  students: Student[];
  onLoginSuccess: (studentId: string) => void;
  /** サーバー版: ID/PW をサーバーで照合し、ログインした生徒IDを返す（失敗時は Error を投げる） */
  onRemoteLogin?: (loginId: string, password: string) => Promise<string>;
}

export const ParentLogin: React.FC<ParentLoginProps> = ({
  students,
  onLoginSuccess,
  onRemoteLogin
}) => {
  const { language, t, getClassName } = useTranslation();
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isRemote = !!onRemoteLogin;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (onRemoteLogin) {
      setIsSubmitting(true);
      try {
        onLoginSuccess(await onRemoteLogin(loginId.trim(), password));
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : String(err));
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    const inputId = loginId.trim().toLowerCase();
    const inputPw = password.trim();

    const matched = students.find((s) => {
      const studentLoginId = (s.loginId || `codmon_${s.id.replace('std_', '')}`).toLowerCase();
      const studentPw = s.password || 'soltilo123';
      return studentLoginId === inputId && studentPw === inputPw;
    });

    if (matched) {
      onLoginSuccess(matched.id);
    } else {
      setErrorMsg(
        language === 'en'
          ? 'Invalid ID or password. Please use your Codmon ID/PW.'
          : 'IDまたはパスワードが正しくありません。Codmon発行のID/PWをご入力ください。'
      );
    }
  };

  // Direct 1-tap login for demo accounts
  const handleQuickDemoLogin = (student: Student) => {
    setLoginId(student.loginId || `codmon_${student.id.replace('std_', '')}`);
    setPassword(student.password || 'soltilo123');
    setErrorMsg(null);
    onLoginSuccess(student.id);
  };

  return (
    <div className="max-w-md mx-auto my-8 animate-fade-in">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
        
        {/* Card Top Banner */}
        <div className="bg-[#1F3C6B] text-white p-6 sm:p-8 text-center relative">
          <div className="absolute inset-x-0 bottom-0 h-[3px] gold-gradient" aria-hidden="true" />
          <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-white/20">
            <Lock className="w-7 h-7 text-blue-200" />
          </div>
          <h2 className="text-xl font-extrabold tracking-tight">{t('login.title')}</h2>
          <p className="text-xs text-blue-200 mt-1">
            {t('login.subtitle')}
          </p>
        </div>

        {/* Form Body */}
        <form onSubmit={handleLogin} className="p-6 sm:p-8 space-y-5">
          
          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl p-3.5 text-xs flex items-start space-x-2">
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              {t('login.idLabel')}
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="text"
                required
                placeholder={language === 'en' ? 'e.g. codmon_sample_ren' : '例: codmon_sample_ren'}
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              {t('login.pwLabel')}
            </label>
            <div className="relative">
              <Key className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="password"
                required
                placeholder={isRemote ? (language === 'en' ? 'Password' : 'パスワード') : language === 'en' ? 'Initial PW: soltilo123' : '初期パスワード: soltilo123'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-[#1F3C6B] hover:bg-blue-900 disabled:bg-slate-400 text-white font-bold py-3 px-4 rounded-xl text-sm shadow-md transition flex items-center justify-center space-x-2"
          >
            <span>{t('login.submit')}</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          {/* Initial Codmon Login Instructions */}
          <div className="pt-4 border-t border-slate-100 text-xs text-slate-500 space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-slate-700">
              <Info className="w-4 h-4 text-blue-600" />
              <span>{language === 'en' ? 'About Codmon Credentials' : 'Codmon初期ログインについて'}</span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-500">
              {language === 'en'
                ? 'For your first login, use the ID and initial password provided by the school. You can change your password after signing in.'
                : '初回ログイン時はCodmonから案内されたIDと初期パスワードをご利用ください。ログイン後、ご自身で安全な個別パスワードへ変更可能です。'}
            </p>
          </div>

        </form>

      </div>

      {/* Demo Test Credentials Helper Box（デモ版のみ。サーバー版では他の家庭の情報を出さない） */}
      {!isRemote && (
      <div className="mt-6 bg-blue-50/80 border border-blue-200 rounded-2xl p-4 text-xs">
        <div className="flex items-center justify-between mb-2.5">
          <span className="font-extrabold text-[#1F3C6B] flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-blue-600" />
            {language === 'en' ? '1-Tap Demo Student Login:' : 'ワンタップお試しログイン（デモ用）:'}
          </span>
          <span className="text-[10px] text-blue-700 bg-blue-100/90 px-2 py-0.5 rounded-md font-bold">
            {language === 'en' ? 'Default PW: soltilo123' : '初期PW: soltilo123'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {students.slice(0, 4).map((s) => {
            const cls = SOLTILO_CLASSES.find((c) => c.id === s.classId);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => handleQuickDemoLogin(s)}
                className="p-3 bg-white hover:bg-blue-50/70 border border-blue-100 hover:border-blue-400 rounded-xl text-left transition flex items-center justify-between shadow-2xs group cursor-pointer"
                title={`${s.name}`}
              >
                <div className="min-w-0 pr-2">
                  <div className="font-extrabold text-slate-900 text-xs truncate group-hover:text-blue-700">
                    {s.name}
                  </div>
                  <div className="text-[10.5px] text-slate-500 font-mono mt-0.5">
                    ID: {s.loginId || `codmon_${s.id.replace('std_', '')}`}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className={`text-[9.5px] px-1.5 py-0.5 rounded font-bold ${cls?.badgeBg}`}>
                    {getClassName(s.classId)}
                  </span>
                  <span className="text-[10px] text-blue-600 font-bold group-hover:translate-x-0.5 transition-transform flex items-center">
                    {language === 'en' ? 'Login ➔' : 'ログイン ➔'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
      )}

    </div>
  );
};
