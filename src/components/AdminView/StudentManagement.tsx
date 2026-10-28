import React, { useState } from 'react';
import { Student, ClassId } from '../../types';
import { SOLTILO_CLASSES } from '../../data/constants';
import { User, Plus, Edit2, PlusCircle, MinusCircle, Search, Mail, Phone, Calendar, Upload, Sparkles } from 'lucide-react';
import { useTranslation } from '../../lib/i18n';

interface StudentManagementProps {
  students: Student[];
  onUpdateTransferBalance: (studentId: string, delta: number) => void;
  onAddStudent: (student: Omit<Student, 'id'>) => void;
  onOpenCodmonTab?: () => void;
}

export const StudentManagement: React.FC<StudentManagementProps> = ({
  students,
  onUpdateTransferBalance,
  onAddStudent,
  onOpenCodmonTab
}) => {
  const { language } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState<ClassId | 'all'>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // New Student Form State
  const [newName, setNewName] = useState('');
  const [newClassId, setNewClassId] = useState<ClassId>('ex1');
  const [newRegularDays, setNewRegularDays] = useState<number[]>([1, 3]);
  const [newBalance, setNewBalance] = useState<number>(0);
  const [newParentName, setNewParentName] = useState('');
  const [newEmail, setNewEmail] = useState('');

  const dayNames = language === 'en' ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] : ['日', '月', '火', '水', '木', '金', '土'];

  const filteredStudents = students.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.parentName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesClass = selectedClassFilter === 'all' || s.classId === selectedClassFilter;
    return matchesSearch && matchesClass;
  });

  const handleCreateStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    onAddStudent({
      name: newName.trim(),
      classId: newClassId,
      regularDays: newRegularDays,
      transferBalance: newBalance,
      parentName: newParentName.trim() || '保護者未登録',
      contactEmail: newEmail.trim() || 'contact@example.com'
    });

    setNewName('');
    setIsAddModalOpen(false);
  };

  const toggleDay = (dayNum: number) => {
    if (newRegularDays.includes(dayNum)) {
      setNewRegularDays(newRegularDays.filter((d) => d !== dayNum));
    } else {
      setNewRegularDays([...newRegularDays, dayNum].sort());
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Search & Actions Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder={language === 'en' ? 'Search by student or parent name...' : '生徒名・保護者名で検索...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
          />
        </div>

        {/* Class Filter & Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedClassFilter}
            onChange={(e) => setSelectedClassFilter(e.target.value as ClassId | 'all')}
            className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">{language === 'en' ? 'All classes' : 'すべてのクラス'}</option>
            {SOLTILO_CLASSES.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.jpName}
              </option>
            ))}
          </select>

          {onOpenCodmonTab && (
            <button
              onClick={onOpenCodmonTab}
              className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold px-3.5 py-2 rounded-xl text-xs border border-indigo-200 shadow-2xs transition flex items-center space-x-1.5 shrink-0"
              title={language === 'en' ? 'Bulk import from CoDMON via CSV or copy & paste' : 'コドモンからCSVまたはコピー&ペーストで一括取込'}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{language === 'en' ? 'Bulk Import from CoDMON' : 'コドモンから一括取込'}</span>
            </button>
          )}

          <button
            id="btn-add-student"
            onClick={() => setIsAddModalOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-sm transition flex items-center space-x-1.5 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>{language === 'en' ? 'Add New Student' : '新規生徒登録'}</span>
          </button>
        </div>

      </div>

      {/* Roster Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800">
            {language === 'en' ? 'Registered Students (Make-up Credits)' : '登録生徒一覧（振替残数管理）'}
          </h2>
          <span className="text-xs text-slate-500 font-medium">
            {language === 'en' ? `Showing: ${filteredStudents.length} students` : `該当: ${filteredStudents.length} 名`}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">{language === 'en' ? 'Student Name' : '生徒氏名'}</th>
                <th className="py-3 px-4">{language === 'en' ? 'Class' : 'クラス'}</th>
                <th className="py-3 px-4">{language === 'en' ? 'Regular Weekdays' : '通常通学曜日'}</th>
                <th className="py-3 px-4 text-center">{language === 'en' ? 'Make-up Credits (Tickets Left)' : '振替残数 (残チケット)'}</th>
                <th className="py-3 px-4">{language === 'en' ? 'Parent Contact' : '保護者連絡先'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-800">
              {filteredStudents.map((student) => {
                const cls = SOLTILO_CLASSES.find((c) => c.id === student.classId);
                return (
                  <tr key={student.id} className="hover:bg-slate-50/80 transition">
                    
                    {/* Student Name */}
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      <div className="flex items-center space-x-2">
                        <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs">
                          {student.name.charAt(0)}
                        </div>
                        <span>{student.name}</span>
                      </div>
                    </td>

                    {/* Class */}
                    <td className="py-3.5 px-4">
                      <span className={`px-2.5 py-0.5 rounded-md font-semibold text-[11px] ${cls?.badgeBg}`}>
                        {cls?.jpName || student.classId}
                      </span>
                    </td>

                    {/* Regular Days */}
                    <td className="py-3.5 px-4 font-medium text-slate-600">
                      {language === 'en' ? student.regularDays.map((d) => `Every ${dayNames[d]}`).join(', ') : student.regularDays.map((d) => `毎週${dayNames[d]}`).join('・')}
                    </td>

                    {/* Balance Controller */}
                    <td className="py-3.5 px-4 text-center">
                      <div className="inline-flex items-center space-x-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
                        <button
                          onClick={() => onUpdateTransferBalance(student.id, -1)}
                          disabled={student.transferBalance <= 0}
                          className="w-6 h-6 rounded-lg bg-white border border-slate-300 text-slate-600 hover:bg-slate-200 disabled:opacity-40 flex items-center justify-center text-sm font-bold shadow-xs transition"
                          title={language === 'en' ? 'Decrease credits by 1' : '残数を1回減らす'}
                        >
                          -
                        </button>

                        <span className="w-8 text-center font-extrabold text-sm text-indigo-900">
                          {student.transferBalance}
                        </span>

                        <button
                          onClick={() => onUpdateTransferBalance(student.id, 1)}
                          className="w-6 h-6 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 flex items-center justify-center text-sm font-bold shadow-xs transition"
                          title={language === 'en' ? 'Increase credits by 1' : '残数を1回増やす'}
                        >
                          +
                        </button>
                      </div>
                    </td>

                    {/* Contact */}
                    <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                      <div>{student.parentName}</div>
                      <div className="text-slate-400">{student.contactEmail}</div>
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Student Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-slate-200 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900 border-b pb-2">
              {language === 'en' ? 'Add New Student' : '新規生徒登録'}
            </h3>

            <form onSubmit={handleCreateStudent} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {language === 'en' ? 'Student Name' : '生徒氏名'} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder={language === 'en' ? 'e.g. Ren Sample' : '例: サンプル 蓮 (Ren Sample)'}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">{language === 'en' ? 'Class' : '所属クラス'}</label>
                <select
                  value={newClassId}
                  onChange={(e) => setNewClassId(e.target.value as ClassId)}
                  className="w-full px-3 py-2 bg-slate-50 border rounded-xl text-sm"
                >
                  {SOLTILO_CLASSES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.jpName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">{language === 'en' ? 'Regular Weekdays' : '通常通学曜日'}</label>
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4, 5].map((d) => {
                    const isChecked = newRegularDays.includes(d);
                    return (
                      <button
                        type="button"
                        key={d}
                        onClick={() => toggleDay(d)}
                        className={`flex-1 py-1.5 rounded-lg border text-xs font-bold transition ${
                          isChecked
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-slate-50 text-slate-600 border-slate-200'
                        }`}
                      >
                        {dayNames[d]}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">{language === 'en' ? 'Initial Make-up Credits' : '初期振替残数'}</label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={newBalance}
                  onChange={(e) => setNewBalance(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-slate-50 border rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">{language === 'en' ? 'Parent/Guardian Name' : '保護者氏名'}</label>
                <input
                  type="text"
                  placeholder={language === 'en' ? 'e.g. Sample Parent' : '例: サンプル 保護者'}
                  value={newParentName}
                  onChange={(e) => setNewParentName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border rounded-xl text-sm"
                />
              </div>

              <div className="pt-3 flex justify-end space-x-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 rounded-xl text-slate-600 font-semibold"
                >
                  {language === 'en' ? 'Cancel' : 'キャンセル'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold shadow"
                >
                  {language === 'en' ? 'Register' : '登録する'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
