import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { Chamado, ChamadoStatus, User, UserProfile, Provider, Location, ChatMessage } from '@/types/chamado';

interface AppContextType {
  // User state
  user: User;
  setActiveProfile: (profile: UserProfile) => void;
  
  // Chamado state
  chamado: Chamado | null;
  setChamadoStatus: (status: ChamadoStatus) => void;
  createChamado: (origem: Location, destino: Location) => void;
  acceptChamado: (prestadorId: string) => void;
  proposeValue: (value: number) => void;
  confirmValue: () => void;
  cancelChamado: () => void;
  finishService: () => void;
  
  // Provider state
  availableProviders: Provider[];
  toggleProviderOnline: () => void;
  setProviderRadarRange: (range: number) => void;
  
  // Chat state
  chatMessages: ChatMessage[];
  sendChatMessage: (message: string) => void;
  
  // Incoming request for provider
  incomingRequest: Chamado | null;
  acceptIncomingRequest: () => void;
  declineIncomingRequest: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Mock data
const mockProviders: Provider[] = [
  {
    id: 'provider-1',
    name: 'Carlos Silva',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Carlos',
    rating: 4.9,
    totalServices: 342,
    online: true,
    location: { lat: -23.5505, lng: -46.6333, address: 'Av. Paulista, 1000' },
    radarRange: 15,
  },
  {
    id: 'provider-2',
    name: 'Ana Oliveira',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Ana',
    rating: 4.8,
    totalServices: 215,
    online: true,
    location: { lat: -23.5515, lng: -46.6343, address: 'Rua Augusta, 500' },
    radarRange: 20,
  },
  {
    id: 'provider-3',
    name: 'Roberto Santos',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Roberto',
    rating: 4.7,
    totalServices: 189,
    online: true,
    location: { lat: -23.5525, lng: -46.6353, address: 'Rua Oscar Freire, 200' },
    radarRange: 25,
  },
];

const defaultUser: User = {
  id: 'user-1',
  name: 'João Pedro',
  email: 'joao@email.com',
  phone: '(11) 99999-9999',
  avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Joao',
  activeProfile: 'client',
  providerData: {
    online: false,
    radarRange: 15,
    rating: 4.9,
    totalServices: 0,
  },
};

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User>(defaultUser);
  const [chamado, setChamado] = useState<Chamado | null>(null);
  const [availableProviders, setAvailableProviders] = useState<Provider[]>(mockProviders);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [incomingRequest, setIncomingRequest] = useState<Chamado | null>(null);

