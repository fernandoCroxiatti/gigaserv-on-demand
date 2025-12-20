// Vehicle types for service requests
export type VehicleType = 
  | 'carro_passeio'
  | 'carro_utilitario'
  | 'pickup'
  | 'van'
  | 'moto'
  | 'caminhao_toco'
  | 'caminhao_34'
  | 'truck'
  | 'carreta'
  | 'cavalinho'
  | 'onibus'
  | 'micro_onibus'
  | 'outro';

export interface VehicleTypeConfig {
  label: string;
  icon: string;
  description?: string;
}

export const VEHICLE_TYPES: Record<VehicleType, VehicleTypeConfig> = {
  carro_passeio: {
    label: 'Carro Passeio',
    icon: '🚗',
    description: 'Sedan, hatch, esportivo',
  },
  carro_utilitario: {
    label: 'SUV / Utilitário',
    icon: '🚙',
    description: 'SUV, crossover, utilitário',
  },
  pickup: {
    label: 'Pickup',
    icon: '🛻',
    description: 'Caminhonete, pickup',
  },
  van: {
    label: 'Van',
    icon: '🚐',
    description: 'Van de carga ou passageiros',
  },
  moto: {
    label: 'Moto',
    icon: '🏍️',
    description: 'Motocicleta, scooter',
  },
  caminhao_toco: {
    label: 'Caminhão Toco',
    icon: '🚚',
    description: 'Caminhão 2 eixos',
  },
  caminhao_34: {
    label: 'Caminhão 3/4',
    icon: '🚚',
    description: 'Caminhão médio',
  },
  truck: {
    label: 'Truck',
    icon: '🚛',
    description: 'Caminhão 3 eixos',
  },
  carreta: {
    label: 'Carreta',
    icon: '🚛',
    description: 'Caminhão articulado',
  },
  cavalinho: {
    label: 'Cavalinho',
    icon: '🚜',
    description: 'Cavalo mecânico sem carreta',
  },
  onibus: {
    label: 'Ônibus',
    icon: '🚌',
    description: 'Ônibus de passageiros',
  },
  micro_onibus: {
    label: 'Micro-ônibus',
    icon: '🚐',
    description: 'Micro-ônibus, sprinter',
  },
  outro: {
    label: 'Outro',
    icon: '🚘',
    description: 'Outro tipo de veículo',
  },
};

// Ordered list for display
export const VEHICLE_TYPE_ORDER: VehicleType[] = [
  'carro_passeio',
  'carro_utilitario',
  'pickup',
  'van',
  'moto',
  'caminhao_toco',
  'caminhao_34',
  'truck',
  'carreta',
  'cavalinho',
  'onibus',
  'micro_onibus',
  'outro',
];
