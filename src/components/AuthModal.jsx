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

  // Login state
  const [logEmail, setLogEmail] = useState('');
  const [logPass, setLogPass] = useState('');
  const [logMessage, setLogMessage] = useState('');
  const [logMessageType, setLogMessageType] = useState('');

  const handleRegister = async (e) => {
    e.preventDefault();
    setRegMessage('');
    setRegMessageType('');

    const { data: existingUser } = await supabase
      .from('Accounts')
      .select('eMail')
      .eq('eMail', regEmail)
      .maybeSingle();

    if (existingUser) {
      setRegMessage('Your email is already registered.');
      setRegMessageType('error');
      setRegName('');
      setRegEmail('');
      setRegPassword('');
      return;
    }

    const { error } = await supabase
      .from('Accounts')
      .insert([
        {
          userName: regName,
          eMail: regEmail,
          password: regPassword,
        },
      ]);

    if (error) {
      setRegMessage('There was a problem creating your account.');
      setRegMessageType('error');
    } else {
      setRegMessage('Account created successfully.');
      setRegMessageType('success');
    }

    setRegName('');
    setRegEmail('');
    setRegPassword('');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLogMessage('');
    setLogMessageType('');

    const { data: user, error } = await supabase
      .from('Accounts')
      .select('*')
      .eq('eMail', logEmail)
      .eq('password', logPass)
      .maybeSingle();

    if (error) {
      setLogMessage('There was an error checking your account.');
      setLogMessageType('error');
      setLogEmail('');
      setLogPass('');
      return;
    }

    if (!user) {
      setLogMessage('Invalid Email or Password.');
      setLogMessageType('error');
      setLogEmail('');
      setLogPass('');
      return;
    }

    setLogMessage('');
    setLogMessageType('');
    setLogEmail('');
    setLogPass('');

    onLoginSuccess(user);
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
          <br />
          <button type="submit">Sign Up</button>
          <br />
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
          <button type="submit">Sign In</button>
          <br />
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
