import React from "react";
import DashboardSidebar from "../components/dashboard sidebar/DashboardSidebar";
import DashboardHeader from "../components/dashboard header/DashboardHeader";
import DashboardFooter from "../components/dashboard footer/DashboardFooter";

const DashboardLayout = ({ children }) => {
  return (
    <div className="flex min-h-screen bg-slate-950 text-white">
      <DashboardSidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <DashboardHeader />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          {children}
        </main>
        <DashboardFooter />
      </div>
    </div>
  );
};

export default DashboardLayout;
