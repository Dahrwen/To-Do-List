import React, { useState } from 'react';
import { supabase } from '../config/supabase';

export default function AuthModal({ isOpen, onLoginSuccess }) {
  const [isActive, setIsActive] = useState(false);

  // Registration state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regMessage, setRegMessage] = useState('');
  const [regMessageType, setRegMessageType] = useState('');
  const [isRegLoading, setIsRegLoading] = useState(false);

  // Login state
  const [logEmail, setLogEmail] = useState('');
  const [logPass, setLogPass] = useState('');
  const [logMessage, setLogMessage] = useState('');
  const [logMessageType, setLogMessageType] = useState('');
  const [isLogLoading, setIsLogLoading] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    setRegMessage('');
    setRegMessageType('');
    setIsRegLoading(true);

    try {
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

      if (data?.user && !data?.session) {
        setRegMessage('Account created! Please check your email to confirm.');
        setRegMessageType('success');
      } else if (data?.session && data?.user) {
        setRegMessage('Account created successfully!');
        setRegMessageType('success');
        onLoginSuccess(data.user);
      }

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

  const handleLogin = async (e) => {
    e.preventDefault();
    setLogMessage('');
    setLogMessageType('');
    setIsLogLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: logEmail,
        password: logPass,
      });

      if (error) {
        setLogMessage(error.message);
        setLogMessageType('error');
        setIsLogLoading(false);
        return;
      }

      if (data?.user) {
        setLogMessage('');
        setLogMessageType('');
        setLogEmail('');
        setLogPass('');
        onLoginSuccess(data.user);
      }
    } catch (err) {
      setLogMessage(err.message || 'There was an error checking your account.');
      setLogMessageType('error');
    } finally {
      setIsLogLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
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
    <div
      className={`logcontainer ${isActive ? 'active' : ''} ${!isOpen ? 'hide' : ''}`}
      id="logcontainer"
    >
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
          <button
            type="button"
            className="google-btn"
            onClick={handleGoogleAuth}
          >
            <i className="fa-brands fa-google"></i> Sign Up with Google
          </button>
        </form>
      </div>

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
          <button
            type="button"
            className="google-btn"
            onClick={handleGoogleAuth}
          >
            <i className="fa-brands fa-google"></i> Continue with Google
          </button>
        </form>
      </div>

      <div className="toggle-container">
        <div className="toggle">
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
