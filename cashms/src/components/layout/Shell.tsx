import * as React from "react";
import { 
  LayoutDashboard, 
  CreditCard, 
  Tags, 
  ArrowLeftRight, 
  BarChart3, 
  Users, 
  LogOut, 
  Settings,
  Landmark,
  FileClock,
  Menu,
  X,
  Plus
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { motion, AnimatePresence } from "motion/react";
import { useAuth } from "@/context/AuthContext";
import { useTransaction } from "@/context/TransactionContext";
import { TransactionDialog } from "@/components/transactions/TransactionDialog";
import { useNavigate, useLocation } from "react-router-dom";
import usePermissions from "@/hooks/usePermissions";

interface SidebarItemProps {
  icon: React.ElementType;
  label: string;
  active?: boolean;
  onClick?: () => void;
  key?: string;
}

const SidebarItem = ({ icon: Icon, label, active, onClick }: SidebarItemProps) => {
  return (
    <Button
      variant="ghost"
      className={cn(
        "w-full justify-start gap-3 px-3 py-2 text-sm font-medium transition-all duration-300",
        active 
          ? "bg-emerald-50 text-emerald-700 shadow-sm ring-1 ring-emerald-100/50" 
          : "text-muted-foreground hover:text-foreground hover:bg-amber-100/60"
      )}
      onClick={onClick}
    >
      <Icon className={cn("h-4 w-4 transition-colors", active ? "text-emerald-600" : "text-muted-foreground")} />
      {label}
    </Button>
  );
};

export function Shell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { can } = usePermissions();
  const { openAddModal } = useTransaction();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  const menuItems = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/" },
    { icon: Tags, label: "Categories", path: "/categories" },
    { icon: CreditCard, label: "Accounts", path: "/accounts" },
    { icon: Landmark, label: "Sources", path: "/sources" },
    { icon: ArrowLeftRight, label: "Transactions", path: "/transactions" },
    { icon: BarChart3, label: "Reports", path: "/reports" },
    { icon: Users, label: "Users", path: "/users" },
    { icon: FileClock, label: "Audit Logs", path: "/audit-logs" },
  ].filter((item) => {
    if (item.path === "/") return can("dashboard.view");
    if (item.path === "/categories") return can("categories.view");
    if (item.path === "/accounts") return can("accounts.view");
    if (item.path === "/sources") return can("sources.view");
    if (item.path === "/transactions") return can("transactions.view");
    if (item.path === "/reports") return can("reports.view");
    if (item.path === "/users") return can("users.view");
    if (item.path === "/audit-logs") return user?.role === "admin";
    return true;
  });

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background font-sans">
      {/* Desktop Sidebar */}
      <aside className="hidden h-screen w-56 shrink-0 flex-col border-r bg-white lg:flex">
        <div className="flex h-16 items-center px-6">
          <div className="flex items-center gap-2 font-bold text-xl tracking-tight">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-lg shadow-blue-500/20">
              <CreditCard className="h-5 w-5" />
            </div>
            <span className="bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">Cash<span className="text-blue-600">MS</span></span>
          </div>
        </div>
        
        <ScrollArea className="min-h-0 flex-1 px-4 py-4">
          <div className="space-y-1">
            <p className="px-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
              Main Menu
            </p>
            {menuItems.map((item) => (
              <SidebarItem
                key={item.label}
                icon={item.icon}
                label={item.label}
                active={location.pathname === item.path}
                onClick={() => navigate(item.path)}
              />
            ))}
          </div>
          
          <Separator className="my-6 opacity-50" />
          
          <div className="space-y-1">
            <p className="px-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
              System
            </p>
            <SidebarItem
              icon={Settings}
              label="Change Password"
              active={location.pathname === "/change-password"}
              onClick={() => navigate("/change-password")}
            />
            <SidebarItem
              icon={LogOut}
              label="Logout"
              onClick={() => {
                logout();
                navigate("/login");
              }}
            />
          </div>
        </ScrollArea>

        <div className="border-t p-4">
          <div className="flex items-center gap-3 rounded-xl bg-secondary/50 p-3">
            <Avatar className="h-9 w-9 border-2 border-background">
              <AvatarImage src={`https://avatar.iran.liara.run/username?username=${user?.name}`} />
              <AvatarFallback>{user?.name?.charAt(0) || "U"}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col overflow-hidden">
              <span className="truncate text-sm font-semibold">{user?.name || "User"}</span>
              <span className="truncate text-[10px] text-muted-foreground uppercase tracking-widest font-bold">{user?.role || "Member"}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex flex-1 flex-col">
        {/* Page Content */}
        <main className="flex-1 overflow-y-auto bg-slate-50/50 px-3 pb-3 pt-14 sm:px-6 sm:pb-6 sm:pt-4 lg:px-8 lg:pb-8 lg:pt-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mx-auto max-w-7xl"
          >
            {children}
          </motion.div>
        </main>

        {/* Global Components */}
        <TransactionDialog />

        {/* Mobile Menu Button */}
        <Button
          variant="outline"
          size="icon"
          className="fixed left-4 top-4 z-40 bg-white/95 shadow-md lg:hidden"
          onClick={() => setIsMobileMenuOpen(true)}
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Floating Action Button (Mobile) */}
        {can("transactions.create") && (
          <Button
            onClick={openAddModal}
            size="icon"
            className="fixed bottom-6 right-6 h-14 w-14 rounded-full bg-emerald-600 shadow-2xl shadow-emerald-500/40 hover:bg-emerald-700 lg:hidden z-40"
          >
            <Plus className="h-6 w-6" />
          </Button>
        )}
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 z-50 w-72 border-r bg-card p-6 lg:hidden"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-2 font-bold text-xl">
                  <CreditCard className="h-6 w-6 text-primary" />
                  <span>CashMS</span>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(false)}>
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <div className="space-y-1">
                {menuItems.map((item) => (
                  <SidebarItem
                    key={item.label}
                    icon={item.icon}
                    label={item.label}
                    active={location.pathname === item.path}
                    onClick={() => {
                      navigate(item.path);
                      setIsMobileMenuOpen(false);
                    }}
                  />
                ))}
              </div>
              <Separator className="my-6 opacity-50" />
              <div className="space-y-1">
                <SidebarItem
                  icon={Settings}
                  label="Change Password"
                  active={location.pathname === "/change-password"}
                  onClick={() => {
                    navigate("/change-password");
                    setIsMobileMenuOpen(false);
                  }}
                />
                <SidebarItem
                  icon={LogOut}
                  label="Logout"
                  onClick={() => {
                    logout();
                    setIsMobileMenuOpen(false);
                    navigate("/login");
                  }}
                />
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
