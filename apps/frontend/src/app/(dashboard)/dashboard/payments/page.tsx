'use client';

import React from 'react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';

export default function PaymentsPage() {
  return (
    <DashboardLayout
      businessId="demo-business-123"
      businessName="Demo Business"
      onLogout={() => console.log('Logout clicked')}
    />
  );
}
