import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useStore } from "./store";
import { Sidebar } from "./components/Sidebar";
import { TabBar } from "./components/TabBar";
import { UrlBar } from "./components/UrlBar";
import { RequestPanel } from "./components/RequestPanel";
import { ResponsePanel } from "./components/ResponsePanel";
import { EnvironmentSwitcher } from "./components/EnvironmentSwitcher";
import { AuthScreen } from "./components/AuthScreen";


export default function App() {
  const user = useStore((s) => s.user);
  const authChecked = useStore((s) => s.authChecked);
  const checkAuth = useStore((s) => s.checkAuth);
  const dataLoaded = useStore((s) => s.dataLoaded);
  const loadWorkspace = useStore((s) => s.loadWorkspace);
  const tabs = useStore((s) => s.tabs);
  const activeTabId = useStore((s) => s.activeTabId);
  const activeTab = tabs.find((t) => t.id === activeTabId);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (user && !dataLoaded) loadWorkspace();
  }, [user, dataLoaded, loadWorkspace]);

  if (!authChecked) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-bg text-text-faint text-[13px]">
        Loading…
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  if (!dataLoaded) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-bg text-text-faint text-[13px]">
        Loading workspace…
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex bg-bg text-text font-body overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-end px-3 h-12 border-b border-border">
          <EnvironmentSwitcher />
        </div>
        <TabBar />
        <AnimatePresence mode="wait">
          {activeTab ? (
            <motion.div
              key={activeTab.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              className="flex-1 flex flex-col min-h-0"
            >
              <UrlBar tab={activeTab} />
              <div className="flex-1 flex min-h-0">
                <div className="w-1/2 border-r border-border flex flex-col min-h-0">
                  <RequestPanel tab={activeTab} />
                </div>
                <div className="w-1/2 flex flex-col min-h-0">
                  <ResponsePanel tab={activeTab} />
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex-1 flex flex-col items-center justify-center gap-3 text-text-faint"
            >
              <img src="/anchor-mark.svg" alt="Anchor" className="w-8 h-8 opacity-40" />
              <p className="text-[13px]">Open a request from the sidebar, or create a new one.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
