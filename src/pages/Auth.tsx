import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { Loader2, Phone, Lock, User, FileText, Eye, EyeOff, ArrowLeft, Check } from 'lucide-react';
import { SERVICE_CONFIG, ServiceType } from '@/types/chamado';

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
  const [selectedServices, setSelectedServices] = useState<ServiceType[]>(['guincho']);

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
    setSelectedServices(['guincho']);
  };

  const handleBack = () => {
    if (step === 'register') {
      setStep('login');
    } else {
      setStep('select');
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
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      
      if (error) {
        if (error.message.includes('Invalid login')) {
          toast({ title: 'Erro', description: 'Telefone ou senha incorretos', variant: 'destructive' });
        } else {
          toast({ title: 'Erro', description: error.message, variant: 'destructive' });
        }
        return;
      }
      
      toast({ title: 'Sucesso', description: 'Login realizado com sucesso!' });
      navigate('/');
    } catch (error) {
      toast({ title: 'Erro', description: 'Erro ao fazer login', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
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
      const email = getEmailFromPhone(phone);
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            name,
            phone: phone.replace(/\D/g, ''),
            perfil_principal: profileType,
            cpf: profileType === 'provider' ? cpf.replace(/\D/g, '') : null,
            services_offered: profileType === 'provider' ? selectedServices : null,
          },
        },
      });
      
      if (error) {
        if (error.message.includes('already registered')) {
          toast({ title: 'Erro', description: 'Este telefone já está cadastrado', variant: 'destructive' });
        } else {
          toast({ title: 'Erro', description: error.message, variant: 'destructive' });
        }
        return;
      }

      if (data.user) {
        await new Promise(resolve => setTimeout(resolve, 500));
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
        <div className="flex-1 flex flex-col items-center justify-center px-8 pt-16 pb-8">
          {/* Large Logo */}
          <div className="mb-8 animate-fade-in">
            <div className="w-28 h-28 rounded-full bg-primary/10 flex items-center justify-center mb-6 mx-auto">
              <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center">
                <svg 
                  viewBox="0 0 24 24" 
                  className="w-10 h-10 text-primary-foreground"
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
              <div className="flex items-center justify-center gap-2 mb-2">
                <div className="w-4 h-4 rounded-full bg-primary animate-pulse" />
                <span className="font-black text-4xl tracking-tight text-foreground">GIGA</span>
                <span className="font-black text-4xl text-primary">S.O.S</span>
              </div>
              <p className="text-muted-foreground text-base font-medium">Serviços automotivos 24h</p>
            </div>
          </div>

          {/* Features */}
          <div className="flex items-center justify-center gap-6 mb-12 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary" />
              <span>Guincho</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary" />
              <span>Mecânica</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary" />
              <span>Chaveiro</span>
            </div>
          </div>
        </div>
      )}

      {/* Compact Header for login/register steps */}
      {step !== 'select' && (
        <div className="px-6 pt-12 pb-6">
          <div className="flex items-center justify-center gap-2">
            <div className="w-3 h-3 rounded-full bg-primary" />
            <span className="font-bold text-xl tracking-tight text-foreground">GIGA</span>
            <span className="font-bold text-xl text-primary">S.O.S</span>
          </div>
        </div>
      )}

      {/* Content */}
      <div className={`px-6 pb-8 ${step === 'select' ? '' : 'flex-1 flex items-start pt-4'}`}>
        <div className="w-full max-w-md mx-auto">
          <div className="bg-card rounded-3xl shadow-uber-lg p-8 space-y-6">
            
            {/* Step: Select Profile */}
            {step === 'select' && (
              <div className="space-y-5">
                <h2 className="text-xl font-semibold text-center text-foreground">Como deseja entrar?</h2>
                
                <Button
                  onClick={() => handleSelectProfile('client')}
                  className="w-full h-14 rounded-2xl text-lg font-semibold shadow-md"
                  variant="default"
                >
                  Login Cliente
                </Button>
                
                <Button
                  onClick={() => handleSelectProfile('provider')}
                  className="w-full h-14 rounded-2xl text-lg font-semibold shadow-md"
                  variant="provider"
                >
                  Login Prestador
                </Button>

                <p className="text-center text-xs text-muted-foreground pt-4">
                  Ao continuar, você concorda com nossos Termos de Uso e Política de Privacidade
                </p>
              </div>
            )}

            {/* Step: Login */}
            {step === 'login' && (
              <>
                <div className="flex items-center gap-3">
                  <button onClick={handleBack} className="p-2 -ml-2 rounded-full hover:bg-secondary transition-colors">
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <h2 className="text-xl font-semibold text-foreground">
                    Login {isProvider ? 'Prestador' : 'Cliente'}
                  </h2>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-foreground">Telefone</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input
                        id="phone"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(formatPhone(e.target.value))}
                        placeholder="(11) 99999-9999"
                        className="pl-10 h-12 rounded-xl bg-secondary/50 border-0 focus:ring-2 focus:ring-primary"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-foreground">Senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Sua senha"
                        className="pl-10 pr-10 h-12 rounded-xl bg-secondary/50 border-0 focus:ring-2 focus:ring-primary"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2"
                      >
                        {showPassword ? (
                          <EyeOff className="w-5 h-5 text-muted-foreground" />
                        ) : (
                          <Eye className="w-5 h-5 text-muted-foreground" />
                        )}
                      </button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full h-12 rounded-xl font-semibold mt-2"
                    variant={isProvider ? 'provider' : 'default'}
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Entrar'}
                  </Button>
                </form>

                <p className="text-center text-sm text-muted-foreground">
                  Não tem conta?{' '}
                  <button
                    onClick={() => setStep('register')}
                    className={`font-semibold ${isProvider ? 'text-provider-primary' : 'text-primary'}`}
                  >
                    Cadastre-se
                  </button>
                </p>
              </>
            )}

            {/* Step: Register */}
            {step === 'register' && (
              <>
                <div className="flex items-center gap-3">
                  <button onClick={handleBack} className="p-2 -ml-2 rounded-full hover:bg-secondary transition-colors">
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <h2 className="text-xl font-semibold text-foreground">
                    Cadastro {isProvider ? 'Prestador' : 'Cliente'}
                  </h2>
                </div>

                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-foreground">Nome completo</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input
                        id="name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Seu nome"
                        className="pl-10 h-12 rounded-xl bg-secondary/50 border-0 focus:ring-2 focus:ring-primary"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-foreground">Telefone</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input
                        id="phone"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(formatPhone(e.target.value))}
                        placeholder="(11) 99999-9999"
                        className="pl-10 h-12 rounded-xl bg-secondary/50 border-0 focus:ring-2 focus:ring-primary"
                      />
                    </div>
                  </div>

                  {isProvider && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="cpf" className="text-foreground">CPF</Label>
                        <div className="relative">
                          <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                          <Input
                            id="cpf"
                            type="text"
                            value={cpf}
                            onChange={(e) => setCpf(formatCPF(e.target.value))}
                            placeholder="000.000.000-00"
                            className="pl-10 h-12 rounded-xl bg-secondary/50 border-0 focus:ring-2 focus:ring-primary"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-foreground">Serviços oferecidos</Label>
                        <p className="text-xs text-muted-foreground">Selecione os serviços que você realiza</p>
                        <div className="grid grid-cols-2 gap-2">
                          {ALL_SERVICES.map((service) => {
                            const config = SERVICE_CONFIG[service];
                            const isSelected = selectedServices.includes(service);
                            return (
                              <button
                                key={service}
                                type="button"
                                onClick={() => toggleService(service)}
                                className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                                  isSelected 
                                    ? 'border-provider-primary bg-provider-primary/10' 
                                    : 'border-border bg-secondary/50 hover:border-provider-primary/50'
                                }`}
                              >
                                <span className="text-lg">{config.icon}</span>
                                <span className={`text-sm font-medium ${isSelected ? 'text-provider-primary' : 'text-foreground'}`}>
                                  {config.label}
                                </span>
                                {isSelected && <Check className="w-4 h-4 ml-auto text-provider-primary" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-foreground">Senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                        className="pl-10 pr-10 h-12 rounded-xl bg-secondary/50 border-0 focus:ring-2 focus:ring-primary"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2"
                      >
                        {showPassword ? (
                          <EyeOff className="w-5 h-5 text-muted-foreground" />
                        ) : (
                          <Eye className="w-5 h-5 text-muted-foreground" />
                        )}
                      </button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full h-12 rounded-xl font-semibold mt-2"
                    variant={isProvider ? 'provider' : 'default'}
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Cadastrar'}
                  </Button>
                </form>

                <p className="text-center text-sm text-muted-foreground">
                  Já tem conta?{' '}
                  <button
                    onClick={() => setStep('login')}
                    className={`font-semibold ${isProvider ? 'text-provider-primary' : 'text-primary'}`}
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
