// src/integrations/supabase/client.ts - Updated with correct table names
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { i } from 'node_modules/vite/dist/node/types.d-aGj9QkWt';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
if (!SUPABASE_URL) {
  throw new Error('Missing SUPABASE_URL')
}

if (!supabaseKey) {
  throw new Error('Missing supabaseKey')
}

// Validate URL format
try {
  new URL(SUPABASE_URL)
} catch {
  throw new Error('Invalid SUPABASE_URL format')
}

// Create the Supabase client
export const supabase = createClient(SUPABASE_URL, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  },
  global: {
    headers: {
      'x-application-name': 'cert-check-chain'
    }
  }
})

// Test connection function - FIXED to use correct table name
export const testConnection = async () => {
  try {
    const { data, error } = await supabase
      .from('issued_certificates')  // Changed from 'certificates' to 'issued_certificates'
      .select('count')
      .limit(1)
    
    if (error) throw error
    return { connected: true, error: null }
  } catch (error) {
    console.error('Supabase connection test failed:', error)
    return { connected: false, error }
  }
}

// Certificate data interface matching your database schema
export interface CertificateData {
  student_name: string
  roll_number: string
  course: string
  certificate_id: string
  certificate_hash: string
  institution_wallet: string
  blockchain_tx_hash?: string
}

// Enhanced database operations with retry logic - FIXED table name
export const saveCertificateWithRetry = async (certificateData: CertificateData, maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const { data, error } = await supabase
        .from('issued_certificates')  // Changed from 'certificates' to 'issued_certificates'
        .insert(certificateData)
        .select()

      if (error) throw error
      return data
    } catch (error: any) {
      console.warn(`Database save attempt ${attempt} failed:`, error)
      
      if (attempt === maxRetries) {
        // Store in localStorage as backup
        const backupKey = `certificate_backup_${Date.now()}`
        localStorage.setItem(backupKey, JSON.stringify({
          ...certificateData,
          backupTimestamp: new Date().toISOString(),
          error: error.message
        }))
        console.log(`Certificate backed up to localStorage with key: ${backupKey}`)
        throw error
      }
      
      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)))
    }
  }
}

// Verification log interface
export interface VerificationLogData {
  certificate_hash: string
  verifier_wallet?: string
  result: boolean
  certificate_data?: any
}

// Save verification log
export const saveVerificationLog = async (logData: VerificationLogData) => {
  try {
    const { data, error } = await supabase
      .from('verification_logs')
      .insert(logData)
      .select()

    if (error) throw error
    return data
  } catch (error) {
    console.error('Failed to save verification log:', error)
    throw error
  }
}

// Get certificate by hash
export const getCertificateByHash = async (certificateHash: string) => {
  try {
    const { data, error } = await supabase
      .from('issued_certificates')
      .select('*')
      .eq('certificate_hash', certificateHash)
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error('Failed to get certificate:', error)
    throw error
  }
}

// Get certificate by ID
export const getCertificateById = async (certificateId: string) => {
  try {
    const { data, error } = await supabase
      .from('issued_certificates')
      .select('*')
      .eq('certificate_id', certificateId)
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error('Failed to get certificate:', error)
    throw error
  }
}

// Queue management for failed saves
export interface QueuedCertificate {
  id: string
  certificateData: CertificateData
  timestamp: number
  retryCount: number
}

export const addToQueue = (certificateData: CertificateData) => {
  const queued: QueuedCertificate = {
    id: crypto.randomUUID(),
    certificateData,
    timestamp: Date.now(),
    retryCount: 0
  }
  
  const queue = getQueue()
  queue.push(queued)
  localStorage.setItem('certificate_queue', JSON.stringify(queue))
  
  // Dispatch custom event to notify UI
  window.dispatchEvent(new CustomEvent('certificate-queued', { 
    detail: { queueLength: queue.length } 
  }))
}

export const getQueue = (): QueuedCertificate[] => {
  try {
    const queue = localStorage.getItem('certificate_queue')
    return queue ? JSON.parse(queue) : []
  } catch {
    return []
  }
}

export const processQueue = async () => {
  const queue = getQueue()
  const processed: string[] = []
  const failed: QueuedCertificate[] = []
  
  for (const item of queue) {
    try {
      const { error } = await supabase
        .from('issued_certificates')
        .insert(item.certificateData)
        .select()
      
      if (error) throw error
      processed.push(item.id)
      console.log(`Successfully processed queued certificate: ${item.id}`)
    } catch (error) {
      console.warn(`Failed to process queued item ${item.id}:`, error)
      failed.push({
        ...item,
        retryCount: item.retryCount + 1
      })
    }
  }
  
  // Keep failed items in queue (up to max retries)
  const remaining = failed.filter(item => item.retryCount < 5)
  localStorage.setItem('certificate_queue', JSON.stringify(remaining))
  
  // Dispatch success event
  if (processed.length > 0) {
    window.dispatchEvent(new CustomEvent('certificate-synced', { 
      detail: { processed: processed.length, remaining: remaining.length } 
    }))
  }
  
  return {
    processed: processed.length,
    remaining: remaining.length,
    failed: failed.length - remaining.length
  }
}

// Get backup certificates from localStorage
export const getBackupCertificates = () => {
  const backups: Array<{ key: string, data: any }> = []
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith('certificate_backup_')) {
      try {
        const data = JSON.parse(localStorage.getItem(key) || '{}')
        backups.push({ key, data })
      } catch {
        // Invalid backup data, ignore
      }
    }
  }
  
  return backups.sort((a, b) => 
    new Date(b.data.backupTimestamp).getTime() - new Date(a.data.backupTimestamp).getTime()
  )
}

// Clear processed backups
export const clearProcessedBackups = (keys: string[]) => {
  keys.forEach(key => localStorage.removeItem(key))
}