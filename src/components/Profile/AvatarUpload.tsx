import React, { useState, useRef } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useApp } from '@/contexts/AppContext';

interface AvatarUploadProps {
  currentAvatar?: string | null;
  userName?: string;
  onAvatarChange?: (newUrl: string) => void;
  size?: 'sm' | 'md' | 'lg';
}

export function AvatarUpload({ currentAvatar, userName, onAvatarChange, size = 'md' }: AvatarUploadProps) {
  const { profile } = useApp();
  const [uploading, setUploading] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const displayUrl = avatarPreview || currentAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userName || 'user'}`;

  const sizeClasses = {
    sm: 'w-16 h-16',
    md: 'w-20 h-20',
    lg: 'w-24 h-24',
  };

  const buttonSizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
  };

  const iconSizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione uma imagem');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 5MB');
      return;
    }

    if (!profile?.user_id) {
      toast.error('Usuário não identificado');
      return;
    }

    setUploading(true);

    try {
      // Generate unique file name
      const fileExt = file.name.split('.').pop();
      const fileName = `${profile.user_id}-${Date.now()}.${fileExt}`;
      const filePath = fileName;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) {
        console.error('[AvatarUpload] Upload error:', uploadError);
        toast.error('Erro ao fazer upload da foto');
        return;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Update profile with new avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('user_id', profile.user_id);

      if (updateError) {
        console.error('[AvatarUpload] Profile update error:', updateError);
        toast.error('Erro ao atualizar perfil');
        return;
      }

      // Update local preview immediately
      setAvatarPreview(publicUrl);
      toast.success('Foto atualizada com sucesso!');
      onAvatarChange?.(publicUrl);
    } catch (error) {
      console.error('[AvatarUpload] Error:', error);
      toast.error('Erro ao atualizar foto');
    } finally {
      setUploading(false);
      // Reset input so same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="relative inline-block">
      <img 
        src={displayUrl}
        alt={userName || 'Avatar'}
        className={`${sizeClasses[size]} rounded-full border-4 border-primary/20 shadow-lg object-cover`}
      />
      
      {/* Camera overlay button */}
      <button
        onClick={handleAvatarClick}
        disabled={uploading}
        className={`absolute bottom-0 right-0 ${buttonSizeClasses[size]} bg-primary rounded-full border-2 border-background flex items-center justify-center shadow-md hover:bg-primary/90 transition-colors disabled:opacity-50`}
        aria-label="Alterar foto"
      >
        {uploading ? (
          <Loader2 className={`${iconSizeClasses[size]} text-primary-foreground animate-spin`} />
        ) : (
          <Camera className={`${iconSizeClasses[size]} text-primary-foreground`} />
        )}
      </button>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
