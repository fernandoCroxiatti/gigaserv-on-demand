import React, { useRef, useState } from 'react';
import { Camera, ImagePlus, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCapacitorCamera } from '@/hooks/useCapacitorCamera';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface NativeImagePickerProps {
  onImageSelected: (file: File | null, dataUrl: string | null) => void;
  currentImageUrl?: string | null;
  isLoading?: boolean;
  className?: string;
  placeholder?: React.ReactNode;
  shape?: 'circle' | 'square';
  size?: 'sm' | 'md' | 'lg';
  showPreview?: boolean;
  accept?: string;
  maxSizeMB?: number;
}

export function NativeImagePicker({
  onImageSelected,
  currentImageUrl,
  isLoading = false,
  className = '',
  placeholder,
  shape = 'circle',
  size = 'md',
  showPreview = true,
  accept = 'image/*',
  maxSizeMB = 5,
}: NativeImagePickerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showSourceDialog, setShowSourceDialog] = useState(false);
  const { capturePhoto, selectFromGallery, isNative, isLoading: cameraLoading, error: cameraError } = useCapacitorCamera();

  const sizeClasses = {
    sm: 'w-16 h-16',
    md: 'w-24 h-24',
    lg: 'w-32 h-32',
  };

  const shapeClasses = {
    circle: 'rounded-full',
    square: 'rounded-xl',
  };

  // Handle file input change (web fallback)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione uma imagem válida');
      return;
    }

    // Validate file size
    if (file.size > maxSizeMB * 1024 * 1024) {
      toast.error(`A imagem deve ter no máximo ${maxSizeMB}MB`);
      return;
    }

    // Convert to data URL for preview and upload
    const reader = new FileReader();
    reader.onloadend = () => {
      onImageSelected(file, reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Handle native camera capture
  const handleCameraCapture = async () => {
    setShowSourceDialog(false);

    const photoPath = await capturePhoto({ quality: 85, width: 800, height: 800 });
    if (photoPath) {
      // Fetch the photo and convert to blob/file
      try {
        const response = await fetch(photoPath);
        const blob = await response.blob();
        const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
        
        const reader = new FileReader();
        reader.onloadend = () => {
          onImageSelected(file, reader.result as string);
        };
        reader.readAsDataURL(file);
      } catch (err) {
        console.error('[NativeImagePicker] Error processing camera photo:', err);
        toast.error('Erro ao processar foto');
      }
    }
  };

  // Handle native gallery selection
  const handleGallerySelection = async () => {
    setShowSourceDialog(false);

    const photoPath = await selectFromGallery();
    if (photoPath) {
      try {
        const response = await fetch(photoPath);
        const blob = await response.blob();
        const file = new File([blob], `image_${Date.now()}.jpg`, { type: blob.type || 'image/jpeg' });
        
        const reader = new FileReader();
        reader.onloadend = () => {
          onImageSelected(file, reader.result as string);
        };
        reader.readAsDataURL(file);
      } catch (err) {
        console.error('[NativeImagePicker] Error processing gallery image:', err);
        toast.error('Erro ao processar imagem');
      }
    }
  };

  // Handle click on the picker
  const handleClick = () => {
    if (isNative) {
      // On native, show source selection dialog
      setShowSourceDialog(true);
    } else {
      // On web, trigger file input
      fileInputRef.current?.click();
    }
  };

  const isProcessing = isLoading || cameraLoading;

  return (
    <>
      <div
        className={`relative ${sizeClasses[size]} ${shapeClasses[shape]} bg-secondary border-2 border-dashed border-primary/50 flex items-center justify-center cursor-pointer overflow-hidden ${className}`}
        onClick={handleClick}
      >
        {showPreview && currentImageUrl ? (
          <img src={currentImageUrl} alt="Preview" className="w-full h-full object-cover" />
        ) : (
          placeholder || <Camera className="w-8 h-8 text-muted-foreground" />
        )}
        
        {isProcessing && (
          <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        )}
      </div>

      {/* Hidden file input for web fallback */}
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Source selection dialog for native */}
      <Dialog open={showSourceDialog} onOpenChange={setShowSourceDialog}>
        <DialogContent className="sm:max-w-[300px]">
          <DialogHeader>
            <DialogTitle>Selecionar imagem</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-4">
            <Button
              variant="outline"
              className="w-full justify-start gap-3 h-14"
              onClick={handleCameraCapture}
              disabled={isProcessing}
            >
              <Camera className="w-5 h-5" />
              Tirar foto
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start gap-3 h-14"
              onClick={handleGallerySelection}
              disabled={isProcessing}
            >
              <ImagePlus className="w-5 h-5" />
              Escolher da galeria
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {cameraError && (
        <p className="text-sm text-destructive mt-1">{cameraError}</p>
      )}
    </>
  );
}

