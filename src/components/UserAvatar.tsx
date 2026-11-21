import React, { useRef, useState } from 'react';
import { Camera } from 'lucide-react';

export const AVATAR_PRESETS: Array<{ id: string; label: string; bgClass: string }> = [
  { id: 'preset:slate', label: 'Графит', bgClass: 'bg-slate-800 text-white' },
  { id: 'preset:emerald', label: 'Изумруд', bgClass: 'bg-emerald-700 text-white' },
  { id: 'preset:amber', label: 'Янтарь', bgClass: 'bg-amber-600 text-white' },
  { id: 'preset:indigo', label: 'Индиго', bgClass: 'bg-indigo-700 text-white' },
  { id: 'preset:rose', label: 'Рубин', bgClass: 'bg-rose-700 text-white' },
  { id: 'preset:teal', label: 'Бирюза', bgClass: 'bg-teal-700 text-white' },
];

interface UserAvatarProps {
  name: string;
  avatar?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  online?: boolean;
}

const SIZE_CLASSES: Record<'xs' | 'sm' | 'md' | 'lg', string> = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-lg',
};

function getInitials(name: string): string {
  const clean = name.trim();
  if (!clean) return '?';
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase();
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  name,
  avatar,
  size = 'md',
  online,
}) => {
  const isImage = Boolean(avatar && avatar.startsWith('data:image/'));
  const preset = AVATAR_PRESETS.find((p) => p.id === avatar) || AVATAR_PRESETS[0];

  return (
    <div className={`relative shrink-0 rounded-full ${SIZE_CLASSES[size]}`}>
      {isImage ? (
        <img
          src={avatar}
          alt={name}
          className="w-full h-full rounded-full object-cover border border-slate-200 dark:border-slate-700"
        />
      ) : (
        <div
          className={`w-full h-full rounded-full flex items-center justify-center font-semibold select-none ${preset.bgClass}`}
        >
          {getInitials(name)}
        </div>
      )}
      {typeof online === 'boolean' && (
        <span
          aria-label={online ? 'В сети' : 'Не в сети'}
          className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-slate-900 ${
            online ? 'bg-emerald-500' : 'bg-slate-400'
          }`}
        />
      )}
    </div>
  );
};

interface AvatarPickerProps {
  name: string;
  value: string;
  onChange: (nextAvatar: string) => void;
}

export async function resizeImageFileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const size = 160;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas unavailable'));
          return;
        }
        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = () => reject(new Error('Не удалось прочитать изображение.'));
      img.src = String(reader.result || '');
    };
    reader.onerror = () => reject(new Error('Не удалось загрузить файл.'));
    reader.readAsDataURL(file);
  });
}

export const AvatarPicker: React.FC<AvatarPickerProps> = ({ name, value, onChange }) => {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    if (!file.type.startsWith('image/')) {
      setUploadError('Выберите изображение (JPG, PNG, WebP).');
      return;
    }
    try {
      const dataUrl = await resizeImageFileToDataUrl(file);
      onChange(dataUrl);
    } catch {
      setUploadError('Не удалось обработать изображение.');
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-3">
        <UserAvatar name={name || 'F'} avatar={value} size="lg" />
        <div className="flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            {AVATAR_PRESETS.map((preset) => {
              const active = value === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  title={preset.label}
                  onClick={() => onChange(preset.id)}
                  className={`w-6 h-6 rounded-full ${preset.bgClass} transition-transform focus:outline-none ${
                    active
                      ? 'ring-2 ring-slate-900 dark:ring-slate-100 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 scale-105'
                      : 'opacity-80 hover:opacity-100'
                  }`}
                />
              );
            })}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Загрузить фото</span>
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
          {uploadError && (
            <p className="text-[11px] text-red-600 dark:text-red-400">{uploadError}</p>
          )}
        </div>
      </div>
    </div>
  );
};
