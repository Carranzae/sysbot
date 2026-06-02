import React from 'react';
import { DashboardLayout } from '../components/dashboard/DashboardLayout';

interface DashboardPageProps {
  businessId: string;
  businessName: string;
}

const DashboardPage: React.FC<DashboardPageProps> = ({ businessId, businessName }) => {
  return (
    <DashboardLayout
      businessId={businessId}
      businessName={businessName}
      onLogout={() => console.log('Logout')}
    />
  );
};

export default DashboardPage;
