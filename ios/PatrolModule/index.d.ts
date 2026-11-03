export interface PatrolModule {
  configure(config: { baseURL: string; anonKey: string }): Promise<void>;
  startTracking(personnelId: string, dutyType: string): Promise<boolean>;
  stopTracking(): Promise<boolean>;
  sync(): Promise<number>;
  getUnsyncedCount(): Promise<number>;
  getTotalCount(): Promise<number>;
  requestLocationPermission(): Promise<'granted' | 'denied' | 'requested' | 'unknown'>;
}

declare const PatrolModule: PatrolModule;
export default PatrolModule;