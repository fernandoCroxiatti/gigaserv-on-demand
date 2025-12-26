import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Phone, Lock, ArrowLeft, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';

type Step = 'phone' | 'otp' | 'password' | 'success';

interface ForgotPasswordModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isProvider?: boolean;
}

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function ForgotPasswordModal({ open, onOpenChange, isProvider = false }: ForgotPasswordModalProps) {
  const [step, setStep] = useState<Step>('phone');
  const [loading, setLoading] = useState(false);
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setStep('phone');
      setPhone('');
      setOtpCode('');
      setNewPassword('');
      setConfirmPassword('');
      setCooldown(0);
    }
  }, [open]);

  // Cooldown timer
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const handleSendOTP = async () => {
    const cleanPhone = phone.replace(/\D/g, '');
    
    if (cleanPhone.length < 10 || cleanPhone.length > 11) {
      toast({ title: 'Erro', description: 'Número de telefone inválido', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-password-reset-otp', {
        body: { phone: cleanPhone }
      });

      if (error) throw error;

      // Check if blocked by 6-month rule
      if (data?.error && data?.blocked_until) {
        toast({ 
          title: 'Limite atingido', 
          description: data.error, 
          variant: 'destructive' 
        });
        return;
      }

      if (data?.error) {
        toast({ 
          title: 'Erro', 
          description: data.error, 
          variant: 'destructive' 
        });
        return;
      }

      toast({ 
        title: 'Código enviado', 
        description: 'Se o número estiver cadastrado, você receberá um SMS' 
      });
      
      setStep('otp');
      setCooldown(60); // 60 second cooldown for resend
    } catch (error: any) {
      console.error('Error sending OTP:', error);
      toast({ 
        title: 'Erro', 
        description: 'Erro ao enviar código. Tente novamente.', 
        variant: 'destructive' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (cooldown > 0) return;
    await handleSendOTP();
  };

  const handleVerifyAndReset = async () => {
    if (otpCode.length !== 6) {
      toast({ title: 'Erro', description: 'Digite o código de 6 dígitos', variant: 'destructive' });
      return;
    }

    if (newPassword.length < 6) {
      toast({ title: 'Erro', description: 'A senha deve ter pelo menos 6 caracteres', variant: 'destructive' });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({ title: 'Erro', description: 'As senhas não coincidem', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const cleanPhone = phone.replace(/\D/g, '');
      
      const { data, error } = await supabase.functions.invoke('verify-otp-reset-password', {
        body: { 
          phone: cleanPhone, 
          code: otpCode,
          newPassword 
        }
      });

      if (error) throw error;

      if (data?.error) {
        toast({ title: 'Erro', description: data.error, variant: 'destructive' });
        return;
      }

      setStep('success');
      toast({ title: 'Sucesso', description: 'Senha alterada com sucesso!' });
    } catch (error: any) {
      console.error('Error verifying OTP:', error);
      toast({ 
        title: 'Erro', 
        description: 'Código inválido ou expirado', 
        variant: 'destructive' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  const primaryColor = isProvider ? 'bg-blue-500 hover:bg-blue-600' : 'bg-primary hover:bg-primary/90';
  const textColor = isProvider ? 'text-blue-500' : 'text-primary';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">
            {step === 'phone' && 'Recuperar Senha'}
            {step === 'otp' && 'Verificar Código'}
            {step === 'password' && 'Nova Senha'}
            {step === 'success' && 'Senha Alterada'}
          </DialogTitle>
          <DialogDescription className="text-center">
            {step === 'phone' && 'Digite seu telefone cadastrado para receber um código SMS'}
            {step === 'otp' && 'Digite o código de 6 dígitos enviado para seu celular'}
            {step === 'password' && 'Defina sua nova senha'}
            {step === 'success' && 'Sua senha foi alterada com sucesso. Nova recuperação disponível após 6 meses.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Step: Phone */}
          {step === 'phone' && (
            <>
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  ⚠️ A recuperação de senha pode ser solicitada apenas 1 vez a cada 6 meses.
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="reset-phone">Telefone</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="reset-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(formatPhone(e.target.value))}
                    placeholder="(11) 99999-9999"
                    className="pl-10"
                  />
                </div>
              </div>
              
              <Button
                onClick={handleSendOTP}
                disabled={loading || phone.replace(/\D/g, '').length < 10}
                className={`w-full ${primaryColor} text-white`}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enviar código SMS'}
              </Button>
            </>
          )}

          {/* Step: OTP */}
          {step === 'otp' && (
            <>
              <div className="flex flex-col items-center space-y-4">
                <InputOTP 
                  maxLength={6} 
                  value={otpCode} 
                  onChange={setOtpCode}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>

                <button
                  onClick={handleResendOTP}
                  disabled={cooldown > 0 || loading}
                  className={`text-sm ${cooldown > 0 ? 'text-muted-foreground' : textColor} hover:underline disabled:no-underline`}
                >
                  {cooldown > 0 ? `Reenviar em ${cooldown}s` : 'Reenviar código'}
                </button>
              </div>

              <Button
                onClick={() => setStep('password')}
                disabled={otpCode.length !== 6}
                className={`w-full ${primaryColor} text-white`}
              >
                Continuar
              </Button>

              <Button
                variant="ghost"
                onClick={() => setStep('phone')}
                className="w-full"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar
              </Button>
            </>
          )}

          {/* Step: Password */}
          {step === 'password' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="new-password">Nova senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="pl-10 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <Eye className="w-4 h-4 text-muted-foreground" />
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirmar senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="confirm-password"
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repita a nova senha"
                    className="pl-10"
                  />
                </div>
              </div>

              <Button
                onClick={handleVerifyAndReset}
                disabled={loading || newPassword.length < 6 || newPassword !== confirmPassword}
                className={`w-full ${primaryColor} text-white`}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Alterar senha'}
              </Button>

              <Button
                variant="ghost"
                onClick={() => setStep('otp')}
                className="w-full"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar
              </Button>
            </>
          )}

          {/* Step: Success */}
          {step === 'success' && (
            <div className="flex flex-col items-center space-y-4">
              <div className={`w-16 h-16 rounded-full ${isProvider ? 'bg-blue-500/10' : 'bg-primary/10'} flex items-center justify-center`}>
                <CheckCircle className={`w-8 h-8 ${textColor}`} />
              </div>
              
              <p className="text-center text-muted-foreground">
                Agora você pode fazer login com sua nova senha
              </p>

              <Button
                onClick={handleClose}
                className={`w-full ${primaryColor} text-white`}
              >
                Voltar para login
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
