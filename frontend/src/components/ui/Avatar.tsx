import React from 'react';

interface AvatarProps {
  src?: string | null;
  name?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeClasses: Record<NonNullable<AvatarProps['size']>, string> = {
  sm: 'h-7 w-7 text-xs',
  md: 'h-9 w-9 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-20 w-20 text-2xl',
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

function getGradient(name: string): string {
  const gradients = [
    'from-rose-400 to-pink-600',
    'from-orange-400 to-amber-600',
    'from-emerald-400 to-teal-600',
    'from-sky-400 to-blue-600',
    'from-indigo-400 to-purple-600',
    'from-fuchsia-400 to-pink-600',
  ];
  return gradients[name.charCodeAt(0) % gradients.length];
}

export const Avatar: React.FC<AvatarProps> = ({
  src,
  name = 'U',
  size = 'md',
  className = '',
}) => {
  const sizeClass = sizeClasses[size];
  const gradient = getGradient(name);

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`${sizeClass} rounded-full object-cover ring-2 ring-white dark:ring-gray-700 flex-shrink-0 ${className}`}
      />
    );
  }

  return (
    <div
      className={`
        ${sizeClass} rounded-full
        bg-gradient-to-br ${gradient}
        flex items-center justify-center
        text-white font-semibold
        ring-2 ring-white dark:ring-gray-700
        flex-shrink-0
        ${className}
      `}
    >
      {getInitials(name)}
    </div>
  );
};
