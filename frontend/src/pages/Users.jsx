import { useState, useEffect } from 'react';
import { userService } from '../services/services';
import { Users as UsersIcon, Plus, X, Pencil, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { clsx } from 'clsx';

function UserModal({ user, onClose, onSave }) {
  const [form, setForm] = useState(user || { name: '', email: '', role: 'SAFETY_OFFICER', password: '' });
  const [loading, setLoading] = useState(false);
  const f = k => e => setForm(s => ({ ...s, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (user) await userService.update(user.id, form);
      else await userService.create(form);
      toast.success(user ? 'User updated' : 'User created');
      onSave();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200">{user ? 'Edit User' : 'Create User'}</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div><label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Full Name *</label>
            <input className="input" value={form.name} onChange={f('name')} required /></div>
          <div><label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Email *</label>
            <input type="email" className="input" value={form.email} onChange={f('email')} required /></div>
          <div><label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Role</label>
            <select className="input" value={form.role} onChange={f('role')}>
              <option value="ADMIN">Admin</option>
              <option value="SAFETY_OFFICER">Safety Officer</option>
              <option value="SUPERVISOR">Supervisor</option>
            </select></div>
          <div><label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{user ? 'New Password (leave blank to keep)' : 'Password *'}</label>
            <input type="password" className="input" value={form.password || ''} onChange={f('password')} required={!user} placeholder={user ? 'Leave blank to keep' : '••••••••'} /></div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1 flex items-center justify-center gap-2">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />} Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const roleBadge = {
  ADMIN: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  SAFETY_OFFICER: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  SUPERVISOR: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
};

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState(null);

  const load = async () => {
    setLoading(true);
    try { const { data } = await userService.list(); setUsers(data || []); }
    catch { toast.error('Failed to load users'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const deactivate = async (id) => {
    if (!confirm('Deactivate this user?')) return;
    try { await userService.delete(id); toast.success('User deactivated'); load(); }
    catch { toast.error('Failed'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">User Management</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{users.length} users • Admin access required</p>
        </div>
        <button onClick={() => { setEditUser(null); setShowModal(true); }} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Create User
        </button>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-14 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />)}</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr>{['Name', 'Email', 'Role', 'Status', 'Last Login', 'Actions'].map(h => (
                <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-xs font-bold">{u.name?.charAt(0)?.toUpperCase()}</span>
                      </div>
                      <span className="font-medium text-slate-800 dark:text-slate-200">{u.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-slate-500 dark:text-slate-400">{u.email}</td>
                  <td className="px-5 py-4">
                    <span className={clsx('text-xs font-medium px-2.5 py-0.5 rounded-full', roleBadge[u.role] || 'bg-slate-100 text-slate-600')}>
                      {u.role?.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span className={clsx('text-xs font-medium px-2 py-0.5 rounded-full',
                      u.is_active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
                    )}>{u.is_active ? 'Active' : 'Inactive'}</span>
                  </td>
                  <td className="px-5 py-4 text-xs text-slate-400">
                    {u.last_login ? format(new Date(u.last_login), 'MMM d, HH:mm') : 'Never'}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex gap-1">
                      <button onClick={() => { setEditUser(u); setShowModal(true); }} className="p-1.5 rounded text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => deactivate(u.id)} className="p-1.5 rounded text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && <UserModal user={editUser} onClose={() => setShowModal(false)} onSave={() => { setShowModal(false); load(); }} />}
    </div>
  );
}