// Simple button version for inline usage
interface NativeImageButtonProps {
  onImageSelected: (file: File | null, dataUrl: string | null) => void;
  isLoading?: boolean;
  className?: string;
  variant?: 'default' | 'outline' | 'ghost';
  children?: React.ReactNode;
}

export function NativeImageButton({
  onImageSelected,
  isLoading = false,
  className = '',
  variant = 'outline',
  children,
}: NativeImageButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showSourceDialog, setShowSourceDialog] = useState(false);
  const { capturePhoto, selectFromGallery, isNative, isLoading: cameraLoading } = useCapacitorCamera();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione uma imagem válida');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      onImageSelected(file, reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleCameraCapture = async () => {
    setShowSourceDialog(false);
    const photoPath = await capturePhoto({ quality: 85 });
    if (photoPath) {
      try {
        const response = await fetch(photoPath);
        const blob = await response.blob();
        const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
        
        const reader = new FileReader();
        reader.onloadend = () => {
          onImageSelected(file, reader.result as string);
        };
        reader.readAsDataURL(file);
      } catch (err) {
        console.error('[NativeImageButton] Error:', err);
        toast.error('Erro ao processar foto');
      }
    }
  };

  const handleGallerySelection = async () => {
    setShowSourceDialog(false);
    const photoPath = await selectFromGallery();
    if (photoPath) {
      try {
        const response = await fetch(photoPath);
        const blob = await response.blob();
        const file = new File([blob], `image_${Date.now()}.jpg`, { type: blob.type || 'image/jpeg' });
        
        const reader = new FileReader();
        reader.onloadend = () => {
          onImageSelected(file, reader.result as string);
        };
        reader.readAsDataURL(file);
      } catch (err) {
        console.error('[NativeImageButton] Error:', err);
        toast.error('Erro ao processar imagem');
      }
    }
  };

  const handleClick = () => {
    if (isNative) {
      setShowSourceDialog(true);
    } else {
      fileInputRef.current?.click();
    }
  };

  const isProcessing = isLoading || cameraLoading;

  return (
    <>
      <Button
        type="button"
        variant={variant}
        className={className}
        onClick={handleClick}
        disabled={isProcessing}
      >
        {isProcessing ? (
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
        ) : null}
        {children || 'Selecionar imagem'}
      </Button>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      <Dialog open={showSourceDialog} onOpenChange={setShowSourceDialog}>
        <DialogContent className="sm:max-w-[300px]">
          <DialogHeader>
            <DialogTitle>Selecionar imagem</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-4">
            <Button
              variant="outline"
              className="w-full justify-start gap-3 h-14"
              onClick={handleCameraCapture}
              disabled={isProcessing}
            >
              <Camera className="w-5 h-5" />
              Tirar foto
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start gap-3 h-14"
              onClick={handleGallerySelection}
              disabled={isProcessing}
            >
              <ImagePlus className="w-5 h-5" />
              Escolher da galeria
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
