import { MobileSidebarProvider } from '@/components/layout/MobileSidebarContext';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopBar } from '@/components/layout/TopBar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <MobileSidebarProvider>
      <div className="flex h-screen bg-gray-50 overflow-hidden max-w-full">
        <Sidebar />
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <TopBar />
          <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6">
            <div className="max-w-5xl mx-auto animate-fade-in">
              {children}
            </div>
          </main>
        </div>
      </div>
    </MobileSidebarProvider>
  );
}
