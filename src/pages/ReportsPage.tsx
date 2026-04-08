import { Header } from '@/components/layout/Header';
import { ReportCharts } from '@/components/reports/ReportCharts';

const ReportsPage = () => {
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <Header title="Relatórios" />
      <main className="flex-1 p-6 overflow-y-auto bg-muted/30">
        <ReportCharts />
      </main>
    </div>
  );
};

export default ReportsPage;
