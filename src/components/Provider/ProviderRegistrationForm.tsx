import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  User, 
  Phone, 
  Car, 
  Camera, 
  Loader2,
  Truck,
  AlertCircle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ProviderRegistrationFormProps {
  userId: string;
  currentName: string;
  currentPhone: string;
  currentAvatar: string | null;
  currentVehiclePlate: string | null;
  onComplete: () => void;
}

const VEHICLE_TYPES = [
  { value: 'guincho_plataforma', label: 'Guincho Plataforma' },
  { value: 'guincho_asa_delta', label: 'Guincho Asa Delta' },
  { value: 'caminhao', label: 'Caminhão' },
  { value: 'utilitario', label: 'Utilitário' },
  { value: 'moto', label: 'Moto' },
  { value: 'carro', label: 'Carro' },
];

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function formatPlate(value: string): string {
  // Format as ABC-1D23 (Mercosul) or ABC-1234 (old format)
  const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7);
  if (cleaned.length <= 3) return cleaned;
  return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
}

export function ProviderRegistrationForm({
  userId,
  currentName,
  currentPhone,
  currentAvatar,
  currentVehiclePlate,
  onComplete,
}: ProviderRegistrationFormProps) {
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(currentName || '');
  const [phone, setPhone] = useState(currentPhone ? formatPhone(currentPhone) : '');
  const [vehiclePlate, setVehiclePlate] = useState(currentVehiclePlate ? formatPlate(currentVehiclePlate) : '');
  const [vehicleType, setVehicleType] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(currentAvatar);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione uma imagem válida');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 5MB');
      return;
    }

    setUploadingAvatar(true);
    try {
      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${userId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        // Use base64 as fallback
        const reader = new FileReader();
        reader.onloadend = () => {
          setAvatarUrl(reader.result as string);
          toast.success('Foto carregada!');
        };
        reader.readAsDataURL(file);
        return;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      setAvatarUrl(publicUrl);
      toast.success('Foto atualizada!');
    } catch (error) {
      console.error('Error uploading avatar:', error);
      // Fallback to base64
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validations
    if (!name.trim()) {
      toast.error('Nome completo é obrigatório');
      return;
    }

    if (!phone || phone.replace(/\D/g, '').length < 10) {
      toast.error('Telefone válido é obrigatório');
      return;
    }

    if (!avatarUrl) {
      toast.error('Foto de perfil é obrigatória');
      return;
    }

    if (!vehicleType) {
      toast.error('Tipo de veículo é obrigatório');
      return;
    }

    if (!vehiclePlate || vehiclePlate.replace(/[^A-Z0-9]/g, '').length < 7) {
      toast.error('Placa do veículo é obrigatória (formato: ABC-1D23)');
      return;
    }

    if (!termsAccepted) {
      toast.error('Você deve aceitar os termos de uso');
      return;
    }

    setLoading(true);
    try {
      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          name: name.trim(),
          phone: phone.replace(/\D/g, ''),
          avatar_url: avatarUrl,
        })
        .eq('user_id', userId);

      if (profileError) throw profileError;

      // Update provider_data
      const { error: providerError } = await supabase
        .from('provider_data')
        .update({
          vehicle_plate: vehiclePlate.replace(/-/g, ''),
          vehicle_type: vehicleType,
          terms_accepted: true,
          terms_accepted_at: new Date().toISOString(),
          registration_complete: true,
        })
        .eq('user_id', userId);

      if (providerError) throw providerError;

      toast.success('Cadastro concluído com sucesso!');
      onComplete();
    } catch (error) {
      console.error('Error completing registration:', error);
      toast.error('Erro ao salvar cadastro. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 provider-theme">
      <div className="max-w-md mx-auto">
        <div className="bg-card rounded-3xl shadow-uber-lg p-6 space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground">Complete seu cadastro</h1>
            <p className="text-muted-foreground mt-2">
              Preencha os dados abaixo para começar a atender
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Avatar Upload */}
            <div className="flex flex-col items-center gap-3">
              <div 
                className="relative w-24 h-24 rounded-full bg-secondary border-2 border-dashed border-provider-primary/50 flex items-center justify-center cursor-pointer overflow-hidden"
                onClick={() => fileInputRef.current?.click()}
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <Camera className="w-8 h-8 text-muted-foreground" />
                )}
                {uploadingAvatar && (
                  <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-provider-primary" />
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
              <p className="text-sm text-muted-foreground">
                Foto de perfil <span className="text-destructive">*</span>
              </p>
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Nome completo <span className="text-destructive">*</span></Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Seu nome completo"
                  className="pl-10 h-12 rounded-xl"
                />
              </div>
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone <span className="text-destructive">*</span></Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(formatPhone(e.target.value))}
                  placeholder="(11) 99999-9999"
                  className="pl-10 h-12 rounded-xl"
                />
              </div>
            </div>

            {/* Vehicle Type */}
            <div className="space-y-2">
              <Label>Tipo de veículo <span className="text-destructive">*</span></Label>
              <div className="grid grid-cols-2 gap-2">
                {VEHICLE_TYPES.map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setVehicleType(type.value)}
                    className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                      vehicleType === type.value
                        ? 'border-provider-primary bg-provider-primary/10'
                        : 'border-border bg-secondary hover:border-provider-primary/50'
                    }`}
                  >
                    <Truck className={`w-4 h-4 ${vehicleType === type.value ? 'text-provider-primary' : 'text-muted-foreground'}`} />
                    <span className={`text-sm font-medium ${vehicleType === type.value ? 'text-provider-primary' : ''}`}>
                      {type.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Vehicle Plate */}
            <div className="space-y-2">
              <Label htmlFor="plate">Placa do veículo <span className="text-destructive">*</span></Label>
              <div className="relative">
                <Car className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="plate"
                  value={vehiclePlate}
                  onChange={(e) => setVehiclePlate(formatPlate(e.target.value))}
                  placeholder="ABC-1D23"
                  className="pl-10 h-12 rounded-xl uppercase"
                  maxLength={8}
                />
              </div>
            </div>

            {/* Terms */}
            <div className="flex items-start gap-3 p-4 bg-secondary/50 rounded-xl">
              <Checkbox
                id="terms"
                checked={termsAccepted}
                onCheckedChange={(checked) => setTermsAccepted(checked as boolean)}
                className="mt-0.5"
              />
              <label htmlFor="terms" className="text-sm text-muted-foreground cursor-pointer">
                Li e aceito os <span className="text-provider-primary font-medium">Termos de Uso</span> e a{' '}
                <span className="text-provider-primary font-medium">Política de Privacidade</span> do GIGA S.O.S
                <span className="text-destructive"> *</span>
              </label>
            </div>

            {/* Info */}
            <div className="flex items-start gap-3 p-4 bg-status-searching/10 rounded-xl">
              <AlertCircle className="w-5 h-5 text-status-searching flex-shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground">
                Após concluir o cadastro, você precisará configurar sua conta de recebimentos para começar a atender.
              </p>
            </div>

            {/* Submit */}
            <Button
              type="submit"
              variant="provider"
              className="w-full h-12 rounded-xl font-semibold"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                'Concluir cadastro'
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