  // Simulate provider movement
  useEffect(() => {
    const interval = setInterval(() => {
      setAvailableProviders(prev => 
        prev.map(p => ({
          ...p,
          location: {
            ...p.location,
            lat: p.location.lat + (Math.random() - 0.5) * 0.001,
            lng: p.location.lng + (Math.random() - 0.5) * 0.001,
          }
        }))
      );
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // Simulate incoming request for provider
  useEffect(() => {
    if (user.activeProfile === 'provider' && user.providerData?.online && !chamado) {
      const timeout = setTimeout(() => {
        const mockRequest: Chamado = {
          id: `chamado-${Date.now()}`,
          status: 'searching',
          clienteId: 'client-mock',
          prestadorId: null,
          origem: { lat: -23.5505, lng: -46.6333, address: 'Av. Paulista, 1578, São Paulo' },
          destino: { lat: -23.5615, lng: -46.6543, address: 'Shopping Ibirapuera, São Paulo' },
          valor: null,
          valorProposto: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        setIncomingRequest(mockRequest);
      }, 5000);
      return () => clearTimeout(timeout);
    }
  }, [user.activeProfile, user.providerData?.online, chamado]);

  const setActiveProfile = useCallback((profile: UserProfile) => {
    setUser(prev => ({ ...prev, activeProfile: profile }));
    setChamado(null);
    setChatMessages([]);
    setIncomingRequest(null);
  }, []);

  const setChamadoStatus = useCallback((status: ChamadoStatus) => {
    setChamado(prev => prev ? { ...prev, status, updatedAt: new Date() } : null);
  }, []);

  const createChamado = useCallback((origem: Location, destino: Location) => {
    const newChamado: Chamado = {
      id: `chamado-${Date.now()}`,
      status: 'searching',
      clienteId: user.id,
      prestadorId: null,
      origem,
      destino,
      valor: null,
      valorProposto: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setChamado(newChamado);
    
    // Simulate provider accepting after 3 seconds
    setTimeout(() => {
      setChamado(prev => prev ? {
        ...prev,
        status: 'accepted',
        prestadorId: 'provider-1',
        updatedAt: new Date(),
      } : null);
    }, 3000);
  }, [user.id]);

  const acceptChamado = useCallback((prestadorId: string) => {
    setChamado(prev => prev ? {
      ...prev,
      status: 'negotiating',
      prestadorId,
      updatedAt: new Date(),
    } : null);
  }, []);

  const proposeValue = useCallback((value: number) => {
    setChamado(prev => prev ? {
      ...prev,
      valorProposto: value,
      updatedAt: new Date(),
    } : null);
    
    // Add system message
    const msg: ChatMessage = {
      id: `msg-${Date.now()}`,
      senderId: user.id,
      senderType: user.activeProfile,
      message: `Valor proposto: R$ ${value.toFixed(2)}`,
      timestamp: new Date(),
    };
    setChatMessages(prev => [...prev, msg]);
  }, [user.id, user.activeProfile]);

  const confirmValue = useCallback(() => {
    setChamado(prev => prev ? {
      ...prev,
      status: 'confirmed',
      valor: prev.valorProposto,
      updatedAt: new Date(),
    } : null);
  }, []);

  const cancelChamado = useCallback(() => {
    setChamado(prev => prev ? {
      ...prev,
      status: 'canceled',
      updatedAt: new Date(),
    } : null);
    
    setTimeout(() => {
      setChamado(null);
      setChatMessages([]);
    }, 2000);
  }, []);

  const finishService = useCallback(() => {
    setChamado(prev => prev ? {
      ...prev,
      status: 'finished',
      updatedAt: new Date(),
    } : null);
    
    setTimeout(() => {
      setChamado(null);
      setChatMessages([]);
    }, 3000);
  }, []);

  const toggleProviderOnline = useCallback(() => {
    setUser(prev => ({
      ...prev,
      providerData: prev.providerData ? {
        ...prev.providerData,
        online: !prev.providerData.online,
      } : undefined,
    }));
  }, []);

  const setProviderRadarRange = useCallback((range: number) => {
    setUser(prev => ({
      ...prev,
      providerData: prev.providerData ? {
        ...prev.providerData,
        radarRange: range,
      } : undefined,
    }));
  }, []);

  const sendChatMessage = useCallback((message: string) => {
    const msg: ChatMessage = {
      id: `msg-${Date.now()}`,
      senderId: user.id,
      senderType: user.activeProfile,
      message,
      timestamp: new Date(),
    };
    setChatMessages(prev => [...prev, msg]);
    
    // Simulate response after 1 second
    setTimeout(() => {
      const response: ChatMessage = {
        id: `msg-${Date.now()}-response`,
        senderId: user.activeProfile === 'client' ? 'provider-1' : 'client-mock',
        senderType: user.activeProfile === 'client' ? 'provider' : 'client',
        message: 'Ok, combinado! 👍',
        timestamp: new Date(),
      };
      setChatMessages(prev => [...prev, response]);
    }, 1000);
  }, [user.id, user.activeProfile]);

  const acceptIncomingRequest = useCallback(() => {
    if (incomingRequest) {
      setChamado({
        ...incomingRequest,
        status: 'negotiating',
        prestadorId: user.id,
        updatedAt: new Date(),
      });
      setIncomingRequest(null);
    }
  }, [incomingRequest, user.id]);

  const declineIncomingRequest = useCallback(() => {
    setIncomingRequest(null);
  }, []);

  return (
    <AppContext.Provider value={{
      user,
      setActiveProfile,
      chamado,
      setChamadoStatus,
      createChamado,
      acceptChamado,
      proposeValue,
      confirmValue,
      cancelChamado,
      finishService,
      availableProviders,
      toggleProviderOnline,
      setProviderRadarRange,
      chatMessages,
      sendChatMessage,
      incomingRequest,
      acceptIncomingRequest,
      declineIncomingRequest,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
