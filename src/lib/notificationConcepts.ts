import {
  ClipboardCheck,
  FileText,
  Settings,
  AlertTriangle,
  CheckCircle,
  MapPin,
  CreditCard,
  Shield,
  Sparkles,
  HeadphonesIcon,
  Bell,
  type LucideIcon,
} from 'lucide-react';

export type NotificationConcept =
  | 'checklist'
  | 'documento'
  | 'engrenagem'
  | 'alerta'
  | 'confirmacao'
  | 'mapa'
  | 'pagamento'
  | 'seguranca'
  | 'novidade'
  | 'suporte';

export interface ConceptConfig {
  icon: LucideIcon;
  label: string;
  bgColor: string;
  iconColor: string;
}

export const NOTIFICATION_CONCEPTS: Record<NotificationConcept, ConceptConfig> = {
  checklist: {
    icon: ClipboardCheck,
    label: 'Checklist',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    iconColor: 'text-blue-600 dark:text-blue-400',
  },
  documento: {
    icon: FileText,
    label: 'Documento',
    bgColor: 'bg-slate-100 dark:bg-slate-800/50',
    iconColor: 'text-slate-600 dark:text-slate-400',
  },
  engrenagem: {
    icon: Settings,
    label: 'Sistema',
    bgColor: 'bg-gray-100 dark:bg-gray-800/50',
    iconColor: 'text-gray-600 dark:text-gray-400',
  },
  alerta: {
    icon: AlertTriangle,
    label: 'Alerta',
    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
    iconColor: 'text-amber-600 dark:text-amber-400',
  },
  confirmacao: {
    icon: CheckCircle,
    label: 'Confirmação',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    iconColor: 'text-green-600 dark:text-green-400',
  },
  mapa: {
    icon: MapPin,
    label: 'Localização',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
    iconColor: 'text-red-600 dark:text-red-400',
  },
  pagamento: {
    icon: CreditCard,
    label: 'Pagamento',
    bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
  },
  seguranca: {
    icon: Shield,
    label: 'Segurança',
    bgColor: 'bg-purple-100 dark:bg-purple-900/30',
    iconColor: 'text-purple-600 dark:text-purple-400',
  },
  novidade: {
    icon: Sparkles,
    label: 'Novidade',
    bgColor: 'bg-primary/10',
    iconColor: 'text-primary',
  },
  suporte: {
    icon: HeadphonesIcon,
    label: 'Suporte',
    bgColor: 'bg-cyan-100 dark:bg-cyan-900/30',
    iconColor: 'text-cyan-600 dark:text-cyan-400',
  },
};

export const DEFAULT_CONCEPT: NotificationConcept = 'novidade';

export function getConceptConfig(concept: string | null | undefined): ConceptConfig {
  if (concept && concept in NOTIFICATION_CONCEPTS) {
    return NOTIFICATION_CONCEPTS[concept as NotificationConcept];
  }
  return NOTIFICATION_CONCEPTS[DEFAULT_CONCEPT];
}

export function isValidConcept(concept: string): concept is NotificationConcept {
  return concept in NOTIFICATION_CONCEPTS;
}
