import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { Loader2, Phone, Lock, User, FileText, Eye, EyeOff, ArrowLeft, Check } from 'lucide-react';
import { SERVICE_CONFIG, ServiceType } from '@/types/chamado';
import { ForgotPasswordModal } from '@/components/Auth/ForgotPasswordModal';
import { requestOneSignalPermission, oneSignalLogin } from '@/lib/oneSignal';

type ProfileType = 'client' | 'provider';
type AuthStep = 'select' | 'phone' | 'password' | 'register';

const ALL_SERVICES: ServiceType[] = ['guincho', 'borracharia', 'mecanica', 'chaveiro'];

function validateCPF(cpf: string): boolean {
  cpf = cpf.replace(/\D/g, '');
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
  
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cpf[i]) * (10 - i);
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cpf[9])) return false;
  
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cpf[i]) * (11 - i);
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  return remainder === parseInt(cpf[10]);
}

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function formatCPF(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

export default function Auth() {
  const navigate = useNavigate();
  const permissionPromiseRef = useRef<Promise<boolean> | null>(null);

  const [step, setStep] = useState<AuthStep>('select');
  const [profileType, setProfileType] = useState<ProfileType>('client');
  const [loading, setLoading] = useState(false);
  const [checkingPhone, setCheckingPhone] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [phoneExists, setPhoneExists] = useState(false);
  
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [cpf, setCpf] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [selectedServices, setSelectedServices] = useState<ServiceType[]>(['guincho']);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  const toggleService = (service: ServiceType) => {
    setSelectedServices(prev => 
      prev.includes(service)
        ? prev.filter(s => s !== service)
        : [...prev, service]
    );
  };

  const getEmailFromPhone = (phone: string) => {
    const digits = phone.replace(/\D/g, '');
    return `${digits}@gigasos.app`;
  };

  const handleSelectProfile = (type: ProfileType) => {
    setProfileType(type);
    setStep('phone');
    setPhone('');
    setPassword('');
    setName('');
    setCpf('');
    setVehiclePlate('');
    setSelectedServices(['guincho']);
    setPhoneExists(false);
  };

  const handleBack = () => {
    if (step === 'register') {
      setStep('phone');
      setPhoneExists(false);
    } else if (step === 'password') {
      setStep('phone');
      setPassword('');
    } else {
      setStep('select');
    }
  };

  /**
   * Request OneSignal permission - no native browser popup needed for OneSignal
   * OneSignal handles this internally with proper TWA/PWA support
   */
  const startNotificationPermissionRequest = () => {
    const promise = requestOneSignalPermission();
    permissionPromiseRef.current = promise;
    return promise;
  };

  // Check if phone exists in database using edge function (bypasses RLS)
  const checkPhoneExists = async (): Promise<boolean> => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) return false;
    
    try {
      const response = await supabase.functions.invoke('check-phone-exists', {
        body: { phone: digits }
      });
      
      if (response.error) {
        console.error('Error checking phone:', response.error);
        return false;
      }
      
      return response.data?.exists === true;
    } catch (error) {
      console.error('Error checking phone:', error);
      return false;
    }
  };

  // Handle "Continuar" button - check if phone exists
  const handleContinue = async () => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10 || digits.length > 11) {
      toast({ title: 'Erro', description: 'Digite um telefone válido', variant: 'destructive' });
      return;
    }

    setCheckingPhone(true);
    try {
      const exists = await checkPhoneExists();
      setPhoneExists(exists);
      
      if (exists) {
        // Phone exists - go to password step
        setStep('password');
      } else {
        // Phone doesn't exist - go to register step
        setStep('register');
      }
    } catch {
      toast({ title: 'Erro', description: 'Erro ao verificar telefone', variant: 'destructive' });
    } finally {
      setCheckingPhone(false);
    }
  };

  const handleLoginClick = async () => {
    if (!phone || !password) {
      toast({ title: 'Erro', description: 'Preencha todos os campos', variant: 'destructive' });
      return;
    }

    // Start permission request before any await
    startNotificationPermissionRequest();

    setLoading(true);
    try {
      const email = getEmailFromPhone(phone);
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      
      if (error) {
        if (error.message.includes('Invalid login')) {
          toast({ title: 'Erro', description: 'Telefone ou senha incorretos', variant: 'destructive' });
        } else {
          toast({ title: 'Erro', description: error.message, variant: 'destructive' });
        }
        return;
      }

      // Wait for permission promise and login to OneSignal with user ID
      if (data.user) {
        await oneSignalLogin(data.user.id);
        
        // Await permission result (already started above)
        const granted = await permissionPromiseRef.current;
        permissionPromiseRef.current = null;
        
        console.log('[Auth] OneSignal permission result:', granted);
      }
      
      toast({ title: 'Sucesso', description: 'Login realizado com sucesso!' });
      navigate('/');
    } catch {
      toast({ title: 'Erro', description: 'Erro ao fazer login', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void handleLoginClick();
  };

  const checkCpfExists = async (cpfValue: string): Promise<boolean> => {
    const cleanCpf = cpfValue.replace(/\D/g, '');
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('cpf', cleanCpf)
      .eq('perfil_principal', 'provider')
      .limit(1);
    
    if (error) {
      console.error('Error checking CPF:', error);
      return false;
    }
    return data && data.length > 0;
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!phone || !password || !name) {
      toast({ title: 'Erro', description: 'Preencha todos os campos obrigatórios', variant: 'destructive' });
      return;
    }

    if (password.length < 6) {
      toast({ title: 'Erro', description: 'A senha deve ter pelo menos 6 caracteres', variant: 'destructive' });
      return;
    }

    if (profileType === 'provider') {
      if (!cpf) {
        toast({ title: 'Erro', description: 'CPF é obrigatório para prestadores', variant: 'destructive' });
        return;
      }
      if (!validateCPF(cpf)) {
        toast({ title: 'Erro', description: 'CPF inválido', variant: 'destructive' });
        return;
      }
      if (selectedServices.length === 0) {
        toast({ title: 'Erro', description: 'Selecione pelo menos um serviço', variant: 'destructive' });
        return;
      }
    }

    // OBRIGATÓRIO TWA: antes de qualquer await/fetch/navegação
    startNotificationPermissionRequest();

    setLoading(true);
    try {
      // Check for duplicate CPF for providers
      if (profileType === 'provider') {
        const cpfExists = await checkCpfExists(cpf);
        if (cpfExists) {
          toast({ title: 'Erro', description: 'Já existe um cadastro de prestador com este CPF.', variant: 'destructive' });
          setLoading(false);
          return;
        }
      }

      const email = getEmailFromPhone(phone);
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            phone: phone.replace(/\D/g, ''),
            perfil_principal: profileType,
            cpf: profileType === 'provider' ? cpf.replace(/\D/g, '') : null,
            services_offered: profileType === 'provider' ? selectedServices : null,
            vehicle_plate: profileType === 'provider' && vehiclePlate ? vehiclePlate.toUpperCase() : null,
          },
        },
      });
      
      if (error) {
        if (error.message.includes('already registered')) {
          toast({ title: 'Erro', description: 'Este telefone já está cadastrado', variant: 'destructive' });
        } else if (error.message.includes('duplicate key') && error.message.includes('cpf')) {
          toast({ title: 'Erro', description: 'Já existe um cadastro de prestador com este CPF.', variant: 'destructive' });
        } else {
          toast({ title: 'Erro', description: error.message, variant: 'destructive' });
        }
        return;
      }

      if (data.user) {
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Login to OneSignal with user ID
        await oneSignalLogin(data.user.id);
        
        // Await permission result (already started above)
        const granted = await permissionPromiseRef.current;
        permissionPromiseRef.current = null;
        
        console.log('[Auth] OneSignal permission result after register:', granted);
      }
      
      toast({ title: 'Sucesso', description: 'Cadastro realizado com sucesso!' });
      navigate('/');
    } catch (error) {
      toast({ title: 'Erro', description: 'Erro ao cadastrar', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const isProvider = profileType === 'provider';

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Hero Logo Section - Only show on select step */}
      {step === 'select' && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 pt-12 pb-6">
          {/* Large Logo */}
          <div className="mb-10 animate-fade-in">
            <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mb-5 mx-auto shadow-lg">
              <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center shadow-md">
                <svg 
                  viewBox="0 0 24 24" 
                  className="w-8 h-8 text-primary-foreground"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9L18 10l-2.9-5.8A2 2 0 0013.3 3H8.7a2 2 0 00-1.8 1.2L4 10l-2.5 1.1A2 2 0 000 13v3c0 .6.4 1 1 1h2"/>
                  <circle cx="7" cy="17" r="2"/>
                  <circle cx="17" cy="17" r="2"/>
                </svg>
              </div>
            </div>
            
            {/* Brand Name */}
            <div className="text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1.5">
                <div className="w-3 h-3 rounded-full bg-primary animate-pulse" />
                <span className="font-black text-3xl tracking-tight text-foreground">GIGA</span>
                <span className="font-black text-3xl text-primary">S.O.S</span>
              </div>
              <p className="text-muted-foreground text-sm font-medium">Serviços automotivos 24h</p>
            </div>
          </div>

          {/* Features */}
          <div className="flex items-center justify-center gap-5 mb-10 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-primary" />
              <span>Guincho</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-primary" />
              <span>Mecânica</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-primary" />
              <span>Chaveiro</span>
            </div>
          </div>
        </div>
      )}

      {/* Compact Header for other steps */}
      {step !== 'select' && (
        <div className="px-6 pt-10 pb-4">
          <div className="flex items-center justify-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-primary" />
            <span className="font-bold text-lg tracking-tight text-foreground">GIGA</span>
            <span className="font-bold text-lg text-primary">S.O.S</span>
          </div>
        </div>
      )}

      {/* Content */}
      <div className={`px-5 pb-6 ${step === 'select' ? '' : 'flex-1 flex items-start pt-2'}`}>
        <div className="w-full max-w-sm mx-auto">
          <div className="bg-card rounded-2xl shadow-card p-6 space-y-5">
            
            {/* Step: Select Profile */}
            {step === 'select' && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-center text-foreground">Como deseja continuar?</h2>
                
                <Button
                  onClick={() => handleSelectProfile('client')}
                  className="w-full h-14 rounded-2xl text-base font-semibold shadow-sm hover:shadow-md transition-all"
                  variant="default"
                >
                  Continuar como Cliente
                </Button>
                
                <Button
                  onClick={() => handleSelectProfile('provider')}
                  className="w-full h-14 rounded-2xl text-base font-semibold shadow-sm hover:shadow-md transition-all bg-secondary text-foreground hover:bg-secondary/80 border border-border"
                >
                  Continuar como Prestador
                </Button>

                <p className="text-center text-[10px] text-muted-foreground/70 pt-2 leading-relaxed">
                  Ao continuar, você concorda com nossos Termos de Uso e Política de Privacidade
                </p>

                {/* Legal links - Play Store compliance */}
                <div className="flex items-center justify-center gap-2 text-[10px] text-muted-foreground/60">
                  <button 
                    onClick={() => navigate('/terms')}
                    className="hover:text-muted-foreground transition-colors hover:underline"
                  >
                    Termos de Uso
                  </button>
                  <span>•</span>
                  <button 
                    onClick={() => navigate('/privacy')}
                    className="hover:text-muted-foreground transition-colors hover:underline"
                  >
                    Política de Privacidade
                  </button>
                  <span>•</span>
                  <button 
                    onClick={() => navigate('/support')}
                    className="hover:text-muted-foreground transition-colors hover:underline"
                  >
                    Suporte
                  </button>
                </div>
              </div>
            )}

            {/* Step: Phone (Unified login/register flow) */}
            {step === 'phone' && (
              <>
                <div className="flex items-center gap-2">
                  <button onClick={handleBack} className="p-1.5 -ml-1 rounded-full hover:bg-secondary/80 transition-colors">
                    <ArrowLeft className="w-4 h-4 text-muted-foreground" />
                  </button>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Entrar ou criar conta</h2>
                    <p className="text-xs text-muted-foreground">Rápido, seguro e disponível 24h</p>
                  </div>
                </div>

                <div className="space-y-4 pt-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="phone" className="text-foreground text-sm">Telefone</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="phone"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(formatPhone(e.target.value))}
                        placeholder="(11) 99999-9999"
                        className="pl-9 h-12 rounded-xl bg-secondary/40 border-0 focus:ring-2 focus:ring-primary text-base"
                        autoFocus
                      />
                    </div>
                  </div>

                  <Button
                    type="button"
                    onClick={() => void handleContinue()}
                    disabled={checkingPhone || phone.replace(/\D/g, '').length < 10}
                    className="w-full h-12 rounded-2xl font-semibold shadow-sm hover:shadow-md transition-all"
                    variant="default"
                  >
                    {checkingPhone ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Continuar'}
                  </Button>

                  <div className="flex items-center gap-3 pt-2">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-xs text-muted-foreground">ou</span>
                    <div className="flex-1 h-px bg-border" />
                  </div>

                  <Button
                    type="button"
                    onClick={async () => {
                      const digits = phone.replace(/\D/g, '');
                      if (digits.length < 10 || digits.length > 11) {
                        toast({ title: 'Atenção', description: 'Digite seu telefone para criar conta', variant: 'destructive' });
                        return;
                      }
                      setCheckingPhone(true);
                      try {
                        const exists = await checkPhoneExists();
                        if (exists) {
                          setPhoneExists(true);
                          setStep('password');
                          toast({ title: 'Atenção', description: 'Este telefone já possui cadastro. Faça login.', variant: 'destructive' });
                        } else {
                          setStep('register');
                        }
                      } catch {
                        toast({ title: 'Erro', description: 'Erro ao verificar telefone', variant: 'destructive' });
                      } finally {
                        setCheckingPhone(false);
                      }
                    }}
                    disabled={checkingPhone}
                    variant="outline"
                    className="w-full h-12 rounded-2xl font-semibold border-primary text-primary hover:bg-primary/5 transition-all"
                  >
                    {checkingPhone ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Criar conta'}
                  </Button>
                </div>
              </>
            )}

            {/* Step: Password (for existing users) */}
            {step === 'password' && (
              <>
                <div className="flex items-center gap-2">
                  <button onClick={handleBack} className="p-1.5 -ml-1 rounded-full hover:bg-secondary/80 transition-colors">
                    <ArrowLeft className="w-4 h-4 text-muted-foreground" />
                  </button>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Bem-vindo de volta!</h2>
                    <p className="text-xs text-muted-foreground">{phone}</p>
                  </div>
                </div>

                <form onSubmit={handleLoginSubmit} className="space-y-4 pt-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="password" className="text-foreground text-sm">Senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Digite sua senha"
                        className="pl-9 pr-9 h-12 rounded-xl bg-secondary/40 border-0 focus:ring-2 focus:ring-primary text-base"
                        autoFocus
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

                  <div className="text-right">
                    <button
                      type="button"
                      onClick={() => setShowForgotPassword(true)}
                      className="text-xs text-primary hover:underline"
                    >
                      Esqueci minha senha
                    </button>
                  </div>

                  <Button
                    type="button"
                    onClick={() => void handleLoginClick()}
                    disabled={loading}
                    className="w-full h-12 rounded-2xl font-semibold shadow-sm hover:shadow-md transition-all"
                    variant="default"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Entrar'}
                  </Button>
                </form>

                <ForgotPasswordModal 
                  open={showForgotPassword} 
                  onOpenChange={setShowForgotPassword}
                  isProvider={isProvider}
                />
              </>
            )}

            {/* Step: Register */}
            {step === 'register' && (
              <>
                <div className="flex items-center gap-2">
                  <button onClick={handleBack} className="p-1.5 -ml-1 rounded-full hover:bg-secondary/80 transition-colors">
                    <ArrowLeft className="w-4 h-4 text-muted-foreground" />
                  </button>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Criar conta</h2>
                    <p className="text-xs text-muted-foreground">
                      {isProvider ? 'Cadastro de Prestador' : 'Cadastro de Cliente'}
                    </p>
                  </div>
                </div>

                <form onSubmit={handleRegister} className="space-y-3 pt-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="name" className="text-foreground text-sm">Nome completo</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Seu nome"
                        className="pl-9 h-12 rounded-xl bg-secondary/40 border-0 focus:ring-2 focus:ring-primary text-base"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="phone-register" className="text-foreground text-sm">Telefone</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="phone-register"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(formatPhone(e.target.value))}
                        placeholder="(11) 99999-9999"
                        className="pl-9 h-12 rounded-xl bg-secondary/40 border-0 focus:ring-2 focus:ring-primary text-base"
                      />
                    </div>
                  </div>

                  {isProvider && (
                    <>
                      <div className="space-y-1.5">
                        <Label htmlFor="cpf" className="text-foreground text-sm">CPF</Label>
                        <div className="relative">
                          <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            id="cpf"
                            type="text"
                            value={cpf}
                            onChange={(e) => setCpf(formatCPF(e.target.value))}
                            placeholder="000.000.000-00"
                            className="pl-9 h-12 rounded-xl bg-secondary/40 border-0 focus:ring-2 focus:ring-primary text-base"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="vehiclePlate" className="text-foreground text-sm">Placa do veículo <span className="text-muted-foreground text-[10px] font-normal">(opcional)</span></Label>
                        <div className="relative">
                          <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            id="vehiclePlate"
                            type="text"
                            value={vehiclePlate}
                            onChange={(e) => setVehiclePlate(e.target.value.toUpperCase().slice(0, 7))}
                            placeholder="ABC-1D23"
                            className="pl-9 h-12 rounded-xl bg-secondary/40 border-0 focus:ring-2 focus:ring-primary uppercase text-base"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-foreground text-sm">Serviços oferecidos</Label>
                        <p className="text-[10px] text-muted-foreground">Selecione os serviços que você realiza</p>
                        <div className="grid grid-cols-2 gap-1.5">
                          {ALL_SERVICES.map((service) => {
                            const config = SERVICE_CONFIG[service];
                            const isSelected = selectedServices.includes(service);
                            return (
                              <button
                                key={service}
                                type="button"
                                onClick={() => toggleService(service)}
                                className={`flex items-center gap-1.5 p-2.5 rounded-xl border transition-all ${
                                  isSelected 
                                    ? 'border-primary bg-primary/10' 
                                    : 'border-border/50 bg-secondary/40 hover:border-primary/50'
                                }`}
                              >
                                <span className="text-sm">{config.icon}</span>
                                <span className={`text-xs font-medium ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                                  {config.label}
                                </span>
                                {isSelected && <Check className="w-3 h-3 ml-auto text-primary" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}

                  <div className="space-y-1.5">
                    <Label htmlFor="password-register" className="text-foreground text-sm">Senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="password-register"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                        className="pl-9 pr-9 h-12 rounded-xl bg-secondary/40 border-0 focus:ring-2 focus:ring-primary text-base"
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

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full h-12 rounded-2xl font-semibold mt-3 shadow-sm hover:shadow-md transition-all"
                    variant="default"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Criar conta'}
                  </Button>
                </form>

                <p className="text-center text-sm text-muted-foreground">
                  Já tem conta?{' '}
                  <button
                    onClick={() => {
                      setStep('phone');
                      setPhoneExists(false);
                    }}
                    className="font-semibold text-primary hover:underline"
                  >
                    Fazer login
                  </button>
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
