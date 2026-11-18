/**
 * ============================================================================
 * FILE: src/components/AuthModal/AuthModal.jsx
 * ============================================================================
 * PURPOSE:
 *   Full-screen authentication modal providing Sign In, Sign Up (Registration),
 *   and Google OAuth 2.0 authentication with an animated sliding overlay panel.
 *
 * CORE RESPONSIBILITIES:
 *   1. User Registration (`handleRegister`):
 *      Checks for duplicate emails in `Accounts`, registers credentials via
 *      `supabase.auth.signUp`, and inserts a user row into the public `Accounts` table.
 *   2. User Login (`handleLogin`):
 *      Authenticates via `supabase.auth.signInWithPassword`, with a backward-compatible
 *      fallback check against the `Accounts` table for legacy accounts.
 *   3. Google OAuth 2.0 Initiation (`handleGoogleAuth`):
 *      Calls `supabase.auth.signInWithOAuth({ provider: 'google' })` to redirect
 *      the user to Google's OAuth consent screen and return to `window.location.origin`.
 *
 * IMPORTS FROM:
 *   - 'react': `useState` hook for form inputs, loading flags, and sliding panel state
 *   - '../../config/supabase': Shared `supabase` client instance
 *   - './AuthModal.css': Scoped component styles
 *
 * EXPORTS TO:
 *   - `src/components/AuthModal/index.js`
 *   - `src/App.jsx`: Default export `AuthModal`
 * ============================================================================
 */

import React, { useState } from 'react';
import { supabase, setAuthPersistence } from '../../config/supabase';
import './AuthModal.css';

/**
 * Multi-color Google "G" SVG icon for OAuth buttons.
 */
function GoogleLogo() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="google-svg-icon"
    >
      <path
        fill="#EA4335"
        d="M12 5c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.09 14.97 0 12 0 7.39 0 3.44 2.64 1.52 6.49l3.67 2.84C6.06 6.72 8.79 5 12 5z"
      />
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.51-1.14 2.79-2.4 3.65l3.73 2.9c2.18-2.01 3.69-4.97 3.69-8.79z"
      />
      <path
        fill="#FBBC05"
        d="M5.19 14.67A7.22 7.22 0 0 1 4.8 12c0-.93.16-1.83.39-2.67L1.52 6.49A11.97 11.97 0 0 0 0 12c0 1.94.46 3.77 1.52 5.51l3.67-2.84z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.73-2.9c-1.08.72-2.45 1.16-4.2 1.16-3.21 0-5.94-1.72-6.81-4.33l-3.67 2.84C3.44 21.36 7.39 24 12 24z"
      />
    </svg>
  );
}

/**
 * AuthModal Component
 * Handles user sign in, registration, and Google OAuth.
 * 
 * Props:
 * - isOpen: boolean, whether the modal is visible on screen
 * - onLoginSuccess: callback function called with the authenticated user object
 */
