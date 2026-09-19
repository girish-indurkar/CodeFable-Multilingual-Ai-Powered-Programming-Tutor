"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AuthForm() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const endpoint = isLogin ? "/api/login" : "/api/signup";
      // Assuming backend is running on port 5000 during dev
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
      
      const payload = isLogin ? { email, password } : { name, email, password };
      
      const res = await fetch(`${baseUrl}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Authentication failed");
      }

      // Store token
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      // Redirect to dashboard
      router.push("/dashboard");
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unknown error occurred");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md p-6 rounded-3xl bg-[#14141b] border border-[#27272a] shadow-2xl">
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-white mb-2">Welcome!</h2>
        <p className="text-muted-foreground text-sm">
          {isLogin ? "Sign in to your account" : "Create a new account"}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {!isLogin && (
          <div className="space-y-1">
            <input
              type="text"
              placeholder="Your Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#0d0d12] border border-[#27272a] rounded-lg px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:border-primary/50 transition-colors"
              required
            />
          </div>
        )}
        <div className="space-y-1">
          <input
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-[#0d0d12] border border-[#27272a] rounded-lg px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:border-primary/50 transition-colors"
            required
          />
        </div>
        <div className="space-y-1">
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-[#0d0d12] border border-[#27272a] rounded-lg px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:border-primary/50 transition-colors"
            required
          />
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg px-4 py-3 transition-colors mt-2"
        >
          {loading ? "Please wait..." : (isLogin ? "Sign In" : "Sign Up")}
        </button>
      </form>

      <div className="mt-6 text-center text-sm">
        <span className="text-muted-foreground">
          {isLogin ? "Don't have an account? " : "Already have an account? "}
        </span>
        <button
          type="button"
          onClick={() => {
            setIsLogin(!isLogin);
            setError("");
          }}
          className="text-primary hover:underline font-medium"
        >
          {isLogin ? "Sign Up" : "Sign In"}
        </button>
      </div>
      
      <div className="mt-4 text-center">
        <p className="text-xs text-muted-foreground">
          By signing in, you agree to our terms.
        </p>
      </div>
    </div>
  );
}
