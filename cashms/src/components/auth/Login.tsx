// import * as React from "react";
// import { useNavigate } from "react-router-dom";
// import { motion } from "motion/react";
// import { ArrowRight, CreditCard, Loader2, Lock, Mail } from "lucide-react";
// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
// import { Label } from "@/components/ui/label";
// import {
//   Card,
//   CardContent,
//   CardDescription,
//   CardFooter,
//   CardHeader,
//   CardTitle,
// } from "@/components/ui/card";
// import { useAuth } from "@/context/AuthContext";
// import { API } from "@/services/api";

// export default function Login() {
//   const navigate = useNavigate();
//   const [isLoading, setIsLoading] = React.useState(false);
//   const [error, setError] = React.useState("");
//   const [form, setForm] = React.useState({ email: "", password: "" });
//   const { login } = useAuth();

//   const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
//     const { name, value } = event.target;
//     setForm((current) => ({ ...current, [name]: value }));
//   };

//   const handleSubmit = async (event: React.FormEvent) => {
//     event.preventDefault();
//     setIsLoading(true);
//     setError("");

//     try {
//       const response = await API.post("/auth/login", form);
//       login(response.data.user);
//       localStorage.setItem("token", response.data.token);
//       navigate("/");
//     } catch (error: any) {
//       setError(error.response?.data?.error || "Login failed. Please check your credentials.");
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   return (
//     <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-slate-100 px-4 py-10 md:px-6 md:py-16">
//       <div className="absolute inset-0 z-0">
//         <div className="absolute left-[-8%] top-[-12%] h-[44%] w-[44%] rounded-full bg-primary/10 blur-[130px]" />
//         <div className="absolute bottom-[-12%] right-[-8%] h-[44%] w-[44%] rounded-full bg-indigo-300/25 blur-[130px]" />
//         <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.75),rgba(241,245,249,0.85))]" />
//       </div>

//       <motion.div
//         initial={{ opacity: 0, y: 20 }}
//         animate={{ opacity: 1, y: 0 }}
//         transition={{ duration: 0.5, ease: "easeOut" }}
//         className="z-10 w-full max-w-lg"
//       >
//         <div className="mb-8 flex flex-col items-center text-center">
//           <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-indigo-600 text-primary-foreground shadow-xl shadow-primary/25">
//             <CreditCard className="h-7 w-7" />
//           </div>
//           <h1 className="text-4xl font-bold tracking-tight text-slate-900">Welcome back</h1>
//           <p className="mt-2 text-base text-slate-600">
//             Sign in to access your cash management dashboard
//           </p>
//         </div>

//         <Card className="overflow-hidden rounded-3xl border border-slate-200/85 bg-white shadow-[0_24px_55px_-25px_rgba(15,23,42,0.35)]">
//           <CardHeader className="space-y-1 pb-5">
//             <CardTitle className="text-3xl font-semibold text-slate-900">Login</CardTitle>
//             {/* <CardDescription className="text-[17px] text-slate-600">
//               Enter your email and password
//             </CardDescription> */}
//           </CardHeader>

//           <CardContent className="grid gap-5">
//             {error && (
//               <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
//                 {error}
//               </div>
//             )}

//             <form onSubmit={handleSubmit} className="space-y-5">
//               <div className="space-y-2.5">
//                 <Label htmlFor="email" className="text-sm font-semibold text-slate-800">
//                   Email address
//                 </Label>
//                 <div className="relative">
//                   <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
//                   <Input
//                     id="email"
//                     name="email"
//                     type="email"
//                     placeholder="name@example.com"
//                     required
//                     value={form.email}
//                     onChange={handleChange}
//                     className="h-12 rounded-xl border-slate-200 bg-slate-50/65 pl-11 text-base"
//                   />
//                 </div>
//               </div>

//               <div className="space-y-2.5">
//                 <Label htmlFor="password" className="text-sm font-semibold text-slate-800">
//                   Password
//                 </Label>
//                 <div className="relative">
//                   <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
//                   <Input
//                     id="password"
//                     name="password"
//                     type="password"
//                     placeholder="Enter your password"
//                     required
//                     value={form.password}
//                     onChange={handleChange}
//                     className="h-12 rounded-xl border-slate-200 bg-slate-50/65 pl-11 text-base"
//                   />
//                 </div>
//               </div>

//               <Button
//                 type="submit"
//                 className="h-12 w-full gap-2 rounded-xl text-base font-semibold shadow-lg shadow-primary/25"
//                 disabled={isLoading}
//               >
//                 {isLoading ? (
//                   <Loader2 className="h-4 w-4 animate-spin" />
//                 ) : (
//                   <>
//                     Sign In
//                     <ArrowRight className="h-4 w-4" />
//                   </>
//                 )}
//               </Button>
//             </form>
//           </CardContent>

//           <CardFooter className="border-t border-slate-100 bg-slate-50 py-4 text-sm text-slate-500">
//             Contact an admin if you need account access.
//           </CardFooter>
//         </Card>
//       </motion.div>
//     </div>
//   );
// }


import * as React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowRight, CreditCard, Loader2, Lock, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import { API } from "@/services/api";

export default function Login() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [form, setForm] = React.useState({ email: "", password: "" });
  const { login } = useAuth();

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const response = await API.post("/auth/login", form);
      login(response.data.user);
      localStorage.setItem("token", response.data.token);
      navigate("/");
    } catch (error: any) {
      setError(error.response?.data?.error || "Login failed. Please check your credentials.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-100 px-4 py-8">
      <div className="absolute inset-0">
        <div className="absolute left-[-10%] top-[-10%] h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-[-10%] right-[-10%] h-72 w-72 rounded-full bg-slate-300/40 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom_right,rgba(255,255,255,0.7),rgba(241,245,249,0.95))]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
            <CreditCard className="h-5 w-5" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
            Welcome back
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Sign in to access your cash management dashboard
          </p>
        </div>

        <Card className="rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60">
          <CardHeader className="pb-4">
            <CardTitle className="text-2xl font-semibold text-slate-900">
              Login
            </CardTitle>
          </CardHeader>

          <CardContent>
            {error && (
              <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-slate-700">
                  Email address
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="name@example.com"
                    required
                    value={form.email}
                    onChange={handleChange}
                    className="h-11 rounded-xl border-slate-200 bg-slate-50 pl-10 text-sm focus-visible:ring-1 focus-visible:ring-primary"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-slate-700">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    placeholder="Enter your password"
                    required
                    value={form.password}
                    onChange={handleChange}
                    className="h-11 rounded-xl border-slate-200 bg-slate-50 pl-10 text-sm focus-visible:ring-1 focus-visible:ring-primary"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="h-11 w-full rounded-xl text-sm font-medium"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Sign In
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          </CardContent>

          <CardFooter className="border-t border-slate-100 bg-slate-50/70 py-3 text-sm text-slate-500">
            Contact an admin if you need account access.
          </CardFooter>
        </Card>
      </motion.div>
    </div>
  );
}