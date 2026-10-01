import { apiFetch } from './client';

// Aligné sur backend/src/modules/vehicles/dto/create-vehicle.dto.ts
export type VehicleType = 'CAR' | 'SUV' | 'VAN' | 'TRUCK' | 'MOTORCYCLE' | 'OTHER';
export type FuelType = 'PETROL' | 'DIESEL' | 'ELECTRIC' | 'HYBRID' | 'LPG' | 'OTHER';
export type TransmissionType = 'MANUAL' | 'AUTOMATIC';

export interface CreateVehicleInput {
  type?: VehicleType;
  make: string;
  model: string;
  year: number;
  licensePlate: string;
  vin?: string;
  color?: string;
  fuelType?: FuelType;
  transmission?: TransmissionType;
  mileage?: number;
  seats?: number;
  /** Code ISO pays d'immatriculation, ex. 'FR' (max 2 caractères) */
  registrationCountry?: string;
  insuranceProvider?: string;
  insuranceExpiresAt?: string;
}

export interface VehicleSummary {
  id: string;
  type: VehicleType;
  make: string;
  model: string;
  year: number;
  licensePlate: string;
  color?: string | null;
}

export async function createVehicle(input: CreateVehicleInput): Promise<VehicleSummary> {
  return apiFetch<VehicleSummary>('/vehicles', { method: 'POST', body: input });
}
