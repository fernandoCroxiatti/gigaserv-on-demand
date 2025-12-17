import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { Loader2, Phone, Lock, User, FileText, Eye, EyeOff, ArrowLeft } from 'lucide-react';

type ProfileType = 'client' | 'provider';
type AuthStep = 'select' | 'login' | 'register';

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

  const getEmailFromPhone = (phone: string) => {
    const digits = phone.replace(/\D/g, '');
    return `${digits}@gigasos.app`;
  };

  const handleSelectProfile = (type: ProfileType) => {
    setProfileType(type);
    setStep('login');
    // Clear form
    setPhone('');
    setPassword('');
    setName('');
    setCpf('');
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
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary flex flex-col">
      {/* Header */}
      <div className="p-6 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="w-3 h-3 rounded-full bg-primary" />
          <span className="font-bold text-2xl tracking-tight">GIGA</span>
          <span className="font-bold text-2xl text-primary">S.O.S</span>
        </div>
        <p className="text-muted-foreground text-sm">Serviços automotivos 24h</p>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="bg-card rounded-3xl shadow-uber-lg p-6 space-y-6">
            
            {/* Step: Select Profile */}
            {step === 'select' && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-center mb-6">Como deseja entrar?</h2>
                
                <Button
                  onClick={() => handleSelectProfile('client')}
                  className="w-full h-14 rounded-xl text-lg"
                  variant="default"
                >
                  Login Cliente
                </Button>
                
                <Button
                  onClick={() => handleSelectProfile('provider')}
                  className="w-full h-14 rounded-xl text-lg"
                  variant="provider"
                >
                  Login Prestador
                </Button>
              </div>
            )}

            {/* Step: Login */}
            {step === 'login' && (
              <>
                <div className="flex items-center gap-3">
                  <button onClick={handleBack} className="p-2 rounded-full hover:bg-secondary transition-colors">
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <h2 className="text-xl font-semibold">
                    Login {isProvider ? 'Prestador' : 'Cliente'}
                  </h2>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefone</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input
                        id="phone"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(formatPhone(e.target.value))}
                        placeholder="(11) 99999-9999"
                        className="pl-10 h-12 rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">Senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Sua senha"
                        className="pl-10 pr-10 h-12 rounded-xl"
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
                    className="w-full h-12 rounded-xl"
                    variant={isProvider ? 'provider' : 'default'}
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Entrar'}
                  </Button>
                </form>

                <p className="text-center text-sm text-muted-foreground">
                  Não tem conta?{' '}
                  <button
                    onClick={() => setStep('register')}
                    className={`font-medium ${isProvider ? 'text-provider-primary' : 'text-primary'}`}
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
                  <button onClick={handleBack} className="p-2 rounded-full hover:bg-secondary transition-colors">
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <h2 className="text-xl font-semibold">
                    Cadastro {isProvider ? 'Prestador' : 'Cliente'}
                  </h2>
                </div>

                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome completo</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input
                        id="name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Seu nome"
                        className="pl-10 h-12 rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefone</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input
                        id="phone"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(formatPhone(e.target.value))}
                        placeholder="(11) 99999-9999"
                        className="pl-10 h-12 rounded-xl"
                      />
                    </div>
                  </div>

                  {isProvider && (
                    <div className="space-y-2">
                      <Label htmlFor="cpf">CPF</Label>
                      <div className="relative">
                        <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                        <Input
                          id="cpf"
                          type="text"
                          value={cpf}
                          onChange={(e) => setCpf(formatCPF(e.target.value))}
                          placeholder="000.000.000-00"
                          className="pl-10 h-12 rounded-xl"
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="password">Senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                        className="pl-10 pr-10 h-12 rounded-xl"
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
                    className="w-full h-12 rounded-xl"
                    variant={isProvider ? 'provider' : 'default'}
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Cadastrar'}
                  </Button>
                </form>

                <p className="text-center text-sm text-muted-foreground">
                  Já tem conta?{' '}
                  <button
                    onClick={() => setStep('login')}
                    className={`font-medium ${isProvider ? 'text-provider-primary' : 'text-primary'}`}
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
