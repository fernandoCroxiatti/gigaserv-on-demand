import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { Loader2, Phone, Lock, User, FileText, Eye, EyeOff, ArrowLeft, Check } from 'lucide-react';
import { SERVICE_CONFIG, ServiceType } from '@/types/chamado';
import { ForgotPasswordModal } from '@/components/Auth/ForgotPasswordModal';
import {
  canRequestNotificationsInThisContext,
  hasAskedNotificationPermission,
  markAskedNotificationPermission,
} from '@/lib/notificationPermissionLogin';
// requestNotificationPermissionFromLogin não é mais utilizado - removido o import
type ProfileType = 'client' | 'provider';
type AuthStep = 'select' | 'login' | 'register';

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
  const [step, setStep] = useState<AuthStep>('select');
  const [profileType, setProfileType] = useState<ProfileType>('client');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
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
    setStep('login');
    setPhone('');
    setPassword('');
    setName('');
    setCpf('');
    setVehiclePlate('');
    setSelectedServices(['guincho']);
  };

  const handleBack = () => {
    if (step === 'register') {
      setStep('login');
    } else {
      setStep('select');
    }
  };

  /**
   * Solicita permissão de notificação diretamente após login/cadastro bem-sucedido.
   * Funciona imediatamente pois estamos no contexto de um gesto do usuário (submit do form).
   */
  const requestNotificationPermissionAfterAuth = async (userId: string) => {
    // Web-only: permission prompts usually cannot run in iframes (preview)
    if (!canRequestNotificationsInThisContext()) {
      console.log('[Auth] Notification request blocked: not top-level context');
      return;
    }

    // Only request if browser permission is "default" (never asked)
    if (typeof Notification === 'undefined' || Notification.permission !== 'default') {
      console.log('[Auth] Notification permission already:', Notification?.permission);
      return;
    }

    // Only once per user/device
    if (hasAskedNotificationPermission(userId)) {
      console.log('[Auth] Already asked notification permission for this user');
      return;
    }

    try {
      console.log('[Auth] Requesting notification permission...');
      // Mark as asked BEFORE requesting to prevent duplicates
      markAskedNotificationPermission(userId);
      
      // Request permission directly - this works because we're still in user gesture context
      const result = await Notification.requestPermission();
      console.log('[Auth] Notification permission result:', result);
      
      // Store the result in localStorage so NotificationProvider can pick it up
      if (result === 'granted') {
        try {
          localStorage.setItem('gigasos:notif_perm_granted_pending', '1');
        } catch {
          // ignore
        }
      }
    } catch (err) {
      console.error('[Auth] Error requesting notification permission:', err);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || !password) {
      toast({ title: 'Erro', description: 'Preencha todos os campos', variant: 'destructive' });
      return;
    }

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

      // Permission request is triggered ONLY after successful login
      // and only when browser permission is still "default".
      if (data.user?.id) {
        requestNotificationPermissionAfterAuth(data.user.id);
      }
      
      toast({ title: 'Sucesso', description: 'Login realizado com sucesso!' });
      navigate('/');
    } catch (error) {
      toast({ title: 'Erro', description: 'Erro ao fazer login', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
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
      }
      
      // Permission request is triggered ONLY after successful registration
      // and only when browser permission is still "default".
      if (data.user?.id) {
        requestNotificationPermissionAfterAuth(data.user.id);
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
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/30 flex flex-col">
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

      {/* Compact Header for login/register steps */}
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
                <h2 className="text-lg font-semibold text-center text-foreground">Como deseja entrar?</h2>
                
                <Button
                  onClick={() => handleSelectProfile('client')}
                  className="w-full h-12 rounded-xl text-base font-semibold shadow-sm hover:shadow-md transition-shadow"
                  variant="default"
                >
                  Login Cliente
                </Button>
                
                <Button
                  onClick={() => handleSelectProfile('provider')}
                  className="w-full h-12 rounded-xl text-base font-semibold shadow-sm hover:shadow-md transition-shadow bg-blue-500/90 hover:bg-blue-500 text-white"
                >
                  Login Prestador
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

            {/* Step: Login */}
            {step === 'login' && (
              <>
                <div className="flex items-center gap-2">
                  <button onClick={handleBack} className="p-1.5 -ml-1 rounded-full hover:bg-secondary/80 transition-colors">
                    <ArrowLeft className="w-4 h-4 text-muted-foreground" />
                  </button>
                  <h2 className="text-base font-semibold text-foreground">
                    Login {isProvider ? 'Prestador' : 'Cliente'}
                  </h2>
                </div>

                <form onSubmit={handleLogin} className="space-y-3">
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
                        className="pl-9 h-11 rounded-xl bg-secondary/40 border-0 focus:ring-2 focus:ring-primary text-sm"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="password" className="text-foreground text-sm">Senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Sua senha"
                        className="pl-9 pr-9 h-11 rounded-xl bg-secondary/40 border-0 focus:ring-2 focus:ring-primary text-sm"
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
                      className={`text-xs ${isProvider ? 'text-blue-500' : 'text-primary'} hover:underline`}
                    >
                      Esqueci minha senha
                    </button>
                  </div>

                  <Button
                    type="submit"
                    disabled={loading}
                    className={`w-full h-11 rounded-xl font-semibold mt-3 shadow-sm hover:shadow-md transition-shadow ${isProvider ? 'bg-blue-500/90 hover:bg-blue-500 text-white' : ''}`}
                    variant={isProvider ? undefined : 'default'}
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Entrar'}
                  </Button>
                </form>

                <ForgotPasswordModal 
                  open={showForgotPassword} 
                  onOpenChange={setShowForgotPassword}
                  isProvider={isProvider}
                />

                <p className="text-center text-xs text-muted-foreground">
                  Não tem conta?{' '}
                  <button
                    onClick={() => setStep('register')}
                    className={`font-semibold ${isProvider ? 'text-blue-500' : 'text-primary'}`}
                  >
                    Cadastre-se
                  </button>
                </p>
              </>
            )}

            {/* Step: Register */}
            {step === 'register' && (
              <>
                <div className="flex items-center gap-2">
                  <button onClick={handleBack} className="p-1.5 -ml-1 rounded-full hover:bg-secondary/80 transition-colors">
                    <ArrowLeft className="w-4 h-4 text-muted-foreground" />
                  </button>
                  <h2 className="text-base font-semibold text-foreground">
                    Cadastro {isProvider ? 'Prestador' : 'Cliente'}
                  </h2>
                </div>

                <form onSubmit={handleRegister} className="space-y-3">
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
                        className="pl-9 h-11 rounded-xl bg-secondary/40 border-0 focus:ring-2 focus:ring-primary text-sm"
                      />
                    </div>
                  </div>

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
                        className="pl-9 h-11 rounded-xl bg-secondary/40 border-0 focus:ring-2 focus:ring-primary text-sm"
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
                            className="pl-9 h-11 rounded-xl bg-secondary/40 border-0 focus:ring-2 focus:ring-primary text-sm"
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
                            className="pl-9 h-11 rounded-xl bg-secondary/40 border-0 focus:ring-2 focus:ring-primary uppercase text-sm"
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
                                className={`flex items-center gap-1.5 p-2.5 rounded-lg border transition-all ${
                                  isSelected 
                                    ? 'border-blue-500 bg-blue-500/10' 
                                    : 'border-border/50 bg-secondary/40 hover:border-blue-500/50'
                                }`}
                              >
                                <span className="text-sm">{config.icon}</span>
                                <span className={`text-xs font-medium ${isSelected ? 'text-blue-600' : 'text-foreground'}`}>
                                  {config.label}
                                </span>
                                {isSelected && <Check className="w-3 h-3 ml-auto text-blue-500" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}

                  <div className="space-y-1.5">
                    <Label htmlFor="password" className="text-foreground text-sm">Senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                        className="pl-9 pr-9 h-11 rounded-xl bg-secondary/40 border-0 focus:ring-2 focus:ring-primary text-sm"
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
                    className={`w-full h-11 rounded-xl font-semibold mt-3 shadow-sm hover:shadow-md transition-shadow ${isProvider ? 'bg-blue-500/90 hover:bg-blue-500 text-white' : ''}`}
                    variant={isProvider ? undefined : 'default'}
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Cadastrar'}
                  </Button>
                </form>

                <p className="text-center text-xs text-muted-foreground">
                  Já tem conta?{' '}
                  <button
                    onClick={() => setStep('login')}
                    className={`font-semibold ${isProvider ? 'text-blue-500' : 'text-primary'}`}
                  >
                    Faça login
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
