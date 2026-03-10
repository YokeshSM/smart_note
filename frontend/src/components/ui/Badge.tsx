import React from 'react';

type BadgeColor = 'indigo' | 'emerald' | 'red' | 'amber' | 'sky' | 'gray';

interface BadgeProps {
  children: React.ReactNode;
  color?: BadgeColor;
  className?: string;
}

const colorClasses: Record<BadgeColor, string> = {
  indigo:
    'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  emerald:
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  red: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  amber:
    'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  sky: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  gray: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

export const Badge: React.FC<BadgeProps> = ({
  children,
  color = 'indigo',
  className = '',
}) => (
  <span
    className={`
      inline-flex items-center px-2 py-0.5 rounded-full
      text-xs font-medium
      ${colorClasses[color]}
      ${className}
    `}
  >
    {children}
  </span>
);
