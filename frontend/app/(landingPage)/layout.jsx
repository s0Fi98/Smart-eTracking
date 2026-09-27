import React from "react";
import ClientHeader from "../../components/client header/ClientHeader";
import ClientFooter from "../../components/client footer/ClientFooter";

const LandingPageLayout = ({children}) => {
  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-white">
      <ClientHeader />
      <main className="flex grow flex-col">
        {children}
      </main>
      <ClientFooter />
    </div>
  );
};

export default LandingPageLayout;
