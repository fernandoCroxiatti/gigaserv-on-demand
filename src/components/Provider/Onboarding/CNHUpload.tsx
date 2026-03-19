import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CNHUploadProps {
  userId: string;
  onUploadComplete: (url: string) => void;
}

export function CNHUpload({ userId, onUploadComplete }: CNHUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}/cnh_${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError, data } = await supabase.storage
        .from('provider-documents')
        .upload(filePath, file, {
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('provider-documents')
        .getPublicUrl(filePath);

      onUploadComplete(filePath);
      setSuccess(true);
      toast.success('CNH enviada com sucesso!');
    } catch (error: any) {
      console.error('Error uploading CNH:', error);
      toast.error('Erro ao enviar CNH: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-2xl p-6 bg-secondary/20">
        {preview ? (
          <div className="relative w-full aspect-[3/2] rounded-lg overflow-hidden mb-4">
            <img src={preview} alt="CNH Preview" className="w-full h-full object-cover" />
            {uploading && (
              <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            )}
            {success && (
              <div className="absolute top-2 right-2 bg-green-500 rounded-full p-1">
                <CheckCircle2 className="w-5 h-5 text-white" />
              </div>
            )}
          </div>
        ) : (
          <div className="text-center space-y-2 mb-4">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
              <Camera className="w-8 h-8 text-primary" />
            </div>
            <p className="text-sm font-medium">Foto da CNH</p>
            <p className="text-xs text-muted-foreground">Tire uma foto nítida da sua CNH aberta</p>
          </div>
        )}

        <input
          type="file"
          id="cnh-upload"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
          disabled={uploading}
        />

        <Button
          type="button"
          asChild
          variant={success ? "outline" : "default"}
          className="w-full h-12 rounded-xl"
          disabled={uploading}
        >
          <label htmlFor="cnh-upload" className="cursor-pointer">
            {uploading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Camera className="w-4 h-4 mr-2" />
            )}
            {success ? 'Alterar foto' : 'Tirar foto da CNH'}
          </label>
        </Button>
      </div>

      {!success && (
        <div className="flex items-start gap-2 p-3 bg-amber-500/10 rounded-xl border border-amber-500/20">
          <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-[10px] text-amber-700 leading-tight">
            O envio da CNH é obrigatório para validação do seu perfil pela nossa equipe.
            Seu cadastro passará por uma revisão manual antes de ser liberado.
          </p>
        </div>
      )}
    </div>
  );
}
