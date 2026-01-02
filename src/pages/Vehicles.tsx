import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { useProviderVehicles, ProviderVehicle } from '@/hooks/useProviderVehicles';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Plus, Car, Loader2, AlertCircle } from 'lucide-react';
import { VehicleCard } from '@/components/Provider/Vehicles/VehicleCard';
import { AddVehicleModal } from '@/components/Provider/Vehicles/AddVehicleModal';
import { EditVehicleModal } from '@/components/Provider/Vehicles/EditVehicleModal';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function VehiclesPage() {
  const navigate = useNavigate();
  const { user } = useApp();
  const {
    vehicles,
    loading,
    addVehicle,
    updateVehicle,
    setPrimaryVehicle,
    removeVehicle,
  } = useProviderVehicles(user?.id);

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<ProviderVehicle | null>(null);
  const [vehicleToRemove, setVehicleToRemove] = useState<ProviderVehicle | null>(null);
  const [removing, setRemoving] = useState(false);

  const handleRemove = async () => {
    if (!vehicleToRemove) return;
    
    setRemoving(true);
    await removeVehicle(vehicleToRemove.id);
    setVehicleToRemove(null);
    setRemoving(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center provider-theme">
        <Loader2 className="w-8 h-8 animate-spin text-provider-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background provider-theme">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center gap-3 p-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="rounded-xl"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Car className="w-5 h-5 text-provider-primary" />
            <h1 className="text-lg font-semibold">Meus Veículos</h1>
          </div>
        </div>
      </header>

      <main className="p-4 pb-24 max-w-lg mx-auto space-y-4">
        {/* Info banner */}
        <div className="flex items-start gap-3 p-4 bg-provider-primary/10 rounded-xl">
          <AlertCircle className="w-5 h-5 text-provider-primary flex-shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground">
            O veículo principal será exibido aos clientes durante as corridas. Você pode ter múltiplos veículos cadastrados.
          </p>
        </div>

        {/* Vehicle list */}
        {vehicles.length === 0 ? (
          <div className="text-center py-12">
            <Car className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">Nenhum veículo cadastrado</p>
            <Button
              onClick={() => setShowAddModal(true)}
              className="mt-4 bg-provider-primary hover:bg-provider-primary/90"
            >
              <Plus className="w-4 h-4 mr-2" />
              Adicionar veículo
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {vehicles.map((vehicle) => (
              <VehicleCard
                key={vehicle.id}
                vehicle={vehicle}
                canDelete={vehicles.length > 1}
                onEdit={() => setEditingVehicle(vehicle)}
                onSetPrimary={() => setPrimaryVehicle(vehicle.id)}
                onRemove={() => setVehicleToRemove(vehicle)}
              />
            ))}
          </div>
        )}

        {/* Add button (when has vehicles) */}
        {vehicles.length > 0 && (
          <Button
            onClick={() => setShowAddModal(true)}
            variant="outline"
            className="w-full h-12 rounded-xl border-dashed border-2"
          >
            <Plus className="w-5 h-5 mr-2" />
            Adicionar novo veículo
          </Button>
        )}
      </main>

      {/* Add Vehicle Modal */}
      <AddVehicleModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSave={addVehicle}
      />

      {/* Edit Vehicle Modal */}
      <EditVehicleModal
        open={!!editingVehicle}
        vehicle={editingVehicle}
        onClose={() => setEditingVehicle(null)}
        onSave={updateVehicle}
      />

      {/* Remove Confirmation Dialog */}
      <AlertDialog open={!!vehicleToRemove} onOpenChange={(open) => !open && setVehicleToRemove(null)}>
        <AlertDialogContent className="provider-theme">
          <AlertDialogHeader>
            <AlertDialogTitle>Remover veículo</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover o veículo com placa{' '}
              <strong>{vehicleToRemove?.plate}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemove}
              disabled={removing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Remover'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
