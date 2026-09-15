"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function LoginPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const { signIn, signUp, user, loading: authLoading } = useAuth();
  const router = useRouter();

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && user) {
      router.push("/chat");
    }
  }, [user, authLoading, router]);

  const validateForm = () => {
    if (!email.trim()) {
      setError("Email is required.");
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address.");
      return false;
    }
    if (!password) {
      setError("Password is required.");
      return false;
    }
    if (isSignUp && password !== confirmPassword) {
      setError("Passwords do not match.");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!validateForm()) return;

    setLoading(true);

    try {
      if (isSignUp) {
        await signUp(email, password);
        setSuccess("Account created! Check your email for verification, or sign in if email confirmation is disabled.");
        setIsSignUp(false);
        setPassword("");
        setConfirmPassword("");
      } else {
        await signIn(email, password);
        router.push("/chat");
      }
    } catch (err) {
      const message = err?.message || "An unexpected error occurred.";
      // Provide user-friendly error messages
      if (message.includes("Invalid login credentials")) {
        setError("Invalid email or password. Please try again.");
      } else if (message.includes("User already registered")) {
        setError("An account with this email already exists. Try signing in.");
      } else if (message.includes("Email not confirmed")) {
        setError("Please confirm your email before signing in.");
      } else if (message.includes("rate limit")) {
        setError("Too many attempts. Please wait a moment and try again.");
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="login-page">
        <div className="login-loader">
          <div className="login-loader__spinner" />
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      {/* Animated background shapes */}
      <div className="login-bg">
        <div className="login-bg__shape login-bg__shape--1" />
        <div className="login-bg__shape login-bg__shape--2" />
        <div className="login-bg__shape login-bg__shape--3" />
      </div>

      <div className="login-card">
        {/* Logo */}
        <div className="login-card__logo">
          <div className="login-card__logo-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </div>
          <h1 className="login-card__title">Gemini Chat</h1>
          <p className="login-card__subtitle">
            {isSignUp
              ? "Create your account to get started"
              : "Sign in to continue your conversations"}
          </p>
        </div>

        {/* Error / Success messages */}
        {error && (
          <div className="login-card__alert login-card__alert--error">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            {error}
          </div>
        )}
        {success && (
          <div className="login-card__alert login-card__alert--success">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            {success}
          </div>
        )}

        {/* Form */}
        <form className="login-card__form" onSubmit={handleSubmit}>
          <div className="login-card__field">
            <label htmlFor="login-email" className="login-card__label">Email</label>
            <input
              type="email"
              id="login-email"
              className="login-card__input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              disabled={loading}
            />
          </div>

          <div className="login-card__field">
            <label htmlFor="login-password" className="login-card__label">Password</label>
            <input
              type="password"
              id="login-password"
              className="login-card__input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={isSignUp ? "new-password" : "current-password"}
              disabled={loading}
            />
          </div>

          {isSignUp && (
            <div className="login-card__field">
              <label htmlFor="login-confirm-password" className="login-card__label">
                Confirm Password
              </label>
              <input
                type="password"
                id="login-confirm-password"
                className="login-card__input"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                disabled={loading}
              />
            </div>
          )}

          <button
            type="submit"
            className="login-card__submit"
            disabled={loading}
            id="login-submit-button"
          >
            {loading ? (
              <div className="login-card__submit-spinner" />
            ) : isSignUp ? (
              "Create Account"
            ) : (
              "Sign In"
            )}
          </button>
        </form>

        {/* Toggle */}
        <div className="login-card__toggle">
          {isSignUp ? "Already have an account?" : "Don't have an account?"}
          <button
            type="button"
            className="login-card__toggle-btn"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError("");
              setSuccess("");
            }}
            disabled={loading}
          >
            {isSignUp ? "Sign In" : "Sign Up"}
          </button>
        </div>
      </div>
    </div>
  );
}