export function AuthModal({ isOpen, onLoginSuccess }) {
  // Controls the animated sliding panel:
  // false = Sign In view, true = Sign Up view
  const [isActive, setIsActive] = useState(false);

  // ============================================================================
  // REGISTRATION FORM STATE
  // ============================================================================
  const [regName, setRegName] = useState('');                 // User's display name
  const [regEmail, setRegEmail] = useState('');               // Registration email
  const [regPassword, setRegPassword] = useState('');         // Registration password
  const [regMessage, setRegMessage] = useState('');           // Error or success banner text
  const [regMessageType, setRegMessageType] = useState('');   // 'error' | 'success' (for styling banner)
  const [isRegLoading, setIsRegLoading] = useState(false);     // Disables submit button while requesting

  // ============================================================================
  // LOGIN FORM STATE
  // ============================================================================
  const [logEmail, setLogEmail] = useState('');               // Login email
  const [logPass, setLogPass] = useState('');                 // Login password
  const [keepSignedIn, setKeepSignedIn] = useState(false);    // Secure-by-default: ephemeral unless checked
  const [logMessage, setLogMessage] = useState('');           // Error or success banner text
  const [logMessageType, setLogMessageType] = useState('');   // 'error' | 'success'
  const [isLogLoading, setIsLogLoading] = useState(false);     // Disables submit button while requesting

  /**
   * Handles user registration:
   * 1. Checks if the email is already registered in the public Accounts table
   * 2. Registers the user with Supabase Auth (auth.signUp)
   * 3. Inserts an account record into the public Accounts table
   * 4. Automatically logs the user in if email confirmation is disabled
   */
  const handleRegister = async (e) => {
    e.preventDefault();
    setRegMessage('');
    setRegMessageType('');
    setIsRegLoading(true);

    try {
      // 1. Check if email is already in the Accounts table
      const { data: existingUser } = await supabase
        .from('Accounts')
        .select('eMail')
        .eq('eMail', regEmail)
        .maybeSingle();

      if (existingUser) {
        setRegMessage('Your email is already registered.');
        setRegMessageType('error');
        setIsRegLoading(false);
        return;
      }

      // 2. Sign up with Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email: regEmail,
        password: regPassword,
        options: {
          data: {
            userName: regName,
            full_name: regName,
          },
        },
      });

      if (error) {
        setRegMessage(error.message);
        setRegMessageType('error');
        setIsRegLoading(false);
        return;
      }

      // 3. Store account record in the database Accounts table
      await supabase.from('Accounts').insert([
        {
          userName: regName,
          eMail: regEmail,
          password: regPassword,
        },
      ]);

      // If Supabase project requires email confirmation
      if (data?.user && !data?.session) {
        setRegMessage('Account created! Please check your email to confirm.');
        setRegMessageType('success');
      } else if (data?.session && data?.user) {
        // If session is immediately active, notify parent App component
        setRegMessage('Account created successfully!');
        setRegMessageType('success');
        onLoginSuccess(data.user);
      }

      // Reset form fields
      setRegName('');
      setRegEmail('');
      setRegPassword('');
    } catch (err) {
      setRegMessage(err.message || 'There was a problem creating your account.');
      setRegMessageType('error');
    } finally {
      setIsRegLoading(false);
    }
  };

  /**
   * Handles user login:
   * 1. Attempts Supabase Auth login with email and password
   * 2. If user exists from legacy system (plain password in Accounts table), falls back to check it
   * 3. Calls onLoginSuccess(user) to pass session to App.jsx
   */
  const handleLogin = async (e) => {
    e.preventDefault();
    setLogMessage('');
    setLogMessageType('');
    setIsLogLoading(true);

    try {
      // Configure session persistence preference before signing in
      setAuthPersistence(keepSignedIn);

      // 1. Attempt official Supabase Auth login
      const { data, error } = await supabase.auth.signInWithPassword({
        email: logEmail,
        password: logPass,
      });

      if (!error && data?.user) {
        setLogMessage('');
        setLogMessageType('');
        setLogEmail('');
        setLogPass('');
        onLoginSuccess(data.user);
        return;
      }

      // 2. Fallback check for legacy accounts in Accounts table (created before Supabase Auth)
      const { data: legacyUser, error: legErr } = await supabase
        .from('Accounts')
        .select('*')
        .eq('eMail', logEmail)
        .eq('password', logPass)
        .maybeSingle();

      if (legacyUser) {
        setLogMessage('');
        setLogMessageType('');
        setLogEmail('');
        setLogPass('');
        onLoginSuccess(legacyUser);
        return;
      }

      setLogMessage(error?.message || 'Invalid Email or Password.');
      setLogMessageType('error');
    } catch (err) {
      setLogMessage(err.message || 'There was an error checking your account.');
      setLogMessageType('error');
    } finally {
      setIsLogLoading(false);
    }
  };

  /**
   * Initiates Google OAuth login via Supabase.
   * Redirects user to Google OAuth consent screen, then back to the application.
   */
  const handleGoogleAuth = async () => {
    try {
      // Preserve the user's persistence preference across the OAuth redirect
      setAuthPersistence(keepSignedIn);

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin, // Return to this site after login
        },
      });

      if (error) {
        setLogMessage(error.message);
        setLogMessageType('error');
        setRegMessage(error.message);
        setRegMessageType('error');
      }
    } catch (err) {
      const msg = err.message || 'An error occurred connecting to Google.';
      setLogMessage(msg);
      setLogMessageType('error');
      setRegMessage(msg);
      setRegMessageType('error');
    }
  };

  return (
    // Outer container: 'active' class triggers CSS sliding panel animation; 'hide' hides modal when logged in
    <div
      className={`logcontainer ${isActive ? 'active' : ''} ${!isOpen ? 'hide' : ''}`}
      id="logcontainer"
    >
      {/* Sign Up Form Panel */}
      <div className="form-container sign-up">
        <form id="regisForm" onSubmit={handleRegister}>
          {regMessage && (
            <div id="regmessage" className={regMessageType}>
              {regMessage}
            </div>
          )}
          <span className="auth-eyebrow auth-eyebrow-signup">Create an account</span>
          <h1>SIGN UP</h1>

          <label htmlFor="regisName">NAME</label>
          <input
            type="text"
            id="regisName"
            placeholder="Enter your name"
            required
            value={regName}
            onChange={(e) => setRegName(e.target.value)}
          />

          <label htmlFor="regisEmail">EMAIL</label>
          <input
            type="email"
            id="regisEmail"
            placeholder="Enter your email"
            required
            value={regEmail}
            onChange={(e) => setRegEmail(e.target.value)}
          />

          <label htmlFor="regisPassword">PASSWORD</label>
          <input
            type="password"
            id="regisPassword"
            placeholder="Create a password"
            required
            value={regPassword}
            onChange={(e) => setRegPassword(e.target.value)}
          />

          <button type="submit" className="auth-submit-btn" disabled={isRegLoading}>
            {isRegLoading ? 'SIGNING UP...' : 'SIGN UP'}
          </button>

          <div className="auth-divider">
            <span>or</span>
          </div>

          {/* Google OAuth Sign Up Button */}
          <button
            type="button"
            className="google-btn"
            onClick={handleGoogleAuth}
          >
            <GoogleLogo />
            <span>Continue with Google</span>
          </button>
        </form>
      </div>

      {/* Sign In Form Panel */}
      <div className="form-container sign-in">
        <form id="loginForm" onSubmit={handleLogin}>
          {logMessage && (
            <div id="logmessage" className={logMessageType}>
              {logMessage}
            </div>
          )}
          <span className="auth-eyebrow">WELCOME BACK</span>
          <h1>SIGN IN</h1>

          <label htmlFor="logEmail">EMAIL</label>
          <input
            type="email"
            id="logEmail"
            placeholder="Enter your email"
            required
            value={logEmail}
            onChange={(e) => setLogEmail(e.target.value)}
          />

          <label htmlFor="logPass">PASSWORD</label>
          <input
            type="password"
            id="logPass"
            placeholder="Enter your password"
            required
            value={logPass}
            onChange={(e) => setLogPass(e.target.value)}
          />

          <div className="login-options-row">
            <label htmlFor="keepSignedIn" className="keep-signed-in-label">
              <input
                type="checkbox"
                id="keepSignedIn"
                checked={keepSignedIn}
                onChange={(e) => setKeepSignedIn(e.target.checked)}
              />
              <span>Keep me signed in</span>
            </label>
          </div>

          <button type="submit" className="auth-submit-btn" disabled={isLogLoading}>
            {isLogLoading ? 'SIGNING IN...' : 'SIGN IN'}
          </button>

          <div className="auth-divider">
            <span>or</span>
          </div>

          {/* Google OAuth Sign In Button */}
          <button
            type="button"
            className="google-btn"
            onClick={handleGoogleAuth}
          >
            <GoogleLogo />
            <span>Continue with Google</span>
          </button>
        </form>
      </div>

      {/* Animated Sliding Overlay Panels (switches between Sign In and Sign Up) */}
      <div className="toggle-container">
        <div className="toggle">
          {/* Left panel (shown when in Sign Up view, invites user to Sign In) */}
          <div className="toggle-panel toggle-left">
            <h1>Already have an account</h1>
            <p>
              Sign in to pick up your tasks, deadlines, and classes right where
              you left off.
            </p>
            <button
              type="button"
              className="promo-cta-btn"
              id="login"
              onClick={() => setIsActive(false)}
            >
              SIGN IN
            </button>
          </div>

          {/* Right panel (shown when in Sign In view, invites user to Sign Up) */}
          <div className="toggle-panel toggle-right">
            <h1>
              Create an account
              <br />
              to:
            </h1>
            <ul className="promo-feature-list">
              <li>
                <span className="promo-feature-icon" aria-hidden="true">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                    <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                  </svg>
                </span>
                <span>Track activities.</span>
              </li>
              <li>
                <span className="promo-feature-icon" aria-hidden="true">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                  </svg>
                </span>
                <span>Create tasks.</span>
              </li>
              <li>
                <span className="promo-feature-icon" aria-hidden="true">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                </span>
                <span>Schedule your week.</span>
              </li>
            </ul>
            <button
              type="button"
              className="promo-cta-btn"
              id="register"
              onClick={() => setIsActive(true)}
            >
              SIGN UP
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AuthModal;


