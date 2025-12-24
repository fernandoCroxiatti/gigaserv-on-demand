import React, { useState } from 'react';
import { 
  Receipt, 
  CreditCard,
  Smartphone,
  AlertCircle,
  CheckCircle,
  Clock,
  Copy,
  Loader2,
  RefreshCw,
  Wallet,
  Info,
  Upload,
  Image as ImageIcon,
  X,
  Camera
} from 'lucide-react';
import { NativeImagePicker } from '@/components/NativeImagePicker';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { useProviderFees, FinancialStatus } from '@/hooks/useProviderFees';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function getStatusBadge(status: FinancialStatus) {
  switch (status) {
    case 'PAGO':
      return <Badge className="bg-status-finished text-white">Pago</Badge>;
    case 'DEVENDO':
      return <Badge variant="destructive">Devendo</Badge>;
    case 'AGUARDANDO_APROVACAO':
      return <Badge className="bg-status-searching text-white">Aguardando</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

export function ProviderFeesTab() {
  const { user } = useAuth();
  const { 
    fees, 
    stripeFees, 
    manualFees, 
    financialStatus, 
    pixConfig, 
    loading, 
    refetch, 
    declarePayment,
    totals 
  } = useProviderFees();
  
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [declaringPayment, setDeclaringPayment] = useState(false);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleCopyPixKey = () => {
    if (pixConfig?.key) {
      navigator.clipboard.writeText(pixConfig.key);
      toast.success('Chave PIX copiada!');
    }
  };

  // Handler for NativeImagePicker
  const handleProofSelected = (file: File | null, dataUrl: string | null) => {
    if (!file) return;
    
    setProofFile(file);
    if (dataUrl) {
      setProofPreview(dataUrl);
    }
  };

  // Legacy file input handler (kept for web fallback)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione uma imagem');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 5MB');
      return;
    }

    setProofFile(file);
    setProofPreview(URL.createObjectURL(file));
  };

  const handleRemoveProof = () => {
    setProofFile(null);
    if (proofPreview) {
      URL.revokeObjectURL(proofPreview);
      setProofPreview(null);
    }
  };

  const uploadProof = async (): Promise<string | null> => {
    if (!proofFile || !user?.id) return null;

    setUploading(true);
    try {
      const fileExt = proofFile.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('payment-proofs')
        .upload(fileName, proofFile);

      if (uploadError) throw uploadError;

      // Return the file path instead of public URL since bucket is private
      // Admin will generate signed URL to view
      return fileName;
    } catch (err) {
      console.error('Error uploading proof:', err);
      toast.error('Erro ao enviar comprovante');
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleDeclarePayment = async () => {
    setDeclaringPayment(true);
    
    let proofUrl: string | undefined;
    if (proofFile) {
      const uploadedUrl = await uploadProof();
      if (uploadedUrl) {
        proofUrl = uploadedUrl;
      }
    }

    const result = await declarePayment(proofUrl);
    setDeclaringPayment(false);
    
    if (result.success) {
      toast.success('Pagamento declarado! Aguarde aprovação do admin.');
      setShowPaymentModal(false);
      handleRemoveProof();
    } else {
      toast.error(result.error || 'Erro ao declarar pagamento');
    }
  };

  const getFinancialStatusIcon = () => {
    switch (financialStatus?.status) {
      case 'PAGO':
        return <CheckCircle className="w-6 h-6 text-status-finished" />;
      case 'DEVENDO':
        return <AlertCircle className="w-6 h-6 text-destructive" />;
      case 'AGUARDANDO_APROVACAO':
        return <Clock className="w-6 h-6 text-status-searching" />;
      default:
        return <Receipt className="w-6 h-6 text-muted-foreground" />;
    }
  };

  const getFinancialStatusLabel = () => {
    switch (financialStatus?.status) {
      case 'PAGO':
        return 'Em dia';
      case 'DEVENDO':
        return 'Devendo';
      case 'AGUARDANDO_APROVACAO':
        return 'Aguardando aprovação';
      default:
        return 'Não disponível';
    }
  };

  const getPixKeyTypeLabel = (type: string) => {
    switch (type) {
      case 'random': return 'Chave Aleatória';
      case 'cpf_cnpj': return 'CPF/CNPJ';
      case 'email': return 'E-mail';
      case 'phone': return 'Telefone';
      default: return type;
    }
  };

  return (
    <div className="space-y-6 p-4">
      {/* Header with refresh */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg">Taxas do App</h3>
        <Button variant="ghost" size="sm" onClick={refetch} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Financial Status Card */}
      <div className="bg-card rounded-2xl p-4">
        <div className="flex items-center gap-3 mb-4">
          {getFinancialStatusIcon()}
          <div className="flex-1">
            <p className="font-medium">Status Financeiro</p>
            <p className="text-sm text-muted-foreground">{getFinancialStatusLabel()}</p>
          </div>
          {financialStatus && getStatusBadge(financialStatus.status)}
        </div>

        {financialStatus?.isBlocked && (
          <div className="p-3 bg-destructive/10 rounded-xl border border-destructive/20 mb-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-destructive">Conta bloqueada</p>
                <p className="text-xs text-muted-foreground">
                  {financialStatus.blockReason || 'Regularize suas taxas pendentes para desbloquear.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Balance Summary */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-secondary rounded-xl p-3 text-center">
            <Wallet className="w-5 h-5 mx-auto mb-1 text-destructive" />
            <p className="text-xl font-bold text-destructive">{formatCurrency(totals.pendingBalance)}</p>
            <p className="text-xs text-muted-foreground">Saldo devedor</p>
          </div>
          <div className="bg-secondary rounded-xl p-3 text-center">
            <Receipt className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
            <p className="text-xl font-bold">{formatCurrency(totals.stripeFees + totals.manualFees)}</p>
            <p className="text-xs text-muted-foreground">Total de taxas</p>
          </div>
        </div>

        {/* Pay button */}
        {totals.pendingBalance > 0 && financialStatus?.status !== 'AGUARDANDO_APROVACAO' && (
          <Button 
            className="w-full mt-4" 
            variant="provider"
            onClick={() => setShowPaymentModal(true)}
          >
            <Smartphone className="w-4 h-4 mr-2" />
            Pagar taxa via PIX
          </Button>
        )}

        {financialStatus?.status === 'AGUARDANDO_APROVACAO' && (
          <div className="mt-4 p-3 bg-status-searching/10 rounded-xl">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-status-searching" />
              <p className="text-sm font-medium text-status-searching">
                Pagamento em análise
              </p>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Seu pagamento está sendo verificado pelo administrador.
            </p>
          </div>
        )}
      </div>

      {/* Fees by Type */}
      <div className="space-y-4">
        {/* Stripe Fees */}
        <div className="bg-card rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-border/50">
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-primary" />
              <h4 className="font-medium">Taxas descontadas (Cartão)</h4>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Taxas automaticamente deduzidas nos pagamentos via cartão
            </p>
          </div>
          
          {stripeFees.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              Nenhuma taxa via cartão
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {stripeFees.slice(0, 5).map((fee) => (
                <div key={fee.id} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{formatCurrency(fee.feeAmount)}</p>
                    <p className="text-xs text-muted-foreground">
                      {fee.feePercentage}% de {formatCurrency(fee.serviceValue)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(fee.createdAt), "dd/MM/yyyy", { locale: ptBR })}
                    </p>
                  </div>
                  <Badge className="bg-status-finished/20 text-status-finished border-0">
                    Descontado
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Manual PIX Fees */}
        <div className="bg-card rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-border/50">
            <div className="flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-provider-primary" />
              <h4 className="font-medium">Taxas pendentes (PIX/Dinheiro)</h4>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Taxas de serviços pagos diretamente ao prestador
            </p>
          </div>
          
          {manualFees.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              Nenhuma taxa pendente
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {manualFees.slice(0, 5).map((fee) => (
                <div key={fee.id} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{formatCurrency(fee.feeAmount)}</p>
                    <p className="text-xs text-muted-foreground">
                      {fee.feePercentage}% de {formatCurrency(fee.serviceValue)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(fee.createdAt), "dd/MM/yyyy", { locale: ptBR })}
                    </p>
                  </div>
                  {getStatusBadge(fee.status)}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Info Section */}
      <div className="bg-secondary rounded-2xl p-4">
        <div className="flex gap-3">
          <Info className="w-5 h-5 text-provider-primary shrink-0 mt-0.5" />
          <div className="space-y-2 text-sm">
            <p className="font-medium">ℹ️ Como funcionam as taxas</p>
            <p className="text-muted-foreground">
              <strong>Pagamentos via cartão:</strong> A taxa do app é automaticamente descontada do valor recebido. Não há ação necessária.
            </p>
            <p className="text-muted-foreground">
              <strong>Pagamentos diretos (PIX/Dinheiro):</strong> A taxa do app deve ser paga via PIX para a plataforma. 
              Se houver saldo devedor, seu acesso pode ser bloqueado até a regularização.
            </p>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Pagar taxa via PIX</DialogTitle>
            <DialogDescription>
              Faça um PIX para a chave abaixo e clique em "Já paguei"
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Amount */}
            <div className="p-4 bg-secondary rounded-xl text-center">
              <p className="text-sm text-muted-foreground">Valor a pagar</p>
              <p className="text-3xl font-bold text-provider-primary">
                {formatCurrency(totals.pendingBalance)}
              </p>
            </div>

            {/* PIX Key */}
            {pixConfig?.key ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Tipo de chave</span>
                  <span className="font-medium">{getPixKeyTypeLabel(pixConfig.key_type)}</span>
                </div>
                
                <div className="p-3 bg-muted rounded-xl">
                  <p className="text-sm text-muted-foreground mb-1">Chave PIX</p>
                  <div className="flex items-center justify-between">
                    <p className="font-mono text-sm break-all">{pixConfig.key}</p>
                    <Button size="icon" variant="ghost" onClick={handleCopyPixKey}>
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {pixConfig.recipient_name && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Recebedor</span>
                    <span className="font-medium">{pixConfig.recipient_name}</span>
                  </div>
                )}

                {pixConfig.bank_name && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Banco</span>
                    <span className="font-medium">{pixConfig.bank_name}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 bg-destructive/10 rounded-xl text-center">
                <AlertCircle className="w-8 h-8 text-destructive mx-auto mb-2" />
                <p className="text-sm text-destructive">
                  Chave PIX não configurada. Entre em contato com o suporte.
                </p>
              </div>
            )}

            {/* Upload Proof Section - Uses native camera on mobile */}
            <div className="space-y-2">
              <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
                <p className="text-sm text-primary font-medium">
                  📎 Anexe o comprovante para aprovação de pagamento mais rápido
                </p>
              </div>
              <p className="text-sm font-medium">Comprovante de pagamento</p>

              {proofPreview ? (
                <div className="relative">
                  <img 
                    src={proofPreview} 
                    alt="Comprovante" 
                    className="w-full h-48 object-cover rounded-xl"
                  />
                  <Button
                    size="icon"
                    variant="destructive"
                    className="absolute top-2 right-2"
                    onClick={handleRemoveProof}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <NativeImagePicker
                  onImageSelected={handleProofSelected}
                  currentImageUrl={null}
                  isLoading={uploading}
                  shape="square"
                  size="lg"
                  showPreview={false}
                  className="w-full h-24 border-dashed"
                  placeholder={
                    <div className="flex flex-col items-center gap-2">
                      <Camera className="w-6 h-6 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        Anexar comprovante
                      </span>
                    </div>
                  }
                />
              )}
            </div>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button 
              onClick={handleDeclarePayment}
              disabled={declaringPayment || uploading || !pixConfig?.key}
              className="w-full"
              variant="provider"
            >
              {(declaringPayment || uploading) ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <CheckCircle className="w-4 h-4 mr-2" />
              )}
              {uploading ? 'Enviando...' : 'Já paguei'}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowPaymentModal(false);
                handleRemoveProof();
              }}
              className="w-full"
            >
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
