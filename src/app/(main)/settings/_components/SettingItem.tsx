'use client';

interface SettingItemProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  onClick?: () => void;
}

export function SettingItem({ icon, title, description, onClick }: SettingItemProps) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50"
    >
      <span className="text-text-secondary">{icon}</span>
      <div className="flex-1">
        <span className="text-sub text-text-primary">{title}</span>
        {description && (
          <p className="mt-0.5 text-sub-sm text-text-tertiary">{description}</p>
        )}
      </div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-tertiary">
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </button>
  );
}
