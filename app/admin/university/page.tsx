import type { Metadata } from 'next'
import UniversityDashboard from './UniversityDashboard'

export const metadata: Metadata = {
  title: 'Bright Tale University — Admin',
}

export default function UniversityPage() {
  return <UniversityDashboard />
}
