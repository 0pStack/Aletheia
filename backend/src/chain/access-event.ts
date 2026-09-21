export interface AccessEvent {
  id: string
  patientId: number
  userId: number
  role: 'DOCTOR' | 'NURSE' | 'CLINIC' | 'PATIENT' | 'UNAUTHORIZED'
  action: 'READ' | 'WRITE' | 'DENIED'
  timestamp: string
  serverId: string
  signature?: string
  publicKey?: string
}
