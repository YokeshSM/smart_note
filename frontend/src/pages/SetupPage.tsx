import React from 'react'
import { Sparkles, Terminal } from 'lucide-react'

export const SetupPage: React.FC = () => (
  <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
    <div className="w-full max-w-md">
      <div className="flex flex-col items-center mb-6">
        <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-500 flex items-center justify-center shadow-xl shadow-indigo-500/30 mb-4">
          <Sparkles size={28} className="text-white" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Smart Notes</h1>
        <p className="mt-1 text-sm text-amber-600 dark:text-amber-400 font-medium">Setup required</p>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Add your Supabase credentials to get started:
        </p>

        <div className="bg-gray-950 dark:bg-black rounded-xl p-4 font-mono text-xs text-green-400 space-y-1">
          <div className="flex items-center gap-2 text-gray-500 mb-2">
            <Terminal size={12} />
            <span>frontend/.env</span>
          </div>
          <p>VITE_SUPABASE_URL=https://your-project.supabase.co</p>
          <p>VITE_SUPABASE_ANON_KEY=your-anon-key</p>
        </div>

        <ol className="text-sm text-gray-600 dark:text-gray-400 space-y-2 list-decimal list-inside">
          <li>Create a project at <span className="text-indigo-600 dark:text-indigo-400 font-medium">supabase.com</span></li>
          <li>Copy the URL and anon key from Project Settings → API</li>
          <li>Run the SQL in <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded text-xs">supabase/migrations/001_init.sql</code></li>
          <li>Enable Google provider in Authentication → Providers</li>
          <li>Restart the dev server: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded text-xs">npm run dev</code></li>
        </ol>
      </div>
    </div>
  </div>
)
