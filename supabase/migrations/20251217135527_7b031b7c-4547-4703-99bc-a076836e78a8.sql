-- ENUMS
CREATE TYPE public.service_type AS ENUM ('guincho', 'borracharia', 'mecanica', 'chaveiro');
CREATE TYPE public.chamado_status AS ENUM ('idle', 'searching', 'accepted', 'negotiating', 'awaiting_payment', 'in_service', 'finished', 'canceled');
CREATE TYPE public.payment_status AS ENUM ('pending', 'paid_mock', 'paid_stripe', 'failed', 'refunded');
CREATE TYPE public.user_profile_type AS ENUM ('client', 'provider');

-- PROFILES TABLE (linked to auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  avatar_url TEXT,
  active_profile user_profile_type DEFAULT 'client',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- PROVIDER DATA TABLE
CREATE TABLE public.provider_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  is_online BOOLEAN DEFAULT false,
  radar_range INTEGER DEFAULT 15,
  rating DECIMAL(3,2) DEFAULT 5.0,
  total_services INTEGER DEFAULT 0,
  current_lat DECIMAL(10, 8),
  current_lng DECIMAL(11, 8),
  current_address TEXT,
  services_offered service_type[] DEFAULT ARRAY['guincho'::service_type],
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- CHAMADOS TABLE
CREATE TABLE public.chamados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  prestador_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  tipo_servico service_type NOT NULL,
  status chamado_status DEFAULT 'idle' NOT NULL,
  
  -- Origem (obrigatório)
  origem_lat DECIMAL(10, 8) NOT NULL,
  origem_lng DECIMAL(11, 8) NOT NULL,
  origem_address TEXT NOT NULL,
  
  -- Destino (apenas para guincho)
  destino_lat DECIMAL(10, 8),
  destino_lng DECIMAL(11, 8),
  destino_address TEXT,
  
  -- Valores
  valor DECIMAL(10, 2),
  valor_proposto DECIMAL(10, 2),
  
  -- Payment info
  payment_status payment_status DEFAULT 'pending',
  payment_method TEXT,
  payment_provider TEXT DEFAULT 'mock',
  stripe_payment_intent_id TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- CHAT MESSAGES TABLE
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chamado_id UUID REFERENCES public.chamados(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sender_type user_profile_type NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chamados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- PROFILES POLICIES
CREATE POLICY "Users can view all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- PROVIDER DATA POLICIES
CREATE POLICY "Anyone can view online providers" ON public.provider_data
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Providers can update own data" ON public.provider_data
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Providers can insert own data" ON public.provider_data
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- CHAMADOS POLICIES
CREATE POLICY "Users can view their own chamados" ON public.chamados
  FOR SELECT TO authenticated 
  USING (auth.uid() = cliente_id OR auth.uid() = prestador_id);

CREATE POLICY "Providers can view searching chamados" ON public.chamados
  FOR SELECT TO authenticated 
  USING (status = 'searching');

CREATE POLICY "Clients can create chamados" ON public.chamados
  FOR INSERT TO authenticated 
  WITH CHECK (auth.uid() = cliente_id);

CREATE POLICY "Involved users can update chamados" ON public.chamados
  FOR UPDATE TO authenticated 
  USING (auth.uid() = cliente_id OR auth.uid() = prestador_id);

-- CHAT MESSAGES POLICIES
CREATE POLICY "Chamado participants can view messages" ON public.chat_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chamados 
      WHERE id = chamado_id 
      AND (cliente_id = auth.uid() OR prestador_id = auth.uid())
    )
  );

CREATE POLICY "Chamado participants can send messages" ON public.chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM public.chamados 
      WHERE id = chamado_id 
      AND (cliente_id = auth.uid() OR prestador_id = auth.uid())
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_provider_data_updated_at
  BEFORE UPDATE ON public.provider_data
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_chamados_updated_at
  BEFORE UPDATE ON public.chamados
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, name, email)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data ->> 'name', 'Usuário'),
    NEW.email
  );
  RETURN NEW;
END;
$$;

-- Trigger to create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Enable realtime for chamados and provider_data
ALTER PUBLICATION supabase_realtime ADD TABLE public.chamados;
ALTER PUBLICATION supabase_realtime ADD TABLE public.provider_data;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;