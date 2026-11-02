// Import React hooks for local component state
import React, { useState } from 'react';
// Import the shared Supabase client
import { supabase } from '../config/supabase';

/**
 * AuthModal Component
 * Handles user sign in, registration, and Google OAuth.
 * 
 * Props:
 * - isOpen: boolean, whether the modal is visible on screen
 * - onLoginSuccess: callback function called with the authenticated user object
 */
export default function AuthModal({ isOpen, onLoginSuccess }) {
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
          <h1>Create Account</h1>
          <label htmlFor="regisName">Name</label>
          <input
            type="text"
            id="regisName"
            placeholder="Name"
            required
            value={regName}
            onChange={(e) => setRegName(e.target.value)}
          />
          <label htmlFor="regisEmail">Email</label>
          <input
            type="email"
            id="regisEmail"
            placeholder="Email"
            required
            value={regEmail}
            onChange={(e) => setRegEmail(e.target.value)}
          />
          <label htmlFor="regisPassword">Password</label>
          <input
            type="password"
            id="regisPassword"
            placeholder="password"
            required
            value={regPassword}
            onChange={(e) => setRegPassword(e.target.value)}
          />
          <button type="submit" disabled={isRegLoading}>
            {isRegLoading ? 'Signing Up...' : 'Sign Up'}
          </button>
          
          <div className="auth-divider">
            <span>OR</span>
          </div>

          {/* Google OAuth Sign Up Button */}
          <button
            type="button"
            className="google-btn"
            onClick={handleGoogleAuth}
          >
            <i className="fa-brands fa-google"></i> Sign Up with Google
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
          <h1 style={{ textAlign: 'center' }}>Sign In</h1>
          <label htmlFor="logEmail">Email</label>
          <input
            type="email"
            id="logEmail"
            placeholder="Email"
            required
            value={logEmail}
            onChange={(e) => setLogEmail(e.target.value)}
          />
          <label htmlFor="logPass">Password</label>
          <input
            type="password"
            id="logPass"
            placeholder="password"
            required
            value={logPass}
            onChange={(e) => setLogPass(e.target.value)}
          />
          <a href="#">Forgot Your Password?</a>
          <button type="submit" disabled={isLogLoading}>
            {isLogLoading ? 'Signing In...' : 'Sign In'}
          </button>

          <div className="auth-divider">
            <span>OR</span>
          </div>

          {/* Google OAuth Sign In Button */}
          <button
            type="button"
            className="google-btn"
            onClick={handleGoogleAuth}
          >
            <i className="fa-brands fa-google"></i> Continue with Google
          </button>
        </form>
      </div>

      {/* Animated Sliding Overlay Panels (switches between Sign In and Sign Up) */}
      <div className="toggle-container">
        <div className="toggle">
          {/* Left panel (shown when in Sign Up view, invites user to Sign In) */}
          <div className="toggle-panel toggle-left">
            <h1>Welcome Back!</h1>
            <p>Enter your personal details to use all of the site features</p>
            <button
              type="button"
              className="hidden"
              id="login"
              onClick={() => setIsActive(false)}
            >
              Sign In
            </button>
          </div>

          {/* Right panel (shown when in Sign In view, invites user to Sign Up) */}
          <div className="toggle-panel toggle-right">
            <h1>Hello, Friend!</h1>
            <p>
              Create an account to start tracking your tasks, deadlines , and
              classes in one place.
            </p>
            <button
              type="button"
              style={{ width: '50%' }}
              className="hidden"
              id="register"
              onClick={() => setIsActive(true)}
            >
              Sign Up
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
