import { AdminLogin } from './ui';

export default function AdminLoginPage() {
  return (
    <main className="mx-auto max-w-xl p-6">
      <div className="text-xs text-neutral-500">Admin</div>
      <h1 className="text-2xl font-semibold tracking-tight">Log ind</h1>
      <div className="mt-4 rounded-xl border bg-white p-4">
        <AdminLogin />
      </div>
    </main>
  );
}

